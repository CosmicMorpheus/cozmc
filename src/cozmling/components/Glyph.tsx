/* A zodiac glyph and an elemental orb, drawn in the page (not part of the character art), so they
   stay crisp at any size and readable on the small arcade panel. */
import type { CSSProperties } from 'react'
import { ELEMENTS, signInfo } from '../domain/starprint'
import type { Element, ZodiacSign } from '../types'

/* Hand-drawn strokes for the signs that have art so far. The others use the font's own glyph
   (asked for as text, not emoji) until their final glyph files arrive with the production art. */
const DRAWN: Partial<Record<ZodiacSign, string[]>> = {
  taurus: ['M4.5 3.5c.4 4.2 3.2 7 7.5 7s7.1-2.8 7.5-7', 'M12 10.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10'],
  scorpio: ['M3.5 19V8a2.2 2.2 0 0 1 4.4 0v11', 'M7.9 8a2.2 2.2 0 0 1 4.4 0v11', 'M12.3 8a2.2 2.2 0 0 1 4.4 0v8.2c0 1.9 1.3 2.8 3 2.8h1.3', 'M19 16.5l2.5 2.5L19 21.5'],
}

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
