/* A choice story on the Cozmling's own page: a card to begin, then one scene at a time with every
   choice on screen, then the ending, its invitation and reflection. The finished reading is kept as
   one memory with the text exactly as shown (choice.ts). Nothing is rewarded, and every route is a
   good one. Only the Cozmling's voice lines depend on its Starprint. */
import { useEffect, useRef, useState } from 'react'
import { cozmlingStore } from '../index'
import { nameOf } from '../domain/care'
import type { Companion } from '../types'
import { asChoiceRun, choiceEventId, runRecord, scene, type ChoiceRun, type ChoiceStory } from './choice'
import { voiceOf } from './voices'

const day = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

export function ChoiceStoryPanel({ c, story, onKept }: { c: Companion; story: ChoiceStory; onKept?: () => void }) {
  const name = nameOf(c), who = { name, archetype: voiceOf(c) }, id = c.companionId
  const [past, setPast] = useState<{ eventId: string; run: ChoiceRun }[] | null>(null)
  const [reading, setReading] = useState<{ picks: string[]; path: string[]; startedAt: number } | null>(null)
  const [kept, setKept] = useState<'saving' | 'kept' | 'failed' | null>(null)
  const head = useRef<HTMLHeadingElement>(null)

  // earlier readings of this story, to say when it was last read
  useEffect(() => {
    let on = true
    cozmlingStore()?.events(id).then(es => {
      if (on) setPast(es.filter(e => e.type === 'choice-story').map(e => ({ eventId: e.eventId, run: asChoiceRun(e.data) })).filter((x): x is { eventId: string; run: ChoiceRun } => !!x.run && x.run.storyId === story.id).sort((a, b) => a.run.finishedAt - b.run.finishedAt))
    }, () => { if (on) setPast([]) })
    return () => { on = false }
  }, [id, story.id, kept])
  // a new scene: move the reader's focus to it
  useEffect(() => { if (reading) head.current?.focus({ preventScroll: false }) }, [reading?.path.length])

  const begin = () => { setKept(null); setReading({ picks: [], path: [story.entry], startedAt: Date.now() }) }
  const choose = (choiceId: string, to: string) => {
    if (!reading) return
    const r = { ...reading, picks: [...reading.picks, choiceId], path: [...reading.path, to] }
    setReading(r)
    if (story.nodes[to]?.ending) void keep(r.picks, r.startedAt)
  }
  async function keep(picks: string[], startedAt: number) {
    const store = cozmlingStore()
    if (!store) { setKept('failed'); return }
    setKept('saving')
    const first = past?.[0]?.eventId ?? null
    const run = runRecord(story, who, picks, { startedAt, finishedAt: Date.now() }, first)
    const res = await store.keepEvent({ eventId: choiceEventId(id, story), companionId: id, type: 'choice-story', at: run.finishedAt, data: run as unknown as Record<string, unknown> }).catch(() => ({ ok: false as const }))
    setKept(res.ok ? 'kept' : 'failed')
    if (res.ok) onKept?.()
  }

  if (!reading) {
    const last = past?.[past.length - 1]
    return (
      <section className="panel sl-cs" aria-labelledby="sl-cs-title" data-story={story.id}>
        <p className="kicker">A story for {name}{story.status === 'draft' ? ' · draft' : ''}</p>
        <h2 id="sl-cs-title">{story.title}</h2>
        <p className="sl-cs__theme">About {story.minutes} minutes · you choose what happens</p>
        {last && <p className="sl-fine">You read it together on {day(last.run.finishedAt)}: {last.run.ending.title}.</p>}
        <p className="sl-cs__go"><button type="button" className="btn btn--phos" onClick={begin}>{last ? 'Read it again' : 'Begin'}</button></p>
      </section>
    )
  }

  const at = reading.path[reading.path.length - 1], sc = scene(story, at, who, reading.picks[reading.picks.length - 1])
  return (
    <section className="panel sl-cs" aria-labelledby="sl-cs-title" data-story={story.id} data-scene={at}>
      <p className="kicker">A story for {name}{story.status === 'draft' ? ' · draft' : ''}</p>
      <h2 id="sl-cs-title" ref={head} tabIndex={-1}>{sc.ending ? sc.ending.title : story.title}</h2>
      <div className="sl-cs__body" aria-live="polite">
        {sc.paragraphs.map((p, i) => <p key={`${at}-${i}`} className={p.voice ? 'sl-cs__voice' : undefined} data-voice={p.voice ? who.archetype ?? '' : undefined}>{p.text}</p>)}
      </div>
      {sc.choices.length > 0 && (
        <fieldset className="sl-cs__choices">
          <legend>{sc.prompt}</legend>
          {sc.choices.map(ch => <button key={ch.id} type="button" className="sl-cs__choice" data-choice={ch.id} onClick={() => choose(ch.id, ch.to)}><b aria-hidden="true">{ch.id.length === 1 ? ch.id : ch.id.slice(1)}</b><span>{ch.label}</span></button>)}
        </fieldset>
      )}
      {sc.ending && (
        <>
          <div className="sl-cs__invite">
            <p className="sl-cs__label">Today’s cosmic invitation</p>
            <p className="sl-cs__quote">{sc.ending.invitation}</p>
            <p className="sl-cs__status">Whenever you like, or not at all.</p>
          </div>
          <div className="sl-cs__reflect">
            <p className="sl-cs__label">COZMC reflection</p>
            <p className="sl-cs__quote">{sc.ending.reflection}</p>
          </div>
          <p className="sl-cs__kept" role="status">{kept === 'kept' ? <><span aria-hidden="true">✓</span> Kept in {name}’s memories.</> : kept === 'failed' ? <>This reading couldn’t be saved on this device. The story itself is fine.</> : <>Keeping it in {name}’s memories…</>}</p>
          <p className="sl-cs__go"><button type="button" className="btn btn--ghost" onClick={begin}>Read it again</button> <button type="button" className="btn btn--ghost" onClick={() => setReading(null)}>Close</button></p>
        </>
      )}
      <p className="sl-fine">Every choice here is a good one. {name}’s Starprint changes how it sounds, never what you can choose. Nothing is rewarded or lost.</p>
    </section>
  )
}
