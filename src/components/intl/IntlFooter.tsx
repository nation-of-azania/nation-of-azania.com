import Link from 'next/link'

import { FeedLink } from '@/components/site/FeedLink'
import { archiveHref, contextHref, feedHref, type SiteNav } from '@/lib/site'

import { IntlMark } from './IntlMark'

const LABEL = 'font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500'
const LINK = 'text-sm text-graphite-700 transition-colors hover:text-verdigris-700'

/**
 * The International colophon: what this ground is and who hosts it, the
 * initiatives, and the way back to Azania's own publications — kept to
 * paper and graphite, with no crest.
 */
export function IntlFooter({ nav }: { nav: SiteNav }) {
  const initiatives = [
    { href: contextHref(nav.top), label: 'Overview' },
    ...nav.sections,
    { href: archiveHref(nav.top), label: 'The Register' },
    ...nav.pages,
  ]
  return (
    <footer className="mt-24 border-t border-paper-200 bg-paper-100 text-graphite-700">
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-6 py-14 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
        <div>
          <p className="flex items-center gap-3">
            <IntlMark className="h-8 w-8 shrink-0 text-verdigris-700" />
            <span className="font-record text-xl font-medium text-graphite-900">{nav.top.name}</span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed">
            Neutral ground, hosted by the Nation of Azania on the Rulercraft realm. Delegates of
            member nations publish here alongside Azanians; what they publish belongs to the
            initiatives that wrote it, and is not the word of the Chancellery.
          </p>
        </div>
        <nav aria-label="Initiatives">
          <p className={LABEL}>Initiatives</p>
          <ul className="mt-4 space-y-2.5">
            {initiatives.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <FeedLink href={feedHref(nav.top)} className={LINK} title={`${nav.top.name} as an RSS feed`}>
                RSS feed
              </FeedLink>
            </li>
          </ul>
        </nav>
        <nav aria-label="The host">
          <p className={LABEL}>The host</p>
          <ul className="mt-4 space-y-2.5">
            {nav.elsewhere.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK}>
                  {link.label}&nbsp;↗
                </Link>
              </li>
            ))}
            <li>
              <Link href="/admin" prefetch={false} className={LINK}>
                Registry (Admin)
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-paper-200 px-6 py-6 font-mono text-[11px] text-graphite-500">
        © {new Date().getFullYear()} The initiatives and their authors. Hosted by the Nation of Azania.
      </div>
    </footer>
  )
}
