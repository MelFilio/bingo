import { describe, expect, it } from 'vitest'
import {
  createBingoCard,
  getBallLabel,
  hasBingo,
  preserveCalledMarks,
} from './bingo'

const card = [
  1, 16, 31, 46, 61,
  2, 17, 32, 47, 62,
  3, 18, null, 48, 63,
  4, 19, 34, 49, 64,
  5, 20, 35, 50, 65,
]

describe('bingo mechanics', () => {
  it('creates a valid card with a free center and correct column ranges', () => {
    const generated = createBingoCard(() => 0.25)
    expect(generated).toHaveLength(25)
    expect(generated[12]).toBeNull()

    for (let column = 0; column < 5; column += 1) {
      const values = generated.filter((_, index) => index % 5 === column)
      const numbers = values.filter((value): value is number => value !== null)
      expect(new Set(numbers).size).toBe(numbers.length)
      expect(numbers.every((value) => value >= column * 15 + 1)).toBe(true)
      expect(numbers.every((value) => value <= column * 15 + 15)).toBe(true)
    }
  })

  it('detects horizontal, vertical, and diagonal lines', () => {
    expect(hasBingo(card, [1, 16, 31, 46, 61], 'line')).toBe(true)
    expect(hasBingo(card, [16, 17, 18, 19, 20], 'line')).toBe(true)
    expect(hasBingo(card, [1, 17, 49, 65], 'line')).toBe(true)
    expect(hasBingo(card, [1, 17, 46], 'line')).toBe(false)
  })

  it('detects four corners', () => {
    expect(hasBingo(card, [1, 61, 5, 65], 'four-corners')).toBe(true)
    expect(hasBingo(card, [1, 61, 5], 'four-corners')).toBe(false)
  })

  it('detects a full card while treating the center as free', () => {
    const allNumbers = card.filter((value): value is number => value !== null)
    expect(hasBingo(card, allNumbers, 'full-card')).toBe(true)
    expect(hasBingo(card, allNumbers.slice(1), 'full-card')).toBe(false)
  })

  it('detects a host-defined custom pattern', () => {
    const customPattern = Array.from({ length: 25 }, (_, index) =>
      [0, 4, 12, 20, 24].includes(index),
    )

    expect(hasBingo(card, [1, 61, 5, 65], 'custom', customPattern)).toBe(true)
    expect(hasBingo(card, [1, 61, 5], 'custom', customPattern)).toBe(false)
  })

  it('formats called balls with their bingo letter', () => {
    expect(getBallLabel(1)).toBe('B1')
    expect(getBallLabel(75)).toBe('O75')
  })

  it('preserves called numbers when switching to manual marks', () => {
    expect(preserveCalledMarks([7, 18], [18, 42])).toEqual([7, 18, 42])
  })
})
