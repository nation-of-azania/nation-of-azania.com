import path from 'path'
import { fileURLToPath } from 'url'

import config from '@payload-config'
import { getPayload, type Payload } from 'payload'

import {
  aboutContent,
  charterContent,
  excerpts,
  foundingDayContent,
  keepersOpEdContent,
  lanternFestivalContent,
  monumentContent,
  northRoadContent,
  quayPricesContent,
  roadOverrunContent,
  valeGateTollContent,
} from './content'
import { generateBannerImages } from './images'

/**
 * Condoria seed script — creates the demo nation: users, categories, media
 * (including the National Monument .glb), articles and the About page.
 *
 *   pnpm seed        (= payload run src/seed/index.ts)
 *
 * CONVERGENT: every entity is looked up by a natural key (username, category
 * name, media alt text, article title, page slug) and created only when
 * missing. Running it again completes whatever a previous run didn't create —
 * a partially-failed seed heals itself on the next run — and a fully seeded
 * database is left untouched. Delete condoria.db (local SQLite dev) to
 * rebuild from scratch.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.resolve(here, 'assets')

// Accounts are username-only: no email addresses exist anywhere in the system
// (the nation owns no mail domain, and no email adapter is configured).
const DEFAULT_ADMIN_USERNAME = 'chancellor'
const DEFAULT_ADMIN_PASSWORD = 'condoria-dev-2026'

/** Demo accounts (documented in the README — change these passwords!). */
const EDITOR = {
  username: 'keeper',
  password: 'condoria-editor-2026',
  name: 'Keeper of Records',
} as const
const RESIDENT = {
  username: 'resident',
  password: 'condoria-resident-2026',
  name: 'A Resident of Condoria',
} as const
/** The Condor Times byline — an independent editor, kept distinct from the Gazette. */
const TIMES_CORRESPONDENT = {
  username: 'corvin',
  password: 'condoria-times-2026',
  name: 'Corvin Vale',
} as const

const log = (message: string) => console.log(`[seed] ${message}`)

let createdCount = 0
const stamp = (created: boolean, label: string) => {
  if (created) createdCount += 1
  log(`${created ? 'created ' : 'exists  '}${label}`)
}

