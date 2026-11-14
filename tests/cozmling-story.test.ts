/* A Cozmling's daily story (celestial MVP 3): its parts, that it follows the real game state, that it
   is one fixed thing per day, that it is chosen from the day, growth stage and story history (never
   the sign or chart, which only change its voice and its sky reading), and that it never forecasts. `npm test`. */
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
const { themeFor, firstParty, EDITORIAL, SOURCES, storyKind } = await import('../src/cozmling/story/source')
const { writeDailyStory, invitationDone, storyEventId, asStory, STORY_ENGINE } = await import('../src/cozmling/story/engine')
const { THEMES, DAY_KINDS, MOMENT_BY_KIND, MOMENT_SETUP, ASLEEP_SETUP } = await import('../src/cozmling/story/themes')
const { VOICES } = await import('../src/cozmling/story/voices')
const { signFor } = await import('../src/cozmling/domain/starprint')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const { createStore } = await import('../src/cozmling/store/companionStore')
const { checksum } = await import('../src/cozmling/store/util')
import type { AdventurerCompanion, Companion, JourneyEvent } from '../src/cozmling/types'

const NY = 'America/New_York', at = (iso: string) => Date.parse(iso)
/** A hatched adventurer with its birth sky, as hatching makes one (at the COZMC default, unless another place is given). */
function cozmling(id: string, birthday: string, hatchedAt: number, name = 'Orbi', place?: any): AdventurerCompanion {
  const c = hatch(newAdventurer({ name, birthday, look: 'a', skin: 'sky' }, { companionId: id, now: hatchedAt - 60_000 }), hatchedAt) as AdventurerCompanion
  return { ...c, celestial: castChart({ companionId: id, kind: 'birth', rule: 'chosen-day-hatch-minute', ms: birthMoment(birthday, hatchedAt, place)!, birthday, hatchedAt, displayTimeZone: NY, calculatedAt: hatchedAt, ...(place ? { place } : {}) }) }
}
const withCare = (c: AdventurerCompanion, care: Partial<AdventurerCompanion['care']>, now: number): AdventurerCompanion => ({ ...c, care: { ...c.care, ...care, settledAt: now } })
const withCounts = (c: AdventurerCompanion, counters: Record<string, number>): AdventurerCompanion => ({ ...c, progress: { ...c.progress, counters } })
function story(c: Companion, nowIso: string, events: JourneyEvent[] = []) {
  const now = at(nowIso), report = readDaily(c.celestial!, { timeZone: NY, now }), ctx = narrativeContext(c, report, events, now)
  return writeDailyStory(ctx, themeFor({ report, natal: c.celestial!, stage: ctx.stage, recentKinds: ctx.recentKinds }), now)
}
/** The story itself: everything that must be the same for every Starprint and chart. */
const core = (s: ReturnType<typeof story>) => ({ title: s.title, theme: s.theme, kind: s.kind, story: s.story, moment: s.moment, invitation: s.invitation, reflection: s.reflection })
const orbi = cozmling('test-story-1', '2026-03-30', at('2026-11-10T14:14:30Z'))
const nova = cozmling('test-story-2', '2026-05-05', at('2026-11-10T18:40:00Z'), 'Nova')
const NOON = '2026-11-13T17:00:00Z'
const fresh = (c: AdventurerCompanion, nowIso = NOON) => withCare(c, { food: 80, fun: 70, energy: 85, asleepAt: null }, at(nowIso))

