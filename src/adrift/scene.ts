/* ============================================================
   ADRIFT: the rescue scene.
   One interruptible timeline owns the explorer and the tether (ported from
   the original trial), plus arcade touches: an idle drift, sparks on every
   miss, a green ping on a right letter, the tether snapping on a loss and a
   burst of light when the airlock seals. Reduced motion shows still poses.
   ============================================================ */

export interface Pose { x: number; y: number; scale: number; angle: number; opacity: number }
export type SceneStatus = 'ready' | 'playing' | 'won' | 'lost'

/** Where the tether leaves the ship (the winch) and where a rescue ends (the airlock door), in scene units. */
export const WINCH = { x: 267, y: 138 }
export const DOOR = { x: 230, y: 128 }
const SVGNS = 'http://www.w3.org/2000/svg'

/** Where the astronaut sits: each miss pushes them farther out; a win ends inside the airlock. */
export function rescuePose(misses: number, status: SceneStatus = 'playing'): Pose {
  const n = Math.max(0, Math.min(6, misses))
  if (status === 'won') return { x: DOOR.x, y: DOOR.y, scale: 0.06, angle: -18, opacity: 0 }
  if (status === 'lost') return { x: 430, y: 440, scale: 0.4, angle: 35, opacity: 0.58 }
  return { x: 300 + n * 20, y: 300 + n * 20, scale: 0.6 - n * 0.022, angle: n * 3, opacity: 1 }
}
/** Where the tether clips onto the suit, for a pose. */
export function tetherPoint(p: Pose) {
  const a = (p.angle * Math.PI) / 180
  return { x: p.x + (-20 * Math.cos(a) - 79 * Math.sin(a)) * p.scale, y: p.y + (-20 * Math.sin(a) + 79 * Math.cos(a)) * p.scale }
}

interface State { misses: number; status: SceneStatus; mission: string }
const part = <T extends Element>(root: Element, name: string) => root.querySelector<T>(`[data-part="${name}"]`)!

export class RescueScene {
  readonly actor: SVGGElement; readonly rope: SVGPathElement; readonly loose: SVGPathElement; readonly hatch: SVGElement
  readonly label: SVGTextElement; readonly fx: SVGGElement; readonly beacon: HTMLElement; readonly svg: SVGSVGElement
  pose: Pose = rescuePose(0)
  broken = 0
  previous: State | null = null
  private frame = 0
  private idle = 0
  private lostAt = 0
  private reduced: MediaQueryList

