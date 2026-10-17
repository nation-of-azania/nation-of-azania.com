/**
 * Loads production credentials from .env.ship (git-ignored), falling back to
 * .env for anything not set there (e.g. PAYLOAD_SECRET). Used by ship.mjs and
 * prod.mjs so `.env` itself can stay pointed at local SQLite dev — pointing
 * `.env` at Neon is how production databases get dev-pushed by accident.
 */
import { existsSync } from 'node:fs'
import dotenv from 'dotenv'

export const SHIP_ENV_FILE = '.env.ship'

export function loadShipEnv() {
  if (!existsSync(SHIP_ENV_FILE)) {
    console.error(`\n\x1b[31m✖\x1b[0m ${SHIP_ENV_FILE} not found.`)
    console.error(
      `\x1b[2m  Production credentials live in ${SHIP_ENV_FILE} (git-ignored), NOT in .env.
  Create it from .env.ship.example: it needs DATABASE_ADAPTER=postgres, the
  Neon DATABASE_URL, BLOB_READ_WRITE_TOKEN, and SEED_ADMIN_USERNAME/PASSWORD.\x1b[0m`,
    )
    process.exit(1)
  }
  dotenv.config({ path: SHIP_ENV_FILE, override: true })
  dotenv.config() // .env fills any gaps (never overrides .env.ship)
}