test('a day’s story has every part the brief asks for, from the real sky and the real game state', () => {
  const s = story(fresh(orbi), NOON)
  assert.equal(s.schema, 2); assert.equal(s.day, '2026-11-13'); assert.equal(s.companionId, orbi.companionId)
  assert.ok(s.title.length > 3); assert.equal(s.theme.length, 3)
  assert.match(s.influence.title, /^(The |Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto).* Orbi’s /)
  assert.ok(s.influence.lines.length >= 1)
  assert.equal(s.story.length, 3)
  assert.match(s.story.join(' '), /Its happiness is at 70%, and its sustenance is at 80%\./, 'its real numbers, as in the brief’s example')
  assert.match(s.story[0], /\bOrbi the Sprout\b/, 'its life stage')
  assert.ok(s.invitation.text.includes('Orbi')); assert.ok(s.reflection.length > 10)
  assert.equal(s.source.id, 'first-party'); assert.match(s.source.detail, /^Chosen from the day, its growth stage and its story so far\. .*astronomy-engine 2\.1\.19/)
  assert.deepEqual(s.basis.engine, { ...STORY_ENGINE }); assert.equal(s.basis.reportDay, s.day); assert.equal(s.basis.natalMoment, orbi.celestial!.moment.ms)
  const r = readDaily(orbi.celestial!, { timeZone: NY, now: at(NOON) })
  assert.equal(s.basis.transit, r.transits[0] ? `${r.transits[0].a}-${r.transits[0].kind}-${r.transits[0].b}` : null, 'its sky reading is the day’s strongest transit')
  assert.equal(s.kind, storyKind('2026-11-13', 'sprout', []), 'the story is chosen from the day, its stage and its story so far')
  assert.ok(THEMES[s.kind].titles.includes(s.title))
  // the moment the day pauses on, and Orbi's own line for it: an Aries, so the Pathfinder's voice
  assert.equal(s.moment, MOMENT_BY_KIND[s.kind]); assert.ok(s.story[0].endsWith(MOMENT_SETUP[s.moment!]))
  assert.deepEqual(s.voice, { archetype: 'Pathfinder', line: VOICES.Pathfinder[s.moment!] })
  assert.deepEqual(asStory(JSON.parse(JSON.stringify(s))), s, 'it survives being saved')
})

test('the same Cozmling, day and state always give the same story', () => {
  assert.deepEqual(story(fresh(orbi), NOON), story(fresh(orbi), NOON))
})

test('the same day, growth stage and story history give every Starprint and every chart the same story and choices, each in its own voice', () => {
  // twelve Cozmlings, one per sign, each read three ways (two hatch times at the COZMC default, and born in Reykjavík),
  // all called Orbi, cared for the same way, at the same stage, with the same (empty) story history
  const reykjavik = { id: 'place:test/reykjavik', version: 1, name: 'Reykjavík', place: 'Reykjavík, Iceland', latitude: 64.15, longitude: -21.95, elevationM: null, timeZone: 'Atlantic/Reykjavik', fictional: false, choice: 'chosen' as const }
  const birthdays = ['2026-04-05', '2026-05-05', '2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05', '2026-10-05', '2026-11-05', '2026-12-05', '2026-01-05', '2026-02-05', '2026-03-05']
  const all = birthdays.flatMap((b, i) => [
    cozmling(`test-vary-${i}-a`, b, at('2026-11-10T14:14:30Z')),
    cozmling(`test-vary-${i}-b`, b, at('2026-11-10T05:40:00Z')),
    cozmling(`test-vary-${i}-c`, b, at('2026-11-10T20:00:00Z'), 'Orbi', reykjavik),
  ])
  assert.deepEqual(new Set(all.map(c => c.starprint.coreSign)).size, 12, 'all twelve signs')
  assert.ok(new Set(all.map(c => `${c.celestial!.bodies.moon.sign}|${c.celestial!.angles!.ascendant.sign}`)).size > 12, 'and many different charts')
  const kinds = new Set<string>()
  for (let d = 0; d < 21; d++) {
    const nowIso = new Date(at('2026-11-13T17:00:00Z') + d * 86_400_000).toISOString()
    const stories = all.map(c => story(fresh(c, nowIso), nowIso))
    const first = core(stories[0])
    for (const s of stories) assert.deepEqual(core(s), first, `day ${d}: ${s.companionId} got a different story`)
    // its voice is its own: one line per archetype, and the line its Starprint gives it
    const voices = new Map(stories.map((s, i) => [all[i].starprint.archetype, s.voice!.line]))
    assert.equal(voices.size, 12); assert.equal(new Set(voices.values()).size, 12, 'twelve different voices')
    stories.forEach((s, i) => assert.equal(s.voice!.line, (VOICES as any)[all[i].starprint.archetype][s.moment!]))
    // and its sky reading is its own chart's
    assert.ok(new Set(stories.map(s => s.influence.title)).size > 1, 'the sky reading still differs by chart')
    kinds.add(first.kind)
  }
  assert.ok(kinds.size >= 8, 'three weeks of days go through most kinds of day')
})

