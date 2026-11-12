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
   - A prize that is due but couldn't be sent (no key, the wrong key, an empty prize wallet, a failed
     transaction) is recorded as delayed. The run still fails, and the #winners post says so.

   Environment:
     PRIZE_WALLET_MNEMONIC  the prize wallet's recovery phrase, 25 words (Algorand's own) or 24 (newer wallets): see
                            scripts/phrase.ts. A GitHub secret. Not needed for a dry run.
     DRY_RUN=1              work everything out and print it, but send nothing.
   For a test on Algorand TestNet with a test wallet and test asset:
     ALGOD_URL=https://testnet-api.algonode.cloud INDEXER_URL=https://testnet-idx.algonode.cloud
     PAY_ASSET_ID=<test asset id> PAY_TO=<an address opted in to it>   (every prize goes to PAY_TO)
   TODAY_UTC=2026-11-12T00:05:00Z simulates a date (tests only).
     DISCORD_WINNERS_WEBHOOK  a Discord webhook for #winners (a GitHub secret). When set, each scheduled
                            run posts the day that just ended and the prizes it paid. Optional.
     DISCORD_TEST=1         post one test message to that webhook (and nothing else to Discord).
     BACKUP_RUN=1           the 01:41 UTC backup run: it posts to Discord only if it paid something.
   Dry runs and test-mode runs never post results to Discord; they print the message instead
   (even with no webhook connected). A dry run shows what a real run would post right now.
   ============================================================ */
import algosdk from 'algosdk'
import { ALGOD, ASA_ID, DAILY_PRIZES, EXPLORER_TX, INDEXER, NOTE_DAILY_PRIZE } from '../src/config'
import { buildDailyPrizeTxn, fetchBurns, fetchScores } from '../src/lib/chain'
import { joinScoresAndBurns } from '../src/lib/boards'
import { featuredGame, PRIZE_START_DAY, standings, winners, payoutNote, payoutAt, type Standing } from '../src/lib/dailyPrize'
import { utcDay } from '../src/lib/daily'
import { readPhrase, type Signer } from './phrase'

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

/** Why a prize that was due wasn't paid, in words that are safe to post in public.
    These two phrases are the only reasons the Discord post can ever show: no error text, no setting names. */
const SETUP = 'a setup issue on our side', RETRY = 'being retried'
type Reason = typeof SETUP | typeof RETRY
type Prize = { day: number; rank: number; to: string; amount: number }

