/* Story Mode: choices carried forward between visits, characters who act on what they know, follow-ups
   chosen from saved history, the story day and the growth stage, and the same story for every
   Starprint. Played through The Fading Starflower. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { worldFrom, dueEvents, addDays, knows } = await import('../src/cozmling/story/world')
const { nextVisit, choiceEvent, render, arcProblems } = await import('../src/cozmling/story/arc')
const { STARFLOWER, ARCS, flowerOn } = await import('../src/cozmling/story/starflower')
const { ARCHETYPES } = await import('../src/cozmling/story/voices')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const TS = await import('../src/cozmling/story/testSave')
import type { JourneyEvent } from '../src/cozmling/types'

const CID = 'test-sm-1', D = '2026-11-13'
/** A save, as Story Mode uses one: events kept once each. */
function newSave() {
  const repo = memoryRepository()
  return { repo, events: () => repo.events(CID), keep: async (e: JourneyEvent) => { const r = await repo.write({ events: [e] }); return r.ok ? 'kept' : r.reason } }
}
type Save = ReturnType<typeof newSave>
/** A visit on a story day, the way the page does it: the world catches up, then the director picks. */
async function visit(s: Save, day: string, stage: any = 'cadet', run = 'main') {
  let w = worldFrom(await s.events(), run)
  for (const e of dueEvents(w, day, CID, Date.parse(day))) await s.keep(e)
  w = worldFrom(await s.events(), run)
  return { w, v: nextVisit(w, { day, stage }, ARCS) }
}
async function choose(s: Save, day: string, choiceId: string, archetype: any = 'Keeper', run = 'main') {
  const { v } = await visit(s, day, 'cadet', run)
  assert.equal(v.kind, 'scene', `a scene to choose in on ${day}`)
  if (v.kind !== 'scene') throw new Error()
  const e = choiceEvent(v.arc, v.scene, v.ctx, choiceId, { companionId: CID, name: 'Orbi', archetype }, run, Date.parse(day) + 3_600_000)
  return { e, kept: await s.keep(e), v }
}
const text = (v: any, archetype: any = 'Keeper') => v.kind === 'scene' ? render(v.arc, v.scene, v.ctx, { name: 'Orbi', archetype }) : null
const words = (r: any) => r.paragraphs.filter((p: any) => !p.voice).map((p: any) => p.text).join(' ')

test('the starflower: every route finishes in three visits, one a story day, each ending at a place to stop', async () => {
  // every way through, by the director's own choices
  const routes: string[][] = [], played: { path: string[]; finished: boolean }[] = []
  for (const a of ['stay', 'ask', 'rest']) {
    const second = { stay: ['show', 'later'], ask: ['tell', 'sit'], rest: ['walk', 'linger'] }[a]!
    for (const b of second) {
      const third = { stay: ['keep', 'give'], ask: ['leave', 'back'], rest: ['moon', 'stream'] }[a]!
      for (const c of third) routes.push([a, b, c])
    }
  }
  assert.equal(routes.length, 12)
  const scenes = new Set<string>()
  for (const route of routes) {
    const s = newSave(), path: string[] = []
    for (const [i, pick] of route.entries()) {
      const day = addDays(D, i)
      const { kept, v } = await choose(s, day, pick)
      assert.equal(kept, 'kept'); scenes.add((v as any).scene.id); path.push((v as any).scene.id); assert.equal((v as any).number, i + 1)
      // after choosing: what followed, ending at a place to stop, until the next story day
      const after = (await visit(s, day)).v
      assert.equal(after.kind, 'today')
      const outcome = (after as any).last.shown.outcome as string[]
      assert.equal(outcome[outcome.length - 1], STARFLOWER.stop)
      if (i === 2) assert.ok(outcome.includes(STARFLOWER.closing), 'the last visit closes the story')
    }
    const w = worldFrom(await s.events(), 'main')
    assert.equal(w.arcs.starflower.finished, addDays(D, 2)); assert.equal(w.arcs.starflower.visits.length, 3)
    played.push({ path, finished: !!w.arcs.starflower.finished })
    assert.equal((await visit(s, addDays(D, 3))).v.kind, 'quiet', 'and then it is over')
  }
  assert.deepEqual([...scenes].sort(), STARFLOWER.scenes.map(x => x.id).sort(), 'every scene is reached')
  assert.deepEqual(arcProblems(STARFLOWER, () => played), [], 'every route finishes in three visits, and no scene is out of reach')
})

