/* The Grove's twelve zodiac lanterns, Aries to Pisces, drawn in the page over the painted scenery so each
   one lights on its own. Where there's room they hang from one garland; on a phone, from two garlands of
   six, so every sign stays large enough to read. A lit lantern glows in its element's colour (fire, earth,
   air, water, as in the Starprint); an unlit one is dark glass with its sign still legible. When several
   light at once they come on in zodiac order. */
import type { CSSProperties } from 'react'
import { ZODIAC_PATHS } from '../components/zodiacPaths'
import { signInfo } from '../domain/starprint'
import type { Element, ZodiacSign } from '../types'
import { GROVE_SIGNS } from './communityHatch'

type Glow = { core: string; mid: string; edge: string; rim: string; halo: string; glyph: string }
const GLOW: Record<Element, Glow> = {
  fire: { core: '#fff1c4', mid: '#ff9b3d', edge: '#6e220f', rim: '#ffc27a', halo: '#ff8a2a', glyph: '#fff7e6' },
  earth: { core: '#e4ffef', mid: '#3fe08a', edge: '#0b4529', rim: '#93f5c3', halo: '#3fe08a', glyph: '#f2fff8' },
  air: { core: '#ffffff', mid: '#f5e9b6', edge: '#5e5122', rim: '#fff3c8', halo: '#ffe9a6', glyph: '#fffdf3' },
  water: { core: '#e2f1ff', mid: '#4d9cff', edge: '#0b2862', rim: '#a3cbff', halo: '#4d9cff', glyph: '#f3f9ff' },
}
const ELEMENT_LIST: Element[] = ['fire', 'earth', 'air', 'water']

/** A garland sagging between its two ends (a parabola, drawn as one quadratic curve), and its height at x. */
function garland(x0: number, x1: number, yEnd: number, sag: number) {
  const mid = (x0 + x1) / 2, half = (x1 - x0) / 2
  return {
    d: `M${x0} ${yEnd}Q${mid} ${yEnd + 2 * sag} ${x1} ${yEnd}`,
    at: (x: number) => yEnd + sag * (1 - ((x - mid) / half) ** 2),
  }
}

const star = (s: number) => `M0 ${-s}L${s * .3} ${-s * .3}L${s} 0L${s * .3} ${s * .3}L0 ${s}L${-s * .3} ${s * .3}L${-s} 0L${-s * .3} ${-s * .3}Z`

type Spot = { sign: ZodiacSign; index: number; x: number; y: number }

function Lantern({ spot, lit, r, ids, stroke }: { spot: Spot; lit: boolean; r: number; ids: string; stroke: number }) {
  const { sign, index, x, y } = spot
  const el = signInfo(sign).element
  const chain = r * .45, capH = r * .34, capW = r * .7
  const cy = chain + capH + r * .9, bottom = cy + r * .92, g = r * 1.14
  const glyph = ZODIAC_PATHS[sign].map(d => <path key={d} d={d} />)
  return (
    <g className="grove-lantern" data-sign={sign} data-lit={lit} transform={`translate(${x} ${y})`}
      style={{ '--i': index, '--rim': GLOW[el].rim } as CSSProperties}>
      <circle className="grove-lantern__halo" cy={cy} r={r * 1.95} fill={`url(#${ids}-halo-${el})`} />
      <line className="grove-lantern__chain" x2={0} y2={chain + 2} stroke={`url(#${ids}-gold)`} strokeWidth={Math.max(2, r * .06)} strokeDasharray={`${r * .07} ${r * .05}`} />
      <path className="grove-lantern__star" d={star(r * .17)} fill={`url(#${ids}-gold)`} />
      <path className="grove-lantern__metal" d={`M${-capW / 2} ${chain + capH}h${capW}l${-capW * .16} ${-capH}h${-capW * .68}z`} fill={`url(#${ids}-gold)`} />
      <circle cy={cy} r={r} fill={`url(#${ids}-glass-off)`} />
      <circle className="grove-lantern__glow" cy={cy} r={r} fill={`url(#${ids}-glass-${el})`} />
      <ellipse cx={-r * .38} cy={cy - r * .42} rx={r * .3} ry={r * .15} fill="#fff" opacity=".2" transform={`rotate(-32 ${-r * .38} ${cy - r * .42})`} />
      <circle className="grove-lantern__ring" cy={cy} r={r * .9} strokeWidth={Math.max(1, r * .03)} />
      <circle className="grove-lantern__rim" cy={cy} r={r} strokeWidth={Math.max(1.6, r * .045)} />
      <g transform={`translate(${-g / 2} ${cy - g / 2}) scale(${g / 24})`} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
        <g className="grove-lantern__sign-off">{glyph}</g>
        <g className="grove-lantern__sign-on">
          {/* a soft dark edge under the bright sign keeps it crisp on pale glass (air) as well as deep */}
          <g stroke={GLOW[el].edge} strokeWidth={stroke * 2.2} opacity=".5">{glyph}</g>
          <g stroke={GLOW[el].glyph} filter={`url(#${ids}-sign-glow)`}>{glyph}</g>
        </g>
      </g>
      <path className="grove-lantern__metal" d={`M${-r * .3} ${bottom - r * .08}h${r * .6}l${-r * .17} ${r * .3}h${-r * .26}z`} fill={`url(#${ids}-gold)`} />
    </g>
  )
}

