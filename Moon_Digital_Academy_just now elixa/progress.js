// progress.js — Student progress tracking, built on top of enrollments + lessons
import { getCourse, listEnrollmentsForUser } from "./courses.js";
import { listLessonsForCourse } from "./lessons.js";

/**
 * Progress for a single course, computed from the enrollment doc
 * (enrollments/{uid}_{courseId}) which stores completedLessonIds + progressPercent.
 */
export async function getCourseProgress(uid, courseId) {
  const [course, lessons] = await Promise.all([
    getCourse(courseId),
    listLessonsForCourse(courseId)
  ]);
  const enrollments = await listEnrollmentsForUser(uid);
  const enrollment = enrollments.find(e => e.courseId === courseId);
  if (!enrollment) return null;

  const totalLessons = lessons.length;
  const completedCount = (enrollment.completedLessonIds || []).length;
  const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  return {
    course,
    totalLessons,
    completedCount,
    percent,
    lastAccessedLessonId: enrollment.lastAccessedLessonId || null,
    nextLessonId: pickNextLesson(lessons, enrollment.completedLessonIds || [])
  };
}

/**
 * All of a student's enrolled courses with progress, for the "My Courses"
 * dashboard view. Sorted so in-progress courses surface before completed ones.
 */
export async function listMyCourseProgress(uid) {
  const enrollments = await listEnrollmentsForUser(uid);
  const results = [];

  for (const enrollment of enrollments) {
    const [course, lessons] = await Promise.all([
      getCourse(enrollment.courseId),
      listLessonsForCourse(enrollment.courseId)
    ]);
    if (!course) continue;

    const totalLessons = lessons.length;
    const completedCount = (enrollment.completedLessonIds || []).length;
    const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    results.push({
      course,
      totalLessons,
      completedCount,
      percent,
      isComplete: totalLessons > 0 && completedCount >= totalLessons,
      nextLessonId: pickNextLesson(lessons, enrollment.completedLessonIds || [])
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
