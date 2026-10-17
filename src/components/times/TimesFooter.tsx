import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/times', label: 'Front Page', prefetch: undefined },
  { href: '/gov', label: 'The Government Gazette', prefetch: undefined },
  { href: '/gov/about', label: 'About Condoria', prefetch: undefined },
  { href: '/admin', label: 'Registry (Admin)', prefetch: false },
] as const

/** The Condor Times colophon: deep maroon, gold accents, an independent tone. */
export function TimesFooter() {
  return (
    <footer className="bg-maroon-900 text-news-100">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-news text-2xl font-black uppercase tracking-tight text-news-50">
              The Condor Times
            </p>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.24em] text-tgold-300">
              Independent of the Chancellery
            </p>
            <p className="mt-5 text-sm leading-relaxed text-news-100/80">
              The free press of the high valley — published without the Council’s leave and,
              on a good week, to its faint irritation.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-[11px] uppercase tracking-[0.2em] text-tgold-300">The Paper</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {FOOTER_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    prefetch={link.prefetch}
                    className="text-news-100/85 transition-colors hover:text-tgold-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-12 border-t border-maroon-700 pt-6 text-xs text-news-100/60">
          <p>
            © {new Date().getFullYear()} The Condor Times — an independent paper of the Nation
            of Condoria.
          </p>
        </div>
      </div>
    </footer>
  )
}
