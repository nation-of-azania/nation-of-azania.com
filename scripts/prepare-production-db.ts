/**
 * The database step of a production build (run by scripts/vercel-build.mjs):
 *
 *   1. refuse a database that was ever dev-pushed (README → Database adapters)
 *   2. apply pending migrations from src/migrations
 *   3. on the very first deploy only, bootstrap the admin account, the
 *      categories and the About page (src/seed/bootstrap.ts)
 *
 * Idempotent: migrations apply only when pending, and the bootstrap only acts
 * while the users table is empty.
 */
import config from '@payload-config'
import type { PostgresAdapter } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'

import { bootstrapProduction } from '../src/seed/bootstrap'

if (process.env.DATABASE_ADAPTER !== 'postgres') {
  console.error('✖ prepare-production-db only runs against Postgres (DATABASE_ADAPTER=postgres).')
  process.exit(1)
}

try {
  const payload = await getPayload({ config })
  const db = payload.db as unknown as PostgresAdapter

  // `payload migrate` answers a dev-pushed database with an interactive "data
  // loss will occur" prompt, which a build can't answer (it would exit 0 and
  // skip the migrations). Stop with instructions before it gets there.
  const { rows } = await db.execute({
    drizzle: db.drizzle,
    raw: `SELECT to_regclass('"payload_migrations"') AS exists;`,
  })
  if (rows[0]?.exists) {
    const devPushed = await payload.count({
      collection: 'payload-migrations',
      where: { batch: { equals: -1 } },
    })
    if (devPushed.totalDocs > 0) {
      throw new Error(
        'The production database was dev-pushed at some point (payload_migrations has a batch -1 row). ' +
          'If its tables match the committed migrations, run `DELETE FROM payload_migrations WHERE batch = -1;` ' +
          'in the Neon SQL editor and redeploy. See README → Database adapters.',
      )
    }
  }

  await payload.db.migrate()
  await bootstrapProduction(payload)

  console.log('✔ Production database is migrated and ready.')
  process.exit(0)
} catch (error) {
  console.error('✖ Preparing the production database failed:', error)
  process.exit(1)
}
