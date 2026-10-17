import Link from 'next/link'

import { AccountLink } from '@/components/site/AccountLink'

/**
 * The Condor Times masthead: a utility bar, a bold Archivo nameplate in the
 * flag's maroon over a warm news ground, gold rules, and a section bar. The
 * paper keeps a standing link across to the state Gazette.
 */
export function TimesNav() {
  return (
    <header className="bg-news-50 text-news-900">
      {/* Utility bar */}
      <div className="bg-maroon-800 text-news-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-1.5 text-[10px] uppercase tracking-[0.2em] sm:text-[11px]">
          <span>Independent Press of the High Valley</span>
          <div className="flex items-center gap-3">
            <AccountLink className="transition-colors hover:text-tgold-300" />
            <span aria-hidden="true" className="h-3 w-px bg-news-50/30" />
            <Link href="/gov" className="transition-colors hover:text-tgold-300">
              Condoria Gazette&nbsp;↗
            </Link>
          </div>
        </div>
      </div>

      {/* Nameplate */}
      <div className="border-b-2 border-maroon-800">
        <div className="mx-auto max-w-6xl px-6 py-7 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 h-px w-full max-w-md bg-tgold-500" />
          <Link
            href="/times"
            className="font-news text-4xl font-black uppercase leading-none tracking-tight text-maroon-800 transition-colors hover:text-maroon-700 md:text-6xl"
          >
            The Condor Times
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-news-500 sm:text-[11px]">
            Independent of the Chancellery · The Free Press of the High Valley
          </p>
        </div>
      </div>

      {/* Section bar */}
      <nav aria-label="Sections" className="border-b border-news-200 bg-news-100">
        <div className="mx-auto flex max-w-6xl items-center gap-x-6 gap-y-1 px-6 py-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-maroon-800">
          <Link href="/times" className="transition-colors hover:text-tgold-600">
            Front Page
          </Link>
          <Link href="/gov/about" className="transition-colors hover:text-tgold-600">
            About Condoria
          </Link>
          <Link
            href="/gov"
            className="ms-auto font-medium text-news-500 transition-colors hover:text-maroon-700"
          >
            The Gazette&nbsp;↗
          </Link>
        </div>
      </nav>
    </header>
  )
}
