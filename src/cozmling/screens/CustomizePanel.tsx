/* The wardrobe. For an adventurer: its look, skin colour and name. For a first-version Cozmling:
   which home it lives in (its look is changed on the wallet step, as before). */
import { useState } from 'react'
import { cleanName, HOMES, type HomeId } from '../../companion/care'
import { cozmlingStore } from '../index'
import { customize } from '../domain/adventurer'
import type { Companion } from '../types'
import { LookPicker } from './LookPicker'

export function CustomizePanel({ companion: c, onSaved }: { companion: Companion; onSaved: (say: string) => void }) {
  const adv = c.kind === 'adventurer' ? c : null
  const [look, setLook] = useState<'a' | 'b'>(adv?.appearance.appearanceOption ?? 'a')
  const [skin, setSkin] = useState(adv?.appearance.skin ?? 'teal')
  const [name, setName] = useState(adv?.name ?? '')
  const [busy, setBusy] = useState(false)

  if (c.kind === 'legacy') {
    const home = c.legacy.pet.home
    const move = async (id: HomeId) => { if (id !== home) { await cozmlingStore()?.updateLegacy(c.companionId, pet => ({ ...pet, home: id })); onSaved(`${c.legacy.pet.name} moved to the ${HOMES[id].name}.`) } }
    return (
      <div className="sl-wardrobe">
        <fieldset className="sl-homes">
          <legend>Home</legend>
          {(Object.keys(HOMES) as HomeId[]).map(id => <button key={id} type="button" className={`chip${home === id ? ' on' : ''}`} aria-pressed={home === id} onClick={() => move(id)}>{HOMES[id].name}</button>)}
        </fieldset>
        <p className="sl-fine">{c.legacy.pet.name} is a first-version Cozmling and keeps its own look.</p>
      </div>
    )
  }

  const changed = adv && (look !== adv.appearance.appearanceOption || skin !== adv.appearance.skin || (name.trim() && name.trim() !== adv.name))
  const save = async () => {
    if (!adv) return
    setBusy(true)
    const res = await cozmlingStore()?.update(adv.companionId, cur => (cur.kind === 'adventurer' ? customize(cur, { look, skin, name }) : null), { event: { eventId: `customized:${adv.companionId}:${Date.now()}`, type: 'customized' } })
    setBusy(false)
    if (res?.ok) onSaved(`${name.trim() || adv.name} has a new look.`)
  }
  return (
    <div className="sl-wardrobe">
      <LookPicker sign={adv!.starprint.coreSign} look={look} skin={skin} onLook={setLook} onSkin={setSkin} idBase="sl-wardrobe" />
      <div className="sl-field">
        <label htmlFor="sl-rename">Name</label>
        <input id="sl-rename" type="text" value={name} maxLength={14} autoComplete="off" spellCheck={false} onChange={e => setName(cleanName(e.target.value))} />
      </div>
      <p><button type="button" className="btn btn--phos btn--sm" onClick={save} disabled={!changed || busy}>{busy ? 'Saving…' : 'Save changes'}</button></p>
      <p className="sl-fine">More outfits and room decorations will arrive here. A change of clothes never changes the Starprint.</p>
    </div>
  )
}
