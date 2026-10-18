'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps } from 'react'

type Props = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  /** Mark only the exact page, not everything below it (for "Home"). */
  exact?: boolean
}

/**
 * A masthead link that knows where the visitor is: `aria-current="page"` on
 * its own page, `aria-current="true"` anywhere below it (a section's
 * articles, an archive's pages). Style both with `aria-[current]:` and
 * `aria-[current=page]:`.
 *
 * The only client code in the mastheads: the pathname is read here so the
 * shells stay server components and every page static.
 */
export function NavLink({ href, exact, ...props }: Props) {
  const pathname = usePathname()
  const path = href.split('?')[0]
  const current =
    pathname === path ? 'page' : !exact && pathname.startsWith(`${path}/`) ? 'true' : undefined
  return <Link href={href} aria-current={current} {...props} />
}
