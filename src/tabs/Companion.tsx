import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Room, ART } from '../companion/room'
import { BODIES, DEFAULT_LOOK, drawBulbGlow, drawCozmling, EYES, GLOWS, STAGE_NAME, STAGES, type Form, type Look, type Stage } from '../companion/look'
import { drawHome, homeThumb, FLOOR_Y, H, W } from '../companion/scene'
import { adopt, ageText, clamp, cleanName, clearUnclaimed, FOODS, feed, fromNote, HOMES, load, loadUnclaimed, mood, pat, play, restore, save, settle, stageOf, toggleSleep, toNote, utcDay, type HomeId, type Outcome, type Pet } from '../companion/care'
import { buildPetTxn, fetchPetNote, signSendConfirm } from '../lib/chain'
import { useChain } from '../lib/data'
import { checkinDays, weekOf, weekStart } from '../lib/giveaway'
import { PixelArt } from '../components/Pixel'
import { Failed, HoldButton, Loading, useToast } from '../components/ui'
import { useMe } from '../components/Wallet'
import { EXPLORER_TX, GIVEAWAY } from '../config'

const NAMES: Record<Form, string[]> = { boy: ['Zib', 'Blip', 'Orbit', 'Comet', 'Kip', 'Zorp', 'Rigel', 'Bolt'], girl: ['Nova', 'Luna', 'Zuzu', 'Vega', 'Lyra', 'Mira', 'Pixie', 'Stella'] }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]
const errText = (e: any) => { const m = String(e?.message ?? e); return /reject|cancel|closed|denied/i.test(m) ? 'Signature cancelled. Nothing was saved.' : /overspend|below min/i.test(m) ? 'This wallet needs a little ALGO for the 0.001 ALGO network fee.' : m.slice(0, 160) }
type Busy = '' | 'sign' | 'send'

/** A Cozmling belongs to a wallet: connect one to adopt, or to bring yours back. */
export function Companion() {
  const { activeAddress } = useWallet()
  return activeAddress ? <Owned key={activeAddress} owner={activeAddress} /> : <Gate />
}

function Owned({ owner }: { owner: string }) {
  const { algodClient, signTransactions } = useWallet()
  const toast = useToast()
  const [pet, setPet] = useState<Pet | null>(() => { const p = load(owner); return p ? settle(p) : null })
  const [find, setFind] = useState<'looking' | 'found' | 'none' | 'error'>('looking')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<Busy>('')
  const [greeting, setGreeting] = useState('')
  const startingOver = useRef(false)
  const { pets: notes, reload } = useChain()
  const [checkedToday, setCheckedToday] = useState<number[]>([])   // check-ins the indexer may not show yet
  const current = useRef(pet)
  current.current = pet
  useEffect(() => { save(owner, pet) }, [owner, pet])
  // needs tick down in real time
  useEffect(() => { const t = setInterval(() => setPet(p => p && settle(p)), 4000); return () => clearInterval(t) }, [])

  // look up the wallet's saved Cozmling: restore it here, or pick up changes saved on another device
  const lookUp = useCallback(() => {
    setFind('looking')
    fetchPetNote(owner).then(n => {
      const saved = n && fromNote(n.data)
      if (!n || !saved) { setFind('none'); return }
      setFind('found')
      if (startingOver.current) return
      const p = current.current
      if (!p) {
        setPet(restore(owner, saved, n.txid, n.round))
        setGreeting(`Welcome back! ${saved.name} was restored from your wallet.`)
      } else if (n.round > (p.round ?? 0)) {
        setPet(q => q && { ...q, name: saved.name, look: saved.look, home: saved.home, born: saved.born, txid: n.txid, round: n.round, owner, fed: Math.max(q.fed, saved.fed), played: Math.max(q.played, saved.played), pets: Math.max(q.pets, saved.pets) })
      }
    }, () => setFind('error'))
  }, [owner])
  useEffect(lookUp, [lookUp])

  /** Save a Cozmling to the wallet: one signature, a 0-ALGO note to itself. */
  const write = async (p: Pet, checkin = false): Promise<Pet | null> => {
    setBusy('sign')
    try {
      const { txid, round } = await signSendConfirm(algodClient, signTransactions, [await buildPetTxn(algodClient, owner, toNote(p, checkin))], () => setBusy('send'))
      return { ...p, owner, txid, round }
    } catch (e) { toast(errText(e)); return null } finally { setBusy('') }
  }

  const week = Math.max(1, weekOf())
  const days = [...new Set([...(notes.data ? checkinDays(week, notes.data, owner) : []), ...checkedToday.filter(d => d * 86_400_000 >= weekStart(week))])]
  /** The daily check-in: one signature that backs the Cozmling up and counts toward the giveaway bonus. */
  const checkIn = async () => {
    const now = settle(current.current!)
    const p = await write({ ...now, fun: clamp(now.fun + 15) }, true)
    if (!p) return false
    setPet(p)
    setCheckedToday(d => [...d, utcDay()])
    setTimeout(() => reload('giveaway'), 4000)
    return true
  }

  if (!pet && find === 'looking') return <><Head /><Loading what="your Cozmling" /></>
  if (!pet && find === 'error') return <><Head /><Failed what="your Cozmling" retry={lookUp} /></>
  if (!pet) {
    const unclaimed = startingOver.current ? null : loadUnclaimed()
    return <Adopt claim={unclaimed} busy={busy} onDone={async (name, look, home) => {
      const p = await write(unclaimed ? { ...settle(unclaimed), name, look, home } : adopt(name, look, home))
      if (!p) return
      if (unclaimed) clearUnclaimed()
      startingOver.current = false
      setPet(p)
    }} />
  }
  if (editing) return <Adopt pet={pet} busy={busy} onCancel={() => setEditing(false)} onDone={async (name, look, home) => {
    const p = await write({ ...settle(pet), name, look, home })
    if (p) { setPet(p); setEditing(false); toast('Saved to your wallet.') }
  }} />
  return <Habitat pet={pet} setPet={setPet} greeting={greeting} onEdit={() => setEditing(true)} onStartOver={() => { startingOver.current = true; setPet(null) }}
    checkin={{ days, busy, onCheckIn: checkIn }} />
}

