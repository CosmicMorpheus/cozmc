import { CopyBtn } from './ui'
import { useChain } from '../lib/data'
import { compact } from '../lib/format'
import { HAYSTACK_INVITE, PACT_LP_ASSET, PACT_POOL_APP, PACT_URL, SOCIAL } from '../config'

/* Community links (Discord, X), shared by the header, Home, Arcade, About and footer. */
const ICON: Record<'discord' | 'x', string> = {
  discord: 'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .079.009c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029ZM8.02 15.331c-1.182 0-2.157-1.086-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418Z',
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
}

export function SocialIcon({ name, size = 18 }: { name: 'discord' | 'x'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={ICON[name]} /></svg>
}

const META = { discord: { name: 'Discord', verb: 'Join us on Discord' }, x: { name: 'X', verb: 'Follow COZMC on X' } }

/** The community links that are actually set in config, Discord first. */
export const socialLinks = () => (['discord', 'x'] as const).filter(id => SOCIAL[id]).map(id => ({ id, url: SOCIAL[id], ...META[id] }))

/** Small square icon links (header). */
export function Social({ className = '' }: { className?: string }) {
  const links = socialLinks()
  if (!links.length) return null
  return (
    <nav className={`social ${className}`} aria-label="Community">
      {links.map(l => (
        <a key={l.id} className={`social__link social__link--${l.id}`} href={l.url} target="_blank" rel="noopener" aria-label={l.verb} title={l.verb}><SocialIcon name={l.id} /></a>
      ))}
    </nav>
  )
}

/** "Join the Discord" (primary) and "Follow on X" buttons. */
export function CommunityButtons({ size }: { size?: 'sm' }) {
  return (
    <>
      {socialLinks().map((l, i) => (
        <a key={l.id} className={`btn ${i === 0 ? 'btn--discord' : 'btn--ghost'}${size ? ` btn--${size}` : ''}`} href={l.url} target="_blank" rel="noopener">
          <SocialIcon name={l.id} size={size ? 14 : 16} /> {l.id === 'discord' ? 'Join the Discord' : 'Follow on X'}
        </a>
      ))}
    </>
  )
}

export function HaystackPanel() {
  return (
    <div className="haystack">
      <a className="haystack__logo" href={HAYSTACK_INVITE} target="_blank" rel="noopener" aria-label="Open Haystack with the COZMC invite">
        <img src="/assets/haystack-logo.png" alt="Haystack logo" width={180} height={180} loading="lazy" />
      </a>
      <div className="haystack__body">
        <p className="haystack__kicker">Trade on Algorand</p>
        <h3>Explore Haystack</h3>
        <p>Haystack is the easy way to discover, buy, and trade tokens on Algorand, including COZMC. Sign up with our invite and your trades help support the community through Haystack’s referral rewards.</p>
        <div className="row">
          <a className="btn btn--hay" href={HAYSTACK_INVITE} target="_blank" rel="noopener">Join with our invite ↗</a>
          <CopyBtn text={HAYSTACK_INVITE} what="Invite link" label="Copy link" />
        </div>
      </div>
    </div>
  )
}

/** Pact.fi: add ALGO/COZMC liquidity, or stake in the COZMC farms. APRs come live from Pact. */
export function PactPanel() {
  const { farms } = useChain()
  const list = farms.data ?? []
  const rewards = [...new Set(list.flatMap(f => f.rewards))]
  const pct = (apr: number) => `${apr >= 10 ? compact(Math.round(apr * 100)) : Math.round(apr * 100)}%`
  return (
    <div className="pactp">
      <a className="pactp__logo" href={PACT_URL} target="_blank" rel="noopener" aria-label="Open Pact.fi">
        <img src="/assets/pact-logo.png" alt="Pact logo" width={200} height={200} loading="lazy" />
      </a>
      <div className="pactp__body">
        <p className="pactp__kicker">Earn on Algorand</p>
        <h3>Farm COZMC on Pact</h3>
        <p>Add ALGO/COZMC liquidity or stake COZMC on Pact.fi{rewards.length ? ` and earn ${rewards.join(' + ')}` : ''}. Staked COZMC still counts toward your rank on the Holders board.</p>
        {list.length > 0 && (
          <ul className="farms">
            {list.map(f => {
              const lp = f.stakes === PACT_LP_ASSET
              return (
                <li key={f.id}>
                  <a href={`${PACT_URL}/farm/${f.id}`} target="_blank" rel="noopener">
                    <span className="farms__name">{lp ? 'ALGO/COZMC LP farm' : 'COZMC farm'}</span>
                    <span className="farms__apr">{f.apr != null ? <>{pct(f.apr)} <small>APR</small></> : f.status === 'live' ? 'Live' : f.status}</span>
                    <span className="farms__meta">{lp ? 'Stake your LP tokens' : 'Stake COZMC'}{f.tvlUsd != null && `, $${compact(Math.round(f.tvlUsd))} staked`}</span>
                  </a>
                </li>
              )
            })}
          </ul>
        )}
        <div className="row">
          <a className="btn btn--pact" href={`${PACT_URL}/pool/${PACT_POOL_APP}?action=add`} target="_blank" rel="noopener">Add liquidity ↗</a>
          <a className="btn btn--ghost" href={`${PACT_URL}/farms`} target="_blank" rel="noopener">All farms ↗</a>
        </div>
      </div>
    </div>
  )
}

/** Small Pact.fi button, next to the Haystack one. */
export function PactButton({ className = 'btn btn--ghost btn--sm' }: { className?: string }) {
  return (
    <a className={className} href={`${PACT_URL}/pool/${PACT_POOL_APP}`} target="_blank" rel="noopener">
      <img src="/assets/pact-logo.png" alt="" width={18} height={18} loading="lazy" /> Pact.fi ↗
    </a>
  )
}