test('Ask for help: the lamplighter promises a lantern after the route; the next day it stands by the same stone, kept once', async () => {
  const s = newSave()
  const { v } = await choose(s, D, 'ask')
  assert.match(words(text(v)), /beside a mossy stone, Orbi finds a starflower[\s\S]*the lamplighter has started the evening route/)
  let w = worldFrom(await s.events(), 'main')
  assert.deepEqual([w.promises.lantern.status, w.promises.lantern.by, w.promises.lantern.dueOn], ['open', 'lamplighter', addDays(D, 1)])
  assert.equal(w.objects.lantern, undefined, 'no lantern yet')
  assert.equal((await visit(s, D)).v.kind, 'today', 'one visit a story day')
  // the next story day: the world keeps the promise first, then the follow-up is chosen
  const due = dueEvents(w, addDays(D, 1), CID, 0)
  assert.equal(due.length, 1); assert.equal(due[0].eventId, `sm:${CID}:main:starflower:keep-lantern`)
  assert.equal(await s.keep(due[0]), 'kept'); assert.equal(await s.keep(due[0]), 'duplicate', 'a retried day keeps it once')
  const day2 = await visit(s, addDays(D, 1))
  w = day2.w
  assert.deepEqual(w.objects.lantern, { at: 'stone', since: addDays(D, 1) })
  assert.deepEqual(dueEvents(w, addDays(D, 1), CID, 0), [], 'nothing left to keep')
  assert.equal((await s.events()).filter(e => e.eventId.endsWith('keep-lantern')).length, 1)
  // what changed shows: the lantern in the scene and the picture, the lamplighter's own view
  const v2 = day2.v as any, r = text(v2)!
  assert.equal(v2.scene.id, 'lantern'); assert.equal(r.picture.lantern, 'stone'); assert.equal(r.picture.flower, 'curled')
  assert.match(words(r), /Beside the same stone stands a small brass lantern, its glass still warm\. The lamplighter kept the promise, once the route was done\./)
  assert.match(words(r), /Its friend comes over the stream and stops\. “Where did that lantern come from\?”/, 'its friend was elsewhere, so it asks')
  assert.deepEqual([knows(w, 'lamplighter', 'petals-curled')?.how, knows(w, 'lamplighter', 'frost')?.how, knows(w, 'friend', 'promise:lantern')], ['saw', 'guessed', null])
  await choose(s, addDays(D, 1), 'tell')
  assert.equal(knows(worldFrom(await s.events(), 'main'), 'friend', 'promise:lantern')?.from, 'cozmling', 'now its friend has heard')
  // the third visit: the lamplighter acts on what they saw and guessed, and offers a new choice
  const v3 = (await visit(s, addDays(D, 2))).v as any
  assert.equal(v3.scene.id, 'return')
  assert.match(words(text(v3)), /the petals were already curled,” they say\. “I think the frost got here first\. I can’t be sure\.”/)
  assert.deepEqual(text(v3)!.choices.map((c: any) => c.id), ['leave', 'back'])
  await choose(s, addDays(D, 2), 'leave')
  assert.deepEqual(worldFrom(await s.events(), 'main').objects.lantern, { at: 'path', since: addDays(D, 2) })
})

test('Stay a while: what it saw is kept and shared later; its friend, who was elsewhere, asks what happened', async () => {
  const s = newSave()
  await choose(s, D, 'stay')
  let w = worldFrom(await s.events(), 'main')
  assert.equal(knows(w, 'cozmling', 'petal-fold')?.how, 'saw'); assert.equal(knows(w, 'friend', 'starflower'), null)
  const v2 = (await visit(s, addDays(D, 1))).v
  assert.match(words(text(v2)), /“I didn’t see you all evening,” it says\. “What happened here\?”/)
  assert.deepEqual(text(v2)!.choices.map((c: any) => c.label), ['Show your friend how the petals folded.', 'Keep it to yourself for now.'])
  await choose(s, addDays(D, 1), 'show')
  w = worldFrom(await s.events(), 'main')
  assert.deepEqual([knows(w, 'friend', 'petal-fold')?.how, knows(w, 'friend', 'petal-fold')?.from], ['heard', 'cozmling'])
  const v3 = (await visit(s, addDays(D, 2))).v
  assert.match(words(text(v3)), /In its sketch, the petals fold toward the warm side of the stone, just the way it saw them that night\. Its friend adds the stream and the moss/)
})

