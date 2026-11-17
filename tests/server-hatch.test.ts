/* Hatching decided by the server, on real PostgreSQL: the egg's wait is set by the server's clock at adoption and
   kept; it can't hatch early; it hatches once, by the server's clock, with its birth chart cast on the server, however
   many devices ask at the same moment; a save can't hatch it or change what the server decided; and production
   doesn't hatch at all until Mark sets the wait. Runs when COZMLING_TEST_DATABASE_URL names a disposable database. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { eggMinimumFrom } from '../netlify/cozmling/account.mjs'

test('the egg wait: 10 minutes on previews (labelled), only what Mark sets in production', () => {
  assert.equal(eggMinimumFrom({}, false), 10 * 60_000)
  assert.equal(eggMinimumFrom({}, true), null, 'production waits for Mark’s setting')
  assert.equal(eggMinimumFrom({ COZMC_EGG_MINIMUM_MINUTES: '1440' }, true), 1440 * 60_000)
  assert.equal(eggMinimumFrom({ COZMC_EGG_MINIMUM_MINUTES: '0' }, false), 0)
  assert.equal(eggMinimumFrom({ COZMC_EGG_MINIMUM_MINUTES: 'soon' }, true), null)
})

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('real PostgreSQL: the server decides when and how an egg hatches', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { SCHEMA } = await import('../netlify/cozmling/schema.mjs')
  const { createAccountService } = await import('../netlify/cozmling/account.mjs')
  const { companionProblem } = await import('../src/cozmling/store/validators')
  const { hatchWithSky, provisionalStarprint } = await import('../src/cozmling/celestial/chart')
  const { newAdventurer } = await import('../src/cozmling/domain/adventurer')
  const namespace = `hatch_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${namespace}`)
  const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${namespace}`)
  const db = new pg.Pool({ connectionString: url.toString() })
  const wallet = 'A'.repeat(58)
  const egg = (clientNow: number) => {
    const choices = { name: 'Luna', birthday: '2026-11-04', look: 'a' as const, skin: 'teal' }
    return newAdventurer(choices, { companionId: randomUUID(), now: clientNow, starprint: provisionalStarprint(choices.birthday, clientNow) ?? undefined })
  }
  try {
    await db.query(SCHEMA)
    const account = createAccountService({ db, validateRecord: companionProblem, hatchRecord: hatchWithSky })   // a 10-minute preview wait

    // a browser whose clock is far ahead can't adopt at all; one that's hours off still gets the server's wait
    await assert.rejects(account.adopt(wallet, { record: egg(Date.now() + 40 * 86_400_000), events: [] }), /invalid_starter/)
    const lying = Date.now() + 12 * 3_600_000
    const adopted = await account.adopt(wallet, { record: egg(lying), events: [] })
    const id = adopted.companion.snapshot.record.companionId
    const { rows: [row] } = await db.query('SELECT created_at, hatch_eligible_at FROM cozmling_account_companions WHERE companion_id = $1', [id])
    const wait = new Date(row.hatch_eligible_at).getTime() - new Date(row.created_at).getTime()
    assert.ok(Math.abs(wait - 10 * 60_000) < 2000, `the wait is the server's 10 minutes (${wait} ms)`)
    assert.equal((await account.list(wallet)).companions[0].hatchReadyAt, new Date(row.hatch_eligible_at).getTime(), 'the page is told when it may hatch')

    // too early: refused, with when it can hatch, labelled as the preview's wait
    await assert.rejects(account.hatch(wallet, { companionId: id }), (e: any) => e.message === 'egg_not_ready' && e.fields.readyAt > Date.now() && e.fields.preview === true && e.fields.minutes === 10)
    // and a save can't hatch it either
    const byClient = hatchWithSky(adopted.companion.snapshot.record, lying, 'UTC')!
    await assert.rejects(account.save(wallet, { expectedRevision: 0, opId: randomUUID(), snapshot: {
      record: { ...byClient, revision: 1, updatedAt: lying }, events: [...adopted.companion.snapshot.events, { eventId: `hatched:${id}`, companionId: id, type: 'hatched', at: lying }],
    } }), /hatch_on_server/)

    // once the wait is over, three devices ask at once: one hatch, by the server's clock, with its chart
    await db.query("UPDATE cozmling_account_companions SET hatch_eligible_at = now() - interval '1 second' WHERE companion_id = $1", [id])
    const before = Date.now()
    const [a, b, c] = await Promise.all([1, 2, 3].map(() => account.hatch(wallet, { companionId: id, timeZone: 'America/New_York' })))
    assert.deepEqual(a, b); assert.deepEqual(b, c)
    const hatched = a.companion.snapshot.record
    assert.equal(hatched.hatch.status, 'hatched')
    assert.ok(hatched.hatch.hatchedAt >= before && hatched.hatch.hatchedAt <= Date.now(), 'hatched by the server’s clock, not the browser’s')
    assert.equal(hatched.celestial?.kind, 'birth', 'its birth chart was cast on the server')
    assert.equal(a.companion.snapshot.events.filter((e: any) => e.type === 'hatched').length, 1)
    const { rows: [after] } = await db.query('SELECT hatched_at, revision FROM cozmling_account_companions WHERE companion_id = $1', [id])
    assert.equal(new Date(after.hatched_at).getTime(), hatched.hatch.hatchedAt, 'the hatch time is saved once, on the server')
    assert.equal(after.revision, 1)
    assert.equal(a.companion.hatchReadyAt, undefined)

    // a save can't change the hatch, the chart or the Starprint the server decided
    const base = a.companion.snapshot
    for (const forged of [
      { ...hatched, hatch: { ...hatched.hatch, hatchedAt: hatched.hatch.hatchedAt - 86_400_000 } },
      { ...hatched, celestial: { ...hatched.celestial!, calculatedAt: 1 } },
      { ...hatched, starprint: { ...hatched.starprint, coreSign: hatched.starprint.coreSign === 'leo' ? 'virgo' : 'leo' } },
    ]) {
      await assert.rejects(account.save(wallet, { expectedRevision: 1, opId: randomUUID(), snapshot: { record: { ...forged, revision: 2, updatedAt: hatched.updatedAt + 1 }, events: base.events } }),
        /immutable_companion|invalid_snapshot/)          // refused, by the hatch rule or by the record check before it
    }
    // ordinary play still saves
    const played = await account.save(wallet, { expectedRevision: 1, opId: randomUUID(), snapshot: { record: { ...hatched, name: 'Nova', revision: 2, updatedAt: hatched.updatedAt + 1 }, events: base.events } })
    assert.equal(played.companion.snapshot.record.name, 'Nova')

    // production before Mark sets the wait: adoption works, hatching waits for the setting
    const live = createAccountService({ db, validateRecord: companionProblem, hatchRecord: hatchWithSky, eggMinimumMs: null, previewHatch: false, ordinaryLimit: 10 })
    const liveEgg = await live.adopt(wallet, { record: egg(Date.now()), events: [] })
    await assert.rejects(live.hatch(wallet, { companionId: liveEgg.companion.snapshot.record.companionId }), /hatch_unconfigured/)
    // someone else's egg
    await assert.rejects(account.hatch('B'.repeat(58), { companionId: id }), /companion_missing/)
  } finally {
    await db.end()
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})
