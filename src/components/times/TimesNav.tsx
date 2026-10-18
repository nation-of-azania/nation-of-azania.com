import Link from 'next/link'

import { AccountLink } from '@/components/site/AccountLink'
import { archiveHref, contextHref, type SiteNav } from '@/lib/site'

/**
 * The Azanian Times masthead: a cinnabar utility bar, a bold Archivo
 * nameplate over cool newsprint, a lagoon-teal hairline, and a section bar.
 * The paper keeps standing links across to the other top-level contexts.
 */
export function TimesNav({ nav }: { nav: SiteNav }) {
  const home = contextHref(nav.top)
  const sections = [
    { href: home, label: 'Front Page' },
    ...nav.sections,
    { href: archiveHref(nav.top), label: 'Archive' },
    ...nav.pages,
  ]
  return (
    <header className="bg-news-50 text-news-900">
      {/* Utility bar */}
      <div className="bg-cinnabar-800 text-news-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-1.5 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span className="min-w-0 truncate">
            Independent Press<span className="hidden sm:inline"> of the Azanian Coast</span>
          </span>
          <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
            <AccountLink className="transition-colors hover:text-lagoon-300" />
            {nav.elsewhere.map((link) => (
              <span key={link.href} className="flex items-center gap-3">
                <span aria-hidden="true" className="h-3 w-px bg-news-50/30" />
                <Link href={link.href} className="transition-colors hover:text-lagoon-300">
                  {link.label}&nbsp;↗
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Nameplate */}
      <div className="border-b-2 border-cinnabar-800">
        <div className="mx-auto max-w-6xl px-6 py-7 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 h-px w-full max-w-md bg-lagoon-500" />
          <Link
            href={home}
            className="font-news text-4xl font-black uppercase leading-none tracking-tight text-cinnabar-800 transition-colors hover:text-cinnabar-700 md:text-6xl"
          >
            {nav.top.name}
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-news-500 sm:text-[11px]">
            {nav.top.tagline || 'Independent of the Chancellery'} · The Free Press of Port Azania
          </p>
        </div>
      </div>

      {/* Section bar */}
      <nav aria-label="Sections" className="border-b border-news-200 bg-news-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-cinnabar-800">
          {sections.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-lagoon-600">
              {link.label}
            </Link>
          ))}
          {nav.elsewhere[0] ? (
            <Link
              href={nav.elsewhere[0].href}
              className="ms-auto font-medium text-news-500 transition-colors hover:text-cinnabar-700"
            >
              {nav.elsewhere[0].label}&nbsp;↗
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  )
}
