/* Adopting a new Cozmling, with no wallet: choose its birthday, meet its Starprint, choose a look,
   name it, and a Star Egg is made. Three short steps, every control a real form control. */
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { cleanName } from '../../companion/care'
import { COZMLING_DEV, cozmlingStore } from '../index'
import { adoptProblem, NAMES, newAdventurer, SKINS } from '../domain/adventurer'
import { birthdayText, ELEMENTS, signFor } from '../domain/starprint'
import { signsWithArt } from '../render/assetManifest'
import { newId } from '../store/util'
import { Glyph, Orb } from '../components/Glyph'
import { LookPicker } from './LookPicker'

const pad = (n: number) => String(n).padStart(2, '0')
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

export function AdoptionScreen({ onCancel }: { onCancel?: () => void }) {
  const [step, setStep] = useState(1)
  const [birthday, setBirthday] = useState('')
  const [look, setLook] = useState<'a' | 'b'>('a')
  const [skin, setSkin] = useState(SKINS[0].id)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const sign = useMemo(() => signFor(birthday), [birthday])
  const surprise = () => { const y = new Date().getFullYear(), t = Date.UTC(y, 0, 1) + Math.floor(Math.random() * 365) * 86_400_000, d = new Date(t); setBirthday(`${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`) }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    const choices = { name, birthday, look, skin }, why = adoptProblem(choices)
    if (why) { setProblem(why); return }
    const store = cozmlingStore()
    if (!store) { setProblem('The Star Loft isn’t ready yet. Give it a moment and try again.'); return }
    setBusy(true); setProblem('')
    const res = await store.adopt(newAdventurer(choices, { companionId: newId(), now: Date.now() }))
    setBusy(false)
    if (!res.ok) setProblem('That didn’t save. Nothing was lost: try again in a moment.')
  }

  return (
    <>
      <header className="page-head">
        <h1>Adopt a Cozmling</h1>
        <p>A little adventurer who lives on COZMC and comes along to the arcade. It’s free, and you don’t need a wallet.</p>
      </header>

      <form className="sl-adopt panel" onSubmit={create} noValidate>
        <ol className="sl-steps" aria-label="Steps">
          {['Birthday', 'Starprint', 'Name'].map((t, i) => <li key={t} className={step === i + 1 ? 'is-on' : step > i + 1 ? 'is-done' : ''} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1}</span> {t}</li>)}
        </ol>

        {step === 1 && (
          <section aria-labelledby="sl-s1">
            <h2 id="sl-s1">Choose your Cozmling’s birthday</h2>
            <p>Any day you like: today, a lucky date, a day that matters to you. This is the Cozmling’s birthday, not yours. We don’t ask for yours.</p>
            <div className="sl-field">
              <label htmlFor="sl-bday">Birthday</label>
              <input id="sl-bday" type="date" value={birthday} min="1900-01-01" max="2200-12-31" onChange={e => setBirthday(e.target.value)} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setBirthday(today())}>Today</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={surprise}>Surprise me</button>
            </div>
            <p className="sl-hint" role="status">{sign ? <>{birthdayText(birthday)} falls under <b>{sign.name}</b>.</> : birthday ? 'That isn’t a date we can use.' : 'Pick a date to see its sign.'}</p>
            {COZMLING_DEV && <p className="sl-devnote">Preview note: only {signsWithArt().map(s => s[0].toUpperCase() + s.slice(1)).join(' and ')} have art so far (placeholders). Try <button type="button" className="link" onClick={() => setBirthday(`${new Date().getFullYear()}-11-05`)}>Nov 5</button> or <button type="button" className="link" onClick={() => setBirthday(`${new Date().getFullYear()}-05-05`)}>May 5</button>. Other signs work too and show a stand-in.</p>}
            <div className="sl-nav">
              {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancel</button>}
              <button type="button" className="btn btn--phos" disabled={!sign} onClick={() => setStep(2)}>Next</button>
            </div>
          </section>
        )}

        {step === 2 && sign && (
          <section aria-labelledby="sl-s2">
            <h2 id="sl-s2">Its Starprint</h2>
            <div className="sl-print" style={{ '--o1': ELEMENTS[sign.element].orb[0], '--o2': ELEMENTS[sign.element].orb[1] } as CSSProperties}>
              <Glyph sign={sign.sign} size={56} className="sl-print__glyph" />
              <div>
                <p className="sl-print__sign">{sign.name}</p>
                <p className="sl-print__more"><Orb element={sign.element} size={18} /> {ELEMENTS[sign.element].name} · The {sign.archetype}</p>
              </div>
            </div>
            <p>The Starprint is where your Cozmling’s character begins. What the two of you do together decides the rest.</p>
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
            <h2 id="sl-s3">Name your Cozmling</h2>
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
