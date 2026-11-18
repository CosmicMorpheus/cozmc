/* Start over: the player sets this Cozmling aside and adopts a new one. Nothing is deleted: the old one stays in
   this browser's save (and in a device copy, if they download one first), just no longer shown. Two steps, so a
   stray tap can't do it. Only for Cozmlings kept on this device; a wallet's Starprints are kept by the wallet. */
import { useState } from 'react'
import { cozmlingStore } from '../index'
import { downloadCozmlingCopy } from '../components/SaveStatus'

export function StartOver({ companionId, name }: { companionId: string; name: string }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const confirm = async () => {
    setBusy(true); setNote('')
    const res = await cozmlingStore()?.setAside(companionId)
    setBusy(false)
    if (!res?.ok) setNote(`That didn’t save, so ${name} is still here. Please try again.`)
  }

  return (
    <div className="panel sl-startover">
      <header className="panel__head"><h2>Start over</h2></header>
      {!asking ? (
        <>
          <p className="sl-fine sl-fine--flush">Want a fresh start? Adopt a new Cozmling in {name}’s place.</p>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setAsking(true)}>Start over…</button>
        </>
      ) : (
        <div role="group" aria-label={`Start over without ${name}?`}>
          <p className="sl-fine sl-fine--flush">
            {name} will be set aside and you’ll adopt a new Cozmling from the start. {name} isn’t deleted: it stays in this
            browser’s save, but it won’t be shown here any more. You can download a copy first.
          </p>
          <div className="sl-startover__actions">
            <button type="button" className="btn btn--fire btn--sm" disabled={busy} onClick={confirm}>{busy ? 'Starting over…' : 'Yes, start over'}</button>
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => { setAsking(false); setNote('') }} autoFocus>Keep {name}</button>
            <button type="button" className="link" disabled={busy} onClick={() => downloadCozmlingCopy(companionId).catch(e => setNote(String(e?.message ?? e)))}>Download a copy of {name}</button>
          </div>
        </div>
      )}
      {note && <p className="sl-fine" role="status">{note}</p>}
    </div>
  )
}
