/* Tiny retro sound kit (WebAudio square/noise blips). */
let ctx: AudioContext | null = null
let muted = (() => { try { return localStorage.getItem('cozmc-sfx') === 'off' } catch { return false } })()

const ac = () => (ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)())

export const sfx = {
  get muted() { return muted },
  setMuted(m: boolean) { muted = m; try { localStorage.setItem('cozmc-sfx', m ? 'off' : 'on') } catch { /* private mode */ } },
  tone(freq: number, dur = 0.08, type: OscillatorType = 'square', vol = 0.06, slide = 0) {
    if (muted) return
    const a = ac(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime
    o.type = type; o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02)
  },
  noise(dur = 0.25, vol = 0.08) {
    if (muted) return
    const a = ac(), len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const s = a.createBufferSource(), g = a.createGain()
    s.buffer = buf; g.gain.value = vol; s.connect(g).connect(a.destination); s.start()
  },
  pickup() { this.tone(880, 0.06); setTimeout(() => this.tone(1320, 0.08), 55) },
  hit() { this.noise(0.3, 0.12); this.tone(160, 0.25, 'sawtooth', 0.07, -120) },
  start() { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.07), i * 70)) },
  over() { [523, 392, 330, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.08), i * 140)) },
  level() { this.tone(660, 0.08); setTimeout(() => this.tone(990, 0.12), 90) },
}
