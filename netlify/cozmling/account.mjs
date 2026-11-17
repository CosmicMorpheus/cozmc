import { createHash } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { EVENT_LOOKS } from './event.mjs'
import { CozmlingRequestError, transaction } from './http.mjs'

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const SKINS = ['teal', 'lilac', 'moss', 'rose', 'sky', 'pearl']
const EVENT_TYPES = new Set(['adopted', 'hatched', 'care', 'arcade-run', 'customized', 'sky-read', 'story', 'choice-story', 'story-mode'])

const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const time = (value) => Number.isSafeInteger(value) && value >= 0
const fail = (code, status = 400, fields) => { throw new CozmlingRequestError(code, status, fields) }
const publicCompanion = (row) => ({
  revision: row.revision, snapshot: row.snapshot,
  // an egg the server knows the hatching time of: when it may hatch (server time)
  ...(row.hatch_eligible_at && row.snapshot?.record?.hatch?.status === 'egg' ? { hatchReadyAt: new Date(row.hatch_eligible_at).getTime() } : {}),
})

/** How long an egg waits before it may hatch. Previews: COZMC_EGG_MINIMUM_MINUTES, or 10 minutes, labelled as a
    preview setting. Production: only what Mark sets in COZMC_EGG_MINIMUM_MINUTES (null until then: no hatching). */
export const PREVIEW_EGG_MINIMUM_MINUTES = 10
export function eggMinimumFrom(env, production) {
  const raw = env?.COZMC_EGG_MINIMUM_MINUTES
  const n = Number(raw)
  if (raw != null && raw !== '' && Number.isFinite(n) && n >= 0 && n <= 60 * 24 * 30) return Math.round(n * 60_000)
  return production ? null : PREVIEW_EGG_MINIMUM_MINUTES * 60_000
}

/** A real IANA time zone name, or UTC. */
function timeZoneOrUtc(value) {
  if (typeof value !== 'string' || !value || value.length > 64) return 'UTC'
  try { return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone } catch { return 'UTC' }
}

function validCompanionId(id) {
  return typeof id === 'string' && UUID.test(id.startsWith('hatch-') ? id.slice(6) : id)
}

function checkSnapshot(input, validateRecord) {
  if (!object(input) || !object(input.record) || !Array.isArray(input.events)) fail('invalid_snapshot')
  const { record, events } = input
  if (!validCompanionId(record.companionId) || record.kind !== 'adventurer' || validateRecord(record) ||
      !object(record.hatch) || !object(record.progress) || !object(record.care) ||
      !object(record.starprint) || !object(record.appearance) || typeof record.name !== 'string' ||
      !time(record.createdAt) || !time(record.updatedAt) || record.updatedAt < record.createdAt ||
      !Array.isArray(record.walletLinks) || record.walletLinks.length || record.archived !== undefined ||
      !object(record.progress.counters) || Object.values(record.progress.counters).some((value) => !time(value))) {
    fail('invalid_snapshot')
  }
  if (record.hatch.provenance !== 'known' ||
      (record.hatch.status === 'egg' ? record.hatch.hatchedAt !== null : !time(record.hatch.hatchedAt))) {
    fail('invalid_snapshot')
  }
  const eventIds = new Set()
  for (const event of events) {
    if (!object(event) || !EVENT_TYPES.has(event.type) || event.companionId !== record.companionId ||
        !time(event.at) || typeof event.eventId !== 'string' || !event.eventId.length || event.eventId.length > 180 ||
        eventIds.has(event.eventId) || (event.data !== undefined && !object(event.data))) fail('invalid_snapshot')
    eventIds.add(event.eventId)
  }
  return { record, events }
}

