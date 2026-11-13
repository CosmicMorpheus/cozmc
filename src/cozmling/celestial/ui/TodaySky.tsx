/* Today's sky (#/cozmling/sky/today): where the planets are now, and how today's sky meets this
   Cozmling's own.
   - The wheel and the table show the sky right now, worked out again every 10 minutes, in this
     Cozmling's own houses (counted from its Rising sign), with today's planets' aspects to each other.
   - The transits are the day's reading: today's planets against its birth sky, read for midday in the
     player's time zone, so they are the same all day. Picking one draws it on the wheel.
   - Nothing claims to be live when it isn't: every view says when its positions are from. */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { signInfo } from '../../domain/starprint'
import type { ZodiacSign } from '../../types'
import { findAspects } from '../aspects'
import { dayText, TRANSIT_ORBS, type DailyCelestialReport, type SkyPlacement } from '../daily'
import { placementReading, skyNotes, todayHeadline, todayPlacementReading, transitReading, transitTitle, type Reading } from '../interpret'
import { clockText } from '../observatory'
import type { BodyId, CelestialBirthRecord } from '../types'
import { SKY_REFRESH_MS, type LiveSky } from '../useLiveSky'
import { LIBRARY } from '../version'
import { BODIES, dms, ORDINAL, POINTS, ZODIAC } from '../zodiac'
import { AS_TEXT, ASPECT_GLYPH, ChartWheel, type WheelData, type WheelGhost } from './ChartWheel'

type Pick = { kind: 'transit'; i: number } | { kind: 'planet'; id: BodyId } | { kind: 'angle'; id: 'ascendant' | 'midheaven' }
const FIRST = 6

/** The report to show: today's, or (only when today's can't be worked out) the last one saved. */
export function shownReport(live: LiveSky): { r: DailyCelestialReport | null; earlier: boolean } {
  if (live.report) return { r: live.report, earlier: false }
  if (live.status === 'offline' && live.earlier) return { r: live.earlier, earlier: true }
  return { r: null, earlier: false }
}

/** Re-render every minute, so "live" stops being claimed once the last calculation is old. */
function useMinute() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])
  return now
}

