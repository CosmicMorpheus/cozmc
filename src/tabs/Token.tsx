import type { ReactNode } from 'react'
import { useChain } from '../lib/data'
import { compact, fmt } from '../lib/format'
import { CopyBtn, Failed, Loading } from '../components/ui'
import { ASA_ID, BONFIRE_ADDRESS, BONFIRE_APP_ID, BURN_GOAL, CREATOR, DAILY_PRIZES, EXPLORER_ACCOUNT, GIVEAWAY, KNOWN_ACCOUNTS, SCORE_FEE_ALGO } from '../config'
import { dailyLive, PRIZE_START_DAY, PRIZE_TOTAL } from '../lib/dailyPrize'
import { finalDrawAt, weekStart } from '../lib/giveaway'
import { DAY_MS } from '../lib/daily'

/* Community › Token: the published facts about COZMC, read live from Algorand wherever possible.
   Only what's known: the asset's own settings, where the supply sits right now, the official
   wallets, and the dated changes. No allocation or vesting figures are claimed here. */
const date = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const pct = (part: number, total: number) => { const v = (part / total) * 100; return v > 0 && v < 0.1 ? '<0.1%' : `${v.toFixed(v < 10 ? 1 : 0)}%` }

export function Token() {
  const { asset, holders, burned, reload } = useChain()
  const a = asset.data, live = dailyLive()

  return (
    <>
      <header className="page-head">
        <h1>COZMC token</h1>
        <p>The facts about COZMC in one place, read live from Algorand wherever possible. Always check the ASA ID: anyone can make a token with a similar name.</p>
      </header>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>Token facts</h2><span className={`live${a ? ' is-live' : ''}`}>{a ? 'Live' : asset.error ? 'Offline' : 'Loading'}</span></header>
          <dl className="facts">
            <div><dt>Asset name</dt><dd>{a?.name ?? '…'}</dd></div>
            <div><dt>Unit</dt><dd>{a?.unit ?? '…'}</dd></div>
            <div><dt>ASA ID</dt><dd>{ASA_ID} <CopyBtn text={String(ASA_ID)} what="ASA ID" /></dd></div>
            <div><dt>Total supply</dt><dd>{a ? fmt(a.total) : '…'}</dd></div>
            <div><dt>Decimals</dt><dd>{a?.decimals ?? '…'}</dd></div>
            <div><dt>Clawback</dt><dd className={a && !a.clawback ? 'ok' : ''}>{a ? (a.clawback ? 'Set' : 'None') : '…'}</dd></div>
            <div><dt>Freeze</dt><dd className={a && !a.freeze ? 'ok' : ''}>{a ? (a.freeze ? 'Set' : 'None') : '…'}</dd></div>
          </dl>
          <p className="small muted tk-note">No clawback and no freeze means nobody can take COZMC from a wallet or freeze it.</p>
          <ul className="links tk-verify">
            <li><a href={`https://allo.info/asset/${ASA_ID}/token`} target="_blank" rel="noopener">Allo <span>block explorer</span> ↗</a></li>
            <li><a href={`https://explorer.perawallet.app/asset/${ASA_ID}/`} target="_blank" rel="noopener">Pera Explorer <span>asset page &amp; holders</span> ↗</a></li>
          </ul>
        </div>

        <div className="panel">
          <header className="panel__head"><h2>Where COZMC is right now</h2><span className={`live${a && holders.data ? ' is-live' : ''}`}>{a && holders.data ? 'Live' : 'Loading'}</span></header>
          {a && holders.data ? <Breakdown total={a.total} /> : (asset.error && !a) || (holders.error && !holders.data)
            ? <Failed what="the supply breakdown" retry={() => reload('all')} />
            : <Loading what="the supply breakdown" />}
        </div>
      </section>

      <section className="panel tk-panel" aria-labelledby="tk-wallets-h">
        <header className="panel__head"><h2 id="tk-wallets-h">Official wallets</h2></header>
        <ul className="tk-wallets">
          <Wallet label="Creator & manager" address={a?.creator ?? CREATOR} note={`The COZMC team's wallet. Weekly giveaway prizes ${live ? 'were' : 'are'} sent from it.`} />
          <Wallet label="Prize wallet" address={DAILY_PRIZES.payer} note="Pays the daily prizes automatically. Prizes only ever come from this wallet." />
          <Wallet label="The Bonfire" address={BONFIRE_ADDRESS} note={`Where COZMC is burned: an ARC-54 app (${BONFIRE_APP_ID}) that can receive tokens but can never send them.`} />
        </ul>
        <p className="small muted tk-note">The team will never DM you first, ask for your seed phrase, or ask you to send anything to claim a prize.</p>
      </section>

      <section className="panel tk-panel" aria-labelledby="tk-history-h">
        <header className="panel__head"><h2 id="tk-history-h">History and changes</h2></header>
        <ol className="tk-steps">
          <Step status="Done" title="Launched on Haystack">COZMC launched on Haystack.</Step>
          <Step status="Done" title="Bonding complete">COZMC now has an ALGO/COZMC liquidity pool on Pact.</Step>
          <Step status="Live" title="Every posted score burns COZMC">Posting an arcade score costs {SCORE_FEE_ALGO} ALGO. In the same transaction it buys COZMC on Pact and burns it in the Bonfire.</Step>
          <Step status={burned.data != null && burned.data >= BURN_GOAL.amount ? 'Reached' : 'Live'} title="Community burn goal">
            {compact(BURN_GOAL.amount)} COZMC burned together {BURN_GOAL.reward}.{burned.data != null && <> {compact(burned.data)} burned so far.</>}
          </Step>
          <Step status={live ? 'Ended' : 'Final week'} when={`${date(weekStart(1))} to ${date(finalDrawAt())}`} title="Weekly giveaway">
            {compact(GIVEAWAY.prize)} COZMC a week for {GIVEAWAY.lastWeek} weeks, drawn on-chain every Monday at 00:00 UTC and sent by the team. <a href="#/arcade/giveaway">Draws and winners</a>
          </Step>
          <Step status={live ? 'Live' : 'Starts soon'} when={`From ${date(PRIZE_START_DAY * DAY_MS)}`} title="Daily prizes">
            {fmt(PRIZE_TOTAL)} COZMC every day ({DAILY_PRIZES.prizes.map(fmt).join(' / ')}) for the top three Daily Challenge scores, paid automatically from the prize wallet. <a href="#/arcade/prizes">Board and rules</a>
          </Step>
        </ol>
      </section>

      <p className="fineprint">COZMC is a community token. Nothing on this page is financial or investment advice, and no return of any kind is promised.</p>
    </>
  )
}

