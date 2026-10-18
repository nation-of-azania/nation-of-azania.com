import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import type { Payload, PayloadRequest, Where } from 'payload'

import { ITALIC, paragraph, root, text } from '../seed/lexical'

/**
 * Content, not schema: sets up GirlieTown on production, once.
 *
 *  - GirlieTown, an office under Government, and GirlieTea, its column in the
 *    Times, both in the Cherry Blossom style
 *  - DefinitelyCasi's byline for both, and her access: Publish in GirlieTown,
 *    Write drafts in GirlieTea (a Times editor publishes the column)
 *  - two sample articles under IPaaat's own bylines, so the style can be seen
 *    on both papers before Casi writes her first
 *
 * It goes through the local API, so the collections' hooks compute paths and
 * labels and check everything as the admin panel would. Anything that
 * already exists is reused, and Casi's account is looked up by name: when it
 * can't be found unambiguously, her access is left for an admin to grant.
 */

const CASI = 'DefinitelyCasi'

const log = (payload: Payload, message: string) => payload.logger.info(`[girlietown] ${message}`)

/** Up to two matches: enough to tell one from none or several. */
async function lookup<TSlug extends 'contexts' | 'users' | 'profiles' | 'articles'>(
  payload: Payload,
  req: PayloadRequest,
  collection: TSlug,
  where: Where,
) {
  const { docs } = await payload.find({ collection, where, limit: 2, depth: 0, req })
  return docs
}

