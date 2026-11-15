import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { SOCIAL } from '../../config'
import {
  COMMUNITY_HATCH_PATH, isCommunityHatchStatus,
  type CommunityHatchAction, type CommunityHatchReceipt, type CommunityHatchStatus,
} from './communityHatch'
import './communityHatch.css'

type Props = {
  walletAddress: string | null
  canOpenEgg: (receipt: CommunityHatchReceipt) => boolean
  onOpenEgg: (receipt: CommunityHatchReceipt) => void
  onPlaceLantern?: () => Promise<void>
  lanternPlaced?: boolean
  showcaseCompanion?: { id: string; name: string }
}

type Work = 'refresh' | 'initial' | 'place' | CommunityHatchAction

const eventDate = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
})

async function fetchHatch(signal: AbortSignal, address: string | null, action?: CommunityHatchAction) {
  const headers = new Headers()
  if (address) headers.set('X-COZMC-Wallet', address)
  if (action) headers.set('Content-Type', 'application/json')
  const response = await fetch(COMMUNITY_HATCH_PATH, {
    method: action ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers,
    ...(action ? { body: JSON.stringify({ action }) } : {}),
  })
  if (response.status === 404 && !action) return null
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = value && typeof value === 'object' && 'error' in value ? value.error : undefined
    if (code === 'pilot_full') throw new Error('The Grove has reached capacity for this preview.')
    if (response.status === 401) throw new Error('Verify your Algorand wallet again to take part.')
    if (response.status === 409) throw new Error('The event status changed. Refresh to see what you can do now.')
    if (response.status === 429 || response.status === 503) throw new Error('The Grove is busy. Give it a moment and try again.')
    throw new Error('The Grove could not load. Please try again.')
  }
  if (!isCommunityHatchStatus(value)) throw new Error('The Grove could not load. Please try again.')
  if ((value.authenticatedWallet && value.authenticatedWallet !== address)
    || (action && value.authenticatedWallet !== address)) throw new Error('Verify your Algorand wallet again to take part.')
  return value
}

export function CommunityHatchPanel(props: Props) {
  return <WalletHatchPanel key={props.walletAddress ?? 'visitor'} {...props} />
}

