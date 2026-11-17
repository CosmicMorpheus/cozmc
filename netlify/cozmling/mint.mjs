/* Starprint NFTs on Algorand TestNet: one asset per hatched Starprint, minted by the COZMC issuer.

   A rehearsal for the MainNet launch, on TestNet only: this file refuses any other network.
   - One mint per Starprint and network (a database constraint), whoever asks and however often.
   - The transaction is signed and saved (its id, its validity window, the signed bytes) before it is sent.
     A retry, a timeout or a restarted function re-sends those same bytes, or checks the chain, and only
     signs a new transaction once the old one can no longer confirm. So it never makes a second asset.
   - The asset: supply 1, no decimals, unit name STAR, named "Starprint #<serial>", no freeze or clawback,
     not frozen by default, the manager a separate address from the issuer.
   - Public: the serial, its Star Chart's Sun sign, element and archetype, and its name only if the
     player chose to include it. Never its birthplace, birthday, care, story or anything about the player.
   - The issuer's TestNet key is made once by the preview database and never leaves it. The MainNet
     issuer is a separate account Mark creates and keeps in Netlify's secret storage; it isn't used here. */
import { randomBytes } from 'node:crypto'
import algosdk from 'algosdk'
import { CozmlingRequestError, transaction } from './http.mjs'

export const TESTNET = {
  network: 'testnet',
  algod: 'https://testnet-api.algonode.cloud',
  indexer: 'https://testnet-idx.algonode.cloud',
  explorer: id => `https://lora.algokit.io/testnet/asset/${id}`,
}
const NAME_BYTES = 32, UNIT = 'STAR', URL_BYTES = 96, VALID_ROUNDS = 40


/** UTF-8 bytes, for Algorand's byte limits. */
const bytes = text => Buffer.byteLength(text, 'utf8')

/** The asset's fields. The name is always ASCII and inside 32 bytes; the URL inside 96. */
export function assetFields({ serial, origin, manager, issuer, mintRef }) {
  const assetName = `Starprint #${serial}`
  const assetURL = `${origin}/api/starprint-meta/${serial}#arc3`
  if (bytes(assetName) > NAME_BYTES || bytes(assetURL) > URL_BYTES) throw new Error('starprint_fields_too_long')
  return {
    sender: issuer, total: 1, decimals: 0, defaultFrozen: false, unitName: UNIT, assetName, assetURL,
    manager, reserve: undefined, freeze: undefined, clawback: undefined,
    note: new TextEncoder().encode(`cozmc:starprint:v1:${mintRef}`),
  }
}

/** The public description (ARC-3 JSON) of a minted Starprint: nothing private, nothing about the player. */
export function publicMetadata(row, origin) {
  const traits = row.traits ?? {}
  return {
    name: `Starprint #${row.serial}`,
    description: 'A COZMC Starprint, minted on Algorand TestNet as a rehearsal for the MainNet launch. It has no value.',
    image: `${origin}/assets/card-face.webp`,
    image_mimetype: 'image/webp',
    external_url: `${origin}/#/cozmling`,
    properties: {
      serial: Number(row.serial),
      edition: 'TestNet rehearsal',
      network: 'testnet',
      ...(row.public_name ? { public_name: row.public_name } : {}),
      star_chart: { sun_sign: traits.sunSign ?? null, element: traits.element ?? null, archetype: traits.archetype ?? null },
    },
  }
}

const SIGNS = new Set(['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'])

/** The public Star Chart traits of a hatched Starprint, read from its saved record. */
export function publicTraits(record) {
  const sunSign = record?.celestial?.bodies?.find?.(b => b.body === 'sun')?.sign ?? record?.starprint?.coreSign
  return {
    sunSign: SIGNS.has(sunSign) ? sunSign : null,
    element: typeof record?.starprint?.element === 'string' ? record.starprint.element : null,
    archetype: typeof record?.starprint?.archetype === 'string' ? record.starprint.archetype : null,
  }
}

