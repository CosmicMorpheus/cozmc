import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { MUSIC_IDS } from '../config'
import { createPreview, type Preview } from '../lib/musicPreview'

/* Background music, in a little piece of arcade hardware: the COZMC mini-player.
   The YouTube tracks play in a fresh random order every visit, looping.
   When the site opens and the browser allows sound, the music plays for two seconds (measured from when
   it actually starts playing) and pauses itself, with a note beside the player: "Music paused. Press Play
   to continue." Where the browser blocks autoplay nothing plays and no note shows; Play is there as always.
   After that the visitor is in charge: their play or pause lasts for this visit (a reload follows it).
   A track that won't play is skipped. The screen shows the current track's title.
   Pause stops the music whether it's playing or still loading. If YouTube can't be reached (blocked,
   offline, or too slow to answer), the player says the music is unavailable and Play becomes Retry. */
const API = 'https://www.youtube.com/iframe_api'
const LOAD_TIMEOUT = 15_000
const shuffled = <T,>(a: T[]) => { const o = [...a]; for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]] } return o }
const KEY = 'cozmc-music'
const store = { get: () => { try { return sessionStorage.getItem(KEY) } catch { return null } }, set: (v: string | null) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY) } catch { /* private mode */ } } }
const pad = (n: number) => String(n).padStart(2, '0')
declare global { interface Window { YT: any; onYouTubeIframeAPIReady?: () => void } }

