import { useId, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'
import { cn } from '../lib/styles'
import {
  buttonFull,
  buttonPrimary,
  eyebrow,
  formError,
  formErrorIcon,
  textButton,
  usernameInput,
  usernameInputShell,
} from '../lib/ui'

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_50%_15%,#e7efe1_0,var(--color-canvas)_38%)] px-6 pb-16 max-[480px]:px-4">
      <header className="mx-auto flex min-h-20 w-[min(1200px,100%)] items-center justify-between max-[480px]:min-h-[68px]">
        <Logo />
        <button className={textButton} type="button" onClick={signOut}>
          Sign out
        </button>
      </header>

      <section
        className="relative mx-auto mt-[clamp(56px,10vh,112px)] w-[min(100%,520px)] rounded-lg border border-border bg-white/95 p-[clamp(28px,5vw,48px)] shadow-elevated max-[480px]:mt-9"
        aria-labelledby="username-title"
      >
        <div
          className="absolute top-6 right-7 rounded-full bg-surface-soft px-[9px] py-[5px] text-[11px] font-bold text-muted max-[480px]:static max-[480px]:mb-6 max-[480px]:inline-block"
          aria-hidden="true"
        >
          1 of 1
        </div>
        <p className={eyebrow}>Set up your player profile</p>
        <h1
          className="m-0 max-w-[410px] font-display text-[clamp(32px,6vw,44px)] leading-[1.08] tracking-normal"
          id="username-title"
        >
          What should we call you?
        </h1>
        <p className="mt-4 mb-8 leading-[1.6] text-muted">
          Choose a unique username. This is what other players will see while
          bingo is ongoing.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold" htmlFor="username">
              Username
            </label>
            <div className={usernameInputShell}>
              <span className="pl-[15px] font-semibold text-muted" aria-hidden="true">
                @
              </span>
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
                className={usernameInput}
                disabled={submitting}
                autoFocus
                required
              />
            </div>
            <div className="mt-2 flex justify-between gap-4 text-xs text-muted">
              <span id="username-help">Letters, numbers, and underscores only</span>
              <span>{username.length}/20</span>
            </div>
          </div>

          {error && (
            <div className={formError} id={errorId} role="alert">
              <span className={formErrorIcon} aria-hidden="true">!</span>
              {error}
            </div>
          )}

          <button
            className={cn(buttonPrimary, buttonFull)}
            disabled={submitting}
          >
            {submitting && <Spinner label="Saving username" />}
            {submitting ? 'Saving username…' : 'Continue to Bingo'}
          </button>
        </form>

        <p className="mt-6 mb-0 [overflow-wrap:anywhere] text-center text-xs text-[#89948d]">
          Signed in as {user?.email}
        </p>
      </section>
    </main>
  )
}
