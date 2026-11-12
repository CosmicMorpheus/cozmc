/* A look inside the Cozmling store, for local work and the preview site only (COZMLING_DEV).
   It shows every companion through the shared renderer, what was set aside, and the save state.
   It is not part of the game and is never in a normal build. */
import { useState } from 'react'
import { growthPoints, mood, settle } from '../../companion/care'
import { STAGE_NAME } from '../../companion/look'
import { cozmlingStore, useCozmling } from '../index'
import { legacyGrowth, legacyStage } from '../integrations/legacyAdapter'
import { CompanionRenderer } from '../render/CompanionRenderer'
import { exportAll } from '../store/exportImport'

const WRAP = { overflowWrap: 'anywhere' } as const      // wallet addresses are one long word

export function DevPanel() {
  const st = useCozmling()
  const [file, setFile] = useState('')
  if (st.status !== 'ready') return <p className="state state--load"><span className="blink">▮</span> Opening the Cozmling store…</p>
  const save = st.durable ? (st.saveProblem ? `not saved: ${st.saveProblem}` : 'saved on this device') : 'this visit only (the browser is not storing anything)'
  return (
    <>
      <header className="page-head">
        <h1>Cozmling store (dev)</h1>
        <p>Everything the new save system holds in this browser. Save state: <b data-dev="save">{save}</b>. Selected: <code data-dev="selected" style={WRAP}>{st.selectedId ?? 'none'}</code>.</p>
      </header>
      <div data-dev="companions" style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
        {st.companions.map(c => {
          const pet = c.kind === 'legacy' ? settle(c.legacy.pet) : null
          return (
            <section key={c.companionId} className="panel" style={{ minWidth: 0 }} data-id={c.companionId} data-kind={c.kind} data-archived={c.archived ? 'yes' : 'no'}>
              <header className="panel__head"><h2>{c.kind === 'legacy' ? c.legacy.pet.name : c.name}</h2><span className="muted small">{c.archived ? 'set aside' : c.companionId === st.selectedId ? 'selected' : ''}</span></header>
              <div className="buddy__screen"><CompanionRenderer companion={c} mode="buddy" /></div>
              {c.kind === 'legacy' && pet && (
                <p className="small muted">
                  <b data-dev="stage">{STAGE_NAME[legacyStage(c)]}</b> · {legacyGrowth(c)} growth ({growthPoints(pet)} by today’s rules) · {mood(pet).line}<br />
                  hatch: {c.hatch.status}{c.hatch.provenance === 'legacy-unknown' ? ' (time unknown)' : ''} · revision {c.revision} · key <code style={WRAP}>{c.legacy.sourceKey || 'none'}</code>
                </p>
              )}
              {!c.archived && c.companionId !== st.selectedId && <button className="btn btn--ghost btn--sm" onClick={() => cozmlingStore()?.select(c.companionId)}>Select</button>}
            </section>
          )
        })}
      </div>
      {!st.companions.length && <p className="muted">No companions in this browser.</p>}
      {st.quarantined.length > 0 && (
        <section className="panel" data-dev="quarantined">
          <header className="panel__head"><h2>Set aside, untouched ({st.quarantined.length})</h2></header>
          <ul className="small">{st.quarantined.map(q => <li key={q.sourceKey}><code style={WRAP}>{q.sourceKey}</code>: {q.reason}</li>)}</ul>
        </section>
      )}
      <p><button className="btn btn--ghost btn--sm" onClick={async () => { const s = cozmlingStore(); if (s) setFile(JSON.stringify(await exportAll(s.repo, Date.now()), null, 1)) }}>Show the export file</button></p>
      {file && <pre className="small" data-dev="export" style={{ maxHeight: 280, overflow: 'auto' }}>{file}</pre>}
    </>
  )
}