/** What this run found and did, for the Discord post. */
const report: {
  today?: number; closed?: number; final: Standing[]
  paid: (Prize & { txid: string })[]
  waiting: Prize[]                          // the winner hasn't opted in to COZMC: theirs to fix
  delayed: (Prize & { reason: Reason })[]   // due, the winner is ready, and we didn't pay it: ours to fix
} = { final: [], paid: [], waiting: [], delayed: [] }

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

  // whose wallet pays. A problem with the key doesn't stop the announcement: it's raised further down,
  // once the prizes that are due are known, so the Discord post can say which ones are late.
  const words = (env.PRIZE_WALLET_MNEMONIC || '').trim()
  let signer: Signer | null = null
  let keyError = ''          // why this run can't sign a payment ('' = it can)
  let badKey = false         // a wrong or unreadable key fails the run even on a dry run or with nothing due
  if (!words) keyError = 'PRIZE_WALLET_MNEMONIC is not set, so prizes that are due could not be paid. Add it under Settings → Secrets and variables → Actions.'
  else {
    try { signer = await readPhrase(words, DAILY_PRIZES.payer) }
    catch (e: any) { badKey = true; keyError = String(e?.message ?? e) }       // its text never contains a word of the phrase
    if (signer && !TEST && signer.addr !== DAILY_PRIZES.payer) {
      badKey = true; keyError = `PRIZE_WALLET_MNEMONIC is for ${short(signer.addr)}, not the prize wallet ${short(DAILY_PRIZES.payer)}. Nothing was sent.`
      signer = null
    }
    if (signer?.how) say(`Prize wallet key: read as ${signer.how}.`)         // which way a 24-word phrase was read; never the phrase
  }
  const sender = signer ? signer.addr : DAILY_PRIZES.payer

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
  if (!due.length) { say('Everything due has been paid.'); if (badKey) throw new Error(keyError); return }

  const need = due.reduce((a, d) => a + d.amount, 0)
  const have = await holding(sender)
  say(`Prize wallet ${short(sender)} holds ${have ?? 'no (not opted in)'} of asset ${ASSET}; due now: ${need}.`)
  // What stops this run from paying, if anything. Nothing is sent in that case (as before); the prizes
  // are recorded as delayed so the Discord post can say so, and the run then fails with this message.
  const low = have == null || have < need
  const blocked = keyError || (low ? `The prize wallet needs ${need} but holds ${have ?? 0}. Top it up; nothing was sent.` : '')
  if (DRY && low) say('⚠️ Not enough in the prize wallet for these payouts.')
  if (DRY && blocked && !badKey) say(`⚠️ A real run right now would not pay these${keyError ? ': PRIZE_WALLET_MNEMONIC is not set' : ''}. They are shown as delayed below.`)

  const algod = new algosdk.Algodv2('', ALGOD_URL, '')
  let failed = 0, i = 0
  try {
    for (; i < due.length; i++) {
      const d = due[i]
      const label = `${dateOf(d.day)} #${d.rank} ${d.amount} → ${short(d.to)}`
      // when the run can't pay anyway, a failed lookup here mustn't hide the delay: count the winner as ready
      const optedIn = blocked ? await holding(d.to).then(h => h != null, () => true) : (await holding(d.to)) != null
      if (!optedIn) { say(`- ${label}: skipped, the winner hasn't opted in to COZMC yet (retried daily)`); report.waiting.push(d); continue }
      if (blocked) { say(`- ${label}: ${DRY ? 'would send, but a real run right now would leave it delayed' : 'not sent, delayed'}`); report.delayed.push({ ...d, reason: SETUP }); continue }
      if (DRY) { say(`- ${label}: would send`); continue }
      try {
        const txn = await buildDailyPrizeTxn(algod, sender, d.to, payoutNote(d.day, d.rank, d.game), d.amount, ASSET)
        const { txid } = await algod.sendRawTransaction(await signer!.sign(txn)).do()
        await algosdk.waitForConfirmation(algod, txid, 8)
        say(`- ${label}: paid ${TEST ? txid : EXPLORER_TX(txid)}`)
        report.paid.push({ ...d, txid })
      } catch (e: any) { failed++; say(`- ${label}: FAILED ${String(e?.message ?? e).slice(0, 200)}`); report.delayed.push({ ...d, reason: RETRY }) }
    }
  } catch (e) {
    // the run stopped part-way (the network, say): whatever wasn't reached is late too
    for (const d of due.slice(i)) report.delayed.push({ ...d, reason: RETRY })
    throw e
  }
  if (blocked && (!DRY || badKey)) throw new Error(blocked)
  if (failed) throw new Error(`${failed} payout(s) failed; they'll be retried on the next run.`)
}

/* ---------------- Discord: the public #winners post ---------------- */
const MEDAL = ['🥇', '🥈', '🥉']
const num = (n: number) => n.toLocaleString('en-US')
const dayName = (day: number, style: 'long' | 'short' = 'long') => new Date(day * 86_400_000).toLocaleDateString('en-US', { weekday: style, month: 'short', day: 'numeric', timeZone: 'UTC' })

const LIMIT = 1900      // Discord's limit is 2,000 characters

