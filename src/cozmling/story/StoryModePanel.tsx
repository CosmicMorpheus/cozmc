/* Story Mode on the Cozmling's page: today's visit to a story told over several days.
   One scene a story day, every choice on screen, then what followed and a natural place to stop.
   What changed since last time shows in the scene: a character's words, an object by the stone, a new
   choice. Only the Cozmling's voice lines depend on its Starprint. On the preview site, a dashed box
   holds the test save's controls: a simulated story day, Advance one story day, Reset test story. */
import { useEffect, useRef } from 'react'
import { STAGE_NAME, type Stage } from '../../companion/look'
import { dayText } from '../celestial/daily'
import { COZMLING_DEV } from '../index'
import { nameOf } from '../domain/care'
import { originalStage } from '../integrations/originalScene'
import type { Companion } from '../types'
import { render, type Visit } from './arc'
import type { StoryModeState } from './useStoryMode'
import { voiceOf } from './voices'

export function StoryModePanel({ c, story }: { c: Companion; story: StoryModeState }) {
  const name = nameOf(c), v = story.visit, head = useRef<HTMLHeadingElement>(null)
  const sceneKey = v?.kind === 'scene' ? `${v.arc.id}:${v.scene.id}:${story.day}` : v?.kind ?? ''
  const shown = useRef(sceneKey)
  // a new scene or what followed a choice: take the reader there
  useEffect(() => { if (shown.current !== sceneKey && shown.current) head.current?.focus({ preventScroll: true }); shown.current = sceneKey }, [sceneKey])
  const testing = story.test?.active ? story.test : null
  if (!v && story.status === 'loading') return null
  if (!COZMLING_DEV && (!v || v.kind === 'quiet' || v.kind === 'waiting')) return null       // nothing to tell yet

  const kicker = <p className="kicker">Story Mode · {dayText(story.day)}{testing ? ' · test save' : ''}</p>
  return (
    <section className={`panel sl-sm${testing ? ' is-test' : ''}`} aria-labelledby="sl-sm-title" data-visit={v?.kind ?? 'none'} data-scene={v?.kind === 'scene' ? v.scene.id : v?.kind === 'today' ? v.last.scene : undefined} data-day={story.day}>
      {story.status === 'failed' && !v ? <p className="sl-fine" role="status">Story Mode couldn’t be opened just now. It is tried again when you come back.</p> : v && <Body c={c} name={name} v={v} story={story} head={head} kicker={kicker} />}
      {COZMLING_DEV && story.testing && <TestControls name={name} own={originalStage(c)} story={story} />}
    </section>
  )
}

