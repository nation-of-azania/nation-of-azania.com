import Link from 'next/link'

import { archiveHref, contextHref, type SiteNav } from '@/lib/site'

import { AccountLink } from './AccountLink'
import { Crest } from './Crest'
import { NavLink } from './NavLink'

/**
 * The government masthead: deep-sea ground, sand text, crest and wordmark,
 * topped by the national ribbon — saffron over coral, the sunset line above
 * the water. Below the wordmark runs the bar of offices and standing pages
 * the context tree provides, which scrolls sideways on narrow screens; the
 * other publications sit quietly beside the sign-in, since the Gazette does
 * not speak for them.
 */
export function Nav({ nav }: { nav: SiteNav }) {
  const home = contextHref(nav.top)
  const links = [
    { href: home, label: 'Home', exact: true },
    { href: archiveHref(nav.top), label: 'Gazette', exact: false },
    ...nav.sections.map((link) => ({ ...link, exact: false })),
    ...nav.pages.map((link) => ({ ...link, exact: true })),
  ]
  return (
    <header className="border-b border-saffron-400/70 bg-sea-900 text-sand-100">
      {/* National ribbon — saffron and coral over the sea. */}
      <div aria-hidden="true" className="h-[3px] bg-flag-saffron" />
      <div aria-hidden="true" className="h-px bg-flag-coral" />

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-6 pb-3 pt-4">
        <Link
          href={home}
          className="group flex items-center gap-3.5 text-sand-50 focus-visible:outline-saffron-300"
        >
          <Crest className="h-10 w-auto shrink-0 text-saffron-300 transition-colors group-hover:text-saffron-200" />
          <span className="flex flex-col">
            <span className="font-mark text-xl uppercase leading-none tracking-[0.32em]">Azania</span>
            <span className="mt-1.5 text-[10px] uppercase leading-none tracking-[0.22em] text-sand-200/70">
              Official Gazette of the Nation
            </span>
          </span>
        </Link>
        <nav aria-label="Elsewhere" className="flex items-center gap-x-4 text-[11px] uppercase tracking-[0.18em]">
          <Link
            href="/maps"
            className="text-sand-200/70 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300"
          >
            Maps
          </Link>
          {nav.elsewhere.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden text-sand-200/70 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300 sm:inline"
            >
              {link.label}&nbsp;↗
            </Link>
          ))}
          <span aria-hidden="true" className="hidden h-3.5 w-px bg-sand-200/25 sm:block" />
          <AccountLink className="font-medium text-sand-200 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300" />
        </nav>
      </div>

      <nav aria-label="Primary" className="border-t border-sand-200/10">
        <ul className="no-scrollbar mx-auto flex max-w-6xl items-stretch gap-x-7 overflow-x-auto px-6">
          {links.map((link) => (
            <li key={link.href} className="shrink-0">
              <NavLink
                href={link.href}
                exact={link.exact}
                className="block border-b-2 border-transparent py-2.5 text-[12px] font-medium uppercase tracking-[0.18em] text-sand-200 transition-colors hover:text-saffron-200 focus-visible:outline-saffron-300 aria-[current]:border-saffron-400 aria-[current]:text-sand-50"
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
