// finalTest.js — end-of-course multiple-choice test: instructor-authored,
// auto-graded on submission.
//
// NOTE ON TRUST MODEL: the test (including correct answers) lives as a plain
// field on the public course document, and grading happens in the browser.
// That means a determined student could technically read the answers out of
// the network response before taking the test. There's no server here to hide
// that from them (no Cloud Functions in this project) — for a small internal
// academy this is an acceptable tradeoff, but it's worth knowing about if this
// ever needs to be tamper-proof (that would require a Cloud Function to grade
// server-side instead).
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

/**
 * Stored directly on the course document:
 * course.finalTest = {
 *   passingScore: number,        // percent, e.g. 70
 *   questions: [
 *     { question: string, options: string[4], correctIndex: number }
 *   ]
 * }
 *
 * Test attempt (top-level collection "testAttempts", id = `${uid}_${courseId}`):
 * { uid, courseId, answers: number[], score, passed, submittedAt }
 */

// ---- Instructor: save/replace the whole test ----
export async function saveFinalTest(courseId, { passingScore, questions }) {
  await updateDoc(doc(db, "courses", courseId), {
    finalTest: {
      passingScore: Number(passingScore) || 70,
      questions: questions.map(q => ({
        question: q.question,
        options: q.options,
        correctIndex: Number(q.correctIndex)
      }))
    }
  });
}

export async function getFinalTest(courseId) {
  const snap = await getDoc(doc(db, "courses", courseId));
  return snap.exists() ? (snap.data().finalTest || null) : null;
}

// ---- Student: submit answers, get auto-graded instantly ----
export async function submitTestAttempt(uid, courseId, answers) {
  const test = await getFinalTest(courseId);
  if (!test) throw new Error("This course has no final test.");

  let correct = 0;
  test.questions.forEach((q, i) => {
    if (Number(answers[i]) === Number(q.correctIndex)) correct++;
  });
  const score = Math.round((correct / test.questions.length) * 100);
  const passed = score >= (test.passingScore || 70);

  const attempt = {
    uid,
    courseId,
    answers,
    score,
    passed,
    submittedAt: serverTimestamp()
  };
  await setDoc(doc(db, "testAttempts", `${uid}_${courseId}`), attempt);
  return { score, passed, correct, total: test.questions.length };
}

export async function getTestAttempt(uid, courseId) {
  const snap = await getDoc(doc(db, "testAttempts", `${uid}_${courseId}`));
  return snap.exists() ? snap.data() : null;
}

// ---- Instructor: see everyone who has taken this course's final test ----
export async function listAttemptsForCourse(courseId) {
  const q = query(collection(db, "testAttempts"), where("courseId", "==", courseId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
