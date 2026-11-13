/* Today's sky for a Cozmling, kept current while its page is open.

   - The report saved for today (if there is one) shows at once, before anything loads.
   - Today's report is read once per calendar day in the player's time zone, and saved. A saved
     report from an earlier day is never passed off as today's: it is kept aside, and shown (labelled
     with its day) only if the astronomy can't load, which is the latest valid sky there is.
   - live: the sky right now is worked out again every 10 minutes (the Moon moves about half a degree
     an hour). Without `live` (the Star Loft), the astronomy is loaded only when today's report is
     missing, so a page that only needs today's headline costs nothing once it has been read.
   - At the player's midnight (or if their time zone changes) a new day's report is read.
   - Nothing runs while the page is hidden; coming back to it catches up at once. */
import { useEffect, useRef, useState } from 'react'
import { cozmlingStore } from '../index'
import type { Companion } from '../types'
import { nextMidnight, reportIsCurrent, reportIsFor, type DailyCelestialReport, type SkyNow } from './daily'
import { loadSkyEngine } from './load'
import { playerTimeZone } from './observatory'

export const SKY_REFRESH_MS = 10 * 60_000

export interface LiveSky {
  /** 'loading' until there is something to show; 'offline' if the astronomy can't load; 'none' if there is no sky to compare with. */
  status: 'loading' | 'ready' | 'offline' | 'none'
  /** Today's report. */
  report: DailyCelestialReport | null
  /** The last report saved, from an earlier day: only for showing (labelled) when today's can't be read. */
  earlier: DailyCelestialReport | null
  /** The sky right now (live pages only), and when it was worked out. */
  now: SkyNow | null
  updatedAt: number | null
  timeZone: string
  /** Today's report was saved earlier, not read on this visit. */
  fromSaved: boolean
}

const start = (c: Companion): LiveSky => ({ status: c.celestial ? 'loading' : 'none', report: null, earlier: null, now: null, updatedAt: null, timeZone: playerTimeZone(), fromSaved: false })

export function useLiveSky(c: Companion, { live = true, enabled = true }: { live?: boolean; /** false: do nothing (another view is showing) */ enabled?: boolean } = {}): LiveSky {
  const [sky, setSky] = useState<LiveSky>(() => start(c))
  const natal = useRef(c.celestial)
  natal.current = c.celestial
  const id = c.companionId, moment = c.celestial?.moment.ms ?? null

  useEffect(() => {
    setSky(start(c))
    if (moment == null || !enabled) return
    let alive = true, interval = 0, midnight = 0
    let engine: Awaited<ReturnType<typeof loadSkyEngine>> | null = null, loading = false
    let report: DailyCelestialReport | null = null, looked = false      // looked: what was saved has been read (so a new report is only read when needed)
    const key = `daily:${id}`, store = cozmlingStore()
    const set = (patch: Partial<LiveSky>) => { if (alive) setSky(s => ({ ...s, ...patch })) }
    const due = () => !natal.current || !reportIsCurrent(report, natal.current, playerTimeZone(), Date.now())

    const atMidnight = () => {
      clearTimeout(midnight)
      midnight = window.setTimeout(refresh, Math.max(1000, nextMidnight(Date.now(), playerTimeZone()) - Date.now() + 1000))
    }
    /** Load the astronomy (once; again later if it failed). */
    const load = () => {
      if (loading) return
      loading = true
      loadSkyEngine().then(e => { engine = e; refresh() }, () => { loading = false; set({ status: 'offline' }) })
    }
    function refresh() {
      const sky = natal.current
      if (!alive || !sky || document.hidden) return
      if (!engine) { if (live || due()) load(); return }
      const now = Date.now(), tz = playerTimeZone()
      let patch: Partial<LiveSky> = { status: 'ready', timeZone: tz }
      if (live) patch = { ...patch, now: engine.skyAt(now), updatedAt: now }
      if (looked && due()) {
        report = engine.readDaily(sky, { timeZone: tz, now })
        void store?.writeMeta(key, report).catch(() => {})
        patch = { ...patch, report, fromSaved: false }
      }
      set(patch)
      if (report) atMidnight()
    }

    // what was saved shows straight away: today's as today's; an earlier day's is kept aside
    const saved = store ? store.readMeta(key).catch(() => undefined) : Promise.resolve(undefined)
    void saved.then(r => {
      const sky = natal.current
      looked = true
      if (!alive || !sky) return
      if (reportIsCurrent(r, sky, playerTimeZone(), Date.now())) {
        report = r
        set({ report: r, fromSaved: true, ...(live ? {} : { status: 'ready' as const }) })
        atMidnight()
      } else if (reportIsFor(r, sky)) set({ earlier: r })
      refresh()                            // reads today's report if it is still missing (and, off a live page, only then loads the astronomy)
    })
    if (live) {
      refresh()
      interval = window.setInterval(refresh, SKY_REFRESH_MS)
    }
    const onShow = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onShow)
    return () => { alive = false; clearInterval(interval); clearTimeout(midnight); document.removeEventListener('visibilitychange', onShow) }
  }, [id, moment, live, enabled])

  return sky
}
