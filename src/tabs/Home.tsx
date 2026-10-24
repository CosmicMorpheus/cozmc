import { lazy, Suspense } from 'react'
import { HoloCard } from '../components/HoloCard'
import { CopyBtn } from '../components/ui'
import { Icon } from '../components/Pixel'
import { useChain } from '../lib/data'
import { compact, fmt } from '../lib/format'
import { GAMES } from '../arcade/games'
import { ASA_ID, HAYSTACK_INVITE } from '../config'
import type { TabId } from '../App'
import { GiveawayBanner } from '../components/GiveawayStrip'
import { GameThumb } from '../components/GameThumb'
import { CommunityButtons, HaystackPanel, PactPanel, SocialIcon, socialLinks } from '../components/Community'
import { dailyNo } from '../lib/daily'

// the Cozmling art loads with its own chunk, after the page is up
const Spotlight = lazy(() => import('../companion/Spotlight').then(m => ({ default: m.Spotlight })))

export function Home({ go, onBurn }: { go: (t: TabId, sub?: string) => void; onBurn: () => void }) {
  const { holders, burned, scores, round } = useChain()
  const ranked = (holders.data ?? []).filter(h => !h.excluded)
  const players = new Set((scores.data ?? []).map(s => s.player)).size
  const runs = (scores.data ?? []).length
  const discord = socialLinks()[0]

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <p className="kicker"><span className="dot" /> ASA {ASA_ID} {round && <span className="hide-sm">· Round {fmt(round)}</span>}</p>
          <h1 className="hero__title">Find your people.<br />Build with purpose.</h1>
          <p className="hero__lead">COZMC is a community on Algorand made up of players, builders, and creators. We start with games and good conversation. What it turns into is something we decide together.</p>
          <div className="row">
            {discord && <a className="btn btn--discord" href={discord.url} target="_blank" rel="noopener"><SocialIcon name="discord" size={16} /> Join our community</a>}
            <button className="btn btn--phos" onClick={() => go('arcade')}><Icon name="play" size={10} /> Play the arcade</button>
            <a className="btn btn--ghost" href={HAYSTACK_INVITE} target="_blank" rel="noopener">Get COZMC ↗</a>
          </div>
          <div className="asa"><span>ASA ID</span><code>{ASA_ID}</code><CopyBtn text={String(ASA_ID)} what="ASA ID" /></div>
        </div>
        <div className="hero__card"><HoloCard /><p className="hint">Move to tilt · click to flip</p></div>
      </section>

      <GiveawayBanner />

      <Suspense fallback={<div className="spot spot--wait" aria-hidden="true" />}><Spotlight /></Suspense>

      <section className="paths" aria-label="Start here">
        <a className="path path--join" href={discord?.url ?? '#/about'} target={discord ? '_blank' : undefined} rel="noopener">
          <span className="path__n">01</span>
          <h2>Join the community</h2>
          <p>Hang out on Discord{socialLinks().some(l => l.id === 'x') ? ' and X' : ''}, jump into discussions, and help shape where we go next.</p>
          <span className="path__go">{discord ? 'Open Discord ↗' : 'Find us'}</span>
        </a>
        <a className="path path--play" href="#/arcade">
          <span className="path__n">02</span>
          <h2>Explore the arcade</h2>
          <p>{GAMES.length} free games, a fresh daily challenge, and on-chain leaderboards. No wallet needed to play.</p>
          <span className="path__go">Pick a game →</span>
        </a>
        <a className="path path--why" href="#/about">
          <span className="path__n">03</span>
          <h2>Discover our mission</h2>
          <p>What COZMC is about, why it’s about all of us, and how anyone can pitch in.</p>
          <span className="path__go">Read more →</span>
        </a>
      </section>

      <section className="shelf" aria-labelledby="shelf-h">
        <header className="shelf__head">
          <h2 id="shelf-h" className="sub-h">The COZMC Arcade</h2>
          <a className="link" href="#/arcade">All games &amp; details →</a>
        </header>
        <ul className="shelf__games">
          {GAMES.map(g => (
            <li key={g.id} className="shelf__game">
              <button className="shelf__screen" onClick={() => go('arcade', g.id)} aria-label={`Play ${g.title}`}>
                <GameThumb game={g} />
                <span className="cab__attract" aria-hidden="true">Press start</span>
              </button>
              <h3>{g.title}</h3>
              <p>{g.tagline}</p>
              <div className="row">
                <button className="btn btn--phos btn--sm" onClick={() => go('arcade', g.id)}><Icon name="play" size={9} /> Play</button>
                <button className="btn btn--ghost btn--sm" onClick={() => go('arcade', `${g.id}/daily`)}>Daily #{dailyNo()}</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="scoreboard" aria-label="Live numbers">
        <button onClick={() => go('community', 'holders')}><span className="sb__num">{holders.data ? ranked.length : '…'}</span><span className="sb__lbl">Holders</span></button>
        <button onClick={() => go('community', 'bonfire')}><span className="sb__num sb__num--fire">{burned.data != null ? compact(burned.data) : '…'}</span><span className="sb__lbl">COZMC burned</span></button>
        <button onClick={() => go('arcade', 'boards')}><span className="sb__num">{scores.data ? players : '…'}</span><span className="sb__lbl">{players === 1 ? 'Arcade player' : 'Arcade players'}</span></button>
        <button onClick={() => go('arcade', 'boards')}><span className="sb__num">{scores.data ? runs : '…'}</span><span className="sb__lbl">{runs === 1 ? 'Run on-chain' : 'Runs on-chain'}</span></button>
      </section>


      <section className="together" aria-labelledby="together-h">
        <div className="together__copy">
          <p className="kicker"><span className="dot" /> Community</p>
          <h2 id="together-h" className="together__title">COZMC is about all of us.</h2>
          <p>It isn’t about one person or one idea. It’s about people who think we can build something better by working together, getting creative, and talking openly.</p>
          <p>Where we go from here hasn’t been decided yet. We’ll figure that out together, and every voice counts.</p>
          <div className="row">
            <CommunityButtons />
            <button className="btn btn--ghost" onClick={() => go('about')}>Our mission →</button>
          </div>
        </div>
        <div className="stack"><HaystackPanel /><PactPanel /></div>
      </section>
    </>
  )
}
