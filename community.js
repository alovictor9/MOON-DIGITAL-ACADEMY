// community.js — Community feed: posts, comments, likes

/**
 * TODO: Bearilly Community API endpoints are not yet verified in the provided context.
 * These functions are stubs to preserve the existing UI logic while removing Firebase.
 *
 * Post document shape (collection: "posts"):
 * {
 *   uid, authorName, authorRole, authorInitials,
 *   content: string,
 *   category: string,        // course category or "General Discussion"
 *   likedBy: string[],       // uids who liked this post
 *   commentCount: number,
 *   createdAt: string
 * }
 *
 * Comment document shape (subcollection: posts/{postId}/comments/{commentId}):
 * { uid, authorName, content, createdAt, editedAt }
 */

function initialsFrom(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
}

// ---- Posts ----
export async function createPost({ uid, authorName, authorRole, content, category }) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("createPost: Bearilly Community API endpoint not found in verified context.");
  return null;
}

export async function listPosts({ category = 'all', searchTerm = '' } = {}) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("listPosts: Bearilly Community API endpoint not found in verified context.");
  return [];
}

export async function deletePost(postId) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("deletePost: Bearilly Community API endpoint not found in verified context.");
  return;
}

// ---- Likes ----
export async function toggleLike(postId, uid) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("toggleLike: Bearilly Community API endpoint not found in verified context.");
  return null;
}

// ---- Comments ----
export async function addComment(postId, { uid, authorName, content, replyToId, replyToAuthor }) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("addComment: Bearilly Community API endpoint not found in verified context.");
  return null;
}

export async function listComments(postId) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("listComments: Bearilly Community API endpoint not found in verified context.");
  return [];
}

export async function updateComment(postId, commentId, content) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("updateComment: Bearilly Community API endpoint not found in verified context.");
  return;
}

export async function deleteComment(postId, commentId) {
  // TODO: Implement with Bearilly Community API when available
  console.warn("deleteComment: Bearilly Community API endpoint not found in verified context.");
  return;
}