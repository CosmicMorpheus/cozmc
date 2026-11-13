/* COZMC's chart engine against the reference astrologers use: the Swiss Ephemeris by Astrodienst (the engine behind
   astro.com charts), with its own ephemeris files (JPL DE431). And the clocks against Python's zoneinfo (the IANA
   time zone database). `npm test`.

   The reference numbers (tests/fixtures/*.json) were produced privately. The Swiss Ephemeris is AGPL-licensed, so none
   of its code is in this repository: only plain numbers (planet positions at given moments), which are facts. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { astronomyEngine } = await import('../src/cozmling/celestial/ephemeris')
const { anglesFrom, castChart } = await import('../src/cozmling/celestial/chart')
const { signAt, norm360, ZODIAC } = await import('../src/cozmling/celestial/zodiac')
const { wallClockToUtc, zoneOffsetMs } = await import('../src/cozmling/celestial/observatory')
const { ENGINE } = await import('../src/cozmling/celestial/version')

const SWE = JSON.parse(readFileSync(new URL('./fixtures/swiss-ephemeris-reference.json', import.meta.url), 'utf8'))
const TZ = JSON.parse(readFileSync(new URL('./fixtures/timezone-reference.json', import.meta.url), 'utf8'))
const apart = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180)
const ARCSEC = 1 / 3600
/** The most each body may differ from the Swiss Ephemeris, in arcseconds (Astronomy Engine is good to about 1′). */
const LIMIT: Record<string, number> = { sun: 10, moon: 75, mercury: 20, venus: 20, mars: 15, jupiter: 15, saturn: 15, uranus: 15, neptune: 25, pluto: 15 }

test('planet positions match the Swiss Ephemeris within an arcminute, 1900–2100', () => {
  assert.match(SWE.generator, /^Swiss Ephemeris 2\.10/)
  let n = 0
  for (const c of SWE.cases) for (const [b, [lon]] of Object.entries(c.bodies) as [string, [number, number]][]) {
    const off = apart(astronomyEngine.position(b as any, c.ms).lon, lon) / ARCSEC
    assert.ok(off <= LIMIT[b], `${b} at ${new Date(c.ms).toISOString()}: ${off.toFixed(1)}″ from the Swiss Ephemeris`)
    n++
  }
  assert.equal(n, SWE.cases.length * 10)
})

test('signs and retrograde motion agree with the Swiss Ephemeris', () => {
  for (const c of SWE.cases) for (const [b, [lon, speed]] of Object.entries(c.bodies) as [string, [number, number]][]) {
    const mine = astronomyEngine.position(b as any, c.ms).lon, v = astronomyEngine.speed(b as any, c.ms)
    const nearEdge = Math.min(lon % 30, 30 - (lon % 30)) < 0.02
    if (!nearEdge) assert.equal(signAt(mine), signAt(lon), `${b} at ${new Date(c.ms).toISOString()}`)
    if (Math.abs(speed) > 0.02) assert.equal(v < 0, speed < 0, `${b} retrograde at ${new Date(c.ms).toISOString()}`)
    assert.ok(Math.abs(v - speed) < 0.005, `${b} speed ${v} against ${speed}`)
  }
})

test('the Rising sign and Midheaven agree at 12 places, from the equator to inside the Arctic Circle', () => {
  const places = new Set<string>()
  let polar = 0
  for (const c of SWE.cases) {
    const base = astronomyEngine.siderealTime(c.ms) * 15, eps = astronomyEngine.obliquity(c.ms)
    for (const [name, lat, lng, asc, mc] of c.angles) {
      places.add(name)
      const a = anglesFrom(norm360(base + lng), eps, lat)
      assert.ok(apart(a.ascendant, asc) / ARCSEC < 25, `${name} Ascendant at ${new Date(c.ms).toISOString()}: ours ${a.ascendant}, Swiss Ephemeris ${asc}`)
      assert.ok(apart(a.midheaven, mc) / ARCSEC < 5, `${name} Midheaven`)
      if (Math.abs(lat) > 66.56) polar++
      // whole-sign houses start from the Rising sign's sign, so the houses agree too
      if (Math.min(asc % 30, 30 - (asc % 30)) > 0.02) assert.equal(signAt(a.ascendant), signAt(asc))
    }
  }
  assert.equal(places.size, 12); assert.ok(polar > 100, 'checked inside the polar circle, where the eastern-horizon rule matters')
  assert.equal(ENGINE.version, 2, 'version 2: the Ascendant inside the polar circles is the point rising in the east')
})

