/* Bring the account database up to this code's tables. Production never does this by itself: run it, after a
   backup (scripts/db-backup.sh), before deploying code that needs a newer version.
     DATABASE_URL=… node scripts/db-migrate.mjs            shows where the database stands and changes nothing
     DATABASE_URL=… node scripts/db-migrate.mjs --apply    applies the migration, in one transaction
   Every change is additive (new tables, columns and wider checks), so the previous code keeps working on the
   migrated database and a site rollback needs no database rollback. The URL is never printed. */
import pg from 'pg'
import { SCHEMA_VERSION } from '../netlify/cozmling/schema.mjs'
import { migrate, schemaVersion } from '../netlify/cozmling/runtime.mjs'
import { transaction } from '../netlify/cozmling/http.mjs'

const url = process.env.DATABASE_URL
if (!url) { console.error('Set DATABASE_URL to the database to migrate.'); process.exit(1) }
const apply = process.argv.includes('--apply')
const db = new pg.Pool({ connectionString: url, max: 1 })
try {
  const before = await schemaVersion(db)
  const host = new URL(url).hostname
  console.log(`Database on ${host}: version ${before || 'none'}; this code needs version ${SCHEMA_VERSION}.`)
  if (before >= SCHEMA_VERSION) {
    console.log('Up to date. Nothing to do.')
  } else if (!apply) {
    console.log('Dry run: nothing changed. Back up first (scripts/db-backup.sh), then run again with --apply.')
  } else {
    await transaction(db, migrate)
    console.log(`Migrated to version ${await schemaVersion(db)}.`)
  }
} finally {
  await db.end()
}
