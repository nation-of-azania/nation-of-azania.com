import Link from 'next/link'

import { AccountLink } from '@/components/site/AccountLink'
import { NavLink } from '@/components/site/NavLink'
import { archiveHref, contextHref, type SiteNav } from '@/lib/site'

/**
 * The Azanian Times masthead: a cinnabar utility bar, a bold Archivo
 * nameplate over cool newsprint, a lagoon-teal hairline, and a bar of desks
 * from the context tree that scrolls sideways on narrow screens. The paper
 * keeps its links to the other publications in the utility bar, where a
 * reader expects a paper to note what it is not.
 */
export function TimesNav({ nav }: { nav: SiteNav }) {
  const home = contextHref(nav.top)
  const sections = [
    { href: home, label: 'Front Page', exact: true },
    ...nav.sections.map((link) => ({ ...link, exact: false })),
    { href: archiveHref(nav.top), label: 'Archive', exact: false },
    ...nav.pages.map((link) => ({ ...link, exact: true })),
  ]
  return (
    <header className="bg-news-50 text-news-900">
      {/* Utility bar */}
      <div className="bg-cinnabar-800 text-news-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-1.5 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span className="min-w-0 truncate">
            Independent Press<span className="hidden sm:inline"> of the Azanian Coast</span>
          </span>
          <nav aria-label="Elsewhere" className="flex shrink-0 items-center gap-3 whitespace-nowrap">
            <AccountLink className="transition-colors hover:text-lagoon-300" />
            {nav.elsewhere.map((link) => (
              <span key={link.href} className="hidden items-center gap-3 sm:flex">
                <span aria-hidden="true" className="h-3 w-px bg-news-50/30" />
                <Link href={link.href} className="transition-colors hover:text-lagoon-300">
                  {link.label}&nbsp;↗
                </Link>
              </span>
            ))}
          </nav>
        </div>
      </div>

      {/* Nameplate */}
      <div className="border-b-2 border-cinnabar-800">
        <div className="mx-auto max-w-6xl px-6 py-7 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 h-px w-full max-w-md bg-lagoon-500" />
          <Link
            href={home}
            className="text-balance font-news text-4xl font-black uppercase leading-none tracking-tight text-cinnabar-800 transition-colors hover:text-cinnabar-700 md:text-6xl"
          >
            {nav.top.name}
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-news-500 sm:text-[11px]">
            {nav.top.tagline || 'Independent of the Chancellery'} · The Free Press of Port Azania
          </p>
        </div>
      </div>

      {/* Desk bar */}
      <nav aria-label="Sections" className="border-b border-news-200 bg-news-100">
        <ul className="no-scrollbar mx-auto flex max-w-6xl items-stretch gap-x-6 overflow-x-auto px-6 text-[12px] font-semibold uppercase tracking-[0.14em] text-cinnabar-800">
          {sections.map((link) => (
            <li key={link.href} className="shrink-0">
              <NavLink
                href={link.href}
                exact={link.exact}
                className="block border-b-2 border-transparent py-2.5 transition-colors hover:text-lagoon-600 aria-[current]:border-cinnabar-800 aria-[current]:text-news-900"
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
