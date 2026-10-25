import { useRef, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { GAMES } from '../arcade/games'
import { useChain } from '../lib/data'
import { gameBoard } from '../lib/boards'
import { TIERS, nextTier, tierOf } from '../lib/tiers'
import { compact, fmt, short } from '../lib/format'
import { useNfd } from '../lib/nfd'
import { ACHIEVEMENTS, liveStreak, unlock, useProfile } from '../lib/profile'
import { playerShare } from '../lib/sharePayloads'
import { useHoloTilt } from '../components/HoloCard'
import { Medal, PixelArt } from '../components/Pixel'
import { useMe } from '../components/Wallet'
import { ShareBtn } from '../components/Share'
import { ASA_ID, HAYSTACK_INVITE } from '../config'
import type { TabId } from '../App'

/** How loud the foil is, Stardust → Black Hole. */
const FOIL = [0.14, 0.26, 0.4, 0.58, 0.8, 1]

export function Card({ go }: { go: (t: TabId, sub?: string) => void }) {
  const { activeAddress } = useWallet()
  const { holding: balance, openConnect } = useMe()   // wallet + LP + farms
  const { holders, burns, scores } = useChain()
  const profile = useProfile()
  const nfd = useNfd(activeAddress)
  const ref = useRef<HTMLButtonElement>(null)
  const [flipped, setFlipped] = useState(false)
  useHoloTilt(ref)

  const tier = tierOf(activeAddress ? balance ?? 0 : 0)
  const tierNo = TIERS.indexOf(tier)
  const nt = activeAddress && balance != null ? nextTier(tier) : null
  const ranked = (holders.data ?? []).filter(h => !h.excluded)
  const rank = activeAddress ? ranked.findIndex(h => h.address === activeAddress) + 1 : 0
  const burned = activeAddress ? (burns.data ?? []).filter(b => b.sender === activeAddress).reduce((s, b) => s + b.amount, 0) : 0
  const bests = GAMES.map(g => {
    const chain = activeAddress ? gameBoard(g, scores.data ?? []).find(r => r.player === activeAddress)?.score ?? 0 : 0
    return { game: g, best: Math.max(chain, profile.best[g.id] ?? 0), onChain: chain > 0 && chain >= (profile.best[g.id] ?? 0) }
  })
  const streak = liveStreak(profile)
  const earned = ACHIEVEMENTS.filter(a => profile.achievements[a.id])
  const name = activeAddress ? nfd ?? short(activeAddress, 5) : 'Guest player'

  const stats: [string, string][] = [
    ['Holding', activeAddress && balance != null ? compact(balance) : '—'],
    ['Rank', rank ? `#${rank}` : '—'],
    ['Burned', burned ? compact(burned) : '0'],
    ['Streak', streak ? `${streak} day${streak === 1 ? '' : 's'}` : '0'],
    ...bests.map(b => [b.game.title, b.best ? compact(b.best) : '—'] as [string, string]),
  ]

  return (
    <>
      <header className="page-head">
        <h1>Your card</h1>
        <p>Your tier, your runs, your fire, on one card. It levels up as you hold, play and burn. Badges live in this browser; tier, rank and burns come from the chain.</p>
      </header>

      <section className="pcard-wrap">
        <div className="pcard-stage">
          <button ref={ref} className={`holo pcard${flipped ? ' is-flipped' : ''}${tier.id === 'blackhole' ? ' pcard--bh' : ''}`}
            style={{ ['--tc' as string]: tier.color, ['--fk' as string]: FOIL[tierNo] }}
            onClick={() => setFlipped(f => !f)} aria-pressed={flipped}
            aria-label={flipped ? 'Your badges. Press to flip back.' : `${name}, ${tier.name} tier. Press to flip and see badges.`}>
            <span className="holo__tilt"><span className="holo__flip">
              <span className="holo__face holo__front pcard__face">
                <span className="pcard__top"><span>COZMC</span><span>Player card</span></span>
                <span className="pcard__window">
                  <PixelArt rows={tier.art} palette={{ a: tier.palette[0], b: tier.palette[1], c: tier.palette[2] }} size={160} className="pcard__art" />
                </span>
                <span className="pcard__name">{name}</span>
                <span className="pcard__tier">{tier.name}{rank > 0 && <em> · #{rank} of {ranked.length}</em>}</span>
                <span className="pcard__stats">
                  {stats.map(([k, v]) => <span key={k}><b>{k}</b><span>{v}</span></span>)}
                </span>
                <span className="pcard__foot"><span>{earned.length}/{ACHIEVEMENTS.length} badges</span><span>ASA {ASA_ID}</span></span>
                <span className="holo__shine" /><span className="holo__glitter" /><span className="holo__glare" />
              </span>
              <span className="holo__face holo__back pcard__face pcard__back">
                <span className="pcard__top"><span>Badges</span><span>{earned.length}/{ACHIEVEMENTS.length}</span></span>
                <span className="pcard__medals">
                  {ACHIEVEMENTS.map(a => <span key={a.id}><Medal kind={a.kind} locked={!profile.achievements[a.id]} size={40} /></span>)}
                </span>
                <span className="pcard__foot"><span>{name}</span><span>{tier.name}</span></span>
                <span className="holo__shine" /><span className="holo__glare" />
              </span>
            </span></span>
          </button>
          <p className="hint">Move to tilt · click to flip</p>
        </div>

        <div className="pcard-side">
          {!activeAddress ? (
            <div className="panel pcard-cta">
              <p>You’re playing as a guest. Your bests and badges are saved in this browser.</p>
              <p className="muted small">Connect a wallet to put your tier, holder rank and burns on the card, and to unlock tier skins in the arcade.</p>
              <button className="btn btn--phos" onClick={openConnect}>Connect wallet</button>
            </div>
          ) : (
            <div className="panel">
              <header className="panel__head"><h2>{tier.name}</h2><span className="muted small">{balance != null ? `${fmt(balance)} COZMC` : '…'}</span></header>
              {nt && balance != null ? (
                <div className="xp" aria-label={`Progress to ${nt.name}`}>
                  <div className="xp__bar"><i style={{ width: `${Math.min(100, ((balance - tier.min) / (nt.min - tier.min)) * 100)}%`, background: nt.color }} /></div>
                  <p className="xp__txt">{fmt(nt.min - balance)} more to <b style={{ color: nt.color }}>{nt.name}</b>: brighter foil and the {nt.name} skin in every game.</p>
                </div>
              ) : <p className="small">Top of the ladder. The whole cosmos is yours.</p>}
              {balance === 0 && <p className="small"><a href={HAYSTACK_INVITE} target="_blank" rel="noopener">Get COZMC on Haystack ↗</a></p>}
            </div>
          )}

          <div className="panel">
            <header className="panel__head"><h2>Personal bests</h2><button className="link" onClick={() => go('arcade')}>Arcade</button></header>
            <ul className="pb-list">
              {bests.map(b => (
                <li key={b.game.id}><span>{b.game.title}</span><b>{b.best ? fmt(b.best) : '—'}</b><em>{b.onChain ? 'on-chain' : b.best ? 'this browser' : ''}</em></li>
              ))}
              <li><span>Daily streak</span><b>{streak}</b><em>best {profile.streak.best}</em></li>
            </ul>
          </div>

          <div className="row">
            <ShareBtn label="Share my card" className="btn btn--phos" make={() => {
              unlock('show-off')
              return playerShare({ name, tier, tierNo, stats, badges: earned.length, total: ACHIEVEMENTS.length, kinds: earned.map(a => a.kind), streak })
            }} />
          </div>
        </div>
      </section>

      <section className="badges" aria-labelledby="badges-title">
        <header className="section-head"><h2 id="badges-title">Badges</h2><p className="muted">{earned.length} of {ACHIEVEMENTS.length} earned</p></header>
        <ul className="badges__grid">
          {ACHIEVEMENTS.map(a => {
            const at = profile.achievements[a.id]
            return (
              <li key={a.id} className={at ? 'is-on' : ''}>
                <Medal kind={a.kind} locked={!at} size={40} />
                <div>
                  <p className="badge__name">{a.secret && !at ? '???' : a.name}</p>
                  <p className="badge__desc">{a.secret && !at ? 'A secret. Old-school gamers will find it.' : a.desc}</p>
                  {at && <p className="badge__when">{new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}
