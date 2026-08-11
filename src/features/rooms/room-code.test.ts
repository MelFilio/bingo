import { describe, expect, it } from 'vitest'
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from './room-code'

describe('room codes', () => {
  it('generates a six-character readable code', () => {
    expect(generateRoomCode(() => 0)).toBe('AAAAAA')
    expect(isValidRoomCode(generateRoomCode(() => 0.5))).toBe(true)
  })

  it('normalizes pasted room codes', () => {
    expect(normalizeRoomCode(' ab-cd 29 ')).toBe('ABCD29')
  })

  it('rejects ambiguous and incorrectly sized codes', () => {
    expect(isValidRoomCode('ABCD')).toBe(false)
    expect(isValidRoomCode('ABCD10')).toBe(false)
  })
})