function Defs({ ids }: { ids: string }) {
  return (
    <defs>
      <linearGradient id={`${ids}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffe7a1" /><stop offset=".5" stopColor="#d6a646" /><stop offset="1" stopColor="#8c6421" />
      </linearGradient>
      <radialGradient id={`${ids}-glass-off`} cx=".42" cy=".38" r=".7">
        <stop offset="0" stopColor="#232c48" /><stop offset=".7" stopColor="#111629" /><stop offset="1" stopColor="#080a16" />
      </radialGradient>
      {ELEMENT_LIST.map(el => (
        <radialGradient key={`g-${el}`} id={`${ids}-glass-${el}`} cx=".46" cy=".44" r=".66">
          <stop offset="0" stopColor={GLOW[el].core} stopOpacity=".97" /><stop offset=".3" stopColor={GLOW[el].mid} stopOpacity=".86" /><stop offset=".74" stopColor={GLOW[el].mid} stopOpacity=".5" /><stop offset="1" stopColor={GLOW[el].edge} stopOpacity=".92" />
        </radialGradient>
      ))}
      {ELEMENT_LIST.map(el => (
        <radialGradient key={`h-${el}`} id={`${ids}-halo-${el}`}>
          <stop offset="0" stopColor={GLOW[el].halo} stopOpacity=".55" /><stop offset=".45" stopColor={GLOW[el].halo} stopOpacity=".16" /><stop offset="1" stopColor={GLOW[el].halo} stopOpacity="0" />
        </radialGradient>
      ))}
      <filter id={`${ids}-sign-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation=".9" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`${ids}-bulb`} x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  )
}

/** One or two garlands of lanterns. `rows` lists the signs on each garland, in zodiac order. */
function Garlands({ layout, lit, width, height, rows, r, stroke }: {
  layout: 'wide' | 'narrow'; lit: number; width: number; height: number
  rows: { signs: readonly ZodiacSign[]; yEnd: number; sag: number; inset: number }[]; r: number; stroke: number
}) {
  const ids = `grove-${layout}`
  let n = 0
  return (
    <svg className={`grove grove--${layout}`} data-layout={layout} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <Defs ids={ids} />
      {rows.map((row, ri) => {
        const line = garland(-24, width + 24, row.yEnd, row.sag)
        const step = (width - 2 * row.inset) / (row.signs.length - 1)
        const spots: Spot[] = row.signs.map((sign, k) => { const x = row.inset + k * step; return { sign, index: n++, x, y: line.at(x) } })
        const bulbs = Array.from({ length: Math.floor(width / 46) }, (_, k) => 23 + k * 46)
        return (
          <g key={ri}>
            <path className="grove__wire" d={line.d} />
            <g className="grove__bulbs" filter={`url(#${ids}-bulb)`}>
              {bulbs.map((bx, k) => <circle key={bx} className={k % 5 === 2 ? 'is-twinkle' : undefined} cx={bx} cy={line.at(bx)} r={layout === 'wide' ? 3.2 : 2.4} />)}
            </g>
            {spots.map(spot => <Lantern key={spot.sign} spot={spot} lit={spot.index < lit} r={r} ids={ids} stroke={stroke} />)}
          </g>
        )
      })}
    </svg>
  )
}

export function GroveLanterns({ lit }: { lit: number }) {
  const shown = Math.max(0, Math.min(GROVE_SIGNS.length, lit))
  const names = GROVE_SIGNS.map(s => signInfo(s).name)
  const label = shown === 0 ? 'The twelve zodiac lanterns, Aries to Pisces, are waiting to be lit.'
    : shown === GROVE_SIGNS.length ? 'All twelve zodiac lanterns are lit, Aries to Pisces.'
      : `${shown} of 12 zodiac lanterns lit: ${names.slice(0, shown).join(', ')}.`
  return (
    <div className="community-hatch__grove" role="img" aria-label={label} data-lit-count={shown}>
      <Garlands layout="wide" lit={shown} width={1920} height={394} r={61} stroke={2.2}
        rows={[{ signs: GROVE_SIGNS, yEnd: 22, sag: 116, inset: 150 }]} />
      <Garlands layout="narrow" lit={shown} width={600} height={400} r={42} stroke={2.5}
        rows={[{ signs: GROVE_SIGNS.slice(0, 6), yEnd: 20, sag: 24, inset: 58 }, { signs: GROVE_SIGNS.slice(6), yEnd: 212, sag: 24, inset: 58 }]} />
    </div>
  )
}