async function ensureContext(
  payload: Payload,
  req: PayloadRequest,
  parent: number,
  data: { name: string; slug: string; tagline: string },
) {
  const [found] = await lookup(payload, req, 'contexts', {
    and: [{ slug: { equals: data.slug } }, { parent: { equals: parent } }],
  })
  if (found) {
    log(payload, `context ${found.path} exists, kept as it is`)
    return found
  }
  const created = await payload.create({
    collection: 'contexts',
    data: { ...data, parent, style: 'blossom', listed: true },
    depth: 0,
    req,
  })
  log(payload, `created context ${created.path} (Cherry Blossom)`)
  return created
}

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const [gov] = await lookup(payload, req, 'contexts', {
    and: [{ slug: { equals: 'gov' } }, { parent: { exists: false } }],
  })
  const [times] = await lookup(payload, req, 'contexts', {
    and: [{ slug: { equals: 'times' } }, { parent: { exists: false } }],
  })
  if (!gov || !times) {
    log(payload, 'Government or the Times is missing; nothing set up')
    return
  }

  const girlieTown = await ensureContext(payload, req, gov.id, {
    name: 'GirlieTown',
    slug: 'girlietown',
    tagline: 'A town of Azania, under the cherry trees',
  })
  const girlieTea = await ensureContext(payload, req, times.id, {
    name: 'GirlieTea',
    slug: 'girlietea',
    tagline: 'A column from GirlieTown',
  })

  // Casi's account, by username, Minecraft name or display name.
  const candidates = await lookup(payload, req, 'users', {
    or: [
      { username: { equals: CASI.toLowerCase() } },
      { minecraftName: { equals: CASI } },
      { name: { equals: CASI } },
    ],
  })
  const casi = candidates.length === 1 ? candidates[0] : undefined
  if (!casi) {
    log(payload, `${candidates.length === 0 ? 'no account' : 'more than one account'} found for ${CASI}; grant her access under Users`)
  } else if (casi.role === 'resident') {
    const grants = (casi.contextAccess ?? []).map((grant) => ({
      context: typeof grant.context === 'number' ? grant.context : grant.context.id,
      level: grant.level,
    }))
    const granted = new Set(grants.map((grant) => grant.context))
    const added = [
      { context: girlieTown.id, level: 'publish' as const },
      { context: girlieTea.id, level: 'write' as const },
    ].filter((grant) => !granted.has(grant.context))
    if (added.length > 0) {
      await payload.update({
        collection: 'users',
        id: casi.id,
        data: { contextAccess: [...grants, ...added] },
        depth: 0,
        req,
      })
    }
    log(payload, `${CASI} is "${casi.username}": ${added.length} grant(s) added`)
  } else {
    log(payload, `${CASI} is "${casi.username}", already ${casi.role}; no grants needed`)
  }

  const [profile] = await lookup(payload, req, 'profiles', {
    and: [{ name: { equals: CASI } }, { title: { equals: 'GirlieTown' } }],
  })
  if (profile) {
    log(payload, `profile ${profile.label} exists, kept as it is`)
  } else {
    const created = await payload.create({
      collection: 'profiles',
      data: {
        name: CASI,
        title: 'GirlieTown',
        contexts: [girlieTown.id, girlieTea.id],
        ...(casi ? { owner: casi.id } : { minecraftName: CASI }),
      },
      depth: 0,
      req,
    })
    log(payload, `created profile ${created.label}`)
  }

  // Samples under IPaaat's own bylines (Co-Leader, Editor-in-Chief), which the
  // article hooks pick for these contexts. A fresh database has no accounts
  // yet when migrations run; then there are no samples either.
  const [author] = await lookup(payload, req, 'users', { role: { equals: 'admin' } })
  if (!author) {
    log(payload, 'no admin account yet; no sample articles')
    return
  }
  const samples = [
    {
      title: 'GirlieTown Takes Its Place in the Gazette',
      context: girlieTown.id,
      type: 'notice' as const,
      excerpt:
        'GirlieTown, the town of DefinitelyCasi, now keeps its own office in the Gazette. Its statements will appear here, in the town’s Cherry Blossom colours.',
      content: root(
        paragraph(
          'GirlieTown now keeps its own office in the Gazette. Statements and notices from the ',
          'town will be entered into the record here, alongside those of the Chancellery, in ',
          'the town’s own colours: the pinks of its cherry grove.',
        ),
        paragraph(
          'This notice is the office’s first entry, made to show how the town’s records will ',
          'look. GirlieTown’s own statements follow.',
        ),
      ),
    },
    {
      title: 'A First Cup of GirlieTea',
      context: girlieTea.id,
      type: 'opinion' as const,
      excerpt:
        'The Times has a new column. GirlieTea is written from GirlieTown by DefinitelyCasi; this first cup, poured by the editors, shows how it will look.',
      content: root(
        paragraph(
          'The Azanian Times has a new column. GirlieTea is written from GirlieTown by ',
          'DefinitelyCasi, and it takes its colours from the town’s cherry grove.',
        ),
        paragraph(
          'This first cup is poured by the editors, to show how the column will look on the ',
          'front page and in the archive. The first real one is Casi’s to write.',
        ),
        paragraph(text('GirlieTea’s views are its writer’s own.', ITALIC)),
      ),
    },
  ]
  for (const sample of samples) {
    const [existing] = await lookup(payload, req, 'articles', { title: { equals: sample.title } })
    if (existing) {
      log(payload, `article "${sample.title}" exists, kept as it is`)
      continue
    }
    const created = await payload.create({
      collection: 'articles',
      data: { ...sample, author: author.id, _status: 'published' },
      depth: 0,
      req,
    })
    log(payload, `published "${created.title}" at ${created.slug}`)
  }
}

/** Removes the samples and the two contexts, if nothing else was filed there since. */
export async function down({ payload, req }: MigrateDownArgs): Promise<void> {
  for (const title of ['GirlieTown Takes Its Place in the Gazette', 'A First Cup of GirlieTea']) {
    await payload.delete({ collection: 'articles', where: { title: { equals: title } }, req })
  }
  await payload.delete({
    collection: 'profiles',
    where: { and: [{ name: { equals: CASI } }, { title: { equals: 'GirlieTown' } }] },
    req,
  })
  for (const slug of ['girlietea', 'girlietown']) {
    const { errors } = await payload.delete({ collection: 'contexts', where: { slug: { equals: slug } }, req })
    if (errors.length > 0) log(payload, `kept context ${slug}: it holds something`)
  }
}
