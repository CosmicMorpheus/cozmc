import { useCallback, useEffect, useState } from 'react'
import { PRINCIPLES, WISDOM, byline, todayPos, wisdomAt } from '../data/quotes'
import { sawQuote } from '../lib/profile'
import { useToast } from '../components/ui'
import { ShareBtn } from '../components/Share'
import { quoteShare } from '../lib/sharePayloads'

const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const todayLabel = () => new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()

/* DAILY WISDOM — one line a day on a CRT, tap through for more. */
export function Philosophy() {
  const today = todayPos()
  const [pos, setPos] = useState(today)
  const [typed, setTyped] = useState(0)
  const toast = useToast()
  const w = wisdomAt(pos)
  const body = `“${w.t}”`
  const isToday = pos === today

  useEffect(() => {
    if (RM) { setTyped(body.length); return }
    setTyped(0)
    const id = setInterval(() => setTyped(n => { if (n >= body.length) { clearInterval(id); return n } return n + 2 }), 22)
    return () => clearInterval(id)
  }, [pos, body.length])

  const done = typed >= body.length
  useEffect(() => { if (done) sawQuote(((pos % WISDOM.length) + WISDOM.length) % WISDOM.length) }, [done, pos])
  const next = useCallback(() => setPos(p => p + 1), [])

  return (
    <>
      <header className="page-head">
        <h1>Daily wisdom</h1>
        <p>A cosmic perspective. A grounded way to live. A new line every day from philosophers, poets, and old proverbs. Tap through for more.</p>
      </header>

      <div className="oracle">
        <div className="oracle__screen crt" tabIndex={0} role="region" aria-live="polite" aria-label="Daily wisdom"
          onClick={() => (done ? next() : setTyped(body.length))}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); done ? next() : setTyped(body.length) } }}>
          <p className="oracle__sys"><span>{isToday ? 'TODAY’S WISDOM' : 'MORE WISDOM'}</span><span>{todayLabel()}</span></p>
          {w.ctx && <p className="oracle__ctx">&gt; {w.ctx}</p>}
          <p className="oracle__quote">{body.slice(0, typed)}<span className={`oracle__cursor${done ? ' blink' : ''}`}>█</span><span className="sr-only">{body}</span></p>
          <p className={`oracle__by${done ? ' on' : ''}`}>— {w.a.toUpperCase()}</p>
          {byline(w) && <p className={`oracle__src${done ? ' on' : ''}`}>{byline(w)}</p>}
        </div>
        <div className="oracle__controls">
          <button className="btn btn--phos" onClick={next}>Another one ▶</button>
          <button className="btn btn--ghost" onClick={async () => {
            try { await navigator.clipboard.writeText(`“${w.t}” — ${w.a}${w.src ? `, ${w.src}` : ''}`); toast('Quote copied') } catch { toast('Copy failed') }
          }}>Copy</button>
          <ShareBtn label="Share" className="btn btn--ghost" make={() => quoteShare(w)} />
          {!isToday && <button className="btn btn--ghost" onClick={() => setPos(today)}>Back to today</button>}
          <span className="oracle__tip hide-sm">Tap the screen for the next one</span>
        </div>
      </div>

      <section className="principles" aria-labelledby="principles-h">
        <h2 id="principles-h" className="sub-h">The COZMC way</h2>
        <ul>
          {PRINCIPLES.map(p => <li key={p.name}><b>{p.name}</b><span>{p.line}</span></li>)}
        </ul>
      </section>

      <section className="motto" aria-label="Motto">
        <p>Drip by drip, the bucket fills.</p>
        <p>Brick by brick, we build.</p>
        <span>Practice over perfection</span>
      </section>

      <p className="fineprint">Every line is checked against its source. Famous misattributions are left out on purpose.</p>
    </>
  )
}

/* Compact version for the Home tab. */
export function TodaysWisdom({ onMore }: { onMore: () => void }) {
  const w = wisdomAt(todayPos())
  return (
    <section className="today" aria-label="Today’s wisdom">
      <p className="today__lbl">Today’s wisdom</p>
      <blockquote className={`today__q${w.t.length > 130 ? ' today__q--long' : ''}`}>“{w.t}”</blockquote>
      <p className="today__by">— {w.a}{w.src && <span>, {w.src}</span>}</p>
      <div className="today__actions">
        <ShareBtn label="Share" className="link link--btn" make={() => quoteShare(w)} />
        <button className="link" onClick={onMore}>More wisdom ▶</button>
      </div>
    </section>
  )
}
