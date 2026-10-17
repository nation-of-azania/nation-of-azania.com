import type { Payload } from 'payload'

/**
 * Convergent "ensure" helpers shared by the dev seed (index.ts) and the
 * production first-deploy bootstrap (bootstrap.ts). Each looks an entity up
 * by a natural key (username, category name, media alt text, article title,
 * page slug) and creates it only when missing.
 */

export const log = (message: string) => console.log(`[seed] ${message}`)

/** How many entries this process created (for the summary line). */
export const seedStats = { created: 0 }

const stamp = (created: boolean, label: string) => {
  if (created) seedStats.created += 1
  log(`${created ? 'created ' : 'exists  '}${label}`)
}

/** The nation's article categories, created by both the seed and the bootstrap. */
export const CATEGORIES = ['Decrees', 'Gazette', 'Culture', 'Public Works', 'Markets', 'Opinion']

export async function ensureUser(
  payload: Payload,
  data: {
    username: string
    password: string
    name: string
    minecraftName?: string
    role: 'admin' | 'editor' | 'resident'
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
    publication: 'government' | 'times' | 'both'
    owner?: number
    minecraftName?: string
  },
) {
  const found = await payload.find({
    collection: 'profiles',
    where: {
      and: [
        { name: { equals: data.name } },
        { title: { equals: data.title } },
        { publication: { equals: data.publication } },
      ],
    },
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

export async function ensureCategory(payload: Payload, name: string) {
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