async function ensureUser(
  payload: Payload,
  data: { username: string; password: string; name: string; role: 'admin' | 'editor' | 'resident' },
) {
  const found = await payload.find({
    collection: 'users',
    where: { username: { equals: data.username } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `user     ${data.username} (id ${found.docs[0].id})`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'users', data })
  stamp(true, `user     ${data.username} (id ${doc.id}, ${data.role})`)
  return doc
}

async function ensureCategory(payload: Payload, name: string) {
  const found = await payload.find({
    collection: 'categories',
    where: { name: { equals: name } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `category ${found.docs[0].slug}`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'categories', data: { name } })
  stamp(true, `category ${doc.slug} (id ${doc.id})`)
  return doc
}

async function ensureMedia(payload: Payload, alt: string, filePath: string) {
  const found = await payload.find({
    collection: 'media',
    where: { alt: { equals: alt } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `media    ${found.docs[0].filename}`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'media', data: { alt }, filePath })
  stamp(true, `media    ${doc.filename} (id ${doc.id}, ${doc.mimeType})`)
  return doc
}

async function ensureArticle(
  payload: Payload,
  args: {
    title: string
    draft?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>
  },
) {
  const found = await payload.find({
    collection: 'articles',
    where: { title: { equals: args.title } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `article  ${found.docs[0].slug}`)
    return found.docs[0]
  }
  const doc = await payload.create({
    collection: 'articles',
    draft: args.draft,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { title: args.title, ...args.data } as any,
  })
  stamp(true, `article  ${doc.slug}${args.draft ? ' (DRAFT)' : ''}`)
  return doc
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensurePage(payload: Payload, slug: string, data: Record<string, any>) {
  const found = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `page     ${slug}`)
    return found.docs[0]
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = await payload.create({ collection: 'pages', data: { slug, ...data } as any })
  stamp(true, `page     ${doc.slug}`)
  return doc
}

async function seed(payload: Payload): Promise<void> {
  // ── Credentials ───────────────────────────────────────────────────────────
  let adminUsername = process.env.SEED_ADMIN_USERNAME
  let adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminUsername || !adminPassword) {
    console.warn(
      '\n[seed] WARNING: SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD are not set in\n' +
        `[seed] the environment. Falling back to the well-known dev defaults\n` +
        `[seed] (${DEFAULT_ADMIN_USERNAME} / ${DEFAULT_ADMIN_PASSWORD}).\n` +
        '[seed] NEVER seed a production database without setting strong values.\n',
    )
    adminUsername = adminUsername || DEFAULT_ADMIN_USERNAME
    adminPassword = adminPassword || DEFAULT_ADMIN_PASSWORD
  }

  log('Converging the Nation of Condoria (existing entries are kept as-is)…')

  // ── 1. Users ──────────────────────────────────────────────────────────────
  const admin = await ensureUser(payload, {
    name: 'Chancellor of Condoria',
    username: adminUsername,
    password: adminPassword,
    role: 'admin',
  })
  const editor = await ensureUser(payload, { ...EDITOR, role: 'editor' })
  const resident = await ensureUser(payload, { ...RESIDENT, role: 'resident' })
  const timesEditor = await ensureUser(payload, { ...TIMES_CORRESPONDENT, role: 'editor' })

  // ── 2. Categories ─────────────────────────────────────────────────────────
  const categories: Record<string, number> = {}
  for (const name of ['Decrees', 'Gazette', 'Culture', 'Public Works', 'Markets', 'Opinion']) {
    const category = await ensureCategory(payload, name)
    categories[name] = category.id
  }

  // ── 3. Media ──────────────────────────────────────────────────────────────
  const monument = await ensureMedia(
    payload,
    'The National Monument of Condoria — stone obelisk with gilded pyramidion',
    path.join(assetsDir, 'condoria-monument.glb'),
  )

  log('generating banner images with sharp…')
  const banners = await generateBannerImages(assetsDir)
  const foundingBanner = await ensureMedia(payload, banners.foundingDay.alt, banners.foundingDay.filePath)
  const roadBanner = await ensureMedia(payload, banners.northRoad.alt, banners.northRoad.filePath)

  // ── 4. Articles ───────────────────────────────────────────────────────────
  await ensureArticle(payload, {
    title: 'The Charter of Condoria',
    data: {
      excerpt: excerpts.charter,
      content: charterContent(),
      author: admin.id,
      category: categories['Decrees'],
      pinned: true,
      publishedAt: '2025-11-01T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The National Monument, Restored',
    data: {
      excerpt: excerpts.monument,
      content: monumentContent(monument.id),
      author: editor.id,
      category: categories['Culture'],
      publishedAt: '2026-07-02T14:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Founding Day: How Condoria Came To Be',
    data: {
      excerpt: excerpts.foundingDay,
      content: foundingDayContent(foundingBanner.id),
      author: editor.id,
      category: categories['Gazette'],
      featuredImage: foundingBanner.id,
      publishedAt: '2026-06-12T08:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The Great North Road Opens',
    data: {
      excerpt: excerpts.northRoad,
      content: northRoadContent(foundingBanner.id, roadBanner.id),
      author: admin.id,
      category: categories['Public Works'],
      featuredImage: roadBanner.id,
      publishedAt: '2026-06-28T10:30:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Proposal: Lantern Festival on the South Quay',
    draft: true,
    data: {
      excerpt: excerpts.lanternFestival,
      content: lanternFestivalContent(),
      author: resident.id,
      category: categories['Culture'],
      _status: 'draft',
    },
  })

  // ── 4b. The Condor Times (section: 'times') ───────────────────────────────
  await ensureArticle(payload, {
    title: 'Traders Balk as Vale Gate Toll Takes Effect',
    data: {
      excerpt: excerpts.valeGateToll,
      content: valeGateTollContent(),
      section: 'times',
      author: timesEditor.id,
      category: categories['Public Works'],
      featuredImage: roadBanner.id,
      pinned: true,
      publishedAt: '2026-07-08T07:30:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'The North Road Ran Long, and Ran Over',
    data: {
      excerpt: excerpts.roadOverrun,
      content: roadOverrunContent(),
      section: 'times',
      author: timesEditor.id,
      category: categories['Public Works'],
      publishedAt: '2026-07-05T09:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Quay Prices Climb as the Stores Run Thin',
    data: {
      excerpt: excerpts.quayPrices,
      content: quayPricesContent(foundingBanner.id),
      section: 'times',
      author: timesEditor.id,
      category: categories['Markets'],
      featuredImage: foundingBanner.id,
      publishedAt: '2026-07-06T08:00:00.000Z',
      _status: 'published',
    },
  })

  await ensureArticle(payload, {
    title: 'Opinion: Who Keeps the Keepers?',
    data: {
      excerpt: excerpts.keepersOpEd,
      content: keepersOpEdContent(),
      section: 'times',
      author: timesEditor.id,
      category: categories['Opinion'],
      publishedAt: '2026-07-03T18:00:00.000Z',
      _status: 'published',
    },
  })

  // ── 5. Pages ──────────────────────────────────────────────────────────────
  await ensurePage(payload, 'about', {
    title: 'About Condoria',
    content: aboutContent(),
    _status: 'published',
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  if (createdCount === 0) {
    log('Everything already present — nothing to do.')
    return
  }
  console.log(`
[seed] ────────────────────────────────────────────────────────────
[seed] The Nation of Condoria is seeded (${createdCount} entries created this run).
[seed]
[seed] Sign in:  ${serverURL}/admin
[seed]   username: ${adminUsername}  (password: your SEED_ADMIN_PASSWORD)
[seed]   Demo accounts (change these passwords!): ${EDITOR.username}, ${RESIDENT.username}
[seed]
[seed] Visit:    ${serverURL}/gov          — the government Gazette
[seed]           ${serverURL}/times        — the Condor Times (independent press)
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
  console.error('[seed] The seed is convergent — fix the cause and re-run; completed entries are kept.')
  process.exit(1)
}
