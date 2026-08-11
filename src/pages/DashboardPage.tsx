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
    <div className="dashboard-shell">
      <header className="topbar">
        <Logo />
        <div className="profile-menu">
          <div className="avatar" aria-hidden="true">{initial}</div>
          <div className="profile-menu__copy">
            <strong>@{username}</strong>
            <span>{user?.email}</span>
          </div>
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut && <Spinner label="Signing out" />}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome" aria-labelledby="welcome-title">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 id="welcome-title">Good to see you, {username}.</h1>
            <p>Your secure Firebase workspace is ready for what comes next.</p>
          </div>
          <span className="status-pill">
            <span aria-hidden="true" /> Connected
          </span>
        </section>

        <section className="dashboard-grid" aria-label="Account overview">
          <article className="room-action-card room-action-card--create">
            <div>
              <p className="card-label">Host a game</p>
              <h2>Create a bingo room</h2>
              <p>Get a shareable code and invite players into your lobby.</p>
            </div>
            <button
              className="button button--primary"
              type="button"
              onClick={handleCreateRoom}
              disabled={roomAction !== null}
            >
              {roomAction === 'create' && <Spinner label="Creating room" />}
              {roomAction === 'create' ? 'Creating…' : 'Create room'}
            </button>
          </article>

          <article className="room-action-card">
            <div>
              <p className="card-label">Have a code?</p>
              <h2>Join a room</h2>
              <p>Enter the code shared by your bingo host.</p>
            </div>
            <form className="join-form" onSubmit={handleJoinRoom}>
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
                disabled={roomAction !== null}
              />
              <button
                className="button button--secondary"
                disabled={roomAction !== null}
              >
                {roomAction === 'join' && <Spinner label="Joining room" />}
                {roomAction === 'join' ? 'Joining…' : 'Join room'}
              </button>
            </form>
          </article>

          {roomError && (
            <div className="room-error" role="alert">
              <span aria-hidden="true">!</span> {roomError}
            </div>
          )}

          <article className="overview-card overview-card--feature">
            <div className="card-icon" aria-hidden="true">✓</div>
            <div>
              <p className="card-label">Account status</p>
              <h2>You’re all set</h2>
              <p>
                Authentication is active and your profile is stored privately
                in Cloud Firestore.
              </p>
            </div>
          </article>

          <article className="overview-card">
            <p className="card-label">Player username</p>
            {editingUsername ? (
              <form className="username-edit" onSubmit={handleUsernameSubmit}>
                <label htmlFor="username-edit">New username</label>
                <div className="username-edit__row">
                  <div className="username-input">
                    <span aria-hidden="true">@</span>
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
                      disabled={savingUsername}
                      autoFocus
                      required
                    />
                  </div>
                  <button
                    className="button button--primary button--small"
                    disabled={savingUsername}
                  >
                    {savingUsername && <Spinner label="Saving username" />}
                    {savingUsername ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    className="button button--secondary button--small"
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
                  <p className="inline-error" id="username-edit-error" role="alert">
                    {usernameError}
                  </p>
                ) : (
                  <p className="username-edit__help" id="username-edit-help">
                    3–20 letters, numbers, or underscores
                  </p>
                )}
              </form>
            ) : (
              <>
                <div className="username-summary">
                  <h2>@{username}</h2>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setEditingUsername(true)}
                  >
                    Edit username
                  </button>
                </div>
                <p>This is how you’ll appear while bingo is ongoing.</p>
              </>
            )}
          </article>

          <article className="overview-card">
            <p className="card-label">Security</p>
            <h2>Private by default</h2>
            <p>Firestore rules limit your profile data to your account.</p>
          </article>
        </section>
      </main>
    </div>
  )
}
