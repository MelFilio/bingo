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
      'Authentication failed. Please try again.',
    )
  })

  it('explains how to recover from a blocked Google popup', () => {
    const error = new FirebaseError('auth/popup-blocked', 'Popup blocked')

    expect(getAuthErrorMessage(error)).toBe(
      'Allow pop-ups for this site, then try again.',
    )
  })

  it('handles non-Firebase errors safely', () => {
    expect(getAuthErrorMessage(new Error('Unexpected'))).toBe(
      'Something went wrong. Please try again.',
    )
  })
})
