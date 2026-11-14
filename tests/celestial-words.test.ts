/* The sky words, read as the game puts them together: every placement, aspect, pattern, Moon phase,
   transit and planet-today reading, for every sign, house and kind of aspect, comes out as complete
   sentences with nothing left unfilled, and never as a forecast. The ten "today" fragments are framed
   as story symbolism. Wording from the COZMC zodiac writing review (November 13, 2026). `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const I = await import('../src/cozmling/celestial/interpret')
const { castChart } = await import('../src/cozmling/celestial/chart')
const { ZODIAC } = await import('../src/cozmling/celestial/zodiac')
import type { BodyId, PointId, AspectKind } from '../src/cozmling/celestial/types'

const BODIES: BodyId[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
const POINTS: PointId[] = [...BODIES, 'ascendant', 'midheaven']
const KINDS: AspectKind[] = ['conjunction', 'sextile', 'square', 'trine', 'opposition']
const TODAY_FRAGMENTS = ['today’s mood', 'today’s light', 'today’s ideas and conversations', 'today’s warmth and fondness', 'today’s energy and courage', 'this season’s growth', 'this season’s lessons', 'these years’ surprises', 'these years’ dreams', 'these years’ deep changes']

/** A line reads as finished sentences: a capital first, a full stop last, every placeholder filled, no forecast. */
function sentences(line: string, where: string) {
  assert.match(line, /^[A-Z0-9]/, `${where}: starts mid-sentence: ${line}`)
  assert.match(line, /[.!?]$/, `${where}: doesn’t end as a sentence: ${line}`)
  assert.doesNotMatch(line, /\{|\}|undefined|NaN|null|\s{2}|\s[,.:;]|\.\.|,,/, `${where}: ${line}`)
  assert.doesNotMatch(line, /\b(will|always|destined|guarantee[sd]?|must)\b/i, `${where}: ${line}`)
  for (const s of line.split(/(?<=[.!?])\s+/)) assert.match(s, /^[A-Z0-9“]/, `${where}: a sentence starts in lower case: ${s}`)
}

test('every birth-sky reading is complete sentences, for many charts', () => {
  let n = 0
  for (let k = 0; k < 40; k++) {
    const ms = Date.parse('2026-01-01T00:00:00Z') + k * 9.37 * 86_400_000
    const c = castChart({ companionId: `test-words-${k}`, kind: 'birth', rule: 'hatch-moment', ms, birthday: null, hatchedAt: ms, displayTimeZone: 'UTC', calculatedAt: ms })
    for (const p of POINTS) for (const l of I.placementReading(c, 'Orbi', p).lines) { sentences(l, `${p} k${k}`); n++ }
    for (const a of c.aspects) for (const l of I.aspectReading(a).lines) { sentences(l, `aspect k${k}`); n++ }
    for (const p of c.patterns) for (const l of I.patternReading(p).lines) { sentences(l, `${p.kind} k${k}`); n++ }
    for (const l of I.moonPhaseReading(c, 'Orbi').lines) { sentences(l, `moon phase k${k}`); n++ }
  }
  // every chart pattern, whether or not those charts had one
  for (const p of [{ kind: 'stellium', points: ['sun', 'mercury', 'venus'], sign: 'leo' }, { kind: 'grand-trine', points: ['sun', 'moon', 'mars'], element: 'fire' }, { kind: 'T-square', points: ['sun', 'moon', 'saturn'] }, { kind: 'grand-cross', points: ['sun', 'moon', 'mars', 'saturn'] }] as any[])
    for (const l of I.patternReading(p).lines) { sentences(l, p.kind); n++ }
  assert.match(I.patternReading({ kind: 'T-square', points: ['sun', 'moon', 'saturn'] }).lines[0], /^Sun and Moon face each other across the chart and both form squares with Saturn\. This can suggest a tension worth looking at from different sides\.$/)
  sentences(I.DISCLAIMER, 'disclaimer')
  assert.ok(n > 1000)
})

test('the ten “today” fragments, in both places they are used, as story symbolism', () => {
  const today = new Set<string>()
  for (const b of BODIES) for (const sign of ZODIAC) for (const house of [null, 1, 6, 8, 12]) for (const on of [undefined, 'Friday, November 13']) for (const retrograde of [false, true]) {
    const r = I.todayPlacementReading(b, { sign, degree: 12.5, retrograde }, house, 'Orbi', on)
    r.lines.forEach((l, i) => sentences(l, `${b} in ${sign}${on ? ' then' : ''}#${i}`))
    const m = /This sky symbol can bring (.+?) to mind\. In (\w+), that may (have )?come across as /.exec(r.lines[0])
    assert.ok(m, r.lines[0]); assert.equal(m![2], sign[0].toUpperCase() + sign.slice(1)); assert.equal(!!m![3], !!on)
    today.add(m![1].replace('that day’s', 'today’s'))
  }
  assert.deepEqual([...today].sort(), [...TODAY_FRAGMENTS].sort())
  // a transit: the planet's fragment alongside the point's
  for (const a of BODIES) for (const b of POINTS) for (const kind of KINDS) for (const on of [undefined, 'Friday, November 13']) {
    const t = { a, b, kind, angle: 0, separation: 0, orb: 1.2, maxOrb: 3, applying: true, exactAt: on ? null : Date.parse('2026-11-13T20:04:00Z') } as any
    const r = I.transitReading(t, 'Orbi', 'America/New_York', on)
    r.lines.forEach((l, i) => sentences(l, `${a} ${kind} ${b}${on ? ' then' : ''}#${i}`))
    assert.match(r.lines[0], on ? /^On Friday, November 13, \S+( \S+)? (met|formed a sextile with|formed a square with|flowed with|stood opposite) Orbi’s [\w ]+\. This sky symbol can bring (that day’s|this season’s|these years’) /u : /^Today .+ (meets|forms a sextile with|forms a square with|flows with|stands opposite) Orbi’s [\w ]+\. This sky symbol can bring /)
  }
  assert.equal(I.transitReading({ a: 'mars', b: 'moon', kind: 'square', angle: 90, separation: 91, orb: 1, maxOrb: 3, applying: true, exactAt: null } as any, 'Orbi', 'America/New_York').lines[0],
    'Today Mars forms a square with Orbi’s Moon. This sky symbol can bring today’s energy and courage to mind, alongside its feelings: a tension that can invite a fresh approach.')
})

test('the wording from the zodiac review is what the game shows', () => {
  assert.equal(I.TONE.scorpio, 'thoughtful, deeply curious and loyal'); assert.equal(I.TONE.aquarius, 'inventive, independent and open to friendship')
  assert.equal(I.HOUSE[5], 'daily routines, care and small tasks'); assert.equal(I.HOUSE[7], 'trust, sharing and meeting change together')
  assert.equal(I.ASPECT_WORDS.square.phrase, 'a tension that can invite a fresh approach')
  assert.equal(I.DISCLAIMER, 'These sky readings offer symbols for a Cozmling’s voice. Its story unfolds through shared experiences and the choices you make together.')
})