/** The post for #winners: the day that just ended, the prizes this run paid, any that are late, and today's game. Public facts only. */
export function discordMessage(): string | null {
  const { closed, today, delayed } = report
  if (closed == null || today == null) return null
  const prize = (p: Prize) => `${MEDAL[p.rank - 1]} ${dayName(p.day, 'short')} · \`${short(p.to)}\` · ${num(p.amount)} COZMC`
  const head = [`🏆 **Daily prizes · ${dayName(closed)} · ${featuredGame(closed).title}**`]
  if (!report.final.length) head.push('Nobody posted a run that day.')
  else {
    const due = `<t:${Math.floor(payoutAt(closed) / 1000)}:F>`
    // don't repeat the usual promise while something on our side is holding every payout up
    head.push(delayed.some(d => d.reason === SETUP)
      ? `Final standings. These are due from ${due} after a one-day review, but payouts are running late right now (see below):`
      : `Final standings, paid from ${due} (it can take a few hours) after a one-day review:`)
    for (const s of report.final) head.push(`${MEDAL[s.rank - 1]} \`${short(s.player)}\` · ${num(s.score)} → **${num(s.prize)} COZMC**`)
  }
  const paid = report.paid.length ? ['', '💸 **Paid just now**', ...report.paid.map(p => `${prize(p)} · <${EXPLORER_TX(p.txid)}>`)] : []
  // ours to fix. Kept apart from "waiting", which is the winner's to fix
  const late = (shown: number) => {
    if (!delayed.length) return []
    const one = delayed.every(d => d.reason === delayed[0].reason) ? delayed[0].reason : null, more = delayed.slice(shown)
    return ['', `⏳ **Delayed: we're on it**${one ? ` (${one})` : ''}`,
      ...delayed.slice(0, shown).map(d => prize(d) + (one ? '' : ` · ${d.reason}`)),
      ...(more.length ? [`+${more.length} more · ${num(more.reduce((a, d) => a + d.amount, 0))} COZMC`] : []),
      `${one === RETRY ? 'These are retried automatically on every run.' : "These will be paid automatically as soon as it's fixed."} Nothing is lost. We never DM winners.`]
  }
  const waiting = report.waiting.length ? ['', `⏳ **Waiting to be paid:** opt in to COZMC (ASA ${ASA_ID}) to receive it. It's retried every day.`, ...report.waiting.map(prize)] : []
  const g = featuredGame(today)
  const foot = ['', `🎮 Today's prize game: **${g.title}** · <https://cozmc.us/#/arcade/${g.id}/daily>`, '📋 Full board, rules and every payout: <https://cozmc.us/#/arcade/prizes>']
  // a long delayed list is cut to fit, with "+N more"; at least one line always shows
  let shown = delayed.length, text = ''
  for (;;) {
    text = [...head, ...paid, ...late(shown), ...waiting, ...foot].join('\n')
    if (text.length <= LIMIT || shown <= 1) break
    shown--
  }
  return text.length > LIMIT ? text.slice(0, LIMIT - 10) + '\n…' : text
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
  const preview = (DRY || TEST) && !DISCORD_TEST      // nothing is posted: the message is printed, webhook or not
  if (!WEBHOOK) { if (!preview) { say('\nDiscord: not connected (no DISCORD_WINNERS_WEBHOOK secret), so nothing was posted.'); return } }
  else if (!isDiscordWebhook(WEBHOOK)) { say('\n⚠️ Discord: DISCORD_WINNERS_WEBHOOK is not a Discord webhook link, so nothing was posted.'); console.log('::warning::DISCORD_WINNERS_WEBHOOK is not a Discord webhook link'); if (!preview) return }
  try {
    if (DISCORD_TEST) {
      await postToDiscord('🧪 Test from the COZMC daily prize job: this channel is connected. Daily results will be posted here automatically each day, from 00:05 UTC.')
      say('\nDiscord: test message posted to #winners.')
      return
    }
    const msg = discordMessage()
    if (!msg) { say('\nDiscord: nothing to announce yet.'); return }
    // the backup run only speaks when it paid something, which includes a prize an earlier run left delayed
    if (BACKUP && !report.paid.length) { say('\nDiscord: backup run with nothing new, so nothing was posted (the 00:05 run already did).'); return }
    if (preview) { say(`\nDiscord message (not posted: ${DRY ? 'dry run' : 'test mode'}):\n\n${msg}`); return }
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
