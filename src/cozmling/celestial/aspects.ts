/* Aspects (the angles between points in a chart) and the larger shapes they make.
   The orbs are a table, so they can be tuned without touching the logic. */
import { signInfo } from '../domain/starprint'
import type { Element } from '../types'
import type { Aspect, AspectKind, BodyId, Pattern, PointId } from './types'
import { BODIES, norm360, round6 } from './zodiac'

export const ASPECTS: { kind: AspectKind; angle: number }[] = [
  { kind: 'conjunction', angle: 0 }, { kind: 'sextile', angle: 60 }, { kind: 'square', angle: 90 }, { kind: 'trine', angle: 120 }, { kind: 'opposition', angle: 180 },
]

/** The widest orb for each aspect, in degrees. */
export interface OrbRules { conjunction: number; sextile: number; square: number; trine: number; opposition: number; /** added when the Sun or Moon is involved */ luminaryBonus: number; /** the most allowed when the Rising sign or Midheaven is involved */ angleOrb: number }
export const NATAL_ORBS: OrbRules = { conjunction: 8, sextile: 4.5, square: 7, trine: 7, opposition: 8, luminaryBonus: 2, angleOrb: 5 }

/** How personal a point is, for ranking: the Sun, Moon and Rising sign matter most to a story. */
export const WEIGHT: Record<PointId, number> = {
  sun: 1, moon: 1, ascendant: 0.9, midheaven: 0.8, mercury: 0.85, venus: 0.85, mars: 0.85, jupiter: 0.7, saturn: 0.7, uranus: 0.55, neptune: 0.55, pluto: 0.55,
}
const isAngle = (p: PointId) => p === 'ascendant' || p === 'midheaven'
const isLight = (p: PointId) => p === 'sun' || p === 'moon'

/** The angle between two longitudes, 0 to 180. */
export const separation = (a: number, b: number) => { const d = norm360(b - a); return d > 180 ? 360 - d : d }

export function allowedOrb(kind: AspectKind, a: PointId, b: PointId, rules: OrbRules = NATAL_ORBS): number {
  if (isAngle(a) || isAngle(b)) return Math.min(rules[kind], rules.angleOrb)
  return rules[kind] + (isLight(a) || isLight(b) ? rules.luminaryBonus : 0)
}

export interface AspectPoint { id: PointId; lon: number; speed: number | null }

/** The aspect between two points, if they make one within its orb. */
export function aspectBetween(p: AspectPoint, q: AspectPoint, rules: OrbRules = NATAL_ORBS): Aspect | null {
  const sep = separation(p.lon, q.lon)
  for (const { kind, angle } of ASPECTS) {
    const orb = Math.abs(sep - angle), allowed = allowedOrb(kind, p.id, q.id, rules)
    if (orb > allowed) continue
    let applying: boolean | null = null
    if (p.speed != null && q.speed != null) {
      const dt = 0.01, later = Math.abs(separation(p.lon + p.speed * dt, q.lon + q.speed * dt) - angle)
      applying = later < orb
    }
    return { a: p.id, b: q.id, kind, angle, separation: round6(sep), orb: round6(orb), allowed, applying, score: round6((1 - orb / allowed) * WEIGHT[p.id] * WEIGHT[q.id]) }
  }
  return null
}

/** Every aspect among a set of points, strongest first. */
export function findAspects(points: AspectPoint[], rules: OrbRules = NATAL_ORBS): Aspect[] {
  const out: Aspect[] = []
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (isAngle(points[i].id) && isAngle(points[j].id)) continue        // the Rising sign and Midheaven are always about 90° apart: not an aspect
    const a = aspectBetween(points[i], points[j], rules)
    if (a) out.push(a)
  }
  return out.sort((x, y) => y.score - x.score || x.orb - y.orb)
}

const key = (ids: BodyId[]) => [...ids].sort((a, b) => BODIES.indexOf(a) - BODIES.indexOf(b))

/** Stelliums, grand trines, T-squares and grand crosses among the planets. */
export function findPatterns(bodies: Record<BodyId, { sign: Pattern['sign'] }>, aspects: Aspect[]): Pattern[] {
  const out: Pattern[] = []
  const has = (kind: AspectKind, a: BodyId, b: BodyId) => aspects.some(x => x.kind === kind && ((x.a === a && x.b === b) || (x.a === b && x.b === a)))
  const bodyAspects = aspects.filter(x => !isAngle(x.a) && !isAngle(x.b))

  // three or more planets in one sign
  const bySign = new Map<string, BodyId[]>()
  for (const b of BODIES) bySign.set(bodies[b].sign!, [...(bySign.get(bodies[b].sign!) ?? []), b])
  for (const [sign, ids] of bySign) if (ids.length >= 3) out.push({ kind: 'stellium', points: ids, sign: sign as Pattern['sign'] })

  // three planets all trine each other
  for (let i = 0; i < BODIES.length; i++) for (let j = i + 1; j < BODIES.length; j++) for (let k = j + 1; k < BODIES.length; k++) {
    const [a, b, c] = [BODIES[i], BODIES[j], BODIES[k]]
    if (!has('trine', a, b) || !has('trine', b, c) || !has('trine', a, c)) continue
    const els = [a, b, c].map(x => signInfo(bodies[x].sign!).element)
    const element = els.find(e => els.filter(f => f === e).length >= 2) as Element | undefined
    out.push({ kind: 'grand-trine', points: [a, b, c], ...(element ? { element } : {}) })
  }

  // two oppositions, all four squaring each other
  const opps = bodyAspects.filter(x => x.kind === 'opposition') as (Aspect & { a: BodyId; b: BodyId })[]
  const crosses: BodyId[][] = []
  for (let i = 0; i < opps.length; i++) for (let j = i + 1; j < opps.length; j++) {
    const [a, b] = [opps[i].a, opps[i].b], [c, d] = [opps[j].a, opps[j].b]
    if (new Set([a, b, c, d]).size < 4) continue
    if (has('square', a, c) && has('square', a, d) && has('square', b, c) && has('square', b, d)) crosses.push(key([a, b, c, d]))
  }
  for (const points of crosses) out.push({ kind: 'grand-cross', points })

  // an opposition with a third planet square to both (unless it is part of a grand cross)
  for (const o of opps) for (const z of BODIES) {
    if (z === o.a || z === o.b || !has('square', o.a, z) || !has('square', o.b, z)) continue
    if (crosses.some(cr => [o.a, o.b, z].every(p => cr.includes(p)))) continue
    out.push({ kind: 'T-square', points: key([o.a, o.b, z]) })
  }
  return out
}
