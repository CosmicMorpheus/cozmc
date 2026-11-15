/* The Cozmling page when v2 is switched on. It reads the one shared store:
     still opening      → says so (never a false "adopt one")
     could not open     → says so, and offers to try again
     no Cozmling yet    → adoption
     otherwise          → the Star Loft, for the Cozmling that is selected
   A first-version Cozmling remains playable. Wallet-account mode applies to new adoptions. */
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useMe } from '../../components/Wallet'
import '../cozmling.css'
import './starLoftActions.css'
import { COZMLING_DEV, cozmlingStore, startCozmling, useCozmling } from '../index'
import { nameOf } from '../domain/care'
import { signInfo } from '../domain/starprint'
import { legacyStage } from '../integrations/legacyAdapter'
import { STAGE_NAME } from '../../companion/look'
import type { Companion } from '../types'
import { AdoptionScreen } from './AdoptionScreen'
import { StarLoftScreen } from './StarLoftScreen'
import { CommunityHatchPanel, type CommunityHatchWalletAction } from '../community/CommunityHatchPanel'
import { COMMUNITY_HATCH_LANTERN, type CommunityHatchReceipt } from '../community/communityHatch'
import { CozmlingShare } from '../community/CozmlingShare'
import { COZMC_COMMUNITY_HATCH, COZMLING_WALLET_ACCOUNT } from '../flags'
import { WalletAccess, useWalletVerification } from '../account/walletSession'
import { useCloudAccount } from '../account/useCloudAccount'
import { downloadCozmlingCopy } from '../components/SaveStatus'

const kindText = (c: Companion) => (c.kind === 'adventurer' ? `${signInfo(c.starprint.coreSign).name} ${c.hatch.status === 'egg' ? 'egg' : c.starprint.archetype}` : STAGE_NAME[legacyStage(c)])

// a Cozmling's sky in full, loaded only when it is opened
const Observatory = lazy(() => import('../celestial/ui/ObservatoryScreen').then(m => ({ default: m.ObservatoryScreen })))

type Route = {
  /** the part of the page after #/cozmling/ ('sky' = the observatory) */ sub?: string | null
  /** and after that ('today' = the observatory's view of today's sky) */ extra?: string | null
}

export function CozmlingApp(route: Route) {
  const { activeAddress, activeWallet, isReady } = useWallet()
  if (!COZMLING_WALLET_ACCOUNT) return <CozmlingView {...route} />
  const address = isReady && activeWallet ? activeAddress : null
  return <WalletCozmlingView key={address ? `${activeWallet?.walletKey}:${address}` : 'visitor'} address={address} route={route} />
}

type Account = ReturnType<typeof useCloudAccount> & {
  address: string | null
  access: ReactNode
  hatchWalletAction?: CommunityHatchWalletAction
}

function WalletCozmlingView({ address, route }: { address: string | null; route: Route }) {
  const { activeWallet, signData } = useWallet()
  const { openConnect } = useMe()
  const st = useCozmling()
  const canSign = !!activeWallet?.canSignData
  const session = useWalletVerification(address, canSign ? signData : undefined)
  const verifiedAddress = session.verified ? address : null
  const cloud = useCloudAccount(verifiedAddress, session.sessionSignal, st.status === 'ready', session.invalidate)
  const access = <WalletAccess address={address} canSign={canSign} state={session} />
  let hatchWalletAction: CommunityHatchWalletAction | undefined
  if (session.revocationPending) {
    hatchWalletAction = { label: session.busy ? 'Signing out…' : 'Finish signing out', onClick: session.signOut, disabled: session.busy }
  } else if (!address) {
    hatchWalletAction = { label: 'Connect wallet', onClick: openConnect }
  } else if (!canSign) {
    hatchWalletAction = { label: 'Switch wallets', onClick: openConnect }
  } else if (!session.verified) {
    hatchWalletAction = { label: session.busy ? 'Checking wallet…' : 'Verify for the Grove', onClick: session.verify, disabled: session.busy }
  }
  return <CozmlingView key={verifiedAddress ?? 'unverified'} {...route} account={{ ...cloud, address: verifiedAddress, access, hatchWalletAction }} />
}

