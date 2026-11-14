/* The living sky: today's planets and how they meet a Cozmling's birth chart. `npm test`.
   Days follow the player's own clock; a day's report is one fixed thing; nothing is random. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { castChart } = await import('../src/cozmling/celestial/chart')
const { birthMoment } = await import('../src/cozmling/celestial/observatory')
const { readDaily, skyAt } = await import('../src/cozmling/celestial/transits')
const { dailyScore, dayBounds, dayText, nextMidnight, reportIsCurrent, reportIsFor, TRANSIT_ORBS } = await import('../src/cozmling/celestial/daily')
const { aspectBetween } = await import('../src/cozmling/celestial/aspects')
const { astronomyEngine } = await import('../src/cozmling/celestial/ephemeris')
const { transitReading, todayHeadline, skyNotes, todayPlacementReading } = await import('../src/cozmling/celestial/interpret')
const { signAt, BODIES } = await import('../src/cozmling/celestial/zodiac')
import type { BodyId } from '../src/cozmling/celestial/types'

const at = (iso: string) => new Date(iso).getTime()
const NY = 'America/New_York'
const chart = (id: string, birthday: string, hatchedAt: number) => castChart({ companionId: id, kind: 'birth', rule: 'chosen-day-hatch-minute', ms: birthMoment(birthday, hatchedAt)!, birthday, hatchedAt, displayTimeZone: NY, calculatedAt: 0 })
const orbi = chart('test-000001', '2026-05-05', at('2026-11-13T01:14:30Z'))
const kip = chart('test-000002', '2026-11-05', at('2026-11-13T07:40:00Z'))
const strip = (r: any) => ({ ...r, calculatedAt: 0 })

test('today’s sky uses exactly the same astronomy and zodiac as a birth chart', () => {
  const ms = at('2026-11-13T17:00:00Z'), now = skyAt(ms)
  const same = castChart({ companionId: 'test-000003', kind: 'birth', rule: 'hatch-moment', ms, birthday: null, hatchedAt: ms, displayTimeZone: NY, calculatedAt: 0 })
  for (const b of BODIES) { assert.equal(now.bodies[b].lon, same.bodies[b].lon, b); assert.equal(now.bodies[b].retrograde, same.bodies[b].retrograde, b) }
  assert.equal(now.moonPhase.name, same.moonPhase.name)
})

test('a day’s report is one fixed thing all day, and a new day begins at the player’s own midnight', () => {
  const early = readDaily(orbi, { timeZone: NY, now: at('2026-11-13T06:00:00Z') })     // 1:00 am in New York
  const late = readDaily(orbi, { timeZone: NY, now: at('2026-11-14T04:59:59Z') })      // 11:59:59 pm, the same day
  assert.equal(early.day, '2026-11-13'); assert.deepEqual(strip(early), strip(late))
  assert.equal(early.at, at('2026-11-13T17:00:00Z'), 'read for midday in New York')
  const next = readDaily(orbi, { timeZone: NY, now: at('2026-11-14T05:00:00Z') })      // midnight: a new day
  assert.equal(next.day, '2026-11-14'); assert.notDeepEqual(next.sky.moon, early.sky.moon)
  assert.equal(nextMidnight(at('2026-11-13T06:00:00Z'), NY), at('2026-11-14T05:00:00Z'))
  // the same moment is a different day elsewhere
  assert.equal(readDaily(orbi, { timeZone: 'Asia/Kolkata', now: at('2026-11-13T20:00:00Z') }).day, '2026-11-14')
  assert.equal(readDaily(orbi, { timeZone: 'Pacific/Honolulu', now: at('2026-11-13T08:00:00Z') }).day, '2026-11-12')
})

test('days follow the player’s clock through daylight saving', () => {
  const spring = dayBounds('2026-03-08', NY), autumn = dayBounds('2026-11-01', NY), plain = dayBounds('2026-11-13', NY)
  assert.equal(spring.end + 1000 - spring.start, 23 * 3_600_000)
  assert.equal(autumn.end + 1000 - autumn.start, 25 * 3_600_000)
  assert.equal(plain.end + 1000 - plain.start, 24 * 3_600_000)
  assert.equal(spring.noon, at('2026-03-08T16:00:00Z'), 'midday after the clocks go forward')
  assert.equal(autumn.noon, at('2026-11-01T17:00:00Z'), 'midday after the clocks go back')
  assert.equal(nextMidnight(at('2026-03-08T06:30:00Z'), NY), at('2026-03-09T04:00:00Z'))
  const k = dayBounds('2026-11-13', 'Pacific/Kiritimati')
  assert.equal(k.start, at('2026-11-12T10:00:00Z'))
})

test('transits only count what is close, and a day’s fast movers come first', () => {
  const P = (id: BodyId, lon: number, speed = 1) => ({ id, lon, speed })
  const N = (id: any, lon: number) => ({ id, lon, speed: 0 })
  assert.equal(aspectBetween(P('mars', 0), N('venus', 123.5), TRANSIT_ORBS), null)            // 3.5° off a trine: too wide for a day
  assert.equal(aspectBetween(P('mars', 0), N('venus', 122.9), TRANSIT_ORBS)?.kind, 'trine')
  assert.equal(aspectBetween(P('moon', 0, 13), N('venus', 3.9), TRANSIT_ORBS)?.kind, 'conjunction')   // the Moon gets a little more
  assert.equal(aspectBetween(P('mars', 0), N('ascendant', 2.5), TRANSIT_ORBS), null)        // the angles, a little less
  const moon = { ...aspectBetween(P('moon', 0, 13), N('sun', 1), TRANSIT_ORBS)!, a: 'moon' as BodyId }
  const saturn = { ...aspectBetween(P('saturn', 0, 0.05), N('sun', 1), TRANSIT_ORBS)!, a: 'saturn' as BodyId }
  assert.ok(dailyScore(moon) > dailyScore(saturn), 'at the same distance, the Moon is the day’s news')
  assert.equal(moon.applying, true, 'the birth chart stands still; only today’s planet moves')
})

test('two Cozmlings see the same sky on the same day, but meet it differently', () => {
  const a = readDaily(orbi, { timeZone: NY, now: at('2026-11-13T15:00:00Z') }), b = readDaily(kip, { timeZone: NY, now: at('2026-11-13T15:00:00Z') })
  for (const x of BODIES) assert.equal(a.sky[x].lon, b.sky[x].lon)
  assert.notDeepEqual(a.transits.map(t => `${t.a}-${t.kind}-${t.b}`), b.transits.map(t => `${t.a}-${t.kind}-${t.b}`))
  assert.notDeepEqual(a.sky.moon.house, b.sky.moon.house ?? -1)
})

test('exact times are really exact, and inside the day', () => {
  let found = 0
  for (let d = 0; d < 12; d++) {
    const r = readDaily(orbi, { timeZone: NY, now: at('2026-11-01T17:00:00Z') + d * 86_400_000 })
    for (const t of r.transits) {
      if (t.exactAt == null) continue
      found++
      assert.ok(t.exactAt >= r.dayStart && t.exactAt <= r.dayEnd, `${r.day} ${t.a} ${t.kind} ${t.b}`)
      const natal = t.b === 'ascendant' || t.b === 'midheaven' ? orbi.angles![t.b].lon : orbi.bodies[t.b].lon
      const lon = astronomyEngine.position(t.a, t.exactAt).lon, dd = ((lon - natal) % 360 + 360) % 360, sep = dd > 180 ? 360 - dd : dd
      assert.ok(Math.abs(sep - t.angle) < 0.03, `${t.a} ${t.kind} ${t.b} exact at ${new Date(t.exactAt).toISOString()}: ${Math.abs(sep - t.angle)}`)
    }
  }
  assert.ok(found >= 3, `the Moon makes exact aspects most days (${found} in 12 days)`)
})

test('planets changing sign during the day are caught, at the right moment', () => {
  let moonMoves = 0
  for (let d = 0; d < 7; d++) {
    const r = readDaily(orbi, { timeZone: NY, now: at('2026-11-13T17:00:00Z') + d * 86_400_000 })
    for (const i of r.ingresses) {
      assert.equal(signAt(astronomyEngine.position(i.body, i.at - 1000).lon), i.from); assert.equal(signAt(astronomyEngine.position(i.body, i.at).lon), i.to)
      assert.ok(i.at >= r.dayStart && i.at <= r.dayEnd)
      if (i.body === 'moon') moonMoves++
    }
  }
  assert.ok(moonMoves >= 2 && moonMoves <= 4, `the Moon changes sign every two or three days (${moonMoves} in a week)`)
})

test('a planet turning retrograde or direct is caught on its day', () => {
  // find the days in 2026 when Mercury turns, from its speed, then check each day's report says so
  const turns: number[] = []
  for (let d = 0; d < 365; d++) {
    const t0 = at('2026-01-01T05:00:00Z') + d * 86_400_000
    if (Math.sign(astronomyEngine.speed('mercury', t0)) !== Math.sign(astronomyEngine.speed('mercury', t0 + 86_400_000))) turns.push(t0 + 43_200_000)
  }
  assert.ok(turns.length >= 5 && turns.length <= 7, `Mercury turns about six times a year (${turns.length})`)
  for (const t of turns) {
    const r = readDaily(orbi, { timeZone: NY, now: t })
    const s = r.stations.find(x => x.body === 'mercury')
    assert.ok(s, `${r.day}: Mercury turns`)
    assert.equal(Math.sign(astronomyEngine.speed('mercury', s!.at + 3_600_000)), s!.turns === 'retrograde' ? -1 : 1)
  }
})

test('a saved report is only used again for the same day, time zone, chart and engine', () => {
  const now = at('2026-11-13T15:00:00Z'), r = readDaily(orbi, { timeZone: NY, now })
  assert.equal(reportIsCurrent(r, orbi, NY, now + 3_600_000), true)
  assert.equal(reportIsCurrent(r, orbi, NY, nextMidnight(now, NY)), false, 'a new day')
  assert.equal(reportIsCurrent(r, orbi, 'Europe/London', now), false, 'another time zone')
  assert.equal(reportIsCurrent(r, kip, NY, now), false, 'another Cozmling')
  assert.equal(reportIsCurrent({ ...r, engine: { ...r.engine, version: 99 } }, orbi, NY, now), false, 'another engine')
  assert.equal(reportIsCurrent(null, orbi, NY, now), false)
})

test('today’s words: about this Cozmling, in the player’s clock, and never a forecast', () => {
  for (let d = 0; d < 5; d++) {
    const r = readDaily(orbi, { timeZone: NY, now: at('2026-11-13T17:00:00Z') + d * 86_400_000 })
    for (const t of r.transits) {
      const text = transitReading(t, 'Orbi', NY).lines.join(' ')
      assert.match(text, /Orbi’s/); assert.doesNotMatch(text, /\b(will|always|never|destined|guarantee)\b/i)
      if (t.exactAt) assert.match(text, /exact at \d{1,2}:\d{2} (am|pm), your time/)
    }
    assert.match(skyNotes(r, 'Orbi')[0], /^At midday the Moon is in \w+, [a-z ]+ and \d+% lit, passing through Orbi’s \d+(st|nd|rd|th) house/)
    assert.ok(todayHeadline(r, 'Orbi').length > 10)
  }
  const quiet = { ...readDaily(orbi, { timeZone: NY, now: at('2026-11-13T17:00:00Z') }), transits: [] }
  assert.match(todayHeadline(quiet, 'Orbi'), /quiet sky/)
})

test('the Moon is told where it is now when that is known; an earlier day is told in the past, never as today', () => {
  const r = readDaily(orbi, { timeZone: NY, now: at('2026-11-13T17:00:00Z') })
  const late = skyAt(at('2026-11-14T04:30:00Z')), Sign = (s: string) => s[0].toUpperCase() + s.slice(1)
  const now = skyNotes(r, 'Orbi', { moonNow: { sign: late.bodies.moon.sign, house: 3, phase: late.moonPhase } })
  assert.match(now[0], new RegExp(`^The Moon is in ${Sign(late.bodies.moon.sign)}, ${late.moonPhase.name.toLowerCase()} and ${Math.round(late.moonPhase.illumination * 100)}% lit, passing through Orbi’s 3rd house`))
  const on = dayText(r.day)
  assert.equal(on, 'Friday, November 13')
  const then = skyNotes(r, 'Orbi', { past: true, moonNow: { sign: late.bodies.moon.sign, house: 3, phase: late.moonPhase } })
  assert.match(then[0], new RegExp(`^At midday the Moon was in ${Sign(r.sky.moon.sign)}`), 'an earlier day keeps its own Moon')
  for (const l of then.slice(1)) assert.doesNotMatch(l, /\b(moves|turns|is|are)\b/, l)
  assert.ok(r.transits.length > 0)
  for (const t of r.transits) {
    const lines = transitReading(t, 'Orbi', NY, on).lines
    assert.match(lines[0], /^On Friday, November 13, /); assert.match(lines[1], /\bwas\b/)
    assert.doesNotMatch(lines.join(' '), /\bToday\b|today’s/)
  }
  const moon = todayPlacementReading('moon', r.sky.moon, r.sky.moon.house, 'Orbi', on)
  assert.match(moon.title, /^The Moon in \w+ on Friday, November 13$/)
  assert.match(moon.lines.join(' '), /^At midday on Friday, November 13, the Moon was in (\w+), at \d+°\d\d′\. This sky symbol can bring that day’s mood to mind\. In \1, that may have come across as /)
  assert.match(todayPlacementReading('moon', late.bodies.moon, 3, 'Orbi').lines[0], /^Today the Moon is in /)
})

test('a saved report from an earlier day is still known as this chart’s, but never as today’s', () => {
  const now = at('2026-11-13T15:00:00Z'), r = readDaily(orbi, { timeZone: NY, now }), next = nextMidnight(now, NY)
  assert.equal(reportIsFor(r, orbi), true); assert.equal(reportIsCurrent(r, orbi, NY, next), false)
  assert.equal(reportIsFor(r, kip), false)
  assert.equal(reportIsFor({ ...r, transits: undefined }, orbi), false, 'a damaged save is not used')
  assert.equal(reportIsFor('nonsense', orbi), false)
})

test('a day’s report is quick to work out', () => {
  const t0 = performance.now()
  for (let d = 0; d < 20; d++) readDaily(orbi, { timeZone: NY, now: at('2026-12-01T17:00:00Z') + d * 86_400_000 })
  const each = (performance.now() - t0) / 20
  assert.ok(each < 60, `${each.toFixed(1)} ms per report`)
})
