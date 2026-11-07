/* ============================================================
   DAILY PRIZE PAYOUTS
   Runs once a day at 00:05 UTC (.github/workflows/daily-payout.yml).
   - Announces the day that just ended (its final standings, now in review).
   - Pays every closed day whose review day is over (today − 2 and earlier,
     back DAILY_PRIZES.claimDays), using the same standings the site shows
     (src/lib/dailyPrize.ts).
   - Never pays twice: a (day, rank) that already has a payout note from the
     prize wallet is skipped, so running it again is always safe.
   - A winner who hasn't opted in to COZMC is skipped and retried every day.

   Environment:
     PRIZE_WALLET_MNEMONIC  the prize wallet's 25 words (a GitHub secret). Not needed for a dry run.
     DRY_RUN=1              work everything out and print it, but send nothing.
   For a test on Algorand TestNet with a test wallet and test asset:
     ALGOD_URL=https://testnet-api.algonode.cloud INDEXER_URL=https://testnet-idx.algonode.cloud
     PAY_ASSET_ID=<test asset id> PAY_TO=<an address opted in to it>   (every prize goes to PAY_TO)
   TODAY_UTC=2026-11-12T00:05:00Z simulates a date (tests only).
     DISCORD_WINNERS_WEBHOOK  a Discord webhook for #winners (a GitHub secret). When set, each scheduled
                            run posts the day that just ended and the prizes it paid. Optional.
     DISCORD_TEST=1         post one test message to that webhook (and nothing else to Discord).
     BACKUP_RUN=1           the 01:41 UTC backup run: it posts to Discord only if it paid something.
   Dry runs and test-mode runs never post results to Discord; they print the message instead.
   ============================================================ */
import algosdk from 'algosdk'
import { ALGOD, ASA_ID, DAILY_PRIZES, EXPLORER_TX, INDEXER, NOTE_DAILY_PRIZE } from '../src/config'
import { buildDailyPrizeTxn, fetchBurns, fetchScores } from '../src/lib/chain'
import { joinScoresAndBurns } from '../src/lib/boards'
import { featuredGame, PRIZE_START_DAY, standings, winners, payoutNote, payoutAt, type Standing } from '../src/lib/dailyPrize'
import { utcDay } from '../src/lib/daily'

const env = process.env
const DRY = !!env.DRY_RUN && env.DRY_RUN !== '0' && env.DRY_RUN !== 'false'
const ALGOD_URL = env.ALGOD_URL || ALGOD
const INDEXER_URL = env.INDEXER_URL || INDEXER
const ASSET = Number(env.PAY_ASSET_ID || ASA_ID)
const PAY_TO = env.PAY_TO || ''
const TEST = ASSET !== ASA_ID || ALGOD_URL !== ALGOD || !!PAY_TO
const NOW = env.TODAY_UTC ? Date.parse(env.TODAY_UTC) : Date.now()       // TODAY_UTC: simulate a date (tests only)
const WEBHOOK = (env.DISCORD_WINNERS_WEBHOOK || '').trim()
const DISCORD_TEST = !!env.DISCORD_TEST && env.DISCORD_TEST !== '0' && env.DISCORD_TEST !== 'false'
const BACKUP = !!env.BACKUP_RUN && env.BACKUP_RUN !== '0' && env.BACKUP_RUN !== 'false'

/** What this run found and did, for the Discord post. */
const report: {
  today?: number; closed?: number; final: Standing[]
  paid: { day: number; rank: number; to: string; amount: number; txid: string }[]
  waiting: { day: number; rank: number; to: string; amount: number }[]
} = { final: [], paid: [], waiting: [] }

const lines: string[] = []
const say = (s = '') => { console.log(s); lines.push(s) }
const dateOf = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10)
const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`

async function getJSON(url: string) {
  const r = await fetch(url)
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} for ${url}`), { status: r.status })
  return r.json() as Promise<any>
}

/** (day, rank) pairs the sender has already paid, read from its payout notes on the paying network. */
async function alreadyPaid(sender: string): Promise<Set<string>> {
  const paid = new Set<string>()
  const prefix = encodeURIComponent(Buffer.from(NOTE_DAILY_PRIZE).toString('base64'))
  let next = ''
  for (let i = 0; i < 20; i++) {
    let d: any
    try { d = await getJSON(`${INDEXER_URL}/v2/accounts/${sender}/transactions?note-prefix=${prefix}&tx-type=axfer&asset-id=${ASSET}&limit=1000${next ? `&next=${next}` : ''}`) }
    catch (e: any) { if (e.status === 404) return paid; throw e }
    for (const t of d.transactions ?? []) {
      if (t.sender !== sender) continue
      try {
        const j = JSON.parse(Buffer.from(t.note ?? '', 'base64').toString().slice(NOTE_DAILY_PRIZE.length))
        if (Number.isInteger(j.d) && Number.isInteger(j.r)) paid.add(`${j.d}:${j.r}`)
      } catch { /* not ours */ }
    }
    next = d['next-token']
    if (!next || !(d.transactions ?? []).length) break
  }
  return paid
}

