import { revalidatePath } from 'next/cache'
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

/**
 * The site's pages (the front page and every context's, src/app/(frontend))
 * are cached for half an hour, since each regeneration is server compute,
 * which Vercel's free plan meters (CLAUDE.md). So a change readers should
 * see sooner has them rebuilt on their next visit: an article or page
 * published, changed while published, or unpublished; a context changed.
 * Draft saves (and autosaves, every second and a half while someone writes)
 * leave them be.
 */

const published = (doc: unknown): boolean => (doc as { _status?: unknown } | null)?._status === 'published'

function refresh(): void {
  try {
    revalidatePath('/(frontend)/[top]', 'layout')
    revalidatePath('/')
  } catch {
    // Outside a request Next can refresh from (a script, a migration): the pages catch up within half an hour.
  }
}

/** For collections with drafts: only when the published version changes (published, changed, or taken down). */
export const refreshWhenPublished: CollectionAfterChangeHook = ({ doc, previousDoc }) => {
  if (published(doc) || published(previousDoc)) refresh()
  return doc
}

/** For collections without drafts: on every change. */
export const refreshOnChange: CollectionAfterChangeHook = ({ doc }) => {
  refresh()
  return doc
}

export const refreshOnDelete: CollectionAfterDeleteHook = ({ doc }) => {
  refresh()
  return doc
}
