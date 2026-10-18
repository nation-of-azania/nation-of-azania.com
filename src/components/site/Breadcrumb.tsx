import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { contextHref } from '@/lib/site'
import type { Context } from '@/payload-types'

type Props = {
  /** The ancestors to link, top-level context first. */
  chain: Context[]
  /** The page itself, named last without a link, when it is not a context. */
  current?: string
  className?: string
  linkClassName?: string
  separatorClassName?: string
}

/**
 * The way back up the context tree, at any depth: each ancestor a link, the
 * current page (when given) plain and marked `aria-current`. Each design
 * passes its own type and colours.
 */
export function Breadcrumb({ chain, current, className, linkClassName, separatorClassName }: Props) {
  if (chain.length === 0 && !current) return null
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {chain.map((context, index) => (
          <li key={context.id} className="flex items-center gap-x-2">
            <Link href={contextHref(context)} className={linkClassName}>
              {context.name}
            </Link>
            {index < chain.length - 1 || current ? (
              <span aria-hidden="true" className={cn('select-none', separatorClassName)}>
                ›
              </span>
            ) : null}
          </li>
        ))}
        {current ? <li aria-current="page">{current}</li> : null}
      </ol>
    </nav>
  )
}
