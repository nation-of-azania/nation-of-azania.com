import Link from 'next/link'

import { AccountLink } from './AccountLink'
import { Crest } from './Crest'

const NAV_LINKS = [
  { href: '/gov', label: 'Home' },
  { href: '/gov/articles', label: 'Gazette' },
  { href: '/gov/about', label: 'About' },
] as const

/**
 * The government masthead: pine ground, parchment text, crest and wordmark.
 * Topped by the national ribbon in the flag's maroon and gold, and carrying a
 * standing link across to the independent Condor Times.
 */
export function Nav() {
  return (
    <header className="border-b border-gold-400/70 bg-pine-900 text-parchment-100">
      {/* National ribbon — the flag's maroon and gold. */}
      <div aria-hidden="true" className="h-[3px] bg-flag-brown" />
      <div aria-hidden="true" className="h-px bg-flag-gold" />
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-3 px-6 py-4"
      >
        <Link
          href="/gov"
          className="group flex items-center gap-3.5 text-parchment-50 focus-visible:outline-gold-300"
        >
          <Crest className="h-10 w-auto shrink-0 text-gold-300 transition-colors group-hover:text-gold-200" />
          <span className="flex flex-col">
            <span className="font-display text-xl font-semibold uppercase leading-none tracking-[0.3em]">
              Condoria
            </span>
            <span className="mt-1.5 text-[10px] uppercase leading-none tracking-[0.22em] text-parchment-200/70">
              Official Gazette of the Nation
            </span>
          </span>
        </Link>
        <ul className="ms-auto flex flex-wrap items-center gap-x-7 gap-y-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13px] font-medium uppercase tracking-[0.18em] text-parchment-200 transition-colors hover:text-gold-200 focus-visible:outline-gold-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/times"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-[0.18em] text-tgold-300 transition-colors hover:text-tgold-400 focus-visible:outline-gold-300"
            >
              Condor Times
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
          <li aria-hidden="true" className="hidden h-4 w-px bg-parchment-200/25 sm:block" />
          <li>
            <AccountLink className="text-[13px] font-medium uppercase tracking-[0.18em] text-parchment-200 transition-colors hover:text-gold-200 focus-visible:outline-gold-300" />
          </li>
        </ul>
      </nav>
    </header>
  )
}
