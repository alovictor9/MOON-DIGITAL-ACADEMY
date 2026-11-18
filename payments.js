import { enrollInCourse } from "./courses.js";

/**
 * Payment records, tied to course enrollment.
 * Migrated to Bearilly School Fees API.
 * 
 * In Bearilly, payments are managed through Invoices and Fee Schedules.
 * Students pay invoices via the integrated Paystack checkout.
 */

function generateReference() {
  return 'NDA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function createPayment({ uid, courseId, courseTitle, amount, method }) {
  // TODO: In Bearilly, invoices are created by admins from published fee schedules.
  // For student-initiated course purchases, ensure a schedule exists for the course.
  // This local record creation is replaced by Bearilly's invoice system.
  // Return a stub to maintain compatibility with existing UI flow until admin-created invoices are linked.
  console.warn("createPayment: Invoices should be created via Bearilly Admin /api/v1/school-fees/invoices");
  return { id: 'pending-invoice-id', reference: generateReference() };
}

/**
 * Initializes the Paystack checkout flow for an invoice.
 * Replaces the previous simulation with the verified Bearilly checkout endpoint.
 */
export async function simulateCardProcessing(invoiceId) {
  const res = await fetch(`/api/v1/school-fees/invoices/${invoiceId}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  return data; // Returns Paystack initialization data (authorization_url, access_code, etc.)
}

/**
 * Verifies a payment and enrolls the student.
 * @param {string} paymentId - The Bearilly Invoice ID.
 * @param {string} courseId - The ID of the course to enroll in.
 * @param {string} uid - Student ID (handled by session, but kept for signature compatibility).
 * @param {string} reference - The Paystack transaction reference.
 */
export async function completePayment(paymentId, courseId, uid, reference) {
  const res = await fetch(`/api/v1/school-fees/invoices/${paymentId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference }),
    credentials: 'same-origin'
  });
  
  const { data } = await res.json();
  
  // If the invoice is marked as paid/completed, proceed with enrollment
  if (data.status === 'paid' || data.status === 'completed') {
    await enrollInCourse(courseId);
  }
  
  return data;
}

export async function failPayment(paymentId) {
  // Bearilly handles invoice status automatically via the verification endpoint.
  // This is retained as a safe stub for local UI state management.
  console.log(`Payment ${paymentId} failed or was cancelled by the user.`);
}

export async function getPayment(paymentId) {
  const res = await fetch(`/api/v1/school-fees/invoices/${paymentId}`, {
    method: 'GET',
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  return data;
}

export async function listPaymentsForUser(uid) {
  // Bearilly returns invoices for the authenticated student.
  const res = await fetch('/api/v1/school-fees/invoices', {
    method: 'GET',
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  return data;
}