import type { Metadata } from 'next'

import { cardImageFor } from '@/components/og'

/**
 * The metadata of a page of Azania Maps, with what a chat client unfurls a
 * pasted link into: the map as the site name, the thing's name and a line
 * about it, and its own card from /og/maps/… (src/lib/ogMaps.ts), versioned
 * by when the record last changed so the long-cached picture turns over
 * with it. The layout's metadata gives the title its "· Azania Maps".
 */
export function mapsMetadata({
  title,
  description,
  path,
  updatedAt,
}: {
  title: string
  description: string
  path: string
  updatedAt: string | null | undefined
}): Metadata {
  const image = { ...cardImageFor(path, updatedAt), alt: `${title} · Azania Maps` }
  return {
    title,
    description,
    openGraph: { type: 'website', siteName: 'Azania Maps', title, description, url: path, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] },
  }
}
