import { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/email-already-in-use': 'An account already exists for this email.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/operation-not-allowed':
    'Email and password registration is not enabled for this app.',
  'auth/operation-not-supported-in-this-environment':
    'Google sign-in is not supported in this browser. Try Safari or Chrome.',
  'auth/popup-blocked': 'Allow pop-ups for this site, then try again.',
  'auth/popup-closed-by-user': 'Google sign-in was canceled. Please try again.',
  'auth/cancelled-popup-request': 'Another sign-in window is already open.',
  'auth/account-exists-with-different-credential':
    'An account already exists for this email. Sign in with its original method.',
  'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/unauthorized-domain':
    'This website is not authorized for Google sign-in. Contact the host.',
  'auth/web-storage-unsupported':
    'Enable browser storage or leave private browsing, then try again.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
}

export function getAuthErrorMessage(error: unknown) {
  const code = getFirebaseErrorCode(error)

  if (code) {
    return (
      messages[code] ??
      'Authentication failed in this browser. Open the site in Chrome and try again.'
    )
  }

  if (error instanceof Error) {
    return 'This browser could not complete sign-in. Open the site in Chrome, allow cookies, and try again.'
  }

  return 'Sign-in could not start. Open the site in Chrome and try again.'
}

function getFirebaseErrorCode(error: unknown) {
  if (error instanceof FirebaseError) {
    return error.code
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    error.code.startsWith('auth/')
  ) {
    return error.code
  }

  return null
}
