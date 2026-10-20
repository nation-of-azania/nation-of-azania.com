import type { DefaultNodeTypes, SerializedBlockNode, SerializedLinkNode } from '@payloadcms/richtext-lexical'
import { convertLexicalToHTML, LinkHTMLConverter, type HTMLConvertersFunction } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import { COLOR, STYLE_THEME } from '@/components/og/tokens'
import { resolveImage } from '@/components/site/format'
import type { Design } from '@/contexts/designs'
import type { StyleId } from '@/contexts/styles'
import type {
  Article,
  CalloutBlockType,
  DiscordBlockType,
  EmbedBlockType,
  GalleryBlockType,
  ImageBlockType,
  LitematicBlockType,
  MapBlockType,
  Media,
  Model3DBlockType,
  QuoteBlockType,
  SkinBlockType,
} from '@/payload-types'

/**
 * An article's content as plain HTML for a feed's `content:encoded`: the
 * same Lexical document the page renders (src/components/RichText.tsx),
 * reduced to what a feed reader can show. Prose, lists, links and pictures
 * come through as themselves, with every URL made absolute; each custom
 * block degrades to what it can be without the site around it — a callout
 * to an aside, a quote to a blockquote, a gallery to its plates, a Discord
 * exchange to its lines, a map to its clipping, a skin to its still render —
 * and the exhibits only the page can show (the 3D model, the Litematica
 * build) to a short note and a link back to the article.
 */

type ContentBlocks =
  | CalloutBlockType
  | DiscordBlockType
  | EmbedBlockType
  | GalleryBlockType
  | ImageBlockType
  | LitematicBlockType
  | MapBlockType
  | Model3DBlockType
  | QuoteBlockType
  | SkinBlockType

type NodeTypes = DefaultNodeTypes | SerializedBlockNode<ContentBlocks>

/** Where the content is read from: the absolute origin, the paper and the article it belongs to. */
export type ContentPlace = {
  origin: string
  design: Design
  style: StyleId | null
  /** The article's absolute URL, for the notes that send a reader to the page. */
  articleUrl: string
  /** The top-level context's slug, for internal links whose target carries no path. */
  topSlug: string
}

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** `url` as an absolute URL on `origin`; already-absolute URLs pass through. */
export const absoluteUrl = (url: string, origin: string): string =>
  /^https?:\/\//i.test(url) ? url : new URL(url, origin).href

/** Only ever emit http(s) hrefs, whatever an editor pasted. */
function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

/** The ink a paper outlines a town's claims in, as the Map block draws them (src/blocks/components/Map). */
const CLAIM_INK: Record<Design, string> = {
  gazette: COLOR.coral600,
  times: COLOR.cinnabar700,
  international: COLOR.verdigris600,
}

/** An `<img>` for a media item at the given rendition, with an absolute URL; empty when there is nothing to show. */
function img(media: Media | number | null | undefined, size: 'card' | 'hero', place: ContentPlace): string {
  const image = resolveImage(media, size)
  if (!image) return ''
  return `<img src="${escapeHtml(absoluteUrl(image.url, place.origin))}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" />`
}

const figure = (body: string, caption?: string | null): string =>
  `<figure>${body}${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`

/** A short note in place of an exhibit only the page can show, pointing the reader there. */
const exhibitNote = (what: string, caption: string | null | undefined, place: ContentPlace): string =>
  `<p><em>${escapeHtml(what)}${caption ? `: ${escapeHtml(caption)}` : ''}.</em> <a href="${escapeHtml(place.articleUrl)}">View it on the page.</a></p>`

/**
 * Internal links point at a populated article or page. An article's
 * canonical URL needs its context's path; when the link's target was not
 * populated that deep, the paper the link sits in is the best guess.
 */
function internalHref(linkNode: SerializedLinkNode, place: ContentPlace): string {
  const doc = linkNode.fields.doc
  if (!doc || !doc.value || typeof doc.value !== 'object') return place.articleUrl
  const value = doc.value as { slug?: string | null; context?: number | { path?: string | null } | null }
  const slug = typeof value.slug === 'string' && value.slug ? value.slug : null
  if (!slug) return place.articleUrl
  const contextPath = typeof value.context === 'object' && value.context?.path ? value.context.path : null
  if (doc.relationTo === 'pages') {
    return absoluteUrl(`${contextPath ?? `/${place.topSlug}`}/${slug}`, place.origin)
  }
  const top = contextPath?.split('/')[1] ?? place.topSlug
  return absoluteUrl(`/${top}/articles/${slug}`, place.origin)
}

