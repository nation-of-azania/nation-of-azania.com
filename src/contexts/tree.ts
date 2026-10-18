import { type Design, isDesign } from './designs'

/**
 * The context tree, built in memory from the flat list of contexts. There are
 * few contexts (dozens, not thousands), so access checks, hooks and pages load
 * them all and walk the tree here, instead of storing ancestors on every
 * document. Nesting depth is unlimited; cycles are refused when saving (see
 * src/collections/Contexts.ts) and ignored defensively here.
 */

export type ContextRecord = {
  id: number
  name: string
  slug?: string | null
  parent?: number | { id: number } | null
  design?: string | null
  order?: number | null
}

export type ContextTree<T extends ContextRecord = ContextRecord> = {
  byId: Map<number, T>
  roots: T[]
  childrenOf: (id: number | null) => T[]
  /** The chain from the top-level context down to `id`, inclusive. */
  ancestors: (id: number) => T[]
  /** `id` and everything below it. */
  descendants: (id: number) => T[]
  /** The design of the top-level context above `id`. */
  designOf: (id: number) => Design
  /** The URL path, e.g. "/intl/transport/roads". */
  pathOf: (id: number) => string
}

export const parentIdOf = (record: ContextRecord): number | null =>
  record.parent == null ? null : typeof record.parent === 'number' ? record.parent : record.parent.id

const byOrder = (a: ContextRecord, b: ContextRecord) =>
  (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)

export function buildTree<T extends ContextRecord>(records: T[]): ContextTree<T> {
  const byId = new Map(records.map((record) => [record.id, record]))
  const children = new Map<number | null, T[]>()
  for (const record of records) {
    const parent = parentIdOf(record)
    // An unknown parent (deleted, or not loaded) makes the record a root.
    const key = parent != null && byId.has(parent) ? parent : null
    children.set(key, [...(children.get(key) ?? []), record])
  }
  for (const list of children.values()) list.sort(byOrder)

  const ancestors = (id: number): T[] => {
    const chain: T[] = []
    const seen = new Set<number>()
    let current = byId.get(id)
    while (current && !seen.has(current.id)) {
      seen.add(current.id)
      chain.unshift(current)
      const parent = parentIdOf(current)
      current = parent != null ? byId.get(parent) : undefined
    }
    return chain
  }

  const descendants = (id: number): T[] => {
    const out: T[] = []
    const seen = new Set<number>()
    const visit = (record: T | undefined) => {
      if (!record || seen.has(record.id)) return
      seen.add(record.id)
      out.push(record)
      for (const child of children.get(record.id) ?? []) visit(child)
    }
    visit(byId.get(id))
    return out
  }

  return {
    byId,
    roots: children.get(null) ?? [],
    childrenOf: (id) => children.get(id) ?? [],
    ancestors,
    descendants,
    designOf: (id) => {
      const design = ancestors(id)[0]?.design
      return isDesign(design) ? design : 'gazette'
    },
    pathOf: (id) => `/${ancestors(id).map((record) => record.slug).join('/')}`,
  }
}
