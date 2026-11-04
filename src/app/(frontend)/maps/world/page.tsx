import type { Metadata } from 'next'

import { WorldPanel } from '@/components/maps/panels/WorldPanel'
import { WORLD_PATH } from '@/maps/url'

import { mapsMetadata } from '../metadata'

/**
 * The world in numbers: /maps/world. The page sends nothing but the panel:
 * every figure is worked out in the browser from the world the map has
 * already fetched (src/components/maps/panels/WorldPanel.tsx), so the
 * server reads no world, no marker file and no database for it, and the
 * card says what the view is in general words.
 */
export const metadata: Metadata = mapsMetadata({
  title: 'The world in numbers',
  description:
    'The whole Rulercraft server in numbers on Azania Maps: how many towns and people each continent holds, the nations ranked, the towns that stand out, and where Azania stands.',
  path: WORLD_PATH,
  updatedAt: null,
})

export default function WorldPage() {
  return <WorldPanel />
}
