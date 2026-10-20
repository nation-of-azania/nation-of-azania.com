import Link from 'next/link'

import { archiveHref, type SiteNav } from '@/lib/site'

import { Crest } from './Crest'

/** Deep-sea colophon with the crest, the national motto and site links. */
export function Footer({ nav }: { nav: SiteNav }) {
  const record = [
    { href: archiveHref(nav.top), label: 'The Gazette' },
    ...nav.sections,
    ...nav.pages,
  ]
  const elsewhere = [
    { href: '/maps', label: 'Azania Maps', prefetch: undefined },
    ...nav.elsewhere.map((link) => ({ ...link, prefetch: undefined })),
    { href: '/admin', label: 'Registry (Admin)', prefetch: false },
  ]
  const linkClass =
    'text-sand-200/85 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300'
  return (
    <footer className="mt-24 border-t border-saffron-400/70 bg-sea-950 text-sand-200">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3.5">
              <Crest className="h-11 w-auto shrink-0 text-saffron-300" />
              <div>
                <p className="font-mark text-lg uppercase leading-none tracking-[0.3em] text-sand-50">
                  Azania
                </p>
                <p className="mt-2 text-[11px] uppercase leading-none tracking-[0.22em] text-saffron-300">
                  Portus Omnibus
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-sand-200/80">
              Azania is a nation of the Rulercraft realm — a trading coast of sailors and
              builders, kept in order by the Chancellery and the Council, and in memory by this
              Gazette. Its motto, <span className="italic">portus omnibus</span>: a harbour for
              all.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-16 gap-y-10">
            <nav aria-label="The record">
              <p className="text-[11px] uppercase tracking-[0.2em] text-saffron-300">The Record</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {record.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Elsewhere">
              <p className="text-[11px] uppercase tracking-[0.2em] text-saffron-300">Elsewhere</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {elsewhere.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} prefetch={link.prefetch} className={linkClass}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        <div className="mt-12 border-t border-sand-200/15 pt-6 text-xs text-sand-200/60">
          <p>© {new Date().getFullYear()} The Nation of Azania.</p>
        </div>
      </div>
    </footer>
  )
}
