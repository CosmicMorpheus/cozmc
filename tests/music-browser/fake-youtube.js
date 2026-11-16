// A stand-in for the YouTube IFrame API, for tests/music.browser.mjs. It keeps YouTube's player states, a
// playback clock that only runs while playing, and a browser autoplay policy set by window.__ytMode:
//   'allowed'  sound may start on its own        'blocked' nothing plays without a click or key press
//   'muted'    only silent autoplay is allowed    'late'    like allowed, but a Pause during loading doesn't
//                                                           stop the pending start (YouTube can race like that)
// window.__ytBufferMs sets how long loading takes (default 700 ms); window.__ytReadyMs how long the player
// takes to be ready (default 200 ms).
(() => {
  const S = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
  const log = window.__ytLog = []
  class Player {
    constructor(el, opts) {
      this.o = opts; this.state = S.UNSTARTED; this.pos = 0; this.since = 0; this.muted = false; this.timers = []
      window.__yt = this
      setTimeout(() => opts.events.onReady?.({ target: this }), window.__ytReadyMs ?? 200)
    }
    emit(state) { this.state = state; log.push({ t: performance.now(), state, pos: this.getCurrentTime() }); this.o.events.onStateChange?.({ data: state, target: this }) }
    getCurrentTime() { return this.state === S.PLAYING ? this.pos + (performance.now() - this.since) / 1000 : this.pos }
    getPlayerState() { return this.state }
    getVideoData() { return { title: 'Test track ' + (this.vid ?? 1) } }
    isMuted() { return this.muted }
    mute() { this.muted = true }
    unMute() { this.muted = false }
    setVolume() {}
    playVideo() {
      const mode = window.__ytMode, gesture = navigator.userActivation?.isActive
      if (this.state === S.PLAYING || this.state === S.BUFFERING) return
      if (mode === 'blocked' && !gesture) return
      if (mode === 'muted' && !gesture) this.muted = true
      this.emit(S.BUFFERING)
      this.timers.push(setTimeout(() => { this.since = performance.now(); this.emit(S.PLAYING) }, window.__ytBufferMs ?? 700))
    }
    pauseVideo() {
      const racing = window.__ytMode === 'late' && this.state === S.BUFFERING
      if (!racing) { this.timers.forEach(clearTimeout); this.timers = [] }
      if (this.state === S.PLAYING) this.pos = this.getCurrentTime()
      this.emit(S.PAUSED)
    }
    loadVideoById(v) { this.vid = v; this.pos = 0; this.state = S.UNSTARTED; this.playVideo() }
    cueVideoById(v) { this.vid = v; this.pos = 0; this.emit(S.CUED) }
    destroy() { this.timers.forEach(clearTimeout) }
  }
  window.YT = { Player, PlayerState: S }
  setTimeout(() => window.onYouTubeIframeAPIReady?.(), 30)
})()
