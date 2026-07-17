# Email Templates for Firebase Console
Firebase Console → Authentication → Templates → (select template) → Edit template

Firebase only lets you edit the body text and subject line (not full HTML design)
on the free tier — the layout/logo wrapper is Firebase's own. For a fully
custom-branded email, you'd send verification/reset emails yourself via a
Cloud Function + an email service (e.g. SendGrid) instead of Firebase's
built-in templates. The copy below works either way.

---

## 1. Email Address Verification (sent automatically on registration)

**Subject:**
Verify your email for Moon Digital Academy

**Body:**
Hi there,

Welcome to Moon Digital Academy! You're one step away from getting started.

Please verify your email address by clicking the link below:

%LINK%

If you didn't create an account with us, you can safely ignore this email.

See you inside,
The Moon Digital Academy Team

---

## 2. Password Reset

**Subject:**
Reset your Moon Digital Academy password

**Body:**
Hi there,

We received a request to reset the password for your Moon Digital Academy
account. Click the link below to choose a new password:

%LINK%

This link will expire soon for your security. If you didn't request a
password reset, you can safely ignore this email — your password won't be
changed.

Need help? Just reply to this email.

The Moon Digital Academy Team

---

## Notes
- `%LINK%` is Firebase's placeholder — it inserts the actual action link automatically. Don't type it out yourself; use Firebase's insert-variable option in the template editor.
- Under Authentication → Templates → Password reset → "Customize action URL",
  point it at your own `reset-password.html` (e.g. `https://yourdomain.com/reset-password.html`)
  so users land on your branded reset page instead of Firebase's default hosted page.
- The "welcome" email in your task list and the "verification" email are the
  same thing here — Firebase doesn't send a separate unconditional welcome
  email. If you want a distinct welcome email (no action link, just "glad
  you're here"), that needs a Cloud Function triggered on user creation,
  sent through an email service.