export function createMintService({ db, origin, algod, indexer, dailyCap = 20, net = TESTNET }) {
  if (net.network !== 'testnet') throw new Error('Starprint minting here is TestNet only.')

  async function issuer() {
    const fresh = algosdk.generateAccount(), manager = algosdk.generateAccount()
    // the manager is a separate address (on MainNet, Mark's offline key); here its key is simply not kept
    await db.query(`INSERT INTO starprint_issuer (network, secret, manager_address) VALUES ($1, $2, $3)
      ON CONFLICT (network) DO NOTHING`, [net.network, Buffer.from(fresh.sk), manager.addr.toString()])
    const { rows: [row] } = await db.query('SELECT secret, manager_address FROM starprint_issuer WHERE network = $1', [net.network])
    const sk = new Uint8Array(row.secret)
    return { address: algosdk.encodeAddress(sk.slice(32)), sk, manager: row.manager_address }
  }

  /** Where the issuer stands: its address (to fund from the TestNet faucet) and balance. */
  async function info() {
    const { address, manager } = await issuer()
    let balance = null
    try { balance = Number((await algod.accountInformation(address).do()).amount) / 1e6 } catch { /* the node didn't answer */ }
    return { network: net.network, issuer: address, manager, balanceAlgo: balance, dailyCap }
  }

  const view = row => row && ({
    companionId: row.companion_id, serial: Number(row.serial), status: row.status,
    assetId: row.asset_id == null ? null : Number(row.asset_id), txid: row.txid,
    explorer: row.asset_id == null ? null : net.explorer(row.asset_id), publicName: row.public_name,
  })

  async function list(wallet) {
    const { rows } = await db.query('SELECT * FROM starprint_mints WHERE network = $1 AND wallet_address = $2 ORDER BY serial', [net.network, wallet])
    return { network: net.network, mints: await Promise.all(rows.map(async r => view(r.status === 'submitted' ? await settle(r) : r))) }
  }

  /** Has this transaction confirmed? From the node while it remembers it, otherwise from the indexer. */
  async function confirmation(txid) {
    try {
      const p = await algod.pendingTransactionInformation(txid).do()
      if (Number(p.confirmedRound ?? 0) > 0) return { round: Number(p.confirmedRound), assetId: Number(p.assetIndex) }
      if (p.poolError) return { failed: p.poolError }
      return null
    } catch { /* gone from the node's memory: ask the indexer */ }
    try {
      const t = (await indexer.lookupTransactionByID(txid).do()).transaction
      if (t?.confirmedRound) return { round: Number(t.confirmedRound), assetId: Number(t.createdAssetIndex) }
    } catch { /* not found */ }
    return null
  }

  async function markConfirmed(row, c) {
    const { rows: [done] } = await db.query(`UPDATE starprint_mints SET status = 'confirmed', asset_id = $3, confirmed_round = $4,
      signed_txn = NULL, updated_at = now() WHERE network = $1 AND companion_id = $2 RETURNING *`, [net.network, row.companion_id, c.assetId, c.round])
    return done
  }

  /** A submitted mint: confirmed, still pending, or past its window (then it may be signed again). */
  async function settle(row) {
    const c = await confirmation(row.txid)
    if (c?.assetId) return markConfirmed(row, c)
    const round = Number((await algod.status().do()).lastRound)
    if (round <= Number(row.last_valid)) {
      if (row.signed_txn) { try { await algod.sendRawTransaction(new Uint8Array(row.signed_txn)).do() } catch { /* already in the pool, or confirmed */ } }
      return row
    }
    // its window has closed without it confirming: it never can now, so a fresh one is safe
    const { rows: [back] } = await db.query(`UPDATE starprint_mints SET status = 'queued', txid = NULL, signed_txn = NULL,
      updated_at = now() WHERE network = $1 AND companion_id = $2 AND status = 'submitted' AND txid = $3 RETURNING *`, [net.network, row.companion_id, row.txid])
    return back ?? row
  }

  /** Mint (or keep minting) this wallet's hatched Starprint. Safe to call any number of times, at once. */
  async function mint(wallet, companionId, { publicName = null } = {}) {
    if (typeof companionId !== 'string' || !companionId) throw new CozmlingRequestError('invalid_companion', 400)
    const { address, sk, manager } = await issuer()
    let row = await transaction(db, async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`starprint-mint:${net.network}:${companionId}`])
      const { rows: [existing] } = await client.query('SELECT * FROM starprint_mints WHERE network = $1 AND companion_id = $2 FOR UPDATE', [net.network, companionId])
      if (existing) {
        if (existing.wallet_address !== wallet) throw new CozmlingRequestError('companion_missing', 404)
        return existing
      }
      const { rows: [owned] } = await client.query('SELECT snapshot FROM cozmling_account_companions WHERE wallet_address = $1 AND companion_id = $2', [wallet, companionId])
      const record = owned?.snapshot?.record
      if (!record) throw new CozmlingRequestError('companion_missing', 404)
      if (record.kind !== 'adventurer' || record.hatch?.status !== 'hatched') throw new CozmlingRequestError('not_hatched', 409)
      const { rows: [{ today }] } = await client.query(`SELECT count(*)::int AS today FROM starprint_mints
        WHERE network = $1 AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [net.network])
      if (today >= dailyCap) throw new CozmlingRequestError('daily_cap_reached', 429)
      const name = typeof publicName === 'string' && publicName.trim() ? publicName.trim().slice(0, 40) : null
      const { rows: [made] } = await client.query(`INSERT INTO starprint_mints (network, companion_id, wallet_address, mint_ref, status, public_name, traits)
        VALUES ($1, $2, $3, $4, 'queued', $5, $6) RETURNING *`, [net.network, companionId, wallet, randomBytes(12).toString('hex'), name, publicTraits(record)])
      return made
    })

    if (row.status === 'submitted') row = await settle(row)
    if (row.status !== 'queued') return view(row)

    // sign, and save the signed transaction before sending it
    const params = await algod.getTransactionParams().do()
    params.lastValid = BigInt(params.firstValid) + BigInt(VALID_ROUNDS)
    const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
      ...assetFields({ serial: row.serial, origin, manager, issuer: address, mintRef: row.mint_ref }), suggestedParams: params,
    })
    const signed = txn.signTxn(sk), txid = txn.txID()
    const { rows: [claimed] } = await db.query(`UPDATE starprint_mints SET status = 'submitted', txid = $3, first_valid = $4, last_valid = $5,
      signed_txn = $6, updated_at = now() WHERE network = $1 AND companion_id = $2 AND status = 'queued' RETURNING *`,
      [net.network, companionId, txid, Number(params.firstValid), Number(params.lastValid), Buffer.from(signed)])
    if (!claimed) return view((await db.query('SELECT * FROM starprint_mints WHERE network = $1 AND companion_id = $2', [net.network, companionId])).rows[0])
    try {
      await algod.sendRawTransaction(signed).do()
    } catch (error) {
      const text = String(error?.message ?? error)
      if (/overspend|balance .* below min/i.test(text)) throw new CozmlingRequestError('issuer_unfunded', 503)
      return view(claimed)                    // a timeout or a dropped answer: the next call checks the chain
    }
    try {
      const done = await algosdk.waitForConfirmation(algod, txid, 6)
      return view(await markConfirmed(claimed, { round: Number(done.confirmedRound), assetId: Number(done.assetIndex) }))
    } catch {
      return view(claimed)                    // still on its way: the page asks again
    }
  }

  async function publicRecord(serial) {
    const { rows: [row] } = await db.query("SELECT * FROM starprint_mints WHERE network = $1 AND serial = $2 AND status <> 'queued'", [net.network, serial])
    return row ?? null
  }

  return { info, list, mint, publicRecord }
}
