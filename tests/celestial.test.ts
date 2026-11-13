/* The Celestial engine: real astronomy, reproducible charts, honest records. `npm test`.
   Reference values are published ones (sources beside each), not the library checking itself. */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

class FakeStorage {
  m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}
const storage = new FakeStorage()
;(globalThis as any).localStorage = storage

const Astro = await import('astronomy-engine')
const { astronomyEngine, LIBRARY } = await import('../src/cozmling/celestial/ephemeris')
const { castChart, anglesFrom, moonPhaseName, sunSignOnBirthday, provisionalStarprint, hatchWithSky, readSkyLate, readLegacySky, legacySkyOption, ENGINE_TAG } = await import('../src/cozmling/celestial/chart')
const { birthMoment, wallClock, wallClockToUtc, zoneOffsetMinutes, localDay, ORIGIN_OBSERVATORY } = await import('../src/cozmling/celestial/observatory')
const { findAspects, findPatterns, aspectBetween, separation } = await import('../src/cozmling/celestial/aspects')
const { celestialProblem } = await import('../src/cozmling/celestial/validate')
const { placementReading, aspectReading, moonPhaseReading, bigThree, DISCLAIMER } = await import('../src/cozmling/celestial/interpret')
const { signAt, BODIES } = await import('../src/cozmling/celestial/zodiac')
const { newAdventurer, customize } = await import('../src/cozmling/domain/adventurer')
const { legacyFromPet } = await import('../src/cozmling/integrations/legacyAdapter')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const { createStore } = await import('../src/cozmling/store/companionStore')
const { checksum } = await import('../src/cozmling/store/util')
const { companionProblem } = await import('../src/cozmling/store/validators')
const { exportAll, planImport, applyImport } = await import('../src/cozmling/store/exportImport')
const care = await import('../src/companion/care')
import type { AdventurerCompanion, Companion, LegacyCompanion } from '../src/cozmling/types'
import type { Repository } from '../src/cozmling/store/repository'
import type { BodyId, CelestialBirthRecord } from '../src/cozmling/celestial/types'

const at = (iso: string) => new Date(iso).getTime()
const lon = (b: BodyId, iso: string) => astronomyEngine.position(b, at(iso)).lon
const off = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180)
const START = at('2026-11-13T01:14:30Z')
let clock = START, ids = 0
const env = () => ({ storage, now: () => clock, newId: () => `test-${String(++ids).padStart(6, '0')}`, hash: checksum })
const page = async (repo: Repository) => { const s = createStore(repo, env()); await s.hydrate(); return s }
const TZ = 'America/New_York'
beforeEach(() => { storage.m.clear(); clock = START; ids = 0 })

/* ---------------- the library ---------------- */

test('the astronomy library is the pinned version, under the MIT licence', () => {
  const pkg = JSON.parse(readFileSync(new URL('../node_modules/astronomy-engine/package.json', import.meta.url), 'utf8'))
  assert.equal(pkg.version, LIBRARY.version)
  assert.equal(pkg.license, 'MIT')
  const site = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(site.dependencies['astronomy-engine'], LIBRARY.version, 'pinned exactly, so charts can be worked out again identically')
})

test('the Sun stands at 0°, 90°, 180° and 270° at the published equinoxes and solstices', () => {
  // US Naval Observatory, Earth's seasons (UTC, to the minute)
  for (const [iso, want] of [['2024-03-20T03:06:00Z', 0], ['2024-06-20T20:51:00Z', 90], ['2024-09-22T12:44:00Z', 180], ['2024-12-21T09:21:00Z', 270], ['2025-03-20T09:01:00Z', 0], ['2026-03-20T14:46:00Z', 0]] as const)
    assert.ok(off(lon('sun', iso), want) < 0.01, `${iso}: ${lon('sun', iso)}`)
})

