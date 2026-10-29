import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import type { EntryChange, ListEntry, MemberState, PlayerChange } from '../lists/resolve'
import type { List, ListChange } from '../payload-types'
import { entriesOf, rosterOf } from './lists'
import { getSiteTree } from './site'

/**
 * Public sanction lists (src/collections/Lists.ts, kind "sanctions") as
 * the pages show them: the Gazette's page of one, its front page, and the
 * Sanction list block. Read as a visitor, so only a public list, and its
 * changelog, ever comes back.
 */

export type SanctionPlayer = MemberState & { key: string }

export type SanctionList = {
  id: number
  name: string
  slug: string
  description: string | null
  classes: { name: string; description: string | null }[]
  entries: ListEntry[]
  /** Everyone on it, by name. */
  players: SanctionPlayer[]
  /** When the roster was last brought up to date. */
  rosterAt: string | null
  updatedAt: string
  /** The context it belongs to (its id), whose top-level context's Gazette shows it. */
  context: number | null
}

const idOf = (value: unknown): number | null =>
  typeof value === 'number' ? value : ((value as { id?: number } | null | undefined)?.id ?? null)

export function sanctionListOf(list: List): SanctionList {
  const players = Object.entries(rosterOf(list.roster))
    .map(([key, member]) => ({ ...member, key }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return {
    id: list.id,
    name: list.name,
    slug: list.slug ?? String(list.id),
    description: list.description ?? null,
    classes: (list.classes ?? []).map((item) => ({ name: item.name, description: item.description ?? null })),
    entries: entriesOf(list.entries),
    players,
    rosterAt: list.rosterAt ?? null,
    updatedAt: list.updatedAt,
    context: idOf(list.context),
  }
}

const getClient = () => getPayload({ config })

/** A sanction list's page: under the top-level context its own context lies in. Null without a context. */
export async function sanctionListHref(list: Pick<SanctionList, 'context' | 'slug'>): Promise<string | null> {
  if (list.context == null) return null
  const tree = await getSiteTree()
  const top = tree.ancestors(list.context)[0]
  return top ? `/${top.slug}/sanctions/${encodeURIComponent(list.slug)}` : null
}

const PUBLIC_SANCTIONS: Where[] = [{ kind: { equals: 'sanctions' } }, { visibility: { equals: 'public' } }]

/** A public sanction list by slug or id; null when there's none, or it isn't public. */
export async function getSanctionList(by: { slug: string } | { id: number }): Promise<SanctionList | null> {
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'lists',
      where: { and: [...PUBLIC_SANCTIONS, 'slug' in by ? { slug: { equals: by.slug } } : { id: { equals: by.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: false,
    })
    return docs[0] ? sanctionListOf(docs[0]) : null
  } catch {
    return null
  }
}

/** The public sanction lists belonging to any of these contexts, for a front page. */
export async function getSanctionLists(contextIds: number[]): Promise<SanctionList[]> {
  if (contextIds.length === 0) return []
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'lists',
      where: { and: [...PUBLIC_SANCTIONS, { context: { in: contextIds } }] },
      sort: 'name',
      pagination: false,
      depth: 0,
      overrideAccess: false,
    })
    return docs.map(sanctionListOf)
  } catch {
    return []
  }
}

export type ListChangeView = {
  id: number
  at: string
  source: 'edit' | 'world'
  note: string | null
  summary: string
  entries: EntryChange[]
  players: PlayerChange[]
}

const viewOf = (change: ListChange): ListChangeView => ({
  id: change.id,
  at: change.at,
  source: change.source,
  note: change.note ?? null,
  summary: change.summary ?? '',
  entries: Array.isArray(change.entries) ? (change.entries as EntryChange[]) : [],
  players: Array.isArray(change.players) ? (change.players as PlayerChange[]) : [],
})

/**
 * Only what came through one of the list's towns or nations (“Imperial_Avalonia”),
 * for a log of who moved in and out; the entries and players as recorded otherwise.
 */
export function through(change: ListChangeView, name: string | null | undefined): ListChangeView {
  const wanted = name?.trim().toLowerCase()
  if (!wanted) return change
  return {
    ...change,
    entries: change.entries.filter((entry) => entry.name.toLowerCase() === wanted),
    players: change.players.filter((player) => player.via.some((via) => via.name.toLowerCase() === wanted)),
  }
}

/** One change to a public sanction list, as recorded. */
export async function getListChange(id: number): Promise<{ list: SanctionList; change: ListChangeView } | null> {
  try {
    const payload = await getClient()
    const change = await payload.findByID({ collection: 'list-changes', id, depth: 0, overrideAccess: false })
    const listId = idOf(change.list)
    const list = listId == null ? null : await getSanctionList({ id: listId })
    return list ? { list, change: viewOf(change) } : null
  } catch {
    return null
  }
}

/** A public sanction list's changelog, newest first; with `name`, only what came through that town or nation. */
export async function getListChanges(listId: number, { name, limit = 30 }: { name?: string | null; limit?: number } = {}): Promise<ListChangeView[]> {
  try {
    const payload = await getClient()
    const { docs } = await payload.find({
      collection: 'list-changes',
      where: { list: { equals: listId } },
      sort: '-at',
      // Filtering by town or nation happens after reading, so read enough to fill the page.
      limit: name ? Math.min(limit * 5, 500) : limit,
      depth: 0,
      overrideAccess: false,
    })
    return docs
      .map((doc) => through(viewOf(doc), name))
      .filter((change) => change.entries.length > 0 || change.players.length > 0)
      .slice(0, limit)
  } catch {
    return []
  }
}
