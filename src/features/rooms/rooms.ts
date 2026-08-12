import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type FirestoreError,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../../lib/firebase'
import {
  createBingoCard,
  defaultGameSettings,
  hasBingo,
  type BingoCell,
  type GameSettings,
} from '../game/bingo'
import { generateRoomCode } from './room-code'

export interface Room {
  code: string
  hostUid: string
  hostUsername: string
  status: 'waiting' | 'playing' | 'finished'
  settings: GameSettings
  calledNumbers: number[]
  currentNumber: number | null
  callingPaused: boolean
  winnerUid: string | null
  winnerUsername: string | null
  winners: RoomWinner[]
  roundNumber: number
}

export interface RoomWinner {
  uid: string
  username: string
}

export interface RoundHistory {
  roundNumber: number
  winners: RoomWinner[]
  calledNumbers: number[]
  settings: GameSettings
}

export interface RoomPlayer {
  uid: string
  username: string
  cards: PlayerCard[]
  status: 'active' | 'waiting'
}

export interface PlayerCard {
  cells: BingoCell[]
}

export class RoomError extends Error {
  constructor(
    public readonly code:
      | 'not-found'
      | 'not-open'
      | 'code-generation'
      | 'not-host'
      | 'not-playing'
      | 'invalid-claim'
      | 'finished',
  ) {
    super(code)
  }
}

interface PlayerIdentity {
  uid: string
  username: string
}

function createCards(count: GameSettings['cardCount']) {
  return Array.from({ length: count }, () => ({ cells: createBingoCard() }))
}

export async function createRoom(player: PlayerIdentity) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRoomCode()
    const roomRef = doc(db, 'rooms', code)
    const playerRef = doc(roomRef, 'players', player.uid)

    const created = await runTransaction(db, async (transaction) => {
      const roomSnapshot = await transaction.get(roomRef)
      if (roomSnapshot.exists()) return false

      transaction.set(roomRef, {
        code,
        hostUid: player.uid,
        hostUsername: player.username,
        status: 'waiting',
        settings: defaultGameSettings,
        calledNumbers: [],
        currentNumber: null,
        callingPaused: false,
        winnerUid: null,
        winnerUsername: null,
        winners: [],
        roundNumber: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      transaction.set(playerRef, {
        uid: player.uid,
        username: player.username,
        cards: createCards(defaultGameSettings.cardCount),
        status: 'active',
        joinedAt: serverTimestamp(),
      })
      return true
    })

    if (created) return code
  }

  throw new RoomError('code-generation')
}

export async function joinRoom(code: string, player: PlayerIdentity) {
  const roomRef = doc(db, 'rooms', code)
  const playerRef = doc(roomRef, 'players', player.uid)

  await runTransaction(db, async (transaction) => {
    const [roomSnapshot, playerSnapshot] = await Promise.all([
      transaction.get(roomRef),
      transaction.get(playerRef),
    ])

    if (!roomSnapshot.exists()) throw new RoomError('not-found')
    if (playerSnapshot.exists()) return
    const room = roomSnapshot.data() as Room

    transaction.set(playerRef, {
      uid: player.uid,
      username: player.username,
      cards: createCards(
        room.settings?.cardCount ?? 1,
      ),
      status: room.status === 'waiting' ? 'active' : 'waiting',
      joinedAt: serverTimestamp(),
    })
  })
}

export async function startGame(
  code: string,
  hostUid: string,
  settings: GameSettings,
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status !== 'waiting') throw new RoomError('not-open')

    transaction.update(roomRef, {
      settings,
      status: 'playing',
      callingPaused: false,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
}

export async function updateGameSettings(
  code: string,
  hostUid: string,
  settings: GameSettings,
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status !== 'waiting') throw new RoomError('not-open')
    transaction.update(roomRef, { settings, updatedAt: serverTimestamp() })
  })
}

export async function updateCallControls(
  code: string,
  hostUid: string,
  changes: Pick<GameSettings, 'callMode' | 'callInterval'>,
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status !== 'playing') throw new RoomError('not-playing')

    transaction.update(roomRef, {
      settings: { ...room.settings, ...changes },
      updatedAt: serverTimestamp(),
    })
  })
}

export async function setCallingPaused(
  code: string,
  hostUid: string,
  callingPaused: boolean,
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status !== 'playing') throw new RoomError('not-playing')
    transaction.update(roomRef, { callingPaused, updatedAt: serverTimestamp() })
  })
}

export async function rerollCards(code: string, playerUid: string) {
  const roomRef = doc(db, 'rooms', code)
  const playerRef = doc(roomRef, 'players', playerUid)
  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) throw new RoomError('not-found')
    const room = roomSnapshot.data() as Room
    if (room.status !== 'waiting') throw new RoomError('not-open')
    transaction.update(playerRef, {
      cards: createCards(room.settings.cardCount),
    })
  })
}

export async function restartGame(
  code: string,
  hostUid: string,
  playerUids: string[],
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status === 'waiting') throw new RoomError('not-open')
    transaction.update(roomRef, {
      status: 'waiting',
      calledNumbers: [],
      currentNumber: null,
      callingPaused: false,
      winnerUid: null,
      winnerUsername: null,
      winners: [],
      roundNumber:
        room.status === 'finished' ? (room.roundNumber ?? 1) + 1 : room.roundNumber,
      updatedAt: serverTimestamp(),
    })
    for (const playerUid of playerUids) {
      transaction.update(doc(roomRef, 'players', playerUid), {
        status: 'active',
      })
    }
  })
}

