// community.js — Community feed: posts, comments, likes
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
  arrayRemove,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { db } from "./auth.js";

const postsRef = collection(db, "posts");

/**
 * Post document shape (collection: "posts"):
 * {
 *   uid, authorName, authorRole, authorInitials,
 *   content: string,
 *   category: string,        // course category or "General Discussion"
 *   likedBy: string[],       // uids who liked this post
 *   commentCount: number,
 *   createdAt: serverTimestamp
 * }
 *
 * Comment document shape (subcollection: posts/{postId}/comments/{commentId}):
 * { uid, authorName, content, createdAt, editedAt }
 */

// ---- Posts ----
export async function createPost({ uid, authorName, authorRole, content, category }) {
  const docRef = await addDoc(postsRef, {
    uid,
    authorName,
    authorRole: authorRole || 'student',
    authorInitials: initialsFrom(authorName),
    content,
    category: category || 'General Discussion',
    likedBy: [],
    commentCount: 0,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

function initialsFrom(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + ((parts[1] || '')[0] || '');
}

export async function listPosts({ category = 'all', searchTerm = '' } = {}) {
  const q = query(postsRef, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  let posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (category !== 'all') {
    posts = posts.filter(p => p.category === category);
  }
  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    posts = posts.filter(p =>
      p.content.toLowerCase().includes(term) ||
      (p.authorName || '').toLowerCase().includes(term));
  }
  return posts;
}

export function deletePost(postId) {
  return deleteDoc(doc(db, "posts", postId));
}

// ---- Likes ----
export async function toggleLike(postId, uid) {
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const likedBy = snap.data().likedBy || [];
  const alreadyLiked = likedBy.includes(uid);
  await updateDoc(ref, {
    likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid)
  });
  return !alreadyLiked;
}

// ---- Comments ----
function commentsRef(postId) {
  return collection(db, "posts", postId, "comments");
}

export async function addComment(postId, { uid, authorName, content, replyToId, replyToAuthor }) {
  const docRef = await addDoc(commentsRef(postId), {
    uid,
    authorName,
    content,
    replyToId: replyToId || null,
    replyToAuthor: replyToAuthor || null,
    createdAt: serverTimestamp(),
    editedAt: null
  });
  await updateDoc(doc(db, "posts", postId), { commentCount: (await countComments(postId)) });
  return docRef.id;
}

async function countComments(postId) {
  const snap = await getDocs(commentsRef(postId));
  return snap.size;
}

export async function listComments(postId) {
  const q = query(commentsRef(postId), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function updateComment(postId, commentId, content) {
  return updateDoc(doc(db, "posts", postId, "comments", commentId), {
    content,
    editedAt: serverTimestamp()
  });
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  await updateDoc(doc(db, "posts", postId), { commentCount: (await countComments(postId)) });
}
