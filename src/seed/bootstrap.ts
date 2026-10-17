import type { Payload } from 'payload'

import { aboutContent } from './content'
import { CATEGORIES, ensureCategory, ensurePage, ensureUser, log } from './helpers'

/**
 * First-deploy bootstrap for production, run by the Vercel build after the
 * migrations (scripts/prepare-production-db.ts). It acts only while the users
 * table is empty, i.e. on the very first deploy, and creates just enough to
 * start: the article categories, the About page, and the admin account from
 * SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD. No demo accounts and no demo
 * articles reach production; real content is written in the admin panel.
 *
 * The admin is created last, so a run that fails part-way leaves the users
 * table empty and the next deploy finishes the job (every step is convergent).
 */
export async function bootstrapProduction(payload: Payload): Promise<void> {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs > 0) {
    log(`${totalDocs} account(s) exist — first-deploy bootstrap already done, skipping.`)
    return
  }

  const username = process.env.SEED_ADMIN_USERNAME?.trim()
  const password = process.env.SEED_ADMIN_PASSWORD
  if (!username || !password) {
    throw new Error(
      'This is the first deploy (no accounts exist yet), so the admin account must be created. ' +
        'Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD in the Vercel project (Production) and redeploy.',
    )
  }
  if (password.length < 12) {
    throw new Error('SEED_ADMIN_PASSWORD is shorter than 12 characters. Use a strong password for production.')
  }

  log('Empty database — bootstrapping the Nation of Azania…')
  for (const name of CATEGORIES) await ensureCategory(payload, name)
  await ensurePage(payload, 'about', {
    title: 'About Azania',
    content: aboutContent(),
    _status: 'published',
  })
  await ensureUser(payload, { name: 'Co-Leader of Azania', username, password, role: 'admin' })
  log(`Bootstrap complete. Sign in at /admin as "${username.toLowerCase()}".`)
}