test('Rest for now: its friend’s offer comes back as a new choice; the walk opens a question about where to go next', async () => {
  const s = newSave()
  await choose(s, D, 'rest')
  assert.ok(worldFrom(await s.events(), 'main').offers['walk-back'])
  const v2 = (await visit(s, addDays(D, 1))).v
  assert.match(words(text(v2)), /“Shall we walk back together, like we said\?”/)
  assert.equal(text(v2)!.choices[0].label, 'Walk back together, the long way round.')
  await choose(s, addDays(D, 1), 'walk')
  const v3 = (await visit(s, addDays(D, 2))).v
  assert.match(words(text(v3)), /On the way back, its friend asks, “Where should we go next time\?”/)
  await choose(s, addDays(D, 2), 'stream')
  assert.equal(worldFrom(await s.events(), 'main').threads['next-walk'].note, 'along the stream', 'something a later story can pick up')
})

test('skipped visits: a short catch-up, the promise kept on the day it fell due, the flower as the world’s rules left it', async () => {
  const s = newSave()
  await choose(s, D, 'ask')
  const back = addDays(D, 3)                                                   // away for three story days
  const { w, v } = await visit(s, back)
  assert.equal(w.promises.lantern.keptOn, addDays(D, 1), 'kept the day it fell due, not the day you came back')
  const r = text(v)!
  assert.match(words(r), /^It has been three days since Orbi was last by the mossy stone\. The starflower has closed for the season\./)
  assert.match(words(r), /Beside the same stone stands a small brass lantern\. The lamplighter kept the promise/)
  assert.doesNotMatch(words(r), /still warm/)
  assert.equal(r.picture.flower, 'seeds')
  // the flower's rule is the same for every choice and everyone
  for (const d of [0, 1, 2, 5]) assert.equal(flowerOn(D, addDays(D, d)), ['fading', 'curled', 'seeds', 'seeds', 'seeds', 'seeds'][d])
})

test('a choice pressed twice, a refresh or a second tab: its effects are applied once', async () => {
  const s = newSave()
  const first = await choose(s, D, 'rest')
  assert.equal(first.kept, 'kept'); assert.equal(await s.keep(first.e), 'duplicate')
  // the same scene chosen again in another tab, before it saw the first choice
  const v = first.v as any, other = choiceEvent(v.arc, v.scene, v.ctx, 'ask', { companionId: CID, name: 'Orbi', archetype: 'Seeker' }, 'main', Date.parse(D) + 9e6)
  assert.equal(other.eventId, first.e.eventId); assert.equal(await s.keep(other), 'duplicate', 'one choice per scene: the first one stands')
  const w = worldFrom(await s.events(), 'main')
  assert.equal(w.arcs.starflower.branch, 'rest'); assert.equal(w.arcs.starflower.visits.length, 1); assert.equal(w.promises.lantern, undefined)
})

test('every Starprint gets the same story, choices and outcomes on the same day, stage and history; only its voice differs', async () => {
  const route = { stay: ['stay', 'show', 'give'], ask: ['ask', 'tell', 'back'], rest: ['rest', 'linger', 'moon'] }
  for (const [branch, picks] of Object.entries(route)) {
    const seen: { world: string; scenes: string[]; voices: string[] }[] = []
    for (const a of [...ARCHETYPES, null]) {
      const s = newSave(), scenes: string[] = [], voices: string[] = []
      for (const [i, pick] of picks.entries()) {
        const day = addDays(D, i), { v } = await visit(s, day), r = text(v, a)!
        scenes.push(JSON.stringify({ id: (v as any).scene.id, words: words(r), choices: r.choices, picture: r.picture }))
        voices.push(r.paragraphs.filter((p: any) => p.voice).map((p: any) => p.text).join(' | '))
        await choose(s, day, pick, a)
      }
      const w = worldFrom(await s.events(), 'main')
      seen.push({ world: JSON.stringify({ ...w, log: w.log.map(d => ({ ...d, shown: undefined })) }), scenes, voices })
    }
    for (const x of seen) { assert.equal(x.world, seen[0].world, `${branch}: the same outcomes`); assert.deepEqual(x.scenes, seen[0].scenes, `${branch}: the same scenes and choices`) }
    assert.equal(new Set(seen.slice(0, 12).map(x => x.voices.join(' / '))).size, 12, `${branch}: twelve voices`)
    assert.equal(seen[12].voices.join(''), '', 'with no Starprint, the same story without a voice line')
  }
})

