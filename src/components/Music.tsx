import { useEffect, useRef, useState } from 'react'
import { MUSIC_IDS } from '../config'

/* Background music (YouTube tracks played in order, looping back to the first),
   kept from the original site. Browsers block sound until the visitor interacts,
   so playback is retried on each click/tap/keypress until it starts — unless the
   visitor turned it off. A track that won't play is skipped. */
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function MusicButton() {
  const [playing, setPlaying] = useState(false)
  const [broken, setBroken] = useState(false)
  const toggle = useRef<() => void>(() => {})
  const skip = useRef<() => void>(() => {})

  useEffect(() => {
    if (!MUSIC_IDS.length) return
    let player: any = null, ready = false, dead = false, track = 0
    const failed = new Set<number>()
    let want = (() => { try { return localStorage.getItem('cozmc-music') !== 'off' } catch { return true } })()
    const GEST = ['click', 'keydown', 'touchend']
    const isOn = () => ready && player.getPlayerState?.() === window.YT.PlayerState.PLAYING
    const start = () => { if (ready && !dead) { player.unMute(); player.setVolume(45); player.playVideo() } }
    const gesture = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('.music')) return; if (want && !isOn()) start() }
    const next = () => {
      track = (track + 1) % MUSIC_IDS.length
      if (want) player.loadVideoById(MUSIC_IDS[track]); else player.cueVideoById(MUSIC_IDS[track])
    }
    window.onYouTubeIframeAPIReady = () => {
      player = new window.YT.Player('yt-player', {
        videoId: MUSIC_IDS[0], width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { ready = true; if (want) start() },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) next()
            const on = e.data === window.YT.PlayerState.PLAYING
            if (on) failed.clear()
            setPlaying(on || e.data === window.YT.PlayerState.BUFFERING)
            if (on) GEST.forEach(t => removeEventListener(t, gesture, true))
          },
          onError: () => {
            failed.add(track)
            if (failed.size >= MUSIC_IDS.length) { dead = true; setBroken(true); setPlaying(false) } else next()
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
      if (isOn()) { player.pauseVideo(); want = false; try { localStorage.setItem('cozmc-music', 'off') } catch { /* ignore */ } }
      else { want = true; try { localStorage.removeItem('cozmc-music') } catch { /* ignore */ } start() }
    }
    skip.current = () => {
      if (dead || !ready) return
      want = true; try { localStorage.removeItem('cozmc-music') } catch { /* ignore */ }
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
      <button className={`music${playing ? ' is-on' : ''}`} onClick={() => toggle.current()} aria-pressed={playing}
        aria-label={broken ? 'Music unavailable' : playing ? 'Pause background music' : 'Play background music'} title={broken ? 'Music unavailable' : 'Music'}>
        {playing
          ? <span className="music__eq" aria-hidden="true"><i /><i /><i /><i /></span>
          : <span className={`music__idle${broken ? ' is-still' : ''}`} aria-hidden="true"><b>🎧</b><b>♪</b></span>}
      </button>
      <div className="yt-hidden" aria-hidden="true"><div id="yt-player" /></div>
    </>
  )
}
