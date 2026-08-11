# Multiplayer Bingo Game Specification

## Scope

Implement a real-time, multiplayer 75-ball bingo game on top of the existing
Firebase room lobby. This first version supports one active round per room,
automatic card generation, host-controlled number calling, live card updates,
and one verified winner.

## Core rules

- The game uses numbers 1–75 and a standard 5×5 `B I N G O` card.
- Column ranges are B: 1–15, I: 16–30, N: 31–45, G: 46–60, O: 61–75.
- Each column contains five unique values from its range.
- The center square is free and is treated as marked from the start.
- Each authenticated player receives the host-selected number of cards when
  they create or join a room.
- A called number is never repeated.
- Cards mark called values automatically so all clients remain synchronized.
- Each player can switch between automatic and manual marking during a round.
- In manual mode, uncalled selections are visibly flagged as wrong and do not
  count toward a valid Bingo.
- A player may claim Bingo when any one of their cards satisfies the room's
  pattern.
- The first successful claim ends the round and records every player whose card
  has a valid Bingo at that moment as a winner.

## Host settings

The host configures the round while the room is waiting:

### Win pattern

- **Any line:** Any complete horizontal, vertical, or diagonal line.
- **Four corners:** All four corner squares.
- **Full card:** Every non-free square.
- **Custom:** The exact cells selected by the host in a 5×5 pattern editor.

### Calling mode

- **Manual:** The host presses “Call next number.”
- **Automatic:** The app calls numbers at a host-selected interval.

During an active round, the host may switch between manual and automatic mode
and pause or resume calling. Pausing blocks timer-driven and manual calls until
the host resumes.

Automatic intervals: 5, 10, or 15 seconds. The default is manual mode with an
interval value of 10 seconds retained for later switching.

### Cards per player

- The host selects 1, 2, or 3 cards per player.
- Settings persist while waiting so every player sees the required card count.
- Each player may reroll their complete card set while the room is waiting.
- After the host changes the card count, every player must reroll before the
  round can start.

## Room lifecycle

```text
waiting → playing → finished
```

- `waiting`: Players may join. The host may edit settings and start the game.
- `playing`: New players may join a waiting list for the next game. Active
  players may claim Bingo and numbers may be called.
- `finished`: Number calling stops and the winners are shown to everyone. The
  host may restart after confirming, returning the room to `waiting`.
- Closing a waiting or finished room removes its room and player documents.

The host may start with at least one player so local testing is possible.

## Firestore model

```text
rooms/{roomCode}
  code: string
  hostUid: string
  hostUsername: string
  status: "waiting" | "playing" | "finished"
  settings:
    winPattern: "line" | "four-corners" | "full-card" | "custom"
    callMode: "manual" | "automatic"
    callInterval: 5 | 10 | 15
    cardCount: 1 | 2 | 3
    customPattern: boolean[] // 25 cells
  calledNumbers: number[]
  currentNumber: number | null
  callingPaused: boolean
  winnerUid: string | null
  winnerUsername: string | null
  winners: { uid: string, username: string }[]
  roundNumber: number
  createdAt: timestamp
  updatedAt: timestamp
  startedAt?: timestamp
  finishedAt?: timestamp

rooms/{roomCode}/players/{uid}
  uid: string
  username: string
  status: "active" | "waiting"
  cards: [
    { cells: (number | null)[] } // each card has 25 cells
  ]
  joinedAt: timestamp

rooms/{roomCode}/rounds/{roundNumber}
  roundNumber: number
  winners: { uid: string, username: string }[]
  calledNumbers: number[]
  settings: GameSettings
  completedAt: timestamp
```

The room document is the shared source of truth for calls, settings, status,
and winner. Player cards are persisted so refreshes and reconnects keep the
same card.

## Real-time behavior

- Every room client subscribes to the room and its players collection.
- A number call uses a Firestore transaction to read the latest called list,
  choose from remaining numbers, and append exactly one number.
- In automatic mode, only the host schedules calls. Transactions prevent two
  overlapping timer events from repeating a number.
- Automatic mode derives marks from `calledNumbers`. Manual selections and the
  player's marking mode persist in browser storage by room and round, avoiding
  a Firestore write for every tap.
- Refreshing a room URL restores the same lobby or game.

## Win validation

Win detection is a pure shared function used to control the claim button and
rechecked inside the claim transaction against fresh Firestore data.

- `line`: Check five rows, five columns, and two diagonals.
- `four-corners`: Check indices 0, 4, 20, and 24.
- `full-card`: Check all 24 numbered cells; the center is always marked.
- `custom`: Check every cell selected in `settings.customPattern`.

This client-only version protects normal gameplay and rejects stale claims.
For adversarial or prize-bearing games, move draw and claim validation to a
trusted Cloud Function because client code can be modified by a malicious user.

## Permissions

- Any signed-in user may read a room by code so they can join it.
- A player may create only their own player document, using the username on
  their profile. Mid-game joiners receive `waiting` status.
- Room settings, lifecycle, and number calls are host-controlled.
- A participant may write only the winner fields when claiming for themselves.
- Players may replace only their own cards, and only while the room is waiting.
- A player may leave their own room membership; the host may remove all players
  when closing the room.

## UI states

### Waiting lobby

- Shareable room code and live player list.
- Host settings panel with pattern, call mode, and interval.
- Host-only “Start game” primary action.
- Player-owned card previews and a “Reroll cards” action.
- Non-host message explaining that the host controls the start.

### Active game

- Most recently called number, total calls, and recent call history.
- Player's responsive 5×5 cards with `B I N G O` headers and automatic marks.
- A player-owned manual/automatic marking toggle and wrong-mark feedback.
- Host manual call action or automatic countdown/status.
- Live host controls for manual/automatic mode and pause/resume.
- Mid-game joiners see a next-game waiting view and are promoted on restart.
- Bingo claim action, disabled until the configured pattern is complete.
- Live player list retained as secondary context.

### Finished game

- Winner announcement shown to every participant.
- Round history listing Game 1 winners, Game 2 winners, and later results.
- Winning card remains visible.
- Host can restart everyone into the lobby after confirming, or close the room.

## Error and recovery behavior

- Invalid or unavailable rooms return users to a clear recovery screen.
- Failed calls, starts, and claims preserve current room state and show an
  inline error.
- Buttons prevent duplicate submissions.
- Reconnects rely on Firestore snapshots to restore authoritative state.

## Completion checks

1. Create and join flows generate valid, persistent cards.
2. Host settings persist when the round starts.
3. Manual and automatic calls never repeat a number.
4. All connected clients reflect calls and winner changes in real time.
5. Each win pattern is covered by unit tests.
6. Firestore rules match the new room and player schemas.
7. Keyboard, mobile layout, reduced motion, lint, tests, and build pass.
