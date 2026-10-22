import { useChain } from '../lib/data'
import { fmt } from '../lib/format'
import { CopyBtn } from '../components/ui'
import { CommunityButtons, HaystackPanel, PactPanel, SocialIcon, socialLinks } from '../components/Community'
import { ASA_ID, CREATOR, SOCIAL } from '../config'

const ROADMAP = [
  { lvl: '1-1', name: 'Launch on Haystack', text: 'Launch COZMC and begin bringing the community together.', state: 'done' },
  { lvl: '1-2', name: 'Bond, then build', text: 'Bonding complete. COZMC now has an ALGO/COZMC liquidity pool on Pact.', state: 'done' },
  { lvl: '1-3', name: 'Grow together', text: 'Choose the games, collaborations, and real-world projects we pursue as a community.', state: 'live' },
]

const VALUES = [
  { name: 'Shared direction', line: 'Members help decide what we build, which games we make, and who we work with.' },
  { name: 'Open discussion', line: 'Different perspectives are welcome. Good ideas can come from anyone.' },
  { name: 'Builders & players', line: 'We connect game developers, builders, creators, and players in one place.' },
  { name: 'Collaboration', line: 'We make things together and give credit to the people who show up.' },
  { name: 'Algorand momentum', line: 'We support good projects across the ecosystem, not only our own.' },
  { name: 'A real voice', line: 'Everyone gets a say in where COZMC goes next.' },
]

const FAQ = [
  { q: 'How can I get involved?', a: 'Join the Discord and say hi. Share ideas, give feedback on the games, pitch collaborations, or just hang out. You don’t need to hold COZMC to be part of the community.' },
  { q: 'What is COZMC?', a: 'A community token on Algorand (ASA 3739851986) built around gaming, philosophy, and connecting good people who want to build things together.' },
  { q: 'How do I add COZMC to my wallet?', a: 'In Pera, tap “Add Asset” and search for ASA ID 3739851986. Always confirm the ID matches exactly, because anyone can create a token with a similar name.' },
  { q: 'Can the creator freeze or take back my tokens?', a: 'No. COZMC has no clawback and no freeze address, so nobody can freeze holdings or pull tokens from a wallet. The facts panel above reads this live from the chain.' },
  { q: 'Are the arcade games really free?', a: 'Yes. Play as much as you like with no wallet. Posting a score to the leaderboard costs 0.1 ALGO: in the same signature it buys COZMC on Pact and burns it in the Bonfire, so every posted run feeds the fire.' },
  { q: 'What happens when I burn COZMC?', a: 'It goes to the Bonfire, an ARC-54 app on Algorand that can receive tokens but has no way to send them. Your burn is permanent, your wish is stored in the transaction note, and you land on the Top Burners board.' },
  { q: 'Where can I trade COZMC?', a: 'COZMC launched on Haystack and now also has an ALGO/COZMC pool on Pact. If you’re new to Haystack, signing up with the COZMC invite link helps support the community through Haystack’s referral rewards.' },
]

