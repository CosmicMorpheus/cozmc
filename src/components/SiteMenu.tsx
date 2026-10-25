import { useEffect, useRef, useState } from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/ArrowRight'
import { ListIcon } from '@phosphor-icons/react/List'
import { MagnifyingGlassIcon } from '@phosphor-icons/react/MagnifyingGlass'
import { XIcon } from '@phosphor-icons/react/X'
import { GAMES } from '../arcade/games'
import { Icon, type ICONS } from './Pixel'

type Destination = {
  path: string
  label: string
  description: string
  icon: keyof typeof ICONS
  group: string
  keywords: string
}

const PAGES: Destination[] = [
  { path: 'home', label: 'Home', description: 'News from the community', icon: 'home', group: 'Start here', keywords: 'welcome news start' },
  { path: 'cozmling', label: 'Cozmling', description: 'Your cosmic companion', icon: 'cozmling', group: 'Start here', keywords: 'pet companion care feed check in check-in' },
  { path: 'arcade', label: 'Arcade', description: 'Free games & daily challenges', icon: 'arcade', group: 'Start here', keywords: 'games play daily challenge' },
  { path: 'community/holders', label: 'Community', description: 'Holders, ranks & community', icon: 'holders', group: 'Start here', keywords: 'holders rankings tiers people token balance' },
  { path: 'about', label: 'About COZMC', description: 'Our story & official links', icon: 'about', group: 'Start here', keywords: 'algorand asa discord socials contact buy pact liquidity token' },
  { path: 'arcade/boards', label: 'Leaderboards', description: 'See the scores to beat', icon: 'leaderboard', group: 'Explore more', keywords: 'scores high score rankings boards' },
  { path: 'arcade/giveaway', label: 'Weekly giveaway', description: 'Prizes, tickets & the next draw', icon: 'gift', group: 'Explore more', keywords: 'giveaway win rewards enter free ticket' },
  { path: 'arcade/card', label: 'Your card', description: 'Your profile & achievements', icon: 'card', group: 'Explore more', keywords: 'profile badges achievements unlocks' },
  { path: 'community/bonfire', label: 'Bonfire', description: 'Burn COZMC and make a wish', icon: 'fire', group: 'Explore more', keywords: 'burn fire wishes' },
  { path: 'community/wisdom', label: 'Wisdom', description: 'The philosophy behind COZMC', icon: 'philosophy', group: 'Explore more', keywords: 'philosophy ideas principles' },
]

const DESTINATIONS: Destination[] = [
  ...PAGES,
  ...GAMES.map(game => ({ path: `arcade/${game.id}`, label: game.title, description: game.tagline, icon: 'arcade' as const, group: 'Games', keywords: `play game ${game.id.replaceAll('-', ' ')}` })),
]

/** Searches the site's pages and registered games without loading other tabs or using a service. */
export function SiteMenu({ currentPath }: { currentPath: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searching = terms.length > 0
  const results = searching ? DESTINATIONS.filter(item => {
    const text = `${item.label} ${item.description} ${item.group} ${item.keywords}`.toLowerCase()
    return terms.every(term => text.includes(term))
  }).sort((a, b) => Number(b.label.toLowerCase().includes(query.trim().toLowerCase())) - Number(a.label.toLowerCase().includes(query.trim().toLowerCase()))) : PAGES

  const close = (restoreFocus = false) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) toggleRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus({ preventScroll: true })
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(true) }
    }
    const onRoute = () => close()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', onRoute)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', onRoute)
    }
  }, [open])

  function destination(item: Destination) {
    const active = currentPath === item.path
    return (
      <a key={item.path} className={`site-menu__link${item.path === 'cozmling' ? ' site-menu__link--cz' : ''}`} href={`#/${item.path}`} aria-current={active ? 'page' : undefined} onClick={() => close(true)}>
        <span className="site-menu__icon"><Icon name={item.icon} size={18} /></span>
        <span className="site-menu__copy"><span className="site-menu__label">{item.label}</span><span className="site-menu__description">{item.description}</span></span>
        <ArrowRightIcon className="site-menu__arrow" size={16} aria-hidden="true" />
      </a>
    )
  }

  return (
    <div className="site-menu" ref={rootRef} onBlur={event => {
      // A disclosure stays in the normal tab order; leaving it dismisses it.
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close()
    }}>
      <button ref={toggleRef} className="site-menu__toggle" type="button" aria-label={open ? 'Close menu and site search' : 'Open menu and site search'} aria-expanded={open} aria-controls="site-menu-panel" onClick={() => open ? close() : setOpen(true)}>
        {open ? <XIcon size={22} aria-hidden="true" /> : <ListIcon size={22} aria-hidden="true" />}
        <span>Menu</span>
      </button>
      {open && (
        <section id="site-menu-panel" className="site-menu__panel" aria-labelledby="site-menu-title">
          <div className="site-menu__heading"><h2 id="site-menu-title">Explore COZMC</h2><button type="button" className="site-menu__close" aria-label="Close navigation" onClick={() => close(true)}><XIcon size={20} aria-hidden="true" /></button></div>
          <form role="search" aria-label="Site search" className="site-menu__search" onSubmit={event => event.preventDefault()}>
            <label htmlFor="site-search">Find a page or game</label>
            <div className="site-menu__field">
              <MagnifyingGlassIcon size={20} aria-hidden="true" />
              <input ref={inputRef} id="site-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search COZMC…" autoComplete="off" spellCheck={false} aria-describedby="site-search-status" />
              {query && <button type="button" className="site-menu__clear" aria-label="Clear search" onClick={() => { setQuery(''); inputRef.current?.focus() }}><XIcon size={18} aria-hidden="true" /></button>}
            </div>
          </form>
          <p id="site-search-status" className="site-menu__status" role="status">{searching ? `${results.length} ${results.length === 1 ? 'result' : 'results'} for “${query.trim()}”` : 'Your next stop is one click away.'}</p>
          <nav aria-label={searching ? 'Site search results' : 'All site pages'} className={`site-menu__destinations${searching ? ' site-menu__destinations--results' : ''}`}>
            {searching ? results.map(destination) : ['Start here', 'Explore more'].map(group => (
              <div className="site-menu__group" key={group}><h3>{group}</h3>{results.filter(item => item.group === group).map(destination)}</div>
            ))}
          </nav>
          {searching && results.length === 0 && <div className="site-menu__empty"><p>No matches yet.</p><span>Try “arcade”, “Cozmling”, “holders”, or “philosophy”.</span><button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }}>Browse all pages <ArrowRightIcon size={16} aria-hidden="true" /></button></div>}
          <div className="site-menu__foot"><span>Community. Philosophy. Play.</span><span><kbd>Esc</kbd> to close</span></div>
        </section>
      )}
    </div>
  )
}
