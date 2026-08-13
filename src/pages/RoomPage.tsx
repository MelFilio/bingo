import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/useAuth'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Logo } from '../components/Logo'
import { Spinner } from '../components/Spinner'
import {
  defaultGameSettings,
  getBallLabel,
  hasBingo,
  isCellMarked,
  preserveCalledMarks,
  type CallMode,
  type GameSettings,
  type WinPattern,
} from '../features/game/bingo'
import {
  callNextNumber,
  claimBingo,
  leaveRoom,
  markRoomPlayerOffline,
  markRoomPlayerOnline,
  pauseForDisconnectedHost,
  rerollCards,
  restartGame,
  setCallingPaused,
  startGame,
  subscribeToPlayers,
  subscribeToRoundHistory,
  subscribeToRoom,
  updateGameSettings,
  updateCallControls,
  updateRoomPlayerHeartbeat,
  roomPresenceHeartbeatMs,
  roomPresenceStaleMs,
  type Room,
  type RoomPlayer,
  type RoundHistory,
} from '../features/rooms/rooms'
import { cn } from '../lib/styles'
import {
  avatar,
  buttonFull,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  eyebrow,
  pageTopbar,
  panel,
  textButton,
} from '../lib/ui'

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
  const [presenceNow, setPresenceNow] = useState(() => Date.now())
  const hostPauseRequestedRef = useRef(false)

  const isHost = room?.hostUid === user?.uid
  const currentPlayer = players.find((player) => player.uid === user?.uid)
  const hostPlayer = players.find((player) => player.uid === room?.hostUid)
  const hostLastSeenAt = hostPlayer?.lastSeenAt?.toMillis()
  const hostIsDisconnected = Boolean(
    room?.status === 'playing' &&
      hostPlayer &&
      (hostPlayer.connectionState === 'offline' ||
        (hostLastSeenAt && presenceNow - hostLastSeenAt > roomPresenceStaleMs)),
  )
  const isRoomMember = Boolean(currentPlayer)
  const currentPlayerHasCard = Boolean(
    room &&
      currentPlayer &&
      (room.settings.hostPlays || currentPlayer.uid !== room.hostUid),
  )
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
      currentPlayerHasCard &&
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
    if (!user || !profile?.username) return
    const username = profile.username
    let active = true

    const markOnline = () => {
      void markRoomPlayerOnline(code, {
        uid: user.uid,
        username,
      }).catch(() => {
        if (active) {
          setError('We could not reconnect you to this room. Refresh and try again.')
        }
      })
    }
    const handleOnline = () => markOnline()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') markOnline()
    }

    markOnline()
    window.addEventListener('online', handleOnline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.removeEventListener('online', handleOnline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [code, profile?.username, user])

  useEffect(() => {
    if (!user || !isHost) return

    const sendHeartbeat = () => {
      void updateRoomPlayerHeartbeat(code, user.uid).catch(() => undefined)
    }
    const markOffline = () => {
      void markRoomPlayerOffline(code, user.uid).catch(() => undefined)
    }

    sendHeartbeat()
    const heartbeat = window.setInterval(sendHeartbeat, roomPresenceHeartbeatMs)
    window.addEventListener('offline', markOffline)

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('offline', markOffline)
      markOffline()
    }
  }, [code, isHost, user])

  useEffect(() => {
    const timer = window.setInterval(() => setPresenceNow(Date.now()), 5_000)
    return () => window.clearInterval(timer)
  }, [])

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

  useEffect(() => {
    if (!room || !user || isHost || !hostIsDisconnected || room.callingPaused) {
      if (!hostIsDisconnected) hostPauseRequestedRef.current = false
      return
    }
    if (hostPauseRequestedRef.current) return

    hostPauseRequestedRef.current = true
    void pauseForDisconnectedHost(code, user.uid).catch(() => {
      hostPauseRequestedRef.current = false
    })
  }, [code, hostIsDisconnected, isHost, room, user])

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
        players
          .filter(
            (player) =>
              player.uid !== user.uid && player.connectionState === 'offline',
          )
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
    if (nextMode === 'manual' && room) {
      setManualMarks((currentMarks) =>
        preserveCalledMarks(currentMarks, room.calledNumbers),
      )
    }
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

  if (loading || (leaving && !room)) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-[22px] text-primary">
        <Spinner label={leaving ? 'Leaving room' : 'Opening room'} />
      </main>
    )
  }

  if (!room) {
    return (
      <main className="grid min-h-screen place-content-center justify-items-center p-6 text-center">
        <Logo />
        <h1 className="mt-12 mb-2 font-display text-[38px]">
          Room not found
        </h1>
        <p className="mt-0 mb-6 text-muted">
          This room may have closed, or the code may be incorrect.
        </p>
        <button className={buttonPrimary} onClick={onLeave}>Back home</button>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className={pageTopbar}>
        <Logo />
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'rounded-full px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em]',
              room.status === 'playing' && 'bg-[#e3f2e4] text-[#23603e]',
              room.status === 'finished' && 'bg-[#f8efd4] text-[#725719]',
              room.status === 'waiting' && 'bg-surface-soft text-muted',
            )}
          >
            {room.status}
          </span>
          <button
            className={cn(buttonSecondary, buttonSmall)}
            type="button"
            onClick={handleLeave}
            disabled={leaving}
          >
            {leaving && <Spinner label="Leaving room" />}
            {leaving ? 'Leaving…' : isHost ? 'Close room' : 'Leave room'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-[min(1040px,calc(100%-48px))] py-16 max-[1024px]:w-[min(100%-48px,900px)] max-[1024px]:py-12 max-[480px]:w-[calc(100%-32px)] max-[480px]:py-10">
        {error && (
          <div
            className="mb-6 rounded-sm border border-[#efc5c1] bg-[#fff5f4] px-4 py-3.5 text-sm text-danger"
            role="alert"
          >
            {error}
          </div>
        )}
        {hostIsDisconnected && (
          <div
            className="mb-6 rounded-sm border border-[#e2d29d] bg-[#fff9e7] px-4 py-3.5 text-sm font-semibold text-[#6c5318]"
            role="status"
          >
            The host disconnected, so number calling is paused until the host
            returns.
          </div>
        )}

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
        {room.status === 'waiting' && (
          <div className="mt-7">
            <PlayersList players={players} hostUid={room.hostUid} />
          </div>
        )}
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
  const currentPlayerHasCard = Boolean(
    currentPlayer &&
      (settings.hostPlays || currentPlayer.uid !== room.hostUid),
  )
  const cardPlayers = players.filter(
    (player) => settings.hostPlays || player.uid !== room.hostUid,
  )
  const cardsReady = players.every(
    (player) =>
      !settings.hostPlays && player.uid === room.hostUid
        ? true
        : player.cards.length === settings.cardCount,
  )
  const [patternDialogOpen, setPatternDialogOpen] = useState(false)

  return (
    <>
      <section
        className="mb-10 flex items-center justify-between gap-12 max-[800px]:flex-col max-[800px]:items-stretch"
        aria-labelledby="room-title"
      >
        <div>
          <p className={eyebrow}>Bingo lobby</p>
          <h1
            className="m-0 font-display text-[clamp(38px,6vw,60px)] tracking-normal"
            id="room-title"
          >
            Waiting for players
          </h1>
          <p className="mt-3.5 mb-0 max-w-[540px] text-[17px] leading-[1.55] text-muted">
            Share the room code. New players will appear here automatically.
          </p>
        </div>
        <RoomCode code={room.code} copied={copied} onCopy={onCopy} />
      </section>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(300px,0.65fr)] items-start gap-[22px] max-[1024px]:grid-cols-1">
        <div className="grid gap-[22px]">
          {currentPlayer && (
            <section
              className={cn(panel, 'p-[26px_30px_30px]')}
              aria-labelledby="lobby-cards-title"
            >
              <div className="mb-6 flex items-center justify-between gap-[18px] max-[480px]:flex-col max-[480px]:items-start">
                <div>
                  <p className={cn(eyebrow, 'mb-1')}>Your game</p>
                  <h2
                    className="m-0 font-display text-2xl tracking-normal"
                    id="lobby-cards-title"
                  >
                    {currentPlayerHasCard
                      ? currentPlayer.cards.length === 1
                        ? 'Your card'
                        : 'Your cards'
                      : 'Host only'}
                  </h2>
                </div>
                {currentPlayerHasCard && (
                  <button
                    className={cn(buttonSecondary, buttonSmall)}
                    type="button"
                    onClick={onReroll}
                    disabled={rerolling}
                  >
                    {rerolling && <Spinner label="Rerolling cards" />}
                    {rerolling ? 'Rerolling…' : 'Reroll cards'}
                  </button>
                )}
              </div>
              {!currentPlayerHasCard ? (
                <div
                  className="rounded-sm border border-[#d1dfc7] bg-[#f7faf5] p-[18px] text-[13px] leading-normal text-muted"
                  role="status"
                >
                  You are hosting this round without a player card.
                </div>
              ) : currentPlayer.cards.length === settings.cardCount ? (
                <div className="grid grid-cols-1 gap-[18px] min-[620px]:grid-cols-2">
                  {currentPlayer.cards.map((card, index) => (
                    <BingoCardFrame
                      compact
                      title={`Card ${index + 1}`}
                      key={`${index}-${card.cells.join('-')}`}
                    >
                      <BingoCard card={card.cells} calledNumbers={[]} compact />
                    </BingoCardFrame>
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-sm border border-[#e2d29d] bg-[#fff9e7] p-[18px] text-[13px] leading-normal text-[#6c5318]"
                  role="status"
                >
                  The host changed this round to {settings.cardCount}{' '}
                  {settings.cardCount === 1 ? 'card' : 'cards'}. Reroll to continue.
                </div>
              )}
            </section>
          )}
        </div>

        <section
          className={cn(panel, 'p-7')}
          aria-labelledby="settings-title"
        >
          <div className="mb-[26px]">
            <p className={cn(eyebrow, 'mb-1')}>Host controls</p>
            <h2
              className="m-0 font-display text-2xl tracking-normal"
              id="settings-title"
            >
              Game settings
            </h2>
          </div>

          {isHost ? (
            <>
              <fieldset className="mb-[22px] min-w-0 border-0 p-0">
                <legend className="mb-[9px] text-[13px] font-bold text-text">
                  Winning pattern
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-surface-soft p-1 max-[480px]:grid-cols-1">
                  {(Object.keys(patternLabels) as WinPattern[]).map((pattern) => (
                    <label key={pattern}>
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="win-pattern"
                        value={pattern}
                        checked={settings.winPattern === pattern}
                        onChange={() => onSettingsChange({ ...settings, winPattern: pattern })}
                        disabled={savingSettings}
                      />
                      <span className="grid min-h-[38px] place-items-center rounded-[7px] px-2 py-[5px] text-center text-xs font-bold text-muted shadow-none peer-checked:bg-surface peer-checked:text-primary peer-checked:shadow-[0_1px_5px_rgba(33,54,42,.09)] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus/50">
                        {patternLabels[pattern]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {settings.winPattern === 'custom' && (
                <fieldset className="mb-[22px] min-w-0 border-0 p-0">
                  <legend className="mb-[9px] text-[13px] font-bold text-text">
                    Select required squares
                  </legend>
                  <div
                    className="grid grid-cols-5 gap-[5px]"
                    aria-label="Custom winning pattern"
                  >
                    {settings.customPattern.map((selected, index) => (
                      <label key={index}>
                        <input
                          className="peer sr-only"
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
                        <span className="grid aspect-square place-items-center rounded-md border border-border bg-[#fafcf9] text-xs font-extrabold text-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-disabled:cursor-not-allowed peer-disabled:opacity-70 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus/50">
                          {index === 12 ? 'FREE' : selected ? '✓' : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2.5 mb-0 text-left text-xs leading-normal text-muted">
                    Selected squares must all be called.
                  </p>
                </fieldset>
              )}

              <fieldset className="mb-[22px] min-w-0 border-0 p-0">
                <legend className="mb-[9px] text-[13px] font-bold text-text">
                  Cards per player
                </legend>
                <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-surface-soft p-1 max-[480px]:grid-cols-1">
                  {([1, 2, 3] as const).map((cardCount) => (
                    <label key={cardCount}>
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="card-count"
                        value={cardCount}
                        checked={settings.cardCount === cardCount}
                        onChange={() => onSettingsChange({ ...settings, cardCount })}
                        disabled={savingSettings}
                      />
                      <span className="grid min-h-[38px] place-items-center rounded-[7px] px-2 py-[5px] text-center text-xs font-bold text-muted peer-checked:bg-surface peer-checked:text-primary peer-checked:shadow-[0_1px_5px_rgba(33,54,42,.09)] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus/50">
                        {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mb-[22px] min-w-0 border-0 p-0">
                <legend className="mb-[9px] text-[13px] font-bold text-text">
                  Host role
                </legend>
                <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-surface-soft p-1">
                  {[
                    { label: 'Host gets card', value: true },
                    { label: 'Host only', value: false },
                  ].map((option) => (
                    <label key={option.label}>
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="host-plays"
                        checked={settings.hostPlays === option.value}
                        onChange={() =>
                          onSettingsChange({
                            ...settings,
                            hostPlays: option.value,
                          })
                        }
                        disabled={savingSettings}
                      />
                      <span className="grid min-h-[38px] place-items-center rounded-[7px] px-2 py-[5px] text-center text-xs font-bold text-muted peer-checked:bg-surface peer-checked:text-primary peer-checked:shadow-[0_1px_5px_rgba(33,54,42,.09)] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus/50">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="mb-[22px] min-w-0 border-0 p-0">
                <legend className="mb-[9px] text-[13px] font-bold text-text">
                  Number calling
                </legend>
                <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-surface-soft p-1">
                  {(['manual', 'automatic'] as CallMode[]).map((mode) => (
                    <label key={mode}>
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="call-mode"
                        value={mode}
                        checked={settings.callMode === mode}
                        onChange={() => onSettingsChange({ ...settings, callMode: mode })}
                        disabled={savingSettings}
                      />
                      <span className="grid min-h-[38px] place-items-center rounded-[7px] px-2 py-[5px] text-center text-xs font-bold text-muted peer-checked:bg-surface peer-checked:text-primary peer-checked:shadow-[0_1px_5px_rgba(33,54,42,.09)] peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus/50">
                        {mode === 'manual' ? 'Manual' : 'Automatic'}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {settings.callMode === 'automatic' && (
                <div className="mb-5">
                  <label
                    className="mb-[9px] block text-[13px] font-bold text-text"
                    htmlFor="call-interval"
                  >
                    Call a number every
                  </label>
                  <select
                    id="call-interval"
                    value={settings.callInterval}
                    onChange={(event) =>
                      onSettingsChange({
                        ...settings,
                        callInterval: Number(event.target.value) as 3 | 5 | 10 | 15,
                      })
                    }
                    className="h-11 w-full rounded-sm border border-border bg-surface px-3 text-text"
                    disabled={savingSettings}
                  >
                    <option value={3}>3 seconds</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={15}>15 seconds</option>
                  </select>
                </div>
              )}

              <button
                className={cn(buttonPrimary, buttonFull)}
                type="button"
                onClick={onStart}
                disabled={
                  starting ||
                  savingSettings ||
                  cardPlayers.length === 0 ||
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
                <p className="mt-2.5 mb-0 text-center text-xs leading-normal text-[#7a6228]">
                  Waiting for every player to reroll {settings.cardCount}{' '}
                  {settings.cardCount === 1 ? 'card' : 'cards'}.
                </p>
              )}
            </>
          ) : (
            <div className="grid gap-[22px]">
              <div className="flex min-h-[180px] items-center justify-center gap-3 text-center text-muted">
                <Spinner label="Waiting for host" />
                <p className="max-w-[260px] leading-[1.55]">
                  The host is choosing the game settings and will start soon.
                </p>
              </div>
              {settings.winPattern === 'custom' && (
                <button
                  className={buttonSecondary}
                  type="button"
                  onClick={() => setPatternDialogOpen(true)}
                >
                  Winning pattern
                </button>
              )}
            </div>
          )}
        </section>
      </div>
      <CustomPatternDialog
        open={patternDialogOpen}
        pattern={settings.customPattern}
        onClose={() => setPatternDialogOpen(false)}
      />
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
  const [patternDialogOpen, setPatternDialogOpen] = useState(false)
  const [calledNumbersDialogOpen, setCalledNumbersDialogOpen] = useState(false)
  const [winnersDialogOpen, setWinnersDialogOpen] = useState(false)
  const playerHasCard = Boolean(
    player && (room.settings.hostPlays || player.uid !== room.hostUid),
  )
  const activeCardPlayers = players.filter(
    (roomPlayer) =>
      roomPlayer.status === 'active' &&
      (room.settings.hostPlays || roomPlayer.uid !== room.hostUid),
  )
  const waitingPlayers = players.filter(
    (roomPlayer) => roomPlayer.status === 'waiting',
  )
  const wrongMarks =
    markMode === 'manual'
      ? manualMarks.filter(
          (number) => !room.calledNumbers.includes(number),
        )
      : []

  useEffect(() => {
    if (room.status === 'finished' && room.winners.length > 0) {
      setWinnersDialogOpen(true)
    }
  }, [room.roundNumber, room.status, room.winners.length])

  return (
    <>
      {room.status === 'finished' && (
        <section
          className="mb-[34px] flex items-center gap-5 rounded-lg border border-[#dccb91] bg-[linear-gradient(135deg,#fff8de,#f1e5b8)] px-7 py-6 text-[#4d3b11] max-[480px]:flex-wrap max-[480px]:items-start max-[480px]:p-5"
          aria-live="polite"
        >
          <span
            className="grid size-12 flex-none place-items-center rounded-full bg-[#8a6b22] text-[22px] text-[#fff8de]"
            aria-hidden="true"
          >
            ★
          </span>
          <div>
            <p className="mt-0 mb-[3px] text-xs font-extrabold uppercase tracking-[0.1em]">
              {room.winners.length === 1 ? 'We have a winner' : 'We have winners'}
            </p>
            <h1 className="m-0 font-display text-[clamp(22px,4vw,32px)] tracking-normal">
              {room.winners.map((winner) => `@${winner.username}`).join(', ')}{' '}
              called Bingo!
            </h1>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5 max-[480px]:ml-0 max-[480px]:w-full">
            <button
              className={cn(buttonSecondary, 'bg-white/70 text-[#4d3b11] hover:not-disabled:bg-white max-[480px]:w-full')}
              type="button"
              onClick={() => setWinnersDialogOpen(true)}
            >
              View winners
            </button>
          {isHost && (
            <button
              className={cn(buttonPrimary, 'whitespace-nowrap max-[480px]:w-full')}
              type="button"
              onClick={onRequestRestart}
              disabled={returningToLobby}
            >
              {returningToLobby && <Spinner label="Returning to lobby" />}
              {returningToLobby ? 'Restarting…' : 'Restart game'}
            </button>
          )}
          </div>
        </section>
      )}

      <section className="mb-[34px]">
        <div>
          <p className={eyebrow}>Room {room.code}</p>
          <h1 className="m-0 font-display text-[clamp(38px,6vw,58px)] tracking-normal">
            {room.status === 'playing' ? 'Bingo is live' : 'Round complete'}
          </h1>
          <p className="mt-2.5 mb-0 text-muted">
            {patternLabels[room.settings.winPattern]} wins this round.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)] items-start gap-[22px] max-[1024px]:grid-cols-1">
        <section
          className={cn(panel, 'p-7 max-[1024px]:p-6 max-[480px]:p-5')}
          aria-labelledby="your-card-title"
        >
          <div className="mb-6 flex items-center justify-between gap-[18px] max-[480px]:flex-col max-[480px]:items-start">
            <div>
              <p className={cn(eyebrow, 'mb-1')}>Player card</p>
              <h2
                className="m-0 font-display text-2xl tracking-normal"
                id="your-card-title"
              >
                Your bingo card
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {room.settings.winPattern === 'custom' && (
                <button
                  className={cn(buttonSecondary, buttonSmall)}
                  type="button"
                  onClick={() => setPatternDialogOpen(true)}
                >
                  Winning pattern
                </button>
              )}
              {room.status === 'playing' && player?.status === 'active' && playerHasCard && (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-[9px] rounded-sm border border-transparent bg-[#b7791f] px-[18px] font-semibold text-white transition-[background,border-color,transform] duration-150 hover:not-disabled:bg-[#946118] active:not-disabled:translate-y-px max-[640px]:hidden"
                  type="button"
                  onClick={onClaim}
                  disabled={!canClaim || claiming}
                >
                  {claiming && <Spinner label="Checking Bingo" />}
                  {claiming ? 'Checking…' : 'Call Bingo!'}
                </button>
              )}
            </div>
          </div>

          {room.status === 'playing' && player?.status === 'active' && playerHasCard && (
            <div className="mt-[-4px] mb-[22px] flex items-center justify-between gap-4 rounded-sm border border-border bg-[#fafcf9] p-3 max-[480px]:flex-col max-[480px]:items-stretch">
              <div
                className="grid min-w-[250px] grid-cols-2 gap-1 rounded-[10px] bg-surface-soft p-1 max-[480px]:min-w-0"
                aria-label="Card marking mode"
              >
                <button
                  className={cn(
                    'min-h-9 rounded-[7px] border-0 bg-transparent px-2 py-[5px] text-xs font-bold text-muted',
                    markMode === 'automatic' &&
                      'bg-surface text-primary shadow-[0_1px_5px_rgba(33,54,42,.09)]',
                  )}
                  type="button"
                  onClick={() => onMarkModeChange('automatic')}
                  aria-pressed={markMode === 'automatic'}
                >
                  Automatic marks
                </button>
                <button
                  className={cn(
                    'min-h-9 rounded-[7px] border-0 bg-transparent px-2 py-[5px] text-xs font-bold text-muted',
                    markMode === 'manual' &&
                      'bg-surface text-primary shadow-[0_1px_5px_rgba(33,54,42,.09)]',
                  )}
                  type="button"
                  onClick={() => onMarkModeChange('manual')}
                  aria-pressed={markMode === 'manual'}
                >
                  Manual marks
                </button>
              </div>
              {markMode === 'manual' && (
                <p
                  className={cn(
                    'm-0 text-xs font-bold',
                    wrongMarks.length > 0 ? 'text-danger' : 'text-[#35614c]',
                  )}
                  role="status"
                >
                  {wrongMarks.length
                    ? `${wrongMarks.length} wrong ${wrongMarks.length === 1 ? 'mark' : 'marks'} detected`
                    : 'All of your marks are correct'}
                </p>
              )}
            </div>
          )}

          {player?.status === 'waiting' ? (
            <div
              className="flex min-h-[260px] items-center justify-center gap-[18px] rounded-md border border-dashed border-[#c8d5c5] bg-[#f7faf5] p-8 text-left max-[480px]:flex-col max-[480px]:items-start"
              role="status"
            >
              <span
                className="grid size-12 flex-none place-items-center rounded-full bg-surface-soft text-[22px]"
                aria-hidden="true"
              >
                ⌛
              </span>
              <div>
                <h3 className="mt-0 mb-[7px] font-display text-xl">
                  You’re on the waiting list
                </h3>
                <p className="m-0 max-w-[420px] leading-[1.55] text-muted">
                  This game is already underway. You’ll join automatically when
                  the host restarts for the next game.
                </p>
              </div>
            </div>
          ) : !playerHasCard ? (
            <div
              className="flex min-h-[260px] items-center justify-center gap-[18px] rounded-md border border-dashed border-[#c8d5c5] bg-[#f7faf5] p-8 text-left max-[480px]:flex-col max-[480px]:items-start"
              role="status"
            >
              <span
                className="grid size-12 flex-none place-items-center rounded-full bg-surface-soft font-display text-sm font-extrabold text-primary"
                aria-hidden="true"
              >
                HOST
              </span>
              <div>
                <h3 className="mt-0 mb-[7px] font-display text-xl">
                  You are hosting this round
                </h3>
                <p className="m-0 max-w-[420px] leading-[1.55] text-muted">
                  Host only is enabled, so you can run the game without a bingo card.
                </p>
              </div>
            </div>
          ) : player?.cards.length ? (
            <div className="grid grid-cols-1 gap-5 min-[620px]:grid-cols-2">
              {player.cards.map((card, index) => (
                <BingoCardFrame
                  title={player.cards.length > 1 ? `Card ${index + 1}` : 'Bingo card'}
                  key={`${index}-${card.cells.join('-')}`}
                >
                  <BingoCard
                    card={card.cells}
                    calledNumbers={room.calledNumbers}
                    markMode={markMode}
                    markedNumbers={manualMarks}
                    disabled={room.status !== 'playing'}
                    onToggle={onCellToggle}
                  />
                </BingoCardFrame>
              ))}
            </div>
          ) : (
            <p className="mt-4 mb-0 text-center text-[13px] text-muted">
              Your player card is unavailable.
            </p>
          )}
          {room.status === 'playing' && player?.status === 'active' && playerHasCard && !canClaim && (
            <p className="mt-4 mb-0 text-center text-[13px] text-muted">
              {markMode === 'manual'
                ? 'Tap card numbers to mark them. Wrong marks are highlighted.'
                : 'Called numbers are marked automatically.'}
            </p>
          )}
        </section>

        <div className="grid min-w-0 gap-[22px]">
          <div
            className={cn(
              'grid min-w-[180px] grid-cols-1 items-center gap-3.5 rounded-md bg-primary px-6 py-[18px] text-[#eff7eb] max-[640px]:hidden',
              room.callingPaused && 'bg-[#efe3bd] text-[#493b1c]',
            )}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="grid justify-items-center">
              <span className={cn('text-[11px] font-bold uppercase tracking-[0.08em] text-[#c5d8cc]', room.callingPaused && 'text-[#715e32]')}>
                Current call
              </span>
              <strong className="my-0.5 font-display text-[42px] tracking-normal max-[480px]:text-4xl">
                {room.currentNumber ? getBallLabel(room.currentNumber) : '—'}
              </strong>
              <small className={cn('text-[11px] font-bold uppercase tracking-[0.08em] text-[#c5d8cc]', room.callingPaused && 'text-[#715e32]')}>
                {room.callingPaused ? 'Calling paused' : `${room.calledNumbers.length} of 75 called`}
              </small>
            </div>
            {recentCalls.length > 0 && (
              <div className={cn('w-full min-w-0 border-t border-white/20 pt-3', room.callingPaused && 'border-[#715e32]/20')}>
                <div className="mb-[7px] flex items-center justify-center gap-2">
                  <span className={cn('text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#c5d8cc]', room.callingPaused && 'text-[#715e32]')}>
                    Recent
                  </span>
                  <button
                    className={cn(
                      'rounded-full border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#eff7eb] hover:bg-white/20',
                      room.callingPaused &&
                        'border-[#715e32]/25 bg-white/30 text-[#493b1c] hover:bg-white/45',
                    )}
                    type="button"
                    onClick={() => setCalledNumbersDialogOpen(true)}
                  >
                    View all
                  </button>
                </div>
                <ol
                  className="m-0 flex list-none flex-wrap justify-center gap-1.5 p-0"
                  aria-label="Previous calls"
                >
                  {recentCalls.map((number) => (
                    <li
                      className="grid size-[34px] place-items-center rounded-full border border-border bg-surface font-display text-[10px] font-extrabold text-primary shadow-[0_1px_3px_rgba(33,54,42,.06)] max-[480px]:size-8 max-[480px]:text-[9px]"
                      key={number}
                    >
                      {getBallLabel(number)}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <aside className={cn(panel, 'p-7 max-[480px]:p-5')}>
          <div className="mb-6 flex items-center justify-between gap-[18px] max-[480px]:flex-col max-[480px]:items-start">
            <div>
              <p className={cn(eyebrow, 'mb-1')}>Game details</p>
              <h2 className="m-0 font-display text-2xl tracking-normal">
                {isHost && room.status === 'playing' ? 'Call controls' : 'Players'}
              </h2>
            </div>
          </div>

          {isHost && room.status === 'playing' && (
            <div className="mt-6 grid gap-2.5">
              <div
                className="grid grid-cols-2 gap-1 rounded-[10px] bg-surface-soft p-1"
                aria-label="Calling mode"
              >
                <button
                  className={cn(
                    'min-h-9 rounded-[7px] border-0 bg-transparent px-2 py-[5px] text-xs font-bold text-muted disabled:cursor-not-allowed disabled:opacity-65',
                    room.settings.callMode === 'manual' &&
                      'bg-surface text-primary shadow-[0_1px_5px_rgba(33,54,42,.09)]',
                  )}
                  type="button"
                  onClick={() => onCallModeChange('manual')}
                  disabled={updatingCallControls}
                  aria-pressed={room.settings.callMode === 'manual'}
                >
                  Manual
                </button>
                <button
                  className={cn(
                    'min-h-9 rounded-[7px] border-0 bg-transparent px-2 py-[5px] text-xs font-bold text-muted disabled:cursor-not-allowed disabled:opacity-65',
                    room.settings.callMode === 'automatic' &&
                      'bg-surface text-primary shadow-[0_1px_5px_rgba(33,54,42,.09)]',
                  )}
                  type="button"
                  onClick={() => onCallModeChange('automatic')}
                  disabled={updatingCallControls}
                  aria-pressed={room.settings.callMode === 'automatic'}
                >
                  Automatic
                </button>
              </div>

              <button
                className={cn(
                  room.callingPaused ? buttonPrimary : buttonSecondary,
                  buttonFull,
                )}
                type="button"
                onClick={onPauseToggle}
                disabled={updatingCallControls || calling}
              >
                {updatingCallControls && <Spinner label="Updating call controls" />}
                {room.callingPaused ? 'Resume calling' : 'Pause calling'}
              </button>

              {room.settings.callMode === 'manual' ? (
                <button
                  className={cn(buttonPrimary, buttonFull)}
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
                <div
                  className={cn(
                    'flex items-center justify-center gap-[9px] rounded-sm bg-[#e8f0e1] p-3 text-center text-xs font-bold text-[#35614c]',
                    room.callingPaused && 'bg-[#f4ecd2] text-[#715e32]',
                  )}
                >
                  {!room.callingPaused && <Spinner label="Automatic calling active" />}
                  {room.callingPaused
                    ? 'Automatic calling is paused'
                    : `Calling every ${room.settings.callInterval} seconds`}
                </div>
              )}

              <button
                className={cn(textButton, 'mt-1 justify-self-center text-danger')}
                type="button"
                onClick={onRequestRestart}
                disabled={returningToLobby || updatingCallControls || calling}
              >
                Restart game
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3.5 border-t border-border pt-5 text-xs text-muted">
            <span>
              {activeCardPlayers.length}{' '}
              active
              {waitingPlayers.length > 0 && ` · ${waitingPlayers.length} waiting`}
            </span>
            <div className="flex pl-2" aria-hidden="true">
              {activeCardPlayers.slice(0, 4).map((roomPlayer) => (
                <span
                  className="-ml-2 grid size-7 place-items-center rounded-full border-2 border-surface bg-primary text-[10px] font-extrabold text-white"
                  key={roomPlayer.uid}
                >
                  {roomPlayer.username.charAt(0).toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          {waitingPlayers.length > 0 && (
            <div className="mt-4 rounded-sm bg-[#f4ecd2] p-3.5 text-[#715e32]">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em]">
                Waiting for next game
              </span>
              <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
                {waitingPlayers.map((roomPlayer) => (
                    <li
                      className="rounded-full bg-white/55 px-[7px] py-1 text-[11px] font-bold"
                      key={roomPlayer.uid}
                    >
                      @{roomPlayer.username}
                    </li>
                  ))}
              </ul>
            </div>
          )}
          </aside>
        </div>
      </div>
      {room.status === 'playing' && player?.status === 'active' && playerHasCard && (
        <>
          <FloatingGameControls
            callingPaused={room.callingPaused}
            calledCount={room.calledNumbers.length}
            currentNumber={room.currentNumber}
            canClaim={canClaim}
            claiming={claiming}
            onClaim={onClaim}
            onViewCalls={() => setCalledNumbersDialogOpen(true)}
          />
          <div className="hidden h-32 max-[640px]:block" aria-hidden="true" />
        </>
      )}
      <CustomPatternDialog
        open={patternDialogOpen}
        pattern={room.settings.customPattern}
        onClose={() => setPatternDialogOpen(false)}
      />
      <CalledNumbersDialog
        calledNumbers={room.calledNumbers}
        open={calledNumbersDialogOpen}
        onClose={() => setCalledNumbersDialogOpen(false)}
      />
      <WinnersDialog
        open={winnersDialogOpen}
        winners={room.winners}
        onClose={() => setWinnersDialogOpen(false)}
      />
    </>
  )
}

function FloatingGameControls({
  callingPaused,
  calledCount,
  currentNumber,
  canClaim,
  claiming,
  onClaim,
  onViewCalls,
}: {
  callingPaused: boolean
  calledCount: number
  currentNumber: number | null
  canClaim: boolean
  claiming: boolean
  onClaim: () => void
  onViewCalls: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-surface/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-16px_48px_rgba(17,32,23,.16)] backdrop-blur-xl max-[640px]:block">
      <div className="mx-auto grid max-w-[520px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div
          className={cn(
            'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-primary px-4 py-3 text-[#eff7eb]',
            callingPaused && 'bg-[#efe3bd] text-[#493b1c]',
          )}
          aria-live="polite"
          aria-atomic="true"
        >
          <strong className="font-display text-3xl tracking-normal">
            {currentNumber ? getBallLabel(currentNumber) : '—'}
          </strong>
          <div className="min-w-0">
            <span
              className={cn(
                'block text-[10px] font-bold uppercase tracking-[0.08em] text-[#c5d8cc]',
                callingPaused && 'text-[#715e32]',
              )}
            >
              Current call
            </span>
            <small
              className={cn(
                'block truncate text-[11px] font-bold uppercase tracking-[0.08em] text-[#c5d8cc]',
                callingPaused && 'text-[#715e32]',
              )}
            >
              {callingPaused ? 'Paused' : `${calledCount} of 75 called`}
            </small>
          </div>
          <button
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-sm border border-white/25 bg-white/10 text-[#eff7eb]',
              callingPaused &&
                'border-[#715e32]/25 bg-white/30 text-[#493b1c]',
            )}
            type="button"
            onClick={onViewCalls}
            disabled={calledCount === 0}
            aria-label="View all called numbers"
          >
            <span className="relative block size-4" aria-hidden="true">
              <span className="absolute top-0 left-0 size-1.5 border-t-2 border-l-2 border-current" />
              <span className="absolute top-0 right-0 size-1.5 border-t-2 border-r-2 border-current" />
              <span className="absolute bottom-0 left-0 size-1.5 border-b-2 border-l-2 border-current" />
              <span className="absolute right-0 bottom-0 size-1.5 border-r-2 border-b-2 border-current" />
            </span>
          </button>
        </div>
        <div>
          <button
            className="inline-flex min-h-[58px] items-center justify-center gap-[9px] rounded-sm border border-transparent bg-[#b7791f] px-4 text-sm font-bold text-white transition-[background,border-color,transform] duration-150 hover:not-disabled:bg-[#946118] active:not-disabled:translate-y-px"
            type="button"
            onClick={onClaim}
            disabled={!canClaim || claiming}
          >
            {claiming && <Spinner label="Checking Bingo" />}
            {claiming ? 'Checking…' : 'Call Bingo!'}
          </button>
        </div>
      </div>
    </div>
  )
}

function CalledNumbersDialog({
  calledNumbers,
  open,
  onClose,
}: {
  calledNumbers: number[]
  open: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const calledSet = new Set(calledNumbers)
  const latestCall = calledNumbers.at(-1)
  const columns = ['B', 'I', 'N', 'G', 'O'].map((letter, column) => ({
    letter,
    numbers: Array.from({ length: 15 }, (_, index) => column * 15 + index + 1),
  }))

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="m-auto max-h-[min(90vh,720px)] w-[min(100%-32px,640px)] flex-col overflow-hidden rounded-lg border border-border bg-surface p-0 text-text shadow-dialog backdrop:bg-[#0f1b148c] backdrop:backdrop-blur-[3px] open:flex open:animate-[dialog-in_180ms_cubic-bezier(.2,0,0,1)]"
      aria-labelledby="called-numbers-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="px-7 pt-7">
        <p className={cn(eyebrow, 'mb-1')}>Called numbers</p>
        <div className="flex items-start justify-between gap-4">
          <h2
            className="m-0 font-display text-2xl tracking-normal"
            id="called-numbers-title"
          >
            All calls
          </h2>
          <span className="rounded-full bg-surface-soft px-3 py-1.5 text-xs font-bold text-muted">
            {calledNumbers.length} of 75
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
        {calledNumbers.length > 0 ? (
          <div
            className="mt-5 grid grid-cols-5 gap-2"
            aria-label="Called numbers arranged by Bingo column"
          >
            {columns.map(({ letter, numbers }) => (
              <div className="grid min-w-0 gap-1.5" key={letter}>
                <div className="grid h-9 place-items-center rounded-sm bg-primary font-display text-xl font-extrabold text-white">
                  {letter}
                </div>
                {numbers.map((number) => {
                  const called = calledSet.has(number)
                  const latest = number === latestCall

                  return (
                    <div
                      className={cn(
                        'grid aspect-square min-h-8 place-items-center rounded-sm border font-display text-xs font-extrabold min-[420px]:text-sm',
                        latest &&
                          'border-primary bg-primary text-white shadow-[inset_0_0_0_3px_rgba(255,255,255,.14)]',
                        called &&
                          !latest &&
                          'border-[#d1dfc7] bg-[#e8f0e1] text-primary',
                        !called && 'border-border bg-[#fafcf9] text-muted/45',
                      )}
                      key={number}
                      aria-label={`${getBallLabel(number)}${
                        called ? ', called' : ', not called'
                      }${
                        latest ? ', latest call' : ''
                      }`}
                    >
                      {number}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-5 mb-0 rounded-sm border border-border bg-[#fafcf9] p-4 text-sm text-muted">
            No numbers have been called yet.
          </p>
        )}
      </div>
      <div className="flex justify-end border-t border-border bg-[#fafcf9] px-7 py-[18px]">
        <button className={buttonPrimary} type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  )
}

function WinnersDialog({
  open,
  winners,
  onClose,
}: {
  open: boolean
  winners: Room['winners']
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(100%-32px,520px)] rounded-lg border border-border bg-surface p-0 text-text shadow-dialog backdrop:bg-[#0f1b148c] backdrop:backdrop-blur-[3px] open:animate-[dialog-in_180ms_cubic-bezier(.2,0,0,1)]"
      aria-labelledby="winners-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <ConfettiOverlay />
      <div className="relative z-10 px-7 pt-8 pb-6 text-center">
        <p className={cn(eyebrow, 'mb-1')}>Round complete</p>
        <h2
          className="m-0 font-display text-[clamp(28px,6vw,40px)] tracking-normal"
          id="winners-dialog-title"
        >
          {winners.length === 1 ? 'Bingo!' : 'Multiple Bingos!'}
        </h2>
        <p className="mx-auto mt-2 mb-0 max-w-[340px] text-sm leading-[1.55] text-muted">
          {winners.length === 1
            ? 'One player completed the winning pattern.'
            : `${winners.length} players completed the winning pattern.`}
        </p>

        <ol className="mt-6 mb-0 grid list-none gap-2.5 p-0 text-left">
          {winners.map((winner, index) => (
            <li
              className="flex min-h-14 items-center gap-3 rounded-md border border-[#d1dfc7] bg-[#f7faf5] px-4 py-3"
              key={winner.uid}
            >
              <span
                className="grid size-8 flex-none place-items-center rounded-full bg-primary text-sm font-extrabold text-white"
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <strong className="[overflow-wrap:anywhere]">@{winner.username}</strong>
            </li>
          ))}
        </ol>
      </div>

      <div className="relative z-10 flex justify-end border-t border-border bg-[#fafcf9] px-7 py-[18px]">
        <button className={buttonPrimary} type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  )
}

function ConfettiOverlay() {
  const confettiPieces = Array.from({ length: 72 }, (_, index) => index)

  return (
    <div
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden"
      aria-hidden="true"
    >
      {confettiPieces.map((piece) => {
        const left = (piece * 37) % 100
        const delay = (piece % 18) * 90
        const duration = 2600 + (piece % 7) * 220
        const sway = piece % 2 === 0 ? 32 : -32
        const colors = ['#225c45', '#b7791f', '#d8e7c7', '#b42318', '#47705f']
        const color = colors[piece % colors.length]

        return (
          <span
            className="absolute -top-8 h-3 w-2 rounded-[2px] animate-[confetti-fall_var(--confetti-duration)_linear_var(--confetti-delay)_infinite]"
            key={piece}
            style={{
              left: `${left}%`,
              backgroundColor: color,
              transform: `rotate(${piece * 17}deg)`,
              ['--confetti-delay' as string]: `${delay}ms`,
              ['--confetti-duration' as string]: `${duration}ms`,
              ['--confetti-sway' as string]: `${sway}px`,
            }}
          />
        )
      })}
    </div>
  )
}

function CustomPatternDialog({
  open,
  pattern,
  onClose,
}: {
  open: boolean
  pattern: boolean[]
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(100%-32px,440px)] rounded-lg border border-border bg-surface p-0 text-text shadow-dialog backdrop:bg-[#0f1b148c] backdrop:backdrop-blur-[3px] open:animate-[dialog-in_180ms_cubic-bezier(.2,0,0,1)]"
      aria-labelledby="custom-pattern-dialog-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="px-7 pt-7 pb-6">
        <p className={cn(eyebrow, 'mb-1')}>Winning pattern</p>
        <h2
          className="m-0 font-display text-2xl tracking-normal"
          id="custom-pattern-dialog-title"
        >
          Custom pattern
        </h2>
        <CustomPatternPreview pattern={pattern} />
      </div>
      <div className="flex justify-end border-t border-border bg-[#fafcf9] px-7 py-[18px]">
        <button className={buttonPrimary} type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  )
}

function CustomPatternPreview({ pattern }: { pattern: boolean[] }) {
  return (
    <div className="mt-5">
      <div
        className="grid grid-cols-5 gap-[5px]"
        aria-label="Required squares for the custom winning pattern"
      >
        {Array.from({ length: 25 }, (_, index) => {
          const selected = Boolean(pattern[index])
          const isFree = index === 12

          return (
            <div
              className={cn(
                'grid aspect-square place-items-center rounded-md border text-[11px] font-extrabold',
                selected
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-[#fafcf9] text-muted',
              )}
              key={index}
              aria-label={`Pattern square ${index + 1}${
                selected ? ', required' : ', not required'
              }`}
            >
              {isFree ? 'FREE' : selected ? '✓' : ''}
            </div>
          )
        })}
      </div>
      <p className="mt-2.5 mb-0 text-xs leading-normal text-muted">
        Match every highlighted square to call Bingo.
      </p>
    </div>
  )
}

function BingoCardFrame({
  children,
  compact = false,
  title,
}: {
  children: ReactNode
  compact?: boolean
  title: string
}) {
  return (
    <article
      className={cn(
        'min-w-0 rounded-md border-2 border-primary bg-[#fffdf7] shadow-[0_12px_28px_rgba(33,54,42,.08)]',
        compact ? 'p-2.5' : 'p-3.5',
      )}
    >
      <div
        className={cn(
          'mb-3 flex items-center justify-between rounded-sm bg-primary px-3 text-white',
          compact ? 'min-h-8' : 'min-h-10',
        )}
      >
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.14em]">
          Bingo
        </span>
        <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]">
          {title}
        </span>
      </div>
      <div className="rounded-sm border border-[#d1dfc7] bg-white p-2">
        {children}
      </div>
    </article>
  )
}

function RoundHistoryList({ history }: { history: RoundHistory[] }) {
  if (history.length === 0) return null

  return (
    <section
      className={cn(panel, 'mt-7 overflow-hidden')}
      aria-labelledby="round-history-title"
    >
      <div className="border-b border-border px-7 pt-6 pb-[18px] max-[480px]:px-5">
        <p className={cn(eyebrow, 'mb-1')}>Room results</p>
        <h2
          className="m-0 font-display text-2xl tracking-normal"
          id="round-history-title"
        >
          Game history
        </h2>
      </div>
      <ol className="m-0 list-none px-7 max-[480px]:px-5">
        {history.map((round) => (
          <li
            className="flex min-h-[78px] items-center justify-between gap-6 border-b border-[#edf1eb] py-3.5 last:border-b-0 max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-2.5"
            key={round.roundNumber}
          >
            <div className="grid gap-1">
              <span className="text-[13px] font-extrabold">
                Game {round.roundNumber}
              </span>
              <small className="text-muted">
                {round.calledNumbers.length} numbers called
              </small>
            </div>
            <div className="grid justify-items-end text-right max-[480px]:justify-items-start max-[480px]:text-left">
              <span className="text-[10px] uppercase tracking-[0.1em] text-muted">
                {round.winners.length === 1 ? 'Winner' : 'Winners'}
              </span>
              <strong className="[overflow-wrap:anywhere] text-primary">
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
    <div
      className={cn(
        'grid grid-cols-5',
        compact ? 'gap-[3px]' : 'gap-[7px] max-[480px]:gap-1',
      )}
      aria-label="Bingo card"
    >
      {'BINGO'.split('').map((letter) => (
        <div
          className={cn(
            'grid place-items-center font-display font-extrabold text-primary',
            compact ? 'h-6 text-sm' : 'h-10 text-2xl',
          )}
          key={letter}
          aria-hidden="true"
        >
          {letter}
        </div>
      ))}
      {card.map((cell, index) => {
        const automaticMark = isCellMarked(cell, calledNumbers)
        const manualMark = cell === null || (cell !== null && markedNumbers.includes(cell))
        const marked = markMode === 'automatic' ? automaticMark : manualMark
        const wrong = Boolean(
          markMode === 'manual' && cell !== null && manualMark && !automaticMark,
        )
        const className = cn(
          'grid aspect-square place-items-center border border-border bg-[#fafcf9] font-display font-bold text-text transition-[color,background,border-color,transform] duration-200',
          compact
            ? cn('rounded-[5px]', cell === null ? 'text-[5px]' : 'text-[10px]')
            : cn(
                'rounded-[10px] max-[480px]:rounded-[7px]',
                cell === null ? 'text-[7px]' : 'text-[clamp(15px,3vw,21px)]',
              ),
          !compact &&
            'hover:not-disabled:-translate-y-px hover:not-disabled:border-focus',
          marked &&
            !wrong &&
            'border-primary bg-primary text-white shadow-[inset_0_0_0_3px_rgba(255,255,255,.12)]',
          wrong &&
            'border-danger bg-danger text-white shadow-[inset_0_0_0_3px_rgba(255,255,255,.14)]',
          cell === null &&
            'tracking-normal',
        )
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

        return (
          <div
            className={className}
            key={`${index}-${cell ?? 'free'}`}
            aria-label={label}
          >
            {cell ?? 'FREE'}
          </div>
        )
      })}
    </div>
  )
}

function RoomCode({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="grid min-w-[230px] justify-items-center rounded-md border border-[#cadac4] bg-[#e8f0e1] px-7 py-[22px] max-[800px]:self-start max-[480px]:w-full">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        Room code
      </span>
      <strong className="mt-2 mb-[5px] font-display text-[32px] tracking-[0.16em]">
        {code}
      </strong>
      <button className={textButton} type="button" onClick={onCopy}>
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  )
}

function PlayersList({ players, hostUid }: { players: RoomPlayer[]; hostUid: string }) {
  const { user } = useAuth()
  return (
    <section
      className={cn(panel, 'overflow-hidden')}
      aria-labelledby="players-title"
    >
      <div className="flex items-center justify-between gap-6 border-b border-border px-[30px] py-[26px] max-[480px]:px-5">
        <div>
          <p className={cn(eyebrow, 'mb-1')}>Lobby</p>
          <h2 className="m-0 font-display text-[25px]" id="players-title">
            Players
          </h2>
        </div>
        <span className="rounded-full bg-surface-soft px-[11px] py-[7px] text-xs font-bold text-muted">
          {players.length} {players.length === 1 ? 'player' : 'players'}
        </span>
      </div>
      {players.length > 0 ? (
        <ul className="m-0 grid list-none grid-cols-1 px-[30px] py-2 min-[700px]:grid-cols-2 min-[700px]:gap-x-6 max-[480px]:px-5">
          {players.map((player) => (
            <li
              className="flex min-h-[72px] items-center gap-[13px] border-b border-[#edf1eb] last:border-b-0"
              key={player.uid}
            >
              <span className={avatar} aria-hidden="true">
                {player.username.charAt(0).toUpperCase()}
              </span>
              <strong className="min-w-0 truncate">@{player.username}</strong>
              {player.uid === hostUid && (
                <span className="rounded-full bg-[#e8f0e1] px-2 py-1 text-[11px] font-bold text-[#35614c]">
                  Host
                </span>
              )}
              <span className="ml-auto flex flex-wrap justify-end gap-1.5">
                {player.connectionState === 'offline' && (
                  <span className="rounded-full bg-[#fff9e7] px-2 py-1 text-[11px] font-bold text-[#6c5318]">
                    Offline
                  </span>
                )}
                {player.uid === user?.uid && (
                  <span className="rounded-full bg-surface-soft px-2 py-1 text-[11px] font-bold text-muted">
                    You
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-[170px] items-center justify-center gap-3 text-muted">
          <Spinner label="Waiting for players" /> Waiting for players…
        </div>
      )}
    </section>
  )
}
