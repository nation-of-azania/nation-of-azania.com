'use client'

import { useStore, type Store } from '../hooks'

/**
 * What the live map shows of the nation under the pointer, apart from the
 * layers so nothing else is redrawn for a hover: its claims drawn
 * stronger, by a style rule of its own.
 */
export function AbroadHover({ store }: { store: Store<string | null> }) {
  const nation = useStore(store)
  if (!nation) return null
  return <style>{`.az-abroad g[data-nation=${JSON.stringify(nation)}]{fill-opacity:.2;stroke-opacity:1;stroke-width:2px}`}</style>
}
