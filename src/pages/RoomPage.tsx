import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'
import {
  defaultGameSettings,
  getBallLabel,
  hasBingo,
  isCellMarked,
  type CallMode,
  type GameSettings,
  type WinPattern,
} from '../features/game/bingo'
import {
  callNextNumber,
  claimBingo,
  leaveRoom,
  rerollCards,
  restartGame,
  setCallingPaused,
  startGame,
  subscribeToPlayers,
  subscribeToRoundHistory,
  subscribeToRoom,
  updateGameSettings,
  updateCallControls,
  type Room,
  type RoomPlayer,
  type RoundHistory,
} from '../features/rooms/rooms'

type MarkMode = 'automatic' | 'manual'

interface RoomPageProps {
  code: string
  onLeave: () => void
}

const patternLabels: Record<WinPattern, string> = {
  line: 'Any line',
  'four-corners': 'Four corners',
  'full-card': 'Full card',
  custom: 'Custom',
}

export function RoomPage({ code, onLeave }: RoomPageProps) {
  const { user, profile } = useAuth()
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<RoomPlayer[]>([])
  const [roundHistory, setRoundHistory] = useState<RoundHistory[]>([])
  const [settings, setSettings] = useState<GameSettings>(defaultGameSettings)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [confirmingRestart, setConfirmingRestart] = useState(false)
  const [starting, setStarting] = useState(false)
  const [calling, setCalling] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [rerolling, setRerolling] = useState(false)
  const [returningToLobby, setReturningToLobby] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [updatingCallControls, setUpdatingCallControls] = useState(false)
  const [markMode, setMarkMode] = useState<MarkMode>('automatic')
  const [manualMarks, setManualMarks] = useState<number[]>([])
  const [markingReady, setMarkingReady] = useState(false)

  const isHost = room?.hostUid === user?.uid
  const currentPlayer = players.find((player) => player.uid === user?.uid)
  const isRoomMember = Boolean(currentPlayer)
  const markingStorageKey = user && room
    ? `bingo:marks:${code}:${user.uid}:${room.roundNumber}`
    : null
  const effectiveMarkedNumbers =
    markMode === 'manual' && room
      ? manualMarks.filter((number) =>
          room.calledNumbers.includes(number),
        )
      : room?.calledNumbers ?? []
  const canClaim = Boolean(
    room &&
      currentPlayer &&
      currentPlayer.cards.length > 0 &&
      currentPlayer.status === 'active' &&
      room.status === 'playing' &&
      currentPlayer.cards.some((card) =>
        hasBingo(
          card.cells,
          effectiveMarkedNumbers,
          room.settings.winPattern,
          room.settings.customPattern,
        ),
      ),
  )

  useEffect(() => {
    const handleRoomError = () => {
      setError('We could not load this room. Check your connection and refresh.')
      setLoading(false)
    }
    const handlePlayersError = (connectionError: { code: string }) => {
      setError(
        connectionError.code === 'permission-denied'
          ? 'Firestore denied access to the player list. Deploy the latest security rules.'
          : 'We could not load the player list. Try refreshing the page.',
      )
      setLoading(false)
    }
    const unsubscribeRoom = subscribeToRoom(
      code,
      (nextRoom) => {
        setRoom(nextRoom)
        if (nextRoom?.status === 'waiting') setSettings(nextRoom.settings)
        setLoading(false)
      },
      handleRoomError,
    )
    const unsubscribePlayers = subscribeToPlayers(
      code,
      setPlayers,
      handlePlayersError,
    )

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
    }
  }, [code])

  useEffect(() => {
    if (!isRoomMember) return

    return subscribeToRoundHistory(code, setRoundHistory, (historyError) => {
      if (historyError.code === 'permission-denied') {
        setError(
          'Game history is unavailable until the latest Firestore rules are deployed.',
        )
      }
    })
  }, [code, isRoomMember])

  useEffect(() => {
    if (!markingStorageKey) return
    setMarkingReady(false)
    try {
      const stored = window.localStorage.getItem(markingStorageKey)
      const parsed = stored
        ? (JSON.parse(stored) as { mode?: MarkMode; marks?: number[] })
        : null
      setMarkMode(parsed?.mode === 'manual' ? 'manual' : 'automatic')
      setManualMarks(
        Array.isArray(parsed?.marks)
          ? parsed.marks.filter((number) => Number.isInteger(number))
          : [],
      )
    } catch {
      setMarkMode('automatic')
      setManualMarks([])
    }
    setMarkingReady(true)
  }, [markingStorageKey])

  useEffect(() => {
    if (!markingStorageKey || !markingReady) return
    window.localStorage.setItem(
      markingStorageKey,
      JSON.stringify({ mode: markMode, marks: manualMarks }),
    )
  }, [manualMarks, markMode, markingReady, markingStorageKey])

  useEffect(() => {
    if (room?.status === 'waiting') setManualMarks([])
  }, [room?.status])

  useEffect(() => {
    if (
      !room ||
      !user ||
      !isHost ||
      room.status !== 'playing' ||
      room.callingPaused ||
      room.settings.callMode !== 'automatic' ||
      room.calledNumbers.length >= 75
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      setCalling(true)
      void callNextNumber(code, user.uid)
        .catch(() => setError('Automatic calling paused. Call the next number manually.'))
        .finally(() => setCalling(false))
    }, room.settings.callInterval * 1000)

    return () => window.clearTimeout(timer)
  }, [code, isHost, room, user])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Could not copy the code. Select it and copy it manually.')
    }
  }

  async function handleStart() {
    if (!user) return
    setStarting(true)
    setError('')
    try {
      await startGame(code, user.uid, settings)
    } catch {
      setError('We could not start the game. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  async function handleSettingsChange(nextSettings: GameSettings) {
    if (!user) return
    setSettings(nextSettings)
    setSavingSettings(true)
    setError('')
    try {
      await updateGameSettings(code, user.uid, nextSettings)
    } catch {
      setError('We could not save the game settings. Please try again.')
    } finally {
      setSavingSettings(false)
    }
  }

  async function handleReroll() {
    if (!user) return
    setRerolling(true)
    setError('')
    try {
      await rerollCards(code, user.uid)
      setManualMarks([])
    } catch {
      setError('We could not reroll your cards. Please try again.')
    } finally {
      setRerolling(false)
    }
  }

  async function handleReturnToLobby() {
    if (!user) return
    setReturningToLobby(true)
    setError('')
    try {
      await restartGame(
        code,
        user.uid,
        players
          .filter((player) => player.status === 'waiting')
          .map((player) => player.uid),
      )
      setConfirmingRestart(false)
    } catch {
      setError('We could not return to the lobby. Please try again.')
    } finally {
      setReturningToLobby(false)
    }
  }

  async function handleCall() {
    if (!user || calling) return
    setCalling(true)
    setError('')
    try {
      await callNextNumber(code, user.uid)
    } catch {
      setError('We could not call the next number. Please try again.')
    } finally {
      setCalling(false)
    }
  }

  async function handleCallModeChange(callMode: CallMode) {
    if (!user || !room || updatingCallControls) return
    setUpdatingCallControls(true)
    setError('')
    try {
      await updateCallControls(code, user.uid, {
        callMode,
        callInterval: room.settings.callInterval,
      })
    } catch {
      setError('We could not change the calling mode. Please try again.')
    } finally {
      setUpdatingCallControls(false)
    }
  }

  async function handlePauseToggle() {
    if (!user || !room || updatingCallControls) return
    setUpdatingCallControls(true)
    setError('')
    try {
      await setCallingPaused(code, user.uid, !room.callingPaused)
    } catch {
      setError('We could not update number calling. Please try again.')
    } finally {
      setUpdatingCallControls(false)
    }
  }

  async function handleClaim() {
    if (!user || !profile?.username || !canClaim) return
    setClaiming(true)
    setError('')
    try {
      await claimBingo(
        code,
        { uid: user.uid, username: profile.username },
        players.map((player) => player.uid),
      )
    } catch {
      setError('Your card does not have Bingo yet. Check the called numbers.')
    } finally {
      setClaiming(false)
    }
  }

  function handleMarkModeChange(nextMode: MarkMode) {
    setMarkMode(nextMode)
  }

  function handleCellToggle(number: number) {
    setManualMarks((currentMarks) =>
      currentMarks.includes(number)
        ? currentMarks.filter((marked) => marked !== number)
        : [...currentMarks, number],
    )
  }

  async function handleLeave() {
    if (!user) return
    if (isHost) {
      setConfirmingClose(true)
      return
    }
    await performLeave(false)
  }

  async function performLeave(hostIsLeaving: boolean) {
    if (!user) return
    setLeaving(true)
    try {
      await leaveRoom(
        code,
        user.uid,
        hostIsLeaving,
        players.map((player) => player.uid),
        roundHistory.map((round) => round.roundNumber),
      )
      setConfirmingClose(false)
      onLeave()
    } catch {
      setError('We could not leave the room. Please try again.')
      setLeaving(false)
    }
  }

  if (loading) {
    return <main className="app-loader"><Spinner label="Opening room" /></main>
  }

  if (!room) {
    return (
      <main className="room-missing">
        <Logo />
        <h1>Room not found</h1>
        <p>This room may have closed, or the code may be incorrect.</p>
        <button className="button button--primary" onClick={onLeave}>Back home</button>
      </main>
    )
  }

  return (
    <div className="room-shell">
      <header className="topbar">
        <Logo />
        <div className="room-topbar__actions">
          <span className={`game-status game-status--${room.status}`}>
            {room.status}
          </span>
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={handleLeave}
            disabled={leaving}
          >
            {leaving && <Spinner label="Leaving room" />}
            {leaving ? 'Leaving…' : isHost ? 'Close room' : 'Leave room'}
          </button>
        </div>
      </header>

      <main className="room-page">
        {error && <div className="room-error" role="alert">{error}</div>}

        {room.status === 'waiting' ? (
          <WaitingRoom
            room={room}
            players={players}
            settings={settings}
            isHost={isHost}
            copied={copied}
            starting={starting}
            savingSettings={savingSettings}
            rerolling={rerolling}
            currentPlayer={currentPlayer}
            onCopy={copyCode}
            onSettingsChange={(nextSettings) => void handleSettingsChange(nextSettings)}
            onReroll={() => void handleReroll()}
            onStart={handleStart}
          />
        ) : (
          <GameBoard
            room={room}
            players={players}
            player={currentPlayer}
            isHost={isHost}
            calling={calling}
            claiming={claiming}
            canClaim={canClaim}
            onCall={handleCall}
            onClaim={handleClaim}
            returningToLobby={returningToLobby}
            onRequestRestart={() => setConfirmingRestart(true)}
            updatingCallControls={updatingCallControls}
            onCallModeChange={(mode) => void handleCallModeChange(mode)}
            onPauseToggle={() => void handlePauseToggle()}
            markMode={markMode}
            manualMarks={manualMarks}
            onMarkModeChange={(mode) => void handleMarkModeChange(mode)}
            onCellToggle={(number) => void handleCellToggle(number)}
          />
        )}

        <RoundHistoryList history={roundHistory} />
      </main>

      <ConfirmDialog
        open={confirmingClose}
        title="Close this room?"
        description="All players will be removed and this room code will stop working. This action cannot be undone."
        confirmLabel="Close room"
        loading={leaving}
        onCancel={() => setConfirmingClose(false)}
        onConfirm={() => void performLeave(true)}
      />
      <ConfirmDialog
        open={confirmingRestart}
        title="Restart this game?"
        description={
          room.status === 'playing'
            ? 'The current calls will be cleared and everyone will return to the lobby. This unfinished round will not be added to history.'
            : 'Everyone will return to the lobby for the next game. Players can reroll their cards before the host starts again.'
        }
        confirmLabel="Restart game"
        loading={returningToLobby}
        onCancel={() => setConfirmingRestart(false)}
        onConfirm={() => void handleReturnToLobby()}
      />
    </div>
  )
}

interface WaitingRoomProps {
  room: Room
  players: RoomPlayer[]
  settings: GameSettings
  isHost: boolean
  copied: boolean
  starting: boolean
  savingSettings: boolean
  rerolling: boolean
  currentPlayer?: RoomPlayer
  onCopy: () => void
  onSettingsChange: (settings: GameSettings) => void
  onReroll: () => void
  onStart: () => void
}

function WaitingRoom({
  room,
  players,
  settings,
  isHost,
  copied,
  starting,
  savingSettings,
  rerolling,
  currentPlayer,
  onCopy,
  onSettingsChange,
  onReroll,
  onStart,
}: WaitingRoomProps) {
  const cardsReady = players.every(
    (player) => player.cards.length === settings.cardCount,
  )

  return (
    <>
      <section className="room-hero" aria-labelledby="room-title">
        <div>
          <p className="eyebrow">Bingo lobby</p>
          <h1 id="room-title">Waiting for players</h1>
          <p>Share the room code. New players will appear here automatically.</p>
        </div>
        <RoomCode code={room.code} copied={copied} onCopy={onCopy} />
      </section>

      <div className="lobby-layout">
        <div className="lobby-main">
          <PlayersList players={players} hostUid={room.hostUid} />
          {currentPlayer && (
            <section className="lobby-cards" aria-labelledby="lobby-cards-title">
              <div className="game-panel-heading">
                <div>
                  <p className="eyebrow">Your game</p>
                  <h2 id="lobby-cards-title">
                    {currentPlayer.cards.length === 1 ? 'Your card' : 'Your cards'}
                  </h2>
                </div>
                <button
                  className="button button--secondary button--small"
                  type="button"
                  onClick={onReroll}
                  disabled={rerolling}
                >
                  {rerolling && <Spinner label="Rerolling cards" />}
                  {rerolling ? 'Rerolling…' : 'Reroll cards'}
                </button>
              </div>
              {currentPlayer.cards.length === settings.cardCount ? (
                <div className="lobby-card-grid">
                  {currentPlayer.cards.map((card, index) => (
                    <div key={`${index}-${card.cells.join('-')}`}>
                      <span className="mini-card-label">Card {index + 1}</span>
                      <BingoCard card={card.cells} calledNumbers={[]} compact />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="cards-outdated" role="status">
                  The host changed this round to {settings.cardCount}{' '}
                  {settings.cardCount === 1 ? 'card' : 'cards'}. Reroll to continue.
                </div>
              )}
            </section>
          )}
        </div>

        <section className="settings-card" aria-labelledby="settings-title">
          <div className="settings-card__header">
            <p className="eyebrow">Host controls</p>
            <h2 id="settings-title">Game settings</h2>
          </div>

          {isHost ? (
            <>
              <fieldset>
                <legend>Winning pattern</legend>
                <div className="segmented-control">
                  {(Object.keys(patternLabels) as WinPattern[]).map((pattern) => (
                    <label key={pattern}>
                      <input
                        type="radio"
                        name="win-pattern"
                        value={pattern}
                        checked={settings.winPattern === pattern}
                        onChange={() => onSettingsChange({ ...settings, winPattern: pattern })}
                        disabled={savingSettings}
                      />
                      <span>{patternLabels[pattern]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {settings.winPattern === 'custom' && (
                <fieldset>
                  <legend>Select required squares</legend>
                  <div className="pattern-editor" aria-label="Custom winning pattern">
                    {settings.customPattern.map((selected, index) => (
                      <label key={index}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            const customPattern = [...settings.customPattern]
                            customPattern[index] = !selected
                            onSettingsChange({ ...settings, customPattern })
                          }}
                          disabled={savingSettings || index === 12}
                          aria-label={`Pattern square ${index + 1}`}
                        />
                        <span>{index === 12 ? 'FREE' : selected ? '✓' : ''}</span>
                      </label>
                    ))}
                  </div>
                  <p className="settings-help">Selected squares must all be called.</p>
                </fieldset>
              )}

              <fieldset>
                <legend>Cards per player</legend>
                <div className="segmented-control">
                  {([1, 2, 3] as const).map((cardCount) => (
                    <label key={cardCount}>
                      <input
                        type="radio"
                        name="card-count"
                        value={cardCount}
                        checked={settings.cardCount === cardCount}
                        onChange={() => onSettingsChange({ ...settings, cardCount })}
                        disabled={savingSettings}
                      />
                      <span>{cardCount} {cardCount === 1 ? 'card' : 'cards'}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>Number calling</legend>
                <div className="segmented-control segmented-control--two">
                  {(['manual', 'automatic'] as CallMode[]).map((mode) => (
                    <label key={mode}>
                      <input
                        type="radio"
                        name="call-mode"
                        value={mode}
                        checked={settings.callMode === mode}
                        onChange={() => onSettingsChange({ ...settings, callMode: mode })}
                        disabled={savingSettings}
                      />
                      <span>{mode === 'manual' ? 'Manual' : 'Automatic'}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {settings.callMode === 'automatic' && (
                <div className="field settings-select">
                  <label htmlFor="call-interval">Call a number every</label>
                  <select
                    id="call-interval"
                    value={settings.callInterval}
                    onChange={(event) =>
                      onSettingsChange({
                        ...settings,
                        callInterval: Number(event.target.value) as 5 | 10 | 15,
                      })
                    }
                    disabled={savingSettings}
                  >
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                  </select>
                </div>
              )}

              <button
                className="button button--primary button--full"
                type="button"
                onClick={onStart}
                disabled={
                  starting ||
                  savingSettings ||
                  players.length === 0 ||
                  !cardsReady ||
                  (settings.winPattern === 'custom' &&
                    !settings.customPattern.some((selected, index) =>
                      index !== 12 && selected,
                    ))
                }
              >
                {starting && <Spinner label="Starting game" />}
                {starting ? 'Starting game…' : 'Start game'}
              </button>
              {!cardsReady && (
                <p className="settings-warning">
                  Waiting for every player to reroll {settings.cardCount}{' '}
                  {settings.cardCount === 1 ? 'card' : 'cards'}.
                </p>
              )}
            </>
          ) : (
            <div className="host-waiting">
              <Spinner label="Waiting for host" />
              <p>The host is choosing the game settings and will start soon.</p>
            </div>
          )}
        </section>
      </div>
    </>
  )
}

interface GameBoardProps {
  room: Room
  players: RoomPlayer[]
  player?: RoomPlayer
  isHost: boolean
  calling: boolean
  claiming: boolean
  canClaim: boolean
  returningToLobby: boolean
  updatingCallControls: boolean
  markMode: MarkMode
  manualMarks: number[]
  onCall: () => void
  onClaim: () => void
  onRequestRestart: () => void
  onCallModeChange: (mode: CallMode) => void
  onPauseToggle: () => void
  onMarkModeChange: (mode: MarkMode) => void
  onCellToggle: (number: number) => void
}

function GameBoard({
  room,
  players,
  player,
  isHost,
  calling,
  claiming,
  canClaim,
  returningToLobby,
  updatingCallControls,
  markMode,
  manualMarks,
  onCall,
  onClaim,
  onRequestRestart,
  onCallModeChange,
  onPauseToggle,
  onMarkModeChange,
  onCellToggle,
}: GameBoardProps) {
  const recentCalls = [...room.calledNumbers].reverse().slice(1, 9)
  const wrongMarks =
    markMode === 'manual'
      ? manualMarks.filter(
          (number) => !room.calledNumbers.includes(number),
        )
      : []

  return (
    <>
      {room.status === 'finished' && (
        <section className="winner-banner" aria-live="polite">
          <span aria-hidden="true">★</span>
          <div>
            <p>{room.winners.length === 1 ? 'We have a winner' : 'We have winners'}</p>
            <h1>
              {room.winners.map((winner) => `@${winner.username}`).join(', ')}{' '}
              called Bingo!
            </h1>
          </div>
          {isHost && (
            <button
              className="button button--primary"
              type="button"
              onClick={onRequestRestart}
              disabled={returningToLobby}
            >
              {returningToLobby && <Spinner label="Returning to lobby" />}
              {returningToLobby ? 'Restarting…' : 'Restart game'}
            </button>
          )}
        </section>
      )}

      <section className="game-header">
        <div>
          <p className="eyebrow">Room {room.code}</p>
          <h1>{room.status === 'playing' ? 'Bingo is live' : 'Round complete'}</h1>
          <p>{patternLabels[room.settings.winPattern]} wins this round.</p>
        </div>
        <div className="call-summary">
          <div
            className={`current-call${room.callingPaused ? ' is-paused' : ''}`}
            aria-live="polite"
            aria-atomic="true"
          >
            <span>Current call</span>
            <strong>{room.currentNumber ? getBallLabel(room.currentNumber) : '—'}</strong>
            <small>
              {room.callingPaused ? 'Calling paused' : `${room.calledNumbers.length} of 75 called`}
            </small>
          </div>
          {recentCalls.length > 0 && (
            <div className="recent-call-strip">
              <span>Recent</span>
              <ol className="recent-calls" aria-label="Previous calls">
                {recentCalls.map((number) => (
                  <li key={number}>{getBallLabel(number)}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <div className="game-layout">
        <section className="bingo-card-panel" aria-labelledby="your-card-title">
          <div className="game-panel-heading">
            <div>
              <p className="eyebrow">Player card</p>
              <h2 id="your-card-title">Your bingo card</h2>
            </div>
            {room.status === 'playing' && player?.status === 'active' && (
              <button
                className="button button--bingo"
                type="button"
                onClick={onClaim}
                disabled={!canClaim || claiming}
              >
                {claiming && <Spinner label="Checking Bingo" />}
                {claiming ? 'Checking…' : 'Call Bingo!'}
              </button>
            )}
          </div>

          {room.status === 'playing' && player?.status === 'active' && (
            <div className="marking-toolbar">
              <div className="live-call-controls" aria-label="Card marking mode">
                <button
                  className={markMode === 'automatic' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onMarkModeChange('automatic')}
                  aria-pressed={markMode === 'automatic'}
                >
                  Automatic marks
                </button>
                <button
                  className={markMode === 'manual' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onMarkModeChange('manual')}
                  aria-pressed={markMode === 'manual'}
                >
                  Manual marks
                </button>
              </div>
              {markMode === 'manual' && (
                <p className={wrongMarks.length ? 'wrong-mark-status has-errors' : 'wrong-mark-status'} role="status">
                  {wrongMarks.length
                    ? `${wrongMarks.length} wrong ${wrongMarks.length === 1 ? 'mark' : 'marks'} detected`
                    : 'All of your marks are correct'}
                </p>
              )}
            </div>
          )}

          {player?.status === 'waiting' ? (
            <div className="next-game-waiting" role="status">
              <span aria-hidden="true">⌛</span>
              <div>
                <h3>You’re on the waiting list</h3>
                <p>
                  This game is already underway. You’ll join automatically when
                  the host restarts for the next game.
                </p>
              </div>
            </div>
          ) : player?.cards.length ? (
            <div className="active-cards">
              {player.cards.map((card, index) => (
                <div className="active-card" key={`${index}-${card.cells.join('-')}`}>
                  {player.cards.length > 1 && <span>Card {index + 1}</span>}
                  <BingoCard
                    card={card.cells}
                    calledNumbers={room.calledNumbers}
                    markMode={markMode}
                    markedNumbers={manualMarks}
                    disabled={room.status !== 'playing'}
                    onToggle={onCellToggle}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="card-unavailable">Your player card is unavailable.</p>
          )}
          {room.status === 'playing' && player?.status === 'active' && !canClaim && (
            <p className="claim-help">
              {markMode === 'manual'
                ? 'Tap card numbers to mark them. Wrong marks are highlighted.'
                : 'Called numbers are marked automatically.'}
            </p>
          )}
        </section>

        <aside className="caller-panel">
          <div className="game-panel-heading">
            <div>
              <p className="eyebrow">Game details</p>
              <h2>{isHost && room.status === 'playing' ? 'Call controls' : 'Players'}</h2>
            </div>
          </div>

          {isHost && room.status === 'playing' && (
            <div className="caller-controls">
              <div className="live-call-controls" aria-label="Calling mode">
                <button
                  className={room.settings.callMode === 'manual' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onCallModeChange('manual')}
                  disabled={updatingCallControls}
                  aria-pressed={room.settings.callMode === 'manual'}
                >
                  Manual
                </button>
                <button
                  className={room.settings.callMode === 'automatic' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onCallModeChange('automatic')}
                  disabled={updatingCallControls}
                  aria-pressed={room.settings.callMode === 'automatic'}
                >
                  Automatic
                </button>
              </div>

              <button
                className={`button button--full ${
                  room.callingPaused ? 'button--primary' : 'button--secondary'
                }`}
                type="button"
                onClick={onPauseToggle}
                disabled={updatingCallControls || calling}
              >
                {updatingCallControls && <Spinner label="Updating call controls" />}
                {room.callingPaused ? 'Resume calling' : 'Pause calling'}
              </button>

              {room.settings.callMode === 'manual' ? (
                <button
                  className="button button--primary button--full"
                  type="button"
                  onClick={onCall}
                  disabled={
                    calling ||
                    updatingCallControls ||
                    room.callingPaused ||
                    room.calledNumbers.length >= 75
                  }
                >
                  {calling && <Spinner label="Calling next number" />}
                  {calling ? 'Calling…' : 'Call next number'}
                </button>
              ) : (
                <div className={`auto-call-status${room.callingPaused ? ' is-paused' : ''}`}>
                  {!room.callingPaused && <Spinner label="Automatic calling active" />}
                  {room.callingPaused
                    ? 'Automatic calling is paused'
                    : `Calling every ${room.settings.callInterval} seconds`}
                </div>
              )}

              <button
                className="text-button restart-round-button"
                type="button"
                onClick={onRequestRestart}
                disabled={returningToLobby || updatingCallControls || calling}
              >
                Restart game
              </button>
            </div>
          )}

          <div className="game-player-summary">
            <span>
              {players.filter((roomPlayer) => roomPlayer.status === 'active').length}{' '}
              active
              {players.some((roomPlayer) => roomPlayer.status === 'waiting') &&
                ` · ${players.filter((roomPlayer) => roomPlayer.status === 'waiting').length} waiting`}
            </span>
            <div className="avatar-stack" aria-hidden="true">
              {players.slice(0, 4).map((roomPlayer) => (
                <span key={roomPlayer.uid}>{roomPlayer.username.charAt(0).toUpperCase()}</span>
              ))}
            </div>
          </div>
          {players.some((roomPlayer) => roomPlayer.status === 'waiting') && (
            <div className="waiting-player-list">
              <span>Waiting for next game</span>
              <ul>
                {players
                  .filter((roomPlayer) => roomPlayer.status === 'waiting')
                  .map((roomPlayer) => (
                    <li key={roomPlayer.uid}>@{roomPlayer.username}</li>
                  ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

function RoundHistoryList({ history }: { history: RoundHistory[] }) {
  if (history.length === 0) return null

  return (
    <section className="round-history" aria-labelledby="round-history-title">
      <div className="round-history__heading">
        <p className="eyebrow">Room results</p>
        <h2 id="round-history-title">Game history</h2>
      </div>
      <ol>
        {history.map((round) => (
          <li key={round.roundNumber}>
            <div>
              <span>Game {round.roundNumber}</span>
              <small>{round.calledNumbers.length} numbers called</small>
            </div>
            <div className="history-winners">
              <span>{round.winners.length === 1 ? 'Winner' : 'Winners'}</span>
              <strong>
                {round.winners.map((winner) => `@${winner.username}`).join(', ')}
              </strong>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function BingoCard({
  card,
  calledNumbers,
  compact = false,
  markMode = 'automatic',
  markedNumbers = [],
  disabled = false,
  onToggle,
}: {
  card: RoomPlayer['cards'][number]['cells']
  calledNumbers: number[]
  compact?: boolean
  markMode?: MarkMode
  markedNumbers?: number[]
  disabled?: boolean
  onToggle?: (number: number) => void
}) {
  return (
    <div className={`bingo-grid${compact ? ' bingo-grid--compact' : ''}`} aria-label="Bingo card">
      {'BINGO'.split('').map((letter) => (
        <div className="bingo-grid__letter" key={letter} aria-hidden="true">{letter}</div>
      ))}
      {card.map((cell, index) => {
        const automaticMark = isCellMarked(cell, calledNumbers)
        const manualMark = cell === null || (cell !== null && markedNumbers.includes(cell))
        const marked = markMode === 'automatic' ? automaticMark : manualMark
        const wrong = Boolean(
          markMode === 'manual' && cell !== null && manualMark && !automaticMark,
        )
        const className = `bingo-cell${marked ? ' is-marked' : ''}${
          wrong ? ' is-wrong' : ''
        }${cell === null ? ' is-free' : ''}`
        const label =
          cell === null
            ? 'Free space, marked'
            : `${cell}${marked ? ', marked' : ''}${wrong ? ', wrong mark' : ''}`

        if (markMode === 'manual' && cell !== null && !compact) {
          return (
            <button
              className={className}
              key={`${index}-${cell}`}
              type="button"
              onClick={() => onToggle?.(cell)}
              disabled={disabled}
              aria-pressed={manualMark}
              aria-label={label}
            >
              {cell}
            </button>
          )
        }

        return <div className={className} key={`${index}-${cell ?? 'free'}`} aria-label={label}>{cell ?? 'FREE'}</div>
      })}
    </div>
  )
}

function RoomCode({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="room-code-card">
      <span>Room code</span>
      <strong>{code}</strong>
      <button className="text-button" type="button" onClick={onCopy}>
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  )
}

function PlayersList({ players, hostUid }: { players: RoomPlayer[]; hostUid: string }) {
  const { user } = useAuth()
  return (
    <section className="players-card" aria-labelledby="players-title">
      <div className="players-card__header">
        <div>
          <p className="eyebrow">Lobby</p>
          <h2 id="players-title">Players</h2>
        </div>
        <span className="player-count">{players.length} {players.length === 1 ? 'player' : 'players'}</span>
      </div>
      {players.length > 0 ? (
        <ul className="player-list">
          {players.map((player) => (
            <li key={player.uid}>
              <span className="avatar" aria-hidden="true">{player.username.charAt(0).toUpperCase()}</span>
              <strong>@{player.username}</strong>
              {player.uid === hostUid && <span className="host-badge">Host</span>}
              {player.uid === user?.uid && <span className="you-label">You</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="players-empty"><Spinner label="Waiting for players" /> Waiting for players…</div>
      )}
    </section>
  )
}
