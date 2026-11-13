/* Where a Cozmling is born: the three choices, and that the place really is the one its sky is read over. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { placeBook, toBirthplace, fold } = await import('../src/cozmling/celestial/places/places')
const { ORIGIN_OBSERVATORY, wallClock, wallClockToUtc } = await import('../src/cozmling/celestial/observatory')
const { birthplaceProblem, isDefaultPlace, placePhrase, clockName } = await import('../src/cozmling/celestial/birthplace')
const { castChart, hatchWithSky, sunSignOnBirthday, birthplaceOf, anglesFrom, provisionalStarprint } = await import('../src/cozmling/celestial/chart')
const { astronomyEngine } = await import('../src/cozmling/celestial/ephemeris')
const { newAdventurer, adoptProblem } = await import('../src/cozmling/domain/adventurer')
const { companionProblem } = await import('../src/cozmling/store/validators')
const { norm360 } = await import('../src/cozmling/celestial/zodiac')
import type { AdventurerCompanion } from '../src/cozmling/types'

const raw = JSON.parse(readFileSync(new URL('../src/cozmling/celestial/places/cities.json', import.meta.url), 'utf8'))
const book = placeBook(raw)
const at = (iso: string) => Date.parse(iso)
const egg = (birthday: string, birthplace?: any) => newAdventurer({ name: 'Ari', birthday, look: 'a', skin: 'sky', birthplace }, { companionId: 'test-bp-1', now: at('2026-11-13T12:00:00Z') })

test('the atlas: about 7,300 real places, every one with coordinates and a time zone that can be used exactly', () => {
  assert.match(raw.source, /Natural Earth .*public domain/)
  assert.ok(book.places.length > 7000)
  const ids = new Set<string>()
  for (const p of book.places) {
    assert.ok(Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180, p.label)
    assert.doesNotThrow(() => new Intl.DateTimeFormat('en-US', { timeZone: p.timeZone }), p.timeZone)
    assert.ok(!ids.has(p.id), `one entry per place: ${p.id}`); ids.add(p.id)
    assert.equal(birthplaceProblem(toBirthplace(p, 'chosen', book)), null, p.label)
  }
  const paris = book.search('paris')[0]
  assert.deepEqual([paris.label, paris.timeZone, Math.round(paris.latitude), Math.round(paris.longitude)], ['Paris, France', 'Europe/Paris', 49, 2])
})

test('searching: any case or accent, by place, region or country, the biggest places first, nothing sent anywhere', () => {
  assert.equal(book.search('reykjavik')[0].label, 'Reykjavík, Iceland')
  assert.equal(book.search('REYKJAVÍK')[0].label, 'Reykjavík, Iceland')
  assert.equal(book.search('london canada')[0].label, 'London, Canada')
  assert.equal(book.search('usa austin')[0].name, 'Austin', 'a few countries can be typed as they are usually said')
  assert.match(book.search('springfield').map(p => p.label).join(' | '), /Springfield, Massachusetts, .*Springfield, Missouri/, 'two places of one name in a country are told apart by region')
  assert.deepEqual(book.search('z'), []); assert.deepEqual(book.search('qqqq'), [])
  assert.ok(book.search('san').length <= 8)
  assert.equal(fold('São Tomé'), 'sao tome')
})

test('surprises: verified places spread around the globe, and another try gives another place', () => {
  assert.ok(book.surprises.length > 200)
  assert.equal(new Set(book.surprises.map(p => p.timeZone)).size, book.surprises.length, 'one per time zone: a spread, not a cluster')
  assert.ok(book.surprises.every(p => p.population >= 100))
  const regions = new Set(book.surprises.map(p => p.timeZone.split('/')[0]))
  for (const r of ['Africa', 'America', 'Asia', 'Australia', 'Europe', 'Pacific']) assert.ok(regions.has(r), r)
  let seed = 1
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let last = book.surprise(undefined, random)
  for (let i = 0; i < 200; i++) { const next = book.surprise(last.id, random); assert.notEqual(next.id, last.id); last = next }
})

test('the COZMC default is the birthplace already in use, Mauna Kea, and stays the default', () => {
  assert.deepEqual([ORIGIN_OBSERVATORY.latitude, ORIGIN_OBSERVATORY.longitude, ORIGIN_OBSERVATORY.timeZone, ORIGIN_OBSERVATORY.fictional], [19.8207, -155.4681, 'Pacific/Honolulu', true])
  const e = egg('2026-05-05')
  assert.deepEqual(e.starprint.birthplace, ORIGIN_OBSERVATORY)
  assert.equal(placePhrase(e.starprint.birthplace), 'the Origin Observatory on Mauna Kea'); assert.equal(clockName(undefined), 'Mauna Kea')
  // an egg from before birthplaces existed (none recorded) hatches at the default: nothing is assigned at random
  const old = { ...e, starprint: { ...e.starprint, birthplace: undefined } } as AdventurerCompanion
  assert.ok(isDefaultPlace(birthplaceOf(old.starprint)))
  const hatched = hatchWithSky(old, at('2026-11-13T15:00:00Z'), 'UTC') as AdventurerCompanion
  assert.equal(hatched.celestial!.birthplace.id, ORIGIN_OBSERVATORY.id)
})

test('a chosen place: its clock sets the birth moment, its coordinates the Rising sign, and it is kept with the chart', () => {
  const reykjavik = toBirthplace(book.search('reykjavik')[0], 'chosen', book)
  const e = egg('2026-05-05', reykjavik)
  assert.deepEqual(e.starprint.birthplace, reykjavik); assert.equal(companionProblem(e), null)
  const hatchedAt = at('2026-11-13T20:14:48Z')
  const c = hatchWithSky(e, hatchedAt, 'America/New_York') as AdventurerCompanion
  const sky = c.celestial!
  assert.equal(sky.birthplace.name, 'Reykjavík'); assert.equal(sky.birthplace.choice, 'chosen'); assert.equal(sky.birthplace.timeZone, 'Atlantic/Reykjavik')
  // born on its birthday, at the time of day it hatched, on Reykjavík's clock
  const born = wallClock(sky.moment.ms, 'Atlantic/Reykjavik'), hatchClock = wallClock(hatchedAt, 'Atlantic/Reykjavik')
  assert.deepEqual([born.y, born.m, born.d, born.hh, born.mm, born.ss], [2026, 5, 5, hatchClock.hh, hatchClock.mm, hatchClock.ss])
  // its angles are Reykjavík's
  const a = anglesFrom(norm360(astronomyEngine.siderealTime(sky.moment.ms) * 15 + reykjavik.longitude), astronomyEngine.obliquity(sky.moment.ms), reykjavik.latitude)
  assert.ok(Math.abs(a.ascendant - sky.angles!.ascendant.lon) < 1e-5)
  const atDefault = castChart({ companionId: c.companionId, kind: 'birth', rule: 'chosen-day-hatch-minute', ms: sky.moment.ms, birthday: '2026-05-05', hatchedAt, displayTimeZone: 'UTC', calculatedAt: 0 })
  assert.notEqual(atDefault.angles!.ascendant.lon, sky.angles!.ascendant.lon, 'a different place, a different Rising sign')
  assert.match(sky.accuracy.moment, /on Reykjavík’s clock/)
  assert.equal(c.starprint.observatoryVersion, `${reykjavik.id}-${reykjavik.version}`)
  assert.equal(companionProblem(c), null)
})

test('a birthplace with daylight saving: a skipped birth time lands after the gap, a repeated one is the first', () => {
  const ny = toBirthplace(book.search('new york')[0], 'chosen', book)
  assert.equal(ny.timeZone, 'America/New_York')
  // hatched at 02:30 New York time on another day, born on 8 March 2026, the night the clocks go forward
  const spring = hatchWithSky(egg('2026-03-08', ny), wallClockToUtc({ y: 2026, m: 11, d: 13, hh: 2, mm: 30, ss: 0 }, 'America/New_York'), 'UTC') as AdventurerCompanion
  assert.equal(new Date(spring.celestial!.moment.ms).toISOString(), '2026-03-08T07:30:00.000Z', '02:30 doesn’t exist that night: 03:30 EDT')
  const autumn = hatchWithSky(egg('2026-11-01', ny), wallClockToUtc({ y: 2026, m: 11, d: 13, hh: 1, mm: 30, ss: 0 }, 'America/New_York'), 'UTC') as AdventurerCompanion
  assert.equal(new Date(autumn.celestial!.moment.ms).toISOString(), '2026-11-01T05:30:00.000Z', '01:30 happens twice that night: the first (EDT)')
})

test('the preview follows the place: a cusp day on its own clock', () => {
  const tokyo = toBirthplace(book.search('tokyo')[0], 'chosen', book)
  const cuspAt = (place: any) => { for (const d of ['2026-11-21', '2026-11-22', '2026-11-23']) { const s = sunSignOnBirthday(d, at('2026-11-13T00:00:00Z'), astronomyEngine, place); if (s?.cusp) return { day: d, at: s.cusp.at } } return null }
  const h = cuspAt(ORIGIN_OBSERVATORY), t = cuspAt(tokyo)
  assert.ok(h && t); assert.ok(Math.abs(h!.at - t!.at) <= 1000, 'the Sun changes sign at one moment everywhere (found to the second)')
  assert.notEqual(h!.day, t!.day, 'but on Tokyo’s clock that moment falls on the next calendar day')
  assert.equal(provisionalStarprint('2026-05-05', at('2026-11-13T00:00:00Z'), tokyo)!.birthplace!.name, 'Tokyo')
})

test('a damaged or unusable birthplace is caught, and never silently becomes Mauna Kea', () => {
  const e = egg('2026-05-05')
  assert.equal(companionProblem({ ...e, starprint: { ...e.starprint, birthplace: { ...ORIGIN_OBSERVATORY, latitude: 200 } } }), 'invalid birthplace')
  const mars = { ...toBirthplace(book.search('paris')[0], 'chosen', book), timeZone: 'Mars/Olympus_Mons' }
  assert.match(adoptProblem({ name: 'Ari', birthday: '2026-05-05', look: 'a', skin: 'sky', birthplace: mars }) ?? '', /can’t be used/)
  // saved somewhere with a time zone this browser doesn't know: it hatches, and its sky waits to be read where it can be
  const odd = { ...e, starprint: { ...e.starprint, birthplace: mars } } as AdventurerCompanion
  assert.equal(companionProblem(odd), null, 'the save is still good: browsers differ in the time zones they know')
  const hatched = hatchWithSky(odd, at('2026-11-13T15:00:00Z'), 'UTC') as AdventurerCompanion
  assert.equal(hatched.hatch.status, 'hatched'); assert.equal(hatched.celestial, undefined); assert.deepEqual(hatched.starprint.birthplace, mars)
})

test('nothing about the player’s own location is ever read', () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap(f => { const p = `${dir}/${f}`; return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [] })
  for (const f of walk(new URL('../src', import.meta.url).pathname)) assert.doesNotMatch(readFileSync(f, 'utf8'), /navigator\.geolocation|getCurrentPosition|watchPosition/, f)
  const b = toBirthplace(book.search('paris')[0], 'chosen', book)
  assert.deepEqual(Object.keys(b).sort(), ['choice', 'elevationM', 'fictional', 'id', 'latitude', 'longitude', 'name', 'place', 'source', 'timeZone', 'version'], 'only the place itself is kept')
})
