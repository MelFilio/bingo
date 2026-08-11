const roomCodeCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const roomCodeLength = 6

export function generateRoomCode(random = Math.random) {
  return Array.from({ length: roomCodeLength }, () => {
    const index = Math.floor(random() * roomCodeCharacters.length)
    return roomCodeCharacters[index]
  }).join('')
}

export function normalizeRoomCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, roomCodeLength)
}

export function isValidRoomCode(value: string) {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(value)
}
