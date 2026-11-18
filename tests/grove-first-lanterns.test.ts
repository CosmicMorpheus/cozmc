/* Light the Grove's first lanterns: the first wallets to light one are named, in the order they lit it, and only
   as many as the event says. Events that don't name any are unchanged (same rules fingerprint, no list).
   The database part runs when COZMLING_TEST_DATABASE_URL names a disposable database. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { readEventConfig } from '../netlify/cozmling/event.mjs'
import { isCommunityHatchStatus } from '../src/cozmling/community/communityHatch'

const base = { eventId: 'grove-test', title: 'Light the Grove', opensAt: '2030-03-01T00:00:00Z', endsAt: '2030-03-03T23:59:59Z', claimUntil: '2030-03-10T00:00:00Z', goal: 12 }

test('naming the first lanterns is a rule of its own; events without it keep their fingerprint', () => {
  const plain = readEventConfig(JSON.stringify(base)), first = readEventConfig(JSON.stringify({ ...base, firstPlaces: 8 }))
  assert.equal(plain.event.firstPlaces, undefined)
  assert.equal(readEventConfig(JSON.stringify({ ...base, firstPlaces: 0 })).fingerprint, plain.fingerprint)
  assert.notEqual(first.fingerprint, plain.fingerprint)
  assert.equal(first.event.firstPlaces, 8)
  assert.throws(() => readEventConfig(JSON.stringify({ ...base, firstPlaces: -1 })))
  assert.throws(() => readEventConfig(JSON.stringify({ ...base, firstPlaces: 2.5 })))
})

test('the page accepts a list no longer than the places, of real addresses', () => {
  const status = { ...base, phase: 'open', total: 0, eligible: false, contributedToday: false, lanternEligible: false, receipt: null, authenticatedWallet: null }
  assert.ok(isCommunityHatchStatus(status))
  assert.ok(isCommunityHatchStatus({ ...status, firstPlaces: 8, firstLanterns: ['A'.repeat(58)] }))
  assert.ok(!isCommunityHatchStatus({ ...status, firstPlaces: 1, firstLanterns: ['A'.repeat(58), 'B'.repeat(58)] }))
  assert.ok(!isCommunityHatchStatus({ ...status, firstPlaces: 8, firstLanterns: ['nope'] }))
})

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('real PostgreSQL: the first wallets to light a lantern, in order, up to the number of places', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { SCHEMA } = await import('../netlify/cozmling/schema.mjs')
  const { createCommunityHatchService } = await import('../netlify/cozmling/event.mjs')
  const ns = `grove_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${ns}`)
  const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${ns}`)
  const db = new pg.Pool({ connectionString: url.toString() })
  try {
    await db.query(SCHEMA)
    let clock = Date.parse('2030-03-01T10:00:00Z')
    const grove = createCommunityHatchService({ db, config: readEventConfig(JSON.stringify({ ...base, firstPlaces: 3 })), clock: () => clock })
    const wallets = ['C', 'A', 'D', 'B'].map(ch => ch.repeat(58))
    for (const w of wallets) await grove.act(w, 'contribute')        // each in its own transaction, so lit in this order
    clock += 86_400_000
    await grove.act(wallets[3], 'contribute')                        // a later lantern doesn't move anyone up
    const status = await grove.get(wallets[1])
    assert.deepEqual(status.firstLanterns, wallets.slice(0, 3), 'the first three, in the order they lit, not by address')
    assert.equal(status.firstPlaces, 3)
    assert.equal(status.total, 5)
    const plain = createCommunityHatchService({ db, config: readEventConfig(JSON.stringify({ ...base, eventId: 'grove-plain' })), clock: () => clock })
    assert.equal((await plain.get(null)).firstLanterns, undefined, 'an event without first places shows no list')
  } finally {
    await db.end(); await admin.query(`DROP SCHEMA ${ns} CASCADE`); await admin.end()
  }
})
