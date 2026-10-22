import type { ReactElement } from 'react'
import { TIERS, type Tier } from '../lib/tiers'

/* Pixel art from ASCII bitmaps: '.' is empty, letters map to palette colours. */
export function PixelArt({ rows, palette, size = 22, className, title }: {
  rows: string[]; palette: Record<string, string>; size?: number; className?: string; title?: string
}) {
  const w = Math.max(...rows.map(r => r.length)), h = rows.length
  const rects: ReactElement[] = []
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.' && palette[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[ch]} />)
  }))
  return (
    <svg className={className} width={size} height={size * (h / w)} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {rects}
    </svg>
  )
}

export const ICONS = {
  cozmling: ['...a.a...', '....a....', '..aaaaa..', '.aaaaaaa.', '.a.aaa.a.', '.aaaaaaa.', '.aa...aa.', '..aaaaa..', '...a.a...'],
  home: ['....a....', '...aaa...', '..aaaaa..', '.aaaaaaa.', 'aaaaaaaaa', '.a.....a.', '.a.aaa.a.', '.a.a.a.a.', '.a.a.a.a.'],
  arcade: ['...aaa...', '..aaaaa..', '...aaa...', '....a....', '....a....', '.aaaaaaa.', 'a.......a', 'a.aa.aa.a', 'aaaaaaaaa'],
  leaderboard: ['aaaaaaaaa', 'a.aaaaa.a', 'a.aaaaa.a', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....', '...aaa...', '..aaaaa..'],
  holders: ['.aa...aa.', 'aaaa.aaaa', 'aaaa.aaaa', '.aa...aa.', '.........', 'aaaa.aaaa', 'aaaaaaaaa', 'aaaaaaaaa', 'aaaaaaaaa'],
  philosophy: ['.........', '..aaaaa..', '.a.....a.', 'a..aaa..a', 'a.aa.aa.a', 'a..aaa..a', '.a.....a.', '..aaaaa..', '.........'],
  about: ['aaaaaaaaa', 'a.......a', 'a...a...a', 'a.......a', 'a...a...a', 'a...a...a', 'a...a...a', 'a.......a', 'aaaaaaaaa'],
  heart: ['.aa.aa.', 'aaaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  play: ['a....', 'aa...', 'aaa..', 'aaaa.', 'aaa..', 'aa...', 'a....'],
  card: ['.aaaaaaa.', 'a.......a', 'a.aaaaa.a', 'a.a...a.a', 'a.aaaaa.a', 'a.......a', 'a.aa.aa.a', 'a.......a', '.aaaaaaa.'],
  trophy: ['aaaaaaaaa', 'a.aaaaa.a', 'a.aaaaa.a', '.aaaaaaa.', '..aaaaa..', '...aaa...', '....a....', '...aaa...', '..aaaaa..'],
  fire: ['....a....', '...aa....', '...aaa...', '..aaaa.a.', '.aaaaaaa.', '.aaa.aaa.', 'aaa...aaa', 'aaa...aaa', '.aaaaaaa.'],
  gift: ['..a...a..', '...a.a...', 'aaaaaaaaa', 'a...a...a', 'aaaaaaaaa', '.a..a..a.', '.a..a..a.', '.a..a..a.', '.aaaaaaa.'],
  lock: ['..aaaaa..', '.a.....a.', '.a.....a.', 'aaaaaaaaa', 'aaaa.aaaa', 'aaa...aaa', 'aaaa.aaaa', 'aaaa.aaaa', 'aaaaaaaaa'],
} as const

/* One glyph per achievement kind, drawn inside the medal. */
export const BADGE_ART: Record<string, string[]> = {
  arcade: ['...aaa...', '..aaaaa..', '...aaa...', '....a....', '....a....', '.aaaaaaa.', 'a.......a', 'a.aa.aa.a', 'aaaaaaaaa'],
  chain: ['.........', '.aaa.....', 'a...a....', 'a..aaaa..', 'a..a.a.a.', '.aaaa..a.', '....a...a', '.....aaa.', '.........'],
  daily: ['.a.....a.', 'aaaaaaaaa', 'a.......a', 'a.a.a.a.a', 'a.......a', 'a.a.a.aaa', 'a.....aaa', 'a.......a', 'aaaaaaaaa'],
  fire: ['....a....', '...aa....', '...aaa...', '..aaaa.a.', '.aaaaaaa.', '.aaa.aaa.', 'aaa...aaa', 'aaa...aaa', '.aaaaaaa.'],
  holder: ['.........', '.aa...aa.', 'a..a.a..a', 'a...a...a', 'a..a.a..a', '.aa...aa.', '.........', '.........', '.........'],
  wisdom: ['.........', '..aaaaa..', '.a.....a.', 'a..aaa..a', 'a.aa.aa.a', 'a..aaa..a', '.a.....a.', '..aaaaa..', '.........'],
}
export const BADGE_COLOR: Record<string, string> = { arcade: '#8dff6a', chain: '#ff8ad8', daily: '#59e6ff', fire: '#ff5a1f', holder: '#ffd13a', wisdom: '#b06bff' }

/** A pixel medal: octagon rim in the kind's colour, glyph inside. Locked = dim outline. */
export function Medal({ kind, locked = false, size = 44, title }: { kind: string; locked?: boolean; size?: number; title?: string }) {
  const c = locked ? '#3a3a37' : BADGE_COLOR[kind] ?? '#8dff6a'
  const rim = ['...aaaaaaa...', '..a.......a..', '.a.........a.', 'a...........a', 'a...........a', 'a...........a', 'a...........a', 'a...........a', 'a...........a', 'a...........a', '.a.........a.', '..a.......a..', '...aaaaaaa...']
  const art = BADGE_ART[kind] ?? BADGE_ART.arcade
  const rows = rim.map((r, y) => {
    const first = r.indexOf('a'), last = r.lastIndexOf('a')   // interior = strictly between the rim pixels
    return [...r].map((ch, x) => {
      if (ch === 'a') return 'a'
      const gy = y - 2, gx = x - 2
      if (gy >= 0 && gy < 9 && gx >= 0 && gx < 9 && art[gy][gx] === 'a') return locked ? 'c' : 'b'
      return x > first && x < last ? 'd' : '.'
    }).join('')
  })
  return <PixelArt rows={rows} palette={{ a: c, b: c, c: '#2a2a28', d: locked ? '#0c0c0b' : '#0d140b' }} size={size} title={title} />
}

export const FLAME = ['....a....', '...aa....', '...aba...', '..abba.a.', '.abbbbaa.', '.abbcbba.', 'abbcccbba', 'abcccccba', '.abcccba.', '..aaaaa..']
export const FLAME_PAL = { a: '#ff2d2d', b: '#ff6a1a', c: '#ffd13a' }

export function Icon({ name, size = 16, color = 'currentColor' }: { name: keyof typeof ICONS; size?: number; color?: string }) {
  return <PixelArt rows={ICONS[name] as unknown as string[]} palette={{ a: color }} size={size} />
}

export function Flame({ size = 18, className }: { size?: number; className?: string }) {
  return <PixelArt rows={FLAME} palette={FLAME_PAL} size={size} className={className} />
}

export function TierBadge({ tier, size = 22, label = false }: { tier: Tier; size?: number; label?: boolean }) {
  const [a, b, c] = tier.palette
  return (
    <span className="tier" style={{ ['--tc' as string]: tier.color }}>
      <PixelArt rows={tier.art} palette={{ a, b, c }} size={size} title={label ? undefined : tier.name} />
      {label && <span className="tier__name">{tier.name}</span>}
    </span>
  )
}

export { TIERS }
