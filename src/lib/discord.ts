import type { Payload } from 'payload'

import { TYPE_LABELS, type Design } from '../contexts/designs'
import { styleOfArticle, type StyleId } from '../contexts/styles'
import { buildTree } from '../contexts/tree'
import type { Article, Context, Media, Profile, User } from '../payload-types'

/**
 * Announces newly published articles in Discord, through channel webhooks.
 * Optional: nothing is sent unless a webhook is configured.
 *
 *   DISCORD_WEBHOOK_URL       every top-level context posts here
 *   DISCORD_WEBHOOK_<SLUG>    one top-level context posts here instead,
 *                             e.g. DISCORD_WEBHOOK_GOV, DISCORD_WEBHOOK_TIMES
 *
 * Each article is announced once, when it is first published by someone
 * signed in (Articles' `announcedAt`); later edits, migrations and the seed
 * never post. A failed post is logged and never blocks publishing.
 */

/** The embed's side colour: the design's own, or the style's. */
const DESIGN_COLOURS: Record<Design, string> = {
  gazette: '#14334b', // sea-800
  times: '#772012', // cinnabar-800
  international: '#2b5f57', // verdigris-700
}
const STYLE_COLOURS: Record<StyleId, string> = {
  blossom: '#9b2f5e', // blossom-700
}

const TIMEOUT_MS = 5000

/** Discord's own hosts, and localhost for trying it out; anything else is ignored. */
const isWebhookUrl = (url: string) =>
  /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\//.test(url) ||
  /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(url)

/** The webhook for a top-level context, or null when none is configured. */
export function webhookFor(topSlug: string | null | undefined): string | null {
  const own = topSlug ? process.env[`DISCORD_WEBHOOK_${topSlug.toUpperCase().replace(/\W/g, '_')}`] : undefined
  const url = (own || process.env.DISCORD_WEBHOOK_URL || '').trim()
  return url && isWebhookUrl(url) ? url : null
}

/** The public origin, for links and images in the embed. */
function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL
  if (configured) return configured.replace(/\/$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  return vercel ? `https://${vercel}` : 'http://localhost:3000'
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

/**
 * Posts the article to its top-level context's webhook. Resolves to whether a
 * message was sent; never throws.
 */
export async function announceArticle(payload: Payload, article: Article): Promise<boolean> {
  try {
    const { docs } = await payload.find({
      collection: 'contexts',
      pagination: false,
      depth: 0,
      select: { name: true, slug: true, parent: true, design: true, order: true, style: true, path: true, label: true },
    })
    const tree = buildTree(docs as Context[])
    const contextId = idOf(article.context)
    if (contextId == null || !tree.byId.has(contextId)) return false
    const chain = tree.ancestors(contextId)
    const top = chain[0]
    const url = webhookFor(top?.slug)
    if (!url || !article.slug) return false

    const design = tree.designOf(contextId)
    const style = styleOfArticle(article, chain, design)
    const context = tree.byId.get(contextId) as Context
    const site = siteUrl()
    const path = `/${top.slug}/articles/${article.slug}`

    // The byline as the site credits it: the profile, else the author's own name.
    const profileId = idOf(article.byline)
    const authorId = idOf(article.author)
    const profile = profileId
      ? ((await payload.findByID({ collection: 'profiles', id: profileId, depth: 1 }).catch(() => null)) as Profile | null)
      : null
    const author = authorId
      ? ((await payload.findByID({ collection: 'users', id: authorId, depth: 0 }).catch(() => null)) as User | null)
      : null
    const name = profile?.name ?? author?.name ?? author?.username
    const title = profile?.title
    const upload = profile?.avatar && typeof profile.avatar === 'object' ? (profile.avatar as Media).url : null
    const head = profile ? profile.minecraftName : author?.minecraftName
    const icon = upload
      ? new URL(upload, site).toString()
      : head
        ? `https://mc-heads.net/avatar/${encodeURIComponent(head)}/64`
        : undefined

    const colour = (style ? STYLE_COLOURS[style] : null) ?? DESIGN_COLOURS[design]
    const typeName = TYPE_LABELS[article.type as keyof typeof TYPE_LABELS] ?? ''
    const body = {
      username: clip(top.name, 80),
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: clip(article.title, 256),
          url: `${site}${path}`,
          ...(article.excerpt ? { description: clip(article.excerpt, 600) } : {}),
          color: Number.parseInt(colour.slice(1), 16),
          ...(name ? { author: { name: clip(title ? `${name}, ${title}` : name, 256), ...(icon ? { icon_url: icon } : {}) } } : {}),
          image: { url: `${site}/og${path}?v=${encodeURIComponent(article.updatedAt)}` },
          footer: { text: clip([context.label ?? context.name, typeName].filter(Boolean).join(' · '), 2048) },
          timestamp: article.publishedAt ?? new Date().toISOString(),
        },
      ],
    }

    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) {
      payload.logger.warn(`[discord] "${article.title}" was not announced: Discord answered ${response.status}`)
      return false
    }
    payload.logger.info(`[discord] announced "${article.title}" for ${top.name}`)
    return true
  } catch (error) {
    payload.logger.warn(`[discord] "${article.title}" was not announced: ${(error as Error).message}`)
    return false
  }
}
