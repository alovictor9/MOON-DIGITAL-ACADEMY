// announcements.js — platform-wide announcements composed by admins, surfaced
// to students/instructors on their dashboard. There's no push/email delivery —
// a user only sees a new announcement the next time they open their dashboard.
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

const announcementsRef = collection(db, "announcements");

/**
 * Announcement document shape (collection: "announcements"):
 * { title, message, audience: "all" | "student" | "instructor", createdBy, createdAt }
 */

// ---- Admin: compose ----
export async function createAnnouncement({ title, message, audience, createdBy }) {
  const docRef = await addDoc(announcementsRef, {
    title,
    message,
    audience: audience || 'all',
    createdBy,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

// ---- Admin: full list, newest first ----
export async function listAnnouncements() {
  const q = query(announcementsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteAnnouncement(announcementId) {
  await deleteDoc(doc(db, "announcements", announcementId));
}

// ---- Students/instructors: announcements meant for their role ----
// Firestore can't OR two different values of the same field in one query, so
// this fetches "all" and the caller's own role separately and merges client-side.
export async function listAnnouncementsForRole(role) {
  const [allSnap, roleSnap] = await Promise.all([
    getDocs(query(announcementsRef, where("audience", "==", "all"))),
    getDocs(query(announcementsRef, where("audience", "==", role)))
  ]);
  const combined = [
    ...allSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    ...roleSnap.docs.map(d => ({ id: d.id, ...d.data() }))
  ];
  combined.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return combined;
}
