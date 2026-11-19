/** Turn a Firebase/network error into a short message that is safe to show users. */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const { code, message } = (err ?? {}) as { code?: string; message?: string };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Check your internet connection and try again.';
  }

  switch (code) {
    case 'auth/network-request-failed':
      return 'Cannot reach the server. Check your internet connection (or DNS/VPN) and try again.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled for the project.';
    case 'storage/unauthorized':
      return 'Image upload was blocked by storage permissions. Please sign in again or contact support.';
    case 'storage/bucket-not-found':
    case 'storage/project-not-found':
      return 'Image upload is not available yet: Firebase Storage is not enabled for this project. Paste an image link below instead, or ask your admin to enable Storage.';
    case 'storage/quota-exceeded':
      return 'Image storage quota exceeded.';
    case 'storage/retry-limit-exceeded':
      return 'Upload timed out. Check your internet connection and try again.';
    case 'storage/canceled':
      return 'Upload cancelled.';
    case 'permission-denied':
      return 'You do not have permission to do that.';
    case 'unavailable':
      return 'Service temporarily unreachable. Check your connection and try again.';
  }
  if (message && /client is offline/i.test(message)) {
    return 'Cannot reach the database. Check your internet connection and try again.';
  }
  return message || fallback;
}
