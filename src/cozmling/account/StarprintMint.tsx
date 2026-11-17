/* "Mint on TestNet": a verified owner turns a hatched Starprint into a one-of-one Algorand TestNet asset.
   TestNet only, a rehearsal for the MainNet launch: nothing here has any value, costs the player anything,
   or asks their wallet to sign. The asset is held by the COZMC TestNet issuer for now; delivery to the
   player's wallet comes in a later step. */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { AdventurerCompanion } from '../types'
import { AccountRequestError, mintStarprint, starprintMints, type StarprintMint } from './accountClient'

const REASONS: Record<string, string> = {
  daily_cap_reached: 'Today’s TestNet mints are used up. Try again tomorrow (UTC).',
  issuer_unfunded: 'The COZMC TestNet issuer is out of TestNet ALGO. It will be topped up soon.',
  not_hatched: 'Only a hatched Starprint can be minted.',
  companion_missing: 'This Starprint isn’t saved to the verified wallet.',
  disabled: 'TestNet minting is switched off right now.',
}
const reason = (error: unknown) => {
  if (error instanceof AccountRequestError) {
    const code = (error.payload as { error?: string } | null)?.error
    if (code && REASONS[code]) return REASONS[code]
    if (error.status === 401) return 'Verify this wallet to mint.'
  }
  return 'The mint service couldn’t be reached. Try again.'
}

export function StarprintMintPanel({ companion, wallet }: { companion: AdventurerCompanion; wallet: string }) {
  const [mint, setMint] = useState<StarprintMint | null | undefined>(undefined)
  const [includeName, setIncludeName] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const live = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    live.current?.abort()
    const task = new AbortController(); live.current = task
    try {
      const info = await starprintMints(wallet, task.signal)
      setMint(info.mints.find(m => m.companionId === companion.companionId) ?? null)
    } catch (error) { if (!task.signal.aborted) { setMint(null); setNote(reason(error)) } }
  }, [wallet, companion.companionId])

  useEffect(() => { void refresh(); return () => live.current?.abort() }, [refresh])
  // a mint on its way: ask again every few seconds until the chain confirms it
  useEffect(() => {
    if (mint?.status !== 'submitted' && mint?.status !== 'queued') return
    const timer = setTimeout(() => { void refresh() }, 4000)
    return () => clearTimeout(timer)
  }, [mint, refresh])

  async function start() {
    setBusy(true); setNote('')
    try { setMint(await mintStarprint(wallet, companion.companionId, includeName ? companion.name : null, new AbortController().signal)) }
    catch (error) { setNote(reason(error)) }
    finally { setBusy(false) }
  }

  return (
    <details className="panel sl-share sl-mint">
      <summary>Starprint NFT (TestNet)</summary>
      {mint === undefined && <p className="sl-fine" role="status">Checking…</p>}
      {mint?.status === 'confirmed' && (
        <p className="sl-fine" role="status">
          {companion.name} is Starprint #{mint.serial} on Algorand TestNet, asset{' '}
          {mint.explorer ? <a className="link" href={mint.explorer} target="_blank" rel="noreferrer">{mint.assetId}</a> : mint.assetId}.
          {' '}It’s held by the COZMC TestNet issuer for now; sending it to your wallet comes later.
        </p>
      )}
      {(mint?.status === 'submitted' || mint?.status === 'queued') && (
        <p className="sl-fine" role="status">Starprint #{mint.serial} is being minted on TestNet. This takes a few seconds…</p>
      )}
      {mint === null && (
        <>
          <p className="sl-fine">A rehearsal for the MainNet launch: mint {companion.name} as a one-of-one Algorand <strong>TestNet</strong> asset. TestNet assets have no value, and this costs you nothing and asks your wallet for nothing.</p>
          <p className="sl-fine">Public on the asset: a serial number and its Star Chart’s Sun sign, element and archetype. Never its birthplace, birthday, story or anything about you.</p>
          <div className="sl-share__opts">
            <label><input type="checkbox" checked={includeName} onChange={event => setIncludeName(event.target.checked)} /> Include the name “{companion.name}”</label>
          </div>
          <p><button type="button" className="btn btn--phos" disabled={busy} onClick={() => void start()}>{busy ? 'Minting…' : 'Mint on TestNet'}</button></p>
        </>
      )}
      {note && <p className="sl-fine" role="alert">{note}</p>}
    </details>
  )
}
