import path from 'path'
import { fileURLToPath } from 'url'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import {
  aboutContent,
  charterContent,
  excerpts,
  foundingDayContent,
  harbourDuesContent,
  harbourMoleContent,
  ledgersOpEdContent,
  lighthouseContent,
  moleOverrunContent,
  regattaContent,
  spicePricesContent,
} from './content'
import {
  CATEGORIES,
  ensureArticle,
  ensureCategory,
  ensureMedia,
  ensurePage,
  ensureProfile,
  ensureUser,
  log,
  seedStats,
} from './helpers'
import { generateBannerImages } from './images'

/**
 * Azania seed script — creates the demo nation for local development: users,
 * categories, media (including the Lighthouse .glb and a Litematica build),
 * articles and the About page.
 *
 *   pnpm seed        (= payload run src/seed/index.ts)
 *
 * CONVERGENT: every entity is looked up by a natural key (username, category
 * name, media alt text, article title, page slug) and created only when
 * missing. Running it again completes whatever a previous run didn't create —
 * a partially-failed seed heals itself on the next run — and a fully seeded
 * database is left untouched. Delete azania.db (local SQLite dev) to rebuild
 * from scratch.
 *
 * Production is NOT seeded with this demo content: its first deploy runs the
 * much smaller bootstrap in ./bootstrap.ts instead.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(here, 'assets')

// Accounts are username-only: no email addresses exist anywhere in the system
// (the nation owns no mail domain, and no email adapter is configured).
const DEFAULT_ADMIN_USERNAME = 'IPaaat'
const DEFAULT_ADMIN_PASSWORD = 'azania-dev-2026'

/** Demo accounts (documented in the README — dev only). Their people are fictional. */
const EDITOR = {
  username: 'keeper',
  password: 'azania-editor-2026',
  name: 'Ione Harrow',
} as const
const RESIDENT = {
  username: 'resident',
  password: 'azania-resident-2026',
  name: 'A Resident of Azania',
} as const
/** The Azanian Times byline — an independent editor, kept distinct from the Gazette. */
const TIMES_CORRESPONDENT = {
  username: 'marlo',
  password: 'azania-times-2026',
  name: 'Marlo Tidewell',
} as const

