/* A Cozmling's story for today, written once and kept.

   - Today's sky report comes from useLiveSky (read once a day, saved; the astronomy is loaded only if
     it isn't saved yet).
   - The first time the page is open on a new day (or at the player's midnight, with the page open),
     the story is written from that report and how the Cozmling is doing right then, and kept as one
     event, `story:<id>:<day>`. A refresh, a second tab or another try finds it instead of writing
     another: the same day never gets two stories.
   - If today's sky can't be read (the astronomy can't load), the last story kept is shown, labelled
     with its own day, never passed off as today's. */
import { useEffect, useRef, useState } from 'react'
import { cozmlingStore } from '../index'
import type { DailyCelestialReport } from '../celestial/daily'
import { useLiveSky } from '../celestial/useLiveSky'
import type { Companion, JourneyEvent } from '../types'
import { narrativeContext } from './context'
import { asStory, storyEventId, writeDailyStory, type DailyStory } from './engine'
import { themeFor } from './source'
import { localDay, playerTimeZone } from '../celestial/observatory'

export interface DailyStoryState {
  /** 'none': no story for this Cozmling (no sky yet, or not hatched) */
  status: 'none' | 'loading' | 'ready' | 'offline'
  story: DailyStory | null
  /** the story shown is from an earlier day (today's sky couldn't be read) */
  earlier: boolean
  report: DailyCelestialReport | null
  /** the day the player last opened today's sky (for the "look at today's sky" invitation) */
  skyVisit: string | null
}

/** The key under which the day the observatory's Today view was last opened is kept. */
export const skyVisitKey = (companionId: string) => `sky-visit:${companionId}`
const latestStory = (events: JourneyEvent[]) => events.filter(e => e.type === 'story').sort((a, b) => a.at - b.at).map(e => asStory(e.data)).filter(Boolean).pop() ?? null

export function useDailyStory(c: Companion): DailyStoryState {
  const can = !!c.celestial && c.hatch.status === 'hatched'
  const sky = useLiveSky(c, { live: false, enabled: can })
  const [kept, setKept] = useState<{ story: DailyStory | null; earlier: boolean; skyVisit: string | null }>({ story: null, earlier: false, skyVisit: null })
  const now = useRef(c)
  now.current = c
  const report = sky.report, day = report?.day ?? null, id = c.companionId

  // today's story: found, or written and kept
  useEffect(() => {
    const store = cozmlingStore()
    if (!can || !store || !report || !day) return
    let alive = true
    ;(async () => {
      const eventId = storyEventId(id, day)
      const [events, visit] = await Promise.all([store.events(id), store.readMeta(skyVisitKey(id)).catch(() => null)])
      let story = asStory(events.find(e => e.eventId === eventId)?.data)
      if (!story) {
        const cur = now.current, at = Date.now()
        if (!cur.celestial) return
        const ctx = narrativeContext(cur, report, events, at)
        const fresh = writeDailyStory(ctx, themeFor({ report, natal: cur.celestial, stage: ctx.stage, recentKinds: ctx.recentKinds }), at)
        const res = await store.keepEvent({ eventId, companionId: id, type: 'story', at, data: fresh as unknown as Record<string, unknown> })
        if (res.ok && res.kept) story = fresh
        else story = asStory((await store.events(id)).find(e => e.eventId === eventId)?.data)       // another tab wrote it first: show that one
      }
      if (alive && story) setKept({ story, earlier: false, skyVisit: typeof visit === 'string' ? visit : null })
    })().catch(() => { /* tried again next time the page opens */ })
    return () => { alive = false }
  }, [can, id, day, report])

  // offline, with no report for today: today's story if it was already written, or else the last one kept, with its own day
  useEffect(() => {
    const store = cozmlingStore()
    if (!can || !store || sky.status !== 'offline' || report) return
    let alive = true
    store.events(id).then(events => {
      const s = latestStory(events)
      if (alive && s) setKept({ story: s, earlier: s.day !== localDay(Date.now(), playerTimeZone()), skyVisit: null })
    }, () => {})
    return () => { alive = false }
  }, [can, id, sky.status, report])

  const story = kept.story && (kept.earlier || kept.story.day === (day ?? kept.story.day)) ? kept.story : null
  return {
    status: !can ? 'none' : story && !kept.earlier ? 'ready' : sky.status === 'offline' ? 'offline' : 'loading',
    story, earlier: !!story && kept.earlier, report, skyVisit: kept.skyVisit,
  }
}
