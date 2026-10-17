#!/usr/bin/env node
/**
 * Condoria ship script — deploy production with one command:
 *
 *   pnpm ship             migrate Neon → seed production (if Blob token set) → push main
 *   pnpm ship --dry-run   print the plan without executing anything
 *
 * Every step is idempotent, so re-running after a failure (or on every
 * deploy) is safe:
 *   - `payload migrate` applies only migrations that haven't run yet
 *   - `pnpm seed` exits without writing if the admin user already exists
 *   - `git push` is a no-op when main is already up to date
 *
 * Pushing main is what actually deploys: the Vercel Git integration builds
 * and releases https://condoria.vercel.app from the main branch.
 */
import { execSync, spawnSync } from 'node:child_process'
import { loadShipEnv } from './ship-env.mjs'

loadShipEnv()

const DRY_RUN = process.argv.includes('--dry-run')
const PROD_URL = 'https://condoria.vercel.app'

// ── tiny output helpers (plain ASCII fallbacks would be overkill here) ──────
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const fail = (message, hint) => {
  console.error(`\n${red('✖')} ${message}`)
  if (hint) console.error(`  ${dim(hint)}`)
  process.exit(1)
}

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim()

/** Run a command with the user's terminal attached (so auth prompts work). */
const run = (label, command, args) => {
  console.log(`\n${bold(label)}  ${dim(`${command} ${args.join(' ')}`)}`)
  if (DRY_RUN) {
    console.log(dim('  (dry run — skipped)'))
    return
  }
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    fail(`"${command} ${args.join(' ')}" exited with code ${result.status}.`, 'Fix the error above and re-run `pnpm ship` — completed steps are safe to repeat.')
  }
}

// ── preflight ────────────────────────────────────────────────────────────────
console.log(bold('Condoria ship — preflight'))
if (DRY_RUN) console.log(yellow('DRY RUN: nothing will be executed.\n'))

const branch = git('rev-parse --abbrev-ref HEAD')
if (branch !== 'main') {
  fail(`You are on branch "${branch}", but production deploys from main.`, 'Merge your work into main first: git checkout main && git merge ' + branch)
}

if (process.env.DATABASE_ADAPTER !== 'postgres') {
  fail(`DATABASE_ADAPTER is "${process.env.DATABASE_ADAPTER ?? ''}" — this script targets PRODUCTION (Neon).`, 'Set DATABASE_ADAPTER=postgres in .env.ship (production credentials live there, not in .env).')
}
if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is not set in .env.ship.', 'Paste your Neon connection string (Neon dashboard → Connect).')
}
if (!process.env.PAYLOAD_SECRET) {
  fail('PAYLOAD_SECRET is not set (checked .env.ship, then .env).', 'Any long random string works locally; it only needs to match nothing.')
}

const dirty = git('status --porcelain')
if (dirty) {
  console.log(yellow('⚠ Uncommitted changes detected — they will NOT be deployed:'))
  console.log(dim(dirty.split('\n').slice(0, 8).join('\n')))
}

const unpushed = git('rev-list --count origin/main..main')
const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN)

console.log(`
  branch          ${green('main')}${dirty ? yellow('  (dirty working tree)') : ''}
  database        ${green('postgres')} ${dim('(Neon)')}
  commits to push ${unpushed === '0' ? dim('none — already up to date') : green(unpushed)}
  seed step       ${hasBlobToken ? green('yes — Blob token found') : yellow('SKIPPED — no BLOB_READ_WRITE_TOKEN')}`)

if (!hasBlobToken) {
  console.log(
    yellow(`
⚠ Seeding is skipped without BLOB_READ_WRITE_TOKEN in .env: media files would
  be written to your local disk and 404 forever in production. If production
  is not seeded yet, get the token (Vercel → Storage → your Blob store →
  .env.local tab), add it to .env, and re-run pnpm ship. If production is
  already seeded, ignore this.`),
  )
}

// ── the three steps ──────────────────────────────────────────────────────────
run('[1] Apply pending migrations to Neon', 'pnpm', ['payload', 'migrate'])

if (hasBlobToken) {
  run('[2] Seed production (idempotent)', 'pnpm', ['seed'])
} else {
  console.log(`\n${bold('[2] Seed production')}  ${yellow('skipped (no Blob token — see warning above)')}`)
}

run('[3] Push main to GitHub (Vercel deploys it)', 'git', ['push', 'origin', 'main'])

// ── epilogue ─────────────────────────────────────────────────────────────────
console.log(`
${DRY_RUN ? yellow('✔ Dry run complete — nothing was executed.') : green('✔ Shipped.') + ' Vercel is now building main (a few minutes).'}

  site   ${PROD_URL}
  admin  ${PROD_URL}/admin  ${dim('(username login, e.g. your SEED_ADMIN_USERNAME)')}

${dim(`Notes: public pages revalidate within ~2 minutes of content changes.
After the FIRST seed: sign in and change the demo account passwords
(keeper / resident), then delete or keep them as you like.`)}`)
