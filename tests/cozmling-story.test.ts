/* A Cozmling's daily story (celestial MVP 3): its parts, that it follows the real game state, that it
   is one fixed thing per day, and that it never forecasts. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { newAdventurer } = await import('../src/cozmling/domain/adventurer')
const { hatch, careFor, look } = await import('../src/cozmling/domain/care')
const { castChart } = await import('../src/cozmling/celestial/chart')
const { birthMoment } = await import('../src/cozmling/celestial/observatory')
const { readDaily } = await import('../src/cozmling/celestial/transits')
const { nextMidnight } = await import('../src/cozmling/celestial/daily')
const { narrativeContext } = await import('../src/cozmling/story/context')
const { themeFor, firstParty, EDITORIAL, SOURCES } = await import('../src/cozmling/story/source')
const { writeDailyStory, invitationDone, storyEventId, asStory, STORY_ENGINE } = await import('../src/cozmling/story/engine')
const { THEMES, KIND_BY_POINT } = await import('../src/cozmling/story/themes')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const { createStore } = await import('../src/cozmling/store/companionStore')
const { checksum } = await import('../src/cozmling/store/util')
import type { AdventurerCompanion, Companion, JourneyEvent } from '../src/cozmling/types'

const NY = 'America/New_York', at = (iso: string) => Date.parse(iso)
/** A hatched adventurer with its birth sky, as hatching makes one. */
function cozmling(id: string, birthday: string, hatchedAt: number, name = 'Orbi'): AdventurerCompanion {
  const c = hatch(newAdventurer({ name, birthday, look: 'a', skin: 'sky' }, { companionId: id, now: hatchedAt - 60_000 }), hatchedAt) as AdventurerCompanion
  return { ...c, celestial: castChart({ companionId: id, kind: 'birth', rule: 'chosen-day-hatch-minute', ms: birthMoment(birthday, hatchedAt)!, birthday, hatchedAt, displayTimeZone: NY, calculatedAt: hatchedAt }) }
}
const withCare = (c: AdventurerCompanion, care: Partial<AdventurerCompanion['care']>, now: number): AdventurerCompanion => ({ ...c, care: { ...c.care, ...care, settledAt: now } })
const withCounts = (c: AdventurerCompanion, counters: Record<string, number>): AdventurerCompanion => ({ ...c, progress: { ...c.progress, counters } })
function story(c: Companion, nowIso: string, events: JourneyEvent[] = []) {
  const now = at(nowIso), report = readDaily(c.celestial!, { timeZone: NY, now })
  return writeDailyStory(narrativeContext(c, report, events, now), themeFor({ report, natal: c.celestial! }), now)
}
const orbi = cozmling('test-story-1', '2026-03-30', at('2026-11-10T14:14:30Z'))
const nova = cozmling('test-story-2', '2026-05-05', at('2026-11-10T18:40:00Z'), 'Nova')
const NOON = '2026-11-13T17:00:00Z'
const fresh = (c: AdventurerCompanion, nowIso = NOON) => withCare(c, { food: 80, fun: 70, energy: 85, asleepAt: null }, at(nowIso))

test('a day’s story has every part the brief asks for, from the real sky and the real game state', () => {
  const s = story(fresh(orbi), NOON)
  assert.equal(s.schema, 1); assert.equal(s.day, '2026-11-13'); assert.equal(s.companionId, orbi.companionId)
  assert.ok(s.title.length > 3); assert.equal(s.theme.length, 3)
  assert.match(s.influence.title, /^(The |Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto).* Orbi’s /)
  assert.ok(s.influence.lines.length >= 1)
  assert.equal(s.story.length, 4)
  assert.match(s.story.join(' '), /Its happiness is at 70%, and its sustenance is at 80%\./, 'its real numbers, as in the brief’s example')
  assert.match(s.story[0], /^Orbi the Sprout /, 'its life stage')
  assert.ok(s.invitation.text.includes('Orbi')); assert.ok(s.reflection.length > 10)
  assert.equal(s.source.id, 'first-party'); assert.match(s.source.detail, /astronomy-engine 2\.1\.19/)
  assert.deepEqual(s.basis.engine, { ...STORY_ENGINE }); assert.equal(s.basis.reportDay, s.day); assert.equal(s.basis.natalMoment, orbi.celestial!.moment.ms)
  const r = readDaily(orbi.celestial!, { timeZone: NY, now: at(NOON) })
  assert.equal(s.basis.transit, r.transits[0] ? `${r.transits[0].a}-${r.transits[0].kind}-${r.transits[0].b}` : null, 'built on the day’s strongest transit')
  assert.equal(s.kind, r.transits[0] ? KIND_BY_POINT[r.transits[0].b] : 'quiet')
  assert.ok(THEMES[s.kind].titles.includes(s.title))
  assert.deepEqual(asStory(JSON.parse(JSON.stringify(s))), s, 'it survives being saved')
})