test('the Moon meets the Sun at a published new moon and faces it at a published full moon', () => {
  // NASA: the total solar eclipse of 2024-04-08 (new moon 18:21 UTC); the total lunar eclipse of 2025-03-14 (full moon 06:55 UTC)
  assert.ok(off(lon('moon', '2024-04-08T18:21:00Z'), lon('sun', '2024-04-08T18:21:00Z')) < 0.1)
  assert.ok(off(lon('moon', '2025-03-14T06:55:00Z'), lon('sun', '2025-03-14T06:55:00Z') + 180) < 0.1)
  assert.equal(moonPhaseName(astronomyEngine.moonPhase(at('2024-04-08T18:21:00Z'))), 'New Moon')
  assert.equal(moonPhaseName(astronomyEngine.moonPhase(at('2025-03-14T06:55:00Z'))), 'Full Moon')
})

test('sidereal time at the J2000 epoch matches the IAU value', () => {
  // GMST at 2000-01-01 12:00 UT is 18.697374558 h; apparent time differs by under a second and a half
  assert.ok(Math.abs(astronomyEngine.siderealTime(at('2000-01-01T12:00:00Z')) - 18.697374558) < 0.0005)
})

test('retrograde periods match the published dates', () => {
  // Mercury 2024: Apr 1 to 25, Aug 5 to 28, Nov 26 to Dec 15. Mars Dec 6 2024 to Feb 24 2025. Jupiter Oct 9 2024 to Feb 4 2025. Saturn Jun 29 to Nov 15 2024.
  const r = (b: BodyId, day: string) => astronomyEngine.speed(b, at(`${day}T12:00:00Z`)) < 0
  for (const day of ['2024-04-10', '2024-08-15', '2024-12-05']) assert.equal(r('mercury', day), true, day)
  for (const day of ['2024-05-10', '2024-09-15', '2024-10-15']) assert.equal(r('mercury', day), false, day)
  assert.equal(r('mars', '2025-01-15'), true); assert.equal(r('mars', '2025-04-01'), false)
  assert.equal(r('jupiter', '2024-12-01'), true); assert.equal(r('saturn', '2024-09-01'), true); assert.equal(r('saturn', '2025-01-15'), false)
})

test('planets change sign on their published dates', () => {
  const sign = (b: BodyId, day: string) => signAt(lon(b, `${day}T12:00:00Z`))
  for (const [b, before, from, after, to] of [
    ['pluto', '2024-11-10', 'capricorn', '2024-11-30', 'aquarius'],     // Pluto into Aquarius for good, 2024-11-19
    ['saturn', '2023-02-28', 'aquarius', '2023-03-14', 'pisces'],       // 2023-03-07
    ['jupiter', '2024-05-20', 'taurus', '2024-05-30', 'gemini'],        // 2024-05-25
    ['neptune', '2025-03-20', 'pisces', '2025-04-10', 'aries'],         // 2025-03-30
    ['uranus', '2025-06-25', 'taurus', '2025-07-20', 'gemini'],         // 2025-07-07
  ] as const) { assert.equal(sign(b, before), from, `${b} ${before}`); assert.equal(sign(b, after), to, `${b} ${after}`) }
})

/* ---------------- the Rising sign and Midheaven ---------------- */

test('the Rising sign matches Raphael’s Table of Houses for London, and the textbook cases', () => {
  // Raphael's tables, London (51°32′ N): at sidereal time 0h the Ascendant is 26°36′ Cancer (116.6°)
  assert.ok(Math.abs(anglesFrom(0, 23.44, 51 + 32 / 60).ascendant - 116.6) < 0.1)
  for (const lat of [0, 19.82, 51.5, -33.9]) assert.ok(Math.abs(anglesFrom(90, 23.44, lat).ascendant - 180) < 1e-9, `MC 0° Cancer → Rising 0° Libra at ${lat}°`)
  assert.ok(Math.abs(anglesFrom(0, 23.44, 0).ascendant - 90) < 1e-9)       // on the equator, MC 0° Aries → Rising 0° Cancer
  assert.ok(Math.abs(anglesFrom(0, 23.44, 40).midheaven) < 1e-9); assert.ok(Math.abs(anglesFrom(90, 23.44, 40).midheaven - 90) < 1e-9)
})

