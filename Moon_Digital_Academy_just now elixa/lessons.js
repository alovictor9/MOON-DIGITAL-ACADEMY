// lessons.js — Lesson model, CRUD, and progress tracking
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  arrayUnion,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

/**
 * Lesson document shape (subcollection: courses/{courseId}/lessons/{lessonId}):
 * {
 *   title: string,
 *   description: string,
 *   videoUrl: string,          // direct video URL (mp4 or hls) or YouTube embed URL
 *   resources: [{ name: string, url: string }],
 *   order: number,             // 1-based position in the course
 *   durationSeconds: number,
 *   createdAt: serverTimestamp
 * }
 */

function lessonsRef(courseId) {
  return collection(db, "courses", courseId, "lessons");
}

// ---- Create ----
export async function createLesson(courseId, lesson) {
  const docRef = await addDoc(lessonsRef(courseId), {
    title: lesson.title,
    description: lesson.description || "",
    videoUrl: lesson.videoUrl,
    resources: lesson.resources || [],
    order: Number(lesson.order) || 1,
    durationSeconds: Number(lesson.durationSeconds) || 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

// ---- Read ----
export async function listLessonsForCourse(courseId) {
  const q = query(lessonsRef(courseId), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getLesson(courseId, lessonId) {
  const snap = await getDoc(doc(db, "courses", courseId, "lessons", lessonId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---- Update / Delete ----
export function updateLesson(courseId, lessonId, updates) {
  return updateDoc(doc(db, "courses", courseId, "lessons", lessonId), updates);
}

export function deleteLesson(courseId, lessonId) {
  return deleteDoc(doc(db, "courses", courseId, "lessons", lessonId));
}

// ---- Progress tracking (reads/writes the enrollment doc from courses.js) ----
export async function markLessonComplete(uid, courseId, lessonId, totalLessons) {
  const ref = doc(db, "enrollments", `${uid}_${courseId}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  await updateDoc(ref, {
    completedLessonIds: arrayUnion(lessonId),
    lastAccessedLessonId: lessonId,
    lastAccessedAt: serverTimestamp()
  });

  const updated = await getDoc(ref);
  const completedCount = (updated.data().completedLessonIds || []).length;
  const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  await updateDoc(ref, { progressPercent });
  return progressPercent;
}

export async function getEnrollmentProgress(uid, courseId) {
  const snap = await getDoc(doc(db, "enrollments", `${uid}_${courseId}`));
  return snap.exists() ? snap.data() : null;
}
