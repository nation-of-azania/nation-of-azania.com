import Link from 'next/link'

import { Emblem } from '@/components/site/Emblem'
import { contextHref, emblemOf } from '@/lib/site'
import type { Context } from '@/payload-types'

type Props = {
  /** The sub-contexts to list. */
  contexts: Context[]
  /** The chain above them, for the emblem each inherits. */
  chain: Context[]
}

/**
 * The initiatives under a context, each as a tile with the registry's bar
 * and its emblem when it has one. The whole tile is the link.
 */
export function InitiativeList({ contexts, chain }: Props) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {contexts.map((context) => {
        const own = [...chain, context]
        return (
          <li
            key={context.id}
            className="group relative flex gap-4 border border-paper-200 bg-paper-100/60 p-5 transition-colors hover:border-(--accent)"
          >
            <span aria-hidden="true" className="w-1 shrink-0 self-stretch bg-(--accent)" />
            <Emblem
              media={emblemOf(own)}
              size={44}
              className="border border-paper-200 bg-(--accent-wash) p-1"
            />
            <div className="min-w-0">
              <h3 className="font-record text-lg font-medium leading-snug text-graphite-900">
                <Link
                  href={contextHref(context)}
                  className="transition-colors after:absolute after:inset-0 group-hover:text-verdigris-700"
                >
                  {context.name}
                </Link>
              </h3>
              {context.tagline ? (
                <p className="mt-1 text-sm leading-relaxed text-graphite-500">{context.tagline}</p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