async function seed(payload: Payload): Promise<void> {
  // ── Credentials ───────────────────────────────────────────────────────────
  let adminUsername = process.env.SEED_ADMIN_USERNAME
  let adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminUsername || !adminPassword) {
    console.warn(
      '\n[seed] WARNING: SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD are not set in\n' +
        `[seed] the environment. Falling back to the well-known dev defaults\n` +
        `[seed] (${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}).\n` +
        '[seed] This seed is for local development; never run it against production.\n',
    )
    adminUsername = adminUsername || DEFAULT_ADMIN_USERNAME
    adminPassword = adminPassword || DEFAULT_ADMIN_PASSWORD
  }

  log('Converging the Nation of Azania (existing entries are kept as-is)…')

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const admin = await ensureUser(payload, {
    name: adminUsername,
    minecraftName: adminUsername,
    username: adminUsername,
    password: adminPassword,
    role: 'admin',
  })
  const editor = await ensureUser(payload, { ...EDITOR, role: 'editor' })
  const resident = await ensureUser(payload, { ...RESIDENT, role: 'resident' })
  const timesEditor = await ensureUser(payload, { ...TIMES_CORRESPONDENT, role: 'editor' })

  // ── 1b. Byline profiles ───────────────────────────────────────────────────
  // One person, several hats: the admin is Co-Leader in the Gazette and
  // Editor-in-Chief of the Times. Profiles without an owner are shared bylines.
  // Real players get their Minecraft head; the fictional demo staff don't.
  await ensureProfile(payload, {
    name: adminUsername,
    title: 'Co-Leader',
    publication: 'government',
    owner: admin.id,
  })
  await ensureProfile(payload, {
    name: adminUsername,
    title: 'Editor-in-Chief',
    publication: 'times',
    owner: admin.id,
  })
  const chancellor = await ensureProfile(payload, {
    name: 'Luixiter',
    title: 'Chancellor',
    publication: 'government',
    minecraftName: 'Luixiter',
  })
  await ensureProfile(payload, {
    name: EDITOR.name,
    title: 'Keeper of the Light',
    publication: 'government',
    owner: editor.id,
  })
  await ensureProfile(payload, {
    name: TIMES_CORRESPONDENT.name,
    title: 'Harbour Correspondent',
    publication: 'times',
    owner: timesEditor.id,
  })
  const editors = await ensureProfile(payload, {
    name: 'The Editors',
    title: 'The Azanian Times',
    publication: 'times',
  })

  // ── 2. Categories ─────────────────────────────────────────────────────────
  const categories: Record<string, number> = {}
  for (const name of CATEGORIES) {
    const category = await ensureCategory(payload, name)
    categories[name] = category.id
  }

  // ── 3. Media ──────────────────────────────────────────────────────────────
  const lighthouse = await ensureMedia(
    payload,
    'The Lighthouse on Founders’ Point — a whitewashed, ochre-banded tower with a golden lantern',
    path.join(assetsDir, 'azania-lighthouse.glb'),
  )
  const warehouse = await ensureMedia(
    payload,
    'The standard quay warehouse (Litematica build)',
    path.join(assetsDir, 'simple-house.litematic'),
  )

  log('generating banner images with sharp…')
  const banners = await generateBannerImages(assetsDir)
  const dawnBanner = await ensureMedia(
    payload,
    banners.foundingDay.alt,
    banners.foundingDay.filePath,
  )
  const harbourBanner = await ensureMedia(payload, banners.harbour.alt, banners.harbour.filePath)

  // ── 4. Articles ───────────────────────────────────────────────────────────
  await ensureArticle(payload, {
    title: 'The Charter of Azania',
    data: {
      excerpt: excerpts.charter,
      content: charterContent(),
      author: admin.id,
      byline: chancellor.id,
      category: categories['Decrees'],
      pinned: true,
      publishedAt: '2025-11-01T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The Lighthouse on Founders’ Point, Relit',
    data: {
      excerpt: excerpts.lighthouse,
      content: lighthouseContent(lighthouse.id),
      author: editor.id,
      category: categories['Culture'],
      publishedAt: '2026-07-02T14:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Founding Day: How Azania Came To Be',
    data: {
      excerpt: excerpts.foundingDay,
      content: foundingDayContent(dawnBanner.id),
      author: editor.id,
      category: categories['Gazette'],
      featuredImage: dawnBanner.id,
      publishedAt: '2026-06-12T08:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The Long Mole Is Complete',
    data: {
      excerpt: excerpts.harbourMole,
      content: harbourMoleContent(dawnBanner.id, harbourBanner.id, warehouse.id),
      author: admin.id,
      category: categories['Public Works'],
      featuredImage: harbourBanner.id,
      publishedAt: '2026-06-28T10:30:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Proposal: A Regatta on the Old Harbour',
    draft: true,
    data: {
      excerpt: excerpts.regatta,
      content: regattaContent(),
      author: resident.id,
      category: categories['Culture'],
      _status: 'draft',
    },
  })

  // ── 4b. The Azanian Times (section: 'times') ──────────────────────────────
  await ensureArticle(payload, {
    title: 'Captains Balk as New Harbour Dues Take Effect',
    data: {
      excerpt: excerpts.harbourDues,
      content: harbourDuesContent(),
      section: 'times',
      author: timesEditor.id,
      category: categories['Public Works'],
      featuredImage: harbourBanner.id,
      pinned: true,
      publishedAt: '2026-07-08T07:30:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The Long Mole Ran Long, and Ran Over',
    data: {
      excerpt: excerpts.moleOverrun,
      content: moleOverrunContent(),
      section: 'times',
      author: timesEditor.id,
      category: categories['Public Works'],
      publishedAt: '2026-07-05T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Salt and Spice Climb as the Trade Winds Turn',
    data: {
      excerpt: excerpts.spicePrices,
      content: spicePricesContent(dawnBanner.id),
      section: 'times',
      author: admin.id,
      category: categories['Markets'],
      featuredImage: dawnBanner.id,
      publishedAt: '2026-07-06T08:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Opinion: Shine the Same Light on the Ledgers',
    data: {
      excerpt: excerpts.ledgersOpEd,
      content: ledgersOpEdContent(),
      section: 'times',
      author: admin.id,
      byline: editors.id,
      category: categories['Opinion'],
      publishedAt: '2026-07-03T18:00:00.000Z',
      _status: 'published',
    },
  })

  // ── 5. Pages ──────────────────────────────────────────────────────────────
  await ensurePage(payload, 'about', {
    title: 'About Azania',
    content: aboutContent(),
    _status: 'published',
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  if (seedStats.created === 0) {
    log('Everything already present — nothing to do.')
    return
  }
  console.log(`
[seed] ────────────────────────────────────────────────────────────
[seed] The Nation of Azania is seeded (${seedStats.created} entries created this run).
[seed]
[seed] Sign in:  ${serverURL}/admin
[seed]   username: ${adminUsername}  (password: your SEED_ADMIN_PASSWORD)
[seed]   Demo accounts: ${EDITOR.username}, ${TIMES_CORRESPONDENT.username} (can publish), ${RESIDENT.username} (drafts only)
[seed]
[seed] Visit:    ${serverURL}/gov          — the Azania Gazette
[seed]           ${serverURL}/times        — the Azanian Times (independent press)
[seed]           ${serverURL}/gov/about    — the standing page
[seed] ────────────────────────────────────────────────────────────
`)
}

try {
  const payload = await getPayload({ config })
  await seed(payload)
  process.exit(0)
} catch (error) {
  console.error('[seed] FAILED:', error)
  console.error(
    '[seed] The seed is convergent — fix the cause and re-run; completed entries are kept.',
  )
  process.exit(1)
}
