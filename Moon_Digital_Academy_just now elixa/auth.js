// auth.js — shared Firebase Auth + Firestore logic for Moon Digital Academy
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const DASHBOARD_BY_ROLE = {
  student: "dashboard-student.html",
  instructor: "dashboard-instructor.html",
  admin: "dashboard-admin.html"
};

// Turn Firebase error codes into copy a normal person can read.
export function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "An account already exists with that email. Try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/missing-password": "Please enter a password.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error — check your connection and try again.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/expired-action-code": "This reset link has expired. Please request a new one.",
    "auth/invalid-action-code": "This reset link is invalid or has already been used."
  };
  return map[code] || "Something went wrong. Please try again.";
}

// ---- Register ----
export async function registerUser({ firstName, lastName, email, password, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    firstName,
    lastName,
    email,
    role, // "student" | "instructor"
    createdAt: serverTimestamp()
  });
  await sendEmailVerification(cred.user);
  return { user: cred.user, role, dashboard: DASHBOARD_BY_ROLE[role] || "dashboard-student.html" };
}

// ---- Login ----
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const snap = await getDoc(doc(db, "users", cred.user.uid));
  const role = snap.exists() ? snap.data().role : "student";
  return { user: cred.user, role, dashboard: DASHBOARD_BY_ROLE[role] || "dashboard-student.html" };
}

// ---- Google sign-in (login or register, same flow) ----
export async function loginWithGoogle(defaultRole = "student") {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  const ref = doc(db, "users", cred.user.uid);
  const snap = await getDoc(ref);
  let role = defaultRole;
  if (!snap.exists()) {
    const [firstName, ...rest] = (cred.user.displayName || "").split(" ");
    role = defaultRole;
    await setDoc(ref, {
      firstName: firstName || "",
      lastName: rest.join(" "),
      email: cred.user.email,
      role,
      createdAt: serverTimestamp()
    });
  } else {
    role = snap.data().role;
  }
  return { user: cred.user, role, dashboard: DASHBOARD_BY_ROLE[role] || "dashboard-student.html" };
}

// ---- Forgot / reset password ----
export function requestPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export function verifyResetCode(oobCode) {
  return verifyPasswordResetCode(auth, oobCode); // resolves with the user's email
}

export function confirmReset(oobCode, newPassword) {
  return confirmPasswordReset(auth, oobCode, newPassword);
}

// ---- Session helpers ----
export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function logout() {
  return signOut(auth);
}