/** The supply split by where it sits now: live balances, so it always adds up to the total. */
function Breakdown({ total }: { total: number }) {
  const { holders, burned } = useChain()
  const bal = (addr: string) => holders.data?.find(h => h.address === addr)?.wallet ?? 0
  const pools = Object.entries(KNOWN_ACCOUNTS).filter(([addr, k]) => k.exclude && addr !== BONFIRE_ADDRESS).reduce((s, [addr]) => s + bal(addr), 0)
  const creator = bal(CREATOR), prize = bal(DAILY_PRIZES.payer), gone = burned.data ?? bal(BONFIRE_ADDRESS)
  const rows = [
    { key: 'community', label: 'Community wallets', note: 'Everyone else, including COZMC staked in Pact farms', amount: Math.max(0, total - pools - creator - prize - gone) },
    { key: 'pools', label: 'Liquidity pools', note: 'The ALGO/COZMC pool on Pact and other pool contracts', amount: pools },
    { key: 'creator', label: 'Creator wallet', note: 'The COZMC team’s wallet', amount: creator },
    { key: 'prize', label: 'Prize wallet', note: 'Pays the daily prizes', amount: prize },
    { key: 'burned', label: 'Burned', note: 'In the Bonfire, gone for good', amount: gone },
  ]
  return (
    <>
      <div className="tk-bar" role="img" aria-label={rows.map(r => `${r.label} ${pct(r.amount, total)}`).join(', ')}>
        {rows.map(r => r.amount > 0 && <span key={r.key} className={`tk-bar__${r.key}`} style={{ flexGrow: r.amount }} />)}
      </div>
      <ul className="tk-rows">
        {rows.map(r => (
          <li key={r.key}>
            <span className={`tk-dot tk-bar__${r.key}`} aria-hidden="true" />
            <span className="tk-rows__what"><b>{r.label}</b><small>{r.note}</small></span>
            <span className="tk-rows__amt"><b>{pct(r.amount, total)}</b><small>{fmt(Math.round(r.amount))}</small></span>
          </li>
        ))}
      </ul>
      <p className="small muted tk-note">Percentages of the {fmt(total)} total supply, from live wallet balances. The full list is on <a href="#/community/holders">Holders</a>.</p>
    </>
  )
}

function Wallet({ label, address, note }: { label: string; address: string; note: string }) {
  return (
    <li>
      <b>{label}</b>
      <span className="tk-wallets__addr"><code className="addr">{address}</code><CopyBtn text={address} what={`${label} address`} /><a className="btn btn--ghost btn--sm" href={EXPLORER_ACCOUNT(address)} target="_blank" rel="noopener" aria-label={`View the ${label} on the Allo explorer`}>View ↗</a></span>
      <small>{note}</small>
    </li>
  )
}

function Step({ status, title, when, children }: { status: string; title: string; when?: string; children: ReactNode }) {
  return (
    <li>
      <span className={`tk-status tk-status--${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</span>
      <div><b>{title}</b>{when && <span className="tk-when">{when}</span>}<p>{children}</p></div>
    </li>
  )
}
