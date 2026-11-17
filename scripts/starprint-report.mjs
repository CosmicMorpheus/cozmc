/* The Starprint minting account at a glance, from public chain data only (read-only: it signs and sends nothing).
     node scripts/starprint-report.mjs --issuer <ADDRESS> [--network mainnet|testnet] [--since 2026-12-01]
   Says how many Starprints were minted and delivered, the ALGO locked and still spendable, the COZMC burned by
   mint fees (MainNet), the recent pace, how long the balance lasts at that pace, and whether to top up.
   Used for the launch rule: top up in small amounts as it's used, and review the cost after the first 30 days. */
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, a, i, all) => (a.startsWith('--') ? [...pairs, [a.slice(2), all[i + 1]]] : pairs), []))
const network = args.network === 'testnet' ? 'testnet' : 'mainnet'
const issuer = args.issuer
if (!/^[A-Z2-7]{58}$/.test(issuer ?? '')) { console.error('Usage: node scripts/starprint-report.mjs --issuer <ADDRESS> [--network mainnet|testnet] [--since YYYY-MM-DD]'); process.exit(1) }
const ALGOD = `https://${network}-api.algonode.cloud`, INDEXER = `https://${network}-idx.algonode.cloud`
const VAULT = '7FSDP27MVWXOUT55I2GNQIEF6OFDFWFJBD3GIZQ4VJHZHXCLFOG2X3PZGM'   // the Pact Vault (application 3656084807)
const COZMC = 3739851986, BONFIRE = 'BNFIREKGRXEHCFOEQLTX3PU5SUCMRKDU7WHNBGZA4SXPW42OAHZBP7BPHY'
const FEE_NOTE = 'cozmc:starprint:v1:fee:'
const PER_STARPRINT = 0.102                    // 0.1 locked + 0.001 to create + 0.001 to deliver
const TOP_UP_BELOW = 2                         // spendable ALGO
const since = args.since ? new Date(`${args.since}T00:00:00Z`) : null

async function get(url) {
  const r = await fetch(url)
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`${r.status} from ${new URL(url).host}`)
  return r.json()
}
async function all(path, key) {
  const out = []
  let next = ''
  for (let page = 0; page < 50; page++) {
    const j = await get(`${INDEXER}${path}${path.includes('?') ? '&' : '?'}limit=1000${next ? `&next=${next}` : ''}`)
    if (!j) break
    out.push(...(j[key] ?? []))
    if (!j['next-token'] || !(j[key] ?? []).length) break
    next = j['next-token']
  }
  return out
}
const algo = micro => (Number(micro) / 1e6).toFixed(3)

const account = await get(`${ALGOD}/v2/accounts/${issuer}?exclude=none`)
const amount = account?.amount ?? 0, minBalance = account?.['min-balance'] ?? 0
const created = account == null ? [] : (await all(`/v2/accounts/${issuer}/created-assets`, 'assets')).filter(a => a.params?.['unit-name'] === 'STAR' && !a.deleted)
const holdings = new Map((account?.assets ?? []).map(h => [h['asset-id'], h.amount]))
const delivered = created.filter(a => holdings.get(a.index) === 0).length

// mint fees: payments carrying the Starprint fee note (to the issuer on TestNet, to the Pact Vault on MainNet)
// (searched from the round the minting account was created, through the account the fee is paid to)
const startRound = (await get(`${INDEXER}/v2/accounts/${issuer}?exclude=all`))?.account?.['created-at-round'] ?? null
const receiver = network === 'mainnet' ? VAULT : issuer
const feeTx = startRound == null ? [] : (await all(`/v2/accounts/${receiver}/transactions?note-prefix=${encodeURIComponent(Buffer.from(FEE_NOTE).toString('base64'))}&tx-type=pay&min-round=${startRound}${since ? `&after-time=${since.toISOString()}` : ''}`, 'transactions'))
  .filter(t => t['payment-transaction']?.receiver === receiver && t['payment-transaction'].amount >= 10_000)
let burned = 0
if (network === 'mainnet') {
  for (const t of feeTx) {
    if (!t.group) continue
    const same = await all(`/v2/transactions?address=${t.sender}&round=${t['confirmed-round']}`, 'transactions')
    for (const x of same) {
      const a = x['asset-transfer-transaction']
      if (x.group === t.group && a?.['asset-id'] === COZMC && a.receiver === BONFIRE) burned += Number(a.amount) / 1e6
    }
  }
}
const weekAgo = Date.now() / 1000 - 7 * 86_400
const lastWeek = feeTx.filter(t => t['round-time'] >= weekAgo).length
const perDay = lastWeek / 7
const spendable = Math.max(0, (amount - minBalance) / 1e6)
const runwayDays = perDay > 0 ? spendable / (perDay * PER_STARPRINT) : Infinity

console.log(`Starprint minting account on ${network}: ${issuer}`)
console.log(`  Starprints minted:      ${created.length} (${delivered} delivered to players)`)
console.log(`  Fees paid${since ? ` since ${args.since}` : ''}:          ${feeTx.length} × 0.01 ALGO${network === 'mainnet' ? `, burning ${burned.toLocaleString('en-US', { maximumFractionDigits: 2 })} COZMC` : ' (TestNet ALGO, paid to this account)'}`)
console.log(`  ALGO locked by them:    ${(created.length * 0.1).toFixed(3)} (0.1 per Starprint created; the account's whole minimum balance is ${algo(minBalance)})`)
console.log(`  ALGO spendable:         ${amount > 0 ? spendable.toFixed(3) : '0 (the account isn’t funded yet)'}`)
console.log(`  Pace, last 7 days:      ${perDay.toFixed(1)} a day, costing about ${(perDay * PER_STARPRINT).toFixed(3)} ALGO a day`)
console.log(`  Lasts at that pace:     ${Number.isFinite(runwayDays) ? `${Math.floor(runwayDays)} days` : 'no recent mints'}`)
const topUp = Math.max(TOP_UP_BELOW, Math.ceil(perDay * PER_STARPRINT * 7))
console.log(spendable < TOP_UP_BELOW
  ? `  → Top up: below ${TOP_UP_BELOW} ALGO spendable. Send about ${topUp} ALGO (a week at this pace).`
  : `  → No top-up needed yet (top up when spendable drops below ${TOP_UP_BELOW} ALGO).`)
