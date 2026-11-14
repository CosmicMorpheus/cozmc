/* Story Mode on a Cozmling's page: today's visit, worked out from its saved story, and the choice to make.

   - The story day is the player's own calendar day (the same boundary as the daily story), looked at
     again every minute; in a preview test save, it is that save's simulated day.
   - Each time it looks, the world catches up first (a promise that has fallen due is kept, once, by
     the same rules for everyone), then the director picks today's visit.
   - A choice is kept as one event with a stable id: pressing it twice, refreshing or a second tab
     applies it once. The page then shows what followed, until the next story day.
   - The growth stage is the Cozmling's own (or, in a test save, the stage chosen for the test).
     Nothing here reads its sign, chart or any notes: the Starprint only gives the voice lines. */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Stage } from '../../companion/look'
import { COZMLING_DEV, cozmlingStore } from '../index'
import { localDay, playerTimeZone } from '../celestial/observatory'
import { nameOf } from '../domain/care'
import { originalStage } from '../integrations/originalScene'
import type { Companion, JourneyEvent } from '../types'
import { choiceEvent, nextVisit, stageReached, type Visit } from './arc'
import { ARCS } from './starflower'
import * as testSave from './testSave'
import { voiceOf } from './voices'
import { dueEvents, worldFrom, type World } from './world'

type Keep = (e: JourneyEvent) => Promise<{ ok: true; kept: boolean } | { ok: false; detail: string }>
export interface StoryModeState {
  status: 'loading' | 'ready' | 'failed'
  /** the story day being played */
  day: string
  stage: Stage
  world: World | null
  visit: Visit | null
  busy: boolean
  choose: (choiceId: string) => Promise<void>
  /** the preview test save (null in production builds, and until one is made) */
  test: testSave.TestSave | null
  /** the preview's test controls (undefined in production builds) */
  testing?: {
    start: () => Promise<void>
    leave: () => Promise<void>
    advance: () => Promise<void>
    reset: () => Promise<void>
    setStage: (stage: Stage | null) => Promise<void>
  }
}

/** The arcs that can be told here: drafts only on the preview site and in local work. */
export const ARCS_HERE = ARCS.filter(a => a.status === 'approved' || COZMLING_DEV)

export function useStoryMode(c: Companion): StoryModeState {
  const id = c.companionId
  const [today, setToday] = useState(() => localDay(Date.now(), playerTimeZone()))
  useEffect(() => { const t = setInterval(() => setToday(localDay(Date.now(), playerTimeZone())), 60_000); return () => clearInterval(t) }, [])
  const [test, setTest] = useState<testSave.TestSave | null>(null)
  // the world, and the story day and run it was worked out for: a new day's visit waits until its world has caught up
  const [loaded, setLoaded] = useState<{ world: World; day: string; run: string } | null>(null)
  const [status, setStatus] = useState<StoryModeState['status']>('loading')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  // the preview's test save, if there is one (never looked for in a production build)
  useEffect(() => {
    if (!COZMLING_DEV) return
    let on = true
    testSave.readTestSave(id).then(s => { if (on) setTest(s) }, () => {})
    return () => { on = false }
  }, [id, tick])

  const testing = COZMLING_DEV && test?.active ? test : null
  const run = testing ? testSave.testRun(testing) : 'main'
  const day = testing ? testing.day : today
  const stage = testing?.stage ?? originalStage(c)
  const save = useMemo<{ events: () => Promise<JourneyEvent[]>; keep: Keep }>(() => (run === 'main'
    ? { events: () => cozmlingStore()!.events(id), keep: e => cozmlingStore()!.keepEvent(e) }
    : { events: () => testSave.testEvents(id), keep: testSave.keepTestEvent }), [run, id])

  // the world on this story day: what has fallen due is kept first (once), then everything is read again
  useEffect(() => {
    let on = true
    ;(async () => {
      let w = worldFrom(await save.events(), run)
      const due = dueEvents(w, day, id, Date.now())
      if (due.length) {
        for (const e of due) { const r = await save.keep(e); if (!r.ok) throw new Error(r.detail) }
        w = worldFrom(await save.events(), run)
      }
      if (on) { setLoaded({ world: w, day, run }); setStatus('ready') }
    })().catch(() => { if (on) setStatus('failed') })
    return () => { on = false }
  }, [save, run, day, id, tick])

  // never a visit from another day's world (a scene shown before a promise that fell due today is kept)
  const world = loaded && loaded.day === day && loaded.run === run ? loaded.world : null
  const visit = world ? nextVisit(world, { day, stage }, ARCS_HERE) : null

  const choose = useCallback(async (choiceId: string) => {
    if (!visit || visit.kind !== 'scene' || busy) return
    setBusy(true)
    try { await save.keep(choiceEvent(visit.arc, visit.scene, visit.ctx, choiceId, { companionId: id, name: nameOf(c), archetype: voiceOf(c) }, run, Date.now())) }
    finally { setBusy(false); setTick(t => t + 1) }
  }, [visit, busy, save, id, c, run])

  // when the Cozmling is too young for every story here, a test save starts at the youngest stage one of them needs, so a story can begin at once
  const own = originalStage(c)
  const needs = ARCS_HERE.some(a => stageReached(own, a.minStage)) ? null
    : ARCS_HERE.reduce<Stage | null>((lo, a) => lo && stageReached(a.minStage, lo) ? lo : a.minStage, null)
  const act = (f: () => Promise<unknown>) => async () => { setBusy(true); try { await f() } finally { setBusy(false); setTick(t => t + 1) } }
  const testingTools: StoryModeState['testing'] = COZMLING_DEV ? {
    start: act(() => testSave.startTestSave(id, today, needs)),
    leave: act(() => testSave.leaveTestSave(id)),
    advance: act(() => testSave.advanceTestDay(id, day)),
    reset: act(() => testSave.resetTestStory(id, today, needs)),
    setStage: (s: Stage | null) => act(() => testSave.setTestStage(id, s))(),
  } : undefined

  return { status: visit ? 'ready' : status === 'failed' ? 'failed' : 'loading', day, stage, world, visit, busy, choose, test: COZMLING_DEV ? test : null, testing: testingTools }
}
