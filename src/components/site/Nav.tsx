import Link from 'next/link'

import { AccountLink } from './AccountLink'
import { Crest } from './Crest'

const NAV_LINKS = [
  { href: '/gov', label: 'Home' },
  { href: '/gov/articles', label: 'Gazette' },
  { href: '/gov/about', label: 'About' },
] as const

/**
 * The government masthead: deep-sea ground, sand text, crest and wordmark.
 * Topped by the national ribbon — saffron over coral, the sunset line above
 * the water — and carrying a standing link across to the independent
 * Azanian Times.
 */
export function Nav() {
  return (
    <header className="border-b border-saffron-400/70 bg-sea-900 text-sand-100">
      {/* National ribbon — saffron and coral over the sea. */}
      <div aria-hidden="true" className="h-[3px] bg-flag-saffron" />
      <div aria-hidden="true" className="h-px bg-flag-coral" />
      <nav
        aria-label="Primary"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-10 gap-y-3 px-6 py-4"
      >
        <Link
          href="/gov"
          className="group flex items-center gap-3.5 text-sand-50 focus-visible:outline-saffron-300"
        >
          <Crest className="h-10 w-auto shrink-0 text-saffron-300 transition-colors group-hover:text-saffron-200" />
          <span className="flex flex-col">
            <span className="font-mark text-xl uppercase leading-none tracking-[0.32em]">
              Azania
            </span>
            <span className="mt-1.5 text-[10px] uppercase leading-none tracking-[0.22em] text-sand-200/70">
              Official Gazette of the Nation
            </span>
          </span>
        </Link>
        <ul className="ms-auto flex flex-wrap items-center gap-x-7 gap-y-1">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[13px] font-medium uppercase tracking-[0.18em] text-sand-200 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/times"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium uppercase tracking-[0.18em] text-cinnabar-300 transition-colors hover:text-cinnabar-200 focus-visible:outline-saffron-300"
            >
              Azanian Times
              <span aria-hidden="true">↗</span>
            </Link>
          </li>
          <li aria-hidden="true" className="hidden h-4 w-px bg-sand-200/25 sm:block" />
          <li>
            <AccountLink className="text-[13px] font-medium uppercase tracking-[0.18em] text-sand-200 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300" />
          </li>
        </ul>
      </nav>
    </header>
  )
}
