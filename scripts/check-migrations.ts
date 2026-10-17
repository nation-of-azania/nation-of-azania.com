/**
 * Fails when the Postgres schema the Payload config describes differs from the
 * latest committed migration snapshot in src/migrations — i.e. a collection,
 * field or block changed without `pnpm migrate:create`.
 *
 *   pnpm migrate:check
 *
 * Needs no database: like migrate:create, it diffs the config against the
 * newest snapshot .json on disk. The production build runs it before
 * migrating Neon, so a forgotten migration fails the deploy (the previous
 * deployment stays live) instead of shipping code whose tables don't exist.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { PostgresAdapter } from '@payloadcms/db-postgres'

// Build the Postgres schema regardless of what .env selects for dev.
process.env.DATABASE_ADAPTER = 'postgres'

const { getPayload } = await import('payload')
const { default: config } = await import('../src/payload.config')

const payload = await getPayload({ config, disableDBConnect: true, disableOnInit: true })
const db = payload.db as unknown as PostgresAdapter
const { generateDrizzleJson, generateMigration, upSnapshot } = db.requireDrizzleKit()

const snapshots = readdirSync(db.migrationDir)
  .filter((file) => file.endsWith('.json'))
  .sort()
const latest = snapshots.at(-1)
if (!latest) {
  console.error(`✖ No migration snapshots in ${db.migrationDir}.`)
  process.exit(1)
}

let committed = JSON.parse(readFileSync(path.join(db.migrationDir, latest), 'utf8'))
const current = await generateDrizzleJson(db.schema)
if (upSnapshot && committed.version < current.version) committed = upSnapshot(committed)

const pending = await generateMigration(committed, current)
if (pending.length > 0) {
  console.error(
    `✖ The schema has changed since the latest migration (${latest}).\n` +
      '  Create one and commit it:  pnpm migrate:create <name>\n\n' +
      '  Statements it would contain:\n' +
      pending.map((statement) => `    ${statement.split('\n')[0]}`).join('\n'),
  )
  process.exit(1)
}

console.log(`✔ Migrations are up to date with the schema (latest: ${latest}).`)
process.exit(0)
