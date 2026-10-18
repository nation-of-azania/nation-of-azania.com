import path from 'path'
import { fileURLToPath } from 'url'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import {
  aboutContent,
  caseStudyContent,
  charterContent,
  cherryGroveContent,
  excerpts,
  foundingDayContent,
  harbourDuesContent,
  harbourMoleContent,
  ledgersOpEdContent,
  lighthouseContent,
  moleOverrunContent,
  morePinkContent,
  regattaContent,
  roadStandardContent,
  spicePricesContent,
  transportCatalogueContent,
} from './content'
import {
  ensureArticle,
  ensureContext,
  ensureMedia,
  ensurePage,
  ensureProfile,
  ensureUser,
  log,
  seedStats,
  TOP_LEVEL_CONTEXTS,
} from './helpers'
import { generateBannerImages } from './images'

/**
 * Azania seed script — creates the demo nation for local development:
 * contexts, users, byline profiles, media (including the Lighthouse .glb and
 * a Litematica build), articles and the About page.
 *
 *   pnpm seed        (= payload run src/seed/index.ts)
 *
 * CONVERGENT: every entity is looked up by a natural key (username, context
 * slug and parent, media alt text, article title, page slug and context) and
 * created only when missing. Running it again completes whatever a previous
 * run didn't create — a partially-failed seed heals itself on the next run —
 * and a fully seeded database is left untouched. Delete azania.db (local
 * SQLite dev) to rebuild from scratch.
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
/** GirlieTown's resident (a real player: DefinitelyCasi). Dev-only account. */
const CASI = {
  username: 'casi',
  password: 'azania-girlie-2026',
  name: 'DefinitelyCasi',
} as const
/** A delegate from another nation: manages International, and nothing of Azania's own. */
const DELEGATE = {
  username: 'delegate',
  password: 'azania-delegate-2026',
  name: 'Ilse Varnholt',
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

  // ── 1. Contexts ───────────────────────────────────────────────────────────
  // The top level carries the designs; everything below inherits its root's.
  // Locally International is listed, so the demo shows all three.
  const top: Record<string, number> = {}
  for (const context of TOP_LEVEL_CONTEXTS) {
    top[context.slug] = (await ensureContext(payload, { ...context, listed: true })).id
  }
  const chancellery = await ensureContext(payload, {
    name: 'The Chancellery',
    slug: 'chancellery',
    parent: top.gov,
    tagline: 'From the office of the Chancellor',
    order: 1,
  })
  const infrastructure = await ensureContext(payload, {
    name: 'Public Works',
    slug: 'infrastructure',
    parent: top.gov,
    tagline: 'What the nation builds, and what it costs',
    order: 2,
  })
  const markets = await ensureContext(payload, {
    name: 'Markets',
    slug: 'markets',
    parent: top.times,
    tagline: 'Prices on the Spice Quay',
    order: 1,
  })
  const opinion = await ensureContext(payload, {
    name: 'Opinion',
    slug: 'opinion',
    parent: top.times,
    tagline: 'Signed views, not the paper’s reporting',
    order: 2,
  })
  // Four levels deep: International › Transport Catalogue › Road Initiative › Case Studies.
  const transport = await ensureContext(payload, {
    name: 'Transport Catalogue',
    slug: 'transport',
    parent: top.intl,
    tagline: 'Shared standards for the roads, bridges and harbours between nations',
    order: 1,
  })
  const roads = await ensureContext(payload, {
    name: 'Road Initiative',
    slug: 'roads',
    parent: transport.id,
    tagline: 'Trunk roads that meet at the border',
    order: 1,
  })
  const caseStudies = await ensureContext(payload, {
    name: 'Case Studies',
    slug: 'case-studies',
    parent: roads.id,
    tagline: 'Roads built to the standard, and what they taught',
    order: 1,
  })
  // GirlieTown wears its own style, Cherry Blossom, in both papers it writes for.
  const girlieTown = await ensureContext(payload, {
    name: 'GirlieTown',
    slug: 'girlietown',
    parent: top.gov,
    tagline: 'A town of Azania, under the cherry trees',
    style: 'blossom',
    order: 3,
  })
  const girlieOpinion = await ensureContext(payload, {
    name: 'Girlie Opinion',
    slug: 'girlie-opinion',
    parent: opinion.id,
    tagline: 'A column from GirlieTown',
    style: 'blossom',
    order: 1,
  })

  // ── 2. Users ──────────────────────────────────────────────────────────────
  // Editors and admins act everywhere; residents only where a grant says so.
  const admin = await ensureUser(payload, {
    name: adminUsername,
    minecraftName: adminUsername,
    username: adminUsername,
    password: adminPassword,
    role: 'admin',
  })
  const editor = await ensureUser(payload, { ...EDITOR, role: 'editor' })
  const resident = await ensureUser(payload, {
    ...RESIDENT,
    role: 'resident',
    contextAccess: [{ context: top.gov, level: 'write' }],
  })
  const timesEditor = await ensureUser(payload, {
    ...TIMES_CORRESPONDENT,
    role: 'resident',
    contextAccess: [{ context: top.times, level: 'publish' }],
  })
  const casi = await ensureUser(payload, {
    ...CASI,
    minecraftName: CASI.name,
    role: 'resident',
    contextAccess: [
      { context: girlieTown.id, level: 'publish' },
      { context: girlieOpinion.id, level: 'write' },
    ],
  })
  const delegate = await ensureUser(payload, {
    ...DELEGATE,
    role: 'resident',
    contextAccess: [{ context: top.intl, level: 'manage' }],
  })

  // ── 3. Byline profiles ────────────────────────────────────────────────────
  // One person, several hats: the admin is Co-Leader in Government,
  // Editor-in-Chief of the Times and Azania's representative abroad. Profiles
  // without an owner are shared bylines. Real players get their Minecraft
  // head; the fictional demo staff don't.
  await ensureProfile(payload, {
    name: adminUsername,
    title: 'Co-Leader',
    contexts: [top.gov],
    owner: admin.id,
  })
  await ensureProfile(payload, {
    name: adminUsername,
    title: 'Editor-in-Chief',
    contexts: [top.times],
    owner: admin.id,
  })
  const representative = await ensureProfile(payload, {
    name: adminUsername,
    title: 'Representative of Azania',
    contexts: [top.intl],
    owner: admin.id,
  })
  const chancellor = await ensureProfile(payload, {
    name: 'Luixiter',
    title: 'Chancellor',
    contexts: [top.gov],
    minecraftName: 'Luixiter',
  })
  await ensureProfile(payload, {
    name: EDITOR.name,
    title: 'Keeper of the Light',
    contexts: [top.gov],
    owner: editor.id,
  })
  await ensureProfile(payload, {
    name: TIMES_CORRESPONDENT.name,
    title: 'Harbour Correspondent',
    contexts: [top.times],
    owner: timesEditor.id,
  })
  const editors = await ensureProfile(payload, {
    name: 'The Editors',
    title: 'The Azanian Times',
    contexts: [top.times],
  })
  await ensureProfile(payload, {
    name: CASI.name,
    title: 'GirlieTown',
    contexts: [girlieTown.id, girlieOpinion.id],
    owner: casi.id,
  })
  await ensureProfile(payload, {
    name: DELEGATE.name,
    title: 'Delegate of Norvessa',
    contexts: [top.intl],
    owner: delegate.id,
  })

  // ── 4. Media ──────────────────────────────────────────────────────────────
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

  // ── 5. Government ─────────────────────────────────────────────────────────
  await ensureArticle(payload, {
    title: 'The Charter of Azania',
    data: {
      excerpt: excerpts.charter,
      content: charterContent(),
      context: top.gov,
      type: 'decree',
      author: admin.id,
      byline: chancellor.id,
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
      context: top.gov,
      type: 'dispatch',
      author: editor.id,
      publishedAt: '2026-07-02T14:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Founding Day: How Azania Came To Be',
    data: {
      excerpt: excerpts.foundingDay,
      content: foundingDayContent(dawnBanner.id),
      context: chancellery.id,
      type: 'explanation',
      author: editor.id,
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
      context: infrastructure.id,
      type: 'dispatch',
      author: admin.id,
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
      context: top.gov,
      type: 'statement',
      author: resident.id,
      _status: 'draft',
    },
  })

  // ── 6. The Azanian Times ──────────────────────────────────────────────────
  await ensureArticle(payload, {
    title: 'Captains Balk as New Harbour Dues Take Effect',
    data: {
      excerpt: excerpts.harbourDues,
      content: harbourDuesContent(),
      context: top.times,
      type: 'news',
      author: timesEditor.id,
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
      context: top.times,
      type: 'analysis',
      author: timesEditor.id,
      publishedAt: '2026-07-05T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Salt and Spice Climb as the Trade Winds Turn',
    data: {
      excerpt: excerpts.spicePrices,
      content: spicePricesContent(dawnBanner.id),
      context: markets.id,
      type: 'news',
      author: admin.id,
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
      context: opinion.id,
      type: 'opinion',
      author: admin.id,
      byline: editors.id,
      publishedAt: '2026-07-03T18:00:00.000Z',
      _status: 'published',
    },
  })

  // ── 6b. GirlieTown (Cherry Blossom) ───────────────────────────────────────
  await ensureArticle(payload, {
    title: 'GirlieTown Opens Its Cherry Grove to All Residents',
    data: {
      excerpt: excerpts.cherryGrove,
      content: cherryGroveContent(),
      context: girlieTown.id,
      type: 'statement',
      author: casi.id,
      publishedAt: '2026-10-10T16:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Girlie Opinion: Port Azania Could Use a Little More Pink',
    data: {
      excerpt: excerpts.morePink,
      content: morePinkContent(),
      context: girlieOpinion.id,
      type: 'opinion',
      author: casi.id,
      publishedAt: '2026-10-12T17:00:00.000Z',
      _status: 'published',
    },
  })

  // ── 7. International ──────────────────────────────────────────────────────
  await ensureArticle(payload, {
    title: 'The Transport Catalogue Opens to Member Nations',
    data: {
      excerpt: excerpts.transportCatalogue,
      content: transportCatalogueContent(),
      context: transport.id,
      type: 'announcement',
      author: delegate.id,
      pinned: true,
      publishedAt: '2026-09-14T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Road Standard RS-1: Cross-Section and Drainage',
    data: {
      excerpt: excerpts.roadStandard,
      content: roadStandardContent(),
      context: roads.id,
      type: 'standard',
      author: delegate.id,
      publishedAt: '2026-09-28T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Case Study: The Long Mole Approach Road',
    data: {
      excerpt: excerpts.caseStudy,
      content: caseStudyContent(harbourBanner.id),
      context: caseStudies.id,
      type: 'case-study',
      author: admin.id,
      byline: representative.id,
      featuredImage: harbourBanner.id,
      publishedAt: '2026-10-05T09:00:00.000Z',
      _status: 'published',
    },
  })

  // ── 8. Pages ──────────────────────────────────────────────────────────────
  await ensurePage(payload, 'about', {
    title: 'About Azania',
    content: aboutContent(),
    context: top.gov,
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
[seed]   Demo accounts: ${EDITOR.username} (editor), ${TIMES_CORRESPONDENT.username} (publishes in the Times),
[seed]                  ${RESIDENT.username} (writes drafts in Government), ${DELEGATE.username} (manages International),
[seed]                  ${CASI.username} (GirlieTown, in its Cherry Blossom style)
[seed]
[seed] Visit:    ${serverURL}/gov          — Government, the Azania Gazette
[seed]           ${serverURL}/times        — the Azanian Times (independent press)
[seed]           ${serverURL}/intl         — International initiatives
[seed]           ${serverURL}/intl/transport/roads/case-studies  — four levels deep
[seed]           ${serverURL}/gov/girlietown  — GirlieTown, in Cherry Blossom
[seed]           ${serverURL}/gov/about    — the standing page
[seed] ────────────────────────────────────────────────────────────
`)
}

try {
  const payload = await getPayload({ config })
  await seed(payload)
  process.exit(0)
} catch (error) {
  console.error('[seed] FAILED:', error, (error as { data?: unknown }).data)
  console.error(
    '[seed] The seed is convergent — fix the cause and re-run; completed entries are kept.',
  )
  process.exit(1)
}
