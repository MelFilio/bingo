import { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/popup-blocked': 'Allow pop-ups for this site, then try again.',
  'auth/popup-closed-by-user': 'Google sign-in was canceled. Please try again.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/account-exists-with-different-credential':
    'An account already exists for this email. Sign in with its original method.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
}

export function getAuthErrorMessage(error: unknown) {
  if (error instanceof FirebaseError) {
    return messages[error.code] ?? 'Authentication failed. Please try again.'
  }

  return 'Something went wrong. Please try again.'
}