export function About() {
  const { asset } = useChain()
  const a = asset.data
  const others = Object.entries(SOCIAL).filter(([k, v]) => v && k !== 'discord' && k !== 'x')
  const links = socialLinks()
  return (
    <>
      <header className="page-head">
        <h1>About us</h1>
        <p>Who we are, what we care about, and how you can be part of it.</p>
      </header>

      <section className="manifesto" aria-labelledby="manifesto-h">
        <h2 id="manifesto-h" className="manifesto__title">COZMC is about all of us.</h2>
        <div className="manifesto__body">
          <p>COZMC isn’t about one person or one idea. It’s about bringing together people who believe we can build something better through collaboration, creativity, and open conversation.</p>
          <p>We’re starting with gaming, community engagement, and supporting projects across Algorand. Where we go from here hasn’t been decided yet. That’s something we’ll figure out together.</p>
          <p className="manifesto__big">Every voice matters. Every contribution counts. This is just the beginning.</p>
        </div>
      </section>

      <section className="principles" aria-labelledby="values-h">
        <h2 id="values-h" className="sub-h">What we care about</h2>
        <ul>{VALUES.map(v => <li key={v.name}><b>{v.name}</b><span>{v.line}</span></li>)}</ul>
      </section>

      <section className="join" id="community" aria-labelledby="join-h">
        <div>
          <h2 id="join-h">Pull up a chair</h2>
          <p>Our Discord is where the real conversations happen: ideas, feedback, collabs, and plans for what comes next. Come say hi, even if you only want to listen for a while.</p>
          {links.length ? <div className="row"><CommunityButtons /></div> : <p className="muted">Community links are coming soon.</p>}
        </div>
        <ul className="join__ways">
          <li><b>Share an idea</b><span>Pitch a game, a feature, or a collab.</span></li>
          <li><b>Play &amp; give feedback</b><span>Tell us what’s fun and what’s broken.</span></li>
          <li><b>Build with us</b><span>Devs, artists, and creators are all welcome.</span></li>
          <li><b>Bring a friend</b><span>Communities grow one person at a time.</span></li>
        </ul>
      </section>

      <h2 className="sub-h">The ecosystem</h2>
      <div className="ecosystem"><HaystackPanel /><PactPanel /></div>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>On-chain facts</h2><span className={`live${a ? ' is-live' : ''}`}>{a ? 'Live' : asset.error ? 'Offline' : 'Loading'}</span></header>
          <dl className="facts">
            <div><dt>Asset name</dt><dd>{a?.name ?? 'COZMC: Community & Philosophy'}</dd></div>
            <div><dt>Unit / ID</dt><dd>{a?.unit ?? 'COZMC'} · {ASA_ID}</dd></div>
            <div><dt>Supply</dt><dd>{fmt(a?.total ?? 1e9)}</dd></div>
            <div><dt>Decimals</dt><dd>{a?.decimals ?? 6}</dd></div>
            <div><dt>Clawback</dt><dd className={a?.clawback ? '' : 'ok'}>{a?.clawback ? 'Set' : 'None'}</dd></div>
            <div><dt>Freeze</dt><dd className={a?.freeze ? '' : 'ok'}>{a?.freeze ? 'Set' : 'None'}</dd></div>
          </dl>
          <p className="small muted" style={{ marginTop: 16 }}>Creator &amp; manager</p>
          <code className="addr">{a?.creator ?? CREATOR}</code>
          <CopyBtn text={a?.creator ?? CREATOR} what="Creator address" label="Copy address" />
        </div>
        <div className="stack">
          <div className="panel">
            <h2 className="panel__h">Verify it yourself</h2>
            <ul className="links">
              <li><a href={`https://explorer.perawallet.app/asset/${ASA_ID}/`} target="_blank" rel="noopener">Pera Explorer <span>asset page &amp; holders</span> ↗</a></li>
              <li><a href={`https://allo.info/asset/${ASA_ID}/token`} target="_blank" rel="noopener">Allo <span>block explorer</span> ↗</a></li>
              <li><a href="https://hay.app/" target="_blank" rel="noopener">Haystack <span>price &amp; charts</span> ↗</a></li>
            </ul>
          </div>
        </div>
      </section>

      <h2 className="sub-h">World map</h2>
      <ol className="world">
        {ROADMAP.map(r => (
          <li key={r.lvl} className={`world__lvl is-${r.state}`}>
            <span className="world__tag">{r.state === 'done' ? 'Cleared' : r.state === 'live' ? 'Now playing' : r.state === 'next' ? 'Next' : 'Locked'}</span>
            <span className="world__num">World {r.lvl}</span>
            <h3>{r.name}</h3>
            <p>{r.text}</p>
          </li>
        ))}
      </ol>

      <section className="founder">
        <h2 className="sub-h">How it started</h2>
        <div className="founder__body">
          <p className="founder__big">“I’m here to get things started. We decide what comes next.”</p>
          <p>COZMC was launched by Markus, who loves gaming, philosophy, and good vibes. He lit the first spark, but this was never meant to be one person’s project. The goal is to grow the Algorand network together and build a steady, trustworthy place to ask questions, find good collaborators, and get honest, useful advice.</p>
          <p className="founder__sig">— Markus, on behalf of all of us</p>
        </div>
      </section>

      <h2 className="sub-h">Questions</h2>
      <div className="faq">
        {FAQ.map(f => <details key={f.q}><summary>{f.q}<span className="pm" aria-hidden="true" /></summary><p>{f.a}</p></details>)}
      </div>

      <h2 className="sub-h">Official channels</h2>
      {links.length || others.length ? (
        <div className="row">
          {links.map(l => <a key={l.id} className="btn btn--ghost" href={l.url} target="_blank" rel="noopener"><SocialIcon name={l.id} size={16} /> {l.name} ↗</a>)}
          {others.map(([k, v]) => <a key={k} className="btn btn--ghost" href={k === 'email' ? `mailto:${v}` : v} target="_blank" rel="noopener">{k[0].toUpperCase() + k.slice(1)} ↗</a>)}
        </div>
      ) : <p className="muted">Community links are coming soon.</p>}
      <p className="small muted" style={{ marginTop: 14 }}>These are the only official COZMC channels. Nobody from the team will DM you first or ask for your seed phrase.</p>
    </>
  )
}
