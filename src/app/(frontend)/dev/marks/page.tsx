import { notFound } from 'next/navigation'

import { MarksSpecimen } from '@/components/maps/ui/MarksSpecimen'

/**
 * The marks' specimen (ui/Marks.tsx), for whoever builds a panel from them
 * or reviews one: every mark in both sizes, on the light panel, the war
 * sidebar and the dark appearance. On one's own machine only, with the dev
 * server: in production it is not found, prerendered as a 404 at build,
 * so nothing is served for it.
 */

export default function MarksPage() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <MarksSpecimen />
}