function Head() {
  return (
    <header className="page-head">
      <h1>Cozmling</h1>
      <p>A little alien that lives on the site. Feed it, play with it and put it to bed, and it grows from a Star Egg into a Guardian.</p>
    </header>
  )
}

function Gate() {
  const { openConnect } = useMe()
  const [form, setForm] = useState<Form>('boy')
  useEffect(() => { const t = setInterval(() => setForm(f => (f === 'boy' ? 'girl' : 'boy')), 4800); return () => clearInterval(t) }, [])
  return (
    <>
      <Head />
      <section className="cz">
        <div className="cz__stage"><Preview look={DEFAULT_LOOK[form]} home={form === 'boy' ? 'moonbase' : 'grove'} /></div>
        <div className="panel cz-gate">
          <h2>Adopt one, free</h2>
          <p>Connect a wallet to adopt your Cozmling, or to find the one you already have. It’s saved to your wallet on Algorand, so it comes back on any device, even if this browser forgets it.</p>
          <button className="btn btn--phos" onClick={openConnect}>Connect a wallet</button>
          <p className="cz__fine">Adopting signs one short note from your wallet to itself. The only cost is the 0.001 ALGO network fee, and you don’t need any COZMC.</p>
        </div>
      </section>
    </>
  )
}

/* ---------------- the room ---------------- */
interface CheckinProps { days: number[]; busy: Busy; onCheckIn: () => Promise<boolean> }

