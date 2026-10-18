import Link from 'next/link'

import { AccountLink } from '@/components/site/AccountLink'
import { NavLink } from '@/components/site/NavLink'
import { ACCENTS } from '@/contexts/designs'
import { archiveHref, contextHref, type SiteNav } from '@/lib/site'

import { IntlMark } from './IntlMark'

/**
 * The International masthead: a host strip naming the ground, a nameplate in
 * the record serif, and a bar of initiatives — each with its accent as a
 * swatch — that scrolls sideways on narrow screens rather than stacking.
 * Azania's own publications are a quiet line in the strip, as a host's
 * should be on neutral ground.
 */
export function IntlNav({ nav }: { nav: SiteNav }) {
  const home = contextHref(nav.top)
  const primary = [
    { href: home, label: 'Overview', exact: true, accent: null },
    ...nav.sections.map((link) => ({ ...link, exact: false })),
    { href: archiveHref(nav.top), label: 'Register', exact: false, accent: null },
    ...nav.pages.map((link) => ({ ...link, exact: true, accent: null })),
  ]
  return (
    <header className="bg-paper-50 text-graphite-900">
      {/* Host strip */}
      <div className="border-b border-paper-200 bg-paper-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite-500">
          <span className="min-w-0 truncate">
            Neutral ground<span className="hidden sm:inline"> · hosted by the Nation of Azania</span>
          </span>
          <nav aria-label="Elsewhere" className="flex shrink-0 items-center gap-x-4">
            {nav.elsewhere.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hidden transition-colors hover:text-graphite-900 sm:inline"
              >
                {link.label}&nbsp;↗
              </Link>
            ))}
            <AccountLink className="transition-colors hover:text-graphite-900" />
          </nav>
        </div>
      </div>

      {/* Nameplate */}
      <div className="mx-auto max-w-6xl px-6 pb-5 pt-6 md:pt-8">
        <Link href={home} className="inline-flex items-center gap-4">
          <IntlMark className="h-10 w-10 shrink-0 text-verdigris-700" />
          <span className="min-w-0">
            <span className="block font-record text-[26px] font-medium leading-none tracking-tight text-graphite-900 md:text-3xl">
              {nav.top.name}
            </span>
            {nav.top.tagline ? (
              <span className="mt-2 block font-mono text-[11px] uppercase leading-snug tracking-[0.14em] text-graphite-500">
                {nav.top.tagline}
              </span>
            ) : null}
          </span>
        </Link>
      </div>

      {/* Section bar */}
      <nav aria-label="Sections" className="border-y border-paper-200">
        <ul className="no-scrollbar mx-auto flex max-w-6xl items-stretch gap-x-7 overflow-x-auto px-6 text-[13px] font-medium">
          {primary.map((link) => (
            <li key={link.href} className="shrink-0">
              <NavLink
                href={link.href}
                exact={link.exact}
                className="flex items-center gap-2 border-b-2 border-transparent py-3 text-graphite-700 transition-colors hover:text-graphite-900 aria-[current]:border-verdigris-600 aria-[current]:text-graphite-900"
              >
                {link.accent ? (
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: ACCENTS[link.accent].hex }}
                  />
                ) : null}
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
