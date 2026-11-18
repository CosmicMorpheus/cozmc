import { createHash, randomInt, randomUUID } from 'node:crypto'
import { CozmlingRequestError, transaction } from './http.mjs'

const DAY_MS = 86_400_000
const UTC_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

export const EVENT_LOOKS = Object.freeze({
  'grove-green': Object.freeze({ look: 'a', skin: 'moss' }),
  'grove-violet': Object.freeze({ look: 'b', skin: 'lilac' }),
  'grove-cyan': Object.freeze({ look: 'a', skin: 'sky' }),
})
const LOOK_IDS = Object.keys(EVENT_LOOKS)

function utcTimestamp(value) {
  if (typeof value !== 'string' || !UTC_DATE.test(value)) return NaN
  const time = Date.parse(value)
  const normalized = value.includes('.') ? value : value.replace('Z', '.000Z')
  return Number.isFinite(time) && new Date(time).toISOString() === normalized ? time : NaN
}

export function readEventConfig(raw) {
  if (!raw) return null
  const { eventId, title, opensAt, endsAt, claimUntil, goal, firstPlaces = 0 } = JSON.parse(raw) ?? {}
  const openMs = utcTimestamp(opensAt)
  const endMs = utcTimestamp(endsAt)
  const claimMs = utcTimestamp(claimUntil)
  if (typeof eventId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(eventId) ||
      typeof title !== 'string' || !title.trim() || title.length > 100 ||
      !(openMs < endMs && endMs < claimMs) || endMs - openMs > 14 * DAY_MS ||
      !Number.isSafeInteger(goal) || goal < 1 ||
      !Number.isSafeInteger(firstPlaces) || firstPlaces < 0 || firstPlaces > 100) throw new Error('Invalid Community Hatch preview event configuration.')

  // firstPlaces: how many of the first wallets to light a lantern are named (0: none). Part of the rules once set.
  const rules = [openMs, endMs, claimMs, goal, EVENT_LOOKS, ...(firstPlaces ? [firstPlaces] : [])]
  const fingerprint = createHash('sha256').update(JSON.stringify(rules)).digest('hex')
  return { event: { eventId, title: title.trim(), opensAt, endsAt, claimUntil, goal, ...(firstPlaces ? { firstPlaces } : {}) }, openMs, endMs, claimMs, fingerprint }
}

function phaseAt(config, at) {
  if (at < config.openMs) return 'upcoming'
  if (at < config.endMs) return 'open'
  if (at < config.claimMs) return 'claim'
  return 'ended'
}

/* The first wallets to light a lantern, by when their first one was lit (ties: by address). Only for an event that
   names first places; firstPlaces is a checked whole number (readEventConfig), so it is written into the query. */
const firstWalletsSql = (places) => places ? `,
    (SELECT coalesce(jsonb_agg(wallet_address ORDER BY first_lit, wallet_address), '[]'::jsonb) FROM (
      SELECT wallet_address, min(lit_at) AS first_lit FROM cozmling_hatch_contributions WHERE event_id = $1
      GROUP BY wallet_address ORDER BY first_lit, wallet_address LIMIT ${Number(places)}) first) AS first_wallets` : ''

async function readStatus(db, config, wallet, at) {
  const { rows: [row] } = await db.query(`SELECT
    (SELECT fingerprint FROM cozmling_hatch_events WHERE event_id = $1) AS fingerprint,
    (SELECT count(*) FROM cozmling_hatch_contributions WHERE event_id = $1) AS total,
    EXISTS(SELECT 1 FROM cozmling_hatch_contributions WHERE event_id = $1 AND wallet_address = $2) AS eligible,
    EXISTS(SELECT 1 FROM cozmling_hatch_contributions WHERE event_id = $1 AND wallet_address = $2 AND contribution_day = $3) AS contributed_today,
    (SELECT jsonb_build_object('companionId', companion_id, 'lookId', look_id) FROM cozmling_hatch_claims
      WHERE event_id = $1 AND wallet_address = $2) AS receipt${firstWalletsSql(config.event.firstPlaces)}`,
  [config.event.eventId, wallet, new Date(at).toISOString().slice(0, 10)])
  if (row.fingerprint && row.fingerprint !== config.fingerprint) throw new Error('Use a new event ID for changed Community Hatch rules.')

  const total = Number(row.total)
  return {
    ...config.event,
    phase: phaseAt(config, at), total, eligible: row.eligible, contributedToday: row.contributed_today,
    lanternEligible: row.eligible && total >= config.event.goal,
    receipt: row.receipt, authenticatedWallet: wallet,
    ...(config.event.firstPlaces ? { firstLanterns: row.first_wallets } : {}),
  }
}

export function createCommunityHatchService({ db, config, clock = Date.now, drawIndex = randomInt, receiptId = randomUUID }) {
  const { eventId } = config.event
  return {
    get: (wallet) => readStatus(db, config, wallet, clock()),
    async act(wallet, action) {
      if (!wallet) throw new CozmlingRequestError('wallet_required', 401)
      if (action !== 'contribute' && action !== 'claim') throw new CozmlingRequestError('invalid_action', 400)

      return transaction(db, async (client) => {
        const at = clock()
        const status = await readStatus(client, config, wallet, at)
        if (action === 'contribute' && status.phase !== 'open') throw new CozmlingRequestError('outside_contribution_window', 409)
        if (action === 'claim' && status.receipt) return status
        if (action === 'claim' && status.phase !== 'claim') throw new CozmlingRequestError('outside_claim_window', 409)
        if (action === 'claim' && !status.eligible) throw new CozmlingRequestError('not_eligible', 403)

        await client.query(`INSERT INTO cozmling_hatch_events (event_id, fingerprint) VALUES ($1, $2)
          ON CONFLICT (event_id) DO NOTHING`, [eventId, config.fingerprint])
        if (action === 'contribute') {
          const day = new Date(at).toISOString().slice(0, 10)
          await client.query(`INSERT INTO cozmling_hatch_contributions (event_id, wallet_address, contribution_day)
            VALUES ($1, $2, $3) ON CONFLICT (event_id, wallet_address, contribution_day) DO NOTHING`, [eventId, wallet, day])
        } else {
          const lookId = LOOK_IDS[drawIndex(LOOK_IDS.length)]
          await client.query(`INSERT INTO cozmling_hatch_claims (event_id, wallet_address, companion_id, look_id)
            VALUES ($1, $2, $3, $4) ON CONFLICT (event_id, wallet_address) DO NOTHING`,
          [eventId, wallet, `hatch-${receiptId()}`, lookId])
        }
        return readStatus(client, config, wallet, at)
      })
    },
  }
}
