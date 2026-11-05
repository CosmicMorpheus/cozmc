/* Where Adrift keeps today's mission: this browser's storage, under one key. */
import { dayAt, valid, type Session } from './engine'

export const ADRIFT_KEY = 'cozmc:adrift:v1'

export function readSaved(): Session | null {
  const raw = localStorage.getItem(ADRIFT_KEY)
  if (!raw) return null
  const s = JSON.parse(raw)
  if (!valid(s)) throw new Error('Invalid saved mission')
  return s
}

/** Today's result in this browser, for the arcade cabinet ('none' if not played today). */
export function adriftToday(): 'none' | 'playing' | 'won' | 'lost' {
  try { const s = readSaved(); return s && s.day === dayAt() ? s.status : 'none' } catch { return 'none' }
}
