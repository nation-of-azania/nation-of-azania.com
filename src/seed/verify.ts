import config from '@payload-config'
import { getPayload } from 'payload'

import { styleOfArticle } from '../contexts/styles'
import { buildTree } from '../contexts/tree'

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
  const users = await payload.find({ collection: 'users', limit: 10, depth: 0 })
  check(users.totalDocs === 6, 'users: 6 accounts', `found ${users.totalDocs}`)
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

  // ── Contexts ──────────────────────────────────────────────────────────
  const contexts = await payload.find({ collection: 'contexts', limit: 50, depth: 0 })
  check(contexts.totalDocs === 12, 'contexts: 12', `found ${contexts.totalDocs}`)
  const contextByPath = new Map(contexts.docs.map((context) => [context.path, context]))
  const topLevel = contexts.docs.filter((context) => !context.parent)
  check(
    topLevel.map((context) => context.slug).sort().join(',') === 'gov,intl,times',
    'contexts: three top-level contexts',
    topLevel.map((context) => context.path).join(', '),
  )
  check(
    contextByPath.get('/gov')?.design === 'gazette' &&
      contextByPath.get('/times')?.design === 'times' &&
      contextByPath.get('/intl')?.design === 'international',
    'contexts: each top level carries its design',
  )
  const deepest = contextByPath.get('/intl/transport/roads/case-studies')
  check(Boolean(deepest), 'contexts: four levels deep', deepest?.path ?? 'missing')
  check(
    deepest?.label === 'International › Transport Catalogue › Road Initiative › Case Studies',
    'contexts: label is the breadcrumb',
    deepest?.label ?? 'missing',
  )
  check(!deepest?.design, 'contexts: sub-contexts carry no design of their own')
  const contextId = (path: string) => contextByPath.get(path)?.id

  // ── Access grants ─────────────────────────────────────────────────────────
  const userNamed = (username: string) => users.docs.find((user) => user.username === username)
  const grantsOf = (username: string) =>
    (userNamed(username)?.contextAccess ?? []).map((row) => `${row.context}:${row.level}`)
  check(
    grantsOf('delegate').join() === `${contextId('/intl')}:manage`,
    'grants: the delegate manages International, and nothing else',
    grantsOf('delegate').join() || 'none',
  )
  check(
    grantsOf('resident').join() === `${contextId('/gov')}:write`,
    'grants: the resident writes in Government',
    grantsOf('resident').join() || 'none',
  )
  check(
    grantsOf('marlo').join() === `${contextId('/times')}:publish`,
    'grants: the Times correspondent publishes in the Times',
    grantsOf('marlo').join() || 'none',
  )

  // ── Byline profiles ───────────────────────────────────────────────────────
  // depth 0 keeps relationship values as raw ids (including inside lexical blocks).
  const articles = await payload.find({ collection: 'articles', limit: 20, depth: 0 })
  const articlesBySlug = new Map(articles.docs.map((article) => [article.slug, article]))
  const profiles = await payload.find({ collection: 'profiles', limit: 20, depth: 0 })
  check(profiles.totalDocs === 9, 'profiles: 9', `found ${profiles.totalDocs}`)
  const adminProfiles = profiles.docs.filter((profile) => profile.owner === admin?.id)
  const profileContexts = (profile: (typeof profiles.docs)[number]) =>
    (profile.contexts ?? []).map((context) => (typeof context === 'object' ? context.id : context))
  check(
    adminProfiles.length === 3 &&
      new Set(adminProfiles.flatMap(profileContexts)).size === 3,
    'profiles: admin wears three hats (Government, Times, International)',
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
  check(articles.totalDocs === 14, 'articles: 14 total', `found ${articles.totalDocs}`)
  const published = articles.docs.filter((doc) => doc._status === 'published')
  const drafts = articles.docs.filter((doc) => doc._status === 'draft')
  check(published.length === 13, 'articles: 13 published', `found ${published.length}`)
  check(drafts.length === 1, 'articles: 1 draft', drafts.map((d) => d.slug).join(', '))
  for (const design of ['gazette', 'times', 'international'] as const) {
    const count = articles.docs.filter((doc) => doc.design === design).length
    check(count >= 3, `articles: ${design} design follows the context`, `${count} article(s)`)
  }
  const caseStudy = articlesBySlug.get('case-study-the-long-mole-approach-road')
  check(
    caseStudy?.context === deepest?.id && caseStudy?.type === 'case-study',
    'articles: the case study sits four levels deep, typed as a case study',
    `${caseStudy?.context} / ${caseStudy?.type}`,
  )
  check(
    articlesBySlug.get('the-charter-of-azania')?.type === 'decree',
    'articles: the Charter is a decree',
  )

  // ── Styles ────────────────────────────────────────────────────────────────
  const tree = buildTree(contexts.docs)
  const styleOf = (slug: string) => {
    const article = articlesBySlug.get(slug)
    const contextId = article?.context as number | undefined
    return article && contextId != null
      ? styleOfArticle(article, tree.ancestors(contextId), tree.designOf(contextId))
      : undefined
  }
  check(
    contextByPath.get('/gov/girlietown')?.style === 'blossom' &&
      contextByPath.get('/times/girlietea')?.style === 'blossom',
    'styles: GirlieTown and its column wear Cherry Blossom',
  )
  check(
    styleOf('girlietown-opens-its-cherry-grove-to-all-residents') === 'blossom' &&
      styleOf('girlietea-port-azania-could-use-a-little-more-pink') === 'blossom',
    'styles: their articles inherit it, in the Gazette and in the Times',
  )
  check(
    styleOf('the-charter-of-azania') === null &&
      styleOf('opinion-shine-the-same-light-on-the-ledgers') === null,
    'styles: everything else stays plain',
  )

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
  const residentUser = userNamed('resident')
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
    'byline: defaults to the author’s Government profile, from a sub-context',
    bylineOf('the-long-mole-is-complete')?.label ?? 'none',
  )
  check(
    bylineOf('salt-and-spice-climb-as-the-trade-winds-turn')?.title === 'Editor-in-Chief',
    'byline: same author, Times profile in the Times',
    bylineOf('salt-and-spice-climb-as-the-trade-winds-turn')?.label ?? 'none',
  )
  check(
    bylineOf('road-standard-rs-1-cross-section-and-drainage')?.title === 'Delegate of Norvessa',
    'byline: the delegate is credited as delegate in International',
    bylineOf('road-standard-rs-1-cross-section-and-drainage')?.label ?? 'none',
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
  check(about?.context === contextId('/gov'), 'pages: about belongs to Government')

  console.log(
    failures === 0 ? '[verify] All checks passed.' : `[verify] ${failures} check(s) FAILED.`,
  )
  process.exit(failures === 0 ? 0 : 1)
} catch (error) {
  console.error('[verify] ERROR:', error)
  process.exit(1)
}
