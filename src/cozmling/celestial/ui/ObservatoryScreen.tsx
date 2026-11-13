/* The observatory: a Cozmling's birth sky, in full (#/cozmling/sky).
   The wheel, a table of every placement, the aspects and patterns, the Moon's phase, and a plain
   account of how the chart was worked out and what (if anything) couldn't be. Choosing anything
   shows what it might mean, in the reading box beside the wheel. */
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { signInfo } from '../../domain/starprint'
import { nameOf } from '../../domain/care'
import { StarSky } from '../../components/StarSky'
import type { Companion } from '../../types'
import { aspectReading, aspectTitle, bigThree, DISCLAIMER, moonPhaseReading, patternReading, placementReading, type Reading } from '../interpret'
import { clockText } from '../observatory'
import { starprintDisagrees } from '../options'
import type { AspectKind, CelestialBirthRecord, PointId } from '../types'
import { skyColors, useLateSky } from '../useSky'
import { BODIES, dms, ORDINAL, POINTS } from '../zodiac'
import { ChartWheel } from './ChartWheel'
import './celestial.css'

type Pick = { kind: 'point'; id: PointId } | { kind: 'aspect'; i: number } | { kind: 'pattern'; i: number } | { kind: 'phase' }
const ASPECT_GLYPH: Record<AspectKind, string> = { conjunction: '☌', sextile: '⚹', square: '□', trine: '△', opposition: '☍' }
const FIRST = 8
const T = '︎'

