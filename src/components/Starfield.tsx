import { useEffect, useRef } from 'react'

/* A low-res pixel starfield behind everything: chunky stars, slow drift, faint twinkle. */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!, ctx = cv.getContext('2d')!
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches
    const SCALE = 3 // each logical pixel = 3 CSS px
    let W = 0, H = 0, raf = 0, stars: { x: number; y: number; z: number; p: number }[] = []
    const size = () => {
      W = Math.ceil(innerWidth / SCALE); H = Math.ceil(innerHeight / SCALE)
      cv.width = W; cv.height = H
      stars = Array.from({ length: Math.round((W * H) / 260) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() < 0.85 ? 1 : 2, p: Math.random() * 6.3 }))
    }
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H)
      for (const s of stars) {
        if (!RM) { s.y += s.z === 2 ? 0.05 : 0.018; if (s.y > H) { s.y = 0; s.x = Math.random() * W } }
        const tw = RM ? 1 : 0.5 + 0.5 * Math.sin(t / 900 + s.p)
        ctx.fillStyle = s.z === 2 ? `rgba(241,239,230,${0.55 + 0.45 * tw})` : `rgba(160,160,150,${0.25 + 0.3 * tw})`
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1)
      }
      if (!RM) raf = requestAnimationFrame(draw)
    }
    size(); draw(0)
    const onResize = () => { size(); if (RM) draw(0) }
    addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize) }
  }, [])
  return <canvas ref={ref} className="starfield" aria-hidden="true" />
}
