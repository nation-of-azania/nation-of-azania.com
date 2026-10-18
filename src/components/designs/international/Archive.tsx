import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { RecordList } from '@/components/intl/IntlRecord'
import { Pagination } from '@/components/site/Pagination'
import { accentStyle } from '@/components/site/format'
import { TYPE_LABELS } from '@/contexts/designs'
import { archiveHref } from '@/lib/site'

import type { ArchiveProps } from '../types'

/** The whole register under an International context, newest first, by series. */
export function Archive({ top, result, page, type, types }: ArchiveProps) {
  const docs = result?.docs ?? []
  const totalDocs = result?.totalDocs ?? 0
  const shown = type ? TYPE_LABELS[type] : 'All records'

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 md:py-16" style={accentStyle(null, 'slate')}>
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500">{top.name}</p>
        <h1 className="mt-2 font-record text-4xl font-medium tracking-tight text-graphite-900 md:text-5xl">
          The Register
        </h1>
        <p className="mt-4 max-w-2xl text-graphite-700">
          Everything entered under {top.name}, newest first: announcements, standards,
          resolutions, reports and case studies.
        </p>
        {types.length > 1 ? (
          <nav aria-label="Filter by type" className="mt-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-500">Series</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[null, ...types].map((option) => (
                <li key={option ?? 'all'}>
                  <Link
                    href={archiveHref(top, option)}
                    aria-current={option === type ? 'page' : undefined}
                    className={cn(
                      'inline-flex items-center border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors',
                      option === type
                        ? 'border-graphite-900 bg-graphite-900 text-paper-50'
                        : 'border-paper-300 text-graphite-700 hover:border-graphite-500 hover:text-graphite-900',
                    )}
                  >
                    {option ? TYPE_LABELS[option] : 'All'}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <p className="mt-8 flex items-end justify-between gap-6 border-b border-graphite-900 pb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-graphite-700">
          <span>{shown}</span>
          {totalDocs > 0 ? (
            <span className="text-graphite-500">
              {totalDocs} {totalDocs === 1 ? 'record' : 'records'}
            </span>
          ) : null}
        </p>
      </header>

      {docs.length > 0 ? (
        <>
          <RecordList articles={docs} empty="" className="border-t-0" />
          <Pagination
            tone="international"
            page={result?.page ?? page}
            totalPages={result?.totalPages ?? 1}
            hasPrevPage={result?.hasPrevPage ?? false}
            hasNextPage={result?.hasNextPage ?? false}
            hrefFor={(target) => archiveHref(top, type, target)}
          />
        </>
      ) : (
        <div className="border-b border-paper-200 py-16 text-center">
          <p className="font-record text-xl font-medium text-graphite-900">
            {totalDocs > 0 ? `There is no page ${page} of the register.` : 'The register is empty.'}
          </p>
          <p className="mt-2 text-sm text-graphite-500">
            {totalDocs > 0 ? (
              <Link href={archiveHref(top, type)} className="text-verdigris-700 hover:text-verdigris-800">
                Return to the first page →
              </Link>
            ) : (
              'When the first record is entered, it will appear here.'
            )}
          </p>
        </div>
      )}
    </div>
  )
}