test('the story follows the day, the growth stage and the story so far, and nothing about the Cozmling’s identity', () => {
  // the kind of day: steady for the same day, stage and history; it skips the kinds of the last two stories
  for (let d = 0; d < 60; d++) {
    const day = new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10)
    const k = storyKind(day, 'sprout', [])
    assert.equal(storyKind(day, 'sprout', []), k); assert.ok(DAY_KINDS.includes(k))
    const after = storyKind(day, 'sprout', [k]); assert.notEqual(after, k)
    assert.ok(![k, after].includes(storyKind(day, 'sprout', [k, after])))
  }
  const days = Array.from({ length: 30 }, (_, d) => new Date(Date.UTC(2026, 10, 1 + d)).toISOString().slice(0, 10))
  assert.ok(days.some(day => storyKind(day, 'sprout', []) !== storyKind(day, 'cadet', [])), 'a different stage can be a different day')
  // its story history comes from the stories it has kept
  const kept = (day: string, kind: string): JourneyEvent => ({ eventId: storyEventId(orbi.companionId, day), companionId: orbi.companionId, type: 'story', at: at(`${day}T17:00:00Z`), data: { kind, snapshot: { counters: { fed: 0, played: 0, pets: 0, arcade: 0 } } } as any })
  const report = readDaily(orbi.celestial!, { timeZone: NY, now: at(NOON) })
  const ctx = narrativeContext(fresh(orbi), report, [kept('2026-11-10', 'play'), kept('2026-11-11', 'quiet'), kept('2026-11-12', 'dreams')], at(NOON))
  assert.deepEqual(ctx.recentKinds, ['quiet', 'dreams'])
  assert.equal(ctx.seed, '2026-11-13|sprout|quiet,dreams')
  // the same Cozmling under another id: the same story
  const twin = { ...fresh(orbi), companionId: 'test-story-twin' }
  assert.deepEqual(core(story(twin, NOON)), core(story(fresh(orbi), NOON)))
})

test('happiness and sustenance shape the story and its invitation', () => {
  const hungry = story(withCare(orbi, { food: 20, fun: 80, energy: 85, asleepAt: null }, at(NOON)), NOON)
  assert.match(hungry.story[1], /sustenance is at 20%\. It’s hungry/); assert.equal(hungry.invitation.action, 'feed')
  const bored = story(withCare(orbi, { food: 80, fun: 40, energy: 85, asleepAt: null }, at(NOON)), NOON)
  assert.match(bored.story[1], /happiness is at 40%.*star ball towards you/); assert.equal(bored.invitation.action, 'play')
  const tired = story(withCare(orbi, { food: 80, fun: 80, energy: 30, asleepAt: null }, at(NOON)), NOON)
  assert.match(tired.story[1], /yawns/); assert.equal(tired.invitation.action, 'rest')
  const happy = story(fresh(orbi), NOON)
  assert.notEqual(happy.story[1], hungry.story[1])
  // asleep, it dreams, and still says how it is doing
  const asleep = story(withCare(orbi, { food: 40, fun: 80, energy: 60, asleepAt: at(NOON) - 3_600_000 }, at(NOON)), NOON)
  assert.match(asleep.story[0], /curled up asleep/); assert.match(asleep.story[0], /In its dreams, |There is time today|The room is quiet/)
  assert.equal(asleep.moment, 'resting'); assert.ok(asleep.story[0].endsWith(ASLEEP_SETUP)); assert.equal(asleep.voice!.line, VOICES.Pathfinder.resting)
  assert.match(asleep.story[1], /Its energy is at \d+%, and it’s resting it back up\. Its happiness is at 80%, and its sustenance is at 40%\. It may wake up hungry\./)
  assert.equal(asleep.invitation.action, 'feed')
})

