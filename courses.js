// courses.js — Course model + CRUD + enrollment, backed by Bearilly APIs

/**
 * Course document shape (Bearilly /api/v1/courses):
 * {
 *   id: string,
 *   title: string,
 *   description: string,
 *   level: string,            // Maps to original 'category' or 'level'
 *   status: string,           // "draft" | "published"
 *   instructor_id: string,
 *   instructor_name: string,
 *   lessons_count: number,
 *   rating: number,
 *   thumbnail_url: string,
 *   created_at: string
 * }
 */

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'same-origin',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'API request failed');
  return result.data;
}

// ---- Create ----
export async function createCourse(course) {
  return apiFetch('/api/v1/courses', {
    method: 'POST',
    body: JSON.stringify({
      title: course.title,
      description: course.description || "",
      level: course.category || "General",
      status: course.status === "approved" ? "published" : "draft",
      // Note: instructor info is typically derived from the session on the server
    }),
  });
}

// ---- Admin: course approval queue ----
export async function listPendingCourses() {
  const courses = await apiFetch('/api/v1/courses');
  // In Bearilly, 'draft' status represents courses not yet published/approved for the catalog
  return courses.filter(c => c.status === "draft");
}

export function approveCourse(courseId) {
  // For catalogue courses, use enable. For school's own, use PATCH status.
  // We attempt enable first as it covers the catalogue use case.
  return apiFetch(`/api/v1/courses/${courseId}/enable`, { method: 'POST' })
    .catch(() => apiFetch(`/api/v1/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' })
    }));
}

export function rejectCourse(courseId, reason) {
  // We use disable for catalogue courses or PATCH status for school's own.
  return apiFetch(`/api/v1/courses/${courseId}/disable`, { method: 'POST' })
    .catch(() => apiFetch(`/api/v1/courses/${courseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'draft' })
    }));
}

// ---- Thumbnail rendering helper ----
export function courseThumbStyle(course) {
  if (course.thumbnail_url || course.thumbnailUrl) {
    return `background-image:url('${course.thumbnail_url || course.thumbnailUrl}');background-size:cover;background-position:center;`;
  }
  // Fallback to the original design's gradient logic if no image is provided by Bearilly
  return `background:${course.thumbGradient || "linear-gradient(160deg,#7C8CF0,#3957D6)"};`;
}

// ---- Read one ----
export async function getCourse(courseId) {
  return apiFetch(`/api/v1/courses/${courseId}`);
}

// ---- Update ----
export function updateCourse(courseId, updates) {
  return apiFetch(`/api/v1/courses/${courseId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ---- Delete ----
export function deleteCourse(courseId) {
  // Bearilly uses disable to remove from active school view
  return apiFetch(`/api/v1/courses/${courseId}/disable`, { method: 'POST' });
}

// ---- List / search / filter / sort ----
export async function listCourses({ category = "all", searchTerm = "", sortBy = "newest", includeAllStatuses = false } = {}) {
  let courses = await apiFetch('/api/v1/courses');

  // Filter by status
  if (!includeAllStatuses) {
    courses = courses.filter(c => c.status === "published");
  }

  // Filter by category (mapped to 'level' in Bearilly)
  if (category && category !== "all") {
    courses = courses.filter(c => c.level === category);
  }

  // Search
  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    courses = courses.filter(c =>
      c.title.toLowerCase().includes(term) ||
      (c.instructor_name || "").toLowerCase().includes(term)
    );
  }

  // Sort
  switch (sortBy) {
    case "price-low":
      // Bearilly courses in the school context are usually part of the subscription
      // but we retain the sort logic for compatibility.
      courses.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case "price-high":
      courses.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case "rating":
      courses.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    case "newest":
    default:
      courses.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return courses;
}

export async function listCoursesByInstructor(instructorId) {
  const courses = await apiFetch('/api/v1/courses');
  return courses.filter(c => c.instructor_id === instructorId);
}

// ---- Enrollment ----
export async function enrollInCourse(uid, courseId) {
  // Bearilly handles the current user session; student_id is optional for self-enrollment
  return apiFetch('/api/v1/enrolments', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId }),
  });
}

export async function isEnrolled(uid, courseId) {
  // Query enrolments for the current user and specific course
  const enrolments = await apiFetch(`/api/v1/enrolments?course_id=${courseId}`);
  // If the array is not empty, the user is enrolled
  return Array.isArray(enrolments) && enrolments.length > 0;
}

export async function listEnrollmentsForUser(uid) {
  // Bearilly returns enrolments for the authenticated user
  return apiFetch('/api/v1/enrolments');
}