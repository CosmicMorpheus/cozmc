/* The music's opening preview: when the site opens and the browser lets it play, the music plays for two
   seconds of actual playback, then pauses on its own. The clock is the player's own playback position, so
   loading and buffering don't count: the two seconds start when sound actually starts. If the visitor
   takes over first (play, pause, skip), the preview steps aside and never pauses for them. */

export const PREVIEW_SECONDS = 2

export type PreviewPlayer = {
  /** the playback position in seconds */
  position: () => number
  pause: () => void
}

export type Preview = {
  /** the player reports it is playing (with sound) */
  playing: () => void
  /** the player stopped advancing: buffering, paused or ended */
  stalled: () => void
  /** the visitor used the player's controls */
  takeOver: () => void
  readonly state: 'waiting' | 'running' | 'paused' | 'off'
}

type Timers = { set: (fn: () => void, ms: number) => unknown; clear: (id: unknown) => void }
const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>) }

export function createPreview(player: PreviewPlayer, onAutoPause: () => void, timers: Timers = realTimers, seconds = PREVIEW_SECONDS): Preview {
  let state: Preview['state'] = 'waiting'
  let startedAt = 0
  let timer: unknown = null
  const stop = () => { if (timer !== null) timers.clear(timer); timer = null }
  const check = () => {
    timer = null
    if (state !== 'running') return
    const heard = player.position() - startedAt
    if (heard >= seconds - 0.02) {
      state = 'paused'
      player.pause()
      onAutoPause()
    } else {
      timer = timers.set(check, Math.max(20, (seconds - heard) * 1000))
    }
  }
  return {
    get state() { return state },
    playing() {
      if (state === 'waiting') { state = 'running'; startedAt = player.position() }
      if (state !== 'running') return
      stop()
      timer = timers.set(check, Math.max(20, (seconds - (player.position() - startedAt)) * 1000))
    },
    stalled() { stop() },
    takeOver() { stop(); if (state === 'waiting' || state === 'running') state = 'off' },
  }
}