test('the same Cozmling, day and state always give the same story; two Cozmlings under one sky get their own', () => {
  assert.deepEqual(story(fresh(orbi), NOON), story(fresh(orbi), NOON))
  const a = story(fresh(orbi), NOON), b = story(fresh(nova), NOON)
  assert.notEqual(a.basis.transit, b.basis.transit)
  assert.notDeepEqual(a.story, b.story)
})

test('happiness and sustenance shape the story and its invitation', () => {
  const hungry = story(withCare(orbi, { food: 20, fun: 80, energy: 85, asleepAt: null }, at(NOON)), NOON)
  assert.match(hungry.story[2], /sustenance is at 20%\. It’s hungry/); assert.equal(hungry.invitation.action, 'feed')
  const bored = story(withCare(orbi, { food: 80, fun: 40, energy: 85, asleepAt: null }, at(NOON)), NOON)
  assert.match(bored.story[2], /happiness is at 40%.*star ball towards you/); assert.equal(bored.invitation.action, 'play')
  const tired = story(withCare(orbi, { food: 80, fun: 80, energy: 30, asleepAt: null }, at(NOON)), NOON)
  assert.match(tired.story[2], /yawns/); assert.equal(tired.invitation.action, 'rest')
  const happy = story(fresh(orbi), NOON)
  assert.notEqual(happy.story[2], hungry.story[2])
  // asleep, it dreams, and still says how it is doing
  const asleep = story(withCare(orbi, { food: 40, fun: 80, energy: 60, asleepAt: at(NOON) - 3_600_000 }, at(NOON)), NOON)
  assert.match(asleep.story[0], /curled up asleep/); assert.match(asleep.story[0], /In its dreams, |Nothing much|calm day/)
  assert.match(asleep.story[2], /Its energy is at \d+%, and it’s resting it back up\. Its happiness is at 80%, and its sustenance is at 40%\. It may wake up hungry\./)
  assert.equal(asleep.invitation.action, 'feed')
})

test('what you have done together, and milestones, come into it', () => {
  const day1 = story(fresh(orbi, '2026-11-12T17:00:00Z'), '2026-11-12T17:00:00Z')
  const cared: JourneyEvent = { eventId: `care:${orbi.companionId}:2026-11-12`, companionId: orbi.companionId, type: 'care', at: at('2026-11-12T18:00:00Z') }
  const kept: JourneyEvent = { eventId: storyEventId(orbi.companionId, day1.day), companionId: orbi.companionId, type: 'story', at: day1.writtenAt, data: day1 as any }
  const later = withCounts(fresh(orbi, '2026-11-15T17:00:00Z'), { fed: 2, played: 3, pets: 1 })
  const s = story(later, '2026-11-15T17:00:00Z', [cared, kept])
  assert.match(s.story[3], /It has been 3 days since you last looked after it\. It kept watch over the Cosmic Grove/)
  assert.match(s.story[3], /Since its last story, you’ve shared 2 meals, 3 games of star ball and 1 pat\./)
  const ctx = narrativeContext(later, readDaily(later.celestial!, { timeZone: NY, now: at('2026-11-15T17:00:00Z') }), [cared, kept], at('2026-11-15T17:00:00Z'))
  assert.deepEqual([ctx.relationship.daysAway, ctx.relationship.careDaysThisWeek, ctx.relationship.hatchedToday], [3, 1, false])
  // hatched today, and its birthday
  const born = cozmling('test-story-3', '2026-11-13', at('2026-11-13T15:00:00Z'), 'Kip')
  const first = story(withCare(born, { food: 80, fun: 80, energy: 90, asleepAt: null }, at(NOON)), NOON)
  assert.match(first.story[0], /^Today Kip the Sprout saw the Cosmic Grove for the very first time/)
  assert.match(first.story[3], /only just hatched[\s\S]*today is its birthday/)
  // close to its next stage
  const near = story(withCounts(fresh(orbi), { fed: 35 }), NOON)
  assert.match(near.story[3], /only 5 points from becoming a Cadet/)
})

