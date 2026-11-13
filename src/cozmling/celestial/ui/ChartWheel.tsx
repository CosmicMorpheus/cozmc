/* The birth chart as a wheel, drawn the way astrologers draw one: the Rising sign on the left, the
   zodiac running anticlockwise, the Midheaven towards the top, the planets around the rim and the
   aspects as lines across the middle. A drawing only: every fact in it is also in the table beside
   it, which is how a keyboard or a screen reader goes through the chart. */
import { useMemo } from 'react'
import { signInfo } from '../../domain/starprint'
import type { Element } from '../../types'
import { ASPECT_WORDS } from '../interpret'
import type { Aspect, BodyId, CelestialBirthRecord, PointId } from '../types'
import { BODIES, norm360, POINTS, rad, ZODIAC } from '../zodiac'

const SIZE = 440, C = SIZE / 2
const R = { outer: 214, sign: 182, house: 162, planet: 136, degree: 114, aspect: 98 }
const T = '︎'

/** Planets bunched together are nudged apart so every glyph can be read; a short line points to where each really is. */
function spread(points: { id: BodyId; lon: number }[], asc: number, gap: number) {
  const items = points.map(p => ({ ...p, a: norm360(p.lon - asc) })).sort((x, y) => x.a - y.a)
  const pos = items.map(i => i.a)
  for (let round = 0; round < 120; round++) {
    let moved = false
    for (let i = 0; i < pos.length; i++) {
      const j = (i + 1) % pos.length, d = norm360(pos[j] - pos[i])
      if (d < gap) { const push = (gap - d) / 2 + 0.01; pos[i] -= push; pos[j] += push; moved = true }
    }
    if (!moved) break
  }
  return items.map((it, k) => ({ id: it.id, lon: it.lon, shown: norm360(pos[k] + asc) }))
}