function CozmlingView({ sub = null, extra = null, account: given }: Route & { account?: Account }) {
  // statically nothing unless wallet-account mode is built in, so a build without it leaves its screens out
  const account = COZMLING_WALLET_ACCOUNT ? given : undefined
  const st = useCozmling()
  const [adopting, setAdopting] = useState(false)
  const [communityEgg, setCommunityEgg] = useState<CommunityHatchReceipt | null>(null)
  const [communityNotice, setCommunityNotice] = useState('')
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

  const active = st.companions.filter(c => !c.archived && (!st.accountOwners[c.companionId] || st.accountOwners[c.companionId] === account?.address))
  const selected = active.find(c => c.companionId === st.selectedId) ?? active[0] ?? null
  const adoptionShown = ready && (!selected || adopting) && !communityEgg
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

  if (communityEgg && account?.address) return (
    <AdoptionScreen
      key={communityEgg.companionId}
      communityEgg={communityEgg}
      onCancel={() => setCommunityEgg(null)}
      onAccountAdopt={async record => {
        const saved = await account.adopt(record)
        if (selected && selected.companionId !== saved.companionId) {
          setCommunityNotice('Your Star Egg is saved. Choose it under Your Cozmlings to hatch it.')
        } else {
          setMoved(true)
        }
        setCommunityEgg(null)
      }}
    />
  )

  const canOpenEgg = (receipt: CommunityHatchReceipt) =>
    !!account?.address && !st.companions.some(c => c.companionId === receipt.companionId)
  const isOwned = !!selected && !!account?.address && st.accountOwners[selected.companionId] === account.address
  const placeLantern = isOwned && selected?.kind === 'adventurer' && selected.hatch.status === 'hatched' ? async () => {
    const store = cozmlingStore()
    if (!store) throw new Error('The Star Loft is still opening.')
    const result = await store.update(selected.companionId, current => {
      if (current.kind !== 'adventurer' || current.hatch.status !== 'hatched' || current.appearance.decor.includes(COMMUNITY_HATCH_LANTERN)) return null
      return { ...current, appearance: { ...current.appearance, decor: [...current.appearance.decor, COMMUNITY_HATCH_LANTERN] } }
    })
    if (!result.ok) throw new Error('The lantern couldn’t be saved. Try again in a moment.')
  } : undefined
  const communityPanel = account && COZMC_COMMUNITY_HATCH ? (
    <CommunityHatchPanel
      walletAddress={account.address}
      walletAction={account.hatchWalletAction}
      onOpenEgg={receipt => {
        if (canOpenEgg(receipt)) {
          setCommunityNotice('')
          setCommunityEgg(receipt)
        }
      }}
      canOpenEgg={canOpenEgg}
      onPlaceLantern={placeLantern}
      lanternPlaced={selected?.kind === 'adventurer' && selected.appearance.decor.includes(COMMUNITY_HATCH_LANTERN)}
      showcaseCompanion={isOwned && selected?.kind === 'adventurer' && selected.hatch.status === 'hatched'
        ? { id: selected.companionId, name: selected.name }
        : undefined}
    />
  ) : null
  const accountStatus = account?.address ? <AccountStatus account={account} ownedCompanionId={isOwned ? selected?.companionId : undefined} companions={st.companions} /> : null
  // the wallet panel and its sync status read as one panel
  const walletPanel = account ? <div className="sl-account">{account.access}{accountStatus}</div> : null
  const mayAdoptOrdinary = !!account?.address && account.loaded && !st.companions.some(c =>
    st.accountOwners[c.companionId] === account.address && !c.companionId.startsWith('hatch-'))

  if (!selected || adopting) return (
    <>
      {walletPanel}
      {!adopting && communityPanel}
      {(!account || (account.address && account.loaded)) && (
        <>
          <AdoptedWatcher ids={active.map(c => c.companionId)} onAdopted={() => setAdopting(false)} />
          <AdoptionScreen key="ordinary" onCancel={selected ? () => setAdopting(false) : undefined}
            onAccountAdopt={account ? async record => {
              const saved = await account.adopt(record)
              if (selected && selected.companionId !== saved.companionId) {
                setCommunityNotice('Your Star Egg is saved. Choose it under Your Cozmlings to hatch it.')
              } else {
                await cozmlingStore()?.select(saved.companionId)
              }
              setAdopting(false)
            } : undefined}
          />
        </>
      )}
      {st.quarantined.length > 0 && !selected && <p className="sl-fine sl-quarantine">A Cozmling save from before was found on this device, but it couldn’t be read. It hasn’t been changed or deleted.</p>}
    </>
  )

  // A wallet-owned Cozmling opens once the account has been checked: an older copy here would otherwise
  // start today's story and care from out-of-date progress. If the account can't be reached, it opens anyway.
  if (isOwned && account && !account.loaded && account.state === 'loading') return (
    <>
      {account.access}
      <p className="state state--load" role="status">Opening {nameOf(selected)}’s saved progress…</p>
    </>
  )

  if (sub === 'sky') return (
    <Suspense fallback={<p className="state state--load" role="status">Opening the observatory…</p>}>
      <Observatory key={selected.companionId} companion={selected} mode={extra === 'today' ? 'today' : 'birth'} />
    </Suspense>
  )

  return (
    <>
      <StarLoftScreen key={selected.companionId} companion={selected} arrived={moved} accountBacked={isOwned} />
      {walletPanel}
      {mayAdoptOrdinary && <button className="btn btn--phos" type="button" onClick={() => setAdopting(true)}>Adopt a wallet-backed Cozmling</button>}
      {isOwned && selected.kind === 'adventurer' && selected.hatch.status === 'hatched'
        && <CozmlingShare companion={selected} />}
      {communityNotice && <p className="sl-fine" role="status">{communityNotice}</p>}
      {(active.length > 1 || (COZMLING_DEV && !account)) && (
        <section className="sl-switch" aria-label="Your Cozmlings">
          {active.length > 1 && (
            <>
              <h2>Your Cozmlings</h2>
              <div className="chips">
                {active.map(c => (
                  <button key={c.companionId} className={`chip${c.companionId === selected.companionId ? ' on' : ''}`} aria-pressed={c.companionId === selected.companionId} onClick={() => { setMoved(true); setCommunityNotice(''); void cozmlingStore()?.select(c.companionId) }}>
                    {nameOf(c)} <span className="sl-switch__kind">· {kindText(c)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {COZMLING_DEV && !account && <p className="sl-devnote">Preview tools: <button type="button" className="link" onClick={() => setAdopting(true)}>adopt another Cozmling</button> · <a className="link" href="#/cozmling/dev">what is stored</a>.</p>}
        </section>
      )}
      {communityPanel}
    </>
  )
}

function AccountStatus({ account, ownedCompanionId, companions }: { account: Account; ownedCompanionId?: string; companions: Companion[] }) {
  const [exportNote, setExportNote] = useState('')
  const [resolving, setResolving] = useState<string | null>(null)
  const nameFor = (id: string) => { const c = companions.find(item => item.companionId === id); return c ? nameOf(c) : 'A Cozmling' }
  const download = (id: string) => void downloadCozmlingCopy(id).then(
    () => setExportNote('The device copy was downloaded.'),
    () => setExportNote('The device copy could not be downloaded. Try again.'),
  )
  const useAccountCopy = (id: string) => {
    setResolving(id)
    setExportNote('')
    account.resolve(id).then(
      () => setExportNote(`${nameFor(id)} now uses the wallet account’s copy on this device.`),
      (error: unknown) => setExportNote(error instanceof Error ? error.message : 'That didn’t work. Try again.'),
    ).finally(() => setResolving(null))
  }
  const text = {
    loading: 'Opening your saved Cozmlings…',
    saving: 'Updating your wallet account save…',
    synced: 'Wallet account is up to date.',
    offline: 'The account save is unavailable. Device changes are kept here when browser storage is available.',
    conflict: 'A copy on this device needs your choice before it can sync. Nothing has been replaced.',
    'too-large': 'This save exceeds the preview’s cloud limit. Your device copy is still available.',
  }[account.state]
  return <div className="sl-fine">
    <p role="status">{text}</p>
    {account.state === 'offline' && <button className="btn btn--ghost btn--sm" onClick={account.retry}>Retry account save</button>}
    {account.conflicts.map(id => (
      <div key={id} className="sl-conflict">
        <p>{nameFor(id)}: this device’s copy and the wallet account’s copy differ. Download this device’s copy if you want to keep it, then use the account’s copy here so the two stay in step.</p>
        <p className="sl-cs__go">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => download(id)}>Download this device’s copy</button>
          <button type="button" className="btn btn--phos btn--sm" disabled={resolving !== null} onClick={() => useAccountCopy(id)}>{resolving === id ? 'Updating…' : 'Use the wallet account’s copy here'}</button>
        </p>
      </div>
    ))}
    {account.state === 'too-large' && ownedCompanionId && (
      <button className="btn btn--ghost btn--sm" onClick={() => {
        void downloadCozmlingCopy(ownedCompanionId).then(
          () => setExportNote('The device copy was downloaded.'),
          () => setExportNote('The device copy could not be downloaded. Try again.'),
        )
      }}>Export selected Cozmling’s device copy</button>
    )}
    {exportNote && <p role="status">{exportNote}</p>}
  </div>
}

/** Leaves the adoption steps as soon as the new Cozmling is in the store. */
function AdoptedWatcher({ ids, onAdopted }: { ids: string[]; onAdopted: () => void }) {
  const [before] = useState(() => new Set(ids))
  const fresh = ids.some(id => !before.has(id))
  useEffect(() => { if (fresh) onAdopted() }, [fresh, onAdopted])
  return null
}
