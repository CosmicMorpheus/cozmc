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
   ============================================================ */
import algosdk from 'algosdk'
import { ALGOD, ASA_ID, DAILY_PRIZES, EXPLORER_TX, INDEXER, NOTE_DAILY_PRIZE } from '../src/config'
import { buildDailyPrizeTxn, fetchBurns, fetchScores } from '../src/lib/chain'
import { joinScoresAndBurns } from '../src/lib/boards'
import { featuredGame, PRIZE_START_DAY, standings, winners, payoutNote } from '../src/lib/dailyPrize'
import { utcDay } from '../src/lib/daily'

const env = process.env
const DRY = !!env.DRY_RUN && env.DRY_RUN !== '0' && env.DRY_RUN !== 'false'
const ALGOD_URL = env.ALGOD_URL || ALGOD
const INDEXER_URL = env.INDEXER_URL || INDEXER
const ASSET = Number(env.PAY_ASSET_ID || ASA_ID)
const PAY_TO = env.PAY_TO || ''
const TEST = ASSET !== ASA_ID || ALGOD_URL !== ALGOD || !!PAY_TO
const NOW = env.TODAY_UTC ? Date.parse(env.TODAY_UTC) : Date.now()       // TODAY_UTC: simulate a date (tests only)

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
  say(`# Daily prize payout · ${new Date(NOW).toISOString().slice(0, 16).replace('T', ' ')} UTC${DRY ? ' · DRY RUN (nothing is sent)' : ''}${TEST ? ' · TEST MODE' : ''}`)
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
    if ((await holding(d.to)) == null) { say(`- ${label}: skipped, the winner hasn't opted in to COZMC yet (retried daily)`); continue }
    if (DRY) { say(`- ${label}: would send`); continue }
    try {
      const txn = await buildDailyPrizeTxn(algod, sender, d.to, payoutNote(d.day, d.rank, d.game), d.amount, ASSET)
      const { txid } = await algod.sendRawTransaction(txn.signTxn(acct!.sk)).do()
      await algosdk.waitForConfirmation(algod, txid, 8)
      say(`- ${label}: paid ${TEST ? txid : EXPLORER_TX(txid)}`)
    } catch (e: any) { failed++; say(`- ${label}: FAILED ${String(e?.message ?? e).slice(0, 200)}`) }
  }
  if (failed) throw new Error(`${failed} payout(s) failed; they'll be retried on the next run.`)
}

main().catch(e => { say(`\n❌ ${e?.message ?? e}`); process.exitCode = 1 }).finally(async () => {
  if (env.GITHUB_STEP_SUMMARY) { const { appendFileSync } = await import('node:fs'); appendFileSync(env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n') }
})
