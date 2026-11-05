import { useEffect, useRef, useState } from 'react'
import { MUSIC_IDS } from '../config'

/* Background music: the YouTube tracks in a fresh random order every visit, looping.
   It starts as soon as the site opens wherever the browser allows sound; most browsers
   and phones block sound until the visitor first interacts, so it's retried on the first
   click/tap/keypress anywhere. Pausing lasts for this visit; the next visit plays again.
   When it starts, the button flashes with a "tap here to pause" label so it's easy to find.
   A track that won't play is skipped. */
const shuffled = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] } return o }
const KEY = 'cozmc-music'
const store = { get: () => { try { return sessionStorage.getItem(KEY) } catch { return null } }, set: (v: string | null) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY) } catch { /* private mode */ } } }
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function MusicButton() {
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const [intro, setIntro] = useState(false)          // the "music on · tap to pause" flash, once per visit
  const introShown = useRef(false)
  const toggle = useRef<() => void>(() => {})
  const skip = useRef<() => void>(() => {})

  useEffect(() => {
    if (!MUSIC_IDS.length) return
    let player: any = null, ready = false, dead = false, track = 0
    const order = shuffled(MUSIC_IDS)
    const failed = new Set<number>()
    let want = store.get() !== 'off'
    const GEST = ['pointerdown', 'click', 'keydown', 'touchend']
    const isOn = () => ready && player.getPlayerState?.() === window.YT.PlayerState.PLAYING
    const start = () => { if (ready && !dead) { player.unMute(); player.setVolume(45); player.playVideo() } }
    const gesture = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('.music')) return; if (want && !isOn()) start() }
    const next = () => {
      track = (track + 1) % order.length
      if (want) player.loadVideoById(order[track]); else player.cueVideoById(order[track])
    }
    window.onYouTubeIframeAPIReady = () => {
      player = new window.YT.Player('yt-player', {
        videoId: order[0], width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { ready = true; if (want) start() },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) next()
            const on = e.data === window.YT.PlayerState.PLAYING
            if (on) failed.clear()
            setPlaying(on || e.data === window.YT.PlayerState.BUFFERING)
            if (on) GEST.forEach(t => removeEventListener(t, gesture, true))
            if (on && !introShown.current) { introShown.current = true; setIntro(true); setTimeout(() => setIntro(false), 6000) }
          },
          onError: () => {
            failed.add(track)
            if (failed.size >= order.length) { dead = true; setBroken(true); setPlaying(false) } else next()
          },
        },
      })
    }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.body.appendChild(s)
    }
    GEST.forEach(t => addEventListener(t, gesture, true))
    toggle.current = () => {
      if (dead) return
      setIntro(false)
      if (isOn()) { player.pauseVideo(); want = false; store.set('off') }
      else { want = true; store.set(null); start() }
    }
    skip.current = () => {
      if (dead || !ready) return
      want = true; store.set(null)
      player.unMute(); player.setVolume(45); next()
    }
    return () => GEST.forEach(t => removeEventListener(t, gesture, true))
  }, [])

  if (!MUSIC_IDS.length) return null
  return (
    <>
      {MUSIC_IDS.length > 1 && !broken && (
        <button className="music music--skip" onClick={() => skip.current()} aria-label="Skip to next song" title="Next song">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 2l8 6-8 6zM11 2h3v12h-3z" fill="currentColor" /></svg>
        </button>
      )}
      {intro && playing && <p className="music-hint" role="status">♪ Music on · tap here to pause</p>}
      <button className={`music${playing ? ' is-on' : ''}${intro && playing ? ' is-intro' : ''}`} onClick={() => toggle.current()} aria-pressed={playing}
        aria-label={broken ? 'Music unavailable' : playing ? 'Pause background music' : 'Play background music'} title={broken ? 'Music unavailable' : playing ? 'Pause music' : 'Play music'}>
        {playing
          ? <span className="music__eq" aria-hidden="true"><i /><i /><i /><i /></span>
          : <span className={`music__idle${broken ? ' is-still' : ''}`} aria-hidden="true"><b>🎧</b><b>♪</b></span>}
      </button>
      <div className="yt-hidden" aria-hidden="true"><div id="yt-player" /></div>
    </>
  )
}
