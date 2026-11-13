/* Adopting a new Cozmling, with no wallet: choose its birthday, meet its Starprint, choose a look,
   name it, and a Star Egg is made. Three short steps, every control a real form control. */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { cleanName } from '../../companion/care'
import { COZMLING_DEV, cozmlingStore } from '../index'
import { adoptProblem, NAMES, newAdventurer, SKINS } from '../domain/adventurer'
import { birthdayText, ELEMENTS, signFor, signInfo } from '../domain/starprint'
import { loadSkyEngine } from '../celestial/load'
import { clockText, ORIGIN_OBSERVATORY } from '../celestial/observatory'
import { signsWithArt } from '../render/assetManifest'
import { newId } from '../store/util'
import { Glyph, Orb } from '../components/Glyph'
import { StarSky } from '../components/StarSky'
import { LookPicker } from './LookPicker'

const pad = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function AdoptionScreen({ onCancel }: { onCancel?: () => void }) {
  const [step, setStep] = useState(1)
  const form = useRef<HTMLFormElement>(null)
  const first = useRef(true)
  // a new step: bring the top of the form into view and put the keyboard on the step's heading
  useEffect(() => {
    if (first.current) { first.current = false; return }
    form.current?.scrollIntoView({ block: 'start' })
    form.current?.querySelector<HTMLElement>('section > h2')?.focus({ preventScroll: true })
  }, [step])
  const [birthday, setBirthday] = useState('')
  const [look, setLook] = useState<'a' | 'b'>('a')
  const [skin, setSkin] = useState(SKINS[0].id)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  // The Sun's real sign on that birthday. It is worked out for the hatch minute, so until the egg hatches
  // it is shown for "if it hatched now"; that only matters on a cusp day, when the Sun changes sign.
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof loadSkyEngine>> | null>(null)
  useEffect(() => { loadSkyEngine().then(setEngine, () => { /* the calendar's sign is used instead */ }) }, [])
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000))
  useEffect(() => { const t = setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 20_000); return () => clearInterval(t) }, [])
  const skySign = useMemo(() => (engine && birthday ? engine.sunSignOnBirthday(birthday, minute * 60_000) : null), [engine, birthday, minute])
  const sign = useMemo(() => (skySign ? signInfo(skySign.sign) : signFor(birthday)), [skySign, birthday])
  const cusp = skySign?.cusp ?? null
  const sky: [string, string] = sign ? ELEMENTS[sign.element].orb : ['#00bffe', '#03263a']
  const surprise = () => { const y = new Date().getFullYear(), t = Date.UTC(y, 0, 1) + Math.floor(Math.random() * 365) * 86_400_000, d = new Date(t); setBirthday(`${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`) }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const choices = { name, birthday, look, skin }, why = adoptProblem(choices)
    if (why) { setProblem(why); return }
    const store = cozmlingStore()
    if (!store) { setProblem('The Star Loft isn’t ready yet. Give it a moment and try again.'); return }
    setBusy(true); setProblem('')
    const now = Date.now(), starprint = engine?.provisionalStarprint(birthday, now) ?? undefined
    const res = await store.adopt(newAdventurer(choices, { companionId: newId(), now, starprint }))
    setBusy(false)
    if (!res.ok) setProblem('That didn’t save. Nothing was lost: try again in a moment.')
  }

  return (
    <>
      <header className="page-head">
        <h1>Adopt a Cozmling</h1>
        <p>A little adventurer who lives on COZMC and comes along to the arcade. It’s free, and you don’t need a wallet.</p>
      </header>

      <form className="sl-adopt panel" ref={form} onSubmit={create} noValidate>
        {/* the sky this Cozmling is born under: its own for every birthday, in its element's colours */}
        <div className="sl-banner" style={{ '--o1': sky[0], '--o2': sky[1] } as CSSProperties}>
          <StarSky seed={sign ? birthday : 'not chosen yet'} a={sky[0]} b={sky[1]} />
          <div className="sl-banner__text">
            {sign ? (
              <>
                <p className="sl-banner__k">Born {birthdayText(birthday)}</p>
                <p className="sl-banner__sign"><Glyph sign={sign.sign} size={34} /> {sign.name}</p>
                <p className="sl-banner__more"><span><Orb element={sign.element} size={14} /> {ELEMENTS[sign.element].name}</span><span>The {sign.archetype}</span></p>
              </>
            ) : <p className="sl-banner__k">Every Cozmling is born under its own sky</p>}
          </div>
        </div>

        <ol className="sl-steps" aria-label="Steps">
          {['Birthday', 'Starprint', 'Name'].map((t, i) => <li key={t} className={step === i + 1 ? 'is-on' : step > i + 1 ? 'is-done' : ''} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1}</span> {t}</li>)}
        </ol>

        {step === 1 && (
          <section aria-labelledby="sl-s1">
            <h2 id="sl-s1" tabIndex={-1}>Choose your Cozmling’s birthday</h2>
            <p>Any day you like: today, a lucky date, a day that matters to you. This is the Cozmling’s birthday, not yours. We don’t ask for yours.</p>
            <div className="sl-field">
              <label htmlFor="sl-bday">Birthday</label>
              <input id="sl-bday" type="date" value={birthday} min="1900-01-01" max="2200-12-31" onChange={e => setBirthday(e.target.value)} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBirthday(today())}>Today</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={surprise}>Surprise me</button>
            </div>
            <p className="sl-hint" role="status">{!sign ? (birthday ? 'That isn’t a date we can use.' : 'Pick a date to see its sign.')
              : cusp ? <>{birthdayText(birthday)} is a cusp day: the Sun moves from {signInfo(cusp.before).name} into {signInfo(cusp.after).name} at {clockText(cusp.at, ORIGIN_OBSERVATORY.timeZone)} Mauna Kea time. If it hatched now it would be <b>{sign.name}</b>; the minute it hatches decides.</>
              : <>{birthdayText(birthday)} falls under <b>{sign.name}</b>.</>}</p>
            <p className="sl-fine">Its birth sky will be read over the Origin Observatory on Mauna Kea: on this day, at the minute its egg hatches. That sets its Moon, its Rising sign and the rest of its chart.</p>
            {COZMLING_DEV && <p className="sl-devnote">Preview note: only {signsWithArt().map(s => s[0].toUpperCase() + s.slice(1)).join(' and ')} have art so far (placeholders). Try <button type="button" className="link" onClick={() => setBirthday(`${new Date().getFullYear()}-11-05`)}>Nov 5</button> or <button type="button" className="link" onClick={() => setBirthday(`${new Date().getFullYear()}-05-05`)}>May 5</button>. Other signs work too and show a stand-in.</p>}
            <div className="sl-nav">
              {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>}
              <button type="button" className="btn btn--phos" disabled={!sign} onClick={() => setStep(2)}>Next</button>
            </div>
          </section>
        )}

        {step === 2 && sign && (
          <section aria-labelledby="sl-s2">
            <h2 id="sl-s2" tabIndex={-1}>Its Starprint</h2>
            <p>Born on {birthdayText(birthday)}, your Cozmling is a <b>{sign.name}</b>: {ELEMENTS[sign.element].name.toLowerCase()} element, the {sign.archetype}. The Starprint is where its character begins. What the two of you do together decides the rest.</p>
            {cusp && <p className="sl-fine">On a cusp day the look you choose carries over if it hatches the other side of {clockText(cusp.at, ORIGIN_OBSERVATORY.timeZone)}: it keeps Look {look.toUpperCase()}, in the other sign’s style.</p>}
            <LookPicker sign={sign.sign} look={look} skin={skin} onLook={setLook} onSkin={setSkin} idBase="sl-adopt" />
            <p className="sl-fine">Both looks are the same {sign.name}: same sign, same element, same everything else. You can change look and colour later.</p>
            <div className="sl-nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn--phos" onClick={() => setStep(3)}>Next</button>
            </div>
          </section>
        )}

        {step === 3 && sign && (
          <section aria-labelledby="sl-s3">
            <h2 id="sl-s3" tabIndex={-1}>Name your Cozmling</h2>
            <div className="sl-field">
              <label htmlFor="sl-name">Name</label>
              <input id="sl-name" type="text" value={name} maxLength={14} autoComplete="off" spellCheck={false} onChange={e => setName(cleanName(e.target.value))} placeholder="Up to 14 letters" />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setName(pick(NAMES.filter(n => n !== name)))}>Suggest one</button>
            </div>
            <p className="sl-summary"><Glyph sign={sign.sign} size={18} /> {name.trim() || 'Your Cozmling'} · {sign.name} · {ELEMENTS[sign.element].name} · born {birthdayText(birthday)} · Look {look.toUpperCase()}</p>
            <p>It starts as a Star Egg. Keep it warm and it hatches.</p>
            {problem && <p className="state state--err" role="alert">{problem}</p>}
            <div className="sl-nav">
              <button type="button" className="btn btn--ghost" onClick={() => setStep(2)} disabled={busy}>Back</button>
              <button type="submit" className="btn btn--phos" disabled={busy || !name.trim()}>{busy ? 'Making the egg…' : 'Create the Star Egg'}</button>
            </div>
            <p className="sl-fine">Your Cozmling is saved in this browser. Nothing is sent anywhere, and there’s nothing to pay.</p>
          </section>
        )}
      </form>
    </>
  )
}