test('a chart cast for a place uses its coordinates for the angles, and nothing else changes with the place', () => {
  const ms = Date.parse('2026-06-21T12:00:00Z')
  const base = { companionId: 'test-ref-1', kind: 'birth' as const, rule: 'hatch-moment' as const, ms, birthday: null, hatchedAt: ms, displayTimeZone: 'UTC', calculatedAt: ms }
  const oslo = castChart({ ...base, place: { id: 'test:oslo', version: 1, name: 'Oslo', place: 'Oslo, Norway', latitude: 59.9139, longitude: 10.7522, elevationM: null, timeZone: 'Europe/Oslo', fictional: false } })
  const quito = castChart({ ...base, place: { id: 'test:quito', version: 1, name: 'Quito', place: 'Quito, Ecuador', latitude: -0.1807, longitude: -78.4678, elevationM: null, timeZone: 'America/Guayaquil', fictional: false } })
  for (const b of ['sun', 'moon', 'mars'] as const) assert.equal(oslo.bodies[b].lon, quito.bodies[b].lon, 'positions are geocentric: the same everywhere at one moment')
  assert.notEqual(oslo.angles!.ascendant.lon, quito.angles!.ascendant.lon)
  assert.equal(oslo.houses![0], oslo.angles!.ascendant.sign); assert.ok(ZODIAC.includes(quito.houses![0]))
  assert.equal(oslo.birthplace.name, 'Oslo'); assert.equal(oslo.birthplace.timeZone, 'Europe/Oslo')
})

test('wall clocks follow the IANA time zone database exactly, as Python’s zoneinfo reads it, 1900–2035', () => {
  assert.ok(TZ.samples.length > 2500)
  for (const [zone, y, m, d, hh, mm, want] of TZ.samples) {
    const got = wallClockToUtc({ y, m, d, hh, mm, ss: 0 }, zone)
    assert.equal(got, want, `${zone} ${y}-${m}-${d} ${hh}:${mm}: ${new Date(got).toISOString()} against ${new Date(want).toISOString()}`)
  }
})

test('daylight saving and local mean time, case by case', () => {
  const utc = (zone: string, s: string) => { const [d, t] = s.split(' '), [y, m, dd] = d.split('-').map(Number), [hh, mm, ss = 0] = t.split(':').map(Number); return new Date(wallClockToUtc({ y, m, d: dd, hh, mm, ss }, zone)).toISOString() }
  assert.equal(utc('America/New_York', '2026-03-08 02:30'), '2026-03-08T07:30:00.000Z', 'a skipped time lands just after the gap (03:30 EDT)')
  assert.equal(utc('America/New_York', '2026-11-01 01:30'), '2026-11-01T05:30:00.000Z', 'a repeated time is the first one (EDT)')
  assert.equal(utc('Europe/London', '1916-10-01 02:00'), '1916-10-01T01:00:00.000Z', 'the first time the clocks went back in Britain')
  assert.equal(utc('Australia/Sydney', '2026-04-05 02:30'), '2026-04-04T15:30:00.000Z', 'southern-hemisphere autumn, first of the two 02:30s')
  assert.equal(utc('Australia/Lord_Howe', '2026-10-04 02:15'), '2026-10-03T15:45:00.000Z', 'a half-hour daylight saving gap: 02:15 is skipped, so it lands at 02:45')
  assert.equal(utc('Asia/Kathmandu', '1919-12-31 21:30'), '1919-12-31T15:48:44.000Z', 'local mean time, to the second (+5:41:16)')
  assert.equal(utc('Europe/Paris', '1911-03-10 21:00'), '1911-03-10T20:50:39.000Z', 'Paris mean time (+0:09:21)')
  assert.equal(utc('Pacific/Apia', '2011-12-30 12:00'), '2011-12-30T22:00:00.000Z', 'Samoa skipped 30 December 2011: read with the offset from before')
  assert.equal(zoneOffsetMs(Date.parse('1900-06-01T00:00:00Z'), 'Asia/Shanghai'), (8 * 3600 + 5 * 60 + 43) * 1000, 'Shanghai mean time +8:05:43')
})