function WalletHatchPanel({
  walletAddress, canOpenEgg, onOpenEgg, onPlaceLantern, lanternPlaced, showcaseCompanion,
}: Props) {
  const heading = useId()
  const [status, setStatus] = useState<CommunityHatchStatus>()
  const [work, setWork] = useState<Work | null>(null)
  const [hidden, setHidden] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const phase = status?.phase

  const run = useCallback(async (kind: Work, place?: () => Promise<void>) => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setWork(kind)
    if (kind !== 'refresh') setError('')

    try {
      if (kind === 'place') {
        if (!place) return
        await place()
        if (!controller.signal.aborted) setMessage('Your lantern is in the Star Loft.')
        return
      }
      const action = kind === 'claim' || kind === 'contribute' ? kind : undefined
      const next = await fetchHatch(controller.signal, walletAddress, action)
      if (controller.signal.aborted) return
      setHidden(next === null)
      if (!next) return
      setStatus(next)
      setError('')
      if (action === 'contribute') setMessage('Your lantern is lit in the Grove.')
      if (action === 'claim') setMessage('Your mystery egg is ready to adopt.')
    } catch (cause) {
      if (!controller.signal.aborted && kind !== 'refresh') {
        setError(cause instanceof Error ? cause.message : 'Please try again.')
      }
    } finally {
      if (request.current === controller) {
        request.current = null
        setWork(null)
      }
    }
  }, [walletAddress])

  useEffect(() => {
    void run('initial')
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [run])

  useEffect(() => {
    if (!phase || hidden || phase === 'ended') return
    function refreshVisible() {
      if (document.visibilityState === 'visible') void run('refresh')
    }
    const timer = window.setInterval(refreshVisible, 45_000)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [hidden, phase, run])

  if (hidden) return null
  const busy = work !== null
  const verified = Boolean(walletAddress && status?.authenticatedWallet === walletAddress)
  const receipt = verified ? status?.receipt : null
  const showcaseName = receipt?.companionId === showcaseCompanion?.id ? showcaseCompanion?.name : undefined
  const litLanterns = status?.total ? Math.max(1, Math.min(12, Math.floor(status.total / status.goal * 12))) : 0

  async function copyIntroduction(name: string) {
    try {
      await navigator.clipboard.writeText(`Meet ${name}, my Cozmling from the Community Hatch!`)
      setMessage('Introduction copied. You can paste it in Discord.')
    } catch {
      setMessage('Copying is unavailable here. You can introduce your Cozmling directly in Discord.')
    }
  }

  return (
    <section className="community-hatch panel" aria-labelledby={heading}>
      <p className="kicker">Community Hatch</p>
      <h2 id={heading}>{status?.title ?? 'Light the Grove'}</h2>
      {status ? <>
        <div className="community-hatch__grove" aria-hidden="true">
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} data-lit={index < litLanterns} />
          ))}
        </div>
        <progress value={Math.min(status.total, status.goal)} max={status.goal} aria-label="Lantern goal" />
        <p>{status.total.toLocaleString()} of {status.goal.toLocaleString()} lanterns lit</p>
        {status.phase === 'upcoming' && <p>The Grove opens {eventDate(status.opensAt)}.</p>}
        {status.phase === 'open' && <>
          <p>Light one lantern a day until {eventDate(status.endsAt)}. Your first contribution earns a mystery egg. Daily lanterns reset at midnight UTC.</p>
          {verified && <button className="btn btn--phos" type="button" disabled={busy || status.contributedToday} onClick={() => void run('contribute')}>
            {status.contributedToday ? 'Lantern lit today' : work === 'contribute' ? 'Lighting lantern…' : 'Light a lantern'}
          </button>}
        </>}
        {!verified && (status.phase === 'open' || status.phase === 'claim') && (
          <p>Connect and verify your Algorand wallet to contribute or claim an egg.</p>
        )}
        {status.phase === 'claim' && verified && status.eligible && !receipt && <>
          <p>Claim your mystery egg by {eventDate(status.claimUntil)}.</p>
          <button className="btn btn--phos" type="button" disabled={busy} onClick={() => void run('claim')}>
            {work === 'claim' ? 'Claiming egg…' : 'Claim my mystery egg'}
          </button>
        </>}
        {status.phase === 'claim' && verified && !status.eligible && <p>Wallets that contributed can now claim their eggs.</p>}
        {status.phase === 'ended' && !receipt && <p>The egg claim window has closed.</p>}
        {receipt && (canOpenEgg(receipt) ? (
          <button className="btn btn--phos" type="button" disabled={busy} onClick={() => onOpenEgg(receipt)}>Adopt my mystery egg</button>
        ) : <p>Your mystery egg has been added to your companions.</p>)}
        {verified && status.lanternEligible && (
          lanternPlaced ? <p>Your Grove lantern is in this Star Loft.</p> : onPlaceLantern ? (
            <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => void run('place', onPlaceLantern)}>Place Grove lantern</button>
          ) : <p>Your Grove lantern is ready. Open a hatched Cozmling’s Star Loft to place it.</p>
        )}
        {verified && status.eligible && (status.phase === 'claim' || status.phase === 'ended') && SOCIAL.discord && (
          <div>
            <a href={SOCIAL.discord} target="_blank" rel="noreferrer">Join the hatchling showcase in Discord</a>
            {' '}
            {showcaseName && <button className="btn btn--ghost" type="button" onClick={() => void copyIntroduction(showcaseName)}>Copy hatchling introduction</button>}
          </div>
        )}
      </> : !error && <p>Checking the Grove…</p>}
      {error && <>
        <p role="alert">{error}</p>
        <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => void run('initial')}>Refresh the Grove</button>
      </>}
      <p className="community-hatch__status" role="status">{message}</p>
    </section>
  )
}
