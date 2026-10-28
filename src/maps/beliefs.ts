import type { WorldKind } from './world'

/**
 * A nation's cultures and religions: its people's shares, as its towns'
 * mayors chose them in game (`/cultures`, `/religion`; read off the
 * Rulercraft map in src/lib/dynmap.ts). Players' towns only: a server site
 * has neither. Each town's residents count towards its choice, and the
 * towns that haven't chosen make a share of their own, always last. Pure,
 * so the browser and the server say the same.
 */

export type Share = {
  /** The culture or religion, as the map spells it; null for the towns that haven't chosen one. */
  name: string | null
  towns: number
  residents: number
}

export type Beliefs = { cultures: Share[]; religions: Share[] }

type Believer = { kind: WorldKind; residents: number; culture: string | null; religion: string | null }

function sharesOf(towns: Believer[], of: (town: Believer) => string | null): Share[] {
  const shares = new Map<string, Share>()
  for (const town of towns) {
    const name = of(town)?.trim() || null
    // One share for one choice however it's capitalised; the first spelling met names it.
    const key = name?.toLowerCase() ?? ''
    const share = shares.get(key) ?? { name, towns: 0, residents: 0 }
    share.towns += 1
    share.residents += town.residents
    shares.set(key, share)
  }
  return [...shares.values()].sort(
    (a, b) =>
      Number(a.name === null) - Number(b.name === null) ||
      b.residents - a.residents ||
      b.towns - a.towns ||
      (a.name ?? '').localeCompare(b.name ?? ''),
  )
}

/** The cultures and religions of a nation's towns, the most people first. */
export function beliefsOf(towns: Believer[]): Beliefs {
  const people = towns.filter((town) => town.kind === 'town')
  return { cultures: sharesOf(people, (town) => town.culture), religions: sharesOf(people, (town) => town.religion) }
}
