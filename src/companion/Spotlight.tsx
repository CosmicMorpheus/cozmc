import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Room } from './room'
import { DEFAULT_LOOK, type Form } from './look'
import { load, mood, settle, stageOf, type Need } from './care'
import { CH, CW } from './scene'

const NEEDS: [Need, string][] = [['food', 'Food'], ['fun', 'Fun'], ['energy', 'Energy']]

/* Home's Cozmling band: yours, live in its room, or an invitation to adopt one. */
export function Spotlight() {
  const { activeAddress } = useWallet()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 20_000); return () => clearInterval(t) }, [])
  const saved = activeAddress ? load(activeAddress) : null
  const pet = saved && settle(saved)
  const [form, setForm] = useState<Form>('girl')
  const live = useRef({ pet, form })
  live.current = { pet, form }
  const canvas = useRef<HTMLCanvasElement>(null)

  // no Cozmling yet: the two starter aliens take turns in the Star Loft
  useEffect(() => { if (pet) return; const t = setInterval(() => setForm(f => (f === 'boy' ? 'girl' : 'boy')), 6000); return () => clearInterval(t) }, [!!pet])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const room = new Room(canvas.current!)
    let raf = 0
    const loop = () => {
      const { pet: p, form: f } = live.current
      if (p) { const m = mood(p); room.draw({ home: p.home, look: p.look, stage: stageOf(p), asleep: !!p.asleep, low: m.mood === 'low', need: m.need, crack: 0 }) }
      else room.draw({ home: 'loft', look: DEFAULT_LOOK[f], stage: 'cadet', asleep: false, low: false, need: null, crack: 0 })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <section className="spot" aria-labelledby="spot-h">
      <a className="spot__screen" href="#/cozmling" aria-label={pet ? `Visit ${pet.name}` : 'Meet the Cozmlings'}>
        <canvas ref={canvas} width={CW} height={CH} />
      </a>
      <div className="spot__copy">
        <p className="kicker"><span className="dot" /> {pet ? 'Your Cozmling' : 'New on COZMC'}</p>
        <h2 id="spot-h" className="spot__title">{pet ? pet.name : 'Adopt a Cozmling'}</h2>
        {pet ? (
          <>
            <p>{mood(pet).line}</p>
            {pet.hatched && (
              <dl className="spot__needs">
                {NEEDS.map(([k, label]) => (
                  <div key={k} className={`spot__need spot__need--${k}`}><dt>{label}</dt><dd><i style={{ width: `${Math.round(pet[k])}%` }} /></dd></div>
                ))}
              </dl>
            )}
            <a className="btn btn--phos" href="#/cozmling">Visit {pet.name}</a>
          </>
        ) : (
          <>
            <p>A little alien that lives on the site. Feed it, play with it and put it to bed, and it grows from a Star Egg into a Guardian. It’s free, and it’s saved to your wallet.</p>
            <a className="btn btn--phos" href="#/cozmling">Adopt one, free</a>
          </>
        )}
      </div>
    </section>
  )
}
