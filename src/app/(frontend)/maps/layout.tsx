import config from '@payload-config'
import type { Metadata, Viewport } from 'next'
import { after } from 'next/server'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { MapsShell } from '@/components/maps/MapsShell'
import { CARD, DESIGN_THEME } from '@/components/og/tokens'
import { getMapData, getMapRightsForRequest } from '@/lib/maps'
import { syncIfStale } from '@/lib/towns'

/**
 * Azania Maps (/maps): the map fills the viewport, and the pages beneath
 * this layout — the front, a town, a place, a road, an event — render into
 * its panel. The layout is dynamic: it reads the visitor's session for
 * their drawing rights, and after answering it has the towns re-read from
 * the Rulercraft map if the last reading is an hour old.
 */

export const dynamic = 'force-dynamic'

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
  const [data, rights] = await Promise.all([getMapData(), getMapRightsForRequest()])
  after(async () => {
    const payload = await getPayload({ config })
    await syncIfStale(payload)
  })
  return (
    <MapsShell data={data} rights={rights}>
      {children}
    </MapsShell>
  )
}