function Habitat({ pet, setPet, greeting, onEdit, onStartOver, checkin }: { pet: Pet; setPet: (p: Pet) => void; greeting: string; onEdit: () => void; onStartOver: () => void; checkin: CheckinProps }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const room = useRef<Room | null>(null)
  const live = useRef({ pet, crack: 0 })
  const [crack, setCrack] = useState(0)
  const [say, setSay] = useState(greeting)
  useEffect(() => { if (greeting) setSay(greeting) }, [greeting])
  const [menu, setMenu] = useState(false)
  live.current = { pet, crack }

  useEffect(() => {
    const r = new Room(canvas.current!)
    room.current = r
    let raf = 0
    const loop = () => {
      const { pet: p, crack: c } = live.current, m = mood(p)
      r.draw({ home: p.home, look: p.look, stage: stageOf(p), asleep: !!p.asleep, low: m.mood === 'low', need: m.need, crack: c })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  useEffect(() => { if (!say) return; const t = setTimeout(() => setSay(''), 3200); return () => clearTimeout(t) }, [say])
  // the food menu closes on Escape or a tap anywhere else
  useEffect(() => {
    if (!menu) return
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.cz__feed')) setMenu(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    addEventListener('pointerdown', down); addEventListener('keydown', key)
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [menu])

  const now = settle(pet)
  const m = mood(now)
  const stage = stageOf(now)

  const act = (o: Outcome, react: (r: Room) => void) => {
    if (o.say) setSay(o.say)
    if (o.ok) { setPet(o.pet); react(room.current!) } else room.current?.refuse()
  }
  const warmEgg = () => {
    const n = crack + 1
    if (n < 4) { setCrack(n); room.current?.crack(); return }
    setCrack(0)
    setPet({ ...now, hatched: Date.now(), at: Date.now() })
    room.current?.hatch(GLOWS[pet.look.glow])
    setSay(`Welcome to the world, ${pet.name}!`)
  }
  const doPat = () => {
    if (now.asleep) { setSay(`Shh, ${pet.name} is sleeping.`); return }
    act(pat(now), r => r.pat())
  }
  const tap = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    const sx = ((e.clientX - b.left) / b.width) * W, sy = ((e.clientY - b.top) / b.height) * H
    if (!room.current?.hit(sx, sy)) return
    if (!now.hatched) warmEgg(); else doPat()
  }

  return (
    <>
      <header className="page-head cz-head">
        <h1>{pet.name}</h1>
        <p>{now.hatched ? <>{pet.look.form === 'girl' ? 'Girl' : 'Boy'}, {STAGE_NAME[stage]}. {ageText(now)}.</> : <>A Star Egg, waiting to hatch. Tap it to keep it warm.</>}</p>
      </header>

      <section className="cz">
        <div className="cz__stage">
          <div className={`cz__screen${now.asleep ? ' is-night' : ''}`}>
            <canvas ref={canvas} width={W} height={H} onPointerDown={tap} role="img" aria-label={`${pet.name} in the ${HOMES[pet.home].name}. ${m.line}`} />
            <p className="cz__say" aria-live="polite">{say}</p>
          </div>

          {!now.hatched ? (
            <div className="cz__actions">
              <button className="btn btn--phos" onClick={warmEgg}>Tap the egg</button>
              <span className="cz__crack" aria-label={`${crack} of 4 taps`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < crack ? 'on' : ''} />)}</span>
            </div>
          ) : (
            <div className="cz__actions">
              <div className="cz__feed">
                <button className="btn btn--ghost" aria-expanded={menu} onClick={() => setMenu(v => !v)} disabled={!!now.asleep}><PixelArt rows={ART.cheese.rows} palette={ART.cheese.pal} size={16} /> Feed</button>
                {menu && (
                  <div className="cz__menu" role="menu">
                    {FOODS.map(f => (
                      <button key={f.id} role="menuitem" onClick={() => { setMenu(false); act(feed(now, f), r => r.feed(f.id)) }}>
                        <PixelArt rows={ART[f.id].rows} palette={ART[f.id].pal} size={20} />
                        <span>{f.name}</span><small>{f.fun > 10 ? 'treat' : `+${f.food} food`}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="btn btn--ghost" onClick={() => act(play(now), r => r.play())} disabled={!!now.asleep}><PixelArt rows={ART.ball.rows} palette={ART.ball.pal} size={16} /> Play</button>
              <button className="btn btn--ghost" onClick={doPat} disabled={!!now.asleep}><PixelArt rows={ART.heart.rows} palette={ART.heart.pal} size={16} /> Pat</button>
              <button className="btn btn--ghost" onClick={() => act(toggleSleep(now), r => (now.asleep ? r.wake() : r.sleep()))}>
                <PixelArt rows={ART.z.rows} palette={ART.z.pal} size={14} /> {now.asleep ? 'Wake up' : 'Lights out'}
              </button>
            </div>
          )}
        </div>

        <aside className="cz__side">
          <div className="panel cz__needs">
            <p className={`cz__mood cz__mood--${m.mood}`}>{m.line}</p>
            <Need label="Food" value={now.food} kind="food" dim={!now.hatched} />
            <Need label="Fun" value={now.fun} kind="fun" dim={!now.hatched} />
            <Need label="Energy" value={now.energy} kind="energy" dim={!now.hatched} />
            <p className="cz__fine">Needs run down over about a day, even while you’re away. {pet.name} never dies; a neglected Cozmling just gets hungry, bored or sleepy.</p>
          </div>

          {now.hatched && <CheckIn name={pet.name} {...checkin} onCheckIn={async () => {
            if (await checkin.onCheckIn()) { room.current?.pat(); setSay(`Checked in! ${pet.name} is so happy to see you.`) }
          }} />}

          <div className="panel cz__home">
            <header className="panel__head"><h2>Home</h2><button className="btn btn--ghost btn--sm" onClick={onEdit}>Change look</button></header>
            <div className="cz__homes">
              {(Object.keys(HOMES) as HomeId[]).map(id => (
                <button key={id} className={`cz__hb${pet.home === id ? ' on' : ''}`} aria-pressed={pet.home === id} onClick={() => setPet({ ...now, home: id })}>
                  <HomeThumb id={id} /><span>{HOMES[id].name}</span>
                </button>
              ))}
            </div>
            <dl className="cz__stats">
              <div><dt>Meals</dt><dd>{pet.fed}</dd></div>
              <div><dt>Games</dt><dd>{pet.played}</dd></div>
              <div><dt>Pats</dt><dd>{pet.pets}</dd></div>
            </dl>
            <p className="cz__saved">{pet.txid
              ? <>Saved to your wallet, so {pet.name} can always come back. <a href={EXPLORER_TX(pet.txid)} target="_blank" rel="noopener">See the note ↗</a></>
              : <>Not saved to your wallet yet.</>}</p>
          </div>
        </aside>
      </section>

      <Prototype pet={now} setPet={setPet} onStartOver={onStartOver} />
    </>
  )
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/* This week's check-ins (Monday to Sunday, UTC) and the giveaway bonus they lead to. */
function CheckIn({ name, days, busy, onCheckIn }: { name: string; days: number[]; busy: Busy; onCheckIn: () => void }) {
  const week = Math.max(1, weekOf()), first = utcDay(weekStart(week)), today = utcDay()
  const need = GIVEAWAY.checkinDays, got = Math.min(days.length, need), done = days.includes(today)
  return (
    <div className="panel cz-check">
      <header className="panel__head"><h2>Daily check-in</h2><a className="link" href="#/arcade/giveaway">Giveaway</a></header>
      <ol className="cz-check__week">
        {WEEKDAYS.map((w, i) => {
          const d = first + i, on = days.includes(d)
          return <li key={w} className={`${on ? 'is-on' : ''}${d === today ? ' is-today' : ''}${d > today ? ' is-later' : ''}`} aria-label={`${w}: ${on ? 'checked in' : d > today ? 'still to come' : 'missed'}`}>{w[0]}</li>
        })}
      </ol>
      <p className="cz-check__msg">{got >= need
        ? <><b>Bonus ticket earned</b> for this week’s giveaway. Keep checking in to keep {name} backed up.</>
        : <>{got} of {need} days this week. Check in on {need - got} more {need - got === 1 ? 'day' : 'days'} for a bonus giveaway ticket.</>}</p>
      <button className="btn btn--gold" disabled={done || !!busy} onClick={onCheckIn}>
        {busy === 'sign' ? 'Approve in your wallet…' : busy === 'send' ? 'Checking in…' : done ? 'Checked in today' : `Check in with ${name}`}
      </button>
      <p className="cz__fine">Each check-in signs a short note from your wallet to itself (0.001 ALGO network fee) and backs up {name}’s stats there too. Days reset at 00:00 UTC.</p>
    </div>
  )
}

function Need({ label, value, kind, dim }: { label: string; value: number; kind: string; dim?: boolean }) {
  const segs = 10, fill = (value / 100) * segs
  return (
    <div className={`cz-need cz-need--${kind}${value < 25 && !dim ? ' is-low' : ''}${dim ? ' is-dim' : ''}`}>
      <span className="cz-need__l">{label}</span>
      <span className="cz-need__bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-label={label}>
        {Array.from({ length: segs }, (_, i) => <i key={i} style={{ '--f': Math.max(0, Math.min(1, fill - i)) } as CSSProperties} />)}
      </span>
      <span className="cz-need__v">{Math.round(value)}</span>
    </div>
  )
}

function HomeThumb({ id }: { id: HomeId }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) homeThumb(ref.current, id) }, [id])
  return <canvas ref={ref} width={W} height={H} aria-hidden="true" />
}

/* Phase 1 is a prototype for sign-off: these controls let you see every stage and fast-forward time. */
function Prototype({ pet, setPet, onStartOver }: { pet: Pet; setPet: (p: Pet) => void; onStartOver: () => void }) {
  const show = (s: Stage) => {
    if (s === 'egg') setPet({ ...pet, hatched: null, preview: undefined })
    else setPet({ ...pet, hatched: pet.hatched ?? Date.now(), at: Date.now(), preview: s === 'sprout' ? undefined : s })
  }
  const skip = (hours: number) => {
    const later = settle(pet, Date.now() + hours * 3_600_000)
    setPet({ ...later, at: Date.now(), asleep: later.asleep ? Date.now() : null })
  }
  return (
    <section className="panel cz-proto" aria-labelledby="cz-proto-h">
      <header className="panel__head"><h2 id="cz-proto-h">Prototype controls</h2></header>
      <p className="muted small">In the full version, {pet.name} grows from on-chain activity: daily check-ins, posted scores and burns. For now you can jump between stages to see each one. Starting over lets you adopt a new Cozmling, which replaces this one in your wallet.</p>
      <div className="chips">{STAGES.map(s => <button key={s} className={`chip${stageOf(pet) === s ? ' on' : ''}`} onClick={() => show(s)}>{STAGE_NAME[s]}</button>)}</div>
      <div className="row">
        <button className="btn btn--ghost btn--sm" onClick={() => skip(6)} disabled={!pet.hatched}>Skip 6 hours</button>
        <button className="btn btn--ghost btn--sm" onClick={() => skip(24)} disabled={!pet.hatched}>Skip a day</button>
        <HoldButton onDone={onStartOver}>Hold to start over</HoldButton>
      </div>
    </section>
  )
}

/* ---------------- adopting (and changing the look later) ---------------- */
function Adopt({ pet, claim, busy, onDone, onCancel }: { pet?: Pet; claim?: Pet | null; busy: Busy; onDone: (name: string, look: Look, home: HomeId) => void; onCancel?: () => void }) {
  const from = pet ?? claim
  const [look, setLook] = useState<Look>(from?.look ?? DEFAULT_LOOK.boy)
  const [name, setName] = useState(from?.name ?? pick(NAMES.boy))
  const [home, setHome] = useState<HomeId>(from?.home ?? 'moonbase')
  const [typed, setTyped] = useState(!!from)
  const set = (k: keyof Look, v: number | Form) => setLook(l => ({ ...l, [k]: v }))
  const chooseForm = (f: Form) => {
    // still on the other form's starting colours? switch to this form's; otherwise keep the picks
    setLook(l => { const o = DEFAULT_LOOK[l.form]; return l.body === o.body && l.glow === o.glow && l.eyes === o.eyes ? DEFAULT_LOOK[f] : { ...l, form: f } })
    if (!typed) setName(pick(NAMES[f]))
  }
  const ok = cleanName(name).trim().length > 0

  return (
    <>
      <header className="page-head">
        <h1>{pet ? `${pet.name}’s look` : claim ? `Save ${claim.name}` : 'Adopt a Cozmling'}</h1>
        <p>{pet ? 'Change the colours, the name or the home. It stays the same Cozmling.'
          : claim ? `Right now ${claim.name} only lives in this browser. Save your Cozmling to your wallet so it can never get lost.`
          : 'A little alien that lives on the site. Feed it, play with it and put it to bed, and it grows from a Star Egg into a Guardian.'}</p>
      </header>
      <section className="cz cz--adopt">
        <div className="cz__stage">
          <Preview look={look} home={home} />
        </div>
        <form className="panel cz-form" onSubmit={e => { e.preventDefault(); if (ok && !busy) onDone(cleanName(name).trim(), look, home) }}>
          {!pet && (
            <fieldset>
              <legend>Boy or girl</legend>
              <div className="cz-form__forms">
                {(['boy', 'girl'] as Form[]).map(f => (
                  <button type="button" key={f} className={`cz-form__form${look.form === f ? ' on' : ''}`} aria-pressed={look.form === f} onClick={() => chooseForm(f)}>
                    <Mini look={{ ...look, form: f }} />{f === 'boy' ? 'Boy' : 'Girl'}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <label className="cz-form__name">
            <span>Name</span>
            <span className="cz-form__namerow">
              <input value={name} maxLength={14} onChange={e => { setName(cleanName(e.target.value)); setTyped(true) }} autoComplete="off" spellCheck={false} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setName(pick(NAMES[look.form])); setTyped(false) }} aria-label="Suggest a name">Shuffle</button>
            </span>
          </label>
          <Swatches label="Body" colors={BODIES} value={look.body} onPick={i => set('body', i)} />
          <Swatches label="Glow" colors={GLOWS} value={look.glow} onPick={i => set('glow', i)} />
          <Swatches label="Eyes" colors={EYES} value={look.eyes} onPick={i => set('eyes', i)} />
          <fieldset>
            <legend>Home</legend>
            <div className="cz__homes">
              {(Object.keys(HOMES) as HomeId[]).map(id => (
                <button type="button" key={id} className={`cz__hb${home === id ? ' on' : ''}`} aria-pressed={home === id} onClick={() => setHome(id)}>
                  <HomeThumb id={id} /><span>{HOMES[id].name}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="row">
            <button className="btn btn--phos" disabled={!ok || !!busy}>
              {busy === 'sign' ? 'Approve in your wallet…' : busy === 'send' ? 'Saving to Algorand…' : pet ? 'Save' : `${claim ? 'Save' : 'Adopt'} ${cleanName(name).trim() || 'your Cozmling'}`}
            </button>
            {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={!!busy}>Cancel</button>}
          </div>
          <p className="cz__fine">{pet
            ? 'Saving signs a new note from your wallet to itself (0.001 ALGO network fee). The newest note is the one that counts.'
            : 'Adopting is free. You sign one short note from your wallet to itself, so your Cozmling is saved on Algorand and comes back on any device. The only cost is the 0.001 ALGO network fee.'}</p>
        </form>
      </section>
    </>
  )
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: string[]; value: number; onPick: (i: number) => void }) {
  return (
    <fieldset className="cz-sw">
      <legend>{label}</legend>
      <div>{colors.map((c, i) => <button type="button" key={c} style={{ background: c }} className={value === i ? 'on' : ''} aria-pressed={value === i} aria-label={`${label} ${i + 1}`} onClick={() => onPick(i)} />)}</div>
    </fieldset>
  )
}

/** The adopt preview: your Cozmling in its home, growing through the stages on a loop. */
function Preview({ look, home }: { look: Look; home: HomeId }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const live = useRef({ look, home })
  const [stage, setStage] = useState<Stage>('sprout')
  live.current = { look, home }
  useEffect(() => {
    const grown = STAGES.slice(1)
    let i = 0
    const t = setInterval(() => { i = (i + 1) % grown.length; setStage(grown[i]) }, 2400)
    return () => clearInterval(t)
  }, [])
  const st = useRef(stage); st.current = stage
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    let raf = 0
    const loop = () => {
      const t = performance.now() / 1000
      drawHome(ctx, live.current.home, t)
      drawBulbGlow(ctx, drawCozmling(ctx, W / 2, FLOOR_Y, live.current.look, st.current, 'idle', t), t)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="cz__screen">
      <canvas ref={ref} width={W} height={H} role="img" aria-label={`Your Cozmling as a ${STAGE_NAME[stage]}`} />
      <p className="cz__tag">{STAGE_NAME[stage]}</p>
    </div>
  )
}

/** A small still of the Cozmling, for the boy/girl buttons. */
function Mini({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, 48, 52)
    drawBulbGlow(ctx, drawCozmling(ctx, 24, 50, look, 'cadet', 'happy', 0.63), 0.63)
  }, [look])
  return <canvas ref={ref} width={48} height={52} aria-hidden="true" />
}
