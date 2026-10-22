import { useEffect, useRef, useState } from 'react'
import { MUSIC_ID } from '../config'

/* Background music (looping YouTube track), kept from the original site.
   Browsers block sound until the visitor interacts, so playback is retried on
   each click/tap/keypress until it starts — unless the visitor turned it off. */
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function MusicButton() {
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const toggle = useRef<() => void>(() => {})

  useEffect(() => {
    if (!MUSIC_ID) return
    let player: any = null, ready = false, dead = false
    let want = (() => { try { return localStorage.getItem('cozmc-music') !== 'off' } catch { return true } })()
    const GEST = ['click', 'keydown', 'touchend']
    const isOn = () => ready && player.getPlayerState?.() === window.YT.PlayerState.PLAYING
    const start = () => { if (ready && !dead) { player.unMute(); player.setVolume(45); player.playVideo() } }
    const gesture = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('.music')) return; if (want && !isOn()) start() }
    window.onYouTubeIframeAPIReady = () => {
      player = new window.YT.Player('yt-player', {
        videoId: MUSIC_ID, width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: MUSIC_ID, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { ready = true; if (want) start() },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) { player.seekTo(0); player.playVideo() }
            const on = e.data === window.YT.PlayerState.PLAYING
            setPlaying(on || e.data === window.YT.PlayerState.BUFFERING)
            if (on) GEST.forEach(t => removeEventListener(t, gesture, true))
          },
          onError: () => { dead = true; setBroken(true); setPlaying(false) },
        },
      })
    }
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.body.appendChild(s)
    }
    GEST.forEach(t => addEventListener(t, gesture, true))
    toggle.current = () => {
      if (dead) return
      if (isOn()) { player.pauseVideo(); want = false; try { localStorage.setItem('cozmc-music', 'off') } catch { /* ignore */ } }
      else { want = true; try { localStorage.removeItem('cozmc-music') } catch { /* ignore */ } start() }
    }
    return () => GEST.forEach(t => removeEventListener(t, gesture, true))
  }, [])

  if (!MUSIC_ID) return null
  return (
    <>
      <button className={`music${playing ? ' is-on' : ''}`} onClick={() => toggle.current()} aria-pressed={playing}
        aria-label={broken ? 'Music unavailable' : playing ? 'Pause background music' : 'Play background music'} title={broken ? 'Music unavailable' : 'Music'}>
        <span className="music__eq" aria-hidden="true"><i /><i /><i /><i /></span>
      </button>
      <div className="yt-hidden" aria-hidden="true"><div id="yt-player" /></div>
    </>
  )
}
