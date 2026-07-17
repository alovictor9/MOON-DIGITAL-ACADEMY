// certificates.js — auto-issued the moment a student passes a course's final
// test (see finalTest.js / course-test.html); publicly verifiable via a short
// certificateCode (see certificate-verify.html).
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

/**
 * Certificate (top-level collection "certificates", id = `${uid}_${courseId}`):
 * { uid, courseId, studentName, courseTitle, instructorName, score, certificateCode, issuedAt }
 */

function generateCode() {
  return 'NDA-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function issueCertificateIfPassed(uid, courseId, { studentName, courseTitle, instructorName, score, credentialTitle, signatoryName }) {
  const ref = doc(db, "certificates", `${uid}_${courseId}`);
  const existing = await getDoc(ref);
  if (existing.exists()) return { id: existing.id, ...existing.data() }; // don't overwrite an earlier issue date
  const data = {
    uid,
    courseId,
    studentName,
    courseTitle,
    credentialTitle: credentialTitle || "", // instructor-set custom credential name, e.g. "Certified Bridal Makeup Specialist" — falls back to courseTitle when empty
    instructorName: instructorName || "",
    signatoryName: signatoryName || instructorName || "",
    score,
    certificateCode: generateCode(),
    issuedAt: serverTimestamp()
  };
  await setDoc(ref, data);
  return { id: `${uid}_${courseId}`, ...data };
}

export async function getCertificate(uid, courseId) {
  const snap = await getDoc(doc(db, "certificates", `${uid}_${courseId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Public lookup by verification code — used on the certificate-verify page.
// No login required; certificates are publicly readable (see firestore.rules).
export async function getCertificateByCode(code) {
  const q = query(collection(db, "certificates"), where("certificateCode", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}
