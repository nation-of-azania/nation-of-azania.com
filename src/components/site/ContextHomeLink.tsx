'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentProps, ReactNode } from 'react'

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { children: ReactNode }

/**
 * A link to the front page of whichever top-level context the visitor is in
 * (/gov, /times, /intl…), read from the URL. For the 404 inside a design's
 * shell, which Next renders without telling it where it is; falls back to
 * the site root, which forwards to the first listed context.
 */
export function ContextHomeLink({ children, ...props }: Props) {
  const pathname = usePathname()
  const top = pathname.split('/')[1]
  return (
    <Link href={top ? `/${top}` : '/'} {...props}>
      {children}
    </Link>
  )
}
