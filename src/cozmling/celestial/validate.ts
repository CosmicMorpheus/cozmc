/* Checking a saved birth sky before it is believed. Used when the store loads and when a save file is
   brought in. A record that fails is kept as it is and reported, never repaired. */
import { BODIES, ZODIAC } from './zodiac'

const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const lonOk = (x: unknown) => num(x) && x >= 0 && x < 360
const sign = (x: unknown) => typeof x === 'string' && (ZODIAC as string[]).includes(x)

export function celestialProblem(r: any, companionId: string): string | null {
  if (!r || typeof r !== 'object') return 'not a record'
  if (r.schema !== 1) return 'unknown version'
  if (r.companionId !== companionId) return 'belongs to another companion'
  if (r.kind !== 'birth' && r.kind !== 'awakening') return 'unknown kind'
  if (!['chosen-day-hatch-minute', 'hatch-moment', 'awakening-moment'].includes(r.rule)) return 'unknown rule'
  const m = r.moment
  if (!m || !num(m.ms) || typeof m.utc !== 'string' || new Date(m.utc).getTime() !== m.ms || typeof m.displayTimeZone !== 'string') return 'invalid moment'
  const p = r.birthplace
  if (!p || !num(p.latitude) || !num(p.longitude) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180 || typeof p.timeZone !== 'string') return 'invalid birthplace'
  if (r.engine?.name !== 'cozmc-celestial' || !num(r.engine?.version) || typeof r.engine?.libraryVersion !== 'string') return 'unknown engine'
  if (r.zodiac !== 'tropical' || r.houseSystem !== 'whole-sign') return 'unknown zodiac or houses'
  for (const b of BODIES) {
    const x = r.bodies?.[b]
    if (!x || !lonOk(x.lon) || !num(x.lat) || !sign(x.sign) || !num(x.degree) || x.degree < 0 || x.degree >= 30 || !num(x.speed) || typeof x.retrograde !== 'boolean') return `invalid ${b}`
  }
  if (r.angles !== null && (!r.angles || !lonOk(r.angles.ascendant?.lon) || !sign(r.angles.ascendant?.sign) || !lonOk(r.angles.midheaven?.lon))) return 'invalid angles'
  if (r.houses !== null && (!Array.isArray(r.houses) || r.houses.length !== 12 || !r.houses.every(sign))) return 'invalid houses'
  if (!r.moonPhase || !lonOk(r.moonPhase.angle) || !Array.isArray(r.aspects) || !Array.isArray(r.patterns) || !Array.isArray(r.omitted) || !num(r.calculatedAt)) return 'incomplete'
  return null
}
