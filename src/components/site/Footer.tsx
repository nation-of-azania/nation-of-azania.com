import Link from 'next/link'

import { Crest } from './Crest'

const FOOTER_LINKS = [
  { href: '/gov/articles', label: 'The Gazette', prefetch: undefined },
  { href: '/gov/about', label: 'About the Nation', prefetch: undefined },
  { href: '/times', label: 'The Condor Times', prefetch: undefined },
  { href: '/admin', label: 'Registry (Admin)', prefetch: false },
] as const

/** Deep-pine colophon with the crest, the national motto and site links. */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-gold-400/70 bg-pine-950 text-parchment-200">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-12 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3.5">
              <Crest className="h-11 w-auto shrink-0 text-gold-300" />
              <div>
                <p className="font-display text-lg font-semibold uppercase leading-none tracking-[0.28em] text-parchment-50">
                  Condoria
                </p>
                <p className="mt-2 text-[11px] uppercase leading-none tracking-[0.22em] text-gold-300">
                  Ex Glacie, Concordia
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm leading-relaxed text-parchment-200/80">
              Condoria is a nation of the Rulercraft realm — a high-valley commonwealth of
              builders, kept in order by its council and in memory by this gazette.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-[11px] uppercase tracking-[0.2em] text-gold-300">The Record</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch}
                    className="text-parchment-200/85 transition-colors hover:text-gold-200 focus-visible:outline-gold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-12 border-t border-parchment-200/15 pt-6 text-xs text-parchment-200/60">
          <p>© {new Date().getFullYear()} The Nation of Condoria.</p>
        </div>
      </div>
    </footer>
  )
}
