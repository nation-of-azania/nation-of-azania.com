import type { ReactNode } from 'react'
import type { PaginatedDocs } from 'payload'

import type { ArticleType } from '@/contexts/designs'
import type { StyleId } from '@/contexts/styles'
import type { NavLink, SiteNav } from '@/lib/site'
import type { Article, Context, Page } from '@/payload-types'

/**
 * What every design implements: chrome around everything under a top-level
 * context, and a view for each kind of URL (see src/lib/site.ts). Routes
 * fetch the data; designs only render it.
 */

export type ShellProps = { nav: SiteNav; children: ReactNode }

/** A sanction list a front page points to (src/lib/sanctions.ts), in brief. */
export type SanctionListLink = {
  name: string
  href: string
  players: number
  /** When it last changed (ISO). */
  changedAt: string
}

/** /<top>: the top-level context's front page. */
export type HomeProps = {
  top: Context
  /** Its listed sub-contexts. */
  sections: Context[]
  /** Its standing pages (About, …). */
  pages: NavLink[]
  pinned: Article[]
  /** Newest first, pinned articles excluded. */
  latest: Article[]
  /** Its public sanction lists; a design that keeps none may ignore them. */
  sanctions?: SanctionListLink[]
}

/** /<top>/<sub>/…: a sub-context at any depth. */
export type SectionProps = {
  context: Context
  /** From the top-level context down to `context`, inclusive. */
  chain: Context[]
  /** The style the context wears (see contextStyle in src/lib/site.ts); null for the design's own look. */
  style: StyleId | null
  /** Its listed sub-contexts. */
  subContexts: Context[]
  /** Its standing pages. */
  pages: NavLink[]
  pinned: Article[]
  /** Newest first, pinned excluded; includes everything below `context`. */
  latest: Article[]
}

/** /<top>/articles: every article under the top-level context. */
export type ArchiveProps = {
  top: Context
  result: PaginatedDocs<Article> | null
  page: number
  /** The type filter in force, if any. */
  type: ArticleType | null
  /** The design's types that have published articles, for filtering. */
  types: ArticleType[]
}

/** /<top>/articles/<slug>. */
export type ArticleProps = {
  article: Article
  /** From the top-level context down to the article's context. */
  chain: Context[]
  /** The style the article wears (see articleStyle in src/lib/site.ts); null for the design's own look. */
  style: StyleId | null
  /** Draft mode: render PreviewTools. */
  draft: boolean
}

/** /<context path>/<slug>: a standing page. */
export type PageProps = {
  page: Page
  chain: Context[]
  draft: boolean
}

/** A view is a server component; it may be async (e.g. to resolve a card's style). */
type View<P> = (props: P) => ReactNode | Promise<ReactNode>

export type DesignViews = {
  Shell: View<ShellProps>
  Home: View<HomeProps>
  Section: View<SectionProps>
  Archive: View<ArchiveProps>
  Article: View<ArticleProps>
  Page: View<PageProps>
}
