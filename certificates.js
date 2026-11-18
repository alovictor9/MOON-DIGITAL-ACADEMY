// certificates.js — auto-issued the moment a student passes a course's final
// test; publicly verifiable via a short certificateCode.

function generateCode() {
  return 'NDA-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Issue a certificate if passed.
 * TODO: Bearilly auto-issues certificates upon course completion.
 * This stub checks for an existing certificate from Bearilly or provides a safe fallback structure.
 */
export async function issueCertificateIfPassed(uid, courseId, { studentName, courseTitle, instructorName, score, credentialTitle, signatoryName }) {
  const existing = await getCertificate(uid, courseId);
  if (existing) return existing;

  return {
    id: `${uid}_${courseId}`,
    uid,
    courseId,
    studentName,
    courseTitle,
    credentialTitle: credentialTitle || courseTitle || "",
    instructorName: instructorName || "",
    signatoryName: signatoryName || instructorName || "",
    score,
    certificateCode: generateCode(),
    issuedAt: new Date().toISOString()
  };
}

/**
 * Get a certificate for a student and course from Bearilly.
 */
export async function getCertificate(uid, courseId) {
  if (!uid) return null;
  try {
    const res = await fetch(`/api/v1/students/${encodeURIComponent(uid)}/certificates`, {
      credentials: 'same-origin'
    });
    if (!res.ok) return null;
    const json = await res.json();
    const certs = json.data || json;

    if (!certs) return null;

    const list = Array.isArray(certs) ? certs : [certs];
    const match = list.find(c => (c.course_id || c.courseId || c.course?.id) === courseId);
    if (!match) return null;

    return {
      id: match.id || `${uid}_${courseId}`,
      uid: match.student_id || match.uid || uid,
      courseId: match.course_id || match.courseId || courseId,
      studentName: match.student_name || match.full_name || match.studentName,
      courseTitle: match.course_title || match.courseTitle || match.course?.title,
      credentialTitle: match.credential_title || match.credentialTitle || match.course_title || match.courseTitle || match.course?.title || "",
      instructorName: match.instructor_name || match.instructorName || match.course?.instructor || "",
      signatoryName: match.signatory_name || match.signatoryName || match.instructor_name || match.instructorName || "",
      score: match.score,
      certificateCode: match.certificate_code || match.code,
      issuedAt: match.issued_at || match.issuedAt || match.created_at
    };
  } catch (err) {
    console.error("Error fetching student certificates:", err);
    return null;
  }
}

/**
 * Public lookup by verification code — used on the certificate-verify page.
 * Uses Bearilly public verification endpoint: GET /api/v1/certificates/verify/:code
 */
export async function getCertificateByCode(code) {
  if (!code) return null;
  try {
    const res = await fetch(`/api/v1/certificates/verify/${encodeURIComponent(code)}`, {
      credentials: 'same-origin'
    });
    if (!res.ok) return null;
    const json = await res.json();
    const cert = json.data || json;
    if (!cert) return null;

    return {
      id: cert.id || code,
      uid: cert.student_id || cert.uid,
      courseId: cert.course_id || cert.courseId,
      studentName: cert.student_name || cert.full_name || cert.studentName,
      courseTitle: cert.course_title || cert.courseTitle,
      credentialTitle: cert.credential_title || cert.credentialTitle || cert.course_title || cert.courseTitle || "",
      instructorName: cert.instructor_name || cert.instructorName || "",
      signatoryName: cert.signatory_name || cert.signatoryName || cert.instructor_name || cert.instructorName || "",
      score: cert.score,
      certificateCode: cert.certificate_code || cert.code || code,
      issuedAt: cert.issued_at || cert.issuedAt || cert.created_at
    };
  } catch (err) {
    console.error("Error verifying certificate code:", err);
    return null;
  }
}