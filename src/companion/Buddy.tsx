import { useEffect, useRef, useState } from 'react'
import { Room } from './room'
import { STAGE_NAME } from './look'
import { growth, load, mood, settle, stageOf, type Need, type RunOutcome } from './care'
import { CH, CW } from './scene'

const NEEDS: [Need, string][] = [['food', 'Food'], ['fun', 'Fun'], ['energy', 'Energy']]
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)

/* The arcade's Cozmling panel: your Cozmling watches you play, and each run
   shows what it did for its needs and its growth. */
export function Buddy({ owner, last, onConnect }: { owner: string | null; last: RunOutcome | null; onConnect: () => void }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 20_000); return () => clearInterval(t) }, [])
  const saved = owner ? load(owner) : null
  const pet = saved && settle(saved)
  const live = useRef(pet)
  live.current = pet
  const canvas = useRef<HTMLCanvasElement>(null)
  const room = useRef<Room | null>(null)

  useEffect(() => {
    if (!pet) return
    const r = new Room(canvas.current!)
    room.current = r
    let raf = 0
    const loop = () => {
      const p = live.current
      if (p) { const m = mood(p); r.draw({ home: p.home, look: p.look, stage: stageOf(p), asleep: !!p.asleep, low: m.mood === 'low', need: m.need, crack: 0 }) }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(raf); room.current = null }
  }, [!!pet])   // eslint-disable-line react-hooks/exhaustive-deps
  // it reacts to each run
  useEffect(() => { if (last) { if (last.fun > 0) room.current?.play(); else room.current?.refuse() } }, [last])

  if (!owner) return (
    <aside className="panel buddy">
      <header className="panel__head"><h2>Your Cozmling</h2></header>
      <p className="muted small">Connect a wallet and every game you play cheers your Cozmling up and helps it grow.</p>
      <button className="btn btn--ghost btn--sm" onClick={onConnect}>Connect a wallet</button>
    </aside>
  )
  if (!pet) return (
    <aside className="panel buddy">
      <header className="panel__head"><h2>Your Cozmling</h2></header>
      <p className="muted small">Adopt a Cozmling and it will watch you play. Every game cheers it up and helps it grow.</p>
      <a className="btn btn--ghost btn--sm" href="#/cozmling">Adopt one, free</a>
    </aside>
  )

  const g = growth(pet)
  const pct = g.next ? Math.round(((g.points - g.from) / (g.next.at - g.from)) * 100) : 100
  return (
    <aside className="panel buddy">
      <header className="panel__head"><h2>{pet.name}</h2><a className="link" href="#/cozmling">Visit</a></header>
      <a className="buddy__screen" href="#/cozmling" aria-label={`Visit ${pet.name}`}><canvas ref={canvas} width={CW} height={CH} /></a>
      <p className="buddy__line" aria-live="polite">{last ? last.say : mood(pet).line}</p>
      {last && (last.fun || last.energy || last.food) ? (
        <p className="buddy__delta">
          {last.fun ? <span className="is-fun">{signed(last.fun)} Fun</span> : null}
          {last.energy ? <span>{signed(last.energy)} Energy</span> : null}
          {last.food ? <span>{signed(last.food)} Food</span> : null}
        </p>
      ) : null}
      {pet.hatched && (
        <dl className="spot__needs buddy__needs">
          {NEEDS.map(([k, label]) => (
            <div key={k} className={`spot__need spot__need--${k}`}><dt>{label}</dt><dd><i style={{ width: `${Math.round(pet[k])}%` }} /></dd></div>
          ))}
        </dl>
      )}
      {pet.hatched && (
        <div className="buddy__grow">
          <p><span>{STAGE_NAME[g.stage]}</span><span>{g.next ? <>{STAGE_NAME[g.next.stage]} at {g.next.at}</> : 'Fully grown'}</span></p>
          <div className="buddy__bar" role="progressbar" aria-label="Growth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></div>
        </div>
      )}
    </aside>
  )
}
