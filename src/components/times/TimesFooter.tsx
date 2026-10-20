import Link from 'next/link'

import { FeedLink } from '@/components/site/FeedLink'
import { archiveHref, contextHref, feedHref, type SiteNav } from '@/lib/site'

/** The Azanian Times colophon: deep cinnabar, lagoon accents, an independent tone. */
export function TimesFooter({ nav }: { nav: SiteNav }) {
  const links = [
    { href: contextHref(nav.top), label: 'Front Page', prefetch: undefined },
    { href: archiveHref(nav.top), label: 'Archive', prefetch: undefined },
    { href: '/maps', label: 'Azania Maps', prefetch: undefined },
    ...nav.elsewhere.map((link) => ({ ...link, prefetch: undefined })),
    { href: '/admin', label: 'Registry (Admin)', prefetch: false },
  ]
  return (
    <footer className="bg-cinnabar-900 text-news-100">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-news text-2xl font-black uppercase tracking-tight text-news-50">
              The Azanian Times
            </p>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.24em] text-lagoon-300">
              Independent of the Chancellery
            </p>
            <p className="mt-5 text-sm leading-relaxed text-news-100/80">
              The free press of the Azanian coast — published without the Chancellery’s leave
              and, on a good week, to its faint irritation.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-[11px] uppercase tracking-[0.2em] text-lagoon-300">The Paper</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch}
                    className="text-news-100/85 transition-colors hover:text-lagoon-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <FeedLink
                  href={feedHref(nav.top)}
                  className="text-news-100/85 transition-colors hover:text-lagoon-300"
                  glyphClassName="text-lagoon-300"
                  title={`${nav.top.name} as an RSS feed`}
                >
                  RSS feed
                </FeedLink>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-12 border-t border-cinnabar-700 pt-6 text-xs text-news-100/60">
          <p>
            © {new Date().getFullYear()} The Azanian Times — an independent paper of the Nation
            of Azania.
          </p>
        </div>
      </div>
    </footer>
  )
}