test('the Rising sign really is on the eastern horizon, and the Midheaven on the meridian, at the observatory', () => {
  const o = ORIGIN_OBSERVATORY, observer = new Astro.Observer(o.latitude, o.longitude, o.elevationM)
  for (let k = 0; k < 24; k++) {
    const ms = at('2026-05-05T00:00:00Z') + k * 3_917_000 * 7, t = Astro.MakeTime(new Date(ms))
    const sky = castChart({ companionId: 'test-000001', kind: 'birth', rule: 'hatch-moment', ms, birthday: null, hatchedAt: ms, displayTimeZone: 'UTC', calculatedAt: 0 })
    const radec = (lonDeg: number) => Astro.EquatorFromVector(Astro.RotateVector(Astro.Rotation_ECT_EQD(t), Astro.VectorFromSphere(new Astro.Spherical(0, lonDeg, 1), t)))
    const asc = radec(sky.angles!.ascendant.lon), h = Astro.Horizon(t, observer, asc.ra, asc.dec)
    assert.ok(Math.abs(h.altitude) < 0.05 && h.azimuth > 0 && h.azimuth < 180, `rising point at ${new Date(ms).toISOString()}: alt ${h.altitude}, az ${h.azimuth}`)
    const mc = radec(sky.angles!.midheaven.lon), ha = ((Astro.SiderealTime(t) + o.longitude / 15 - mc.ra) % 24 + 36) % 24 - 12
    assert.ok(Math.abs(ha) < 0.001, `midheaven hour angle ${ha}`)
  }
})

/* ---------------- one chart, always the same ---------------- */

const FIXED = { birthday: '2026-05-05', hatchedAt: at('2026-11-13T01:14:30Z') }
const fixedChart = () => castChart({ companionId: 'test-000001', kind: 'birth', rule: 'chosen-day-hatch-minute', ms: birthMoment(FIXED.birthday, FIXED.hatchedAt)!, birthday: FIXED.birthday, hatchedAt: FIXED.hatchedAt, displayTimeZone: TZ, calculatedAt: 0 })

test('the same birthday and hatch minute always give exactly the same chart', () => {
  const a = fixedChart(), b = fixedChart()
  assert.deepEqual(a, b)
  // regression values (engine cozmc-celestial 1, astronomy-engine 2.1.19). A change here means old charts would no longer match.
  assert.equal(a.moment.utc, '2026-05-06T01:14:30.000Z'); assert.equal(a.moment.observatoryLocal, '2026-05-05T15:14:30')
  assert.ok(Math.abs(a.bodies.sun.lon - 45.5416) < 1e-4 && a.bodies.sun.sign === 'taurus')
  assert.ok(Math.abs(a.bodies.moon.lon - 273.0344) < 1e-4 && a.bodies.moon.sign === 'capricorn')
  assert.ok(Math.abs(a.angles!.ascendant.lon - 177.2441) < 1e-4 && a.angles!.ascendant.sign === 'virgo')
  assert.equal(a.moonPhase.name, 'Waning Gibbous')
  assert.deepEqual(a.patterns, [{ kind: 'stellium', points: ['mars', 'saturn', 'neptune'], sign: 'aries' }])
})

test('a chart holds together: signs, degrees, houses and aspects all agree with its longitudes', () => {
  const c = fixedChart()
  assert.equal(c.zodiac, 'tropical'); assert.equal(c.houseSystem, 'whole-sign'); assert.equal(c.engine.libraryVersion, LIBRARY.version)
  for (const b of BODIES) {
    const p = c.bodies[b]
    assert.equal(p.sign, signAt(p.lon)); assert.ok(Math.abs(p.degree - (p.lon % 30)) < 1e-6)
    assert.equal(c.houses![p.house! - 1], p.sign, `${b} sits in the house of its sign`)
    assert.equal(p.retrograde, p.speed < 0)
  }
  assert.equal(c.houses![0], c.angles!.ascendant.sign)
  assert.equal(c.bodies.sun.retrograde, false); assert.equal(c.bodies.moon.retrograde, false)
  for (const a of c.aspects) {
    const pa = a.a === 'ascendant' || a.a === 'midheaven' ? c.angles![a.a] : c.bodies[a.a], pb = a.b === 'ascendant' || a.b === 'midheaven' ? c.angles![a.b] : c.bodies[a.b]
    assert.ok(Math.abs(separation(pa.lon, pb.lon) - a.separation) < 1e-5); assert.ok(a.orb <= a.allowed)
  }
  assert.deepEqual(c.aspects.map(a => a.score), [...c.aspects.map(a => a.score)].sort((x, y) => y - x), 'strongest first')
  assert.equal(celestialProblem(c, 'test-000001'), null)
})