export function TodaySky({ natal, name, live, wheel, tabs, onChoose }: {
  natal: CelestialBirthRecord; name: string; live: LiveSky; wheel: RefObject<SVGSVGElement | null>; tabs: ReactNode
  /** after something is picked: brings the reading into view on a phone */
  onChoose: (el: HTMLElement | null) => void
}) {
  const { r, earlier } = shownReport(live)
  const minute = useMinute()
  const [picked, setPicked] = useState<Pick | null>(null)
  const [all, setAll] = useState(false)
  const readingBox = useRef<HTMLDivElement>(null)

  // what the wheel and table show: the sky now, or the report's midday sky until (or unless) that can be worked out
  const shown = useMemo(() => live.now && !earlier ? { at: live.now.at, bodies: live.now.bodies, moonPhase: live.now.moonPhase, now: true }
    : r ? { at: r.at, bodies: r.sky as Record<BodyId, SkyPlacement>, moonPhase: r.moonPhase, now: false } : null, [live.now, r, earlier])
  const first = natal.houses ? ZODIAC.indexOf(natal.houses[0]) : -1
  const houseOf = (s: ZodiacSign) => (first < 0 ? null : ((ZODIAC.indexOf(s) - first + 12) % 12) + 1)
  const wheelData: WheelData | null = useMemo(() => shown && {
    bodies: shown.bodies, angles: natal.angles, houses: natal.houses,
    aspects: findAspects(BODIES.map(b => ({ id: b, lon: shown.bodies[b].lon, speed: shown.bodies[b].speed })), TRANSIT_ORBS),
  }, [shown, natal])

  const transits = r?.transits ?? []
  const fallback: Pick = transits.length ? { kind: 'transit', i: 0 } : { kind: 'planet', id: 'moon' }
  const pick: Pick = picked && !(picked.kind === 'transit' && !transits[picked.i]) ? picked : fallback
  const t = pick.kind === 'transit' ? transits[pick.i] : null
  const choose = (next: Pick) => { setPicked(next); onChoose(readingBox.current) }

  const on = earlier && r ? dayText(r.day) : undefined
  const reading: Reading | null = t && r ? transitReading(t, name, r.timeZone, on)
    : pick.kind === 'planet' && shown ? todayPlacementReading(pick.id, shown.bodies[pick.id], houseOf(shown.bodies[pick.id].sign), name, on)
    : pick.kind === 'angle' ? (x => ({ ...x, title: `${x.title}, from its ${natal.kind === 'birth' ? 'birth' : 'awakening'} sky`, lines: [...x.lines, 'Today’s planets are placed in its houses, counted from here.'] }))(placementReading(natal, name, pick.id))
    : null
  const ghost: WheelGhost | null = t ? { id: t.b, lon: t.b === 'ascendant' || t.b === 'midheaven' ? natal.angles![t.b].lon : natal.bodies[t.b].lon, from: t.a, kind: t.kind } : null
  const focus = t ? t.a : pick.kind === 'transit' ? null : pick.id
  const fresh = !!live.updatedAt && minute - live.updatedAt < SKY_REFRESH_MS * 1.5 && !document.hidden
  const tz = r?.timeZone ?? live.timeZone
  const pct = shown ? Math.round(shown.moonPhase.illumination * 100) : 0
  const shownTransits = all ? transits : transits.slice(0, FIRST)
  const isPlanet = (b: BodyId) => (pick.kind === 'planet' && pick.id === b) || t?.a === b
  const waiting = live.status === 'offline' ? 'Today’s sky can’t be read just now.' : 'Reading today’s sky…'
  // the sky's news tells the Moon where it is now, when that is known (it moves about 13° a day)
  const moonNow = shown?.now ? { sign: shown.bodies.moon.sign, house: houseOf(shown.bodies.moon.sign), phase: shown.moonPhase } : null
  const notePhase = moonNow?.phase ?? r?.moonPhase ?? { angle: 0, illumination: 0 }

  return (
    <>
      <header className="sk-head">
        <div>
          <p className="kicker">Observatory</p>
          <h1>{name}’s sky today</h1>
          {r && !earlier && <p className="sk-headline"><b>Today</b> {todayHeadline(r, name)}</p>}
          <p className="sk-when">
            {r && !earlier && <>{dayText(r.day)}, where you are. </>}
            Today’s planets, and how they meet the sky {name} was {natal.kind === 'birth' ? 'born under' : 'given'}.
          </p>
          <p className="sl-id">
            {shown && !earlier && <span className="sl-id__sign"><span className="sk-moon" aria-hidden="true" style={{ '--lit': shown.moonPhase.illumination, '--side': shown.moonPhase.angle < 180 ? 1 : -1 } as CSSProperties} />{shown.moonPhase.name}, {pct}% lit</span>}
            <span className="sk-live" data-state={shown?.now && fresh ? 'live' : live.status === 'offline' ? 'offline' : 'saved'}>
              {shown?.now && live.updatedAt ? `${fresh ? 'Live' : 'Updated'} · ${clockText(live.updatedAt, tz)}` : live.status === 'offline' ? 'Offline' : r ? 'From today’s reading' : 'Reading the sky…'}
            </span>
          </p>
        </div>
      </header>
      {tabs}
      {(earlier || (!r && live.status === 'offline')) && (
        <p className="sk-note" role="status">
          Today’s sky couldn’t be worked out just now, because the astronomy couldn’t load (are you offline?). It is tried again whenever you come back to this page.
          {earlier && r && <> Below is {name}’s sky from {dayText(r.day)}, the last one saved.</>}
        </p>
      )}

      <section className="sk-main" aria-busy={!r && live.status === 'loading'}>
        <div className="sk-col">
          <div className="sk-wheelbox sk-o1">
            {wheelData
              ? <ChartWheel svgRef={wheel} sky={wheelData} title={`${name}’s sky ${earlier && r ? `on ${dayText(r.day)}` : 'today'}`} desc={`A zodiac wheel showing where the Sun, Moon and planets are${shown?.now ? ' now' : ' at midday'}, in ${name}’s own houses. The same details are listed in the table beside it.`}
                  focus={focus} focusAspect={null} ghost={ghost} onPick={id => choose(id === 'ascendant' || id === 'midheaven' ? { kind: 'angle', id } : { kind: 'planet', id })} />
              : <div className="sk-wheel-wait" role="status">{live.status === 'offline' ? 'Today’s sky can’t be drawn just now' : 'Working out today’s sky…'}</div>}
            <p className="sl-fine sk-legend">
              <span className="sk-legend__item"><span className="sk-key sk-key--flow" /> flowing</span>
              <span className="sk-legend__item"><span className="sk-key sk-key--tension" /> tense</span>
              <span className="sk-legend__item">{natal.houses ? `houses: ${name}’s own` : 'tap a planet'}</span>
              {natal.houses && <span className="sk-legend__item">tap a planet</span>}
            </p>
          </div>
          <div className="panel sk-o4">
            <header className="panel__head"><h2>{r && earlier ? `The sky on ${dayText(r.day)}` : 'In the sky today'}</h2></header>
            {r ? (
              <ul className="sk-notes">
                {skyNotes(r, name, { past: earlier, moonNow }).map((n, i) => (
                  <li key={n}>
                    <span className="sk-notes__mark" aria-hidden="true">{i === 0 ? <span className="sk-moon" style={{ '--lit': notePhase.illumination, '--side': notePhase.angle < 180 ? 1 : -1 } as CSSProperties} /> : '✦'}</span>
                    <span>{n}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="sl-fine sl-fine--flush">{waiting}</p>}
          </div>
        </div>

        <div className="sk-col">
          <div className="panel sk-reading sk-o2" aria-live="polite" ref={readingBox}>
            {reading ? <><h2>{reading.title}</h2>{reading.lines.map(l => <p key={l}>{l}</p>)}</>
              : <><h2>Today’s sky</h2><p>{live.status === 'offline' ? 'It can’t be read just now.' : 'Reading it now…'}</p></>}
          </div>

          <div className="panel sk-o3">
            <header className="panel__head"><h2>{r && earlier ? `${name} on ${dayText(r.day)}` : `Today for ${name}`}</h2>{r && <span className="sl-fine sl-fine--flush">{transits.length ? `${transits.length} in all` : 'a quiet day'}</span>}</header>
            {!r ? <p className="sl-fine sl-fine--flush">{waiting}</p> : transits.length ? (
                <>
                  <ul className="sk-list sk-transits">
                    {shownTransits.map((x, i) => (
                      <li key={`${x.a}-${x.kind}-${x.b}`}>
                        <button type="button" aria-pressed={pick.kind === 'transit' && pick.i === i} className={pick.kind === 'transit' && pick.i === i ? 'is-on' : undefined} onClick={() => choose({ kind: 'transit', i })}>
                          <span className="sk-g" aria-hidden="true">{POINTS[x.a].glyph} {ASPECT_GLYPH[x.kind]}{AS_TEXT} <span className="sk-g__natal">{POINTS[x.b].glyph}</span></span>
                          <span>{transitTitle(x, name)}</span>
                          <span className="sk-dms">{x.exactAt != null ? `exact ${clockText(x.exactAt, r.timeZone)}` : dms(x.orb)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {transits.length > FIRST && <p><button type="button" className="link" aria-expanded={all} onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${transits.length}`}</button></p>}
                  <p className="sl-fine">Today’s planets against {name}’s {natal.kind === 'birth' ? 'birth' : 'awakening'} sky, read for midday ({clockText(r.at, r.timeZone)}), so they stay the same all day. The day’s fast movers come first.</p>
                </>
              ) : <p className="sl-fine">{todayHeadline(r, name)}. Not every day brings a close meeting.</p>}
          </div>

          {shown && (
            <div className="panel sk-tablebox sk-o5">
              <header className="panel__head"><h2>{shown.now ? 'Where the planets are now' : earlier && r ? `At midday on ${dayText(r.day)}` : 'Where the planets are at midday'}</h2></header>
              <table className="sk-table">
                <thead><tr><th scope="col">Planet</th><th scope="col">Sign</th><th scope="col">{natal.houses ? `${name}’s house` : 'House'}</th><th scope="col"><span className="sr-only">Motion</span></th></tr></thead>
                <tbody>
                  {BODIES.map(b => {
                    const p = shown.bodies[b], h = houseOf(p.sign)
                    return (
                      <tr key={b} className={isPlanet(b) ? 'is-on' : undefined}>
                        <th scope="row"><button type="button" aria-pressed={pick.kind === 'planet' && pick.id === b} onClick={() => choose({ kind: 'planet', id: b })}><span className="sk-g" aria-hidden="true">{POINTS[b].glyph}</span>{POINTS[b].short}</button></th>
                        <td><span className="sk-g" aria-hidden="true">{signInfo(p.sign).glyph}{AS_TEXT}</span>{signInfo(p.sign).name} <span className="sk-dms">{dms(p.degree)}</span></td>
                        <td>{h ? ORDINAL[h - 1] : '–'}</td>
                        <td>{p.retrograde ? <abbr title="retrograde">℞</abbr> : p.stationary ? <abbr title="stationary">st</abbr> : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="sl-fine">{shown.now && live.updatedAt ? `Worked out at ${clockText(live.updatedAt, tz)}, your time, and again every 10 minutes while this page is open.` : `As at midday${r ? ` (${clockText(r.at, r.timeZone)})` : ''}.${live.status === 'loading' ? ' Working out where they are now…' : ''}`}</p>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/** How today's sky is worked out, in plain words. */
export function AboutToday({ natal, name, live }: { natal: CelestialBirthRecord; name: string; live: LiveSky }) {
  const { r, earlier } = shownReport(live), tz = r?.timeZone ?? live.timeZone
  return (
    <div className="panel sk-about">
      <header className="panel__head"><h2>About today’s sky</h2></header>
      <dl>
        <div><dt>Day</dt><dd>{r && !earlier ? `${dayText(r.day)}, on` : 'On'} your own clock ({tz}). A new day’s sky is read at your midnight, or whenever your time zone changes.</dd></div>
        <div><dt>Updated</dt><dd>{live.now && live.updatedAt ? `The planets were last worked out at ${clockText(live.updatedAt, tz)}. While this page is open they are worked out again every 10 minutes; the Moon moves about half a degree an hour.`
          : live.status === 'offline' ? 'The planets can’t be worked out at the moment: the astronomy couldn’t load. What’s shown is the last reading saved on this device, with its day.'
          : 'Working them out now.'}</dd></div>
        <div><dt>Transits</dt><dd>Read for midday: today’s planets within 3° of an exact angle to a point in {name}’s sky (2° for a sextile, 1° more with the Sun or Moon, 2° to its Rising sign or Midheaven). The fast movers come first: the Moon’s change every few hours, Saturn’s over months.</dd></div>
        <div><dt>Houses</dt><dd>{natal.houses ? `${name}’s own whole-sign houses, counted from its ${signInfo(natal.houses[0]).name} Rising sign, so the same planet passes through a different house for every Cozmling.` : `None: ${name}’s sky has no time of birth, so it has no houses.`}</dd></div>
        <div><dt>Astronomy</dt><dd>The same as its birth sky: real positions from {LIBRARY.name} {LIBRARY.version}, worked out on this device. Nothing is sent anywhere, and nothing is random.</dd></div>
        <div><dt>Saved</dt><dd>Each day’s reading is saved on this device, so it stays the same all day{r && !earlier ? ` (today’s was read at ${clockText(r.calculatedAt, tz)})` : ''}. It doesn’t change {name}’s needs, rewards or scores.</dd></div>
      </dl>
    </div>
  )
}