  constructor(readonly root: HTMLElement) {
    this.actor = part(root, 'actor'); this.rope = part(root, 'rope'); this.loose = part(root, 'loose'); this.hatch = part(root, 'hatch')
    this.label = part(root, 'readout'); this.fx = part(root, 'fx'); this.beacon = part(root, 'beacon'); this.svg = root.querySelector('svg')!
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)')
    this.reduced.addEventListener('change', () => { cancelAnimationFrame(this.frame); if (this.previous) this.finish(this.previous) })
  }

  /** Start the idle drift (call once mounted); stop() when unmounting. */
  start() {
    const loop = () => { this.draw(); this.idle = requestAnimationFrame(loop) }
    if (!this.reduced.matches) this.idle = requestAnimationFrame(loop)
  }
  stop() { cancelAnimationFrame(this.idle); cancelAnimationFrame(this.frame); this.idle = 0 }

  /** The timeline sets the base pose; draw() adds the idle drift on top and paints. */
  private paint(p: Pose, broken = 0) { this.pose = p; this.broken = broken; this.draw() }
  private drifted(p: Pose): Pose {
    if (!this.idle || this.reduced.matches) return p
    const t = performance.now() / 1000, s = this.previous?.status
    if (s === 'won') return p
    if (s === 'lost') return { ...p, angle: p.angle + (t - this.lostAt) * 9, x: p.x + Math.sin(t * 0.4) * 4, y: p.y + Math.sin(t * 0.6) * 5 }   // tumbling, out of reach
    return { ...p, x: p.x + Math.sin(t * 0.7) * 3, y: p.y + Math.sin(t * 1.1) * 4.5, angle: p.angle + Math.sin(t * 0.55) * 4 }
  }
  private draw() {
    const p = this.drifted(this.pose), b = this.broken
    this.actor.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${p.angle}) scale(${p.scale}) translate(-220 -250)`)
    this.actor.style.opacity = String(p.opacity)
    const end = tetherPoint(p), cx = (WINCH.x + end.x) / 2, cy = (WINCH.y + end.y) / 2 + 22 * (1 - b)
    this.rope.setAttribute('d', `M${WINCH.x} ${WINCH.y} Q${cx} ${cy} ${end.x} ${end.y}`)
    this.rope.style.opacity = String(1 - b)
    const sway = this.idle && !this.reduced.matches ? Math.sin(performance.now() / 700) * 6 : 0
    this.loose.setAttribute('d', `M${WINCH.x} ${WINCH.y} Q${WINCH.x + 30 + sway} ${WINCH.y + 50 + b * 20} ${WINCH.x + 50 + b * 30 + sway} ${WINCH.y + 70 + b * 30}`)
    this.loose.style.opacity = String(b)
  }

  private describe(s: State) {
    const { status, misses } = s
    this.beacon.textContent = status === 'lost' ? 'Signal lost' : status === 'won' ? 'Crew safe' : 'Signal found'
    this.label.textContent = status === 'won' ? 'AIRLOCK SEALED · CREW SAFE' : status === 'lost' ? 'TETHER DISCONNECTED · SIGNAL LOST'
      : `${String(misses).padStart(2, '0')} / 06 MISSES · ${misses >= 4 ? 'TETHER AT LIMIT' : 'TETHER CONNECTED'}`
    this.svg.setAttribute('aria-label', status === 'won' ? 'The explorer is safely inside the rescue ship. Airlock sealed.'
      : status === 'lost' ? 'Rescue tether disconnected. The explorer is drifting away from the ship.'
      : `The COZMC explorer, tethered to the rescue ship. ${misses} of 6 misses; ${misses === 0 ? 'within rescue range' : 'drifting farther away'}.`)
    this.root.dataset.rescue = status
    this.root.dataset.misses = String(misses)
  }
  private finish(s: State) {
    this.paint(rescuePose(s.misses, s.status), s.status === 'lost' ? 1 : 0)
    this.hatch.style.opacity = s.status === 'won' ? '1' : '.18'
    this.describe(s)
  }

  /** Show a state. A new mission or a restored saved one jumps straight to its pose; changes within a mission animate. */
  update(misses: number, status: SceneStatus = 'ready', mission = 'ready') {
    const next: State = { misses, status, mission }, last = this.previous
    if (last && last.misses === misses && last.status === status && last.mission === mission) return
    this.previous = next
    cancelAnimationFrame(this.frame)
    if (status === 'lost' && last?.status !== 'lost') this.lostAt = performance.now() / 1000
    if (!last || last.mission !== mission || this.reduced.matches) { this.finish(next); return }
    this.describe(next)
    const from = { ...this.pose }, to = rescuePose(misses, status), terminal = status === 'won' || status === 'lost', duration = terminal ? 2600 : 950, t0 = performance.now()
    if (misses > last.misses || status === 'lost') this.alarm()
    if (misses > last.misses && status !== 'lost') this.sparks(tetherPoint(from), ['#ffb020', '#ff7a3d', '#ffd36b'], 14)
    if (status === 'lost') { this.sparks(WINCH, ['#ffb020', '#ff4b3d'], 18, 60); this.sparks(tetherPoint(from), ['#ffb020', '#ff7a3d'], 16) }
    this.label.textContent = status === 'won' ? 'WINCH ENGAGED · RETURNING TO AIRLOCK' : status === 'lost' ? 'TETHER RELEASED · RESCUE LINK LOST' : `${String(misses).padStart(2, '0')} / 06 MISSES · DRIFTING OUTWARD`
    this.hatch.style.opacity = '.18'
    let burst = false
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration), ease = 1 - Math.pow(1 - t, 3), p = {} as Pose
      for (const k of Object.keys(from) as (keyof Pose)[]) p[k] = from[k] + (to[k] - from[k]) * ease
      if (!terminal) { p.angle += Math.sin(t * Math.PI * 4) * 7 * (1 - t); p.y += Math.sin(t * Math.PI * 2) * 9 * (1 - t) }
      if (status === 'won') p.opacity = t < 0.76 ? 1 : Math.max(0, (1 - t) / 0.24)
      this.paint(p, status === 'lost' ? Math.min(1, t * 5) : 0)
      if (status === 'won' && t > 0.75) this.hatch.style.opacity = String((t - 0.75) * 4)
      if (status === 'won' && t > 0.8 && !burst) { burst = true; this.celebrate() }
      if (t < 1) this.frame = requestAnimationFrame(tick); else this.finish(next)
    }
    this.frame = requestAnimationFrame(tick)
  }

  /** A right letter: a green ping from the ship's beacon. */
  ping() {
    if (this.reduced.matches || typeof document === 'undefined') return
    const ring = document.createElementNS(SVGNS, 'circle')
    ring.setAttribute('cx', String(WINCH.x)); ring.setAttribute('cy', String(WINCH.y)); ring.setAttribute('r', '10')
    ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#8dff6a'); ring.setAttribute('stroke-width', '3')
    this.fx.append(ring)
    ring.animate([{ r: 10, opacity: 0.9 } as Keyframe, { r: 90, opacity: 0 } as Keyframe], { duration: 700, easing: 'ease-out' }).onfinish = () => ring.remove()
    this.sparks(tetherPoint(this.pose), ['#8dff6a', '#c9ffb8'], 6, 26)
  }

  /** A miss: an amber flash and a little shake. */
  private alarm() {
    if (this.reduced.matches) return
    this.root.animate?.([{ boxShadow: 'inset 0 0 0 2px #ffb02000' }, { boxShadow: 'inset 0 0 80px 4px #ffb02066', offset: 0.18 }, { boxShadow: 'inset 0 0 0 2px #ffb02000' }], { duration: 900 })
    this.svg.animate?.([{ translate: '0 0' }, { translate: '-5px 2px' }, { translate: '4px -2px' }, { translate: '-2px 1px' }, { translate: '0 0' }], { duration: 320, easing: 'steps(4)' })
  }

  /** The airlock seals: a burst of light, pixel sparks and two rings. */
  private celebrate() {
    if (this.reduced.matches) return
    this.sparks(DOOR, ['#8dff6a', '#f2c45c', '#ffffff', '#59e6ff'], 34, 120)
    for (const [delay, r] of [[0, 140], [180, 200]]) {
      const ring = document.createElementNS(SVGNS, 'circle')
      ring.setAttribute('cx', String(DOOR.x)); ring.setAttribute('cy', String(DOOR.y)); ring.setAttribute('r', '12')
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', delay ? '#f2c45c' : '#8dff6a'); ring.setAttribute('stroke-width', '4')
      ring.style.opacity = '0'
      this.fx.append(ring)
      ring.animate([{ r: 12, opacity: 1 } as Keyframe, { r, opacity: 0 } as Keyframe], { duration: 1100, delay, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => ring.remove()
    }
  }

  /** Square pixel sparks flying out from a point. */
  private sparks(at: { x: number; y: number }, colors: string[], n: number, reach = 46) {
    if (this.reduced.matches || typeof document === 'undefined') return
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.6, d = reach * (0.45 + Math.random() * 0.75), size = 3 + Math.round(Math.random() * 3)
      const r = document.createElementNS(SVGNS, 'rect')
      r.setAttribute('x', String(at.x - size / 2)); r.setAttribute('y', String(at.y - size / 2)); r.setAttribute('width', String(size)); r.setAttribute('height', String(size))
      r.setAttribute('fill', colors[i % colors.length])
      this.fx.append(r)
      r.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 10}px)`, opacity: 0 }],
        { duration: 600 + Math.random() * 500, easing: 'cubic-bezier(.15,.7,.4,1)' }).onfinish = () => r.remove()
    }
  }
}