function randomIndex(maximum: number) {
  const values = new Uint32Array(1)
  crypto.getRandomValues(values)
  return values[0] % maximum
}

export async function callNextNumber(code: string, hostUid: string) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new RoomError('not-found')
    const room = snapshot.data() as Room
    if (room.hostUid !== hostUid) throw new RoomError('not-host')
    if (room.status !== 'playing') throw new RoomError('not-playing')
    if (room.callingPaused) throw new RoomError('not-playing')

    const remaining = Array.from({ length: 75 }, (_, index) => index + 1).filter(
      (number) => !room.calledNumbers.includes(number),
    )
    if (remaining.length === 0) throw new RoomError('finished')
    const number = remaining[randomIndex(remaining.length)]

    transaction.update(roomRef, {
      calledNumbers: [...room.calledNumbers, number],
      currentNumber: number,
      updatedAt: serverTimestamp(),
    })
  })
}

export async function claimBingo(
  code: string,
  player: PlayerIdentity,
  playerUids: string[],
) {
  const roomRef = doc(db, 'rooms', code)
  await runTransaction(db, async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists()) throw new RoomError('not-found')
    const room = roomSnapshot.data() as Room
    if (room.status !== 'playing') throw new RoomError('not-playing')

    const playerSnapshots = await Promise.all(
      playerUids.map((uid) =>
        transaction.get(doc(roomRef, 'players', uid)),
      ),
    )
    const roomPlayers = playerSnapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => snapshot.data() as RoomPlayer)
      .filter((roomPlayer) => roomPlayer.status !== 'waiting')
      .filter((roomPlayer) => room.settings.hostPlays || roomPlayer.uid !== room.hostUid)
    const claimant = roomPlayers.find((roomPlayer) => roomPlayer.uid === player.uid)

    if (!claimant) throw new RoomError('not-found')

    function playerHasBingo(roomPlayer: RoomPlayer) {
      return roomPlayer.cards.some((card) =>
        hasBingo(
          card.cells,
          room.calledNumbers,
          room.settings.winPattern,
          room.settings.customPattern,
        ),
      )
    }

    if (!playerHasBingo(claimant)) throw new RoomError('invalid-claim')

    const winners = roomPlayers
      .filter(playerHasBingo)
      .map(({ uid, username }) => ({ uid, username }))
    const roundNumber = room.roundNumber ?? 1
    const roundRef = doc(roomRef, 'rounds', String(roundNumber))

    transaction.update(roomRef, {
      status: 'finished',
      winnerUid: player.uid,
      winnerUsername: player.username,
      winners,
      finishedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    transaction.set(roundRef, {
      roundNumber,
      winners,
      calledNumbers: room.calledNumbers,
      settings: room.settings,
      completedAt: serverTimestamp(),
    })
  })
}

export function subscribeToRoom(
  code: string,
  onRoom: (room: Room | null) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'rooms', code),
    (snapshot) => {
      if (!snapshot.exists()) {
        onRoom(null)
        return
      }

      const data = snapshot.data()
      const storedSettings = data.settings as Partial<GameSettings> | undefined
      onRoom({
        ...data,
        settings: {
          ...defaultGameSettings,
          ...storedSettings,
          customPattern:
            storedSettings?.customPattern ?? defaultGameSettings.customPattern,
        },
        calledNumbers: data.calledNumbers ?? [],
        currentNumber: data.currentNumber ?? null,
        callingPaused: data.callingPaused ?? false,
        winnerUid: data.winnerUid ?? null,
        winnerUsername: data.winnerUsername ?? null,
        winners:
          data.winners ??
          (data.winnerUid
            ? [{ uid: data.winnerUid, username: data.winnerUsername }]
            : []),
        roundNumber: data.roundNumber ?? 1,
      } as Room)
    },
    onError,
  )
}

export function subscribeToRoundHistory(
  code: string,
  onHistory: (history: RoundHistory[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const historyQuery = query(
    collection(db, 'rooms', code, 'rounds'),
    orderBy('roundNumber', 'desc'),
  )
  return onSnapshot(
    historyQuery,
    (snapshot) =>
      onHistory(snapshot.docs.map((round) => round.data() as RoundHistory)),
    onError,
  )
}

export function subscribeToPlayers(
  code: string,
  onPlayers: (players: RoomPlayer[]) => void,
  onError: (error: FirestoreError) => void,
): Unsubscribe {
  const playersQuery = query(
    collection(db, 'rooms', code, 'players'),
    orderBy('joinedAt', 'asc'),
  )

  return onSnapshot(
    playersQuery,
    (snapshot) => {
      onPlayers(
        snapshot.docs.map((player) => {
          const data = player.data()
          const legacyCard = data.card as BingoCell[] | undefined
          return {
            ...data,
            cards:
              data.cards ?? (legacyCard ? [{ cells: legacyCard }] : []),
            status: data.status ?? 'active',
          } as RoomPlayer
        }),
      )
    },
    onError,
  )
}

export async function leaveRoom(
  code: string,
  uid: string,
  isHost: boolean,
  playerUids: string[],
  roundNumbers: number[],
) {
  if (!isHost) {
    await deleteDoc(doc(db, 'rooms', code, 'players', uid))
    return
  }

  const batch = writeBatch(db)
  for (const playerUid of playerUids) {
    batch.delete(doc(db, 'rooms', code, 'players', playerUid))
  }
  for (const roundNumber of roundNumbers) {
    batch.delete(doc(db, 'rooms', code, 'rounds', String(roundNumber)))
  }
  batch.delete(doc(db, 'rooms', code))
  await batch.commit()
}
