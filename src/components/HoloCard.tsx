import { useEffect, useRef, useState, type RefObject } from 'react'
import { useChain } from '../lib/data'
import { fmt } from '../lib/format'
import { ASA_ID } from '../config'

const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Pointer-driven tilt + foil position for any `.holo` element (sets --px --py --rx --ry --op). */
export function useHoloTilt(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current!
    const s = { tx: 50, ty: 50, to: 0, x: 50, y: 50, o: 0, active: false, raf: 0, visible: true }
    const max = 16
    const set = () => {
      const dx = (s.x - 50) / 50, dy = (s.y - 50) / 50
      el.style.setProperty('--px', s.x.toFixed(2)); el.style.setProperty('--py', s.y.toFixed(2))
      el.style.setProperty('--rx', `${(-dy * max * 0.85).toFixed(2)}deg`); el.style.setProperty('--ry', `${(dx * max).toFixed(2)}deg`)
      el.style.setProperty('--op', s.o.toFixed(3))
    }
    const tick = (now: number) => {
      if (!RM && !s.active) { const t = now / 1000; s.tx = 50 + 30 * Math.sin(t * 0.6); s.ty = 50 + 20 * Math.cos(t * 0.43); s.to = 0.6 }
      const k = s.active ? 0.16 : 0.055
      s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; s.o += (s.to - s.o) * k
      set()
      s.raf = s.visible && (!RM || s.active) ? requestAnimationFrame(tick) : 0
    }
    const kick = () => { if (!s.raf) s.raf = requestAnimationFrame(tick) }
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      s.tx = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)); s.ty = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))
      s.to = 1; s.active = true; kick()
    }
    const leave = () => { s.active = false; s.tx = 50; s.ty = 50; s.to = 0; kick() }
    const io = new IntersectionObserver(([en]) => { s.visible = en.isIntersecting; if (s.visible) kick() })
    io.observe(el)
    el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave); el.addEventListener('pointercancel', leave)
    kick()
    return () => { io.disconnect(); cancelAnimationFrame(s.raf); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); el.removeEventListener('pointercancel', leave) }
  }, [])
}

/* The COZMC holographic card: pointer-driven tilt, rainbow foil, glare. Click to flip to its stat sheet. */
export function HoloCard() {
  const ref = useRef<HTMLButtonElement>(null)
  const [flipped, setFlipped] = useState(false)
  const { asset } = useChain()

  useHoloTilt(ref)

  const a = asset.data
  return (
    <button ref={ref} className={`holo${flipped ? ' is-flipped' : ''}`} onClick={() => setFlipped(f => !f)} aria-pressed={flipped}
      aria-label={flipped ? 'COZMC card showing token stats. Press to flip back.' : 'COZMC holographic card. Press to flip and see the token stats.'}>
      <span className="holo__tilt"><span className="holo__flip">
        <span className="holo__face holo__front">
          <video autoPlay={!RM} muted loop playsInline preload="auto" poster="/assets/card-face.webp" width={582} height={824}>
            <source src="/assets/card-face.mp4" type="video/mp4" />
          </video>
          <span className="holo__shine" /><span className="holo__shine holo__shine--frame" /><span className="holo__glitter" /><span className="holo__glare" />
        </span>
        <span className="holo__face holo__back cardback">
          <span className="cardback__title">COZMC</span>
          <span className="cardback__sub">Stat sheet</span>
          <span className="cardback__stats">
            <span><b>Unit</b><i /><span>{a?.unit ?? 'COZMC'}</span></span>
            <span><b>Supply</b><i /><span>{fmt(a?.total ?? 1e9)}</span></span>
            <span><b>Decimals</b><i /><span>{a?.decimals ?? 6}</span></span>
            <span><b>Clawback</b><i /><span className={a?.clawback ? '' : 'ok'}>{a?.clawback ? 'Set' : 'None'}</span></span>
            <span><b>Freeze</b><i /><span className={a?.freeze ? '' : 'ok'}>{a?.freeze ? 'Set' : 'None'}</span></span>
            <span><b>Chain</b><i /><span>Algorand</span></span>
          </span>
          <span className="cardback__foot">ASA {ASA_ID}</span>
          <span className="holo__shine" /><span className="holo__glare" />
        </span>
      </span></span>
    </button>
  )
}