test('two Cozmlings with the same birthday but different hatch minutes get different skies', () => {
  const sky = (h: number) => castChart({ companionId: 'test-000001', kind: 'birth', rule: 'chosen-day-hatch-minute', ms: birthMoment('2026-05-05', h)!, birthday: '2026-05-05', hatchedAt: h, displayTimeZone: TZ, calculatedAt: 0 })
  const a = sky(at('2026-11-13T01:14:30Z')), b = sky(at('2026-11-13T07:40:00Z'))
  assert.equal(a.bodies.sun.sign, b.bodies.sun.sign)
  assert.notEqual(a.angles!.ascendant.sign, b.angles!.ascendant.sign)
  assert.ok(Math.abs(a.bodies.moon.lon - b.bodies.moon.lon) > 2)
})

/* ---------------- the birth moment and the clocks ---------------- */

test('the birth moment is the chosen birthday at the hatch time of day, on the observatory’s clock', () => {
  assert.equal(ORIGIN_OBSERVATORY.timeZone, 'Pacific/Honolulu'); assert.equal(ORIGIN_OBSERVATORY.fictional, true)
  // hatched 2026-11-13 01:14:30 UTC = Nov 12, 3:14:30 pm in Hawaii → born May 5 at 3:14:30 pm Hawaii time
  assert.equal(birthMoment('2026-05-05', at('2026-11-13T01:14:30Z')), at('2026-05-06T01:14:30Z'))
  assert.equal(birthMoment('2026-05-05', at('2026-11-13T10:00:00Z')), at('2026-05-05T10:00:00Z'))         // midnight in Hawaii
  assert.equal(birthMoment('2026-05-05', at('2026-11-13T09:59:59Z')), at('2026-05-06T09:59:59Z'))         // a second before midnight
  assert.equal(birthMoment('2024-02-29', at('2026-11-13T01:14:30Z')), at('2024-03-01T01:14:30Z'))
  assert.equal(birthMoment('2026-02-30', at('2026-11-13T01:14:30Z')), null)
  assert.equal(birthMoment('1900-01-01', at('2026-11-13T01:14:30Z')), wallClockToUtc({ y: 1900, m: 1, d: 1, hh: 15, mm: 14, ss: 30 }, 'Pacific/Honolulu'))
})

test('time zones: wall clocks and calendar days are right across daylight saving and midnight', () => {
  const clock = (iso: string, tz: string) => { const c = wallClock(at(iso), tz); return `${c.y}-${c.m}-${c.d} ${c.hh}:${c.mm}:${c.ss}` }
  // New York springs forward at 2026-03-08 07:00 UTC and falls back at 2026-11-01 06:00 UTC
  assert.equal(clock('2026-03-08T06:59:59Z', TZ), '2026-3-8 1:59:59'); assert.equal(clock('2026-03-08T07:00:00Z', TZ), '2026-3-8 3:0:0')
  assert.equal(zoneOffsetMinutes(at('2026-03-08T06:00:00Z'), TZ), -300); assert.equal(zoneOffsetMinutes(at('2026-03-08T08:00:00Z'), TZ), -240)
  assert.equal(clock('2026-11-01T05:30:00Z', TZ), '2026-11-1 1:30:0'); assert.equal(clock('2026-11-01T06:30:00Z', TZ), '2026-11-1 1:30:0')
  assert.equal(wallClockToUtc({ y: 2026, m: 3, d: 8, hh: 2, mm: 30, ss: 0 }, TZ), at('2026-03-08T07:30:00Z'), 'a time that never happens moves forward')
  assert.equal(wallClockToUtc({ y: 2026, m: 11, d: 1, hh: 1, mm: 30, ss: 0 }, TZ), at('2026-11-01T05:30:00Z'), 'a time that happens twice is the first')
  // the calendar day turns over at local midnight, wherever that falls
  assert.equal(localDay(at('2026-11-13T04:59:59Z'), TZ), '2026-11-12'); assert.equal(localDay(at('2026-11-13T05:00:00Z'), TZ), '2026-11-13')
  assert.equal(localDay(at('2026-11-13T09:59:59Z'), 'Pacific/Honolulu'), '2026-11-12'); assert.equal(localDay(at('2026-11-13T10:00:00Z'), 'Pacific/Honolulu'), '2026-11-13')
  assert.equal(localDay(at('2026-11-12T18:29:59Z'), 'Asia/Kolkata'), '2026-11-12'); assert.equal(localDay(at('2026-11-12T18:30:00Z'), 'Asia/Kolkata'), '2026-11-13')
  assert.equal(localDay(at('2026-11-12T10:00:00Z'), 'Pacific/Kiritimati'), '2026-11-13')                // UTC+14
  assert.equal(zoneOffsetMinutes(at('2026-01-15T00:00:00Z'), 'Pacific/Chatham'), 825); assert.equal(zoneOffsetMinutes(at('2026-07-15T00:00:00Z'), 'Pacific/Chatham'), 765)
  assert.equal(zoneOffsetMinutes(at('2026-03-08T12:00:00Z'), 'Pacific/Honolulu'), -600)
})

