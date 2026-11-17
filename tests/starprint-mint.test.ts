/* Starprint NFTs on TestNet: the asset's fields and public description, and the mint itself against a
   simulated Algorand node on real PostgreSQL (one asset per Starprint, however often or at once it's asked,
   through timeouts and closed windows). The database part runs when COZMLING_TEST_DATABASE_URL names a
   disposable database, as in tests/cozmling-wallet-postgres.test.ts. `npm test` runs the rest. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import algosdk from 'algosdk'
import { assetFields, BONFIRE_ADDRESS, COZMC_ASA, createMintService, feeNote, PACT_VAULT_APP, publicMetadata, publicTraits } from '../netlify/cozmling/mint.mjs'
import * as siteConfig from '../src/config'

const origin = 'https://cozmc-preview.netlify.app'
const addr = () => algosdk.generateAccount().addr.toString()

test('the asset: supply 1, no decimals, STAR, an ASCII name in 32 bytes, no freeze or clawback', () => {
  const manager = addr(), issuer = addr()
  const f = assetFields({ serial: 999999999, origin, manager, issuer, mintRef: 'a'.repeat(24) })
  assert.deepEqual([f.total, f.decimals, f.defaultFrozen, f.unitName, f.freeze, f.clawback], [1, 0, false, 'STAR', undefined, undefined])
  assert.equal(f.assetName, 'Starprint #999999999')
  assert.ok(Buffer.byteLength(f.assetName) <= 32 && Buffer.byteLength(f.assetURL) <= 96)
  assert.match(f.assetURL, /\/api\/starprint-meta\/999999999#arc3$/)
  assert.notEqual(f.manager, f.sender, 'the manager is not the issuer')
  assert.equal(new TextDecoder().decode(f.note), `cozmc:starprint:v1:${'a'.repeat(24)}`)
  const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({ ...f, suggestedParams: { fee: 1000n, minFee: 1000n, firstValid: 1n, lastValid: 41n, genesisID: 'testnet-v1.0', genesisHash: new Uint8Array(32), flatFee: true } })
  assert.equal(txn.assetConfig.total, 1n)
})

test('the public description: serial and Star Chart traits only, never the birthplace or the player', () => {
  const record = { kind: 'adventurer', starprint: { coreSign: 'leo', element: 'fire', archetype: 'The Performer', birthplace: { name: 'Lima', latitude: -12 }, chosenBirthday: '2026-08-01' },
    celestial: { bodies: [{ body: 'sun', sign: 'virgo' }] } }
  const traits = publicTraits(record)
  assert.deepEqual(traits, { sunSign: 'virgo', element: 'fire', archetype: 'The Performer' }, 'the sky-read Sun sign wins over the calendar one')
  const json = JSON.stringify(publicMetadata({ serial: '7', traits, public_name: null }, origin))
  for (const secret of ['Lima', '-12', '2026-08-01', 'latitude', 'birth', 'wallet']) assert.ok(!json.includes(secret), secret)
  assert.equal(publicMetadata({ serial: '7', traits, public_name: 'Orbi' }, origin).properties.public_name, 'Orbi', 'a name only when the player chose to include it')
})

let assetBase = 7000
test('MainNet constants match the site', () => {
  assert.equal(COZMC_ASA, siteConfig.ASA_ID)
  assert.equal(BONFIRE_ADDRESS, siteConfig.BONFIRE_ADDRESS)
  assert.equal(PACT_VAULT_APP, siteConfig.PACT_VAULT_APP)
  assert.equal(siteConfig.STARPRINT_FEE_ALGO, 0.01)
  assert.ok(feeNote('a'.repeat(24)).startsWith(siteConfig.NOTE_STARPRINT_FEE))
})

test('MainNet needs its key from secret storage and a separate manager', () => {
  const issuer = algosdk.generateAccount(), mnemonic = algosdk.secretKeyToMnemonic(issuer.sk)
  const base = { db: null, origin: 'https://cozmc.us', algod: {}, indexer: {}, mainnet: true }
  assert.throws(() => createMintService({ ...base, origin, issuerMnemonic: mnemonic, managerAddress: addr() }), /only be minted from https:\/\/cozmc\.us/, 'never a preview address baked into a MainNet asset')
  assert.throws(() => createMintService({ ...base }), /issuer key and manager/)
  assert.throws(() => createMintService({ ...base, issuerMnemonic: mnemonic, managerAddress: issuer.addr.toString() }), /different account/)
  const svc = createMintService({ ...base, issuerMnemonic: mnemonic, managerAddress: addr() })
  assert.equal(svc.network, 'mainnet')
  assert.equal(createMintService({ ...base, mainnet: false }).network, 'testnet', 'TestNet unless asked')
})

/** A TestNet node in memory: transactions confirm a few rounds after they're sent, unless told otherwise. */
function fakeNode({ lose = 0, dropAnswer = 0 } = {}) {
  let round = 1000
  const pool = new Map(), created: number[] = [], holdings = new Map<string, number>()   // `${address}:${asset}` -> amount
  const key = (who: string, asset: number) => `${who}:${asset}`
  let nextAsset = (assetBase += 1000), losing = lose, dropping = dropAnswer
  const call = (fn: () => any) => ({ do: async () => fn() })
  const tick = () => {
    round++
    for (const [, t] of pool) if (!t.confirmedRound && round >= t.sentAt + 2 && round <= t.lastValid) { t.confirmedRound = round; if (t.txn.type === 'acfg') { t.assetIndex = nextAsset++; created.push(t.assetIndex); holdings.set(key(String(t.txn.sender), t.assetIndex), 1) }
      if (t.txn.type === 'axfer') {
        const x = t.txn.assetTransfer, asset = Number(x.assetIndex), from = String(t.txn.sender), to = String(x.receiver), n = Number(x.amount)
        if (n === 0 && from === to) { if (!holdings.has(key(to, asset))) holdings.set(key(to, asset), 0) }
        else if ((holdings.get(key(from, asset)) ?? 0) >= n && holdings.has(key(to, asset))) { holdings.set(key(from, asset), holdings.get(key(from, asset))! - n); holdings.set(key(to, asset), holdings.get(key(to, asset))! + n) }
      }
    }
  }
  return {
    created, pool,
    advance: (n: number) => { for (let i = 0; i < n; i++) tick() },
    fund: (who: string, asset: number, amount: number) => holdings.set(key(who, asset), amount),
    getTransactionParams: () => call(() => ({ fee: 0n, minFee: 1000n, flatFee: false, firstValid: BigInt(round), lastValid: BigInt(round + 1000), genesisID: 'testnet-v1.0', genesisHash: new Uint8Array(32) })),
    sendRawTransaction: (raw: Uint8Array) => call(() => {
      if (losing > 0) { losing--; throw new Error('network timeout') }               // never reached the node
      const s = algosdk.decodeSignedTransaction(raw), id = s.txn.txID()
      if (!pool.has(id)) pool.set(id, { sentAt: round, lastValid: Number(s.txn.lastValid), txn: s.txn })
      if (dropping > 0) { dropping--; throw new Error('socket hang up') }            // reached it; the answer was lost
      return { txid: id }
    }),
    pendingTransactionInformation: (id: string) => call(() => {
      const t = pool.get(id)
      if (!t) throw new Error('not found')
      return { confirmedRound: t.confirmedRound ? BigInt(t.confirmedRound) : undefined, assetIndex: t.assetIndex ? BigInt(t.assetIndex) : undefined, poolError: '', txn: { txn: t.txn } }
    }),
    status: () => call(() => ({ lastRound: BigInt(round) })),
    statusAfterBlock: (r: number | bigint) => call(() => { tick(); return { lastRound: BigInt(Math.max(Number(r) + 1, round)) } }),
    accountInformation: () => call(() => ({ amount: 25_000_000n })),
    accountAssetInformation: (who: string, asset: number) => call(() => {
      if (!holdings.has(key(who, asset))) throw new Error('account asset info not found')
      return { assetHolding: { amount: BigInt(holdings.get(key(who, asset))!) } }
    }),
    /** an indexer over the same pool */
    indexer: {
      lookupTransactionByID: () => ({ do: async () => { throw new Error('not found') } }),
      searchForTransactions: () => {
        let who = '', at = 0
        const q = { address: (a: string) => { who = a; return q }, round: (r: number) => { at = r; return q }, do: async () => ({
          transactions: [...pool.values()].filter(t => t.confirmedRound === at && String(t.txn.sender) === who).map(t => ({
            txType: t.txn.type, sender: String(t.txn.sender), group: t.txn.group,
            assetTransferTransaction: t.txn.assetTransfer ? { assetId: t.txn.assetTransfer.assetIndex, receiver: String(t.txn.assetTransfer.receiver), amount: t.txn.assetTransfer.amount } : undefined,
          })) }) }
        return q
      },
    },
  }
}
const noIndexer = { lookupTransactionByID: () => ({ do: async () => { throw new Error('not found') } }) }

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('real PostgreSQL: one asset per Starprint through repeats, races, timeouts and a closed window', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { SCHEMA } = await import('../netlify/cozmling/schema.mjs')
  const namespace = `starprint_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${namespace}`)
  const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${namespace}`)
  const db = new pg.Pool({ connectionString: url.toString() })
  try {
    await db.query(SCHEMA)
    const owner = addr(), other = addr()
    const companion = async (wallet: string, status: 'egg' | 'hatched') => {
      const id = randomUUID()
      const record = { kind: 'adventurer', companionId: id, hatch: { status }, starprint: { coreSign: 'aries', element: 'fire', archetype: 'The Pioneer' } }
      await db.query(`INSERT INTO cozmling_account_companions (wallet_address, companion_id, source, snapshot) VALUES ($1, $2, 'ordinary', $3)`, [wallet, id, { record, events: [] }])
      return id
    }

    // 1. a mint, and the same mint asked for again: one asset
    const node = fakeNode()
    const svc = createMintService({ db, origin, algod: node, indexer: noIndexer, dailyCap: 10, feeMicro: 0 })
    const first = await companion(owner, 'hatched')
    const a = await svc.mint(owner, first, { publicName: 'Orbi' })
    assert.equal(a.status, 'confirmed'); assert.ok(a.assetId)
    assert.deepEqual(await svc.mint(owner, first), a, 'asking again changes nothing')
    assert.equal(node.created.length, 1)
    const info = await svc.info()
    assert.match(info.issuer, /^[A-Z2-7]{58}$/); assert.notEqual(info.issuer, info.manager)

    // 2. two requests at the same moment for another wallet's Starprint: still one asset
    const second = await companion(other, 'hatched')
    const [x, y] = await Promise.all([svc.mint(other, second), svc.mint(other, second)])
    assert.equal(node.created.length, 2)
    assert.equal(x.serial, y.serial)

    // 3. a timeout after sending (the node got it, the answer was lost): the retry re-sends the same bytes
    const n3 = fakeNode({ dropAnswer: 1 })
    const s3 = createMintService({ db, origin, algod: n3, indexer: noIndexer, dailyCap: 10, feeMicro: 0 })
    const third = await companion(owner === other ? addr() : addr(), 'hatched')
    const thirdOwner = (await db.query('SELECT wallet_address FROM cozmling_account_companions WHERE companion_id = $1', [third])).rows[0].wallet_address
    const pending = await s3.mint(thirdOwner, third)
    assert.equal(pending.status, 'submitted', 'not reported as minted before the chain says so')
    n3.advance(3)
    const settled = await s3.mint(thirdOwner, third)
    assert.equal(settled.status, 'confirmed'); assert.equal(settled.txid, pending.txid, 'the same transaction, not a new one')
    assert.equal(n3.created.length, 1)

    // 4. the send never arrives and its window closes: only then is a fresh transaction signed
    const n4 = fakeNode({ lose: 1 })
    const s4 = createMintService({ db, origin, algod: n4, indexer: noIndexer, dailyCap: 10, feeMicro: 0 })
    const fourth = await companion(addr(), 'hatched')
    const fourthOwner = (await db.query('SELECT wallet_address FROM cozmling_account_companions WHERE companion_id = $1', [fourth])).rows[0].wallet_address
    const lost = await s4.mint(fourthOwner, fourth)
    assert.equal(lost.status, 'submitted')
    n4.pool.clear()                              // nothing reached the node
    n4.advance(45)                               // past its 40-round window
    const again = await s4.mint(fourthOwner, fourth)
    assert.notEqual(again.txid, lost.txid)
    n4.advance(3)
    const done = await s4.mint(fourthOwner, fourth)
    assert.equal(done.status, 'confirmed'); assert.equal(n4.created.length, 1, 'still one asset')

    // 5. refusals: someone else's Starprint, an egg, and the daily cap
    await assert.rejects(svc.mint(other, first), /companion_missing/)
    await assert.rejects(svc.mint(owner, await companion(owner === owner ? addr() : owner, 'hatched')), /companion_missing/)
    const egg = await companion(addr(), 'egg')
    const eggOwner = (await db.query('SELECT wallet_address FROM cozmling_account_companions WHERE companion_id = $1', [egg])).rows[0].wallet_address
    await assert.rejects(svc.mint(eggOwner, egg), /not_hatched/)
    const capped = createMintService({ db, origin, algod: fakeNode(), indexer: noIndexer, dailyCap: 4, feeMicro: 0 })
    const fifth = await companion(addr(), 'hatched')
    const fifthOwner = (await db.query('SELECT wallet_address FROM cozmling_account_companions WHERE companion_id = $1', [fifth])).rows[0].wallet_address
    await assert.rejects(capped.mint(fifthOwner, fifth), /daily_cap_reached/)

    // 6. the 0.01 ALGO fee: nothing is minted until the player's payment has confirmed, with this mint's note
    const n6 = fakeNode()
    const s6 = createMintService({ db, origin, algod: n6, indexer: noIndexer, dailyCap: 100 })
    const payer = algosdk.generateAccount(), payerAddr = payer.addr.toString()
    const sixth = await companion(payerAddr, 'hatched')
    const asked = await s6.mint(payerAddr, sixth)
    assert.equal(asked.status, 'awaiting_fee')
    assert.deepEqual([asked.fee.amountMicro, asked.fee.network], [10_000, 'testnet'])
    assert.equal(asked.fee.receiver, (await s6.info()).issuer)
    const pay = async (amount: number, note: string, receiver = asked.fee.receiver) => {
      const sp = await n6.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: payerAddr, receiver, amount, note: new TextEncoder().encode(note), suggestedParams: sp })
      await n6.sendRawTransaction(txn.signTxn(payer.sk)).do()
      return txn.txID()
    }
    const cheap = await pay(9_999, asked.fee.note)
    await assert.rejects(s6.mint(payerAddr, sixth, { feeTxid: cheap }), /fee_pending/, 'not confirmed yet')
    n6.advance(3)
    await assert.rejects(s6.mint(payerAddr, sixth, { feeTxid: cheap }), /fee_invalid/, 'too little')
    const wrongNote = await pay(10_000, feeNote('b'.repeat(24))); n6.advance(3)
    await assert.rejects(s6.mint(payerAddr, sixth, { feeTxid: wrongNote }), /fee_invalid/, 'paid for another mint')
    const elsewhere = await pay(10_000, asked.fee.note, addr()); n6.advance(3)
    await assert.rejects(s6.mint(payerAddr, sixth, { feeTxid: elsewhere }), /fee_invalid/, 'not paid to the issuer')
    assert.equal(n6.created.length, 0, 'no asset without a valid fee')
    const good = await pay(10_000, asked.fee.note); n6.advance(3)
    const paidMint = await s6.mint(payerAddr, sixth, { feeTxid: good })
    assert.equal(paidMint.status, 'confirmed'); assert.equal(paidMint.feeTxid, good); assert.equal(n6.created.length, 1)
    // the same payment can't pay for a second Starprint
    await db.query('DELETE FROM cozmling_account_companions WHERE companion_id = $1', [sixth])   // room for another Starprint on this wallet
    const seventh = await companion(payerAddr, 'hatched')
    await s6.mint(payerAddr, seventh)
    await assert.rejects(s6.mint(payerAddr, seventh, { feeTxid: good }), /fee_invalid/)
    assert.equal(n6.created.length, 1)

    // 7. delivery: only after the player opts in, exactly once, and the issuer no longer holds it
    const optIn = async (who: algosdk.Account, asset: number) => {
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: who.addr, receiver: who.addr, assetIndex: asset, amount: 0, suggestedParams: await n6.getTransactionParams().do() })
      await n6.sendRawTransaction(txn.signTxn(who.sk)).do(); n6.advance(3)
    }
    assert.equal(paidMint.delivery.status, 'awaiting_optin')
    await assert.rejects(s6.deliver(payerAddr, sixth), /not_opted_in/)
    await assert.rejects(s6.deliver(addr(), sixth), /companion_missing/)
    await optIn(payer, paidMint.assetId)
    const sent = await s6.deliver(payerAddr, sixth)
    assert.equal(sent.delivery.status, 'delivered')
    assert.equal(Number((await n6.accountAssetInformation(payerAddr, paidMint.assetId).do()).assetHolding.amount), 1)
    assert.equal(Number((await n6.accountAssetInformation((await s6.info()).issuer, paidMint.assetId).do()).assetHolding.amount), 0)
    assert.equal((await s6.deliver(payerAddr, sixth)).delivery.status, 'delivered', 'asking again sends nothing')

    // 8. MainNet: the fee must be paid to the Pact Vault in a group that burns COZMC in the Bonfire
    const nm = fakeNode()
    const issuerM = algosdk.generateAccount()
    const sm = createMintService({ db, origin: 'https://cozmc.us', algod: nm, indexer: nm.indexer, dailyCap: 100, mainnet: true,
      issuerMnemonic: algosdk.secretKeyToMnemonic(issuerM.sk), managerAddress: addr() })
    const player = algosdk.generateAccount(), playerAddr = player.addr.toString()
    const eighth = await companion(playerAddr, 'hatched')
    const askM = await sm.mint(playerAddr, eighth)
    const vault = algosdk.getApplicationAddress(PACT_VAULT_APP).toString()
    assert.deepEqual([askM.fee.network, askM.fee.receiver, askM.fee.burnsCozmc, askM.fee.amountMicro], ['mainnet', vault, true, 10_000])
    nm.fund(playerAddr, COZMC_ASA, 500); nm.fund(BONFIRE_ADDRESS, COZMC_ASA, 0)
    const feeGroup = async (burn: number) => {
      const sp = await nm.getTransactionParams().do()
      const txns = [algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: playerAddr, receiver: vault, amount: 10_000, note: new TextEncoder().encode(askM.fee.note), suggestedParams: sp })]
      if (burn) txns.push(algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: playerAddr, receiver: BONFIRE_ADDRESS, assetIndex: COZMC_ASA, amount: burn, suggestedParams: sp }))
      else txns.push(algosdk.makePaymentTxnWithSuggestedParamsFromObject({ sender: playerAddr, receiver: playerAddr, amount: 0, suggestedParams: sp }))
      algosdk.assignGroupID(txns)
      for (const t of txns) await nm.sendRawTransaction(t.signTxn(player.sk)).do()
      nm.advance(3)
      return txns[0].txID()
    }
    const noBurn = await feeGroup(0)
    await assert.rejects(sm.mint(playerAddr, eighth, { feeTxid: noBurn }), /fee_invalid/, 'paid but nothing burned')
    const burned = await feeGroup(231)
    const mainMint = await sm.mint(playerAddr, eighth, { feeTxid: burned })
    assert.equal(mainMint.status, 'confirmed'); assert.match(mainMint.explorer, /lora\.algokit\.io\/mainnet\//)
    assert.equal(publicMetadata(await sm.publicRecord(mainMint.serial), origin).properties.network, 'mainnet')
    assert.equal((await db.query('SELECT count(*)::int AS n FROM starprint_issuer WHERE network = $1', ['mainnet'])).rows[0].n, 0, 'the MainNet key is never stored')

    // the public record: confirmed mints only, with nothing private
    const meta = await svc.publicRecord(a.serial)
    assert.equal(publicMetadata(meta, origin).properties.public_name, 'Orbi')
  } finally {
    await db.end()
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})

test('the report script uses the same MainNet addresses as the site', async () => {
  const { readFile } = await import('node:fs/promises')
  const script = await readFile(new URL('../scripts/starprint-report.mjs', import.meta.url), 'utf8')
  assert.ok(script.includes(`'${algosdk.getApplicationAddress(siteConfig.PACT_VAULT_APP).toString()}'`), 'Pact Vault')
  assert.ok(script.includes(`'${siteConfig.BONFIRE_ADDRESS}'`) && script.includes(String(siteConfig.ASA_ID)), 'Bonfire and COZMC')
  assert.ok(script.includes(`'${siteConfig.NOTE_STARPRINT_FEE}'`), 'fee note')
})
