import { useId, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'

const usernamePattern = /^[A-Za-z0-9_]{3,20}$/

export function UsernamePage() {
  const { user, saveUsername, signOut } = useAuth()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const errorId = useId()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedUsername = username.trim()
    setError('')

    if (!usernamePattern.test(trimmedUsername)) {
      setError('Use 3–20 letters, numbers, or underscores.')
      return
    }

    setSubmitting(true)
    try {
      await saveUsername(trimmedUsername)
    } catch (usernameError) {
      setError(
        usernameError instanceof Error && usernameError.message === 'USERNAME_TAKEN'
          ? 'That username is already taken. Try another one.'
          : 'We could not save your username. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="onboarding-layout">
      <header className="onboarding-header">
        <Logo />
        <button className="text-button" type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section className="username-card" aria-labelledby="username-title">
        <div className="username-card__step" aria-hidden="true">1 of 1</div>
        <p className="eyebrow">Set up your player profile</p>
        <h1 id="username-title">What should we call you?</h1>
        <p className="username-card__intro">
          Choose a unique username. This is what other players will see while
          bingo is ongoing.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field username-field">
            <label htmlFor="username">Username</label>
            <div className="username-input">
              <span aria-hidden="true">@</span>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value.replace(/\s/g, ''))
                  setError('')
                }}
                placeholder="bingochamp"
                aria-describedby={`username-help${error ? ` ${errorId}` : ''}`}
                aria-invalid={Boolean(error)}
                minLength={3}
                maxLength={20}
                pattern="[A-Za-z0-9_]+"
                disabled={submitting}
                autoFocus
                required
              />
            </div>
            <div className="field-meta">
              <span id="username-help">Letters, numbers, and underscores only</span>
              <span>{username.length}/20</span>
            </div>
          </div>

          {error && (
            <div className="form-error" id={errorId} role="alert">
              <span aria-hidden="true">!</span>
              {error}
            </div>
          )}

          <button
            className="button button--primary button--full"
            disabled={submitting}
          >
            {submitting && <Spinner label="Saving username" />}
            {submitting ? 'Saving username…' : 'Continue to Bingo'}
          </button>
        </form>

        <p className="username-card__account">Signed in as {user?.email}</p>
      </section>
    </main>
  )
}
