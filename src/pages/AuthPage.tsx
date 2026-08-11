import { useId, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { getAuthErrorMessage } from '../auth/auth-errors'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'

interface AuthPageProps {
  mode: 'signin' | 'signup'
  onModeChange: (mode: 'signin' | 'signup') => void
}

export function AuthPage({ mode, onModeChange }: AuthPageProps) {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const errorId = useId()
  const isSignUp = mode === 'signup'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (isSignUp && name.trim().length < 2) {
      setError('Enter your name using at least 2 characters.')
      return
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }

    setSubmitting(true)
    try {
      if (isSignUp) {
        await signUp(name.trim(), email.trim(), password)
      } else {
        await signIn(email.trim(), password)
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError))
    } finally {
      setSubmitting(false)
    }
  }

  function switchMode() {
    setError('')
    onModeChange(isSignUp ? 'signin' : 'signup')
  }

  async function handleGoogleSignIn() {
    setError('')
    setGoogleSubmitting(true)
    try {
      await signInWithGoogle()
    } catch (authError) {
      setError(getAuthErrorMessage(authError))
    } finally {
      setGoogleSubmitting(false)
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-labelledby="story-title">
        <Logo />
        <div className="auth-story__content">
          <p className="eyebrow">Multiplayer Bingo</p>
          <h1 id="story-title">Call. Mark. Bingo!</h1>
          <p>
            Create a room, invite your friends, and race to complete your
            winning pattern.
          </p>
        </div>
        <figure className="quote">
          <blockquote>
            “Every number could be the one.”
          </blockquote>
          <figcaption>Get your card ready</figcaption>
        </figure>
        <div className="story-orb story-orb--one" aria-hidden="true" />
        <div className="story-orb story-orb--two" aria-hidden="true" />
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="auth-card__heading">
            <p className="eyebrow">{isSignUp ? 'Get started' : 'Welcome back'}</p>
            <h2 id="auth-title">
              {isSignUp ? 'Create your account' : 'Sign in to Bingo'}
            </h2>
            <p>
              {isSignUp
                ? 'Choose your player name and join the fun.'
                : 'Sign in to host a room or join the next game.'}
            </p>
          </div>

          <button
            className="button button--google button--full"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting || googleSubmitting}
          >
            {googleSubmitting ? (
              <Spinner label="Opening Google sign in" />
            ) : (
              <svg
                className="google-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path fill="#4285f4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z" />
                <path fill="#34a853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
                <path fill="#fbbc05" d="M6.39 13.86A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z" />
                <path fill="#ea4335" d="M12 6.01c1.47 0 2.79.51 3.83 1.5l2.87-2.88A9.62 9.62 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
              </svg>
            )}
            {googleSubmitting ? 'Connecting to Google…' : 'Continue with Google'}
          </button>

          <div className="auth-divider" aria-hidden="true">
            <span>or continue with email</span>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Jordan Lee"
                  disabled={submitting || googleSubmitting}
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                aria-describedby={error ? errorId : undefined}
                disabled={submitting || googleSubmitting}
                required
              />
            </div>

            <div className="field">
              <div className="field__label-row">
                <label htmlFor="password">Password</label>
                {!isSignUp && <span className="field__hint">8+ characters</span>}
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                aria-describedby={error ? errorId : undefined}
                disabled={submitting || googleSubmitting}
                minLength={8}
                required
              />
            </div>

            {error && (
              <div className="form-error" id={errorId} role="alert">
                <span aria-hidden="true">!</span>
                {error}
              </div>
            )}

            <button
              className="button button--primary button--full"
              disabled={submitting || googleSubmitting}
            >
              {submitting && <Spinner label="Signing you in" />}
              {submitting
                ? isSignUp
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </button>
          </form>

          <p className="auth-switch">
            {isSignUp ? 'Already have an account?' : 'New to Bingo?'}{' '}
            <button className="text-button" type="button" onClick={switchMode}>
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
        <p className="legal-copy">
          Play fair, have fun, and be ready to shout Bingo.
        </p>
      </section>
    </main>
  )
}
