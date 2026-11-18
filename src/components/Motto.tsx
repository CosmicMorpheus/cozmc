/* The COZMC motto at the foot of every page (but the Star Chart): "Drip by drip, the bucket fills.",
   "Brick by brick, we build." with its digital rain, and "Practice over perfection", on plain black.
   - The rain is a 90 KB looping video (made from the 2.5 MB animated image); it only plays while the motto is
     on screen and the site's background isn't paused (App.tsx sets data-background-paused on <html>).
   - A still image for anyone who asks for less motion or to save data, and until the video can play.
   - The words are real text for screen readers: the image's alt, and the two lines around it. */
import { useEffect, useRef, useState } from 'react'
import mp4 from '../assets/motto/brick-by-brick.mp4'
import webm from '../assets/motto/brick-by-brick.webm'

const STILL = '/assets/cozmc-brick-by-brick-v2-still.webp'
const wantsStill = () => {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  return reduced || saveData
}

export function Motto() {
  const box = useRef<HTMLElement>(null), video = useRef<HTMLVideoElement>(null)
  const [still] = useState(wantsStill)

  useEffect(() => {
    const v = video.current, el = box.current
    if (!v || !el) return
    let seen = false
    const sync = () => {
      const paused = document.documentElement.hasAttribute('data-background-paused')
      if (seen && !paused && !document.hidden) void v.play().catch(() => { /* the still frame stays */ })
      else v.pause()
    }
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync() }, { rootMargin: '120px' })
    io.observe(el)
    const watch = new MutationObserver(sync)
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-background-paused'] })
    document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); watch.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [still])

  return (
    <section ref={box} className="motto" aria-label="Motto">
      <p>Drip by drip, the bucket fills.</p>
      <div className="motto__brick">
        {still
          ? <img src={STILL} alt="Brick by brick, we build." width={960} height={115} loading="lazy" decoding="async" />
          : (
            <video ref={video} muted loop playsInline preload="none" poster={STILL} width={960} height={116}
              aria-label="Brick by brick, we build." disablePictureInPicture tabIndex={-1}>
              <source src={webm} type="video/webm" />
              <source src={mp4} type="video/mp4" />
            </video>
          )}
      </div>
      <span>Practice over perfection</span>
    </section>
  )
}
