import config from '@payload-config'
import { getPayload } from 'payload'

/**
 * Post-seed verification — read-only checks against the seeded database.
 *
 *   pnpm payload run src/seed/verify.ts
 *
 * Exits 0 when every check passes, 1 otherwise.
 */

let failures = 0

const check = (ok: boolean, label: string, detail = '') => {
  const suffix = detail ? ` — ${detail}` : ''
  if (ok) {
    console.log(`  PASS  ${label}${suffix}`)
  } else {
    failures += 1
    console.error(`  FAIL  ${label}${suffix}`)
  }
}

/** Depth-first search of a Lexical tree for block nodes of a given blockType. */
const findBlocks = (node: unknown, blockType: string): Array<Record<string, unknown>> => {
  if (Array.isArray(node)) return node.flatMap((child) => findBlocks(child, blockType))
  if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>
    const fields = record.fields as Record<string, unknown> | undefined
    const self = record.type === 'block' && fields?.blockType === blockType ? [fields] : []
    return [
      ...self,
      ...findBlocks(record.children ?? (record.root ? [record.root] : []), blockType),
    ]
  }
  return []
}

try {
  const payload = await getPayload({ config })
  console.log('[verify] Checking seeded content…')

  // ── Users ─────────────────────────────────────────────────────────────────
  const users = await payload.find({ collection: 'users', limit: 10 })
  check(users.totalDocs === 4, 'users: 4 accounts', `found ${users.totalDocs}`)
  for (const role of ['admin', 'editor', 'resident'] as const) {
    check(
      users.docs.some((user) => user.role === role),
      `users: has ${role}`,
    )
  }

  const admin = users.docs.find((user) => user.role === 'admin')
  check(
    Boolean(admin?.minecraftName),
    'users: admin has a Minecraft name',
    admin?.minecraftName ?? 'missing',
  )

  // ── Byline profiles ───────────────────────────────────────────────────────
  // depth 0 keeps relationship values as raw ids (including inside lexical blocks).
  const articles = await payload.find({ collection: 'articles', limit: 20, depth: 0 })
  const articlesBySlug = new Map(articles.docs.map((article) => [article.slug, article]))
  const profiles = await payload.find({ collection: 'profiles', limit: 20, depth: 0 })
  check(profiles.totalDocs === 6, 'profiles: 6', `found ${profiles.totalDocs}`)
  const adminProfiles = profiles.docs.filter((profile) => profile.owner === admin?.id)
  check(
    adminProfiles.length === 2 &&
      new Set(adminProfiles.map((profile) => profile.publication)).size === 2,
    'profiles: admin wears two hats (Gazette + Times)',
    adminProfiles.map((profile) => profile.label).join(', '),
  )
  check(
    adminProfiles.every((profile) => profile.minecraftName === admin?.minecraftName),
    'profiles: owner’s Minecraft name filled in by default',
  )
  const shared = profiles.docs.filter((profile) => !profile.owner)
  check(
    shared.length === 2,
    'profiles: 2 shared bylines',
    shared.map((profile) => profile.name).join(', '),
  )
  const bylineOf = (slug: string) => {
    const article = articlesBySlug.get(slug)
    return profiles.docs.find((profile) => profile.id === article?.byline)
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const categories = await payload.find({ collection: 'categories', limit: 10 })
  check(categories.totalDocs === 6, 'categories: 6', `found ${categories.totalDocs}`)
  check(
    ['decrees', 'gazette', 'culture', 'public-works', 'markets', 'opinion'].every((slug) =>
      categories.docs.some((category) => category.slug === slug),
    ),
    'categories: slugs auto-generated',
    categories.docs.map((category) => category.slug).join(', '),
  )

  // ── Media ─────────────────────────────────────────────────────────────────
  const media = await payload.find({ collection: 'media', limit: 10 })
  check(media.totalDocs === 4, 'media: 4 documents', `found ${media.totalDocs}`)
  const glb = media.docs.find((doc) => doc.filename?.endsWith('.glb'))
  check(Boolean(glb), 'media: .glb present', glb?.filename ?? 'missing')
  check(
    glb?.mimeType === 'model/gltf-binary' || glb?.mimeType === 'application/octet-stream',
    'media: .glb mime type acceptable',
    `mimeType = ${glb?.mimeType}`,
  )
  const schematic = media.docs.find((doc) => doc.filename?.endsWith('.litematic'))
  check(Boolean(schematic), 'media: .litematic present', schematic?.filename ?? 'missing')
  const images = media.docs.filter((doc) => doc.mimeType?.startsWith('image/'))
  check(images.length === 2, 'media: 2 banner images', images.map((i) => i.filename).join(', '))

  // ── Articles ──────────────────────────────────────────────────────────────
  check(articles.totalDocs === 9, 'articles: 9 total', `found ${articles.totalDocs}`)
  const published = articles.docs.filter((doc) => doc._status === 'published')
  const drafts = articles.docs.filter((doc) => doc._status === 'draft')
  check(published.length === 8, 'articles: 8 published', `found ${published.length}`)
  const times = articles.docs.filter((doc) => doc.section === 'times')
  check(times.length === 4, 'articles: 4 in the Azanian Times', `found ${times.length}`)
  check(drafts.length === 1, 'articles: 1 draft', drafts.map((d) => d.slug).join(', '))

  const charter = articles.docs.find((doc) => doc.slug === 'the-charter-of-azania')
  check(Boolean(charter), 'charter: exists (slug auto-generated from title)')
  check(charter?.pinned === true, 'charter: pinned')
  check(charter?._status === 'published', 'charter: published')
  check(
    charter?.publishedAt?.startsWith('2025-11-01') === true,
    'charter: publishedAt backdated',
    charter?.publishedAt ?? 'missing',
  )

  const lighthouseArticle = articles.docs.find(
    (doc) => doc.slug === 'the-lighthouse-on-founders-point-relit',
  )
  check(Boolean(lighthouseArticle), 'lighthouse article: exists')
  const model3dBlocks = findBlocks(lighthouseArticle?.content ?? null, 'model3d')
  check(model3dBlocks.length === 1, 'lighthouse article: one model3d block node')
  const modelId = model3dBlocks[0]?.model
  check(
    typeof modelId === 'number',
    'model3d: model id is numeric',
    `model = ${JSON.stringify(modelId)}`,
  )
  check(
    typeof modelId === 'number' && modelId === glb?.id,
    'model3d: model id matches uploaded .glb media',
    `model = ${JSON.stringify(modelId)}, glb id = ${glb?.id}`,
  )
  check(model3dBlocks[0]?.autoRotate === true, 'model3d: autoRotate true')

  const draft = drafts[0]
  check(
    draft?.slug === 'proposal-a-regatta-on-the-old-harbour',
    'draft: regatta proposal',
    draft?.slug ?? 'missing',
  )
  const draftAuthor = typeof draft?.author === 'object' ? draft?.author?.id : draft?.author
  const residentUser = users.docs.find((user) => user.role === 'resident')
  check(draftAuthor === residentUser?.id, 'draft: authored by the resident account')

  // Block coverage across all articles (every block type should be exercised).
  const allContent = articles.docs.map((doc) => doc.content ?? null)
  const blockTypes = [
    'callout',
    'quote',
    'image',
    'gallery',
    'embed',
    'discord',
    'model3d',
    'litematic',
  ]
  for (const blockType of blockTypes) {
    const count = allContent.flatMap((content) => findBlocks(content, blockType)).length
    check(count > 0, `blocks: '${blockType}' used in seed content`, `${count} instance(s)`)
  }

  // ── Bylines ───────────────────────────────────────────────────────────────
  check(
    bylineOf('the-charter-of-azania')?.name === 'Luixiter',
    'byline: charter credited to the Chancellor (shared profile)',
    bylineOf('the-charter-of-azania')?.label ?? 'none',
  )
  check(
    bylineOf('the-long-mole-is-complete')?.title === 'Co-Leader',
    'byline: defaults to the author’s Gazette profile',
    bylineOf('the-long-mole-is-complete')?.label ?? 'none',
  )
  check(
    bylineOf('salt-and-spice-climb-as-the-trade-winds-turn')?.title === 'Editor-in-Chief',
    'byline: same author, Times profile in the Times',
    bylineOf('salt-and-spice-climb-as-the-trade-winds-turn')?.label ?? 'none',
  )
  check(
    !articlesBySlug.get('proposal-a-regatta-on-the-old-harbour')?.byline,
    'byline: none for an author without profiles (falls back to the display name)',
  )

  // ── Pages ─────────────────────────────────────────────────────────────────
  const pages = await payload.find({ collection: 'pages', limit: 10, depth: 0 })
  check(pages.totalDocs === 1, 'pages: 1', `found ${pages.totalDocs}`)
  const about = pages.docs.find((doc) => doc.slug === 'about')
  check(Boolean(about), 'pages: about exists with explicit slug "about"')
  check(about?._status === 'published', 'pages: about published')

  console.log(
    failures === 0 ? '[verify] All checks passed.' : `[verify] ${failures} check(s) FAILED.`,
  )
  process.exit(failures === 0 ? 0 : 1)
} catch (error) {
  console.error('[verify] ERROR:', error)
  process.exit(1)
}
