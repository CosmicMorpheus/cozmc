import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { BurnBar, BurnModal } from './components/Burn'
import { WalletButton } from './components/Wallet'
import { Icon, ICONS } from './components/Pixel'
import { Starfield } from './components/Starfield'
import { MusicButton } from './components/Music'
import { Ticker } from './components/Ticker'
import { Unlocks } from './components/Unlocks'
import { InstallButton } from './components/Install'
import { CommunityButtons, PactButton, Social } from './components/Community'
import { Home } from './tabs/Home'
import { ASA_ID, HAYSTACK_INVITE } from './config'
import { GAMES } from './arcade/games'
import { unlock } from './lib/profile'
import { sfx } from './arcade/sfx'

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

// every tab but Home loads on first visit
const Companion = lazy(() => import('./tabs/Companion').then(m => ({ default: m.Companion })))
const Arcade = lazy(() => import('./tabs/Arcade').then(m => ({ default: m.Arcade })))
const Leaderboard = lazy(() => import('./tabs/Leaderboard').then(m => ({ default: m.Leaderboard })))
const Holders = lazy(() => import('./tabs/Holders').then(m => ({ default: m.Holders })))
const Card = lazy(() => import('./tabs/Card').then(m => ({ default: m.Card })))
const Giveaway = lazy(() => import('./tabs/Giveaway').then(m => ({ default: m.Giveaway })))
const Philosophy = lazy(() => import('./tabs/Philosophy').then(m => ({ default: m.Philosophy })))
const Bonfire = lazy(() => import('./tabs/Bonfire').then(m => ({ default: m.Bonfire })))
const About = lazy(() => import('./tabs/About').then(m => ({ default: m.About })))

export type TabId = 'home' | 'cozmling' | 'arcade' | 'community' | 'about'
type IconName = keyof typeof ICONS
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'cozmling', label: 'Cozmling', icon: 'cozmling' },
  { id: 'arcade', label: 'Arcade', icon: 'arcade' },
  { id: 'community', label: 'Community', icon: 'holders' },
  { id: 'about', label: 'About', icon: 'about' },
]

/* Arcade and Community each hold a few pages under one tab. '' is the section's front page. */
type Section = { id: string; label: string; icon: IconName }
const SECTIONS: Partial<Record<TabId, Section[]>> = {
  arcade: [
    { id: '', label: 'Games', icon: 'arcade' },
    { id: 'boards', label: 'Leaderboards', icon: 'leaderboard' },
    { id: 'giveaway', label: 'Giveaway', icon: 'gift' },
    { id: 'card', label: 'Your card', icon: 'card' },
  ],
  community: [
    { id: 'holders', label: 'Holders', icon: 'holders' },
    { id: 'bonfire', label: 'Bonfire', icon: 'fire' },
    { id: 'wisdom', label: 'Wisdom', icon: 'philosophy' },
  ],
}
/* links from before the restructure still land in the right place */
const MOVED: Record<string, string> = { leaderboard: 'arcade/boards', giveaway: 'arcade/giveaway', card: 'arcade/card', holders: 'community/holders', philosophy: 'community/wisdom' }