test('growth stage and old saves: the starflower waits for Cadet; a save with no story history loads as an empty world', async () => {
  const old: JourneyEvent[] = [
    { eventId: 'hatch:x', companionId: CID, type: 'hatched', at: 1 },
    { eventId: `story:${CID}:${D}`, companionId: CID, type: 'story', at: 2, data: { schema: 1, kind: 'play' } },
    { eventId: `choice:${CID}:bridge-after-rain@draft-0.3:abc`, companionId: CID, type: 'choice-story', at: 3, data: { schema: 1 } },
  ]
  const w = worldFrom(old, 'main')
  assert.deepEqual([Object.keys(w.arcs), w.log], [[], []])
  const sprout = nextVisit(w, { day: D, stage: 'sprout' }, ARCS) as any
  assert.deepEqual([sprout.kind, sprout.stage], ['waiting', 'cadet'])
  for (const stage of ['cadet', 'explorer', 'guardian'] as const) assert.equal((nextVisit(w, { day: D, stage }, ARCS) as any).scene.id, 'find')
  // a story already under way carries on whatever the stage (a test that sets it back, say)
  const s = newSave(); await choose(s, D, 'ask')
  assert.equal(((await visit(s, addDays(D, 1), 'sprout')).v as any).scene.id, 'lantern')
})

test('the preview’s test save: its own story day, advanced once per tap, reset to a new run, the regular save untouched', async () => {
  TS.useTestRepo(memoryRepository())
  const main = newSave()
  await choose(main, D, 'stay')                                                   // the regular save has its own story
  const before = JSON.stringify(await main.events())
  let t = await TS.startTestSave(CID, D)
  assert.deepEqual([t.active, t.run, t.day, t.stage], [true, 1, D, null])
  t = (await TS.setTestStage(CID, 'cadet'))!
  // play the test story in the test save's own run
  const testSave = { events: () => TS.testEvents(CID), keep: async (e: JourneyEvent) => { const r = await TS.keepTestEvent(e); return r.ok ? (r.kept ? 'kept' : 'duplicate') : 'failed' } } as unknown as Save
  await choose(testSave, t.day, 'ask', 'Keeper', TS.testRun(t))
  // advance one story day: the same tap twice moves it once
  const [a, b] = await Promise.all([TS.advanceTestDay(CID, D), TS.advanceTestDay(CID, D)])
  assert.equal(a!.day, addDays(D, 1)); assert.equal(b!.day, addDays(D, 1))
  t = (await TS.readTestSave(CID))!; assert.equal(t.day, addDays(D, 1))
  const day2 = await visit(testSave, t.day, 'cadet', TS.testRun(t))
  assert.equal((day2.v as any).scene.id, 'lantern'); assert.equal(day2.w.objects.lantern.at, 'stone', 'the lantern is there')
  // retrying the same day's catch-up keeps nothing twice
  await visit(testSave, t.day, 'cadet', TS.testRun(t)); await visit(testSave, t.day, 'cadet', TS.testRun(t))
  assert.equal((await TS.testEvents(CID)).filter(e => e.eventId.includes('keep-lantern')).length, 1)
  // reset: a new run from today, an empty story again; the earlier run is left alone; the regular save untouched
  t = await TS.resetTestStory(CID, D)
  assert.deepEqual([t.run, t.day, t.stage], [2, D, 'cadet'])
  const fresh = await visit(testSave, t.day, 'cadet', TS.testRun(t))
  assert.equal((fresh.v as any).scene.id, 'find'); assert.equal(Object.keys(fresh.w.arcs).length, 0)
  assert.equal(JSON.stringify(await main.events()), before, 'the regular save is exactly as it was')
  assert.ok((await main.events()).every(e => !String(e.data?.run ?? '').startsWith('test')), 'and holds nothing from the test save')
  assert.equal((await TS.leaveTestSave(CID))!.active, false)
})
