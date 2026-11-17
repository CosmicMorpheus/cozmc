import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createAccountService } from '../netlify/cozmling/account.mjs'
import { hatchWithSky, provisionalStarprint } from '../src/cozmling/celestial/chart'
import { newAdventurer } from '../src/cozmling/domain/adventurer'
import { companionProblem } from '../src/cozmling/store/validators'
import type { AdventurerCompanion, JourneyEvent } from '../src/cozmling/types'

type Snapshot = { record: AdventurerCompanion; events: JourneyEvent[] }
type Saved = { revision: number; snapshot: Snapshot; created_at?: Date; hatch_eligible_at?: Date | null }
const wallet = 'A'.repeat(58)
const otherWallet = 'B'.repeat(58)

function accountDatabase(wallet: string, companionId: string, eventId: string | null) {
  let saved: Saved | null = null
  const applied = new Map<unknown, unknown>()
  const db = {
    async connect() { return this },
    release() {},
    async query(sql: string, params: unknown[] = []) {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      if (sql.includes('FROM cozmling_hatch_claims')) {
        assert.deepEqual(params, [wallet, companionId])
        return { rows: eventId ? [{ event_id: eventId, look_id: 'grove-violet' }] : [] }
      }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [] }               // the per-wallet adoption lock
      if (sql.startsWith('INSERT INTO cozmling_account_companions')) {
        assert.deepEqual(params.slice(0, 4), [wallet, companionId, eventId ? 'event' : 'ordinary', eventId])
        assert.equal(saved, null)
        saved = { revision: 0, snapshot: JSON.parse(String(params[4])), created_at: new Date(0), hatch_eligible_at: new Date(0) }   // its wait long over
        return { rows: [saved] }
      }
      if (sql.startsWith('UPDATE cozmling_account_companions')) {
        assert.deepEqual(params.slice(0, 2), [wallet, companionId])
        assert.ok(saved)
        saved = { ...saved, revision: saved.revision + 1, snapshot: JSON.parse(String(params[2])) }
        return { rows: [saved] }
      }
      if (sql.includes('cozmling_account_save_operations')) {
        assert.deepEqual(params.slice(0, 2), [wallet, companionId])
        if (sql.startsWith('INSERT')) applied.set(params[2], params[3])
        const hash = applied.get(params[2])
        return { rows: hash ? [{ payload_hash: hash }] : [] }
      }
      if (sql.includes('FROM cozmling_account_companions')) {
        return { rows: params[0] === wallet && saved ? [{ companion_id: companionId, ...saved }] : [] }
      }
      assert.fail('Unexpected account query')
    },
  }
  return db
}

for (const source of ['ordinary', 'event'] as const) {
  test(`the production Cozmling model can adopt, hatch and restore an ${source} egg`, async () => {
    const eventId = source === 'event' ? 'light-the-grove' : null
    const companionId = eventId ? `hatch-${randomUUID()}` : randomUUID()
    const db = accountDatabase(wallet, companionId, eventId)
    const account = createAccountService({ db, validateRecord: companionProblem, hatchRecord: hatchWithSky })
    const now = Date.parse('2026-11-18T16:30:55Z')
    const choices = { name: 'Luna', birthday: '2026-11-04', look: 'b' as const, skin: 'lilac' }
    const starprint = provisionalStarprint(choices.birthday, now)
    assert.ok(starprint)
    const egg = newAdventurer(choices, { companionId, now, starprint })
    const added = await account.adopt(wallet, { record: egg, events: [] })
    assert.equal(added.companion.snapshot.record.hatch.status, 'egg')
    assert.equal(added.companion.snapshot.events[0].type, 'adopted')

    // a save can't hatch it: the server does, with its own clock and chart
    const at = now + 60_000
    const byClient = hatchWithSky(egg, at, 'America/New_York')
    assert.ok(byClient?.kind === 'adventurer')
    await assert.rejects(account.save(wallet, { expectedRevision: 0, opId: randomUUID(), snapshot: {
      record: { ...byClient, revision: 1, updatedAt: at },
      events: [...added.companion.snapshot.events, { eventId: `hatched:${companionId}`, companionId, type: 'hatched', at }],
    } }), /hatch_on_server/)
    const saved = await account.hatch(wallet, { companionId, timeZone: 'America/New_York' })

    assert.equal(saved.companion.revision, 1)
    assert.equal(saved.companion.snapshot.record.celestial?.kind, 'birth')
    assert.equal(saved.companion.snapshot.record.starprint.status, 'calculated')
    assert.deepEqual(await account.hatch(wallet, { companionId }), saved, 'asking again returns the same hatch')
    assert.deepEqual(await account.list(wallet), { companions: [saved.companion] })
    assert.deepEqual(await account.list(otherWallet), { companions: [] })
  })
}
