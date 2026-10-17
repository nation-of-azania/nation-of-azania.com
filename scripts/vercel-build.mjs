#!/usr/bin/env node
/**
 * Vercel's build command (vercel.json → "buildCommand": "pnpm vercel-build").
 * Pushing main is the whole deploy: Vercel builds it with this script.
 *
 * A production build prepares the database before building the site:
 *   1. pnpm migrate:check          fail if the schema changed without a migration
 *   2. prepare-production-db.ts    apply pending migrations to Neon; on the very
 *                                  first deploy, create the admin account,
 *                                  categories and the About page
 *   3. pnpm build                  next build (prerenders against the migrated DB)
 *
 * Any failure fails the deployment and Vercel keeps serving the previous one.
 * Non-production builds (vercel.json only deploys main, so there should be
 * none) skip steps 1–2 and never write to a database.
 */
import { spawnSync } from 'node:child_process'

const isProduction = process.env.VERCEL_ENV === 'production'

const fail = (message) => {
  console.error(`\n\x1b[31m✖\x1b[0m ${message}`)
  process.exit(1)
}

const run = (label, args) => {
  console.log(`\n\x1b[1m${label}\x1b[0m  \x1b[2mpnpm ${args.join(' ')}\x1b[0m`)
  const result = spawnSync('pnpm', args, { stdio: 'inherit' })
  if (result.status !== 0) fail(`${label} failed (exit code ${result.status}).`)
}

// Absolute links (metadataBase, Open Graph) need the public origin. Vercel
// provides the production domain, so the variable is optional there.
if (!process.env.NEXT_PUBLIC_SERVER_URL && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  process.env.NEXT_PUBLIC_SERVER_URL = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
}

if (isProduction) {
  const missing = ['PAYLOAD_SECRET', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN'].filter(
    (name) => !process.env[name],
  )
  if (missing.length > 0) {
    fail(
      `Missing production environment variables: ${missing.join(', ')}.\n` +
        '  Set them in Vercel → Project → Settings → Environment Variables (Production). See README → Deploying.',
    )
  }
  if (process.env.DATABASE_ADAPTER !== 'postgres') {
    fail('DATABASE_ADAPTER must be "postgres" in production (Vercel → Settings → Environment Variables).')
  }

  run('[1/3] Check migrations', ['migrate:check'])
  run('[2/3] Migrate Neon and bootstrap', ['payload', 'run', 'scripts/prepare-production-db.ts'])
  run('[3/3] Build the site', ['build'])
} else {
  console.log(`VERCEL_ENV is "${process.env.VERCEL_ENV ?? ''}", not production: building without touching a database.`)
  run('Build the site', ['build'])
}