/* #/arcade/moon-bounce/daily → { tab: 'arcade', sub: 'moon-bounce', extra: 'daily' } */
function parse(): { tab: TabId; sub: string | null; extra: string | null } {
  let [t, sub, extra] = location.hash.replace(/^#\/?/, '').split('/')
  if (MOVED[t]) { history.replaceState(null, '', `#/${MOVED[t]}`); [t, sub] = MOVED[t].split('/'); extra = '' }
  const tab = (TABS.some(x => x.id === t) ? t : 'home') as TabId
  return { tab, sub: sub || (tab === 'community' ? 'holders' : null), extra: extra || null }
}
/** The section page a route is on ('' for the Arcade floor and the games themselves). */
const pageOf = (tab: TabId, sub: string | null) => SECTIONS[tab]?.find(s => s.id && s.id === sub)?.id ?? ''

function SubNav({ tab, active }: { tab: TabId; active: string }) {
  const items = SECTIONS[tab]
  if (!items) return null
  return (
    <nav className="subnav" aria-label={`${TABS.find(t => t.id === tab)?.label} pages`}>
      <div className="subnav__links">
        {items.map(s => (
          <a key={s.id} href={`#/${tab}${s.id ? `/${s.id}` : ''}`} aria-current={active === s.id ? 'page' : undefined}>
            <Icon name={s.icon} size={11} /><span>{s.label}</span>
          </a>
        ))}
      </div>
      {tab === 'community' && <div className="subnav__extra"><CommunityButtons size="sm" /></div>}
    </nav>
  )
}

const SITEMAP: [string, string][] = [
  ['cozmling', 'Cozmling'], ['arcade', 'Arcade'], ['arcade/boards', 'Leaderboards'], ['arcade/giveaway', 'Giveaway'], ['arcade/card', 'Your card'],
  ['community/holders', 'Holders'], ['community/bonfire', 'Bonfire'], ['community/wisdom', 'Wisdom'], ['about', 'About'],
]

export function App() {
  const [route, setRoute] = useState(parse)
  const [burnOpen, setBurnOpen] = useState(false)
  useEffect(() => {
    const on = () => { setRoute(parse()); window.scrollTo({ top: 0 }) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const go = useCallback((t: TabId, sub?: string) => { location.hash = `#/${t}${sub ? `/${sub}` : ''}` }, [])
  const openBurn = useCallback(() => setBurnOpen(true), [])
  useEffect(() => { if (import.meta.env.DEV && location.search.includes('legend')) setBurnOpen(true) }, [])

  // the browser tab says where you are
  useEffect(() => {
    const game = route.tab === 'arcade' && route.sub ? GAMES.find(g => g.id === route.sub) : null
    const page = SECTIONS[route.tab]?.find(s => s.id && s.id === route.sub)
    const label = page?.label ?? TABS.find(t => t.id === route.tab)?.label
    document.title = game ? `${game.title} | COZMC Arcade` : route.tab === 'home' ? 'COZMC: community & philosophy on Algorand' : `${label} | COZMC`
  }, [route.tab, route.sub])

  // on phones the tab strip scrolls: keep the current tab in view
  const tabsRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = tabsRef.current, el = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (nav && el && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.clientWidth) / 2, behavior: 'smooth' })
  }, [route.tab])

  // ↑↑↓↓←→←→BA
  useEffect(() => {
    let i = 0
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      const k = e.key.toLowerCase()
      i = k === KONAMI[i] ? i + 1 : k === KONAMI[0] ? 1 : 0
      if (i < KONAMI.length) return
      i = 0
      document.body.classList.remove('konami'); void document.body.offsetWidth; document.body.classList.add('konami')
      setTimeout(() => document.body.classList.remove('konami'), 2600)
      ;[392, 523, 659, 784, 1046, 1318].forEach((f, n) => setTimeout(() => sfx.tone(f, 0.08, 'square', 0.04), n * 70))
      unlock('konami')
    }
    addEventListener('keydown', on)
    return () => removeEventListener('keydown', on)
  }, [])

  return (
    <>
      <Starfield />
      <a className="skip" href="#main">Skip to content</a>
      <BurnBar onBurn={openBurn} />
      <header className="top">
        <div className="wrap top__in">
          <a className="logo" href="#/home" aria-label="COZMC home"><img src="/assets/cozmc-wordmark.png" alt="COZMC" width={456} height={120} /></a>
          <nav className="tabs" aria-label="Sections" ref={tabsRef}>
            {TABS.map(t => (
              <a key={t.id} href={`#/${t.id}`} className={`tabs__tab${t.id === 'arcade' ? ' tabs__tab--arcade' : ''}${t.id === 'cozmling' ? ' tabs__tab--cz' : ''}`} aria-current={route.tab === t.id ? 'page' : undefined}>
                <Icon name={t.icon} size={13} /><span>{t.label}</span>
              </a>
            ))}
          </nav>
          <Social className="top__social" />
          <WalletButton />
        </div>
      </header>

      <Ticker />
      <div className="chan" key={`${route.tab}/${pageOf(route.tab, route.sub)}`} aria-hidden="true" />

      <main id="main" className="wrap main">
        <Suspense fallback={<p className="state state--load tab-loading"><span className="blink">▮</span> Loading…</p>}>
        <SubNav tab={route.tab} active={pageOf(route.tab, route.sub)} />
        <div className="page" key={`${route.tab}/${pageOf(route.tab, route.sub)}`}>
        {route.tab === 'home' && <Home go={go} onBurn={openBurn} />}
        {route.tab === 'cozmling' && <Companion />}
        {route.tab === 'arcade' && (
          route.sub === 'boards' ? <Leaderboard go={go} onBurn={openBurn} />
          : route.sub === 'giveaway' ? <Giveaway go={go} />
          : route.sub === 'card' ? <Card go={go} />
          : <Arcade playing={route.sub} daily={route.extra === 'daily'} setPlaying={(id, daily) => go('arcade', id ? `${id}${daily ? '/daily' : ''}` : undefined)} />
        )}
        {route.tab === 'community' && (
          route.sub === 'bonfire' ? <Bonfire onBurn={openBurn} />
          : route.sub === 'wisdom' ? <Philosophy />
          : <Holders />
        )}
        {route.tab === 'about' && <About />}
        </div>
        </Suspense>
      </main>

      <footer className="foot">
        <div className="wrap foot__in">
          <img src="/assets/cozmc-wordmark.png" alt="COZMC" width={456} height={120} className="foot__mark" loading="lazy" />
          <p className="foot__join">Built with the community, not just for it. Come say hi.</p>
          <div className="row row--center">
            <CommunityButtons size="sm" />
            <a className="btn btn--ghost btn--sm" href={HAYSTACK_INVITE} target="_blank" rel="noopener"><img src="/assets/haystack-logo.png" alt="" width={18} height={18} loading="lazy" /> Haystack ↗</a>
            <PactButton />
          </div>
          <nav className="foot__nav" aria-label="Footer">
            {SITEMAP.map(([href, label]) => <a key={href} href={`#/${href}`}>{label}</a>)}
          </nav>
          <p className="foot__meta">Community &amp; philosophy on Algorand · ASA {ASA_ID}</p>
          <InstallButton />
          <p className="foot__legal">COZMC is a community token. Nothing on this site is financial or investment advice, and no return of any kind is promised. Crypto assets are volatile and you may lose everything you put in. Always verify ASA ID {ASA_ID} before transacting and do your own research.</p>
        </div>
      </footer>

      <BurnModal open={burnOpen} onClose={() => setBurnOpen(false)} />
      <MusicButton />
      <Unlocks />
    </>
  )
}
