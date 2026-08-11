import { FirebaseError } from 'firebase/app'
import { describe, expect, it } from 'vitest'
import { getAuthErrorMessage } from './auth-errors'

describe('getAuthErrorMessage', () => {
  it('returns a useful message for known Firebase errors', () => {
    const error = new FirebaseError('auth/invalid-credential', 'Invalid login')

    expect(getAuthErrorMessage(error)).toBe(
      'The email or password is incorrect.',
    )
  })

  it('does not expose unknown Firebase error details', () => {
    const error = new FirebaseError('auth/internal-error', 'Sensitive details')

    expect(getAuthErrorMessage(error)).toBe(
      'Authentication failed in this browser. Open the site in Chrome and try again.',
    )
  })

  it('explains how to recover from a blocked Google popup', () => {
    const error = new FirebaseError('auth/popup-blocked', 'Popup blocked')

    expect(getAuthErrorMessage(error)).toBe(
      'Allow pop-ups for this site, then try again.',
    )
  })

  it('explains an unauthorized deployment domain', () => {
    const error = new FirebaseError(
      'auth/unauthorized-domain',
      'Unauthorized domain',
    )

    expect(getAuthErrorMessage(error)).toBe(
      'This website is not authorized for Google sign-in. Contact the host.',
    )
  })

  it('identifies a disabled email registration provider', () => {
    const error = new FirebaseError(
      'auth/operation-not-allowed',
      'Operation not allowed',
    )

    expect(getAuthErrorMessage(error)).toBe(
      'Email and password registration is not enabled for this app.',
    )
  })

  it('handles non-Firebase errors safely', () => {
    expect(getAuthErrorMessage(new Error('Unexpected'))).toBe(
      'This browser could not complete sign-in. Open the site in Chrome, allow cookies, and try again.',
    )
  })

  it('recognizes Firebase-shaped errors from a different JavaScript realm', () => {
    expect(
      getAuthErrorMessage({ code: 'auth/web-storage-unsupported' }),
    ).toBe('Enable browser storage or leave private browsing, then try again.')
  })
})
