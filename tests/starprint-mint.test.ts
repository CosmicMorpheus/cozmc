/* Starprint NFTs on TestNet: the asset's fields and public description, and the mint itself against a
   simulated Algorand node on real PostgreSQL (one asset per Starprint, however often or at once it's asked,
   through timeouts and closed windows). The database part runs when COZMLING_TEST_DATABASE_URL names a
   disposable database, as in tests/cozmling-wallet-postgres.test.ts. `npm test` runs the rest. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import algosdk from 'algosdk'
import { assetFields, createMintService, publicMetadata, publicTraits } from '../netlify/cozmling/mint.mjs'

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
/** A TestNet node in memory: transactions confirm a few rounds after they're sent, unless told otherwise. */
function fakeNode({ lose = 0, dropAnswer = 0 } = {}) {
  let round = 1000
  const pool = new Map(), created: number[] = []
  let nextAsset = (assetBase += 1000), losing = lose, dropping = dropAnswer
  const call = (fn: () => any) => ({ do: async () => fn() })
  const tick = () => {
    round++
    for (const [id, t] of pool) if (!t.confirmedRound && round >= t.sentAt + 2 && round <= t.lastValid) { t.confirmedRound = round; t.assetIndex = nextAsset++; created.push(t.assetIndex) }
  }
  return {
    created, pool,
    advance: (n: number) => { for (let i = 0; i < n; i++) tick() },
    getTransactionParams: () => call(() => ({ fee: 0n, minFee: 1000n, flatFee: false, firstValid: BigInt(round), lastValid: BigInt(round + 1000), genesisID: 'testnet-v1.0', genesisHash: new Uint8Array(32) })),
    sendRawTransaction: (raw: Uint8Array) => call(() => {
      if (losing > 0) { losing--; throw new Error('network timeout') }               // never reached the node
      const s = algosdk.decodeSignedTransaction(raw), id = s.txn.txID()
      if (!pool.has(id)) pool.set(id, { sentAt: round, lastValid: Number(s.txn.lastValid) })
      if (dropping > 0) { dropping--; throw new Error('socket hang up') }            // reached it; the answer was lost
      return { txid: id }
    }),
    pendingTransactionInformation: (id: string) => call(() => {
      const t = pool.get(id)
      if (!t) throw new Error('not found')
      return { confirmedRound: t.confirmedRound ? BigInt(t.confirmedRound) : undefined, assetIndex: t.assetIndex ? BigInt(t.assetIndex) : undefined, poolError: '' }
    }),
    status: () => call(() => ({ lastRound: BigInt(round) })),
    statusAfterBlock: (r: number | bigint) => call(() => { tick(); return { lastRound: BigInt(Math.max(Number(r) + 1, round)) } }),
    accountInformation: () => call(() => ({ amount: 25_000_000n })),
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
    const svc = createMintService({ db, origin, algod: node, indexer: noIndexer, dailyCap: 10 })
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
    const s3 = createMintService({ db, origin, algod: n3, indexer: noIndexer, dailyCap: 10 })
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
    const s4 = createMintService({ db, origin, algod: n4, indexer: noIndexer, dailyCap: 10 })
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
    const capped = createMintService({ db, origin, algod: fakeNode(), indexer: noIndexer, dailyCap: 4 })
    const fifth = await companion(addr(), 'hatched')
    const fifthOwner = (await db.query('SELECT wallet_address FROM cozmling_account_companions WHERE companion_id = $1', [fifth])).rows[0].wallet_address
    await assert.rejects(capped.mint(fifthOwner, fifth), /daily_cap_reached/)

    // the public record: confirmed mints only, with nothing private
    const meta = await svc.publicRecord(a.serial)
    assert.equal(publicMetadata(meta, origin).properties.public_name, 'Orbi')
  } finally {
    await db.end()
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})
