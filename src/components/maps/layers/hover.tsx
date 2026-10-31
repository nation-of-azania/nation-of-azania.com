'use client'

import { useStore, type Store } from '../hooks'
import type { Projection } from './projection'
import { NationReach, type Reach } from './ReachLayer'

/**
 * What the live map shows of the nation under the pointer, apart from the
 * layers so nothing else is redrawn for a hover: its claims drawn
 * stronger, by a style rule of its own, and its reach.
 */
export function AbroadHover({ store }: { store: Store<string | null> }) {
  const nation = useStore(store)
  if (!nation) return null
  const group = `.az-abroad g[data-nation=${JSON.stringify(nation)}]`
  // A hatched nation (at war with Azania) keeps its hatching whole.
  return <style>{`${group}{stroke-opacity:1;stroke-width:2px}${group}:not([data-hatch]){fill-opacity:.2}`}</style>
}

/** The ring about the hovered nation's capital, on one copy of the world; none for a nation whose ring is drawn already. */
export function HoverReach({
  store,
  projection,
  reachOf,
  radius,
}: {
  store: Store<string | null>
  projection: Projection
  reachOf: (nation: string) => Reach | null
  radius: number
}) {
  const nation = useStore(store)
  const reach = nation ? reachOf(nation) : null
  return reach ? <NationReach projection={projection} radius={radius} reach={reach} /> : null
}
