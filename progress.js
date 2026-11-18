// progress.js — Student progress tracking, built on top of Bearilly progress, enrolments, and courses APIs
import { getCourse, listEnrollmentsForUser } from "./courses.js";
import { listLessonsForCourse } from "./lessons.js";

async function bearillyFetch(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || json?.message || `Request failed (${res.status})`);
  }
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

async function resolveStudentId(uid) {
  if (uid) return uid;
  const me = await bearillyFetch("/api/v1/auth/me");
  return me?.id || null;
}

/**
 * Record a lesson progress event (e.g. "lesson_opened" or "lesson_completed")
 * for the authenticated student via Bearilly.
 */
export async function recordProgressEvent(lessonId, kind = "lesson_completed") {
  if (!lessonId) return null;
  return bearillyFetch("/api/v1/progress/events", {
    method: "POST",
    body: JSON.stringify({ kind, lesson_id: lessonId })
  });
}

/**
 * Progress for a single course, fetched from Bearilly student progress
 * and enriched with course + lesson details.
 */
export async function getCourseProgress(uid, courseId) {
  const studentId = await resolveStudentId(uid);
  if (!studentId || !courseId) return null;

  const [course, lessons, enrollments, progressData] = await Promise.all([
    getCourse(courseId),
    listLessonsForCourse(courseId),
    listEnrollmentsForUser(studentId),
    bearillyFetch(`/api/v1/students/${encodeURIComponent(studentId)}/progress`).catch(() => null)
  ]);

  const progressCourses = Array.isArray(progressData?.courses) ? progressData.courses : [];
  const progressEntry = progressCourses.find(
    c => (c.course_id || c.courseId || c.id) === courseId
  );
  const enrollment = (enrollments || []).find(
    e => (e.courseId || e.course_id) === courseId
  );

  if (!enrollment && !progressEntry) return null;

  const completedLessonIds =
    progressEntry?.completed_lesson_ids ||
    progressEntry?.completedLessonIds ||
    enrollment?.completedLessonIds ||
    enrollment?.completed_lesson_ids ||
    [];

  const totalLessons =
    typeof progressEntry?.total_lessons === "number"
      ? progressEntry.total_lessons
      : lessons.length;

  const completedCount =
    typeof progressEntry?.completed_lessons === "number"
      ? progressEntry.completed_lessons
      : typeof progressEntry?.completed_count === "number"
        ? progressEntry.completed_count
        : completedLessonIds.length;

  const percent =
    typeof progressEntry?.percent === "number"
      ? Math.round(progressEntry.percent)
      : totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 100)
        : 0;

  return {
    course: course || progressEntry?.course || null,
    totalLessons,
    completedCount,
    percent,
    lastAccessedLessonId:
      progressEntry?.last_accessed_lesson_id ||
      enrollment?.lastAccessedLessonId ||
      enrollment?.last_accessed_lesson_id ||
      null,
    nextLessonId: pickNextLesson(lessons, completedLessonIds)
  };
}

/**
 * All of a student's enrolled courses with progress, for the "My Courses"
 * dashboard view. Sorted so in-progress courses surface before completed ones.
 */
export async function listMyCourseProgress(uid) {
  const studentId = await resolveStudentId(uid);
  if (!studentId) return [];

  const [dashboardData, enrollments] = await Promise.all([
    bearillyFetch(`/api/v1/students/${encodeURIComponent(studentId)}/dashboard`).catch(() => null),
    listEnrollmentsForUser(studentId).catch(() => [])
  ]);

  const dashboardCourses = Array.isArray(dashboardData?.progress?.courses)
    ? dashboardData.progress.courses
    : [];

  const courseIds = new Set([
    ...dashboardCourses.map(c => c.course_id || c.courseId || c.id).filter(Boolean),
    ...(enrollments || []).map(e => e.courseId || e.course_id).filter(Boolean)
  ]);

  const results = [];

  for (const courseId of courseIds) {
    const progressEntry = dashboardCourses.find(
      c => (c.course_id || c.courseId || c.id) === courseId
    );
    const enrollment = (enrollments || []).find(
      e => (e.courseId || e.course_id) === courseId
    );

    const [course, lessons] = await Promise.all([
      getCourse(courseId).catch(() => null),
      listLessonsForCourse(courseId).catch(() => [])
    ]);

    const resolvedCourse = course || progressEntry?.course || (progressEntry ? { id: courseId, title: progressEntry.title } : null);
    if (!resolvedCourse) continue;

    const completedLessonIds =
      progressEntry?.completed_lesson_ids ||
      progressEntry?.completedLessonIds ||
      enrollment?.completedLessonIds ||
      enrollment?.completed_lesson_ids ||
      [];

    const totalLessons =
      typeof progressEntry?.total_lessons === "number"
        ? progressEntry.total_lessons
        : lessons.length;

    const completedCount =
      typeof progressEntry?.completed_lessons === "number"
        ? progressEntry.completed_lessons
        : typeof progressEntry?.completed_count === "number"
          ? progressEntry.completed_count
          : completedLessonIds.length;

    const percent =
      typeof progressEntry?.percent === "number"
        ? Math.round(progressEntry.percent)
        : totalLessons > 0
          ? Math.round((completedCount / totalLessons) * 100)
          : 0;

    results.push({
      course: resolvedCourse,
      totalLessons,
      completedCount,
      percent,
      isComplete: totalLessons > 0 && completedCount >= totalLessons,
      nextLessonId: pickNextLesson(lessons, completedLessonIds)
    });
  }

  results.sort((a, b) => {
    if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
    return b.percent - a.percent;
  });
  return results;
}

function pickNextLesson(lessons, completedLessonIds) {
  const next = lessons.find(l => !completedLessonIds.includes(l.id));
  return next ? next.id : (lessons[0] ? lessons[0].id : null);
}