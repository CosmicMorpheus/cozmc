/* Where this Cozmling is kept, said truthfully. "Saved on this device" only ever shows when the
   store really is on this device and the last change really was written. */
import { useRef, useState } from 'react'
import { cozmlingStore, useCozmling } from '../index'
import { applyImport, exportAll, planImport, type ImportPlan } from '../store/exportImport'

type Kept = 'saved' | 'problem' | 'visit'
const keptOf = (st: { durable: boolean | null; saveProblem: string | null }): Kept => (st.durable === false ? 'visit' : st.saveProblem ? 'problem' : 'saved')

/** The same truth at a glance, for the top of the page. */
export function SaveChip() {
  const state = keptOf(useCozmling())
  return (
    <p className={`sl-chip sl-chip--${state}`} role="status" data-save-chip={state}>
      {state === 'saved' ? <><span aria-hidden="true">✓</span> Saved on this device</> : state === 'visit' ? <>This visit only</> : <>Not saved</>}
    </p>
  )
}

export function SaveStatus({ name }: { name: string }) {
  const st = useCozmling()
  const [note, setNote] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const exportFile = async () => {
    const s = cozmlingStore()
    if (!s) return
    const blob = new Blob([JSON.stringify(await exportAll(s.repo, Date.now()), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = `cozmlings-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    setNote('A copy was downloaded. Keep the file somewhere safe.')
  }
  const chooseFile = async (f: File | undefined) => {
    const s = cozmlingStore()
    if (!f || !s) return
    let parsed: unknown = null
    try { parsed = JSON.parse(await f.text()) } catch { /* handled as "not a save file" below */ }
    const res = planImport(parsed, await s.repo.load(), new Set((await s.repo.events()).map(e => e.eventId)))
    if (!res.ok) { setNote(res.reason); setPlan(null); return }
    if (!res.plan.add.length && !res.plan.newer.length) { setNote('Everything in that file is already here.'); setPlan(null); return }
    setPlan(res.plan); setNote('')
  }
  const bringIn = async (takeNewer: boolean) => {
    const s = cozmlingStore()
    if (!s || !plan) return
    const res = await applyImport(s.repo, plan, new Set(takeNewer ? plan.newer.map(n => n.incoming.companionId) : []))
    setPlan(null)
    if (!res.ok) { setNote('That file could not be brought in. Nothing was changed.'); return }
    await s.reload()
    setNote(`Brought in ${plan.add.length + (takeNewer ? plan.newer.length : 0)} Cozmling${plan.add.length + (takeNewer ? plan.newer.length : 0) === 1 ? '' : 's'}.`)
  }

  const state = keptOf(st)
  return (
    <div className={`sl-save sl-save--${state}`}>
      <p className="sl-save__line" data-save={state}>
        {state === 'saved' && <><span className="sl-save__tick" aria-hidden="true">✓</span> Saved on this device</>}
        {state === 'problem' && <>Not saved: the last change didn’t go through. Try again in a moment.</>}
        {state === 'visit' && <>This visit only: this browser isn’t storing anything, so {name} won’t be here next time.</>}
      </p>
      {state === 'saved' && (
        <p className="sl-fine">
          {name} lives in this browser. No wallet and no account are needed.
          {st.persisted === false && <> Your browser may clear saved data if it runs short of space, so it’s worth keeping a copy.</>}
        </p>
      )}
      <p className="sl-save__actions">
        <button className="btn btn--ghost btn--sm" onClick={exportFile}>Keep a copy</button>
        <button className="btn btn--ghost btn--sm" onClick={() => file.current?.click()}>Bring one in</button>
        <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = '' }} />
      </p>
      {plan && (
        <div className="sl-save__plan" role="group" aria-label="Bring Cozmlings in from a file">
          <p>
            {plan.add.length > 0 && <>This file has {plan.add.length} Cozmling{plan.add.length === 1 ? '' : 's'} that {plan.add.length === 1 ? 'isn’t' : 'aren’t'} here yet. </>}
            {plan.newer.length > 0 && <>It also has a newer copy of {plan.newer.length} that {plan.newer.length === 1 ? 'is' : 'are'} already here. </>}
            Nothing here is replaced unless you say so.
          </p>
          <p className="sl-save__actions">
            {plan.add.length > 0 && <button className="btn btn--phos btn--sm" onClick={() => bringIn(false)}>Add the new {plan.add.length === 1 ? 'one' : 'ones'}</button>}
            {plan.newer.length > 0 && <button className="btn btn--ghost btn--sm" onClick={() => bringIn(true)}>{plan.add.length ? 'Add, and take the newer copies' : 'Take the newer copies'}</button>}
            <button className="btn btn--ghost btn--sm" onClick={() => setPlan(null)}>Cancel</button>
          </p>
        </div>
      )}
      {note && <p className="sl-fine" role="status">{note}</p>}
    </div>
  )
}
