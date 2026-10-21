import config from '@payload-config'
import type { Metadata, Viewport } from 'next'
import { after } from 'next/server'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { MapsShell } from '@/components/maps/MapsShell'
import { CARD, DESIGN_THEME } from '@/components/og/tokens'
import { getMapData } from '@/lib/maps'
import { syncIfStale } from '@/lib/towns'

/**
 * Azania Maps (/maps): the map fills the viewport, and the pages beneath
 * this layout — the front, a town, a place, a road, an event — render into
 * its panel. The pages are the same for everyone and cached, regenerated
 * a minute after they're last asked for (and at once after someone draws,
 * see ./revalidate); the visitor's own drawing rights are fetched in the
 * browser. Each regeneration has the towns re-read from the Rulercraft
 * map, after answering, if the last reading is a quarter of an hour old.
 */

export const revalidate = 60

export const metadata: Metadata = {
  title: { default: 'Azania Maps', template: '%s · Azania Maps' },
  description:
    'The Nation of Azania, charted: its towns, places, roads and events on the Rulercraft map.',
  openGraph: {
    siteName: 'Azania Maps',
    type: 'website',
    images: [{ url: '/og/azania', ...CARD, alt: 'Azania Maps' }],
  },
}

export const viewport: Viewport = { themeColor: DESIGN_THEME.gazette }

export default async function MapsLayout({ children }: { children: ReactNode }) {
  const data = await getMapData()
  // Never fails the page, nor a build that prerenders it without a database.
  after(() =>
    getPayload({ config })
      .then(syncIfStale)
      .catch(() => {}),
  )
  return <MapsShell data={data}>{children}</MapsShell>
}
