// pwa-register.js — included on every page

// ---- Service worker registration ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ---- Custom install prompt ----
// Browsers fire beforeinstallprompt when the site is installable; we intercept
// the default mini-infobar and show our own banner instead.
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner();
});

function showInstallBanner() {
  if (document.getElementById('pwaInstallBanner')) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return; // already installed

  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;max-width:420px;margin:0 auto;background:#14163A;color:#fff;border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 20px 45px -15px rgba(20,22,58,.5);z-index:9999;font-family:Inter,sans-serif;';
  banner.innerHTML = `
    <div style="flex:1;">
      <div style="font-weight:700;font-size:13px;margin-bottom:2px;">Install Moon Digital Academy</div>
      <div style="font-size:11.5px;color:#cfd3ff;">Add it to your home screen for quick, full-screen access.</div>
    </div>
    <button id="pwaInstallBtn" style="background:#F2A93B;color:#14163A;border:none;padding:9px 14px;border-radius:9px;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap;">Install</button>
    <button id="pwaDismissBtn" style="background:none;border:none;color:#9CA3AF;font-size:18px;cursor:pointer;padding:0 4px;line-height:1;" aria-label="Dismiss">&times;</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    banner.remove();
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });
  document.getElementById('pwaDismissBtn').addEventListener('click', () => {
    banner.remove();
    // Don't nag again this session.
    deferredInstallPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) banner.remove();
});

// ---- Notification permission (local notifications work today; server-sent
// push needs a Cloud Function + VAPID key wired up — see service-worker.js) ----
window.requestNotificationPermission = async function () {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.requestPermission();
};
