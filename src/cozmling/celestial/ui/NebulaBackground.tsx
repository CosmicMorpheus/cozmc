/* A slow violet nebula behind the Star Chart pages (the observatory), from Mark's "cosmic violet nebula" clip
   (25 s, looping), made web-sized: 1280×720, no sound, about half a megabyte.
   - Plays muted and inline, and stops while the tab is hidden.
   - Follows the site's "Pause background" button (App.tsx sets data-background-paused on <html>).
   - A still frame instead of the video for anyone who asks for less motion or to save data.
   - Purely decoration: hidden from screen readers and never in the way of a click.
   - Placed on <body>, not inside the page: the page's own boxes would otherwise frame it to the content column. */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import webm from './media/nebula-720.webm'
import mp4 from './media/nebula-720.mp4'
import poster from './media/nebula-poster.jpg'

const PAUSED = 'data-background-paused'
const sitePaused = () => document.documentElement.hasAttribute(PAUSED)
const wantsStill = () => {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  return reduced || saveData
}

export function NebulaBackground() {
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(sitePaused)
  const [still, setStill] = useState(wantsStill)

  // the site's Pause background button, and a change of the reduced-motion setting while the page is open
  useEffect(() => {
    const watch = new MutationObserver(() => setPaused(sitePaused()))
    watch.observe(document.documentElement, { attributes: true, attributeFilter: [PAUSED] })
    const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
    const onMotion = () => setStill(wantsStill())
    motion?.addEventListener?.('change', onMotion)
    return () => { watch.disconnect(); motion?.removeEventListener?.('change', onMotion) }
  }, [])

  // play only while the page is visible and the background isn't paused
  useEffect(() => {
    const v = video.current
    if (!v) return
    const sync = () => { if (paused || document.hidden) v.pause(); else void v.play().catch(() => { /* autoplay refused: the first frame stays */ }) }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [paused, still])

  return createPortal(
    <div className="sk-nebula" aria-hidden="true">
      {still
        ? <img src={poster} alt="" decoding="async" />
        : (
          <video ref={video} muted loop playsInline autoPlay={!paused} preload="auto" poster={poster} disablePictureInPicture tabIndex={-1}>
            <source src={webm} type="video/webm" />
            <source src={mp4} type="video/mp4" />
          </video>
        )}
    </div>,
    document.body,
  )
}