/** Whole-unit balance of `asset` held by `addr`, or null if it isn't opted in. */
async function holding(addr: string): Promise<number | null> {
  try { return Number((await getJSON(`${ALGOD_URL}/v2/accounts/${addr}/assets/${ASSET}`))['asset-holding'].amount) / 1e6 }
  catch (e: any) { if (e.status === 404) return null; throw e }
}

async function main() {
  const today = utcDay(NOW)
  report.today = today
  say(`# Daily prize payout · ${new Date(NOW).toISOString().slice(0, 16).replace('T', ' ')} UTC${BACKUP ? ' · backup run' : ''}${DRY ? ' · DRY RUN (nothing is sent)' : ''}${TEST ? ' · TEST MODE' : ''}`)
  if (today - 1 < PRIZE_START_DAY) { say(`The daily prizes start on ${DAILY_PRIZES.start}. Nothing to announce or pay yet.`); return }

  // whose wallet pays
  const words = (env.PRIZE_WALLET_MNEMONIC || '').trim()
  const acct = words ? algosdk.mnemonicToSecretKey(words) : null
  const sender = acct ? acct.addr.toString() : DAILY_PRIZES.payer
  if (!TEST && sender !== DAILY_PRIZES.payer) throw new Error(`PRIZE_WALLET_MNEMONIC is for ${short(sender)}, not the prize wallet ${short(DAILY_PRIZES.payer)}. Nothing was sent.`)

  const [rawScores, rawBurns] = await Promise.all([fetchScores(), fetchBurns()])
  const { scores } = joinScoresAndBurns(rawScores, rawBurns)

  // 1. announce the day that just ended
  const closed = today - 1
  const final = standings(closed, scores)
  report.closed = closed; report.final = final.filter(s => s.prize > 0)
  say(`\n## ${dateOf(closed)} · ${featuredGame(closed).title}: final standings (in review, paid ${dateOf(today + 1)} 00:05 UTC)`)
  if (!final.length) say('No eligible scores.')
  for (const s of final.slice(0, 5)) say(`${s.rank}. ${s.player}  ${s.score}${s.prize ? `  → ${s.prize} COZMC` : ''}`)

  // 2. pay every day whose review is over
  const first = Math.max(PRIZE_START_DAY, today - 1 - DAILY_PRIZES.claimDays)
  const paid = await alreadyPaid(sender)
  const due: { day: number; rank: number; to: string; amount: number; game: string }[] = []
  for (let day = first; day <= today - 2; day++)
    for (const w of winners(day, scores))
      if (!paid.has(`${day}:${w.rank}`)) due.push({ day, rank: w.rank, to: PAY_TO || w.player, amount: w.prize, game: featuredGame(day).id })

  say(`\n## Payouts due: ${due.length}`)
  if (!due.length) { say('Everything due has been paid.'); return }

  const need = due.reduce((a, d) => a + d.amount, 0)
  const have = await holding(sender)
  say(`Prize wallet ${short(sender)} holds ${have ?? 'no (not opted in)'} of asset ${ASSET}; due now: ${need}.`)
  if (!acct && !DRY) throw new Error('PRIZE_WALLET_MNEMONIC is not set, so prizes that are due could not be paid. Add it under Settings → Secrets and variables → Actions.')
  if (have == null || have < need) {
    if (!DRY) throw new Error(`The prize wallet needs ${need} but holds ${have ?? 0}. Top it up; nothing was sent.`)
    say('⚠️ Not enough in the prize wallet for these payouts.')
  }

  const algod = new algosdk.Algodv2('', ALGOD_URL, '')
  let failed = 0
  for (const d of due) {
    const label = `${dateOf(d.day)} #${d.rank} ${d.amount} → ${short(d.to)}`
    if ((await holding(d.to)) == null) { say(`- ${label}: skipped, the winner hasn't opted in to COZMC yet (retried daily)`); report.waiting.push(d); continue }
    if (DRY) { say(`- ${label}: would send`); continue }
    try {
      const txn = await buildDailyPrizeTxn(algod, sender, d.to, payoutNote(d.day, d.rank, d.game), d.amount, ASSET)
      const { txid } = await algod.sendRawTransaction(txn.signTxn(acct!.sk)).do()
      await algosdk.waitForConfirmation(algod, txid, 8)
      say(`- ${label}: paid ${TEST ? txid : EXPLORER_TX(txid)}`)
      report.paid.push({ ...d, txid })
    } catch (e: any) { failed++; say(`- ${label}: FAILED ${String(e?.message ?? e).slice(0, 200)}`) }
  }
  if (failed) throw new Error(`${failed} payout(s) failed; they'll be retried on the next run.`)
}

