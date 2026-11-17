/* Pause or resume Starprint minting at once, without a redeploy (a Netlify setting only takes effect on the next
   deploy). While paused nothing new is started, signed or sent; anything queued or already paid for is kept and
   carries on when minting resumes. Reading the Starprints, their descriptions and the rest of the site is unaffected.
     DATABASE_URL=… node scripts/starprint-pause.mjs status
     DATABASE_URL=… node scripts/starprint-pause.mjs on      pause
     DATABASE_URL=… node scripts/starprint-pause.mjs off     resume
   The URL is never printed. */
import pg from 'pg'

const url = process.env.DATABASE_URL
const action = process.argv[2]
if (!url || !['status', 'on', 'off'].includes(action)) { console.error('Usage: DATABASE_URL=… node scripts/starprint-pause.mjs status|on|off'); process.exit(1) }
const db = new pg.Pool({ connectionString: url, max: 1 })
try {
  if (action !== 'status') {
    await db.query(`INSERT INTO cozmc_runtime_flags (name, value) VALUES ('starprint_paused', $1)
      ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`, [action === 'on'])
  }
  const { rows: [row] } = await db.query("SELECT value, updated_at FROM cozmc_runtime_flags WHERE name = 'starprint_paused'")
  console.log(row?.value ? `Starprint minting is PAUSED (since ${row.updated_at.toISOString()}).` : 'Starprint minting is running.')
} catch (error) {
  if (error?.code === '42P01') console.error('This database has no pause table yet: run scripts/db-migrate.mjs --apply first.')
  else throw error
  process.exitCode = 1
} finally {
  await db.end()
}
