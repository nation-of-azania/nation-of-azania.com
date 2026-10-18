import type { Payload } from 'payload'

import type { StyleId } from '../contexts/styles'

/**
 * Convergent "ensure" helpers shared by the dev seed (index.ts) and the
 * production first-deploy bootstrap (bootstrap.ts). Each looks an entity up
 * by a natural key (username, context slug, media alt text, article title,
 * page slug) and creates it only when missing.
 */

export const log = (message: string) => console.log(`[seed] ${message}`)

/** How many entries this process created (for the summary line). */
export const seedStats = { created: 0 }

const stamp = (created: boolean, label: string) => {
  if (created) seedStats.created += 1
  log(`${created ? 'created ' : 'exists  '}${label}`)
}

/**
 * The top-level contexts, created by both the seed and the first-deploy
 * bootstrap (and, for databases that predate contexts, by the migration).
 * International starts unlisted: reachable by URL, left out of menus.
 */
export const TOP_LEVEL_CONTEXTS = [
  { name: 'Government', slug: 'gov', design: 'gazette', tagline: 'The official record of the Nation of Azania', order: 1, listed: true },
  { name: 'The Azanian Times', slug: 'times', design: 'times', tagline: 'Independent of the Chancellery', order: 2, listed: true },
  { name: 'International', slug: 'intl', design: 'international', tagline: 'Initiatives among nations, hosted by Azania', order: 3, listed: false },
] as const

type ContextInput = {
  name: string
  slug: string
  parent?: number
  design?: 'gazette' | 'times' | 'international'
  tagline?: string
  order?: number
  listed?: boolean
  style?: 'plain' | StyleId
}

export async function ensureContext(payload: Payload, data: ContextInput) {
  const found = await payload.find({
    collection: 'contexts',
    where: {
      and: [
        { slug: { equals: data.slug } },
        data.parent ? { parent: { equals: data.parent } } : { parent: { exists: false } },
      ],
    },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `context  ${found.docs[0].path}`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'contexts', data })
  stamp(true, `context  ${doc.path} (id ${doc.id})`)
  return doc
}

export async function ensureUser(
  payload: Payload,
  data: {
    username: string
    password: string
    name: string
    minecraftName?: string
    role: 'admin' | 'editor' | 'resident'
    contextAccess?: { context: number; level: 'write' | 'publish' | 'manage' }[]
  },
) {
  // Payload stores usernames lowercased and trimmed; look them up the same way.
  const username = data.username.toLowerCase().trim()
  const found = await payload.find({
    collection: 'users',
    where: { username: { equals: username } },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `user     ${username} (id ${found.docs[0].id})`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'users', data })
  stamp(true, `user     ${username} (id ${doc.id}, ${data.role})`)
  return doc
}

export async function ensureProfile(
  payload: Payload,
  data: {
    name: string
    title: string
    contexts: number[]
    owner?: number
    minecraftName?: string
  },
) {
  const found = await payload.find({
    collection: 'profiles',
    where: { and: [{ name: { equals: data.name } }, { title: { equals: data.title } }] },
    limit: 1,
  })
  if (found.docs[0]) {
    stamp(false, `profile  ${found.docs[0].label}`)
    return found.docs[0]
  }
  const doc = await payload.create({ collection: 'profiles', data })
  stamp(true, `profile  ${doc.label} (id ${doc.id})`)
  return doc
}

export async function ensureMedia(payload: Payload, alt: string, filePath: string) {
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

export async function ensureArticle(
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
export async function ensurePage(payload: Payload, slug: string, data: Record<string, any>) {
  const found = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: slug } }, { context: { equals: data.context } }] },
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