test('what you have done together, and milestones, come into it', () => {
  const day1 = story(fresh(orbi, '2026-11-12T17:00:00Z'), '2026-11-12T17:00:00Z')
  const cared: JourneyEvent = { eventId: `care:${orbi.companionId}:2026-11-12`, companionId: orbi.companionId, type: 'care', at: at('2026-11-12T18:00:00Z') }
  const kept: JourneyEvent = { eventId: storyEventId(orbi.companionId, day1.day), companionId: orbi.companionId, type: 'story', at: day1.writtenAt, data: day1 as any }
  const later = withCounts(fresh(orbi, '2026-11-15T17:00:00Z'), { fed: 2, played: 3, pets: 1 })
  const s = story(later, '2026-11-15T17:00:00Z', [cared, kept])
  assert.match(s.story[2], /It has been 3 days since you last looked after it\. It kept watch over the Cosmic Grove/)
  assert.match(s.story[2], /Since its last story, you’ve shared 2 meals, 3 games of star ball and 1 pat\./)
  const ctx = narrativeContext(later, readDaily(later.celestial!, { timeZone: NY, now: at('2026-11-15T17:00:00Z') }), [cared, kept], at('2026-11-15T17:00:00Z'))
  assert.deepEqual([ctx.relationship.daysAway, ctx.relationship.careDaysThisWeek, ctx.relationship.hatchedToday], [3, 1, false])
  // hatched today, and its birthday
  const born = cozmling('test-story-3', '2026-11-13', at('2026-11-13T15:00:00Z'), 'Kip')
  const first = story(withCare(born, { food: 80, fun: 80, energy: 90, asleepAt: null }, at(NOON)), NOON)
  assert.match(first.story[0], /^Today Kip the Sprout saw the Cosmic Grove for the very first time/); assert.equal(first.moment, 'noticing')
  assert.match(first.story[2], /only just hatched[\s\S]*today is its birthday/)
  // close to its next stage
  const near = story(withCounts(fresh(orbi), { fed: 35 }), NOON)
  assert.match(near.story[2], /only 5 points from becoming a Cadet/)
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
  const report = readDaily(orbi.celestial!, { timeZone: NY, now: at(NOON) }), input = { report, natal: orbi.celestial!, stage: 'sprout' as const, recentKinds: [] }
  assert.equal(themeFor(input).source.id, 'first-party')
  assert.equal(SOURCES.find(s => s.id === 'licensed')!.enabled, false, 'no licensed feed is used')
  EDITORIAL['2026-11-13'] = { kind: 'growth', title: 'Planting day' }
  try {
    const t = themeFor(input)
    assert.deepEqual([t.source.id, t.kind, t.title], ['editorial', 'growth', 'Planting day'])
    assert.equal(t.transit, firstParty.themeFor(input)!.transit, 'the sky reading still comes from the real sky')
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
    const words = [...s.story, s.voice?.line ?? '', ...s.influence.lines, s.invitation.text, s.reflection].join(' ')
    assert.doesNotMatch(words, /\b(will|always|never|destined|guarantee[sd]?|must)\b/i, words)
    assert.doesNotMatch(words, /\{\w+\}|undefined|NaN/, words)
    n++
  }
  assert.equal(n, 126)
})
