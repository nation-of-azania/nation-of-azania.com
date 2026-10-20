import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Content fix: the Chancellor is Luixtiter in game, not "Luixiter". Corrects
 * the spelling in byline profiles (name and Minecraft name, so the right head
 * shows), in account display and Minecraft names, and in the text of
 * articles and pages, the About page among them. Usernames, which people sign
 * in with, are never touched.
 */

const WRONG = 'Luixiter'
const RIGHT = 'Luixtiter'

/** The same Lexical state with the name corrected in every text node; null when unchanged. */
function corrected(content: unknown): unknown {
  let changed = false
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (!node || typeof node !== 'object') return node
    const record = { ...(node as Record<string, unknown>) }
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' && value.includes(WRONG) && (key === 'text' || key === 'body' || key === 'caption')) {
        record[key] = value.replaceAll(WRONG, RIGHT)
        changed = true
      } else if (value && typeof value === 'object') {
        record[key] = walk(value)
      }
    }
    return record
  }
  const result = walk(content)
  return changed ? result : null
}

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const log = (message: string) => payload.logger.info(`[luixtiter] ${message}`)
  // Nothing to correct on a fresh database, and reading it through the local
  // API would expect columns that later migrations add.
  const { rows } = await db.execute(sql`SELECT EXISTS (SELECT 1 FROM "users") AS "any"`)
  if (!(rows[0] as { any?: boolean } | undefined)?.any) {
    log('fresh database; nothing to do')
    return
  }

  const { docs: profiles } = await payload.find({
    collection: 'profiles',
    where: { or: [{ name: { equals: WRONG } }, { minecraftName: { equals: WRONG } }] },
    depth: 0,
    pagination: false,
    req,
  })
  for (const profile of profiles) {
    const updated = await payload.update({
      collection: 'profiles',
      id: profile.id,
      data: {
        ...(profile.name === WRONG ? { name: RIGHT } : {}),
        ...(profile.minecraftName === WRONG ? { minecraftName: RIGHT } : {}),
      },
      depth: 0,
      req,
    })
    log(`profile now ${updated.label}`)
  }

  const { docs: users } = await payload.find({
    collection: 'users',
    where: { or: [{ name: { equals: WRONG } }, { minecraftName: { equals: WRONG } }] },
    depth: 0,
    pagination: false,
    req,
  })
  for (const user of users) {
    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        ...(user.name === WRONG ? { name: RIGHT } : {}),
        ...(user.minecraftName === WRONG ? { minecraftName: RIGHT } : {}),
      },
      depth: 0,
      req,
    })
    log(`account "${user.username}" corrected`)
  }

  for (const collection of ['articles', 'pages'] as const) {
    const { docs } = await payload.find({ collection, depth: 0, pagination: false, req })
    for (const doc of docs) {
      const content = corrected(doc.content)
      if (!content) continue
      await payload.update({
        collection,
        id: doc.id,
        data: { content: content as typeof doc.content, ...(doc._status === 'published' ? { _status: 'published' } : {}) },
        depth: 0,
        req,
      })
      log(`${collection} "${doc.title}" corrected`)
    }
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // A spelling fix; nothing to undo.
}