function Body({ c, name, v, story, head, kicker }: { c: Companion; name: string; v: Visit; story: StoryModeState; head: React.RefObject<HTMLHeadingElement | null>; kicker: React.ReactNode }) {
  const next = COZMLING_DEV && story.test?.active ? 'Advance one story day to see what happens next.' : 'Come back tomorrow to see what happens next.'
  if (v.kind === 'scene') {
    const r = render(v.arc, v.scene, v.ctx, { name, archetype: voiceOf(c) })
    return (
      <>
        {kicker}
        <h2 id="sl-sm-title" ref={head} tabIndex={-1}>{v.arc.title}</h2>
        <p className="sl-sm__visit">Visit {v.number} of {v.arc.visits}{v.arc.status === 'draft' ? ' · draft' : ''}</p>
        <Picture p={r.picture} />
        <div className="sl-cs__body">{r.paragraphs.map((p, i) => <p key={i} className={p.voice ? 'sl-cs__voice' : undefined} data-voice={p.voice ? voiceOf(c) ?? '' : undefined}>{p.text}</p>)}</div>
        <fieldset className="sl-cs__choices" disabled={story.busy}>
          <legend>{r.prompt}</legend>
          {r.choices.map((ch, i) => <button key={ch.id} type="button" className="sl-cs__choice" data-choice={ch.id} onClick={() => void story.choose(ch.id)}><b aria-hidden="true">{'ABC'[i] ?? i + 1}</b><span>{ch.label}</span></button>)}
        </fieldset>
        <p className="sl-fine">Every choice here is a good one, and each one is remembered. {c.kind === 'adventurer' ? <>{name}’s Starprint changes how it sounds, never what you can choose. </> : null}Nothing is rewarded or lost.</p>
      </>
    )
  }
  if (v.kind === 'today') {
    const done = !!v.ctx.arc?.finished, shown = v.last.shown
    return (
      <>
        {kicker}
        <h2 id="sl-sm-title" ref={head} tabIndex={-1}>{v.arc.title}</h2>
        <p className="sl-sm__visit">Visit {v.ctx.arc?.visits.length ?? 1} of {v.arc.visits} · you chose: {v.last.choice?.label}</p>
        <Picture p={v.arc.picture(v.ctx)} />
        <div className="sl-cs__body" aria-live="polite">{(shown?.outcome ?? []).map((t, i) => <p key={i}>{t}</p>)}</div>
        <p className="sl-cs__kept" role="status"><span aria-hidden="true">✓</span> Kept in {name}’s story.</p>
        <p className="sl-fine">{done ? <>The end of {v.arc.title}. Something new may begin another day.</> : next}</p>
      </>
    )
  }
  if (v.kind === 'waiting') return (
    <>
      {kicker}
      <h2 id="sl-sm-title" ref={head} tabIndex={-1}>A story is waiting</h2>
      <p className="sl-fine">When {name} becomes a {STAGE_NAME[v.stage]}, a new story begins in the Cosmic Grove, told over a few days.</p>
    </>
  )
  return (
    <>
      {kicker}
      <h2 id="sl-sm-title" ref={head} tabIndex={-1}>A quiet day in the Grove</h2>
      <p className="sl-fine">{v.finished.length ? <>{v.finished.map(a => a.title).join(', ')}: told and kept. Nothing new by the mossy stone today.</> : <>Nothing new today.</>}</p>
    </>
  )
}

