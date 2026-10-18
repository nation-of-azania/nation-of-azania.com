import Link from 'next/link'

import { cn } from '@/blocks/components/shared'
import { Pagination } from '@/components/site/Pagination'
import { TimesCard } from '@/components/times/TimesCard'
import { TYPE_LABELS } from '@/contexts/designs'
import { archiveHref } from '@/lib/site'

import type { ArchiveProps } from '../types'

/** Every story the Times has printed, newest first, by kind. */
export function Archive({ top, result, page, type, types }: ArchiveProps) {
  const docs = result?.docs ?? []
  const totalDocs = result?.totalDocs ?? 0
  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-12">
      <header className="border-b-2 border-cinnabar-800 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500">{top.name}</p>
        <h1 className="mt-2 font-news text-4xl font-black uppercase tracking-tight text-cinnabar-800 md:text-5xl">
          The Archive
        </h1>
        {types.length > 1 ? (
          <nav aria-label="Filter by type" className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500">
              Kind of story
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {[null, ...types].map((option) => (
                <li key={option ?? 'all'}>
                  <Link
                    href={archiveHref(top, option)}
                    aria-current={option === type ? 'page' : undefined}
                    className={cn(
                      'inline-block px-2.5 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] transition-colors',
                      option === type
                        ? 'bg-cinnabar-800 text-news-50'
                        : 'bg-news-100 text-cinnabar-800 hover:bg-news-200 hover:text-cinnabar-900',
                    )}
                  >
                    {option ? TYPE_LABELS[option] : 'All'}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <p className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-news-500">
          <span>{type ? `${TYPE_LABELS[type]} only` : 'Every kind of story'}</span>
          {totalDocs > 0 ? (
            <span>
              {totalDocs} {totalDocs === 1 ? 'story' : 'stories'}
            </span>
          ) : null}
        </p>
      </header>
      {docs.length > 0 ? (
        <>
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {docs.map((article) => (
              <TimesCard key={article.id} article={article} />
            ))}
          </div>
          <Pagination
            tone="times"
            page={result?.page ?? page}
            totalPages={result?.totalPages ?? 1}
            hasPrevPage={result?.hasPrevPage ?? false}
            hasNextPage={result?.hasNextPage ?? false}
            hrefFor={(target) => archiveHref(top, type, target)}
          />
        </>
      ) : (
        <p className="mt-10 text-news-500">
          {totalDocs > 0 ? (
            <>
              There is no page {page}.{' '}
              <Link href={archiveHref(top, type)} className="font-semibold text-cinnabar-700 hover:text-cinnabar-800">
                Back to the first →
              </Link>
            </>
          ) : (
            'Nothing printed here yet.'
          )}
        </p>
      )}
    </div>
  )
}
