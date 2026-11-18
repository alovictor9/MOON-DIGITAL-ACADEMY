// lessons.js — Lesson model, CRUD, and progress tracking using Bearilly APIs

/**
 * Lesson document shape (Bearilly):
 * {
 *   id: string,
 *   title: string,
 *   notes: string,             // mapped from description
 *   explanation: string,       // the bear's explanation
 *   position: number,          // 1-based position (mapped from order)
 *   // ... other fields returned by Bearilly
 * }
 */

// ---- Create ----
export async function createLesson(courseId, lesson) {
  // TODO: Bearilly verified endpoints do not include a direct 'Create Lesson' route.
  // Lessons are typically managed within Units (POST /api/v1/courses/:id/units) or via a specific course builder.
  console.warn("createLesson: No verified Bearilly endpoint for direct lesson creation.");
  return null;
}

// ---- Read ----
export async function listLessonsForCourse(courseId) {
  const res = await fetch(`/api/v1/courses/${courseId}/units`, {
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  // Flatten lessons from units to match the expected flat array return type
  // Bearilly returns units, each containing an array of lessons (titles only).
  return (data || []).flatMap(unit => 
    (unit.lessons || []).map(lesson => ({
      ...lesson,
      unitId: unit.id,
      unitTitle: unit.title
    }))
  );
}

export async function getLesson(courseId, lessonId) {
  const res = await fetch(`/api/v1/lessons/${lessonId}`, {
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  return data;
}

// ---- Update / Delete ----
export async function updateLesson(courseId, lessonId, updates) {
  // Map original field names to Bearilly field names if necessary
  const bearillyUpdates = { ...updates };
  if (updates.description) bearillyUpdates.explanation = updates.description;
  if (updates.order) bearillyUpdates.position = Number(updates.order);

  const res = await fetch(`/api/v1/lessons/${lessonId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bearillyUpdates),
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  return data;
}

export async function deleteLesson(courseId, lessonId) {
  // TODO: Bearilly verified endpoints do not include a 'Delete Lesson' route.
  console.warn("deleteLesson: No verified Bearilly endpoint for lesson deletion.");
  return null;
}

// ---- Progress tracking ----
export async function markLessonComplete(uid, courseId, lessonId, totalLessons) {
  // Record the completion event
  await fetch('/api/v1/progress/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'lesson_completed',
      lesson_id: lessonId
    }),
    credentials: 'same-origin'
  });

  // Fetch updated enrollment to get the new progress percentage
  const progress = await getEnrollmentProgress(uid, courseId);
  return progress ? progress.progress_percent : 0;
}

export async function getEnrollmentProgress(uid, courseId) {
  // Bearilly enrolments endpoint returns an array of enrolments for the authenticated user.
  const res = await fetch(`/api/v1/enrolments?course_id=${courseId}`, {
    credentials: 'same-origin'
  });
  const { data } = await res.json();
  // Return the enrolment matching the course
  return (data || []).find(e => e.course_id === courseId) || null;
}