/** The mossy stone, the starflower as the world's rules have left it, and the lantern wherever it is. */
function Picture({ p }: { p: Record<string, string> }) {
  const flower = p.flower ?? 'fading', lantern = p.lantern ?? 'none'
  const said = [
    'The mossy stone at the edge of the Grove.',
    flower === 'fading' ? 'Beside it, a starflower glows faintly.' : flower === 'curled' ? 'The starflower’s petals are curled with frost.' : 'Silver seeds lie in the moss where the starflower stood.',
    lantern === 'stone' ? 'A lantern stands beside the stone.' : lantern === 'path' ? 'A lantern lights the path home.' : '',
  ].filter(Boolean).join(' ')
  const petals = [0, 72, 144, 216, 288]
  return (
    <svg className="sl-sm__pic" viewBox="0 0 200 84" role="img" aria-label={said} data-flower={flower} data-lantern={lantern}>
      <defs>
        <radialGradient id="sm-glow"><stop offset="0" stopColor="#ffd98a" stopOpacity=".9" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
        <radialGradient id="sm-flower"><stop offset="0" stopColor="#9fe8ff" stopOpacity=".7" /><stop offset="1" stopColor="#9fe8ff" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="200" height="84" fill="#120a26" />
      {[[14, 10], [44, 22], [78, 8], [120, 16], [160, 9], [186, 24], [100, 30]].map(([x, y], i) => <rect key={i} x={x} y={y} width="1.6" height="1.6" fill="#e9e3ff" opacity={0.5 + (i % 3) * 0.2} />)}
      <path d="M0 66 Q50 58 100 64 T200 62 V84 H0Z" fill="#1d3b2a" />
      <path d="M150 84 Q160 72 200 70 V84Z" fill="#2a2140" opacity=".8" />
      {/* the mossy stone */}
      <path d="M70 66 Q72 46 92 44 Q112 43 116 60 L118 66Z" fill="#5d6470" />
      <path d="M74 52 Q86 44 100 47 Q90 46 80 54Z" fill="#4f8a55" />
      {/* the starflower, as the world has left it */}
      <g transform="translate(132 50)">
        {flower !== 'seeds' && <line x1="0" y1="2" x2="0" y2="16" stroke="#4f8a55" strokeWidth="1.6" />}
        {flower === 'fading' && <>
          <circle r="14" fill="url(#sm-flower)" opacity=".55" />
          {petals.map(a => <ellipse key={a} cx="0" cy="-5" rx="2.6" ry="5.2" fill="#a9ecff" opacity=".7" transform={`rotate(${a})`} />)}
          <circle r="2" fill="#fff6c9" />
        </>}
        {flower === 'curled' && <>
          {petals.map(a => <path key={a} d="M0 0 q2 -3 0 -5 q-2 1 -1 3" fill="none" stroke="#cfe8ff" strokeWidth="1.4" opacity=".8" transform={`rotate(${a})`} />)}
          <circle r="1.6" fill="#9fb4c8" />
        </>}
        {flower === 'seeds' && <>
          <path d="M0 16 Q2 10 -2 6" fill="none" stroke="#3f6e46" strokeWidth="1.4" />
          {[[-8, 14], [-3, 15], [4, 14.5], [9, 15.5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="#dfe9f5" />)}
        </>}
      </g>
      {/* the lantern, beside the same stone or lighting the path home */}
      {(lantern === 'stone' || lantern === 'path') && (
        <g transform={lantern === 'stone' ? 'translate(58 52)' : 'translate(176 54)'}>
          <circle cx="0" cy="6" r="16" fill="url(#sm-glow)" />
          <rect x="-4" y="0" width="8" height="11" rx="1.5" fill="#ffcf6b" stroke="#8a6a2a" strokeWidth="1.2" />
          <path d="M-5 0 H5 L3 -3 H-3Z" fill="#8a6a2a" />
          <path d="M-2 -3 Q0 -7 2 -3" fill="none" stroke="#8a6a2a" strokeWidth="1" />
        </g>
      )}
    </svg>
  )
}

/** The preview's test save: a simulated story day, a day at a time. Never in a production build. */
function TestControls({ name, own, story }: { name: string; own: Stage; story: StoryModeState }) {
  const t = story.test, tools = story.testing!
  const stages: (Stage | null)[] = [null, 'sprout', 'cadet', 'explorer', 'guardian']
  return (
    <div className="sl-devpanel sl-sm__test" role="group" aria-label="Story test save (preview only)">
      <p className="sl-sm__testhead">Story test save · preview only</p>
      {!t?.active ? (
        <>
          <p className="sl-fine sl-fine--flush">Play Story Mode in a separate test save, one story day at a time. {name}’s real save and story aren’t touched.</p>
          <p className="sl-cs__go"><button type="button" className="btn btn--ghost btn--sm" onClick={() => void tools.start()} disabled={story.busy}>{t ? 'Use the test save again' : 'Start a test story save'}</button></p>
        </>
      ) : (
        <>
          <p className="sl-sm__day" role="status">Simulated story day: <b>{dayText(t.day)}</b> <span className="muted">(run {t.run})</span></p>
          <p className="sl-cs__go">
            <button type="button" className="btn btn--phos btn--sm" onClick={() => void tools.advance()} disabled={story.busy}>Advance one story day</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void tools.reset()} disabled={story.busy}>Reset test story</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => void tools.leave()} disabled={story.busy}>Back to the real save</button>
          </p>
          <p className="sl-fine sl-fine--flush">Growth stage for this test story (the Cozmling itself doesn’t change):</p>
          <div className="chips">{stages.map(s => { const on = (t.stage ?? null) === s; return <button key={s ?? 'own'} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => void tools.setStage(s)} disabled={story.busy}>{s ? STAGE_NAME[s] : `Its own (${STAGE_NAME[own]})`}</button> })}</div>
        </>
      )}
    </div>
  )
}
