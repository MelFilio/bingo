export type BingoCell = number | null
export type WinPattern = 'line' | 'four-corners' | 'full-card' | 'custom'
export type CallMode = 'manual' | 'automatic'

export interface GameSettings {
  winPattern: WinPattern
  callMode: CallMode
  callInterval: 3 | 5 | 10 | 15
  cardCount: 1 | 2 | 3
  hostPlays: boolean
  customPattern: boolean[]
}

export const defaultGameSettings: GameSettings = {
  winPattern: 'line',
  callMode: 'manual',
  callInterval: 5,
  cardCount: 1,
  hostPlays: true,
  customPattern: Array.from({ length: 25 }, (_, index) =>
    [0, 6, 12, 18, 24].includes(index),
  ),
}

function shuffle<T>(values: T[], random: () => number) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

export function createBingoCard(random = Math.random): BingoCell[] {
  const columns = Array.from({ length: 5 }, (_, column) => {
    const start = column * 15 + 1
    const range = Array.from({ length: 15 }, (_, index) => start + index)
    return shuffle(range, random).slice(0, 5)
  })

  return Array.from({ length: 25 }, (_, index) => {
    if (index === 12) return null
    const row = Math.floor(index / 5)
    const column = index % 5
    return columns[column][row]
  })
}

export function isCellMarked(cell: BingoCell, calledNumbers: number[]) {
  return cell === null || calledNumbers.includes(cell)
}

export function preserveCalledMarks(
  manualMarks: number[],
  calledNumbers: number[],
) {
  return [...new Set([...manualMarks, ...calledNumbers])]
}

export function hasBingo(
  card: BingoCell[],
  calledNumbers: number[],
  pattern: WinPattern,
  customPattern: boolean[] = [],
) {
  if (card.length !== 25) return false
  const marked = card.map((cell) => isCellMarked(cell, calledNumbers))

  if (pattern === 'four-corners') {
    return [0, 4, 20, 24].every((index) => marked[index])
  }

  if (pattern === 'full-card') {
    return marked.every(Boolean)
  }

  if (pattern === 'custom') {
    return (
      customPattern.length === 25 &&
      customPattern.some(Boolean) &&
      customPattern.every((required, index) => !required || marked[index])
    )
  }

  const lines = [
    ...Array.from({ length: 5 }, (_, row) =>
      Array.from({ length: 5 }, (_, column) => row * 5 + column),
    ),
    ...Array.from({ length: 5 }, (_, column) =>
      Array.from({ length: 5 }, (_, row) => row * 5 + column),
    ),
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ]

  return lines.some((line) => line.every((index) => marked[index]))
}

export function getBallLabel(number: number) {
  const letters = ['B', 'I', 'N', 'G', 'O']
  return `${letters[Math.floor((number - 1) / 15)]}${number}`
}
