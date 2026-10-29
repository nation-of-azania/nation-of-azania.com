import config from '@payload-config'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import { cache } from 'react'

import { DESIGN_VIEWS } from '@/components/designs'
import { DraftLinkExpired, DraftLinkNote } from '@/components/DraftLink'
import { articleHref } from '@/components/site/format'
import { DRAFT_TOKEN } from '@/lib/draftLinks'
import { articleStyle, designOf, getSiteNav, getSiteTree } from '@/lib/site'
import type { Article } from '@/payload-types'

/**
 * /draft/<token>: an article's latest draft, for whoever was sent the link
 * (src/collections/DraftLinks.ts), in the design and chrome of the context
 * it will appear in, with a note that it's a draft and until when the link
 * works. Never cached, never indexed, and no referrer leaves the page, so
 * the token stays with the people it was given to. An unknown token is a
 * plain 404; an expired one says so.
 */

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ token: string }> }

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

type Loaded =
  | { state: 'expired'; expiresAt: string; publishedHref: string | null }
  | { state: 'open'; article: Article; expiresAt: string }

const load = cache(async (token: string): Promise<Loaded | null> => {
  if (!DRAFT_TOKEN.test(token)) return null
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'draft-links',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const link = docs[0]
  const articleId = idOf(link?.article)
  if (!link || articleId == null) return null
  if (new Date(link.expiresAt).getTime() <= Date.now()) {
    // Published since? Then the reader has somewhere to go: the public record, which gives nothing away.
    const stored = await payload
      .findByID({ collection: 'articles', id: articleId, depth: 1, overrideAccess: true })
      .catch(() => null)
    const publishedHref = stored?._status === 'published' ? articleHref(stored) : null
    return { state: 'expired', expiresAt: link.expiresAt, publishedHref }
  }
  const article = await payload
    .findByID({ collection: 'articles', id: articleId, draft: true, depth: 2, overrideAccess: true })
    .catch(() => null)
  if (!article || idOf(article.context) == null) return null
  return { state: 'open', article, expiresAt: link.expiresAt }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const loaded = await load((await params).token)
  return {
    title: loaded?.state === 'open' ? `${loaded.article.title || 'Untitled'} (draft)` : 'Draft link',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

export default async function DraftLinkPage({ params }: Props) {
  const loaded = await load((await params).token)
  if (!loaded) notFound()
  if (loaded.state === 'expired') {
    return <DraftLinkExpired expiresAt={loaded.expiresAt} publishedHref={loaded.publishedHref} />
  }

  const { article, expiresAt } = loaded
  const tree = await getSiteTree()
  const chain = tree.ancestors(idOf(article.context)!)
  const top = chain[0]
  if (!top) notFound()
  const { Shell, Article: ArticleView } = DESIGN_VIEWS[designOf(top)]
  return (
    <Shell nav={await getSiteNav(top)}>
      {/* First, under the masthead: the reader knows what they're reading before they read it. */}
      <DraftLinkNote expiresAt={expiresAt} published={article._status === 'published'} />
      <ArticleView article={article} chain={chain} draft={false} style={articleStyle(tree, article)} />
    </Shell>
  )
}
