/* A Starprint adventurer, drawn from its art (or a stand-in when the art is missing or fails to
   load). Loft mode is the whole figure standing in the Star Loft; the compact modes use a
   portrait made for small sizes. Care and identity never depend on the art arriving. */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react'
import { Glyph, Orb } from '../components/Glyph'
import { look } from '../domain/care'
import { ELEMENTS, signInfo } from '../domain/starprint'
import type { AdventurerCompanion } from '../types'
import { artFor, LOFT_ROOM } from './assetManifest'
import type { RendererHandle, RenderMode } from './CompanionRenderer'

type Stage = NonNullable<AdventurerCompanion['progress']['visualStage']>
type Move = Parameters<RendererHandle['react']>[0]
const STAGE_SCALE: Record<Stage, number> = { hatchling: 0.82, adolescent: 0.92, ascended: 1 }

/* How each reaction moves the figure (or the egg). Played with the browser's own animation
   engine so the same one can run twice in a row, and skipped entirely for reduced motion. */
const y = (v: number, offset?: number): Keyframe => ({ transform: `translateY(${v}%)`, ...(offset == null ? {} : { offset }) })
const turn = (deg: number, offset?: number): Keyframe => ({ transform: `rotate(${deg}deg)`, ...(offset == null ? {} : { offset }) })
const MOVES: Record<Move, { frames: Keyframe[]; ms: number }> = {
  play: { frames: [y(0), y(-9, 0.22), y(0, 0.45), y(-5, 0.68), y(0)], ms: 820 },
  feed: { frames: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.035, 0.965)', offset: 0.3 }, { transform: 'scale(0.985, 1.02)', offset: 0.6 }, { transform: 'scale(1, 1)' }], ms: 700 },
  pat: { frames: [turn(0), turn(-2.4, 0.25), turn(2.4, 0.6), turn(0)], ms: 640 },
  refuse: { frames: [{ transform: 'translateX(0)' }, { transform: 'translateX(-2.6%)', offset: 0.2 }, { transform: 'translateX(2.6%)', offset: 0.45 }, { transform: 'translateX(-1.6%)', offset: 0.7 }, { transform: 'translateX(0)' }], ms: 460 },
  sleep: { frames: [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.01, 0.975)', offset: 0.6 }, { transform: 'scale(1, 1)' }], ms: 900 },
  wake: { frames: [{ transform: 'scale(1, 1)' }, { transform: 'scale(0.985, 1.035)', offset: 0.45 }, { transform: 'scale(1, 1)' }], ms: 700 },
  crack: { frames: [turn(0), turn(-9, 0.2), turn(7, 0.5), turn(-4, 0.8), turn(0)], ms: 520 },
  hatch: { frames: [{ transform: 'scale(0.25)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }], ms: 1000 },
}
const POP: Partial<Record<Move, string>> = { pat: '♥', play: '✦', feed: '●' }
const calm = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** The outline shown when a look has no art yet, or its image didn't load. */
function StandIn({ c }: { c: AdventurerCompanion }) {
  const [a, b] = ELEMENTS[c.starprint.element].orb
  return (
    <span className="sl-standin" style={{ '--o1': a, '--o2': b } as CSSProperties}>
      <svg viewBox="0 0 120 200" aria-hidden="true">
        <path d="M46 20c-6-10-14-12-18-8M74 20c6-10 14-12 18-8" fill="none" stroke="var(--o1)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="60" cy="42" r="24" fill="#10131f" stroke="var(--o1)" strokeWidth="3" />
        <path d="M22 196c0-52 10-110 38-110s38 58 38 110z" fill="#10131f" stroke="var(--o1)" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <Glyph sign={c.starprint.coreSign} size={34} className="sl-standin__glyph" />
    </span>
  )
}

export const AdventurerRenderer = forwardRef<RendererHandle, { companion: AdventurerCompanion; mode: RenderMode; crack?: number; className?: string; previewStage?: Stage | null; onTap?: () => void }>(
  function AdventurerRenderer({ companion: c, mode, crack = 0, className = '', previewStage, onTap }, ref) {
    const art = artFor(c.starprint.coreSign, c.appearance.appearanceOption)
    const [broken, setBroken] = useState<string | null>(null)        // the image that failed, if any
    const [react, setReact] = useState<{ what: Move; n: number } | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
    const who = useRef<HTMLSpanElement>(null)
    const moved = useRef(0)
    useImperativeHandle(ref, () => ({
      react(what) {
        clearTimeout(timer.current)
        setReact(r => ({ what, n: (r?.n ?? moved.current) + 1 }))
        timer.current = setTimeout(() => setReact(null), what === 'hatch' ? 1600 : 950)
      },
    }), [])
    useEffect(() => () => clearTimeout(timer.current), [])

    const sign = signInfo(c.starprint.coreSign), egg = c.hatch.status === 'egg'
    // act the reaction out once what it applies to is on the page (the hatch waits for the Cozmling itself)
    useEffect(() => {
      if (!react || react.n === moved.current || (react.what === 'hatch' && egg)) return
      moved.current = react.n
      if (!calm()) who.current?.animate?.(MOVES[react.what].frames, { duration: MOVES[react.what].ms, easing: 'ease-in-out' })
    }, [react, egg])

    const { asleep, mood } = look(c)
    const src = mode === 'loft' ? art?.full : art?.compact
    const show = src && broken !== src ? src : null
    const stage = previewStage ?? c.progress.visualStage ?? 'hatchling'
    const label = egg ? `${c.name}, a Star Egg` : `${c.name}, ${sign.name} ${sign.archetype}${asleep ? ', asleep' : ''}`
    const [o1, o2] = ELEMENTS[c.starprint.element].orb

    if (mode !== 'loft') return (
      <div className={`sl-compact sl-compact--${mode} ${asleep ? 'is-night' : ''} ${className}`} role="img" aria-label={label} style={{ '--o1': o1, '--o2': o2 } as CSSProperties}>
        <img className="sl-compact__room" src={LOFT_ROOM} alt="" loading="lazy" />
        {egg ? <span className="sl-egg sl-egg--sm" />
          : show ? <img className="sl-compact__who" src={show} alt="" onError={() => setBroken(show)} />
          : <StandIn c={c} />}
        <span className="sl-compact__tag"><Glyph sign={c.starprint.coreSign} size={mode === 'buddy' ? 18 : 20} /><Orb element={c.starprint.element} size={14} /></span>
      </div>
    )

    const tall = (art ? art.stands : 0.52) * STAGE_SCALE[stage] * 100
    const place: CSSProperties = { height: `${tall}%`, aspectRatio: String(art ? art.aspect : 0.6) }
    const hand = art?.anchors.orbHand ?? [0.98, 0.4]
    return (
      <div className={`sl-scene ${asleep ? 'is-night' : ''} ${react ? `is-${react.what}` : ''} ${className}`} role="img" aria-label={`${label}, in the Star Loft. ${mood.line}`}
        style={{ '--o1': o1, '--o2': o2, '--tall': `${egg ? 22 : tall}%` } as CSSProperties}>
        <img className="sl-scene__room" src={LOFT_ROOM} alt="" />
        {egg ? (
          <span className="sl-egg" ref={who} data-crack={crack} onPointerDown={onTap}><i /><i /><i /></span>
        ) : (
          <span className="sl-who" ref={who} style={place} data-low={mood.mood === 'low' || undefined} data-standin={!show || undefined} onPointerDown={onTap}>
            {show ? <img src={show} alt="" draggable={false} onError={() => setBroken(show)} /> : <StandIn c={c} />}
            {!(show && art?.orbBaked) && <Orb element={c.starprint.element} className="sl-who__orb" style={{ left: `${hand[0] * 100}%`, top: `${hand[1] * 100}%` }} />}
          </span>
        )}
        {asleep && !egg && <span className="sl-zzz" aria-hidden="true"><b>z</b><b>z</b><b>z</b></span>}
        {react && POP[react.what] && <span className="sl-pop" aria-hidden="true" key={react.n}>{POP[react.what]}</span>}
        {react?.what === 'hatch' && !egg && <span className="sl-flash" aria-hidden="true" />}
        {art?.placeholder && show && !egg && <span className="sl-scene__note">placeholder art</span>}
        {!show && !egg && <span className="sl-scene__note">{art ? 'art didn’t load' : 'art on its way'} · {sign.name} {sign.archetype}</span>}
      </div>
    )
  },
)