test('a new day begins at the player’s midnight; the same day keeps one story, kept once in the store', async () => {
  const late = at('2026-11-14T04:59:00Z'), dawn = nextMidnight(late, NY) + 60_000            // 11:59 pm, then 12:01 am in New York
  const a = story(fresh(orbi), new Date(late).toISOString()), b = story(fresh(orbi), new Date(dawn).toISOString())
  assert.equal(a.day, '2026-11-13'); assert.equal(b.day, '2026-11-14')
  assert.notEqual(storyEventId(orbi.companionId, a.day), storyEventId(orbi.companionId, b.day))
  assert.equal(story(fresh(orbi), '2026-11-13T09:00:00Z').day, story(fresh(orbi), '2026-11-14T04:00:00Z').day, 'morning and late evening are the same day in New York')
  // the store keeps a day's story once, however often it is offered
  const repo = memoryRepository(), store = createStore(repo, { storage: (globalThis as any).localStorage, now: () => late, newId: () => 'x', hash: checksum })
  await store.hydrate()
  const e = (s: typeof a): JourneyEvent => ({ eventId: storyEventId(orbi.companionId, s.day), companionId: orbi.companionId, type: 'story', at: s.writtenAt, data: s as any })
  assert.deepEqual(await store.keepEvent(e(a)), { ok: true, kept: true })
  assert.deepEqual(await store.keepEvent(e(a)), { ok: true, kept: false }, 'a refresh or second tab writes nothing')
  assert.deepEqual(await store.keepEvent(e(b)), { ok: true, kept: true })
  const kept = (await store.events(orbi.companionId)).filter(x => x.type === 'story')
  assert.deepEqual(kept.map(x => x.eventId), [storyEventId(orbi.companionId, '2026-11-13'), storyEventId(orbi.companionId, '2026-11-14')])
})

test('the invitation is seen to be taken up from what happens, and nothing is rewarded', () => {
  const s = story(withCare(orbi, { food: 20, fun: 80, energy: 85, asleepAt: null }, at(NOON)), NOON)
  assert.equal(s.invitation.action, 'feed')
  /** How it is doing now, as the story panel reads it. */
  const now = (c: Companion) => { const p = look(c, at(NOON) + 120_000).pet; return { counters: { fed: p.fed, played: p.played, pets: p.pets, arcade: p.arcade ?? 0 }, energy: p.energy, asleep: !!p.asleep } }
  const before = withCare(orbi, { food: 20, fun: 80, energy: 85, asleepAt: null }, at(NOON))
  assert.equal(invitationDone(s, now(before), null), false)
  const fed = careFor(before, { do: 'feed', food: 'cheese' }, at(NOON) + 60_000).companion!
  assert.equal(invitationDone(s, now(fed), null), true)
  assert.deepEqual(Object.keys(fed).sort(), Object.keys(before).sort(), 'feeding is just care: no reward field appears')
  const visit = { ...s, invitation: { action: 'observatory' as const, text: '' } }
  assert.equal(invitationDone(visit, now(before), '2026-11-12'), false); assert.equal(invitationDone(visit, now(before), '2026-11-13'), true)
})

test('where a theme comes from: an editorial theme for a date, the licensed slot off, a failing source skipped', () => {
  const report = readDaily(orbi.celestial!, { timeZone: NY, now: at(NOON) }), input = { report, natal: orbi.celestial! }
  assert.equal(themeFor(input).source.id, 'first-party')
  assert.equal(SOURCES.find(s => s.id === 'licensed')!.enabled, false, 'no licensed feed is used')
  EDITORIAL['2026-11-13'] = { kind: 'growth', title: 'Planting day' }
  try {
    const t = themeFor(input)
    assert.deepEqual([t.source.id, t.kind, t.title], ['editorial', 'growth', 'Planting day'])
    assert.equal(t.transit, firstParty.themeFor(input)!.transit, 'the transit still comes from the real sky')
    const s = writeDailyStory(narrativeContext(fresh(orbi), report, [], at(NOON)), t, at(NOON))
    assert.equal(s.title, 'Planting day'); assert.equal(s.source.id, 'editorial')
  } finally { delete EDITORIAL['2026-11-13'] }
  const broken = { id: 'licensed' as const, enabled: true, themeFor: () => { throw new Error('the feed is down') } }
  assert.equal(themeFor(input, [broken, firstParty]).source.id, 'first-party', 'a source that fails is skipped')
})

test('a story never forecasts, never decides, and always has its sky', () => {
  const states = [{ food: 80, fun: 80, energy: 90 }, { food: 10, fun: 50, energy: 70 }, { food: 60, fun: 10, energy: 20 }]
  let n = 0
  for (let d = 0; d < 21; d++) for (const [i, st] of states.entries()) for (const c of [orbi, nova]) {
    const nowIso = new Date(at('2026-11-13T15:00:00Z') + d * 86_400_000 + i * 3 * 3_600_000).toISOString()
    const s = story(withCare(c, { ...st, asleepAt: d % 4 === 3 ? at(nowIso) - 3_600_000 : null }, at(nowIso)), nowIso)
    const words = [...s.story, ...s.influence.lines, s.invitation.text, s.reflection].join(' ')
    assert.doesNotMatch(words, /\b(will|always|never|destined|guarantee[sd]?|must)\b/i, words)
    assert.doesNotMatch(words, /\{\w+\}|undefined|NaN/, words)
    n++
  }
  assert.equal(n, 126)
})
