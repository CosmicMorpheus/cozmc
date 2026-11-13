/* The Cosmic Vortex (render/cosmicVortex.ts) as a backdrop behind a page.

   - It fills the screen behind everything (rendered straight into <body>, under the content), and
     shows only while `stage` is on screen.
   - Its sphere is kept exactly behind `anchor` (the zodiac wheel), following it as the page scrolls.
   - It never takes a click: it is decoration only, hidden from screen readers.
   - It moves at 24 to 30 frames a second (12 when the sphere is off screen), stops when the page
     is hidden or the stage has scrolled away, and is drawn once and kept still for anyone who asks
     for reduced motion, or on a device saving data or very short of memory.
   - If a canvas can't be drawn at all, the CSS background behind it (a still, similar sky) stays. */
import { useEffect, useRef, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { createVortex, diskFor, dprFor, type Quality, type Sphere, type Vortex, type VortexPalette } from '../render/cosmicVortex'

/** The moment shown when it is kept still. */
const STILL_AT = 23.5

export function CosmicVortex({ stage, anchor, anchorRatio = 1, seed, palette }: {
  stage: RefObject<Element | null>
  /** the element the sphere sits behind (its centre; its half-width × anchorRatio is the sphere's radius) */
  anchor?: RefObject<Element | null>
  anchorRatio?: number
  seed?: string
  palette?: VortexPalette
}) {
  const host = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = host.current, canvas = cv.current
    if (!el || !canvas) return
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
    const calm = matchMedia('(prefers-reduced-motion: reduce)')
    const saving = !!nav.connection?.saveData || (nav.deviceMemory ?? 8) <= 2
    const small = matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 700
    const quality: Quality = small || (navigator.hardwareConcurrency ?? 8) <= 4 ? 'low' : 'high'
    let vortex: Vortex
    try { vortex = createVortex(canvas, { seed, palette, quality }) } catch { el.dataset.state = 'fallback'; el.classList.add('is-on'); return }

    let still = calm.matches || saving, onStage = true, raf = 0, last = -1e9, t0 = performance.now()
    let frames = 0, spent = 0, builtW = 0, builtH = 0, sphereOnScreen = true

    const sphereNow = (): Sphere | null => {
      const a = anchor?.current?.getBoundingClientRect()
      if (!a || !a.width) return null
      return { x: a.left + a.width / 2, y: a.top + a.height / 2, r: (a.width / 2) * anchorRatio + 2 }
    }
    const draw = (t: number) => {
      const begin = performance.now(), s = sphereNow()
      if (s) { const d = diskFor(s.r); sphereOnScreen = s.y + d.rOut * d.k > -40 && s.y - d.rOut * d.k < innerHeight + 40 } else sphereOnScreen = false
      vortex.frame(t, s && sphereOnScreen ? s : null)
      spent += performance.now() - begin
      if (++frames % 30 === 0) { el.dataset.frames = String(frames); el.dataset.ms = (spent / 30).toFixed(2); spent = 0 }
      if (s) el.dataset.sphere = `${Math.round(s.x)},${Math.round(s.y)},${Math.round(s.r)}`
    }
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const fps = !sphereOnScreen ? 12 : quality === 'high' ? 30 : 24
      if (now - last < 1000 / fps - 2) return
      last = now
      draw((now - t0) / 1000)
    }
    const status = () => { el.dataset.state = still ? 'static' : onStage && !document.hidden ? 'running' : 'paused' }
    const run = () => {
      cancelAnimationFrame(raf); raf = 0
      el.classList.toggle('is-on', onStage)
      status()
      if (!onStage) return
      if (still) draw(STILL_AT)
      else if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    // the sky is rebuilt only when the width changes or the screen grows taller: a phone's toolbar
    // sliding in and out shouldn't make it start again
    const fit = () => {
      const w = innerWidth, h = Math.max(innerHeight, builtW === w ? builtH : 0)
      if (w === builtW && h === builtH) return false
      builtW = w; builtH = h
      vortex.resize(w, h, dprFor(w, h, devicePixelRatio || 1))
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`
      return true
    }
    let resizeTimer = 0
    const onResize = () => { clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { if (fit() && onStage) { if (still) draw(STILL_AT) } }, 120) }
    // while still, it is redrawn as the page scrolls so the sphere stays behind the wheel; while
    // moving, a scroll gets a frame straight away rather than waiting for the next tick
    let pending = 0
    const onScroll = () => { if (!onStage || pending) return; pending = requestAnimationFrame(() => { pending = 0; draw(still ? STILL_AT : (performance.now() - t0) / 1000) }) }
    const onVisibility = () => run()
    const onCalm = () => { still = calm.matches || saving; run() }

    fit()
    const io = typeof IntersectionObserver === 'function' && stage.current ? new IntersectionObserver(es => { onStage = es[es.length - 1].isIntersecting; run() }) : null
    if (io && stage.current) io.observe(stage.current)
    run()
    addEventListener('resize', onResize)
    addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    calm.addEventListener?.('change', onCalm)
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(pending); clearTimeout(resizeTimer)
      io?.disconnect()
      removeEventListener('resize', onResize); removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      calm.removeEventListener?.('change', onCalm)
    }
  }, [stage, anchor, anchorRatio, seed, palette])

  return createPortal(<div ref={host} className="cv" aria-hidden="true"><canvas ref={cv} /></div>, document.body)
}
