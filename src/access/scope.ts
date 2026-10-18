import type { PayloadRequest } from 'payload'

import { buildTree, type ContextTree } from '../contexts/tree'
import { hasRole } from './index'

/**
 * Context-scoped permissions. Admins and editors act everywhere. Everyone else
 * acts only where an admin granted them access (Users → Context access): a
 * grant covers the context and everything below it, at one of three levels.
 */
export const LEVELS = ['write', 'publish', 'manage'] as const
export type Level = (typeof LEVELS)[number]

export const LEVEL_LABELS: Record<Level, string> = {
  write: 'Write drafts',
  publish: 'Publish',
  manage: 'Manage (publish, and edit the contexts below)',
}

const rank = (level: Level | null | undefined) => (level ? LEVELS.indexOf(level) + 1 : 0)

type Grant = { context?: number | { id: number } | null; level?: Level | null }

export type Scope = {
  /** Admins manage everything, including accounts and the context tree. */
  admin: boolean
  /** Admins and editors: every context, at every level. */
  staff: boolean
  tree: ContextTree
  /** Effective level per context id, after inheritance (non-staff only). */
  levels: Map<number, Level>
  /** The contexts named in the user's own grants. */
  grantRoots: Set<number>
}

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

export async function loadContextTree(req: PayloadRequest): Promise<ContextTree> {
  const { docs } = await req.payload.find({
    collection: 'contexts',
    limit: 0,
    depth: 0,
    pagination: false,
    select: { name: true, slug: true, parent: true, design: true, order: true },
    req,
  })
  return buildTree(docs)
}

const CACHE_KEY = 'azaniaAccessScope'

/** The current user's scope, computed once per request. */
export async function getScope(req: PayloadRequest): Promise<Scope> {
  const cached = req.context[CACHE_KEY] as Promise<Scope> | undefined
  if (cached) return cached
  const promise = (async (): Promise<Scope> => {
    const tree = await loadContextTree(req)
    const user = req.user as (typeof req.user & { contextAccess?: Grant[] | null }) | null
    const levels = new Map<number, Level>()
    const grantRoots = new Set<number>()
    for (const grant of user?.contextAccess ?? []) {
      const root = idOf(grant.context)
      if (!root || !grant.level) continue
      grantRoots.add(root)
      for (const context of tree.descendants(root)) {
        if (rank(grant.level) > rank(levels.get(context.id))) levels.set(context.id, grant.level)
      }
    }
    return {
      admin: hasRole(user, 'admin'),
      staff: hasRole(user, 'admin', 'editor'),
      tree,
      levels,
      grantRoots,
    }
  })()
  req.context[CACHE_KEY] = promise
  return promise
}

/** Whether the scope reaches `level` in the context. */
export const can = (scope: Scope, contextId: number | null | undefined, level: Level): boolean =>
  scope.staff || (contextId != null && rank(scope.levels.get(contextId)) >= rank(level))

/** Every context id the scope reaches at `level` (all of them for staff). */
export const contextIdsWith = (scope: Scope, level: Level): number[] =>
  scope.staff
    ? [...scope.tree.byId.keys()]
    : [...scope.levels].filter(([, granted]) => rank(granted) >= rank(level)).map(([id]) => id)

/** Whether the user may open the admin panel at all. */
export const canUseAdmin = (user: unknown): boolean => {
  const candidate = user as { role?: string | null; contextAccess?: unknown[] | null } | null
  return (
    hasRole(candidate as Parameters<typeof hasRole>[0], 'admin', 'editor') ||
    (candidate?.contextAccess?.length ?? 0) > 0
  )
}

/** A where-clause matching nothing (Payload treats `false` as "no access"). */
export const NOTHING = { id: { equals: -1 } }
