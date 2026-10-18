import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { DESIGN_VIEWS } from '@/components/designs'
import { designOf, getSiteNav, getSiteTree } from '@/lib/site'

/**
 * Everything under a top-level context (/gov, /times, /intl, …) wears that
 * context's design: its chrome comes from here, its pages from
 * [[...rest]]/page.tsx.
 */
export default async function TopLevelLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ top: string }>
}) {
  const { top: slug } = await params
  const tree = await getSiteTree()
  const top = tree.roots.find((root) => root.slug === slug)
  if (!top) notFound()

  const { Shell } = DESIGN_VIEWS[designOf(top)]
  return <Shell nav={await getSiteNav(top)}>{children}</Shell>
}
