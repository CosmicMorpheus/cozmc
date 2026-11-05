import { useCallback, useEffect, useRef, useState } from 'react'
import { advance, CONFIG, createSession, DAY, dayAt, durationText, missesOf, tookText, wordFor, type Session } from '../adrift/engine'
import { ADRIFT_KEY, readSaved } from '../adrift/storage'
import { RescueScene, type SceneStatus } from '../adrift/scene'
import { RescueArt } from '../adrift/RescueArt'
import { onPreviewSite } from '../lib/previewDate'
import { Icon } from '../components/Pixel'

/* ============================================================
   ADRIFT: the daily word rescue, in the COZMC arcade.
   Ported from the standalone trial with its rules intact. It's just for fun:
   no wallet, rewards, leaderboard or on-chain posting. Progress lives in this
   browser (see src/adrift/engine.ts for what that does and doesn't protect).
   ============================================================ */
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const mmss = (ms: number) => { const sec = Math.max(0, Math.ceil(ms / 1000)); return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` }
const isoDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10)

export function Adrift() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [shareMsg, setShareMsg] = useState('')
  const [, tick] = useState(0)
  const sceneRoot = useRef<HTMLDivElement>(null)
  const scene = useRef<RescueScene | null>(null)
  const current = useRef<Session | null>(null)
  const blocked = !!error

  // the one place a mission changes: under a browser lock, from what's saved, so two tabs can't double-play
  const transact = useCallback(async (action?: 'start' | string) => {
    if (!navigator.locks) { setError('This browser can’t safely keep track of your daily attempt. Please use a current Chrome, Edge, Firefox or Safari.'); return }
    try {
      await navigator.locks.request(ADRIFT_KEY, async () => {
        const now = Date.now()
        let s = readSaved()
        const save = (n: Session) => { localStorage.setItem(ADRIFT_KEY, JSON.stringify(n)); s = n }
        if (s?.status === 'playing') { const u = advance(s, now); if (JSON.stringify(u) !== JSON.stringify(s)) save(u) }
        if (action === 'start') {
          if (!(s?.status === 'playing' || (s && s.day >= dayAt(now)))) { save(createSession(now)); setMessage(`Rescue started. ${durationText()} on the clock.`) }
        } else if (action && s?.status === 'playing') {
          const before = s, next = advance(s, now, action), word = wordFor(next.day)
          save(next)
          if (next.guesses.length > before.guesses.length) {
            const hit = word.includes(action)
            setMessage(hit ? `${action} is in the word.` : `${action} missed the signal.`)
            if (hit && next.status === 'playing') scene.current?.ping()
          }
        }
        setSession(s)
      })
    } catch { setError('We can’t safely save your mission. Turn on browser storage and reload before starting.') }
  }, [])

  // storage must work before a mission can start
  useEffect(() => {
    try { const probe = ADRIFT_KEY + ':check'; localStorage.setItem(probe, '1'); localStorage.removeItem(probe); setSession(readSaved()) }
    catch { setError('Browser storage is unavailable, or the saved mission is damaged. Today’s rescue can’t start safely.') }
    transact()
  }, [transact])

  // the scene: mounted once, idle drift while the page is open
  useEffect(() => {
    const s = new RescueScene(sceneRoot.current!)
    scene.current = s; s.start()
    return () => { s.stop(); scene.current = null }
  }, [])

  // the clock: end a mission at its deadline, roll over at midnight, keep the timer ticking
  useEffect(() => {
    const t = setInterval(() => {
      const s = current.current
      if (s?.status === 'playing' && Date.now() >= s.deadline) transact()
      else if (s && s.status !== 'playing' && s.day < dayAt()) transact()
      else tick(n => n + 1)
    }, 250)
    const onKey = (e: KeyboardEvent) => {
      const s = current.current
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || (e.target as HTMLElement)?.matches?.('input, textarea') || s?.status !== 'playing') return
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); transact(e.key.toUpperCase()) }
    }
    const onStorage = (e: StorageEvent) => { if (e.key === ADRIFT_KEY) transact() }
    const onVis = () => { if (!document.hidden) transact() }
    addEventListener('keydown', onKey); addEventListener('storage', onStorage); document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); removeEventListener('keydown', onKey); removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', onVis) }
  }, [transact])

  const now = Date.now(), today = dayAt(now)
  const s = session && !(session.status !== 'playing' && session.day < today) ? session : null    // yesterday's finished mission makes way for today's
  current.current = s
  const day = s ? s.day : today, word = wordFor(day)
  const playing = s?.status === 'playing', done = !!s && !playing
  const guesses = s?.guesses ?? [], wrong = missesOf(s, word)
  const status: SceneStatus = s?.status ?? 'ready'
  useEffect(() => { scene.current?.update(wrong, status, s ? String(s.started) : 'ready') }, [wrong, status, s?.started])   // eslint-disable-line react-hooks/exhaustive-deps

  const left = playing ? s!.deadline - now : done ? s!.deadline - s!.ended! : CONFIG.seconds * 1000
  const urgent = playing && left <= 30_000
  const toNext = (today + 1) * DAY - now
  const heading = !s ? 'Bring them home.' : playing ? 'Find the rescue word.' : s.status === 'won' ? 'Safely back on board.' : 'Signal lost. Mission over.'
  const desc = !s ? 'Find the missing word to lock onto our astronaut’s signal.' : playing ? 'Solve the word to winch our astronaut back. Every miss pushes them farther away.' : s.status === 'won' ? 'One small word. One very happy astronaut.' : 'Our astronaut is out of reach this time. A new rescue is waiting tomorrow.'
  const announce = done ? (s!.status === 'won' ? `Astronaut rescued! The word was ${word}. Today’s attempt is complete.` : `Mission over. The word was ${word}. Today’s attempt is complete.`) : message
  const shareText = done ? `COZMC · ADRIFT\n${isoDay(s!.day)}\n${s!.status === 'won' ? '🟩 Astronaut rescued' : '⬛ Signal lost'}\n${'🟧'.repeat(wrong)}${'🟩'.repeat(CONFIG.misses - wrong)}\n${s!.status === 'won' ? `${tookText(s!.ended! - s!.started)} · ` : ''}One word. One shot. #COZMC\ncozmc.us/#/arcade/adrift` : ''

  async function copyResult() {
    try { await navigator.clipboard.writeText(shareText); setShareMsg('Result copied. The word stays secret.') }
    catch { setShareMsg('Copying didn’t work here. Select the text below and copy it.') }
  }

  return (
    <>
      <header className="page-head ad-head">
        <p className="kicker"><span className="dot" /> Daily word rescue · free to play</p>
        <h1>Adrift<span className="ad-head__dot">.</span></h1>
        <p>One word. One astronaut. One shot. Find today’s rescue word before the tether runs out.</p>
      </header>

      <section className={`ad${s ? ` is-${s.status}` : ''}`} aria-label="Daily rescue game">
        <div className="ad-scene crt" ref={sceneRoot}>
          <div className="ad-planet" aria-hidden="true" />
          <div className="ad-orbit" aria-hidden="true" /><div className="ad-orbit ad-orbit--2" aria-hidden="true" />
          <div className="ad-scene__top"><span>Deep space · sector 07</span><span className="ad-live"><i /> <span data-part="beacon">Signal found</span></span></div>
          <RescueArt />
        </div>

        <div className="panel ad-console">
          <div className="ad-console__head"><span>Daily rescue · {isoDay(day)}</span><span className="ad-tag">Word mission</span></div>
          <div className="ad-status">
            <h2>{heading}</h2>
            <div className={`ad-timer${urgent ? ' is-urgent' : ''}`} role="timer" aria-label={playing ? `${Math.ceil(left / 1000)} seconds remaining` : 'Mission timer'}>{mmss(left)}</div>
          </div>
          <p className="ad-desc">{desc}</p>

          <div className="ad-word" aria-label={`${word.length} letters: ${[...word].map(c => (done || guesses.includes(c) ? c : 'blank')).join(', ')}`}>
            {[...word].map((c, i) => {
              const shown = done || guesses.includes(c)
              return <span key={`${i}${shown}`} className={`ad-letter${shown ? ' is-on' : ''}${done && !guesses.includes(c) ? ' is-missed' : ''}`} aria-hidden="true">{shown ? c : ''}</span>
            })}
          </div>

          <div className="ad-tele">
            <span>Rescue signal</span>
            <div className="ad-lives" aria-label={`${CONFIG.misses - wrong} misses remaining`}>{Array.from({ length: CONFIG.misses }, (_, i) => <b key={i} className={i < wrong ? 'is-used' : ''} />)}</div>
            <span>{CONFIG.misses - wrong} {CONFIG.misses - wrong === 1 ? 'miss' : 'misses'} {s ? 'left' : 'allowed'}</span>
          </div>

          {!s && (
            <div className="ad-ready">
              <ol className="ad-rules">
                <li><b>01</b><span>Guess a familiar <strong>4 to 7 letter word</strong>.</span></li>
                <li><b>02</b><span>You have <strong>{durationText()}</strong> and <strong>{CONFIG.misses} missed letters</strong>.</span></li>
                <li><b>03</b><span><strong>One mission per day</strong> (UTC). The clock keeps running if you leave.</span></li>
              </ol>
              <button className="btn btn--phos ad-start" disabled={blocked} onClick={() => transact('start').then(() => {
                // on a phone, bring the word and the letter keys into view
                if (matchMedia('(max-width: 860px)').matches) document.querySelector('.ad-console')?.scrollIntoView({ block: 'end', behavior: 'smooth' })
              })}><Icon name="play" size={11} /> Start today’s rescue</button>
              <p className="ad-fine">Your attempt only begins when you press start.</p>
            </div>
          )}

          {playing && (
            <div className="ad-play">
              <div className="ad-keys" aria-label="Letter keyboard">
                {ROWS.map(row => (
                  <div key={row} className="ad-keys__row">
                    {[...row].map(c => {
                      const used = guesses.includes(c), hit = used && word.includes(c)
                      return <button key={c} className={`ad-key${used ? (hit ? ' is-hit' : ' is-miss') : ''}`} disabled={used || blocked} onClick={() => transact(c)} aria-label={`${c}${used ? (hit ? ', correct' : ', missed') : ''}`}>{c}</button>
                    })}
                  </div>
                ))}
              </div>
              <p className="ad-fine">Tap a letter or use your keyboard. Repeated letters are free.</p>
            </div>
          )}

          {done && (
            <div className="ad-result">
              <div className="ad-result__card">
                <b>{s!.status === 'won' ? 'Rescue complete. Nice work.' : 'Today’s attempt is complete.'}</b>
                <p>The rescue word was <strong>{word}</strong>. {wrong} of {CONFIG.misses} missed letters used{s!.status === 'won' ? `, in ${tookText(s!.ended! - s!.started)}` : ''}.</p>
                <small>Next mission: {new Date((day + 1) * DAY).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })} your time (00:00 UTC)</small>
              </div>
              <div className="row">
                <button className="btn btn--phos" onClick={copyResult}>Copy spoiler-free result</button>
                <a className="btn btn--ghost" href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener">Post on X ↗</a>
              </div>
              {shareMsg && <p className="ad-fine" role="status">{shareMsg}</p>}
              {shareMsg.startsWith('Copying') && <textarea className="ad-share" readOnly value={shareText} onFocus={e => e.currentTarget.select()} aria-label="Your result to copy" />}
            </div>
          )}

          <p className="sr-only" aria-live="polite">{announce}</p>
          {error && <p className="state state--err" role="alert">{error}</p>}
        </div>
      </section>

      <div className="ad-strip"><span><i /> A new signal every day</span><span>Next rescue in {Math.floor(toNext / 3_600_000)}h {Math.floor((toNext % 3_600_000) / 60_000)}m · 00:00 UTC</span></div>
      <p className="ad-note">Just for the joy of the rescue: no tokens, prizes or wallet needed. Your daily attempt is saved in this browser.</p>
      <TestTools onReset={() => { setSession(null); setMessage(''); setShareMsg('') }} />
    </>
  )
}

/* Testing only: on the preview site with ?adrift-test in the address, a labelled control
   resets this browser's attempt. It never shows on cozmc.us. */
function TestTools({ onReset }: { onReset: () => void }) {
  const [note, setNote] = useState('')
  if (!onPreviewSite() || !new URLSearchParams(location.search).has('adrift-test')) return null
  return (
    <details className="ad-test">
      <summary>Preview testing</summary>
      <p>Reset only your saved Adrift attempt in this browser. This control only appears on the preview site.</p>
      <button className="btn btn--ghost btn--sm" onClick={async () => {
        try { await navigator.locks.request(ADRIFT_KEY, async () => { localStorage.removeItem(ADRIFT_KEY) }); onReset(); setNote('Reset. Press start whenever you’re ready.') }
        catch { setNote('Couldn’t reset. Reload and try again.') }
      }}>Reset my attempt</button>
      {note && <p role="status">{note}</p>}
    </details>
  )
}