export function ObservatoryScreen({ companion: c }: { companion: Companion }) {
  const sky = c.celestial, name = nameOf(c), [o1, o2] = skyColors(c)
  const [pick, setPick] = useState<Pick>({ kind: 'point', id: 'sun' })
  const readingBox = useRef<HTMLDivElement>(null)
  /** Show what something means. On a phone the reading sits above the lists, so bring it into view. */
  const choose = (next: Pick) => {
    setPick(next)
    if (typeof matchMedia === 'function' && matchMedia('(max-width: 900px)').matches) {
      const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
      requestAnimationFrame(() => readingBox.current?.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' }))
    }
  }
  const [all, setAll] = useState(false)
  useLateSky(c)
  useEffect(() => { scrollTo(0, 0) }, [])

  if (!sky) return (
    <div className="sk-page">
      <p className="sk-back"><a className="link" href="#/cozmling">← Back to the Star Loft</a></p>
      <header className="page-head"><p className="kicker">Observatory</p><h1>{name}’s sky</h1>
        <p>{c.hatch.status === 'egg' ? <>{name} is still a Star Egg. Its birth sky is read the minute it hatches.</>
          : c.kind === 'adventurer' ? <>Reading the sky {name} was born under…</>
          : <>{name}’s sky hasn’t been read yet. You can read it from the Star Loft, if you’d like to.</>}</p>
      </header>
    </div>
  )

  const reading: Reading = pick.kind === 'point' ? placementReading(sky, name, pick.id)
    : pick.kind === 'aspect' ? aspectReading(sky.aspects[pick.i])
    : pick.kind === 'pattern' ? patternReading(sky.patterns[pick.i])
    : moonPhaseReading(sky, name)
  const shown = all ? sky.aspects : sky.aspects.slice(0, FIRST)
  const tz = sky.birthplace.timeZone, theirs = sky.moment.displayTimeZone
  const isPoint = (id: PointId) => pick.kind === 'point' && pick.id === id
  const signName = (s: Parameters<typeof signInfo>[0]) => signInfo(s).name

  return (
    <div className="sk-page sl-page" style={{ '--o1': o1, '--o2': o2 } as CSSProperties}>
      <p className="sk-back"><a className="link" href="#/cozmling">← Back to the Star Loft</a></p>
      <header className="sl-hero sk-hero">
        <StarSky seed={`${c.companionId}:sky`} a={o1} b={o2} />
        <div className="sl-hero__text">
          <p className="kicker">Observatory</p>
          <h1>{name}’s {sky.kind === 'birth' ? 'birth sky' : 'awakening sky'}</h1>
          <p className="sk-when">
            {sky.kind === 'birth' ? 'Born' : 'Given its sky'} {clockText(sky.moment.ms, tz, true)}, at the Origin Observatory on Mauna Kea (Hawaii time).
            {theirs && theirs !== tz && <> That was {clockText(sky.moment.ms, theirs, true)} where you were.</>}
          </p>
          <p className="sl-id"><span className="sl-id__sign">{bigThree(sky)}</span><span>{sky.moonPhase.name}</span></p>
        </div>
      </header>

      <section className="sk-main">
        <div className="sk-col">
          <div className="sk-wheelbox sk-o1">
            <ChartWheel sky={sky} title={`${name}’s ${sky.kind} sky: ${bigThree(sky)}`} focus={pick.kind === 'point' ? pick.id : null} focusAspect={pick.kind === 'aspect' ? sky.aspects[pick.i] : null} onPick={id => setPick({ kind: 'point', id })} />
            <p className="sl-fine sk-legend"><span className="sk-key sk-key--flow" /> flowing <span className="sk-key sk-key--tension" /> tense · tap a planet or a row to read about it</p>
          </div>
          <div className="panel sk-o4">
            <header className="panel__head"><h2>Aspects</h2><span className="sl-fine sl-fine--flush">{sky.aspects.length} in all</span></header>
            <ul className="sk-list">
              {shown.map((a, i) => (
                <li key={`${a.a}-${a.b}`}>
                  <button type="button" aria-pressed={pick.kind === 'aspect' && pick.i === i} className={pick.kind === 'aspect' && pick.i === i ? 'is-on' : undefined} onClick={() => choose({ kind: 'aspect', i })}>
                    <span className="sk-g" aria-hidden="true">{POINTS[a.a].glyph} {ASPECT_GLYPH[a.kind]}{T} {POINTS[a.b].glyph}</span>
                    <span>{aspectTitle(a)}</span><span className="sk-dms">{dms(a.orb)}</span>
                  </button>
                </li>
              ))}
            </ul>
            {sky.aspects.length > FIRST && <p><button type="button" className="link" aria-expanded={all} onClick={() => setAll(v => !v)}>{all ? 'Show fewer' : `Show all ${sky.aspects.length}`}</button></p>}
          </div>
        </div>
        <div className="sk-col">
          <div className="panel sk-reading sk-o2" aria-live="polite" ref={readingBox}>
            <h2>{reading.title}</h2>
            {reading.lines.map(l => <p key={l}>{l}</p>)}
          </div>

          <div className="panel sk-tablebox sk-o3">
            <header className="panel__head"><h2>Placements</h2></header>
            <table className="sk-table">
              <thead><tr><th scope="col">Point</th><th scope="col">Sign</th><th scope="col">House</th><th scope="col"><span className="sr-only">Motion</span></th></tr></thead>
              <tbody>
                {[...BODIES, ...(sky.angles ? (['ascendant', 'midheaven'] as const) : [])].map(id => {
                  const p = id === 'ascendant' || id === 'midheaven' ? sky.angles![id] : sky.bodies[id]
                  const body = id === 'ascendant' || id === 'midheaven' ? null : sky.bodies[id]
                  return (
                    <tr key={id} className={isPoint(id) ? 'is-on' : undefined}>
                      <th scope="row"><button type="button" aria-pressed={isPoint(id)} onClick={() => choose({ kind: 'point', id })}><span className="sk-g" aria-hidden="true">{POINTS[id].glyph}</span>{POINTS[id].short}</button></th>
                      <td><span className="sk-g" aria-hidden="true">{signInfo(p.sign).glyph}{T}</span>{signName(p.sign)} <span className="sk-dms">{dms(p.degree)}</span></td>
                      <td>{body?.house ? ORDINAL[body.house - 1] : '–'}</td>
                      <td>{body?.retrograde ? <abbr title="retrograde">℞</abbr> : body?.stationary ? <abbr title="stationary">st</abbr> : ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="panel sk-o5">
            <header className="panel__head"><h2>Shapes and the Moon</h2></header>
            <ul className="sk-list">
              {sky.patterns.map((p, i) => (
                <li key={`${p.kind}-${p.points.join('-')}`}>
                  <button type="button" aria-pressed={pick.kind === 'pattern' && pick.i === i} className={pick.kind === 'pattern' && pick.i === i ? 'is-on' : undefined} onClick={() => choose({ kind: 'pattern', i })}>
                    <span>{patternReading(p).title}</span><span className="sk-dms">{p.points.length} planets</span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" aria-pressed={pick.kind === 'phase'} className={pick.kind === 'phase' ? 'is-on' : undefined} onClick={() => choose({ kind: 'phase' })}>
                  <span className="sk-moon" aria-hidden="true" style={{ '--lit': sky.moonPhase.illumination, '--side': sky.moonPhase.angle < 180 ? 1 : -1 } as CSSProperties} />
                  <span>{sky.moonPhase.name}</span><span className="sk-dms">{Math.round(sky.moonPhase.illumination * 100)}% lit</span>
                </button>
              </li>
            </ul>
            {sky.patterns.length === 0 && <p className="sl-fine">No stellium, grand trine, T-square or grand cross in this sky.</p>}
          </div>
        </div>
      </section>

      <section className="sk-more">
        <About sky={sky} name={name} note={c.kind === 'adventurer' && starprintDisagrees(c) ? `${name}’s Starprint was chosen before skies were read. At its birth minute the Sun was in ${signName(sky.bodies.sun.sign)}.` : null} />
      </section>
      <p className="sl-fine sk-disclaimer">{DISCLAIMER}</p>
    </div>
  )
}

/** How this chart was worked out, in plain words, and anything that couldn't be. */
function About({ sky, name, note }: { sky: CelestialBirthRecord; name: string; note: string | null }) {
  const b = sky.birthplace
  return (
    <div className="panel sk-about">
      <header className="panel__head"><h2>About this chart</h2></header>
      <dl>
        <div><dt>Where</dt><dd>{b.name} ({b.fictional ? 'a fictional place' : 'a real place'}), standing on {b.place} at {Math.abs(b.latitude).toFixed(4)}° {b.latitude >= 0 ? 'N' : 'S'}, {Math.abs(b.longitude).toFixed(4)}° {b.longitude >= 0 ? 'E' : 'W'}.</dd></div>
        <div><dt>When</dt><dd>{sky.moment.utc.replace('T', ' ').replace('.000Z', ' UTC')}. {sky.accuracy.moment}</dd></div>
        <div><dt>Zodiac</dt><dd>Tropical: the signs follow the seasons, starting from the spring equinox, as in Western astrology.</dd></div>
        <div><dt>Houses</dt><dd>{sky.houses ? 'Whole-sign houses: each house is one whole sign, counted from the Rising sign’s.' : 'None: they need the time of birth.'}</dd></div>
        <div><dt>Positions</dt><dd>Seen from the centre of the Earth. {sky.accuracy.positions}</dd></div>
        <div><dt>Worked out</dt><dd>{new Date(sky.calculatedAt).toLocaleString()} by {sky.engine.name} {sky.engine.version}. It will never change: this is {name}’s sky for good.</dd></div>
        <div><dt>Left out</dt><dd>{sky.omitted.length ? sky.omitted.map(o => `${o.field}: ${o.why}`).join(' ') : 'Nothing: every part of this chart could be worked out.'}</dd></div>
        {note && <div><dt>Note</dt><dd>{note}</dd></div>}
      </dl>
    </div>
  )
}