function checkStarter(snapshot) {
  const { record, events } = snapshot
  const { appearance, hatch, care, progress, starprint } = record
  const name = record.name.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').slice(0, 14).trim()
  const birthday = new Date(`${starprint.chosenBirthday}T00:00:00Z`)
  if (!Number.isFinite(birthday.getTime()) || birthday.getUTCFullYear() < 1900 || birthday.getUTCFullYear() > 2200 ||
      birthday.toISOString().slice(0, 10) !== starprint.chosenBirthday || !name || name !== record.name ||
      record.revision !== 0 || record.updatedAt !== record.createdAt || hatch.status !== 'egg' ||
      record.createdAt > Date.now() + 30 * 86_400_000 ||                // a clock a month or more ahead of the server's

      record.celestial !== undefined || starprint.status === 'calculated' ||
      appearance.rendererVersion !== 'original-1' || !SKINS.includes(appearance.skin) ||
      appearance.outfit !== 'starter' || appearance.home !== 'grove' || appearance.decor.length || appearance.tool !== undefined ||
      care.food !== 80 || care.fun !== 80 || care.energy !== 90 || care.asleepAt !== null ||
      care.ruleVersion !== 'v1-care' || care.settledAt !== record.createdAt ||
      progress.experience !== 0 || progress.visualStage !== null || progress.visualStageVersion !== 'fixture-1' ||
      Object.keys(progress.counters).length || events.length > 1 ||
      (events.length === 1 && (events[0].type !== 'adopted' || events[0].eventId !== `adopted:${record.companionId}`))) {
    fail('invalid_starter')
  }
}

function checkHistory(previous, next) {
  const old = previous.record
  const now = next.record
  if (now.createdAt !== old.createdAt || now.revision < old.revision ||
      now.starprint.chosenBirthday !== old.starprint.chosenBirthday ||
      (old.hatch.status === 'hatched' && !isDeepStrictEqual(now.hatch, old.hatch)) ||
      (old.celestial !== undefined && !isDeepStrictEqual(now.celestial, old.celestial))) fail('immutable_companion', 409)

  const byId = new Map(next.events.map((event) => [event.eventId, event]))
  if (previous.events.some((event) => !isDeepStrictEqual(event, byId.get(event.eventId)))) fail('history_changed', 409)
}

/* Hatching belongs to the server: a save can't hatch an egg, add a hatch to its history, or change a hatch or birth
   chart the server made. (Companions hatched before the server decided hatches keep their own, as before.) */
function checkServerHatch(current, next) {
  const old = current.snapshot.record, now = next.record
  if (old.hatch.status === 'egg') {
    if (now.hatch.status !== 'egg' || now.celestial !== undefined || next.events.some((e) => e.type === 'hatched')) fail('hatch_on_server', 409)
  } else if (current.hatched_at && (!isDeepStrictEqual(now.hatch, old.hatch) || !isDeepStrictEqual(now.celestial, old.celestial) ||
      !isDeepStrictEqual(now.starprint, old.starprint))) {
    fail('immutable_companion', 409)
  }
}

function requestHash(expectedRevision, snapshot) {
  const ordered = JSON.stringify({ expectedRevision, snapshot }, (_key, value) => object(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]])) : value)
  return createHash('sha256').update(ordered).digest('hex')
}

/** How many Starprints one wallet may adopt: 10 (Mark's cap, Nov 17, 2026), unless COZMC_STARPRINTS_PER_WALLET
    sets another whole number from 1 to 100. Mystery eggs from events are counted separately. */
export const STARPRINTS_PER_WALLET = 10
export function ordinaryLimitFrom(env) {
  const n = Number(env?.COZMC_STARPRINTS_PER_WALLET ?? STARPRINTS_PER_WALLET)
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : STARPRINTS_PER_WALLET
}

/* hatchRecord(record, now, timeZone): the hatched record with its birth chart, cast on the server (the function
   passes celestial/chart.ts's hatchWithSky). eggMinimumMs: see eggMinimumFrom; previewHatch labels the wait. */
