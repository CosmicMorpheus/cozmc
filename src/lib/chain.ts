import algosdk from 'algosdk'
import {
  ALGOD, INDEXER, ASA_ID, BONFIRE_ADDRESS, BONFIRE_APP_ID, NOTE_BURN, NOTE_SCORE,
  ARCADE_START_ROUND, TOKEN_START_ROUND, KNOWN_ACCOUNTS, CREATOR,
  SCORE_FEE_ALGO, PACT_POOL_APP, PACT_VAULT_APP, SCORE_SLIPPAGE, FREE_SCORES_BEFORE_ROUND,
  PACT_LP_ASSET, PACT_URL, PACT_FARMS,
  GIVEAWAY, NOTE_TICKET, NOTE_PRIZE, NOTE_PET,
} from '../config'
import { toWhole } from './format'

/* ---------------- low-level REST ---------------- */
async function getJSON<T = any>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} for ${url}`), { status: r.status })
  return r.json()
}
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (s: string) => btoa(String.fromCharCode(...enc.encode(s)))
const unb64 = (s?: string) => {
  if (!s) return ''
  try { return dec.decode(Uint8Array.from(atob(s), c => c.charCodeAt(0))) } catch { return '' }
}

/** Follow indexer next-tokens until done (or maxPages). */
async function paginate<T>(path: string, key: string, maxPages = 12): Promise<T[]> {
  const out: T[] = []
  let next = ''
  for (let i = 0; i < maxPages; i++) {
    const sep = path.includes('?') ? '&' : '?'
    const d: any = await getJSON(`${INDEXER}${path}${sep}limit=1000${next ? `&next=${next}` : ''}`)
    out.push(...(d[key] ?? []))
    next = d['next-token']
    if (!next || !(d[key] ?? []).length) break
  }
  return out
}

/* ---------------- reads ---------------- */
export const fetchRound = async () => (await getJSON(`${ALGOD}/v2/status`))['last-round'] as number

export async function fetchAsset() {
  const p = (await getJSON(`${ALGOD}/v2/assets/${ASA_ID}`)).params
  return {
    name: p.name as string, unit: p['unit-name'] as string, decimals: p.decimals as number,
    total: toWhole(p.total), clawback: (p.clawback ?? '') as string, freeze: (p.freeze ?? '') as string,
    creator: p.creator as string, manager: (p.manager ?? '') as string,
  }
}

/** Whole-COZMC balance of an account, or null if it isn't opted in. */
export async function fetchCozmcBalance(addr: string): Promise<number | null> {
  try {
    const d = await getJSON(`${ALGOD}/v2/accounts/${addr}/assets/${ASA_ID}`)
    return toWhole(d['asset-holding'].amount)
  } catch (e: any) {
    if (e.status === 404) return null
    throw e
  }
}

/**
 * A holder's COZMC: what's in the wallet, plus the COZMC inside any ALGO/COZMC LP tokens they hold,
 * plus what they've staked in Pact farms (directly, or as LP). `amount` is the total, used for ranks.
 */
export interface Holder {
  address: string; amount: number; wallet: number; lp: number; farmed: number
  label?: string; excluded: boolean; contract: boolean; since: number
}

/* ---------------- Pact: pool, farms, stakes ---------------- */
const globals = async (app: number) => {
  const st: any[] = (await getJSON(`${ALGOD}/v2/applications/${app}`)).params['global-state'] ?? []
  return new Map(st.map(kv => [unb64(kv.key), kv.value.type === 2 ? BigInt(kv.value.uint) : kv.value.bytes as string]))
}

/** COZMC reserve and LP supply of the ALGO/COZMC pool, so LP tokens can be valued in COZMC. */
export async function fetchPactPool() {
  const g = await globals(PACT_POOL_APP)
  const reserve = g.get('reserve_b') as bigint, issued = g.get('issued_lp') as bigint
  return { reserveCozmc: toWhole(reserve), issuedLp: toWhole(issued), cozmcPerLp: issued ? Number(reserve) / Number(issued) : 0, reserveAlgo: Number(g.get('reserve_a') ?? 0n) / 1e6 }
}

export interface PactFarm { id: number; name: string; stakes: number; status: string; apr: number | null; tvlUsd: number | null; rewards: string[] }

/** Live Pact farms that take COZMC or the ALGO/COZMC LP, with their reward APR (from Pact's public API). */
export async function fetchPactFarms(): Promise<PactFarm[]> {
  try {
    const d: any = await getJSON(`${PACT_URL}/api/v1/factory-farms?chain=algorand-mainnet`)
    const ours = [String(ASA_ID), String(PACT_LP_ASSET)]
    const farms = (d.data as any[])
      .filter(f => f.status !== 'pending' && (f.state?.inputAssets ?? []).some((a: unknown) => ours.includes(String(a))))
      .map(f => ({
        id: Number(f.farmId), name: f.name as string, stakes: Number(f.state.inputAssets.find((a: unknown) => ours.includes(String(a)))),
        status: f.status as string, apr: typeof f.aprFraction === 'number' ? f.aprFraction : null,
        tvlUsd: typeof f.tvlUsd === 'number' ? f.tvlUsd : null, rewards: (f.outputs ?? []).map((o: any) => o.symbol as string),
      }))
    if (farms.length) return farms.sort((a, b) => (a.status === 'live' ? 0 : 1) - (b.status === 'live' ? 0 : 1) || (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
  } catch { /* Pact's API is down: fall back to the farms we know */ }
  return PACT_FARMS.map(f => ({ ...f, status: 'live', apr: null, tvlUsd: null, rewards: [] }))
}

/**
 * Who has staked how much in a Pact farm (Farm v2). The tokens sit in Pact's shared Vault; each
 * staker's share is in the farm app's local state: user_input_balances (ARC-4 uint64[]) × decay_index / 1e12.
 */
async function fetchFarmStakes(farm: number): Promise<Map<string, number>> {
  const g = await globals(farm)
  const decay = (g.get('decay_index') as bigint | undefined) ?? 1_000_000_000_000n
  const accounts = await paginate<any>(`/v2/accounts?application-id=${farm}`, 'accounts', 20)
  const out = new Map<string, number>()
  for (const a of accounts) {
    const ls = (a['apps-local-state'] ?? []).find((x: any) => x.id === farm)
    const kv = (ls?.['key-value'] ?? []).find((x: any) => unb64(x.key) === 'user_input_balances')
    if (!kv) continue
    const raw = Uint8Array.from(atob(kv.value.bytes), c => c.charCodeAt(0))
    if (raw.length < 10) continue
    let v = 0n
    for (let i = 2; i < 10; i++) v = (v << 8n) | BigInt(raw[i])           // first (only) input's share
    const staked = toWhole((v * decay) / 1_000_000_000_000n)
    if (staked > 0) out.set(a.address, staked)
  }
  return out
}

export async function fetchHolders(): Promise<Holder[]> {
  const [rows, lpRows, pool, farms] = await Promise.all([
    paginate<any>(`/v2/assets/${ASA_ID}/balances?currency-greater-than=0`, 'balances'),
    paginate<any>(`/v2/assets/${PACT_LP_ASSET}/balances?currency-greater-than=0`, 'balances').catch(() => []),
    fetchPactPool().catch(() => null),
    fetchPactFarms(),
  ])
  const stakes = await Promise.all(farms.map(f => fetchFarmStakes(f.id).then(m => ({ f, m }), () => ({ f, m: new Map<string, number>() }))))
  const perLp = pool?.cozmcPerLp ?? 0
  const by = new Map<string, Holder>()
  const row = (address: string, since = 0) => {
    let h = by.get(address)
    if (!h) { h = { address, amount: 0, wallet: 0, lp: 0, farmed: 0, excluded: false, contract: false, since }; by.set(address, h) }
    return h
  }
  for (const b of rows) row(b.address, Number(b['opted-in-at-round']) || 0).wallet = toWhole(b.amount)
  // Label pools/contracts explicitly in config. (Rekey heuristics misfire: Haystack's
  // own accounts are rekeyed too, and those are real people who deserve a rank.)
  const known = (a: string) => KNOWN_ACCOUNTS[a]
  for (const b of lpRows) if (!known(b.address)?.exclude) row(b.address).lp += toWhole(b.amount) * perLp
  for (const { f, m } of stakes) for (const [addr, amt] of m) row(addr).farmed += f.stakes === PACT_LP_ASSET ? amt * perLp : amt
  // the Vault holds staked COZMC on the stakers' behalf: credited to them above, so don't count it twice
  const stakedCozmc = stakes.filter(x => x.f.stakes === ASA_ID).reduce((t, x) => t + [...x.m.values()].reduce((u, v) => u + v, 0), 0)
  const vault = by.get(VAULT_ADDRESS)
  if (vault) vault.wallet = Math.max(0, vault.wallet - stakedCozmc)
  const holders = [...by.values()]
  holders.forEach(h => {
    h.amount = h.wallet + h.lp + h.farmed
    const k = known(h.address); if (k) { h.label = k.label; h.excluded = !!k.exclude; h.contract = !!k.exclude }
  })
  return holders.filter(h => h.amount > 0).sort((a, b) => b.amount - a.amount)
}

/** `arcade` is set when this burn paid for a posted score (joined in lib/data.tsx). */
export interface Burn { txid: string; sender: string; amount: number; round: number; time: number; wish: string; group?: string; arcade?: { game: string; score: number } }

export async function fetchBurns(): Promise<Burn[]> {
  const txns = await paginate<any>(
    `/v2/transactions?address=${BONFIRE_ADDRESS}&address-role=receiver&asset-id=${ASA_ID}&tx-type=axfer&min-round=${TOKEN_START_ROUND}`,
    'transactions')
  return txns
    .filter(t => t['asset-transfer-transaction']?.receiver === BONFIRE_ADDRESS && t['asset-transfer-transaction'].amount > 0)
    .map(t => {
      const note = unb64(t.note)
      return {
        txid: t.id, sender: t.sender, amount: toWhole(t['asset-transfer-transaction'].amount),
        round: t['confirmed-round'], time: t['round-time'],
        wish: note.startsWith(NOTE_BURN) ? note.slice(NOTE_BURN.length).trim() : '',
        group: t.group as string | undefined,
      }
    })
    .sort((a, b) => b.round - a.round)
}

/**
 * `day` is set for Daily Challenge runs (UTC day number, see lib/daily.ts).
 * A paid score's `group` must also contain a COZMC burn; lib/data.tsx joins that in (`burned`).
 */
export interface ScoreTx {
  txid: string; player: string; game: string; score: number; ms: number; round: number; time: number; day?: number
  group?: string; legacy: boolean; burned?: number
}

/** The Pact Vault's address: swap input goes here. */
export const VAULT_ADDRESS = algosdk.getApplicationAddress(PACT_VAULT_APP).toString()
const FEE_MICRO = Math.round(SCORE_FEE_ALGO * 1e6)

/** Every score note posted on-chain: the 0.1 ALGO swap payment of a paid post, or an early free 0-ALGO note. */
export async function fetchScores(): Promise<ScoreTx[]> {
  const txns = await paginate<any>(
    `/v2/transactions?note-prefix=${encodeURIComponent(b64(NOTE_SCORE))}&tx-type=pay&min-round=${ARCADE_START_ROUND}`,
    'transactions', 20)
  const out: ScoreTx[] = []
  for (const t of txns) {
    const pay = t['payment-transaction']
    if (!pay) continue
    const legacy = pay.receiver === t.sender && pay.amount === 0 && t['confirmed-round'] < FREE_SCORES_BEFORE_ROUND
    const paid = pay.receiver === VAULT_ADDRESS && pay.amount >= FEE_MICRO && !!t.group
    if (!legacy && !paid) continue
    try {
      const j = JSON.parse(unb64(t.note).slice(NOTE_SCORE.length))
      if (typeof j.g !== 'string' || !Number.isInteger(j.s) || j.s < 0) continue
      const time = t['round-time'] as number
      // a daily score only counts for the day it was posted (or just after midnight, for runs that ended at the bell)
      const txDay = Math.floor(time / 86_400), late = time % 86_400 < 15 * 60
      const day = Number.isInteger(j.day) && (j.day === txDay || (late && j.day === txDay - 1)) ? (j.day as number) : undefined
      out.push({ txid: t.id, player: t.sender, game: j.g, score: j.s, ms: Number(j.d) || 0, round: t['confirmed-round'], time, day, group: t.group, legacy })
    } catch { /* not ours */ }
  }
  return out
}

/** Is the Bonfire already opted into COZMC, and can it cover the opt-in's minimum balance itself? */
export async function bonfireState() {
  const [opt, acct] = await Promise.all([
    getJSON(`${ALGOD}/v2/accounts/${BONFIRE_ADDRESS}/assets/${ASA_ID}`).then(() => true, (e: any) => { if (e.status === 404) return false; throw e }),
    getJSON(`${ALGOD}/v2/accounts/${BONFIRE_ADDRESS}?exclude=all`),
  ])
  return { optedIn: opt, spare: Number(acct.amount) - Number(acct['min-balance']) }
}

export async function fetchBonfireTotal(): Promise<number> {
  return (await fetchCozmcBalance(BONFIRE_ADDRESS)) ?? 0
}

/* ---------------- writes ---------------- */
const ARC54_OPT_IN = new algosdk.ABIMethod({ name: 'arc54_optIntoASA', args: [{ type: 'asset', name: 'asa' }], returns: { type: 'void' } })

/**
 * Burn = an asset transfer of COZMC to the Bonfire with the wish in the note.
 * If the Bonfire has never held COZMC, the same atomic group first asks it to
 * opt in (ARC-54), funding its minimum balance only if it can't cover it.
 */
export async function buildBurnGroup(algod: algosdk.Algodv2, sender: string, amountBase: bigint, wish: string) {
  const [sp, bf] = await Promise.all([algod.getTransactionParams().do(), bonfireState()])
  const txns: algosdk.Transaction[] = []
  let extraAlgo = 0
  if (!bf.optedIn) {
    if (bf.spare < 100_000) {
      txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver: BONFIRE_ADDRESS, amount: 100_000, suggestedParams: sp }))
      extraAlgo += 0.1
    }
    txns.push(algosdk.makeApplicationNoOpTxnFromObject({
      sender, appIndex: BONFIRE_APP_ID, appArgs: [ARC54_OPT_IN.getSelector(), new Uint8Array([0])], foreignAssets: [ASA_ID],
      suggestedParams: { ...sp, fee: 2000, flatFee: true }, // covers the app's inner opt-in transaction
    }))
  }
  const note = enc.encode(NOTE_BURN + wish.trim())
  txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender, receiver: BONFIRE_ADDRESS, assetIndex: ASA_ID, amount: amountBase, note, suggestedParams: sp }))
  if (txns.length > 1) algosdk.assignGroupID(txns)
  const fees = txns.reduce((s, t) => s + Number(t.fee), 0) / 1e6
  return { txns, burnTxId: txns[txns.length - 1].txID(), needsOptIn: !bf.optedIn, extraAlgo, fees }
}

const SWAP = new algosdk.ABIMethod({ name: 'swap', args: [{ type: 'txn', name: 'input' }, { type: 'uint64', name: 'min_out' }], returns: { type: 'uint64' } })
const RETURN_PREFIX = '151f7c75'
const hex = (b: Uint8Array) => Array.from(b, x => x.toString(16).padStart(2, '0')).join('')

/** Turn a simulator failure into something a player can act on. */
function explainFailure(msg: string, needAlgo: number) {
  if (/overspend|below min|balance .* below/i.test(msg)) return `This wallet needs about ${needAlgo.toFixed(2)} ALGO free to post (${SCORE_FEE_ALGO} to burn plus fees).`
  if (/frozen/i.test(msg)) return 'COZMC is frozen in this wallet.'
  return `The post wouldn’t go through: ${msg.slice(0, 160)}`
}

/** A rekeyed wallet signs with another account's key. Returns that account, or null for a normal wallet. */
export async function signerOf(addr: string): Promise<string | null> {
  const a = await getJSON(`${ALGOD}/v2/accounts/${addr}?exclude=all`)
  return (a['auth-addr'] as string | undefined) ?? null
}

/** Dry-run a group. `signer` is the rekeyed wallet's real signer: without it the simulator rejects the group. */
async function simulate(algod: algosdk.Algodv2, txns: algosdk.Transaction[], signer: string | null = null) {
  const sgnr = signer ? algosdk.Address.fromString(signer) : undefined
  const req = new algosdk.modelsv2.SimulateRequest({
    txnGroups: [new algosdk.modelsv2.SimulateRequestTransactionGroup({ txns: txns.map(t => new algosdk.SignedTransaction({ txn: t, sgnr })) })],
    allowEmptySignatures: true,
  })
  return (await algod.simulateTransactions(req).do()).txnGroups[0]
}

/**
 * Posting a score, as one atomic group the player signs once:
 *   [opt in to COZMC]           only if the wallet doesn't hold it yet
 *   pay 0.1 ALGO -> Pact Vault  carries the score note
 *   Pact pool swap(min_out)     the Vault pays the COZMC out to the player
 *   COZMC -> Bonfire            burns what was bought; non-holders close out to the Bonfire,
 *                               so every last unit burns and their opt-in deposit comes back
 * The swap output is quoted first by simulating the swap against the live pool.
 */
export async function buildScoreGroup(algod: algosdk.Algodv2, sender: string, game: string, score: number, ms: number, day?: number) {
  const [sp, held, signer] = await Promise.all([algod.getTransactionParams().do(), fetchCozmcBalance(sender), signerOf(sender)])
  const optedIn = held != null
  const note = enc.encode(NOTE_SCORE + JSON.stringify({ g: game, s: Math.floor(score), d: Math.round(ms), ...(day != null ? { day } : {}) }))
  const needAlgo = SCORE_FEE_ALGO + 0.007 + (optedIn ? 0 : 0.1)
  const group = (minOut: bigint, burn: bigint | null) => {
    const txns: algosdk.Transaction[] = []
    if (!optedIn) txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender, receiver: sender, assetIndex: ASA_ID, amount: 0, suggestedParams: sp }))
    txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver: VAULT_ADDRESS, amount: FEE_MICRO, note, suggestedParams: sp }))
    txns.push(algosdk.makeApplicationNoOpTxnFromObject({
      sender, appIndex: PACT_POOL_APP, appArgs: [SWAP.getSelector(), algosdk.encodeUint64(minOut)],
      foreignAssets: [ASA_ID], foreignApps: [PACT_VAULT_APP],
      boxes: [{ appIndex: PACT_VAULT_APP, name: algosdk.encodeUint64(0) }, { appIndex: PACT_VAULT_APP, name: algosdk.encodeUint64(ASA_ID) }],
      suggestedParams: { ...sp, fee: 4000, flatFee: true },   // covers the pool's and the Vault's inner transactions
    }))
    if (burn != null) txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
      sender, receiver: BONFIRE_ADDRESS, assetIndex: ASA_ID, amount: burn, note: enc.encode(NOTE_BURN),
      ...(optedIn ? {} : { closeRemainderTo: BONFIRE_ADDRESS }), suggestedParams: sp,
    }))
    if (txns.length > 1) algosdk.assignGroupID(txns)
    return txns
  }

  // 1. quote: what does 0.1 ALGO buy right now?
  const quote = await simulate(algod, group(0n, null), signer)
  if (quote.failureMessage) throw new Error(explainFailure(quote.failureMessage, needAlgo))
  const logs = quote.txnResults[optedIn ? 1 : 2]?.txnResult.logs ?? []
  const ret = logs.map(hex).reverse().find(h => h.startsWith(RETURN_PREFIX))
  if (!ret) throw new Error('Couldn’t read a price from the Pact pool. Try again in a moment.')
  const out = BigInt('0x' + ret.slice(8, 24))
  const minOut = (out * BigInt(Math.round((1 - SCORE_SLIPPAGE) * 10_000))) / 10_000n
  if (minOut <= 0n) throw new Error('The Pact pool returned no COZMC for this swap.')

  // 2. the real group, checked once more before the wallet sees it
  const txns = group(minOut, minOut)
  const check = await simulate(algod, txns, signer)
  if (check.failureMessage) throw new Error(explainFailure(check.failureMessage, needAlgo))
  const fees = txns.reduce((s, t) => s + Number(t.fee), 0) / 1e6
  return { txns, quoted: toWhole(out), burn: toWhole(minOut), fees, optIn: !optedIn, scoreTxId: txns[optedIn ? 0 : 1].txID() }
}

type Signer = (txns: algosdk.Transaction[]) => Promise<(Uint8Array | null)[]>

export async function signAndSend(algod: algosdk.Algodv2, sign: Signer, txns: algosdk.Transaction[]) {
  const signed = (await sign(txns)).filter((x): x is Uint8Array => !!x)
  if (signed.length !== txns.length) throw new Error('The wallet did not sign every transaction.')
  const { txid } = await algod.sendRawTransaction(signed).do()
  await algosdk.waitForConfirmation(algod, txid, 8)
  return txid
}

/** Like signAndSend, but says when the wallet has signed, and returns the confirmed round too. */
export async function signSendConfirm(algod: algosdk.Algodv2, sign: Signer, txns: algosdk.Transaction[], onSigned?: () => void) {
  const signed = (await sign(txns)).filter((x): x is Uint8Array => !!x)
  if (signed.length !== txns.length) throw new Error('The wallet did not sign every transaction.')
  onSigned?.()
  const { txid } = await algod.sendRawTransaction(signed).do()
  const r = await algosdk.waitForConfirmation(algod, txid, 8)
  return { txid, round: Number(r.confirmedRound ?? 0) }
}

export const isCreator = (a: string) => a === CREATOR

/* ---------------- weekly giveaway ---------------- */
export interface FreeTicket { txid: string; address: string; week: number; round: number; time: number }
export interface PrizePayment { txid: string; from: string; to: string; week: number; amount: number; round: number; time: number }

/** Free giveaway entries: 0-ALGO notes {"w":week} sent to yourself during that week. */
export async function fetchFreeTickets(): Promise<FreeTicket[]> {
  const txns = await paginate<any>(`/v2/transactions?note-prefix=${encodeURIComponent(b64(NOTE_TICKET))}&tx-type=pay&min-round=${ARCADE_START_ROUND}`, 'transactions', 20)
  const out: FreeTicket[] = []
  for (const t of txns) {
    const pay = t['payment-transaction']
    if (!pay || pay.receiver !== t.sender || pay.amount !== 0) continue
    try {
      const j = JSON.parse(unb64(t.note).slice(NOTE_TICKET.length))
      if (Number.isInteger(j.w)) out.push({ txid: t.id, address: t.sender, week: j.w, round: t['confirmed-round'], time: t['round-time'] })
    } catch { /* not ours */ }
  }
  return out
}

/** Prize payouts: COZMC sent from the giveaway wallet with the note {"w":week}. */
export async function fetchPrizePayments(): Promise<PrizePayment[]> {
  const txns = await paginate<any>(`/v2/transactions?note-prefix=${encodeURIComponent(b64(NOTE_PRIZE))}&tx-type=axfer&asset-id=${ASA_ID}&min-round=${ARCADE_START_ROUND}`, 'transactions', 10)
  const out: PrizePayment[] = []
  for (const t of txns) {
    const ax = t['asset-transfer-transaction']
    if (!ax || t.sender !== GIVEAWAY.payer) continue
    try {
      const j = JSON.parse(unb64(t.note).slice(NOTE_PRIZE.length))
      if (Number.isInteger(j.w)) out.push({ txid: t.id, from: t.sender, to: ax.receiver, week: j.w, amount: toWhole(ax.amount), round: t['confirmed-round'], time: t['round-time'] })
    } catch { /* not ours */ }
  }
  return out
}

/**
 * The draw block: the first block stamped at or after `deadlineMs`, with its random seed.
 * Returns null until that block exists. Found by binary search over block headers.
 */
export async function fetchDrawBlock(deadlineMs: number): Promise<{ round: number; time: number; seed: string } | null> {
  const header = async (r: number) => (await getJSON(`${ALGOD}/v2/blocks/${r}?header-only=true`)).block as { rnd: number; ts: number; seed: string }
  const target = Math.ceil(deadlineMs / 1000)
  let hi = await fetchRound()
  const last = await header(hi)
  if (last.ts < target) return null
  let lo = Math.max(1, hi - Math.ceil((last.ts - target) / 2.4) - 500)      // ~2.8 s blocks: start a little early
  while ((await header(lo)).ts >= target) lo = Math.max(1, lo - 20_000)
  while (hi - lo > 1) {                                                       // invariant: ts(lo) < target <= ts(hi)
    const mid = Math.floor((lo + hi) / 2)
    if ((await header(mid)).ts >= target) hi = mid; else lo = mid
  }
  const b = await header(hi)
  return { round: b.rnd, time: b.ts, seed: b.seed }
}

/** Claim this week's free giveaway ticket: a 0-ALGO note to yourself (network fee only). */
export async function buildTicketTxn(algod: algosdk.Algodv2, sender: string, week: number) {
  const sp = await algod.getTransactionParams().do()
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver: sender, amount: 0, note: enc.encode(NOTE_TICKET + JSON.stringify({ w: week })), suggestedParams: sp })
}

/* ---------------- Cozmling ---------------- */
/**
 * The wallet's newest Cozmling note (a 0-ALGO payment it sent to itself). Notes other
 * accounts send to it are ignored, so nobody else can overwrite your Cozmling.
 */
export async function fetchPetNote(address: string): Promise<{ txid: string; round: number; data: unknown } | null> {
  const d = await getJSON(`${INDEXER}/v2/accounts/${address}/transactions?note-prefix=${encodeURIComponent(b64(NOTE_PET))}&tx-type=pay&limit=100`)
  const txns = ((d.transactions ?? []) as any[]).sort((a, b) => b['confirmed-round'] - a['confirmed-round'] || (b['intra-round-offset'] ?? 0) - (a['intra-round-offset'] ?? 0))
  for (const t of txns) {
    const pay = t['payment-transaction']
    if (t.sender !== address || !pay || pay.receiver !== address || pay.amount !== 0) continue
    try { return { txid: t.id, round: t['confirmed-round'], data: JSON.parse(unb64(t.note).slice(NOTE_PET.length)) } } catch { /* not ours */ }
  }
  return null
}

export interface PetNote { txid: string; address: string; round: number; time: number; checkin: boolean }

/** Every wallet's Cozmling notes (saves and daily check-ins), for the giveaway's check-in bonus. */
export async function fetchPetNotes(): Promise<PetNote[]> {
  const txns = await paginate<any>(`/v2/transactions?note-prefix=${encodeURIComponent(b64(NOTE_PET))}&tx-type=pay&min-round=${ARCADE_START_ROUND}`, 'transactions', 20)
  const out: PetNote[] = []
  for (const t of txns) {
    const pay = t['payment-transaction']
    if (!pay || pay.receiver !== t.sender || pay.amount !== 0) continue
    try {
      const j = JSON.parse(unb64(t.note).slice(NOTE_PET.length))
      out.push({ txid: t.id, address: t.sender, round: t['confirmed-round'], time: t['round-time'], checkin: Number.isInteger(j?.d) })
    } catch { /* not ours */ }
  }
  return out
}

/** Save a Cozmling: a 0-ALGO note to yourself (network fee only). */
export async function buildPetTxn(algod: algosdk.Algodv2, sender: string, data: object) {
  const sp = await algod.getTransactionParams().do()
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender, receiver: sender, amount: 0, note: enc.encode(NOTE_PET + JSON.stringify(data)), suggestedParams: sp })
}

/** Opt in to COZMC (needed to receive a prize). */
export async function buildOptInTxn(algod: algosdk.Algodv2, sender: string) {
  const sp = await algod.getTransactionParams().do()
  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender, receiver: sender, assetIndex: ASA_ID, amount: 0, suggestedParams: sp })
}

/** Pay a week's prize from the giveaway wallet. */
export async function buildPrizeTxn(algod: algosdk.Algodv2, sender: string, winner: string, week: number, amountWhole: number) {
  const sp = await algod.getTransactionParams().do()
  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender, receiver: winner, assetIndex: ASA_ID, amount: BigInt(Math.round(amountWhole)) * 1_000_000n,
    note: enc.encode(NOTE_PRIZE + JSON.stringify({ w: week })), suggestedParams: sp,
  })
}
