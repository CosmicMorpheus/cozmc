import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ArrowsClockwise, CalendarBlank, Egg, Wallet } from '@phosphor-icons/react'
import { SOCIAL } from '../../config'
import { GroveLanterns } from './GroveLanterns'
import {
  COMMUNITY_HATCH_PATH, isCommunityHatchStatus, litSigns,
  type CommunityHatchAction, type CommunityHatchReceipt, type CommunityHatchStatus,
} from './communityHatch'
import './communityHatch.css'

export type CommunityHatchWalletAction = {
  label: string
  onClick: () => void
  disabled?: boolean
}

type Props = {
  walletAddress: string | null
  walletAction?: CommunityHatchWalletAction
  canOpenEgg: (receipt: CommunityHatchReceipt) => boolean
  onOpenEgg: (receipt: CommunityHatchReceipt) => void
  onPlaceLantern?: () => Promise<void>
  lanternPlaced?: boolean
  showcaseCompanion?: { id: string; name: string }
}

type Work = 'refresh' | 'initial' | 'place' | CommunityHatchAction

/** The last shared count this page saw. Verifying or switching a wallet opens the panel afresh; until the
    event answers for the new wallet, its lanterns and count keep this one instead of going dark. */
let lastCount: { total: number; goal: number } | null = null

// a date and time that never break apart mid-way ("Nov 17, 12:00 AM UTC")
const eventDate = (value: string) => new Date(value).toLocaleString(undefined, {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
}).replace(/(\d) (?=[AP]M)/, '$1\u00a0').replace(/ (?=[A-Z]{2,5}$|GMT|UTC)/g, '\u00a0')

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
  walletAddress, walletAction, canOpenEgg, onOpenEgg, onPlaceLantern, lanternPlaced, showcaseCompanion,
}: Props) {
  const heading = useId()
  const [status, setStatus] = useState<CommunityHatchStatus>()
  const [countBefore] = useState(() => lastCount)
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
      lastCount = { total: next.total, goal: next.goal }
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
  // the twelve zodiac lanterns follow the community's shared count (dark until the event first answers)
  const count = status ?? countBefore
  const lit = count ? litSigns(count.total, count.goal) : 0

  async function copyIntroduction(name: string) {
    try {
      await navigator.clipboard.writeText(`Meet ${name}, my Cozmling from the Community Hatch!`)
      setMessage('Introduction copied. You can paste it in Discord.')
    } catch {
      setMessage('Copying is unavailable here. You can introduce your Cozmling directly in Discord.')
    }
  }

  return (
    <section className="community-hatch" aria-labelledby={heading}>
      <div className="community-hatch__scenery" aria-hidden="true" />
      <header className="community-hatch__hero">
        <img
          className="community-hatch__wordmark"
          src="/assets/cozmc-logo-272.png"
          srcSet="/assets/cozmc-logo-136.png 136w, /assets/cozmc-logo-272.png 272w, /assets/cozmc-logo-408.png 408w"
          sizes="(max-width: 560px) 108px, 172px"
          width={456}
          height={120}
          alt="COZMC"
          decoding="async"
        />
        <p className="community-hatch__kicker">Community Hatch</p>
        <h2 id={heading}>{status?.title ?? 'Light the Grove'}</h2>
      </header>
      <GroveLanterns lit={lit} />
      <div className="community-hatch__console">
        {count && (
          <div className="community-hatch__progress">
            <div>
              <p><strong>{count.total.toLocaleString()} of {count.goal.toLocaleString()}</strong> lanterns lit</p>
              <p className="community-hatch__signs" aria-hidden="true">{lit === 12 ? 'All 12 signs aglow' : `${lit} of 12 signs aglow`}</p>
            </div>
            <progress value={Math.min(count.total, count.goal)} max={count.goal} aria-label="Lantern goal" />
          </div>
        )}
        {status?.phase === 'open' && (
          <ul className="community-hatch__rules">
            <li><CalendarBlank aria-hidden="true" /><span>Light one lantern a day until <time dateTime={status.endsAt}>{eventDate(status.endsAt)}</time>.</span></li>
            <li><Egg aria-hidden="true" /><span>Your first contribution earns a mystery egg.</span></li>
            <li><ArrowsClockwise aria-hidden="true" /><span>Daily lanterns reset at midnight UTC.</span></li>
          </ul>
        )}
        <div className="community-hatch__actions">
          {status ? <>
            {status.phase === 'upcoming' && <p>The Grove opens {eventDate(status.opensAt)}.</p>}
            {status.phase === 'open' && verified && <button className="btn btn--phos" type="button" disabled={busy || status.contributedToday} onClick={() => void run('contribute')}>
              {status.contributedToday ? 'Lantern lit today' : work === 'contribute' ? 'Lighting lantern…' : 'Light a lantern'}
            </button>}
            {!verified && (status.phase === 'open' || status.phase === 'claim') && (
              <>
                <p>Connect and verify your Algorand wallet to contribute or claim an egg.</p>
                {walletAction && (
                  <div className="community-hatch__wallet">
                    <button className="btn community-hatch__cta" type="button" onClick={walletAction.onClick} disabled={walletAction.disabled}>
                      <Wallet aria-hidden="true" />
                      {walletAction.label}
                    </button>
                  </div>
                )}
              </>
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
        </div>
      </div>
    </section>
  )
}
