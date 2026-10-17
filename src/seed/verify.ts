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
  check(users.totalDocs === 3, 'users: 3 accounts', `found ${users.totalDocs}`)
  for (const role of ['admin', 'editor', 'resident'] as const) {
    check(
      users.docs.some((user) => user.role === role),
      `users: one ${role}`,
    )
  }

  // ── Categories ────────────────────────────────────────────────────────────
  const categories = await payload.find({ collection: 'categories', limit: 10 })
  check(categories.totalDocs === 4, 'categories: 4', `found ${categories.totalDocs}`)
  check(
    ['decrees', 'gazette', 'culture', 'public-works'].every((slug) =>
      categories.docs.some((category) => category.slug === slug),
    ),
    'categories: slugs auto-generated',
    categories.docs.map((category) => category.slug).join(', '),
  )

  // ── Media ─────────────────────────────────────────────────────────────────
  const media = await payload.find({ collection: 'media', limit: 10 })
  check(media.totalDocs === 3, 'media: 3 documents', `found ${media.totalDocs}`)
  const glb = media.docs.find((doc) => doc.filename?.endsWith('.glb'))
  check(Boolean(glb), 'media: .glb present', glb?.filename ?? 'missing')
  check(
    glb?.mimeType === 'model/gltf-binary' || glb?.mimeType === 'application/octet-stream',
    'media: .glb mime type acceptable',
    `mimeType = ${glb?.mimeType}`,
  )
  const images = media.docs.filter((doc) => doc.mimeType?.startsWith('image/'))
  check(images.length === 2, 'media: 2 banner images', images.map((i) => i.filename).join(', '))

  // ── Articles ──────────────────────────────────────────────────────────────
  // depth 0 keeps relationship values as raw ids (including inside lexical blocks).
  const articles = await payload.find({ collection: 'articles', limit: 20, depth: 0 })
  check(articles.totalDocs === 5, 'articles: 5 total', `found ${articles.totalDocs}`)
  const published = articles.docs.filter((doc) => doc._status === 'published')
  const drafts = articles.docs.filter((doc) => doc._status === 'draft')
  check(published.length === 4, 'articles: 4 published', `found ${published.length}`)
  check(drafts.length === 1, 'articles: 1 draft', drafts.map((d) => d.slug).join(', '))

  const charter = articles.docs.find((doc) => doc.slug === 'the-charter-of-condoria')
  check(Boolean(charter), 'charter: exists (slug auto-generated from title)')
  check(charter?.pinned === true, 'charter: pinned')
  check(charter?._status === 'published', 'charter: published')
  check(
    charter?.publishedAt?.startsWith('2025-11-01') === true,
    'charter: publishedAt backdated',
    charter?.publishedAt ?? 'missing',
  )

  const monumentArticle = articles.docs.find(
    (doc) => doc.slug === 'the-national-monument-restored',
  )
  check(Boolean(monumentArticle), 'monument article: exists')
  const model3dBlocks = findBlocks(monumentArticle?.content ?? null, 'model3d')
  check(model3dBlocks.length === 1, 'monument article: one model3d block node')
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
    draft?.slug === 'proposal-lantern-festival-on-the-south-quay',
    'draft: lantern festival proposal',
    draft?.slug ?? 'missing',
  )
  const draftAuthor = typeof draft?.author === 'object' ? draft?.author?.id : draft?.author
  const residentUser = users.docs.find((user) => user.role === 'resident')
  check(draftAuthor === residentUser?.id, 'draft: authored by the resident account')

  // Block coverage across all articles (every block type should be exercised).
  const allContent = articles.docs.map((doc) => doc.content ?? null)
  for (const blockType of ['callout', 'quote', 'image', 'gallery', 'embed', 'model3d']) {
    const count = allContent.flatMap((content) => findBlocks(content, blockType)).length
    check(count > 0, `blocks: '${blockType}' used in seed content`, `${count} instance(s)`)
  }

  // ── Pages ─────────────────────────────────────────────────────────────────
  const pages = await payload.find({ collection: 'pages', limit: 10, depth: 0 })
  check(pages.totalDocs === 1, 'pages: 1', `found ${pages.totalDocs}`)
  const about = pages.docs.find((doc) => doc.slug === 'about')
  check(Boolean(about), 'pages: about exists with explicit slug "about"')
  check(about?._status === 'published', 'pages: about published')

  console.log(
    failures === 0
      ? '[verify] All checks passed.'
      : `[verify] ${failures} check(s) FAILED.`,
  )
  process.exit(failures === 0 ? 0 : 1)
} catch (error) {
  console.error('[verify] ERROR:', error)
  process.exit(1)
}
