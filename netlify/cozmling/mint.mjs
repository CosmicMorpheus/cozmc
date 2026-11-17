/* Starprint NFTs on Algorand TestNet: one asset per hatched Starprint, minted by the COZMC issuer.

   TestNet by default (the rehearsal). MainNet only when the caller passes `mainnet: true` with an issuer key
   from Netlify's secret storage and Mark's separate manager address: the function does that only when
   COZMC_STARPRINT_NETWORK=mainnet and COZMC_STARPRINT_MAINNET=1 are both set, which is Mark's switch.
   - One mint per Starprint and network (a database constraint), whoever asks and however often.
   - The transaction is signed and saved (its id, its validity window, the signed bytes) before it is sent.
     A retry, a timeout or a restarted function re-sends those same bytes, or checks the chain, and only
     signs a new transaction once the old one can no longer confirm. So it never makes a second asset.
   - The asset: supply 1, no decimals, unit name STAR, named "Starprint #<serial>", no freeze or clawback,
     not frozen by default, the manager a separate address from the issuer.
   - Public: the serial, its Star Chart's Sun sign, element and archetype, and its name only if the
     player chose to include it. Never its birthplace, birthday, care, story or anything about the player.
   - The player pays a mint fee first (FEE_MICRO: 0.01 ALGO, Mark's price). On TestNet it's a payment of
     0.01 TestNet ALGO to the issuer, with the note cozmc:starprint:v1:fee:<mintRef>, checked on chain
     before anything is minted; each payment pays for one mint. On MainNet the same 0.01 ALGO will buy
     COZMC on the Pact pool and burn it in the Bonfire, like a score; that part isn't built or switched on here.
   - The fee on MainNet: the same group as posting a score. 0.01 ALGO paid to the Pact Vault with the fee note,
     swapped for COZMC, and the COZMC sent to the Bonfire in the same group. The server checks all of that.
   - Delivery: once minted, the player opts in to the asset and the issuer sends it. With a supply of 1 it can
     only ever be sent once; a saved transfer is re-sent within its window, never doubled.
   - The issuer's TestNet key is made once by the preview database and never leaves it. The MainNet issuer
     key is only ever read from the environment (Netlify secret storage), never stored in the database. */
import { randomBytes } from 'node:crypto'
import algosdk from 'algosdk'
import { CozmlingRequestError, transaction } from './http.mjs'

export const TESTNET = {
  network: 'testnet',
  algod: 'https://testnet-api.algonode.cloud',
  indexer: 'https://testnet-idx.algonode.cloud',
  explorer: id => `https://lora.algokit.io/testnet/asset/${id}`,
}
export const MAINNET = {
  network: 'mainnet',
  algod: 'https://mainnet-api.algonode.cloud',
  indexer: 'https://mainnet-idx.algonode.cloud',
  explorer: id => `https://lora.algokit.io/mainnet/asset/${id}`,
}
export const MAINNET_ORIGIN = 'https://cozmc.us'
/** MainNet COZMC, the Bonfire and the Pact Vault (the same values as src/config.ts; a test checks they match). */
export const COZMC_ASA = 3739851986
export const BONFIRE_ADDRESS = 'BNFIREKGRXEHCFOEQLTX3PU5SUCMRKDU7WHNBGZA4SXPW42OAHZBP7BPHY'
export const PACT_VAULT_APP = 3656084807
const VAULT_ADDRESS = algosdk.getApplicationAddress(PACT_VAULT_APP).toString()
const NAME_BYTES = 32, UNIT = 'STAR', URL_BYTES = 96, VALID_ROUNDS = 40
/** The mint fee: 0.01 ALGO. */
export const FEE_MICRO = 10_000
export const feeNote = mintRef => `cozmc:starprint:v1:fee:${mintRef}`


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

/** A minted (or minting) Starprint's row by its serial, on either network: serials are unique across both. */
export async function findPublicRecord(db, serial) {
  const { rows: [row] } = await db.query("SELECT * FROM starprint_mints WHERE serial = $1 AND status IN ('submitted', 'confirmed')", [serial])
  return row ?? null
}

