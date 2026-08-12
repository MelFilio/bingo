import { useState, type FormEvent } from 'react'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '../auth/useAuth'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'
import {
  createRoom,
  joinRoom,
  RoomError,
} from '../features/rooms/rooms'
import {
  isValidRoomCode,
  normalizeRoomCode,
} from '../features/rooms/room-code'
import { cn } from '../lib/styles'
import {
  avatar,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  cardLabel,
  eyebrow,
  pageTopbar,
  panel,
  textButton,
  usernameInput,
  usernameInputShell,
} from '../lib/ui'

const usernamePattern = /^[A-Za-z0-9_]{3,20}$/

export function DashboardPage({ onOpenRoom }: { onOpenRoom: (code: string) => void }) {
  const { user, profile, saveUsername, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameDraft, setUsernameDraft] = useState(profile?.username ?? '')
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [roomError, setRoomError] = useState('')
  const [roomAction, setRoomAction] = useState<'create' | 'join' | null>(null)
  const username = profile?.username ?? 'Player'
  const initial = username.charAt(0).toUpperCase()

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  async function handleUsernameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextUsername = usernameDraft.trim()
    setUsernameError('')

    if (!usernamePattern.test(nextUsername)) {
      setUsernameError('Use 3–20 letters, numbers, or underscores.')
      return
    }

    setSavingUsername(true)
    try {
      await saveUsername(nextUsername)
      setEditingUsername(false)
    } catch (error) {
      setUsernameError(
        error instanceof Error && error.message === 'USERNAME_TAKEN'
          ? 'That username is already taken. Try another one.'
          : 'We could not update your username. Please try again.',
      )
    } finally {
      setSavingUsername(false)
    }
  }

  async function handleCreateRoom() {
    if (!user || !profile?.username) return
    setRoomError('')
    setRoomAction('create')
    try {
      const code = await createRoom({ uid: user.uid, username: profile.username })
      onOpenRoom(code)
    } catch (error) {
      if (
        error instanceof FirebaseError &&
        error.code === 'permission-denied'
      ) {
        setRoomError(
          'Firestore denied room creation. Deploy the latest security rules and try again.',
        )
      } else if (
        error instanceof FirebaseError &&
        error.code === 'unavailable'
      ) {
        setRoomError('Firestore is unavailable. Check your connection and try again.')
      } else if (error instanceof FirebaseError) {
        setRoomError(`Room creation failed (${error.code}). Please try again.`)
      } else {
        setRoomError('We could not create a room. Please try again.')
      }
    } finally {
      setRoomAction(null)
    }
  }

  async function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !profile?.username) return
    const code = normalizeRoomCode(roomCode)
    setRoomError('')

    if (!isValidRoomCode(code)) {
      setRoomError('Enter the 6-character room code.')
      return
    }

    setRoomAction('join')
    try {
      await joinRoom(code, { uid: user.uid, username: profile.username })
      onOpenRoom(code)
    } catch (error) {
      if (error instanceof RoomError && error.code === 'not-found') {
        setRoomError('We could not find that room. Check the code and try again.')
      } else if (
        error instanceof FirebaseError &&
        error.code === 'permission-denied'
      ) {
        setRoomError(
          'Firestore denied access. Deploy the latest security rules and try again.',
        )
      } else {
        setRoomError('We could not join the room. Please try again.')
      }
    } finally {
      setRoomAction(null)
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className={pageTopbar}>
        <Logo />
        <div className="flex items-center gap-3 max-[480px]:gap-2">
          <div className={avatar} aria-hidden="true">{initial}</div>
          <div className="grid gap-0.5 text-[13px] max-[800px]:hidden">
            <strong>@{username}</strong>
            <span className="text-xs text-muted">{user?.email}</span>
          </div>
          <button
            className={cn(buttonSecondary, buttonSmall)}
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut && <Spinner label="Signing out" />}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-[min(1200px,calc(100%-48px))] py-[72px] max-[800px]:w-[min(100%-32px,1200px)] max-[800px]:py-12">
        <section
          className="mb-12 flex items-end justify-between gap-8 max-[800px]:flex-col max-[800px]:items-start max-[480px]:mb-8"
          aria-labelledby="welcome-title"
        >
          <div>
            <p className={eyebrow}>Bingo lobby</p>
            <h1
              className="m-0 font-display text-[clamp(36px,5vw,58px)] leading-[1.04] tracking-normal"
              id="welcome-title"
            >
              Ready to play, {username}?
            </h1>
            <p className="mt-3.5 mb-0 text-[17px] text-muted">
              Host a new game or enter a room code to join your friends.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-[#c6dccb] bg-[#eef8ef] px-3 py-2 text-[13px] font-semibold text-[#2d6343]">
            <span
              className="size-[7px] rounded-full bg-[#3b8b59] shadow-[0_0_0_4px_rgba(59,139,89,.12)]"
              aria-hidden="true"
            />
            Connected
          </span>
        </section>

        <section
          className="grid grid-cols-2 gap-5 max-[800px]:grid-cols-1"
          aria-label="Game options"
        >
          <article className="flex min-h-[220px] flex-col justify-between gap-7 rounded-md border border-[#214f3d] bg-primary p-7 text-[#f7fbf6] max-[480px]:min-h-0 max-[480px]:p-[22px]">
            <div>
              <p className={cn(cardLabel, 'text-[#c6d8cd]')}>Host a game</p>
              <h2 className="m-0 font-display text-[25px] tracking-normal">
                Create a bingo room
              </h2>
              <p className="mt-2.5 mb-0 leading-normal text-[#c6d8cd]">
                Get a shareable code and invite players into your lobby.
              </p>
            </div>
            <button
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-[9px] self-start rounded-sm border border-transparent bg-[#e1edda] px-[18px] font-semibold text-primary transition-[background,border-color,transform] duration-150 hover:not-disabled:bg-white active:not-disabled:translate-y-px',
              )}
              type="button"
              onClick={handleCreateRoom}
              disabled={roomAction !== null}
            >
              {roomAction === 'create' && <Spinner label="Creating room" />}
              {roomAction === 'create' ? 'Creating…' : 'Create room'}
            </button>
          </article>

          <article className="flex min-h-[220px] flex-col justify-between gap-7 rounded-md border border-border bg-surface p-7 max-[480px]:min-h-0 max-[480px]:p-[22px]">
            <div>
              <p className={cardLabel}>Have a code?</p>
              <h2 className="m-0 font-display text-[25px] tracking-normal">
                Join a room
              </h2>
              <p className="mt-2.5 mb-0 leading-normal text-muted">
                Enter the code shared by your bingo host.
              </p>
            </div>
            <form
              className="flex gap-2 max-[480px]:flex-col max-[480px]:items-stretch"
              onSubmit={handleJoinRoom}
            >
              <label className="sr-only" htmlFor="room-code">Room code</label>
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => {
                  setRoomCode(normalizeRoomCode(event.target.value))
                  setRoomError('')
                }}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-sm border border-border bg-surface px-3.5 font-display text-lg font-bold uppercase tracking-[0.14em] text-text focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/15"
                disabled={roomAction !== null}
              />
              <button
                className={buttonSecondary}
                disabled={roomAction !== null}
              >
                {roomAction === 'join' && <Spinner label="Joining room" />}
                {roomAction === 'join' ? 'Joining…' : 'Join room'}
              </button>
            </form>
          </article>

          {roomError && (
            <div
              className="col-span-full rounded-sm border border-[#efc5c1] bg-[#fff5f4] px-4 py-3.5 text-sm text-danger"
              role="alert"
            >
              <span aria-hidden="true">!</span> {roomError}
            </div>
          )}

          <article className="col-span-full flex min-h-[190px] items-start gap-[22px] rounded-md border border-[#d1dfc7] bg-[#e8f0e1] p-7 shadow-card max-[800px]:col-auto max-[480px]:block max-[480px]:min-h-0 max-[480px]:p-[22px]">
            <div
              className="grid size-11 flex-none place-items-center rounded-xl bg-primary font-bold text-white max-[480px]:mb-5"
              aria-hidden="true"
            >
              ✓
            </div>
            <div>
              <p className={cardLabel}>Player status</p>
              <h2 className="m-0 [overflow-wrap:anywhere] font-display text-[22px] tracking-normal">
                Ready for the next game
              </h2>
              <p className="mt-3 mb-0 max-w-[580px] leading-[1.55] text-muted">
                Your player profile is saved, so your username will follow you
                into every room.
              </p>
            </div>
          </article>

          <article className={cn(panel, 'min-h-[190px] rounded-md p-7 shadow-card max-[480px]:min-h-0 max-[480px]:p-[22px]')}>
            <p className={cardLabel}>Player username</p>
            {editingUsername ? (
              <form onSubmit={handleUsernameSubmit}>
                <label
                  className="mb-2 block text-[13px] font-semibold"
                  htmlFor="username-edit"
                >
                  New username
                </label>
                <div className="flex items-center gap-2 max-[480px]:flex-wrap max-[480px]:items-stretch">
                  <div className={cn(usernameInputShell, 'h-11 min-w-0 flex-1 max-[480px]:basis-full')}>
                    <span className="pl-[15px] font-semibold text-muted" aria-hidden="true">
                      @
                    </span>
                    <input
                      id="username-edit"
                      value={usernameDraft}
                      onChange={(event) => {
                        setUsernameDraft(event.target.value.replace(/\s/g, ''))
                        setUsernameError('')
                      }}
                      aria-describedby={
                        usernameError ? 'username-edit-error' : 'username-edit-help'
                      }
                      aria-invalid={Boolean(usernameError)}
                      minLength={3}
                      maxLength={20}
                      pattern="[A-Za-z0-9_]+"
                      className={usernameInput}
                      disabled={savingUsername}
                      autoFocus
                      required
                    />
                  </div>
                  <button
                    className={cn(buttonPrimary, buttonSmall)}
                    disabled={savingUsername}
                  >
                    {savingUsername && <Spinner label="Saving username" />}
                    {savingUsername ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className={cn(buttonSecondary, buttonSmall)}
                    type="button"
                    onClick={() => {
                      setUsernameDraft(username)
                      setUsernameError('')
                      setEditingUsername(false)
                    }}
                    disabled={savingUsername}
                  >
                    Cancel
                  </button>
                </div>
                {usernameError ? (
                  <p
                    className="mt-2 mb-0 text-xs text-danger"
                    id="username-edit-error"
                    role="alert"
                  >
                    {usernameError}
                  </p>
                ) : (
                  <p className="mt-2 mb-0 text-xs text-muted" id="username-edit-help">
                    3–20 letters, numbers, or underscores
                  </p>
                )}
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="m-0 [overflow-wrap:anywhere] font-display text-[22px] tracking-normal">
                    @{username}
                  </h2>
                  <button
                    className={textButton}
                    type="button"
                    onClick={() => setEditingUsername(true)}
                  >
                    Edit username
                  </button>
                </div>
                <p className="mt-3 mb-0 max-w-[580px] leading-[1.55] text-muted">
                  This is how you’ll appear while bingo is ongoing.
                </p>
              </>
            )}
          </article>

          <article className={cn(panel, 'min-h-[190px] rounded-md p-7 shadow-card max-[480px]:min-h-0 max-[480px]:p-[22px]')}>
            <p className={cardLabel}>Fair play</p>
            <h2 className="m-0 [overflow-wrap:anywhere] font-display text-[22px] tracking-normal">
              Your card, your game
            </h2>
            <p className="mt-3 mb-0 max-w-[580px] leading-[1.55] text-muted">
              Your account keeps your player identity and game access protected.
            </p>
          </article>
        </section>
      </main>
    </div>
  )
}
