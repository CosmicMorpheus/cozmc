/* The Cozmling page when v2 is switched on. It reads the one shared store:
     still opening      → says so (never a false "adopt one")
     could not open     → says so, and offers to try again
     no Cozmling yet    → adoption
     otherwise          → the Star Loft, for the Cozmling that is selected
   A first-version Cozmling shows here as itself. Nothing on this page needs a wallet. */
import { useEffect, useRef, useState } from 'react'
import '../cozmling.css'
import { COZMLING_DEV, cozmlingStore, startCozmling, useCozmling } from '../index'
import { nameOf } from '../domain/care'
import { signInfo } from '../domain/starprint'
import { legacyStage } from '../integrations/legacyAdapter'
import { STAGE_NAME } from '../../companion/look'
import type { Companion } from '../types'
import { AdoptionScreen } from './AdoptionScreen'
import { StarLoftScreen } from './StarLoftScreen'

const kindText = (c: Companion) => (c.kind === 'adventurer' ? `${signInfo(c.starprint.coreSign).name} ${c.hatch.status === 'egg' ? 'egg' : c.starprint.archetype}` : STAGE_NAME[legacyStage(c)])

export function CozmlingApp() {
  const st = useCozmling()
  const [adopting, setAdopting] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [moved, setMoved] = useState(false)          // true once the player has adopted or switched Cozmling on this visit (not on a plain page load)

  // The first version's own code still writes its saves directly (the arcade Buddy does, for one).
  // Whenever this page is opened or comes back into view, take in anything it has saved.
  const ready = st.status === 'ready'
  useEffect(() => {
    if (!ready) return
    const look = () => { if (document.visibilityState === 'visible') void cozmlingStore()?.sync() }
    look()
    document.addEventListener('visibilitychange', look)
    return () => document.removeEventListener('visibilitychange', look)
  }, [ready])

  const active = st.companions.filter(c => !c.archived)
  const selected = active.find(c => c.companionId === st.selectedId) ?? active[0] ?? null
  const adoptionShown = ready && (!selected || adopting)
  const wasAdoption = useRef(false)
  useEffect(() => { if (wasAdoption.current && !adoptionShown) setMoved(true); wasAdoption.current = adoptionShown }, [adoptionShown])

  if (st.status === 'loading') return (
    <>
      <header className="page-head"><h1>Cozmling</h1></header>
      <p className="state state--load" role="status">Opening the Star Loft…</p>
    </>
  )
  if (st.status === 'failed') return (
    <>
      <header className="page-head"><h1>Cozmling</h1><p>The Star Loft couldn’t be opened just now. Nothing has been lost: whatever was saved is still saved.</p></header>
      <button className="btn btn--phos" disabled={retrying} onClick={() => { setRetrying(true); startCozmling().catch(() => {}).finally(() => setRetrying(false)) }}>{retrying ? 'Trying…' : 'Try again'}</button>
    </>
  )

  if (!selected || adopting) return (
    <>
      <AdoptedWatcher ids={active.map(c => c.companionId)} onAdopted={() => setAdopting(false)} />
      <AdoptionScreen onCancel={selected ? () => setAdopting(false) : undefined} />
      {st.quarantined.length > 0 && !selected && <p className="sl-fine sl-quarantine">A Cozmling save from before was found on this device, but it couldn’t be read. It hasn’t been changed or deleted.</p>}
    </>
  )

  return (
    <>
      <StarLoftScreen key={selected.companionId} companion={selected} arrived={moved} />
      {(active.length > 1 || COZMLING_DEV) && (
        <section className="sl-switch" aria-label="Your Cozmlings">
          {active.length > 1 && (
            <>
              <h2>Your Cozmlings</h2>
              <div className="chips">
                {active.map(c => (
                  <button key={c.companionId} className={`chip${c.companionId === selected.companionId ? ' on' : ''}`} aria-pressed={c.companionId === selected.companionId} onClick={() => { setMoved(true); void cozmlingStore()?.select(c.companionId) }}>
                    {nameOf(c)} <span className="sl-switch__kind">· {kindText(c)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {COZMLING_DEV && <p className="sl-devnote">Preview tools: <button type="button" className="link" onClick={() => setAdopting(true)}>adopt another Cozmling</button> · <a className="link" href="#/cozmling/dev">what is stored</a>. Not built yet in this step: wallet linking, daily check-in and wallet back-up in this new page, and the Home and Arcade panels (they still use the first version, so they don’t know about a new adventurer yet).</p>}
        </section>
      )}
    </>
  )
}

/** Leaves the adoption steps as soon as the new Cozmling is in the store. */
function AdoptedWatcher({ ids, onAdopted }: { ids: string[]; onAdopted: () => void }) {
  const [before] = useState(() => new Set(ids))
  const fresh = ids.some(id => !before.has(id))
  useEffect(() => { if (fresh) onAdopted() }, [fresh, onAdopted])
  return null
}