export function createAccountService({ db, validateRecord, ordinaryLimit = STARPRINTS_PER_WALLET,
  eggMinimumMs = PREVIEW_EGG_MINIMUM_MINUTES * 60_000, previewHatch = true, hatchRecord = null }) {
  return {
    async list(wallet) {
      if (!wallet) fail('wallet_required', 401)
      const { rows } = await db.query(`SELECT revision, snapshot, hatch_eligible_at FROM cozmling_account_companions
        WHERE wallet_address = $1 ORDER BY created_at, companion_id`, [wallet])
      return { companions: rows.map(publicCompanion) }
    },
    async adopt(wallet, input) {
      if (!wallet) fail('wallet_required', 401)
      const snapshot = checkSnapshot(input, validateRecord)
      checkStarter(snapshot)
      const { record } = snapshot
      const id = record.companionId
      const source = id.startsWith('hatch-') ? 'event' : 'ordinary'

      return transaction(db, async (client) => {
        let eventId = null
        if (source === 'ordinary') {
          // one wallet at a time, so two devices can't both slip under the limit
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`cozmling-ordinary:${wallet}`])
          const { rows: mine } = await client.query(`SELECT companion_id, revision, snapshot, hatch_eligible_at FROM cozmling_account_companions
            WHERE wallet_address = $1 AND source = 'ordinary' ORDER BY created_at DESC, companion_id DESC`, [wallet])
          const same = mine.find(row => row.companion_id === id)
          if (same) return { companion: publicCompanion(same) }                  // a repeat of this adoption
          if (mine.length >= ordinaryLimit) return { companion: publicCompanion(mine[0]) }   // at the limit: the latest one
        }
        if (source === 'event') {
          const { rows: [claim] } = await client.query(`SELECT event_id, look_id FROM cozmling_hatch_claims
            WHERE wallet_address = $1 AND companion_id = $2`, [wallet, id])
          const look = claim && EVENT_LOOKS[claim.look_id]
          if (!look || look.look !== record.appearance.appearanceOption || look.skin !== record.appearance.skin) {
            fail('invalid_hatch_claim', 403)
          }
          eventId = claim.event_id
        }

        const starter = { record, events: [{ eventId: `adopted:${id}`, companionId: id, type: 'adopted',
          at: record.createdAt, data: { sign: record.starprint.coreSign } }] }
        // when it may hatch is set now, once, by the server's clock (or at its first hatch, if the wait isn't set yet)
        const { rows: [created] } = await client.query(`INSERT INTO cozmling_account_companions
          (wallet_address, companion_id, source, event_id, snapshot, hatch_eligible_at)
          VALUES ($1, $2, $3, $4, $5, CASE WHEN $6::double precision IS NULL THEN NULL ELSE now() + make_interval(secs => $6::double precision / 1000) END)
          ON CONFLICT DO NOTHING RETURNING revision, snapshot, hatch_eligible_at`, [wallet, id, source, eventId, JSON.stringify(starter), eggMinimumMs])
        if (created) return { companion: publicCompanion(created) }
        if (source === 'ordinary') fail('adoption_conflict', 409)               // that id belongs to another wallet

        // A competing insert can have committed after our INSERT took its statement snapshot.
        // Read in a separate statement before returning the existing companion.
        const { rows: [existing] } = await client.query(`SELECT revision, snapshot, hatch_eligible_at FROM cozmling_account_companions
          WHERE wallet_address = $1 AND source = $2 AND event_id IS NOT DISTINCT FROM $3`, [wallet, source, eventId])
        if (!existing) fail('adoption_conflict', 409)
        return { companion: publicCompanion(existing) }
      })
    },
    /* The egg hatches, decided here: by the server's clock, once its wait is over, with its birth chart cast here.
       A repeat, or a request at the same moment from another device, gets the same hatched Starprint. */
    async hatch(wallet, input) {
      if (!wallet) fail('wallet_required', 401)
      const id = input?.companionId
      if (!validCompanionId(id)) fail('invalid_companion')
      if (typeof hatchRecord !== 'function') fail('hatch_unavailable', 503)
      const timeZone = timeZoneOrUtc(input?.timeZone)

      return transaction(db, async (client) => {
        const { rows: [row] } = await client.query(`SELECT revision, snapshot, created_at, hatch_eligible_at, hatched_at
          FROM cozmling_account_companions WHERE wallet_address = $1 AND companion_id = $2 FOR UPDATE`, [wallet, id])
        if (!row) fail('companion_missing', 404)
        const { record, events } = row.snapshot
        if (record.hatch.status === 'hatched') return { companion: publicCompanion(row) }          // already hatched: the same answer
        if (eggMinimumMs == null && !row.hatch_eligible_at) fail('hatch_unconfigured', 503)

        // when it may hatch: saved once (at adoption, or now if it wasn't known then)
        let eligible = row.hatch_eligible_at ? new Date(row.hatch_eligible_at).getTime() : new Date(row.created_at).getTime() + eggMinimumMs
        if (!row.hatch_eligible_at) {
          await client.query(`UPDATE cozmling_account_companions SET hatch_eligible_at = to_timestamp($3::double precision / 1000)
            WHERE wallet_address = $1 AND companion_id = $2 AND hatch_eligible_at IS NULL`, [wallet, id, eligible])
        }
        const now = Date.now()
        if (now < eligible) fail('egg_not_ready', 409, { readyAt: eligible, ...(previewHatch ? { preview: true, minutes: Math.round(eggMinimumMs / 60_000) } : {}) })

        const hatched = hatchRecord(record, now, timeZone)
        if (!hatched || hatched.hatch?.status !== 'hatched' || hatched.celestial === undefined) fail('sky_unavailable', 503)   // never hatch without its chart
        const next = { ...hatched, revision: record.revision + 1, updatedAt: Math.max(now, record.updatedAt) }
        if (validateRecord(next)) fail('sky_unavailable', 503)
        const snapshot = { record: next, events: [...events.filter((e) => e.type !== 'hatched'), { eventId: `hatched:${id}`, companionId: id, type: 'hatched', at: now }] }
        const { rows: [updated] } = await client.query(`UPDATE cozmling_account_companions
          SET revision = revision + 1, snapshot = $3, hatched_at = to_timestamp($4::double precision / 1000)
          WHERE wallet_address = $1 AND companion_id = $2 RETURNING revision, snapshot, hatch_eligible_at`, [wallet, id, JSON.stringify(snapshot), now])
        return { companion: publicCompanion(updated) }
      })
    },
    async save(wallet, input) {
      if (!wallet) fail('wallet_required', 401)
      if (!time(input.expectedRevision) || typeof input.opId !== 'string' || !UUID.test(input.opId)) fail('invalid_save')
      const { expectedRevision, opId } = input
      const snapshot = checkSnapshot(input.snapshot, validateRecord)
      const hash = requestHash(expectedRevision, snapshot)
      const id = snapshot.record.companionId

      return transaction(db, async (client) => {
        const { rows: [current] } = await client.query(`SELECT revision, snapshot, hatched_at FROM cozmling_account_companions
          WHERE wallet_address = $1 AND companion_id = $2 FOR UPDATE`, [wallet, id])
        if (!current) fail('companion_missing', 404)

        const { rows: [applied] } = await client.query(`SELECT payload_hash FROM cozmling_account_save_operations
          WHERE wallet_address = $1 AND companion_id = $2 AND op_id = $3`, [wallet, id, opId])
        if (applied) {
          if (applied.payload_hash !== hash) fail('operation_reused', 409)
          return { companion: publicCompanion(current) }
        }
        if (current.revision !== expectedRevision) fail('stale_save', 409, { companion: publicCompanion(current) })
        checkHistory(current.snapshot, snapshot)
        checkServerHatch(current, snapshot)

        const { rows: [updated] } = await client.query(`UPDATE cozmling_account_companions
          SET revision = revision + 1, snapshot = $3 WHERE wallet_address = $1 AND companion_id = $2
          RETURNING revision, snapshot`, [wallet, id, JSON.stringify(snapshot)])
        await client.query(`INSERT INTO cozmling_account_save_operations (wallet_address, companion_id, op_id, payload_hash)
          VALUES ($1, $2, $3, $4)`, [wallet, id, opId, hash])
        return { companion: publicCompanion(updated) }
      })
    },
  }
}