export function MusicButton() {
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)       // has it played at all this visit (so "paused" means paused)
  const [broken, setBroken] = useState(false)
  const [offline, setOffline] = useState(false)       // YouTube didn't load: Play offers a retry
  const [waiting, setWaiting] = useState(false)       // the visitor pressed Play before the player was ready
  const [note, setNote] = useState(false)            // "Music paused. Press Play to continue." after the opening preview
  const [title, setTitle] = useState('')
  const [pos, setPos] = useState(0)                  // which track of the shuffled order
  const toggle = useRef<() => void>(() => {})
  const skip = useRef<() => void>(() => {})
  const retry = useRef<() => void>(() => {})
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!MUSIC_IDS.length) return
    let player: any = null, ready = false, dead = false, track = 0, timer = 0
    let queued = false                      // the visitor pressed Play before the player was ready
    const order = shuffled(MUSIC_IDS)
    const failed = new Set<number>()
    const choice = store.get()            // 'off' or 'on' once the visitor (or the preview) has decided this visit
    let want = choice !== 'off'
    // a first opening this visit plays the two-second preview; a visitor who chose music keeps it
    const preview: Preview | null = choice === null
      ? createPreview({ position: () => player?.getCurrentTime?.() ?? 0, pause: () => player.pauseVideo() }, () => {
        want = false; store.set('off'); setNote(true)
      })
      : null
    // playing, or loading/buffering on its way to playing: either way Pause should stop it
    const isOn = () => ready && [window.YT.PlayerState.PLAYING, window.YT.PlayerState.BUFFERING].includes(player.getPlayerState?.())
    const start = () => { if (ready && !dead) { player.unMute(); player.setVolume(45); player.playVideo() } }
    const readTitle = () => { const t = player?.getVideoData?.()?.title; if (typeof t === 'string' && t.trim()) setTitle(t.trim()) }
    const next = () => {
      track = (track + 1) % order.length
      setPos(track); setTitle('')
      if (want) player.loadVideoById(order[track]); else player.cueVideoById(order[track])
    }
    const fail = () => { if (!ready) { setOffline(true); setWaiting(false) } }
    window.onYouTubeIframeAPIReady = () => {
      // a fresh element each time, so a retry can rebuild the player from scratch
      const el = document.createElement('div')
      host.current?.replaceChildren(el)
      player = new window.YT.Player(el, {
        videoId: order[0], width: 200, height: 200,
        playerVars: { autoplay: 0, controls: 0, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => { ready = true; queued = false; clearTimeout(timer); setOffline(false); setWaiting(false); readTitle(); if (want) start() },
          onStateChange: (e: any) => {
            if (e.data === window.YT.PlayerState.ENDED) { next(); return }
            readTitle()
            const on = e.data === window.YT.PlayerState.PLAYING
            // playing without sound isn't the music starting: the browser only allowed silent autoplay
            if (on && preview?.state === 'waiting' && player.isMuted?.()) { preview.takeOver(); want = false; player.pauseVideo(); return }
            // a play request that finishes loading after the visitor pressed Pause stays paused
            if (on && !want) { player.pauseVideo(); return }
            if (on) { failed.clear(); setStarted(true); preview?.playing() } else preview?.stalled()
            setPlaying(on || e.data === window.YT.PlayerState.BUFFERING)
          },
          onError: () => {
            failed.add(track)
            if (failed.size >= order.length) { dead = true; setBroken(true); setPlaying(false) } else next()
          },
        },
      })
    }
    const load = () => {
      setOffline(false)
      clearTimeout(timer)
      timer = window.setTimeout(fail, LOAD_TIMEOUT)
      if (window.YT?.Player) { window.onYouTubeIframeAPIReady?.(); return }   // the API is here, only the player failed
      document.querySelectorAll(`script[src="${API}"]`).forEach(old => old.remove())
      const s = document.createElement('script'); s.src = API; s.async = true; s.onerror = fail
      document.body.appendChild(s)
    }
    load()
    toggle.current = () => {
      if (dead) return
      preview?.takeOver(); setNote(false)
      // what the button shows decides: Pause while playing, loading or queued; otherwise Play
      if (isOn() || queued) { if (ready) player.pauseVideo(); want = false; queued = false; setWaiting(false); store.set('off') }
      else { want = true; store.set('on'); if (ready) start(); else { queued = true; setWaiting(true) } }
    }
    retry.current = () => {
      try { player?.destroy?.() } catch { /* a half-made player */ }
      player = null; ready = false
      want = true; queued = true; store.set('on'); preview?.takeOver(); setNote(false); setWaiting(true)
      load()
    }
    skip.current = () => {
      if (dead || !ready) return
      preview?.takeOver(); setNote(false)
      want = true; store.set('on')
      player.unMute(); player.setVolume(45); next()
    }
    return () => { preview?.takeOver(); clearTimeout(timer) }
  }, [])

  // a title too long for the little screen scrolls back and forth (still with reduced motion: then it's cut with "…")
  const box = useRef<HTMLSpanElement>(null), text = useRef<HTMLSpanElement>(null)
  const [run, setRun] = useState(0)
  const shown = broken || offline ? 'Music unavailable' : title || (playing || waiting ? 'Tuning in…' : started ? 'Paused' : 'Press play')
  useLayoutEffect(() => {
    const measure = () => setRun(Math.max(0, Math.ceil((text.current?.scrollWidth ?? 0) - (box.current?.clientWidth ?? 0))))
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [shown])

  if (!MUSIC_IDS.length) return null
  const status = broken || offline ? 'No signal' : playing ? 'Now playing' : waiting ? 'Tuning in' : started ? 'Paused' : 'COZMC radio'
  const on = playing || waiting
  return (
    <>
      <div className={`mp${playing ? ' is-on' : ''}${broken || offline ? ' is-broken' : ''}`} role="region" aria-label="Music player">
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
        {offline ? (
          <button className="mp__btn mp__play" onClick={() => retry.current()} aria-label="Music unavailable: retry loading it" title="Retry music">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 2a6 6 0 1 0 6 6h-2a4 4 0 1 1-4-4v2l3-3-3-3z" fill="currentColor" /></svg>
          </button>
        ) : (
          <button className="mp__btn mp__play" onClick={() => toggle.current()} aria-pressed={on} disabled={broken}
            aria-label={broken ? 'Music unavailable' : on ? 'Pause background music' : 'Play background music'} title={broken ? 'Music unavailable' : on ? 'Pause music' : 'Play music'}>
            {on
              ? <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3 2h4v12H3zM9 2h4v12H9z" fill="currentColor" /></svg>
              : <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor" /></svg>}
          </button>
        )}
        {MUSIC_IDS.length > 1 && !broken && !offline && (
          <button className="mp__btn mp__skip" onClick={() => skip.current()} aria-label="Skip to next song" title="Next song">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2 2l8 6-8 6zM11 2h3v12h-3z" fill="currentColor" /></svg>
          </button>
        )}
      </div>
      <p className="music-hint" role="status">{note ? 'Music paused. Press Play to continue.' : ''}</p>
      <div className="yt-hidden" aria-hidden="true" ref={host} />
    </>
  )
}
