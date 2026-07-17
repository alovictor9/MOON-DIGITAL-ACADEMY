// courses.js — Course model + CRUD + enrollment, backed by Firestore
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

const coursesRef = collection(db, "courses");

/**
 * Course document shape (collection: "courses"):
 * {
 *   title: string,
 *   description: string,
 *   price: number,            // 0 for free
 *   category: string,         // "Beauty & Cosmetics" | "Food & Catering" | "Digital Business" | "Creator Economy" ...
 *   instructorId: string,     // uid of the instructor
 *   instructorName: string,
 *   lessonsCount: number,
 *   rating: number,           // 0-5
 *   ratingCount: number,
 *   thumbGradient: string,    // CSS gradient string used for the card thumbnail (no image hosting yet)
 *   status: string,           // "pending" | "approved" | "rejected" — set by an admin; only "approved" shows in the public catalog
 *   rejectionReason: string,  // set by an admin when rejecting
 *   createdAt: serverTimestamp
 * }
 */

// ---- Create ----
// New courses start as "pending" and are invisible in the public catalog until
// an admin approves them (see the Course Approval page in dashboard-admin.html
// and firestore.rules, which enforces this server-side too). An admin running
// seed-courses.html can pass status: 'approved' directly to skip the queue.
export async function createCourse(course) {
  const docRef = await addDoc(coursesRef, {
    title: course.title,
    description: course.description || "",
    price: Number(course.price) || 0,
    category: course.category,
    instructorId: course.instructorId,
    instructorName: course.instructorName,
    lessonsCount: Number(course.lessonsCount) || 0,
    rating: 0,
    ratingCount: 0,
    thumbGradient: course.thumbGradient || "linear-gradient(160deg,#7C8CF0,#3957D6)",
    thumbnailUrl: course.thumbnailUrl || null, // real uploaded image, takes priority over thumbGradient when set
    introVideoUrl: course.introVideoUrl || "",
    status: course.status || "pending",
    rejectionReason: null,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

// ---- Admin: course approval queue ----
export async function listPendingCourses() {
  const q = query(coursesRef, where("status", "==", "pending"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function approveCourse(courseId) {
  return updateDoc(doc(db, "courses", courseId), { status: "approved", rejectionReason: null });
}

export function rejectCourse(courseId, reason) {
  return updateDoc(doc(db, "courses", courseId), { status: "rejected", rejectionReason: reason || "" });
}

// ---- Thumbnail rendering helper ----
// Returns an inline `style` attribute value: real uploaded image if present,
// otherwise falls back to the CSS gradient placeholder.
export function courseThumbStyle(course) {
  if (course.thumbnailUrl) {
    return `background-image:url('${course.thumbnailUrl}');background-size:cover;background-position:center;`;
  }
  return `background:${course.thumbGradient || "linear-gradient(160deg,#7C8CF0,#3957D6)"};`;
}

// ---- Read one ----
export async function getCourse(courseId) {
  const snap = await getDoc(doc(db, "courses", courseId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ---- Update ----
export function updateCourse(courseId, updates) {
  return updateDoc(doc(db, "courses", courseId), updates);
}

// ---- Delete ----
export function deleteCourse(courseId) {
  return deleteDoc(doc(db, "courses", courseId));
}

// ---- List / search / filter / sort ----
// Firestore can't do free-text search + multiple filters in one query well,
// so we filter by category server-side (cheap, indexed) and do status/text
// search + sorting client-side over the (usually small) result set. Filtering
// status client-side (rather than a second `where`) avoids needing a composite
// Firestore index for every category.
export async function listCourses({ category = "all", searchTerm = "", sortBy = "newest", includeAllStatuses = false } = {}) {
  let q;
  if (category && category !== "all") {
    q = query(coursesRef, where("category", "==", category));
  } else {
    q = query(coursesRef);
  }
  const snap = await getDocs(q);
  let courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Public catalog only shows admin-approved courses. Older course docs from
  // before this field existed have no `status` at all — treat those as
  // approved too, so a one-time backfill (see backend notes) is optional
  // rather than mandatory to avoid the catalog going empty. Pass
  // includeAllStatuses: true for admin views that need to see everything.
  if (!includeAllStatuses) {
    courses = courses.filter(c => !c.status || c.status === "approved");
  }

  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    courses = courses.filter(c =>
      c.title.toLowerCase().includes(term) ||
      (c.instructorName || "").toLowerCase().includes(term)
    );
  }

  switch (sortBy) {
    case "price-low":
      courses.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      courses.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      courses.sort((a, b) => b.rating - a.rating);
      break;
    case "newest":
    default:
      courses.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }

  return courses;
}

export async function listCoursesByInstructor(instructorId) {
  const q = query(coursesRef, where("instructorId", "==", instructorId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Enrollment ----
// One doc per (user, course) pair, id = `${uid}_${courseId}`, so re-enrolling is a no-op.
export async function enrollInCourse(uid, courseId) {
  const enrollmentId = `${uid}_${courseId}`;
  const ref = doc(db, "enrollments", enrollmentId);
  const existing = await getDoc(ref);
  if (existing.exists()) return existing.data();
  const data = {
    uid,
    courseId,
    enrolledAt: serverTimestamp(),
    progressPercent: 0,
    completedLessonIds: []
  };
  await setDoc(ref, data);
  return data;
}

export async function isEnrolled(uid, courseId) {
  const snap = await getDoc(doc(db, "enrollments", `${uid}_${courseId}`));
  return snap.exists();
}

export async function listEnrollmentsForUser(uid) {
  const q = query(collection(db, "enrollments"), where("uid", "==", uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