const convertersFor =
  (place: ContentPlace): HTMLConvertersFunction<NodeTypes> =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkHTMLConverter({ internalDocToHref: ({ linkNode }) => internalHref(linkNode, place) }),
    // An upload in the prose: the card rendition, absolute; a file that is not a picture is left out.
    upload: ({ node }) => {
      const value = node.value as Media | number | null | undefined
      const picture = img(value, 'card', place)
      return picture ? figure(picture) : ''
    },
    blocks: {
      callout: ({ node }) => {
        const { title, body } = node.fields
        return `<aside>${title ? `<p><strong>${escapeHtml(title)}</strong></p>` : ''}<p>${escapeHtml(body).replace(/\n/g, '<br />')}</p></aside>`
      },
      quote: ({ node }) => {
        const { quote, attribution, attributionTitle } = node.fields
        const credit = [attribution, attributionTitle].filter(Boolean).join(', ')
        return `<blockquote><p>${escapeHtml(quote).replace(/\n/g, '<br />')}</p>${credit ? `<footer>— ${escapeHtml(credit)}</footer>` : ''}</blockquote>`
      },
      image: ({ node }) => {
        const picture = img(node.fields.image, node.fields.layout === 'wide' ? 'hero' : 'card', place)
        return picture ? figure(picture, node.fields.caption) : ''
      },
      gallery: ({ node }) =>
        (node.fields.items ?? [])
          .map((item) => {
            const picture = img(item.image, 'card', place)
            return picture ? figure(picture, item.caption) : ''
          })
          .join(''),
      embed: ({ node }) => {
        const url = safeHttpUrl(node.fields.url)
        if (!url) return ''
        return `<p><a href="${escapeHtml(url)}">${escapeHtml(node.fields.caption || url)}</a></p>`
      },
      // The exchange as its lines: who said what, the channel and caption beneath.
      discord: ({ node }) => {
        const { channel, messages, sourceUrl, caption } = node.fields
        const lines = (messages ?? [])
          .map((message) => {
            const said = message.body ? escapeHtml(message.body).replace(/\n/g, '<br />') : ''
            const attached = message.image ? img(message.image, 'card', place) : ''
            return `<p><strong>${escapeHtml(message.author)}</strong>${said ? ` ${said}` : ''}${attached ? `<br />${attached}` : ''}</p>`
          })
          .join('')
        const source = safeHttpUrl(sourceUrl)
        const where = channel ? `#${channel.replace(/^#/, '')}` : 'Discord'
        const credit = source ? `<a href="${escapeHtml(source)}">${escapeHtml(where)}</a>` : escapeHtml(where)
        const note = [credit, caption ? escapeHtml(caption) : ''].filter(Boolean).join(' · ')
        return `<figure><blockquote>${lines}</blockquote><figcaption>${note}</figcaption></figure>`
      },
      // The clipping itself, drawn by /mapclip as on the page; the town is resolved there.
      map: ({ node }) => {
        const { town, x, z, zoom, aspect, claims, pin, caption } = node.fields
        const colour = (place.style && STYLE_THEME[place.style]) || CLAIM_INK[place.design]
        const query = new URLSearchParams({ zoom: zoom || 'town', aspect: aspect || 'wide' })
        query.set('colour', colour.slice(1))
        const townName = town?.trim()
        if (townName) query.set('town', townName)
        if (typeof x === 'number' && typeof z === 'number') {
          query.set('x', String(Math.round(x)))
          query.set('z', String(Math.round(z)))
        }
        if (townName && claims === false) query.set('claims', '0')
        if (pin) query.set('pin', '1')
        if (!townName && !query.has('x')) return ''
        const alt = townName
          ? `${townName.replace(/_/g, ' ')} on the Rulercraft map`
          : `The Rulercraft map around x ${query.get('x')}, z ${query.get('z')}`
        const src = absoluteUrl(`/mapclip?${query}`, place.origin)
        return figure(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" />`, caption)
      },
      // The still render the page shows before its viewer loads, from the skin service.
      skin: ({ node }) => {
        const name = node.fields.minecraftName?.trim()
        if (!name) return ''
        const still = `https://mc-heads.net/body/${encodeURIComponent(name)}/180`
        const caption = [name, node.fields.caption].filter(Boolean).join(' — ')
        return figure(`<img src="${escapeHtml(still)}" alt="${escapeHtml(name)}’s Minecraft skin" width="180" height="432" />`, caption)
      },
      model3d: ({ node }) => exhibitNote('An interactive 3D model', node.fields.caption, place),
      litematic: ({ node }) => exhibitNote('An interactive Litematica build', node.fields.caption, place),
    },
    // Anything without a converter is left out rather than rendered as a chip.
    unknown: () => '',
  })

/** The article's content as HTML; empty when there is none. */
export function contentHtml(data: Article['content'] | null | undefined, place: ContentPlace): string {
  if (!data?.root?.children?.length) return ''
  try {
    return convertLexicalToHTML({
      converters: convertersFor(place),
      data: data as SerializedEditorState,
      disableContainer: true,
    }).trim()
  } catch {
    return ''
  }
}
