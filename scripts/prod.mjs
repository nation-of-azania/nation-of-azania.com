#!/usr/bin/env node
/**
 * Run any Payload CLI command against PRODUCTION (credentials from .env.ship):
 *
 *   pnpm prod migrate:status
 *   pnpm prod migrate:create my-schema-change
 *   pnpm prod run src/seed/verify.ts
 *
 * Local dev (.env, SQLite) stays untouched.
 */
import { spawnSync } from 'node:child_process'
import { loadShipEnv } from './ship-env.mjs'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: pnpm prod <payload-cli-args>   e.g. pnpm prod migrate:status')
  process.exit(1)
}

loadShipEnv()
const result = spawnSync('pnpm', ['payload', ...args], { stdio: 'inherit', shell: true })
process.exit(result.status ?? 1)
