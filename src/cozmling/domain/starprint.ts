/* ============================================================
   STARPRINT — where a Cozmling's character begins.

   The player picks a birthday for the Cozmling (not their own). The Starprint is the zodiac sign
   that birthday falls under, with its element and archetype.

   What this version does and doesn't do:
   - The sign comes from the conventional calendar dates (engine "calendar-1"). That is recorded
     on every Starprint as status 'partial', so a later, more exact engine can never quietly
     change the sign of a Cozmling that already exists.
   - There is no Moon or Rising sign yet. Those need an agreed observatory, time and ephemeris,
     and none is shown or stored until they exist.
   ============================================================ */
import type { Element, Starprint, ZodiacSign } from '../types'

export const STARPRINT_ENGINE = 'calendar-1'

export interface SignInfo { sign: ZodiacSign; name: string; glyph: string; element: Element; archetype: string; from: [number, number]; to: [number, number] }
/** The twelve identities, in calendar order from Aries. `from` and `to` are [month, day], inclusive. */
export const SIGNS: SignInfo[] = [
  { sign: 'aries', name: 'Aries', glyph: '♈', element: 'fire', archetype: 'Pathfinder', from: [3, 21], to: [4, 19] },
  { sign: 'taurus', name: 'Taurus', glyph: '♉', element: 'earth', archetype: 'Keeper', from: [4, 20], to: [5, 20] },
  { sign: 'gemini', name: 'Gemini', glyph: '♊', element: 'air', archetype: 'Messenger', from: [5, 21], to: [6, 20] },
  { sign: 'cancer', name: 'Cancer', glyph: '♋', element: 'water', archetype: 'Nurturer', from: [6, 21], to: [7, 22] },
  { sign: 'leo', name: 'Leo', glyph: '♌', element: 'fire', archetype: 'Radiant Heart', from: [7, 23], to: [8, 22] },
  { sign: 'virgo', name: 'Virgo', glyph: '♍', element: 'earth', archetype: 'Inventor', from: [8, 23], to: [9, 22] },
  { sign: 'libra', name: 'Libra', glyph: '♎', element: 'air', archetype: 'Harmonizer', from: [9, 23], to: [10, 22] },
  { sign: 'scorpio', name: 'Scorpio', glyph: '♏', element: 'water', archetype: 'Seeker', from: [10, 23], to: [11, 21] },
  { sign: 'sagittarius', name: 'Sagittarius', glyph: '♐', element: 'fire', archetype: 'Wanderer', from: [11, 22], to: [12, 21] },
  { sign: 'capricorn', name: 'Capricorn', glyph: '♑', element: 'earth', archetype: 'Builder', from: [12, 22], to: [1, 19] },
  { sign: 'aquarius', name: 'Aquarius', glyph: '♒', element: 'air', archetype: 'Visionary', from: [1, 20], to: [2, 18] },
  { sign: 'pisces', name: 'Pisces', glyph: '♓', element: 'water', archetype: 'Dreamer', from: [2, 19], to: [3, 20] },
]
export const signInfo = (sign: ZodiacSign) => SIGNS.find(s => s.sign === sign)!

/** Each element's orb: one sphere blending two colours. */
export const ELEMENTS: Record<Element, { name: string; orb: [string, string] }> = {
  fire: { name: 'Fire', orb: ['#ffa53c', '#c4201f'] },        // glowing orange with rich red
  earth: { name: 'Earth', orb: ['#3fe08a', '#0e5a34'] },      // luminous emerald with deep forest green
  air: { name: 'Air', orb: ['#fdfcf3', '#fff2a8'] },          // pearly white with very pale yellow
  water: { name: 'Water', orb: ['#2f86e6', '#0a1f5e'] },      // ocean blue with deep navy
}

/** A real calendar date written YYYY-MM-DD, or null. */
export function parseBirthday(s: string): { y: number; m: number; d: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!hit) return null
  const y = +hit[1], m = +hit[2], d = +hit[3]
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1) return null
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return d <= days[m - 1] ? { y, m, d } : null
}

/** The sign a birthday falls under, by the conventional calendar dates. */
export function signFor(birthday: string): SignInfo | null {
  const b = parseBirthday(birthday)
  if (!b) return null
  const at = b.m * 100 + b.d
  return SIGNS.find(s => {
    const from = s.from[0] * 100 + s.from[1], to = s.to[0] * 100 + s.to[1]
    return from <= to ? at >= from && at <= to : at >= from || at <= to      // Capricorn runs over the new year
  }) ?? null
}

export function starprintFor(birthday: string): Starprint | null {
  const s = signFor(birthday)
  return s ? { chosenBirthday: birthday, coreSign: s.sign, element: s.element, archetype: s.archetype, status: 'partial', engineVersion: STARPRINT_ENGINE } : null
}

/** "November 5" (the year is part of the birthday but isn't what makes the sign). */
export function birthdayText(birthday: string): string {
  const b = parseBirthday(birthday)
  return b ? `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][b.m - 1]} ${b.d}` : ''
}
