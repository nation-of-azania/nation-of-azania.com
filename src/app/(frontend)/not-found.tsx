import Link from 'next/link'

import { Crest } from '@/components/site/Crest'
import { LinkButton } from '@/components/site/LinkButton'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center md:py-32">
      <Crest className="h-16 w-auto text-parchment-300" />
      <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-oxide-700">
        Archive Notice · 404
      </p>
      <h1 className="mt-4 text-balance font-display text-4xl text-pine-950">
        This record is not in the archive.
      </h1>
      <p className="mt-4 max-w-md text-ink-500">
        The page you requested has not been entered into the national record, or has since
        been struck from it.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        <LinkButton href="/gov" variant="primary">
          Return home
        </LinkButton>
        <Link
          href="/gov/articles"
          className="text-sm font-medium text-pine-700 transition-colors hover:text-pine-600"
        >
          Browse the Gazette →
        </Link>
      </div>
    </div>
  )
}
