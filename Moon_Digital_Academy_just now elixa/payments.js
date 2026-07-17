// payments.js — Payment records, tied to course enrollment
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";
import { enrollInCourse } from "./courses.js";

const paymentsRef = collection(db, "payments");

/**
 * Payment document shape (collection: "payments"):
 * {
 *   uid: string,
 *   courseId: string,
 *   courseTitle: string,
 *   amount: number,
 *   method: "paystack" | "flutterwave" | "bank_transfer",
 *   status: "pending" | "completed" | "failed",
 *   reference: string,       // our own reference, shown on the receipt
 *   createdAt, completedAt: serverTimestamp
 * }
 *
 * IMPORTANT: There is no real payment gateway wired up yet. "processPayment"
 * below simulates a gateway round-trip. To go live:
 *   - Card payments (Paystack/Flutterwave): initialize their JS SDK with a
 *     real public key, open their checkout popup, and on their success
 *     callback verify the transaction server-side (Cloud Function) before
 *     marking the payment "completed" — never trust a client-side callback
 *     alone for something this consequential.
 *   - Bank transfer: typically stays "pending" until an admin reconciles it
 *     against the bank statement and marks it completed manually.
 */

function generateReference() {
  return 'NDA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createPayment({ uid, courseId, courseTitle, amount, method }) {
  const reference = generateReference();
  const docRef = await addDoc(paymentsRef, {
    uid,
    courseId,
    courseTitle,
    amount,
    method,
    status: method === 'bank_transfer' ? 'pending' : 'pending',
    reference,
    createdAt: serverTimestamp(),
    completedAt: null
  });
  return { id: docRef.id, reference };
}

// Simulates a card-payment gateway round trip. Resolves to "completed" or
// "failed" — replace this with a real Paystack/Flutterwave SDK call.
export function simulateCardProcessing() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(Math.random() > 0.05 ? 'completed' : 'failed'); // ~95% success, for testing the failure UI too
    }, 1800);
  });
}

export async function completePayment(paymentId, courseId, uid) {
  await updateDoc(doc(db, "payments", paymentId), {
    status: 'completed',
    completedAt: serverTimestamp()
  });
  await enrollInCourse(uid, courseId);
}

export async function failPayment(paymentId) {
  await updateDoc(doc(db, "payments", paymentId), { status: 'failed' });
}

export async function getPayment(paymentId) {
  const snap = await getDoc(doc(db, "payments", paymentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listPaymentsForUser(uid) {
  const q = query(paymentsRef, where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
