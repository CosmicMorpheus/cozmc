/* Memories: a plain list of what has happened, read from the event history, with a star for each
   one in the frame above it. The finished constellation pattern and any milestones are still to
   be designed, so nothing here promises a count or a reward. */
import { useEffect, useState } from 'react'
import { cozmlingStore } from '../index'
import type { JourneyEvent } from '../types'

const WHAT: Record<JourneyEvent['type'], (name: string) => string> = {
  migrated: n => `${n} moved into the new Star Loft`, adopted: n => `You adopted ${n}`, hatched: n => `${n} hatched`, care: n => `You looked after ${n}`,
  'arcade-run': n => `You played the arcade with ${n}`, customized: n => `${n} got a new look`, 'wallet-linked': n => `${n} was linked to a wallet`, imported: n => `${n} arrived from a save file`,
  'sky-read': n => `You read the sky over ${n}`,
}
const FIRST = 5
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
/** A steady place in the frame for each memory, from its id (so stars don't jump about between visits). */
function spot(id: string): [number, number] {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return [8 + (h % 84), 12 + ((h >>> 9) % 70)]
}

/** A four-point sparkle centred on (x, y). */
const sparkle = (x: number, y: number, r: number) => { const k = r * 0.22; return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z` }

export function MemoriesPanel({ companionId, name, revision }: { companionId: string; name: string; revision: number }) {
  const [events, setEvents] = useState<JourneyEvent[] | null>(null)
  const [all, setAll] = useState(false)
  useEffect(() => { let on = true; cozmlingStore()?.events(companionId).then(e => { if (on) setEvents(e) }, () => { if (on) setEvents([]) }); return () => { on = false } }, [companionId, revision])
  if (!events) return <p className="sl-fine">Opening the memory book…</p>
  return (
    <div className="sl-memories">
      <svg className="sl-starmap" viewBox="0 0 100 100" role="img" aria-label={`${events.length} ${events.length === 1 ? 'memory' : 'memories'} so far, one star each`}>
        <rect x="1.5" y="1.5" width="97" height="97" rx="2" />
        {events.map((e, i) => { const [x, y] = spot(e.eventId); return <path key={e.eventId} d={sparkle(x, y, e.type === 'hatched' || e.type === 'adopted' ? 5.2 : 3.4)} style={{ animationDelay: `${(i % 7) * -0.6}s` }} /> })}
      </svg>
      <div>
        <p className="sl-fine">A star for each memory so far. The finished constellation is still being designed.</p>
        {events.length === 0 ? <p className="sl-fine">No memories yet.</p> : (
          <ol className="sl-memories__list">
            {[...events].reverse().slice(0, all ? undefined : FIRST).map(e => <li key={e.eventId}><span>{WHAT[e.type]?.(name) ?? 'Something happened'}</span><time dateTime={new Date(e.at).toISOString()}>{day(e.at)}</time></li>)}
          </ol>
        )}
        {events.length > FIRST && <p><button type="button" className="link" aria-expanded={all} onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${events.length}`}</button></p>}
      </div>
    </div>
  )
}
