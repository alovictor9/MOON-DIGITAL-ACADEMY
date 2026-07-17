// assignments.js — Assignment model, submissions, grading, notifications
// Assignments are quiz-style (multiple-choice + written-response questions,
// answered right in the browser) — no file storage involved, so this module
// has no Cloud Storage dependency at all.
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db, auth } from "./auth.js";

/**
 * Assignment (subcollection: courses/{courseId}/assignments/{assignmentId}):
 * { title, description, lessonId (optional, ties it to one lesson), dueDate (ISO string),
 *   questions: [
 *     { type: "mcq", question, options: [4 strings], correctIndex, points } |
 *     { type: "written", question, points }
 *   ],
 *   maxScore (sum of question points), createdAt }
 *
 * Submission (top-level collection "submissions", id = `${uid}_${assignmentId}`):
 * { uid, courseId, assignmentId, answers: [{ answer, isCorrect (mcq only) }] (one per question, same order),
 *   autoScore (sum of correct MCQ points — a suggestion only), submittedAt,
 *   status: "submitted" | "graded", score, feedback, gradedAt }
 *
 * Notification (top-level collection "notifications"):
 * { uid (recipient), type: "submission" | "graded", message, courseId,
 *   assignmentId, read: false, createdAt }
 */

function assignmentsRef(courseId) {
  return collection(db, "courses", courseId, "assignments");
}

// ---- Assignment CRUD ----
export async function createAssignment(courseId, assignment) {
  const questions = (assignment.questions || []).map(q => ({
    type: q.type === 'written' ? 'written' : 'mcq',
    question: q.question || '',
    options: q.type === 'written' ? null : (q.options || ['', '', '', '']),
    correctIndex: q.type === 'written' ? null : (Number(q.correctIndex) || 0),
    points: Number(q.points) || 10
  }));
  const docRef = await addDoc(assignmentsRef(courseId), {
    title: assignment.title,
    description: assignment.description || "",
    lessonId: assignment.lessonId || null, // optional — ties this assignment to one specific lesson
    dueDate: assignment.dueDate || null,
    questions,
    maxScore: questions.reduce((sum, q) => sum + q.points, 0) || Number(assignment.maxScore) || 100,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function listAssignmentsForCourse(courseId) {
  const q = query(assignmentsRef(courseId), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getAssignment(courseId, assignmentId) {
  const snap = await getDoc(doc(db, "courses", courseId, "assignments", assignmentId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function updateAssignment(courseId, assignmentId, updates) {
  if (updates.questions) {
    updates = {
      ...updates,
      questions: updates.questions.map(q => ({
        type: q.type === 'written' ? 'written' : 'mcq',
        question: q.question || '',
        options: q.type === 'written' ? null : (q.options || ['', '', '', '']),
        correctIndex: q.type === 'written' ? null : (Number(q.correctIndex) || 0),
        points: Number(q.points) || 10
      })),
      maxScore: updates.questions.reduce((sum, q) => sum + (Number(q.points) || 10), 0)
    };
  }
  return updateDoc(doc(db, "courses", courseId, "assignments", assignmentId), updates);
}

export function deleteAssignment(courseId, assignmentId) {
  return deleteDoc(doc(db, "courses", courseId, "assignments", assignmentId));
}

// ---- Student submission (answers are typed/selected in the browser and
// written straight to Firestore — no file upload, no Storage needed) ----
export async function submitAssignment({ uid, courseId, assignmentId, answers, instructorId }) {
  const assignment = await getAssignment(courseId, assignmentId);
  let autoScore = 0;
  const gradedAnswers = (answers || []).map((ans, i) => {
    const q = assignment && assignment.questions ? assignment.questions[i] : null;
    if (q && q.type === 'mcq') {
      const isCorrect = Number(ans) === q.correctIndex;
      if (isCorrect) autoScore += q.points;
      return { answer: ans, isCorrect };
    }
    return { answer: ans };
  });

  const submissionId = `${uid}_${assignmentId}`;
  const data = {
    uid,
    courseId,
    assignmentId,
    answers: gradedAnswers,
    autoScore,
    submittedAt: serverTimestamp(),
    status: "submitted",
    score: null,
    feedback: ""
  };
  await setDoc(doc(db, "submissions", submissionId), data);

  if (instructorId) {
    await notifyUser({
      uid: instructorId,
      type: "submission",
      message: `A student submitted an assignment.`,
      courseId,
      assignmentId
    });
  }
  return data;
}

export async function getSubmission(uid, assignmentId) {
  const snap = await getDoc(doc(db, "submissions", `${uid}_${assignmentId}`));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function listSubmissionsForAssignment(assignmentId, courseId) {
  // Filtering on courseId too (when known) isn't just for narrowing results —
  // Firestore validates "list" queries against what the query could possibly
  // return, not the actual matched documents. The submissions security rule
  // needs to look up courses/{courseId} to confirm the requesting instructor
  // owns that course; without an equality filter pinning courseId to a fixed
  // value, Firestore can't prove every possible result would pass that rule
  // and rejects the whole query — even if the real data would've been fine.
  const clauses = [where("assignmentId", "==", assignmentId)];
  if (courseId) clauses.push(where("courseId", "==", courseId));
  const q = query(collection(db, "submissions"), ...clauses);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function listSubmissionsForStudent(uid) {
  const q = query(collection(db, "submissions"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Instructor grading ----
export async function gradeSubmission(submissionId, { score, feedback }) {
  const ref2 = doc(db, "submissions", submissionId);
  await updateDoc(ref2, {
    score: Number(score),
    feedback: feedback || "",
    status: "graded",
    gradedAt: serverTimestamp()
  });
  const snap = await getDoc(ref2);
  const submission = snap.data();
  await notifyUser({
    uid: submission.uid,
    type: "graded",
    message: `Your assignment was graded: ${score} points.`,
    courseId: submission.courseId,
    assignmentId: submission.assignmentId
  });
  return submission;
}

// ---- Notifications ----
export async function notifyUser({ uid, type, message, courseId, assignmentId }) {
  await addDoc(collection(db, "notifications"), {
    uid,
    type,
    message,
    courseId: courseId || null,
    assignmentId: assignmentId || null,
    read: false,
    createdAt: serverTimestamp()
  });
}

export async function listNotificationsForUser(uid) {
  const q = query(collection(db, "notifications"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function markNotificationRead(notificationId) {
  return updateDoc(doc(db, "notifications", notificationId), { read: true });
}