export function ChartWheel({ sky, title, focus, focusAspect, onPick }: { sky: CelestialBirthRecord; title: string; focus: PointId | null; focusAspect: Aspect | null; onPick: (p: PointId) => void }) {
  const asc = sky.angles?.ascendant.lon ?? 0
  const xy = (lon: number, r: number) => { const t = rad(180 + lon - asc); return [C + r * Math.cos(t), C - r * Math.sin(t)] as const }
  const placed = useMemo(() => spread(BODIES.map(b => ({ id: b, lon: sky.bodies[b].lon })), asc, 10.5), [sky, asc])
  const lonOf = (p: PointId) => (p === 'ascendant' || p === 'midheaven' ? sky.angles?.[p].lon : sky.bodies[p].lon) ?? 0
  const lit = (a: Aspect) => (focusAspect ? focusAspect === a : focus ? a.a === focus || a.b === focus : true)
  const wedge = (a0: number, a1: number, r0: number, r1: number) => {
    const [x0, y0] = xy(a0, r1), [x1, y1] = xy(a1, r1), [x2, y2] = xy(a1, r0), [x3, y3] = xy(a0, r0)
    return `M${x0} ${y0}A${r1} ${r1} 0 0 0 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 1 ${x3} ${y3}Z`
  }
  const f = (n: number) => Math.round(n * 100) / 100

  return (
    <svg className="sk-wheel" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby="sk-wheel-t sk-wheel-d">
      <title id="sk-wheel-t">{title}</title>
      <desc id="sk-wheel-d">A zodiac wheel showing where the Sun, Moon and planets were. The same details are listed in the table of placements.</desc>
      <circle className="sk-w-bg" cx={C} cy={C} r={R.outer} />

      {/* the twelve signs */}
      {ZODIAC.map((s, k) => {
        const el: Element = signInfo(s).element, [gx, gy] = xy(k * 30 + 15, (R.outer + R.sign) / 2)
        return (
          <g key={s}>
            <path className={`sk-w-sign sk-w-sign--${el}`} d={wedge(k * 30, k * 30 + 30, R.sign, R.outer)} />
            <text className={`sk-w-zod sk-w-zod--${el}`} x={f(gx)} y={f(gy)}>{signInfo(s).glyph}{T}</text>
          </g>
        )
      })}
      {/* five-degree marks */}
      {Array.from({ length: 72 }, (_, k) => { const [x0, y0] = xy(k * 5, R.sign), [x1, y1] = xy(k * 5, R.sign - (k % 2 ? 4 : 7)); return <line key={k} className="sk-w-tick" x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} /> })}

      {/* the houses: with whole-sign houses, each one is a whole sign, counted from the Rising sign's */}
      <circle className="sk-w-ring" cx={C} cy={C} r={R.house} />
      <circle className="sk-w-ring" cx={C} cy={C} r={R.aspect} />
      {sky.houses && sky.houses.map((s, k) => {
        const mid = ZODIAC.indexOf(s) * 30 + 15, [x, y] = xy(mid, (R.sign + R.house) / 2)
        return <text key={s} className="sk-w-house" x={f(x)} y={f(y)}>{k + 1}</text>
      })}
      {ZODIAC.map((_, k) => { const [x0, y0] = xy(k * 30, R.house), [x1, y1] = xy(k * 30, R.aspect); return <line key={k} className="sk-w-spoke" x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} /> })}

      {/* the horizon and the meridian */}
      {sky.angles && ([['AC', sky.angles.ascendant.lon], ['DC', sky.angles.ascendant.lon + 180], ['MC', sky.angles.midheaven.lon], ['IC', sky.angles.midheaven.lon + 180]] as const).map(([label, lon]) => {
        const [x0, y0] = xy(lon, R.aspect), [x1, y1] = xy(lon, R.outer), [lx, ly] = xy(lon + 4.5, R.aspect - 10)
        const main = label === 'AC' || label === 'MC'
        return (
          <g key={label} className={`sk-w-axis${main ? ' is-main' : ''}${(label === 'AC' && focus === 'ascendant') || (label === 'MC' && focus === 'midheaven') ? ' is-focus' : ''}`} onClick={main ? () => onPick(label === 'AC' ? 'ascendant' : 'midheaven') : undefined}>
            <line x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} />
            <text x={f(lx)} y={f(ly)}>{label}</text>
          </g>
        )
      })}

      {/* aspects */}
      {sky.aspects.filter(a => a.kind !== 'conjunction').map(a => {
        const [x0, y0] = xy(lonOf(a.a), R.aspect - 2), [x1, y1] = xy(lonOf(a.b), R.aspect - 2)
        return <line key={`${a.a}-${a.b}`} className={`sk-w-asp sk-w-asp--${ASPECT_WORDS[a.kind].mood}${lit(a) ? ' is-lit' : ''}`} x1={f(x0)} y1={f(y0)} x2={f(x1)} y2={f(y1)} style={{ strokeOpacity: lit(a) ? 0.35 + 0.6 * a.score : 0.08 }} />
      })}
      <path className="sk-w-star" d={`M${C} ${C - 9}L${C + 2.2} ${C - 2.2}L${C + 9} ${C}L${C + 2.2} ${C + 2.2}L${C} ${C + 9}L${C - 2.2} ${C + 2.2}L${C - 9} ${C}L${C - 2.2} ${C - 2.2}Z`} />

      {/* the planets */}
      {placed.map(p => {
        const b = sky.bodies[p.id], [tx0, ty0] = xy(p.lon, R.sign), [tx1, ty1] = xy(p.lon, R.sign - 11)
        const [gx, gy] = xy(p.shown, R.planet), [dx, dy] = xy(p.shown, R.degree), [lx, ly] = xy(p.shown, R.planet + 13)
        const on = focus === p.id || (focusAspect && (focusAspect.a === p.id || focusAspect.b === p.id))
        return (
          <g key={p.id} className={`sk-w-pl${on ? ' is-focus' : ''}`} onClick={() => onPick(p.id)}>
            <line className="sk-w-pltick" x1={f(tx0)} y1={f(ty0)} x2={f(tx1)} y2={f(ty1)} />
            {Math.abs(norm360(p.shown - p.lon + 180) - 180) > 1.2 && <line className="sk-w-lead" x1={f(tx1)} y1={f(ty1)} x2={f(lx)} y2={f(ly)} />}
            <circle className="sk-w-plbg" cx={f(gx)} cy={f(gy)} r={13} />
            <text className="sk-w-glyph" x={f(gx)} y={f(gy)}>{POINTS[p.id].glyph}</text>
            <text className="sk-w-deg" x={f(dx)} y={f(dy)}>{Math.floor(b.degree)}°{b.retrograde ? '℞' : ''}</text>
          </g>
        )
      })}
    </svg>
  )
}
