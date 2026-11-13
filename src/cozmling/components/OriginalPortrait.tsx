/* The original Cozmling, drawn small: for choosing a look. Like the first version's adoption preview,
   it grows through its stages on a loop (Sprout, Cadet, Explorer, Guardian), unless reduced motion
   is asked for, when it stands still as a Cadet. Decoration only: the choice it shows is labelled. */
import { useEffect, useRef } from 'react'
import { drawBulbGlow, drawCozmling, type Look, type Stage } from '../../companion/look'

const GROWING: Stage[] = ['sprout', 'cadet', 'explorer', 'guardian']
const W = 48, H = 60

export function OriginalPortrait({ look, className }: { look: Look; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current, g = c?.getContext('2d')
    if (!c || !g) return
    const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    const paint = (stage: Stage) => {
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false
      drawBulbGlow(g, drawCozmling(g, W / 2, H - 3, look, stage, 'idle', 1), 1)
      c.dataset.stage = stage
    }
    if (calm) { paint('cadet'); return }
    let i = 0
    paint(GROWING[0])
    const timer = window.setInterval(() => paint(GROWING[(i = (i + 1) % GROWING.length)]), 1400)
    return () => clearInterval(timer)
  }, [look.form, look.body, look.glow, look.eyes])
  return <canvas ref={ref} width={W} height={H} className={`sl-portrait${className ? ` ${className}` : ''}`} aria-hidden="true" />
}