test('a cusp birthday: the Sun changes sign that day, so the hatch minute decides which', () => {
  // find the day in late November 2026 (observatory calendar) when the Sun enters Sagittarius
  const day = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'].find(d => sunSignOnBirthday(d, START)?.cusp)
  assert.ok(day, 'the Sun changes sign on one of these days')
  const s = sunSignOnBirthday(day!, START)!
  assert.deepEqual([s.cusp!.before, s.cusp!.after], ['scorpio', 'sagittarius'])
  assert.equal(signAt(lon('sun', new Date(s.cusp!.at - 1000).toISOString())), 'scorpio'); assert.equal(signAt(lon('sun', new Date(s.cusp!.at).toISOString())), 'sagittarius')
  // the hatch time of day that lands just before or just after the change
  const tod = (ms: number) => { const w = wallClock(ms, 'Pacific/Honolulu'); return wallClockToUtc({ y: 2026, m: 12, d: 1, hh: w.hh, mm: w.mm, ss: w.ss }, 'Pacific/Honolulu') }
  assert.equal(provisionalStarprint(day!, tod(s.cusp!.at - 60_000))!.coreSign, 'scorpio')
  assert.equal(provisionalStarprint(day!, tod(s.cusp!.at + 60_000))!.coreSign, 'sagittarius')
  assert.equal(sunSignOnBirthday('2026-05-05', START)!.cusp, null)
})

/* ---------------- aspects and patterns ---------------- */

test('aspects: each kind, the edge of its orb, across 0° Aries, and whether it is closing', () => {
  const P = (id: BodyId, lon: number, speed: number | null = 0) => ({ id, lon, speed })
  assert.equal(aspectBetween(P('mars', 10), P('saturn', 17))?.kind, 'conjunction')                     // 7° within 8°
  assert.equal(aspectBetween(P('mars', 10), P('saturn', 18))?.kind, 'conjunction')                     // exactly at the edge
  assert.equal(aspectBetween(P('mars', 10), P('saturn', 18.01)), null)
  assert.equal(aspectBetween(P('sun', 10), P('saturn', 19.5))?.kind, 'conjunction')                     // the Sun's orb is wider
  assert.equal(aspectBetween(P('mars', 355), P('saturn', 3))?.kind, 'conjunction')                      // across 0° Aries
  assert.equal(aspectBetween(P('mars', 0), P('saturn', 62))?.kind, 'sextile')
  assert.equal(aspectBetween(P('mars', 0), P('saturn', 95))?.kind, 'square')
  assert.equal(aspectBetween(P('mars', 0), P('saturn', 245))?.kind, 'trine')                           // 115° the short way round
  assert.equal(aspectBetween(P('mars', 0), P('saturn', 176))?.kind, 'opposition')
  assert.equal(aspectBetween(P('mars', 0), P('saturn', 40)), null)
  assert.equal(aspectBetween(P('mars', 0, 0.5), P('saturn', 95, 0))!.applying, true)                    // 95° apart and closing toward 90°: tightening
  assert.equal(aspectBetween(P('mars', 0, 0.5), P('saturn', 85, 0))!.applying, false)                   // 85° apart and closing: moving away from 90°
  assert.equal(aspectBetween({ id: 'ascendant', lon: 0, speed: null }, P('venus', 4))?.applying, null)
  assert.equal(aspectBetween({ id: 'ascendant', lon: 0, speed: null }, P('venus', 6)), null)          // the angles take a tighter orb
  const ranked = findAspects([P('sun', 0), P('moon', 120.5), P('pluto', 183)])        // trine 0.5° off; opposition 3° off; sextile 2.5° off
  assert.deepEqual(ranked.map(a => `${a.a}-${a.b}`), ['sun-moon', 'sun-pluto', 'moon-pluto'], 'closest and most personal first')
  assert.equal(findAspects([{ id: 'ascendant', lon: 0, speed: null }, { id: 'midheaven', lon: 270, speed: null }]).length, 0)
})

