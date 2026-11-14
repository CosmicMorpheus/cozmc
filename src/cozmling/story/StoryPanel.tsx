/* Today's story, on the Cozmling's own page (the Star Loft): the day's title and theme, the story with
   one line in the Cozmling's own voice, an invitation and a reflection, then today's sky reading on
   its own. The invitation shows when it has been taken up (seen from what has happened, never
   rewarded). Original lines are shown as COZMC writing, not in quotation marks. */
import { dayText } from '../celestial/daily'
import { clockText } from '../celestial/observatory'
import { look, nameOf } from '../domain/care'
import type { Companion } from '../types'
import { invitationDone, type DailyStory } from './engine'
import type { DailyStoryState } from './useDailyStory'

export function StoryPanel({ c, today }: { c: Companion; today: DailyStoryState }) {
  if (today.status === 'none') return null
  const s = today.story, name = nameOf(c)
  if (!s) return (
    <section className="panel sl-story sl-story--waiting" aria-label="Today’s story">
      <p className="kicker">Today’s sky</p>
      <p className="sl-fine sl-fine--flush" role="status">{today.status === 'offline'
        ? <>Today’s story can’t be written just now, because the sky can’t be read (are you offline?). It is tried again whenever you come back.</>
        : <>Writing today’s story for {name}…</>}</p>
    </section>
  )
  const pet = look(c).pet
  const done = !today.earlier && invitationDone(s, { counters: { fed: pet.fed, played: pet.played, pets: pet.pets, arcade: pet.arcade ?? 0 }, energy: pet.energy, asleep: !!pet.asleep }, today.skyVisit)
  const go = s.invitation.action === 'arcade' ? { href: '#/arcade', text: 'Go to the arcade' } : s.invitation.action === 'observatory' ? { href: '#/cozmling/sky/today', text: 'Open today’s sky' } : null
  return (
    <section className="panel sl-story" aria-labelledby="sl-story-title" data-day={s.day}>
      <header className="sl-story__head">
        <p className="kicker">{today.earlier ? `${name}’s last story · ${dayText(s.day)}` : `Today’s story · ${dayText(s.day)}`}</p>
        <h2 id="sl-story-title">{s.title}</h2>
        <p className="sl-story__theme">{s.theme.join(' • ')}</p>
      </header>
      {today.earlier && <p className="sl-story__note" role="status">Today’s story can’t be written just now, because the sky can’t be read (are you offline?). This is {name}’s last one, from {dayText(s.day)}.</p>}
      {s.schema === 1 && <SkyReading s={s} earlier={today.earlier} old />}

      <div className="sl-story__body">{s.story.map((p, i) => <p key={p}>{p}{i === 0 && s.voice ? <> <span className="sl-story__voice" data-voice={s.voice.archetype}>{s.voice.line}</span></> : null}</p>)}</div>

      <div className={`sl-story__invite${done ? ' is-done' : ''}`} data-action={s.invitation.action} data-done={done || undefined}>
        <p className="sl-story__label">Today’s cosmic invitation</p>
        <p className="sl-story__quote">{s.schema === 1 ? `“${s.invitation.text}”` : s.invitation.text}</p>
        <p className="sl-story__status" aria-live="polite">{done ? <><span aria-hidden="true">✓</span> Done. {name} noticed.</> : go ? <a className="sl-inlink" href={go.href}>{go.text}</a> : <>Whenever you like.</>}</p>
      </div>
      <div className="sl-story__reflect">
        <p className="sl-story__label">COZMC reflection</p>
        <p className="sl-story__quote">{s.schema === 1 ? `“${s.reflection}”` : s.reflection}</p>
      </div>
      {s.schema !== 1 && <SkyReading s={s} earlier={today.earlier} />}

      <p className="sl-fine">{s.schema === 1
        ? <>Written at {clockText(s.writtenAt, s.timeZone)} from that day’s sky and how {name} was doing then: {s.source.name}. {s.source.detail} A story to play with, not a prediction. An invitation never changes rewards, scores or tokens.</>
        : <>Written at {clockText(s.writtenAt, s.timeZone)} from the day, {name}’s growth stage, its story so far and how it was doing then. {s.voice ? <>Its Starprint gives it its voice (the line in color). </> : null}The sky reading sits beside the story and never chooses it. A story to play with, not a prediction. An invitation never changes rewards, scores or tokens.</>}</p>
    </section>
  )
}

/** Today's sky reading for this Cozmling: optional symbolism from its own chart, kept apart from the story. */
function SkyReading({ s, earlier, old = false }: { s: DailyStory; earlier: boolean; old?: boolean }) {
  return (
    <div className="sl-story__influence">
      <p><span className="sl-story__label">{old ? 'Celestial influence' : 'Its sky today'}</span> <b>{s.influence.title}</b></p>
      {s.influence.lines.map(l => <p key={l} className="sl-story__why">{l}</p>)}
      {!old && <p className="sl-story__why">A reading to play with, if it feels right. It doesn’t choose the story.</p>}
      {!earlier && <a className="sl-inlink" href="#/cozmling/sky/today">See today’s sky</a>}
    </div>
  )
}
