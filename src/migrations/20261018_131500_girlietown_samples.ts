import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/**
 * Content fix: the GirlieTown samples (20261018_123000_girlietown) were meant
 * to run under IPaaat's own bylines, but went to whichever admin account came
 * first. This hands them to IPaaat; the article hooks then pick his
 * Co-Leader and Editor-in-Chief bylines, as for any change of author.
 * Samples that are already his, or no longer exist under these titles, are
 * left alone.
 */

const SAMPLES = ['GirlieTown Takes Its Place in the Gazette', 'A First Cup of GirlieTea']

export async function up({ payload, req }: MigrateUpArgs): Promise<void> {
  const log = (message: string) => payload.logger.info(`[girlietown samples] ${message}`)
  const {
    docs: [ipaaat],
  } = await payload.find({
    collection: 'users',
    where: { username: { equals: 'ipaaat' } },
    limit: 1,
    depth: 0,
    req,
  })
  if (!ipaaat) {
    log('no IPaaat account; samples left as they are')
    return
  }

  for (const title of SAMPLES) {
    const {
      docs: [article],
    } = await payload.find({
      collection: 'articles',
      where: { title: { equals: title } },
      limit: 1,
      depth: 0,
      req,
    })
    if (!article) {
      log(`"${title}" not found`)
      continue
    }
    if (article.author === ipaaat.id) {
      log(`"${title}" is already IPaaat's`)
      continue
    }
    // Clearing the byline lets the hook pick the new author's profile for this context.
    const updated = await payload.update({
      collection: 'articles',
      id: article.id,
      data: { author: ipaaat.id, byline: null },
      depth: 1,
      req,
    })
    const byline = typeof updated.byline === 'object' && updated.byline ? updated.byline.label : 'none'
    log(`"${title}" now by IPaaat, byline ${byline}`)
  }
}

export async function down(_: MigrateDownArgs): Promise<void> {
  // Nothing to undo: who wrote a sample is not worth restoring.
}
