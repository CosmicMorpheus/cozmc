/* A zodiac glyph and an elemental orb, drawn in the page (not part of the character art), so they
   stay crisp at any size and readable on the small arcade panel. */
import type { CSSProperties } from 'react'
import { ELEMENTS, signInfo } from '../domain/starprint'
import type { Element, ZodiacSign } from '../types'
import { ZODIAC_PATHS } from './zodiacPaths'

/* Hand-drawn strokes for the signs that have art so far. The others use the font's own glyph
   (asked for as text, not emoji) until their final glyph files arrive with the production art.
   (All twelve are drawn in zodiacPaths.ts; the Grove's lanterns use the full set.) */
const DRAWN: Partial<Record<ZodiacSign, string[]>> = { taurus: ZODIAC_PATHS.taurus, scorpio: ZODIAC_PATHS.scorpio }

export function Glyph({ sign, size = 20, className = '' }: { sign: ZodiacSign; size?: number; className?: string }) {
  const d = DRAWN[sign]
  if (d) return (
    <svg className={`sl-glyph ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map(p => <path key={p} d={p} />)}
    </svg>
  )
  return <span className={`sl-glyph sl-glyph--text ${className}`} style={{ fontSize: size * 0.92, width: size, height: size }} aria-hidden="true">{signInfo(sign).glyph}{'︎'}</span>
}

/** One sphere blending the element's two colours. Give a size in pixels, or leave it out and size it in CSS. */
export function Orb({ element, size, className = '', style }: { element: Element; size?: number; className?: string; style?: CSSProperties }) {
  const [a, b] = ELEMENTS[element].orb
  return <span className={`sl-orb ${className}`} style={{ '--o1': a, '--o2': b, ...(size == null ? {} : { width: size, height: size }), ...style } as CSSProperties} aria-hidden="true" />
}
