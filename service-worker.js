// service-worker.js — Moon Digital Academy PWA
// Strategy:
//  - Static app shell (HTML/JS/manifest/icons): cache-first, refreshed in the background
//  - Navigations (HTML pages): network-first, falling back to cache, then to offline.html
//  - Firebase Auth/Firestore/Storage requests: never cached — always go straight to the
//    network, since this data must be live and caching auth responses would be unsafe.

const CACHE_VERSION = 'mda-v2';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Core app shell — cheap to keep in the cache and enough to make the site
// browsable (not just a blank screen) when offline.
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html',
  '/register.html',
  '/forgot-password.html',
  '/courses.html',
  '/course-detail.html',
  '/dashboard-student.html',
  '/dashboard-instructor.html',
  '/dashboard-admin.html',
  '/my-courses.html',
  '/lesson.html',
  '/community.html',
  '/certificate.html',
  '/certificate-verify.html',
  '/payment.html',
  '/assignments.html',
  '/grading.html',
  '/offline.html',
  '/manifest.json',
  '/auth.js',
  '/courses.js',
  '/lessons.js',
  '/assignments.js',
  '/progress.js',
  '/announcements.js',
  '/payments.js',
  '/certificates.js',
  '/community.js',
  '/pwa-register.js',
  '/icon-192.png'
];

// Domains that must always hit the network — live/authenticated data.
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'www.googleapis.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // Cache what we can; don't fail install if a couple of optional pages 404 locally
      // (e.g. this list is broader than what's deployed in some environments).
      Promise.all(
        APP_SHELL.map((url) => cache.add(url).catch(() => null))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key.startsWith('mda-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept live Firebase API calls.
  if (NEVER_CACHE_HOSTS.some((host) => url.hostname === host)) {
    return;
  }

  // Navigations (loading an HTML page): network-first, cache fallback, offline page last.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Everything else (JS modules, CDN Firebase SDK files, icons, manifest):
  // cache-first, refresh the cache in the background, network fallback.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// ---- Push notifications ----
// No backend sends push messages yet (that needs a server/Cloud Function using
// the Firebase Admin SDK + the device tokens collected in pwa-register.js).
// This handler is here so the plumbing works the moment that's connected.
self.addEventListener('push', (event) => {
  let data = { title: 'Moon Digital Academy', body: 'You have a new update.' };
  try { data = event.data ? event.data.json() : data; } catch (e) { /* plain text payload, use default */ }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Moon Digital Academy', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard-student.html' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard-student.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