/* ---------------- Discord: the public #winners post ---------------- */
const MEDAL = ['🥇', '🥈', '🥉']
const num = (n: number) => n.toLocaleString('en-US')
const dayName = (day: number, style: 'long' | 'short' = 'long') => new Date(day * 86_400_000).toLocaleDateString('en-US', { weekday: style, month: 'short', day: 'numeric', timeZone: 'UTC' })

/** The post for #winners: the day that just ended, the prizes this run paid, and today's game. Public facts only. */
export function discordMessage(): string | null {
  const { closed, today } = report
  if (closed == null || today == null) return null
  const out = [`🏆 **Daily prizes · ${dayName(closed)} · ${featuredGame(closed).title}**`]
  if (!report.final.length) out.push('Nobody posted a run that day.')
  else {
    out.push(`Final standings, paid shortly after <t:${Math.floor(payoutAt(closed) / 1000)}:F> following a one-day review:`)
    for (const s of report.final) out.push(`${MEDAL[s.rank - 1]} \`${short(s.player)}\` · ${num(s.score)} → **${num(s.prize)} COZMC**`)
  }
  if (report.paid.length) {
    out.push('', '💸 **Paid just now**')
    for (const p of report.paid) out.push(`${MEDAL[p.rank - 1]} ${dayName(p.day, 'short')} · \`${short(p.to)}\` · ${num(p.amount)} COZMC · <${EXPLORER_TX(p.txid)}>`)
  }
  if (report.waiting.length) {
    out.push('', `⏳ **Waiting to be paid:** opt in to COZMC (ASA ${ASA_ID}) to receive it. It's retried every day.`)
    for (const w of report.waiting) out.push(`${MEDAL[w.rank - 1]} ${dayName(w.day, 'short')} · \`${short(w.to)}\` · ${num(w.amount)} COZMC`)
  }
  const g = featuredGame(today)
  out.push('', `🎮 Today's prize game: **${g.title}** · <https://cozmc.us/#/arcade/${g.id}/daily>`, '📋 Full board, rules and every payout: <https://cozmc.us/#/arcade/prizes>')
  const text = out.join('\n')
  return text.length > 1900 ? text.slice(0, 1890) + '\n…' : text      // Discord's limit is 2,000 characters
}

/** Discord webhooks only: never post this run's results anywhere else. */
const isDiscordWebhook = (u: string) => /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(u)

async function postToDiscord(content: string) {
  const r = await fetch(`${WEBHOOK}?wait=true`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    // no pings of any kind, and no link previews
    body: JSON.stringify({ username: 'COZMC Prizes', content, allowed_mentions: { parse: [] }, flags: 4 }),
  })
  if (!r.ok) throw new Error(`Discord replied HTTP ${r.status}`)
}

async function discordStep() {
  if (!WEBHOOK) { say('\nDiscord: not connected (no DISCORD_WINNERS_WEBHOOK secret), so nothing was posted.'); return }
  if (!isDiscordWebhook(WEBHOOK)) { say('\n⚠️ Discord: DISCORD_WINNERS_WEBHOOK is not a Discord webhook link, so nothing was posted.'); console.log('::warning::DISCORD_WINNERS_WEBHOOK is not a Discord webhook link'); return }
  try {
    if (DISCORD_TEST) {
      await postToDiscord('🧪 Test from the COZMC daily prize job: this channel is connected. Daily results will be posted here automatically at 00:05 UTC.')
      say('\nDiscord: test message posted to #winners.')
      return
    }
    const msg = discordMessage()
    if (!msg) { say('\nDiscord: nothing to announce yet.'); return }
    if (BACKUP && !report.paid.length) { say('\nDiscord: backup run with nothing new, so nothing was posted (the 00:05 run already did).'); return }
    if (DRY || TEST) { say(`\nDiscord message (not posted: ${DRY ? 'dry run' : 'test mode'}):\n\n${msg}`); return }
    await postToDiscord(msg)
    say('\nDiscord: results posted to #winners.')
  } catch (e: any) {
    say(`\n⚠️ Discord post failed: ${String(e?.message ?? e).slice(0, 200)}. Prizes were not affected.`)
    console.log(`::warning::Discord post failed: ${String(e?.message ?? e).slice(0, 200)}`)
  }
}

main().catch(e => { say(`\n❌ ${e?.message ?? e}`); process.exitCode = 1 }).finally(async () => {
  await discordStep()
  if (env.GITHUB_STEP_SUMMARY) { const { appendFileSync } = await import('node:fs'); appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n') }
})
