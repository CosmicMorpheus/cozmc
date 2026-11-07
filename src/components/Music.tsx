import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { MUSIC_IDS } from '../config'

/* Background music, in a little piece of arcade hardware: the COZMC mini-player.
   The YouTube tracks play in a fresh random order every visit, looping.
   It starts as soon as the site opens wherever the browser allows sound; most browsers
   and phones block sound until the visitor first interacts, so it's retried on the first
   click/tap/keypress anywhere. Pausing lasts for this visit; the next visit plays again.
   When it starts, the play button flashes with a "tap here to pause" label so it's easy to find.
   A track that won't play is skipped. The screen shows the current track's title. */
const shuffled = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] } return o }
const KEY = 'cozmc-music'
const store = { get: () => { try { return sessionStorage.getItem(KEY) } catch { return null } }, set: (v: string | null) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY) } catch { /* private mode */ } } }
const pad = (n: number) => String(n).padStart(2, '0')
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function MusicButton() {
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)       // has it played at all this visit (so "paused" means paused)
  const [broken, setBroken] = useState(false)
  const [intro, setIntro] = useState(false)          // the "music on · tap to pause" flash, once per visit
  const [title, setTitle] = useState('')
  const [pos, setPos] = useState(0)                  // which track of the shuffled order
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
    const gesture = (e: Event) => { if ((e.target as HTMLElement)?.closest?.('.mp')) return; if (want && !isOn()) start() }
    const readTitle = () => { const t = player?.getVideoData?.()?.title; if (typeof t === 'string' && t.trim()) setTitle(t.trim()) }
    const next = () => {
      track = (track + 1) % order.length
      setPos(track); setTitle('')
      if (want) player.loadVideoById(order[track]); else player.cueVideoById(order[track])
    }
    window.onYouTubeIframeAPIReady = () => {
      player = new window.YT.Player('yt-player', {
        videoId: order[0], width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { ready = true; readTitle(); if (want) start() },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) { next(); return }
            readTitle()
            const on = e.data === window.YT.PlayerState.PLAYING
            if (on) { failed.clear(); setStarted(true) }
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

  // a title too long for the little screen scrolls back and forth (still with reduced motion: then it's cut with "…")
  const box = useRef<HTMLSpanElement>(null), text = useRef<HTMLSpanElement>(null)
  const [run, setRun] = useState(0)
  const shown = broken ? 'Music unavailable' : title || (playing ? 'Tuning in…' : started ? 'Paused' : 'Press play')
  useLayoutEffect(() => {
    const measure = () => setRun(Math.max(0, Math.ceil((text.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0))))
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [shown])

  if (!MUSIC_IDS.length) return null
  const status = broken ? 'No signal' : playing ? 'Now playing' : started ? 'Paused' : 'COZMC radio'
  return (
    <>
      <div className={`mp${playing ? ' is-on' : ''}${broken ? ' is-broken' : ''}${intro && playing ? ' is-intro' : ''}`} role="region" aria-label="Music player">
        <span className="mp__grille" aria-hidden="true" />
        <span className="mp__screen">
          <span className="mp__status" aria-hidden="true">
            <span className="mp__eq"><i /><i /><i /><i /></span>
            <span className="mp__state">{status.includes(' ') ? <><span className="mp__w1">{status.split(' ')[0]} </span>{status.split(' ').slice(1).join(' ')}</> : status}</span>
            <span className="mp__no">{pad(pos + 1)}/{pad(MUSIC_IDS.length)}</span>
          </span>
          <span className="mp__title" ref={box} title={shown}>
            <span className={run > 0 ? 'is-long' : ''} ref={text} style={{ ['--run' as string]: `${run}px`, ['--t' as string]: `${Math.max(6, run / 18 + 3)}s` } as CSSProperties}>{shown}</span>
          </span>
        </span>
        <button className="mp__btn mp__play" onClick={() => toggle.current()} aria-pressed={playing} disabled={broken}
          aria-label={broken ? 'Music unavailable' : playing ? 'Pause background music' : 'Play background music'} title={broken ? 'Music unavailable' : playing ? 'Pause music' : 'Play music'}>
          {playing
            ? <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 2h4v12H3zM9 2h4v12H9z" fill="currentColor" /></svg>
            : <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor" /></svg>}
        </button>
        {MUSIC_IDS.length > 1 && !broken && (
          <button className="mp__btn mp__skip" onClick={() => skip.current()} aria-label="Skip to next song" title="Next song">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 2l8 6-8 6zM11 2h3v12h-3z" fill="currentColor" /></svg>
          </button>
        )}
      </div>
      {intro && playing && <p className="music-hint" role="status">♪ Music on · tap here to pause</p>}
      <div className="yt-hidden" aria-hidden="true"><div id="yt-player" /></div>
    </>
  )
}