/** The public description (ARC-3 JSON) of a minted Starprint: nothing private, nothing about the player. */
export function publicMetadata(row, origin) {
  const traits = row.traits ?? {}
  const main = row.network === 'mainnet'
  return {
    name: `Starprint #${row.serial}`,
    description: main ? 'A COZMC Starprint: a one-of-one record of a hatched Starprint and its Star Chart.'
      : 'A COZMC Starprint, minted on Algorand TestNet as a rehearsal for the MainNet launch. It has no value.',
    image: `${origin}/assets/card-face.webp`,
    image_mimetype: 'image/webp',
    external_url: `${origin}/#/cozmling`,
    properties: {
      serial: Number(row.serial),
      edition: main ? 'MainNet' : 'TestNet rehearsal',   // Genesis naming waits on Mark's Genesis policy
      network: main ? 'mainnet' : 'testnet',
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

export function createMintService({ db, origin, algod, indexer, dailyCap = 20, feeMicro = FEE_MICRO, mainnet = false, issuerMnemonic, managerAddress }) {
  const net = mainnet ? MAINNET : TESTNET
  let fixedIssuer = null
  if (mainnet) {
    // MainNet: the key comes from secret storage only, and the manager is a different (offline) account
    if (typeof issuerMnemonic !== 'string' || !algosdk.isValidAddress(String(managerAddress ?? ''))) throw new Error('MainNet minting needs its issuer key and manager address.')
    // an asset's URL is fixed forever when it's minted: MainNet Starprints always point at cozmc.us
    if (origin !== MAINNET_ORIGIN) throw new Error('MainNet Starprints can only be minted from https://cozmc.us.')
    const account = algosdk.mnemonicToSecretKey(issuerMnemonic)
    if (account.addr.toString() === managerAddress) throw new Error('The manager must be a different account from the issuer.')
    fixedIssuer = { address: account.addr.toString(), sk: account.sk, manager: managerAddress }
  }

  async function issuer() {
    if (fixedIssuer) { issuerAddress = fixedIssuer.address; return fixedIssuer }
    const fresh = algosdk.generateAccount(), manager = algosdk.generateAccount()
    // the manager is a separate address (on MainNet, Mark's offline key); here its key is simply not kept
    await db.query(`INSERT INTO starprint_issuer (network, secret, manager_address) VALUES ($1, $2, $3)
      ON CONFLICT (network) DO NOTHING`, [net.network, Buffer.from(fresh.sk), manager.addr.toString()])
    const { rows: [row] } = await db.query('SELECT secret, manager_address FROM starprint_issuer WHERE network = $1', [net.network])
    const sk = new Uint8Array(row.secret)
    issuerAddress = algosdk.encodeAddress(sk.slice(32))
    return { address: issuerAddress, sk, manager: row.manager_address }
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
    ...(row.status === 'awaiting_fee' ? { fee: { network: net.network, receiver: mainnet ? VAULT_ADDRESS : issuerAddress, burnsCozmc: mainnet, amountMicro: feeMicro, note: feeNote(row.mint_ref) } } : {}),
    feeTxid: row.fee_txid ?? null,
    delivery: row.status !== 'confirmed' ? null : { status: row.delivery_status ?? 'awaiting_optin', txid: row.delivery_txid ?? null },
  })
  let issuerAddress = null

  async function list(wallet) {
    await issuer()
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

  /** The fee payment, as the chain records it: confirmed, from this wallet, enough, with this mint's note, to
      the issuer (TestNet) or to the Pact Vault in a group that burns COZMC in the Bonfire (MainNet).
      null: not found yet. From the node while it remembers it, otherwise the indexer. */
  async function feePaid(txid, row, receiver) {
    let t = null
    try {
      const p = await algod.pendingTransactionInformation(txid).do()
      if (Number(p.confirmedRound ?? 0) > 0) {
        const x = p.txn.txn
        t = { type: x.type, sender: String(x.sender), receiver: String(x.payment?.receiver ?? ''), amount: Number(x.payment?.amount ?? 0), note: x.note,
          group: x.group ? Buffer.from(x.group).toString('base64') : null, round: Number(p.confirmedRound) }
      }
    } catch { /* gone from the node's memory: ask the indexer */ }
    if (!t) {
      try {
        const x = (await indexer.lookupTransactionByID(txid).do()).transaction
        if (x?.confirmedRound) t = { type: x.txType, sender: String(x.sender), receiver: String(x.paymentTransaction?.receiver ?? ''), amount: Number(x.paymentTransaction?.amount ?? 0), note: x.note,
          group: x.group ? Buffer.from(x.group).toString('base64') : null, round: Number(x.confirmedRound) }
      } catch { /* not found yet */ }
    }
    if (!t) return null
    const note = t.note ? new TextDecoder().decode(t.note) : ''
    const paid = t.type === 'pay' && t.sender === row.wallet_address && t.receiver === (mainnet ? VAULT_ADDRESS : receiver)
      && t.amount >= feeMicro && note === feeNote(row.mint_ref)
    if (!paid || !mainnet) return paid
    return burnedInGroup(t, row.wallet_address)
  }

  /** MainNet: the fee's group also sent COZMC from the player to the Bonfire. */
  async function burnedInGroup(t, wallet) {
    if (!t.group) return false
    let page
    try { page = await indexer.searchForTransactions().address(wallet).round(t.round).do() } catch { return null }
    return (page.transactions ?? []).some(x => x.group && Buffer.from(x.group).toString('base64') === t.group
      && x.txType === 'axfer' && String(x.sender) === wallet && Number(x.assetTransferTransaction?.assetId) === COZMC_ASA
      && String(x.assetTransferTransaction?.receiver) === BONFIRE_ADDRESS && Number(x.assetTransferTransaction?.amount ?? 0) > 0)
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
  async function mint(wallet, companionId, { publicName = null, feeTxid = null } = {}) {
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
        WHERE network = $1 AND status <> 'awaiting_fee' AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`, [net.network])
      if (today >= dailyCap) throw new CozmlingRequestError('daily_cap_reached', 429)
      const name = typeof publicName === 'string' && publicName.trim() ? publicName.trim().slice(0, 40) : null
      const { rows: [made] } = await client.query(`INSERT INTO starprint_mints (network, companion_id, wallet_address, mint_ref, status, public_name, traits)
        VALUES ($1, $2, $3, $4, $7, $5, $6) RETURNING *`, [net.network, companionId, wallet, randomBytes(12).toString('hex'), name, publicTraits(record), feeMicro > 0 ? 'awaiting_fee' : 'queued'])
      return made
    })

    if (row.status === 'awaiting_fee') {
      if (typeof feeTxid !== 'string' || !/^[A-Z2-7]{52}$/.test(feeTxid)) return view(row)
      const paid = await feePaid(feeTxid, row, address)
      if (paid === null) throw new CozmlingRequestError('fee_pending', 409)
      if (!paid) throw new CozmlingRequestError('fee_invalid', 402)
      try {
        const { rows: [next] } = await db.query(`UPDATE starprint_mints SET status = 'queued', fee_txid = $3, updated_at = now()
          WHERE network = $1 AND companion_id = $2 AND status = 'awaiting_fee' RETURNING *`, [net.network, companionId, feeTxid])
        row = next ?? (await db.query('SELECT * FROM starprint_mints WHERE network = $1 AND companion_id = $2', [net.network, companionId])).rows[0]
      } catch (error) {
        if (error?.code === '23505') throw new CozmlingRequestError('fee_invalid', 402)   // that payment already paid for a mint
        throw error
      }
    }
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

  /** Send a minted Starprint to the wallet that owns it, once that wallet has opted in to the asset. */
  async function deliver(wallet, companionId) {
    const { address, sk } = await issuer()
    const { rows: [row] } = await db.query('SELECT * FROM starprint_mints WHERE network = $1 AND companion_id = $2', [net.network, companionId])
    if (!row || row.wallet_address !== wallet) throw new CozmlingRequestError('companion_missing', 404)
    if (row.status !== 'confirmed') throw new CozmlingRequestError('not_minted', 409)
    const assetId = Number(row.asset_id)
    const holding = async who => { try { return Number((await algod.accountAssetInformation(who, assetId).do()).assetHolding?.amount ?? 0) } catch { return null } }
    const set = async (fields, values) => (await db.query(`UPDATE starprint_mints SET ${fields}, updated_at = now() WHERE network = $1 AND companion_id = $2 RETURNING *`,
      [net.network, companionId, ...values])).rows[0]
    const held = await holding(wallet)
    if (held === 1) return view(row.delivery_status === 'delivered' ? row : await set("delivery_status = 'delivered', delivery_signed = NULL", []))
    if (held === null) throw new CozmlingRequestError('not_opted_in', 409)            // the wallet hasn't opted in yet
    const round = Number((await algod.status().do()).lastRound)
    if (row.delivery_signed && round <= Number(row.delivery_last_valid)) {
      try { await algod.sendRawTransaction(new Uint8Array(row.delivery_signed)).do() } catch { /* already sent */ }
      return view(row)
    }
    if ((await holding(address)) !== 1) return view(row)                              // already on its way or gone
    const params = await algod.getTransactionParams().do()
    params.lastValid = BigInt(params.firstValid) + BigInt(VALID_ROUNDS)
    const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: address, receiver: wallet, assetIndex: assetId, amount: 1, suggestedParams: params,
      note: new TextEncoder().encode(`cozmc:starprint:v1:deliver:${row.mint_ref}`) })
    const signed = txn.signTxn(sk)
    const saved = await set("delivery_status = 'sending', delivery_txid = $3, delivery_last_valid = $4, delivery_signed = $5", [txn.txID(), Number(params.lastValid), Buffer.from(signed)])
    try { await algod.sendRawTransaction(signed).do() } catch (error) {
      if (/overspend|balance .* below min/i.test(String(error?.message ?? error))) throw new CozmlingRequestError('issuer_unfunded', 503)
      return view(saved)
    }
    try { await algosdk.waitForConfirmation(algod, txn.txID(), 6) } catch { return view(saved) }
    return view(await set("delivery_status = 'delivered', delivery_signed = NULL", []))
  }

  const publicRecord = serial => findPublicRecord(db, serial)

  return { info, list, mint, deliver, publicRecord, network: net.network }
}