test('patterns: a stellium, a grand trine, a T-square, and a grand cross that is not also counted as T-squares', () => {
  const chart = (lons: Partial<Record<BodyId, number>>) => {
    const all = Object.fromEntries(BODIES.map((b, i) => [b, lons[b] ?? 200 + i * 37])) as Record<BodyId, number>
    const bodies = Object.fromEntries(BODIES.map(b => [b, { sign: signAt(all[b]) }])) as any
    return findPatterns(bodies, findAspects(BODIES.map(b => ({ id: b, lon: all[b], speed: 0 }))))
  }
  const has = (ps: any[], kind: string, points?: string[]) => ps.some(p => p.kind === kind && (!points || JSON.stringify(p.points) === JSON.stringify(points)))
  assert.ok(has(chart({ sun: 1, moon: 5, mercury: 9, venus: 100, mars: 160, jupiter: 220, saturn: 260, uranus: 300, neptune: 330, pluto: 47 }), 'stellium', ['sun', 'moon', 'mercury']))
  const gt = chart({ sun: 1, moon: 121, mercury: 241, venus: 60, mars: 300, jupiter: 30, saturn: 90, uranus: 150, neptune: 210, pluto: 270 })
  assert.ok(has(gt, 'grand-trine', ['sun', 'moon', 'mercury']))
  assert.equal(gt.find(p => p.kind === 'grand-trine' && p.points.includes('sun'))?.element, 'fire')
  const ts = chart({ sun: 10, moon: 190, mercury: 100, venus: 50, mars: 140, jupiter: 230, saturn: 320, uranus: 20, neptune: 160, pluto: 250 })
  assert.ok(has(ts, 'T-square', ['sun', 'moon', 'mercury']))
  const gc = chart({ sun: 10, moon: 100, mercury: 190, venus: 280, mars: 45, jupiter: 140, saturn: 235, uranus: 330, neptune: 165, pluto: 305 })
  assert.ok(has(gc, 'grand-cross', ['sun', 'moon', 'mercury', 'venus']))
  assert.ok(!gc.some(p => p.kind === 'T-square' && ['sun', 'moon', 'mercury', 'venus'].filter(x => p.points.includes(x as BodyId)).length === 3), 'no T-square inside the cross')
})

