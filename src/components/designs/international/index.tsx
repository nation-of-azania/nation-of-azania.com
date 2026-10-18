import Link from 'next/link'

import { PreviewTools } from '@/components/PreviewTools'
import { RichText } from '@/components/RichText'
import { AccountLink } from '@/components/site/AccountLink'
import { Pagination } from '@/components/site/Pagination'
import {
  articleHref,
  formatDate,
  resolveByline,
  sectionOf,
  typeLabel,
} from '@/components/site/format'
import { TYPE_LABELS } from '@/contexts/designs'
import { archiveHref, contextHref } from '@/lib/site'
import type { Article as ArticleDoc, Context } from '@/payload-types'

import type {
  ArchiveProps,
  ArticleProps,
  DesignViews,
  HomeProps,
  PageProps,
  SectionProps,
  ShellProps,
} from '../types'

/**
 * The International design: initiatives among nations, hosted by Azania. A
 * plain, neutral working version: the shared ground of several nations, so
 * deliberately not in the Gazette's colours.
 */

function Shell({ nav, children }: ShellProps) {
  const links = [
    { href: contextHref(nav.top), label: 'Overview' },
    ...nav.sections,
    { href: archiveHref(nav.top), label: 'All publications' },
    ...nav.pages,
  ]
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
          <Link href={contextHref(nav.top)} className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">{nav.top.name}</span>
            <span className="text-xs text-slate-500">{nav.top.tagline}</span>
          </Link>
          <nav aria-label="Primary" className="ms-auto flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-slate-700 hover:text-slate-950">
                {link.label}
              </Link>
            ))}
            <AccountLink className="text-slate-700 hover:text-slate-950" />
          </nav>
        </div>
      </header>
      <main id="content" className="flex-1">
        {children}
      </main>
      <footer className="mt-24 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500">
          <p>Hosted by the Nation of Azania.</p>
          <p className="flex gap-4">
            {nav.elsewhere.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-slate-900">
                {link.label} ↗
              </Link>
            ))}
          </p>
        </div>
      </footer>
    </div>
  )
}

function Card({ article }: { article: ArticleDoc }) {
  const date = formatDate(article.publishedAt ?? article.createdAt)
  const section = sectionOf(article)
  return (
    <article className="relative border border-slate-200 p-5 hover:border-slate-400">
      <p className="text-xs uppercase tracking-wide text-slate-500">
        {typeLabel(article)}
        {section ? ` · ${section.name}` : ''}
        {date ? ` · ${date}` : ''}
      </p>
      <h3 className="mt-2 text-lg font-semibold leading-snug">
        <Link href={articleHref(article)} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </h3>
      {article.excerpt ? <p className="mt-2 line-clamp-3 text-sm text-slate-600">{article.excerpt}</p> : null}
    </article>
  )
}

function Breadcrumb({ chain }: { chain: Context[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
      {chain.map((context, index) => (
        <span key={context.id}>
          {index > 0 ? ' › ' : ''}
          <Link href={contextHref(context)} className="hover:text-slate-900">
            {context.name}
          </Link>
        </span>
      ))}
    </nav>
  )
}

function Listing({ articles, empty }: { articles: ArticleDoc[]; empty: string }) {
  return articles.length > 0 ? (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <Card key={article.id} article={article} />
      ))}
    </div>
  ) : (
    <p className="mt-6 text-sm text-slate-500">{empty}</p>
  )
}

function Home({ top, sections, pinned, latest }: HomeProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-4xl font-semibold tracking-tight">{top.name}</h1>
      {top.tagline ? <p className="mt-3 text-lg text-slate-600">{top.tagline}</p> : null}
      {top.intro ? <RichText data={top.intro} className="mt-8 max-w-3xl" /> : null}
      {sections.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Initiatives</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sections.map((section) => (
              <li key={section.id} className="relative border border-slate-200 p-5 hover:border-slate-400">
                <Link href={contextHref(section)} className="font-semibold after:absolute after:inset-0">
                  {section.name}
                </Link>
                {section.tagline ? <p className="mt-1 text-sm text-slate-600">{section.tagline}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Latest</h2>
        <Listing articles={[...pinned, ...latest]} empty="Nothing has been published yet." />
      </section>
    </div>
  )
}

function Section({ context, chain, subContexts, pages, pinned, latest }: SectionProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <Breadcrumb chain={chain.slice(0, -1)} />
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">{context.name}</h1>
      {context.tagline ? <p className="mt-3 text-lg text-slate-600">{context.tagline}</p> : null}
      {context.intro ? <RichText data={context.intro} className="mt-8 max-w-3xl" /> : null}
      {subContexts.length > 0 || pages.length > 0 ? (
        <ul className="mt-8 flex flex-wrap gap-3 text-sm">
          {[...subContexts.map((child) => ({ href: contextHref(child), label: child.name })), ...pages].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="inline-block border border-slate-300 px-3 py-1.5 hover:border-slate-500">
                {link.label} →
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Publications</h2>
        <Listing articles={[...pinned, ...latest]} empty="Nothing has been published here yet." />
      </section>
    </div>
  )
}

function Archive({ top, result, page, type, types }: ArchiveProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <h1 className="text-4xl font-semibold tracking-tight">All publications</h1>
      {types.length > 1 ? (
        <nav aria-label="Filter by type" className="mt-6 flex flex-wrap gap-2 text-sm">
          {[null, ...types].map((option) => (
            <Link
              key={option ?? 'all'}
              href={archiveHref(top, option)}
              aria-current={option === type ? 'page' : undefined}
              className={option === type ? 'bg-slate-900 px-3 py-1 text-white' : 'border border-slate-300 px-3 py-1'}
            >
              {option ? TYPE_LABELS[option] : 'All'}
            </Link>
          ))}
        </nav>
      ) : null}
      <Listing articles={result?.docs ?? []} empty={`Nothing here${page > 1 ? ` on page ${page}` : ''}.`} />
      <Pagination
        page={result?.page ?? page}
        totalPages={result?.totalPages ?? 1}
        hasPrevPage={result?.hasPrevPage ?? false}
        hasNextPage={result?.hasNextPage ?? false}
        hrefFor={(target) => archiveHref(top, type, target)}
      />
    </div>
  )
}

function Article({ article, chain, draft }: ArticleProps) {
  const byline = resolveByline(article)
  const date = formatDate(article.publishedAt ?? article.createdAt)
  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      {draft ? <PreviewTools /> : null}
      <Breadcrumb chain={chain} />
      <p className="mt-6 text-xs uppercase tracking-wide text-slate-500">
        {typeLabel(article)}
        {date ? ` · ${date}` : ''}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{article.title}</h1>
      {article.excerpt ? <p className="mt-4 text-lg text-slate-600">{article.excerpt}</p> : null}
      {byline ? (
        <p className="mt-4 text-sm text-slate-700">
          {byline.name}
          {byline.title ? `, ${byline.title}` : ''}
        </p>
      ) : null}
      <RichText data={article.content} className="mt-10" />
    </article>
  )
}

function Page({ page, chain, draft }: PageProps) {
  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      {draft ? <PreviewTools /> : null}
      <Breadcrumb chain={chain} />
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{page.title}</h1>
      <RichText data={page.content} className="mt-10" />
    </article>
  )
}

export const international: DesignViews = { Shell, Home, Section, Archive, Article, Page }