test('the Moon’s phase names cover the whole month', () => {
  assert.deepEqual([0, 22.4, 22.5, 45, 90, 135, 180, 225, 270, 315, 337.4, 337.5, 359.9].map(moonPhaseName),
    ['New Moon', 'New Moon', 'Waxing Crescent', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent', 'Waning Crescent', 'New Moon', 'New Moon'])
})

/* ---------------- saved for good ---------------- */

const adopt = async (s: Awaited<ReturnType<typeof page>>, birthday = '2026-05-05') => {
  const c = newAdventurer({ name: 'Orbi', birthday, look: 'a', skin: 'teal' }, { companionId: `test-${String(++ids).padStart(6, '0')}`, now: clock, starprint: provisionalStarprint(birthday, clock)! })
  assert.ok((await s.adopt(c)).ok)
  return c.companionId
}
const hatchIt = (s: Awaited<ReturnType<typeof page>>, id: string) => s.update(id, (c, now) => hatchWithSky(c, now, TZ), { event: { eventId: `hatched:${id}`, type: 'hatched' } })

test('hatching reads its sky in the same save, makes its Starprint final, and it is all still there after a reload', async () => {
  const repo = memoryRepository(), s = await page(repo), id = await adopt(s)
  const egg = s.getState().companions[0] as AdventurerCompanion
  assert.equal(egg.celestial, undefined); assert.equal(egg.starprint.status, 'partial'); assert.equal(egg.starprint.engineVersion, ENGINE_TAG)
  const res = await hatchIt(s, id)
  assert.ok(res.ok)
  const c = res.companion as AdventurerCompanion, sky = c.celestial!
  assert.equal(c.revision, 1); assert.equal(c.hatch.hatchedAt, START)
  assert.equal(sky.kind, 'birth'); assert.equal(sky.rule, 'chosen-day-hatch-minute'); assert.equal(sky.moment.birthday, '2026-05-05'); assert.equal(sky.moment.hatchedAt, START)
  assert.equal(sky.moment.ms, birthMoment('2026-05-05', START)); assert.equal(sky.moment.displayTimeZone, TZ); assert.equal(sky.calculatedAt, START)
  assert.deepEqual(sky, { ...fixedChart(), companionId: id, calculatedAt: START })
  assert.equal(c.starprint.status, 'calculated'); assert.equal(c.starprint.coreSign, sky.bodies.sun.sign); assert.equal(c.starprint.moon, sky.bodies.moon.sign); assert.equal(c.starprint.rising, sky.angles!.ascendant.sign)
  const again = (await page(repo)).getState().companions[0]
  assert.deepEqual(again.celestial, sky)
  assert.equal(companionProblem(again), null)
})

test('a birth sky can’t be changed by care, a new look, a second hatch, or a newer copy from a save file', async () => {
  const repo = memoryRepository(), s = await page(repo), id = await adopt(s)
  const sky = ((await hatchIt(s, id)) as any).companion.celestial as CelestialBirthRecord
  clock += 3_600_000
  await s.update(id, (c, now) => ({ ...c, celestial: { ...c.celestial!, bodies: { ...c.celestial!.bodies, sun: { ...c.celestial!.bodies.sun, sign: 'leo' } } } }))
  await s.update(id, c => (c.kind === 'adventurer' ? customize(c, { name: 'Nova', look: 'b' }) : null))
  await s.update(id, c => ({ ...c, celestial: undefined }))
  const before = s.getState().companions[0].revision
  await hatchIt(s, id)
  assert.equal(s.getState().companions[0].revision, before, 'it can only hatch once: a second hatch changes nothing')
  const file = await exportAll(repo, clock)
  const forged = JSON.parse(JSON.stringify(file))
  forged.companions[0].revision += 5; forged.companions[0].celestial.moment.ms -= 1000; forged.companions[0].celestial.moment.utc = new Date(forged.companions[0].celestial.moment.ms).toISOString()
  const plan = planImport(forged, await repo.load(), new Set())
  assert.ok(plan.ok && plan.plan.newer.length === 1)
  if (plan.ok) await applyImport(repo, plan.plan, new Set([id]))
  const end = (await repo.load()).companions[0] as AdventurerCompanion
  assert.equal(end.name, 'Nova'); assert.deepEqual(end.celestial, sky)
})

test('a damaged birth sky is caught when loaded, and the companion is set aside rather than repaired', async () => {
  const repo = memoryRepository(), s = await page(repo), id = await adopt(s)
  const c = ((await hatchIt(s, id)) as any).companion as AdventurerCompanion
  const bad = (f: (x: any) => void) => { const x = JSON.parse(JSON.stringify(c)); f(x.celestial); return companionProblem(x) }
  assert.match(bad(x => { x.bodies.moon.lon = 400 }) ?? '', /invalid moon/)
  assert.match(bad(x => { x.companionId = 'test-999999' }) ?? '', /another companion/)
  assert.match(bad(x => { x.houses = ['leo'] }) ?? '', /houses/)
  assert.match(bad(x => { x.moment.utc = '2020-01-01T00:00:00.000Z' }) ?? '', /moment/)
  assert.equal(bad(() => {}), null)
})

/* ---------------- nothing invented ---------------- */

const legacy = (pet: any) => legacyFromPet(pet, { companionId: `test-${String(++ids).padStart(6, '0')}`, sourceKey: 'cozmc-cozmling-v1', sourceHash: 'x', now: START }) as LegacyCompanion
const pet = (o: any = {}) => ({ ...care.adopt('Comet', { form: 'boy', body: 0, glow: 0, eyes: 0 }, 'loft', at('2026-10-20T08:00:00Z')), ...o })

test('first-version Cozmlings: a recorded hatch gives its real birth sky; an unknown one only an awakening, called that', () => {
  const known = legacy(pet({ hatched: at('2026-10-24T18:02:11Z'), at: at('2026-10-24T18:02:11Z') }))
  assert.equal(known.celestial, undefined, 'nothing is read until its player asks')
  assert.equal(legacySkyOption(known), 'birth')
  assert.equal(readLegacySky(known, START, TZ, 'awakening'), null)
  const k = readLegacySky(known, START, TZ, 'birth')!
  assert.equal(k.celestial!.kind, 'birth'); assert.equal(k.celestial!.rule, 'hatch-moment'); assert.equal(k.celestial!.moment.ms, at('2026-10-24T18:02:11Z')); assert.equal(k.celestial!.moment.birthday, null)
  assert.deepEqual(k.legacy, known.legacy, 'its first-version self is untouched')

  const restored = legacy(pet({ hatched: at('2026-10-20T08:00:00Z'), born: at('2026-10-20T08:00:00Z') }))       // hatched === born: brought back from a wallet note
  assert.equal(restored.hatch.provenance, 'legacy-unknown'); assert.equal(legacySkyOption(restored), 'awakening')
  assert.equal(readLegacySky(restored, START, TZ, 'birth'), null, 'a birth sky is never made up')
  const w = readLegacySky(restored, START, TZ, 'awakening')!
  assert.equal(w.celestial!.kind, 'awakening'); assert.equal(w.celestial!.rule, 'awakening-moment'); assert.equal(w.celestial!.moment.ms, START); assert.equal(w.celestial!.moment.hatchedAt, null)
  assert.match(w.celestial!.omitted[0].why, /never recorded/)
  assert.match(moonPhaseReading(w.celestial!, 'Comet').lines[0], /given its sky/)

  assert.equal(legacySkyOption(legacy(pet({ hatched: null }))), 'egg')
  assert.equal(readLegacySky(legacy(pet({ hatched: null })), START, TZ, 'birth'), null)
})

test('an adventurer that hatched before skies existed is given its real sky from its own record', () => {
  const c = newAdventurer({ name: 'Kip', birthday: '2026-05-05', look: 'b', skin: 'rose' }, { companionId: 'test-000001', now: at('2026-11-12T00:00:00Z') })
  assert.equal(c.starprint.engineVersion, 'calendar-1')
  const hatched = { ...c, hatch: { status: 'hatched' as const, hatchedAt: START, provenance: 'known' as const }, progress: { ...c.progress, visualStage: 'hatchling' as const } }
  const late = readSkyLate(hatched, START + 86_400_000, TZ) as AdventurerCompanion
  assert.equal(late.celestial!.moment.ms, birthMoment('2026-05-05', START)); assert.equal(late.celestial!.calculatedAt, START + 86_400_000)
  assert.equal(late.starprint.status, 'calculated')
  assert.equal(readSkyLate(late, START, TZ), null, 'only ever once')
  assert.equal(readSkyLate(c, START, TZ), null, 'not while it is an egg')
})

/* ---------------- what it might mean ---------------- */

test('readings speak in symbols and possibilities, never certainties', () => {
  const c = fixedChart()
  const all = [...(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'ascendant', 'midheaven'] as const).map(p => placementReading(c, 'Orbi', p)), ...c.aspects.map(aspectReading)]
  for (const r of all) {
    const text = r.lines.join(' ')
    assert.doesNotMatch(text, /\b(will|always|never|destined|guarantee)/i, r.title)
  }
  assert.match(placementReading(c, 'Orbi', 'moon').lines.join(' '), /symbolises .* may /)
  assert.equal(placementReading(c, 'Orbi', 'ascendant').title, 'Virgo rising')
  assert.equal(bigThree(c), 'Sun in Taurus, Moon in Capricorn, Virgo rising')
  assert.match(DISCLAIMER, /not a prediction/)
})
