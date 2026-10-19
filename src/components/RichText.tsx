import type {
  DefaultNodeTypes,
  SerializedBlockNode,
  SerializedLinkNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

import {
  type JSXConvertersFunction,
  LinkJSXConverter,
  RichText as PayloadRichText,
} from '@payloadcms/richtext-lexical/react'

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
  Model3DBlockType,
  Page,
  QuoteBlockType,
  SkinBlockType,
} from '@/payload-types'

import { CalloutBlock } from '@/blocks/components/Callout'
import { DiscordBlock } from '@/blocks/components/Discord'
import { EmbedBlock } from '@/blocks/components/Embed'
import { GalleryBlock } from '@/blocks/components/Gallery'
import { ImageBlock } from '@/blocks/components/Image'
import { LitematicBlock } from '@/blocks/components/Litematic'
import { MapBlock } from '@/blocks/components/Map'
import { Model3DBlock } from '@/blocks/components/Model3D'
import { QuoteBlock } from '@/blocks/components/Quote'
import { cn, type Tone, type Voice } from '@/blocks/components/shared'
import { SkinBlock } from '@/blocks/components/Skin'

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

/** Maps internal Lexical links (depth-populated docs) to frontend routes. */
function internalDocToHref({ linkNode }: { linkNode: SerializedLinkNode }): string {
  const doc = linkNode.fields.doc
  if (!doc || !doc.value || typeof doc.value !== 'object') return '#'
  const slug = typeof doc.value.slug === 'string' && doc.value.slug.length > 0 ? doc.value.slug : null
  if (!slug) return '#'
  if (doc.relationTo === 'articles') {
    const section = 'section' in doc.value && doc.value.section === 'times' ? 'times' : 'government'
    return section === 'times' ? `/times/${slug}` : `/gov/articles/${slug}`
  }
  if (doc.relationTo === 'pages') return `/gov/${slug}`
  return '#'
}

/**
 * The converter map, built for the paper the text is set in: most blocks
 * look the same everywhere, but a figure that follows its paper's voice (the
 * map, the skin) is told which paper, and which style the record wears.
 */
const convertersFor =
  (voice: Voice): JSXConvertersFunction<NodeTypes> =>
  ({ defaultConverters }) => ({
    ...defaultConverters,
    ...LinkJSXConverter({ internalDocToHref }),
    blocks: {
      callout: ({ node }) => <CalloutBlock {...node.fields} />,
      discord: ({ node }) => <DiscordBlock {...node.fields} />,
      embed: ({ node }) => <EmbedBlock {...node.fields} />,
      gallery: ({ node }) => <GalleryBlock {...node.fields} />,
      image: ({ node }) => <ImageBlock {...node.fields} />,
      litematic: ({ node }) => <LitematicBlock {...node.fields} />,
      map: ({ node }) => <MapBlock {...node.fields} {...voice} />,
      model3d: ({ node }) => <Model3DBlock {...node.fields} />,
      quote: ({ node }) => <QuoteBlock {...node.fields} />,
      skin: ({ node }) => <SkinBlock {...node.fields} {...voice} />,
    },
    // Nodes/blocks without a converter render nothing instead of crashing or
    // emitting the library's "unknown node" chip.
    unknown: () => null,
  })

/**
 * Prose typography for the default Lexical nodes, in two tones. The default
 * JSX converters emit classless tags (p, h1–h6, a, blockquote, hr, img), while
 * every element from our block components carries a class — so scoping these
 * selectors with `:not([class])` styles the prose without leaking into blocks.
 * Lists are the exception: the library puts `list-*` classes on ul/ol.
 *
 * NB: both variants are written out as literal class strings — Tailwind's
 * scanner only sees literals, so the tone cannot be interpolated.
 */
const STRUCTURE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-semibold',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:tracking-tight',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:leading-tight',
  '[&_h1:not([class])]:text-4xl',
  '[&_h2:not([class])]:text-3xl',
  '[&_h3:not([class])]:text-2xl',
  '[&_h4:not([class])]:text-xl',
  '[&_:is(h5,h6):not([class])]:text-lg',
  '[&_:is(h1,h2):not([class])]:mt-10',
  '[&_:is(h1,h2):not([class])]:mb-4',
  '[&_:is(h3,h4):not([class])]:mt-8',
  '[&_:is(h3,h4):not([class])]:mb-3',
  '[&_:is(h5,h6):not([class])]:mt-6',
  '[&_:is(h5,h6):not([class])]:mb-2',
  '[&_p:not([class])]:my-5',
  '[&_p:not([class])]:leading-relaxed',
  '[&_a:not([class])]:underline',
  '[&_a:not([class])]:underline-offset-2',
  '[&_blockquote:not([class])]:my-6',
  '[&_blockquote:not([class])]:border-l-2',
  '[&_blockquote:not([class])]:pl-5',
  '[&_blockquote:not([class])]:italic',
  '[&_ul.list-bullet]:my-5',
  '[&_ul.list-bullet]:list-disc',
  '[&_ul.list-bullet]:pl-6',
  '[&_ol.list-number]:my-5',
  '[&_ol.list-number]:list-decimal',
  '[&_ol.list-number]:pl-6',
  '[&_li_ul.list-bullet]:my-1',
  '[&_li_ol.list-number]:my-1',
  '[&_li]:my-1.5',
  '[&_hr:not([class])]:mx-auto',
  '[&_hr:not([class])]:my-10',
  '[&_hr:not([class])]:w-24',
  '[&_code:not([class])]:px-1',
  '[&_code:not([class])]:py-0.5',
  '[&_code:not([class])]:text-[0.9em]',
  '[&_img:not([class])]:h-auto',
  '[&_img:not([class])]:max-w-full',
  '[&_img:not([class])]:border',
  '[&_:is(img,picture):not([class])]:my-8',
  '[&_picture_img:not([class])]:my-0',
  '[&>*:first-child]:mt-0!',
  '[&>*:last-child]:mb-0!',
)

// The Gazette and the Times read their accents from the style slots
// (src/components/styles/slots.ts), so prose inside a styled record follows it.
const GAZETTE_TONE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-display',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:text-sea-900',
  '[&_a:not([class])]:text-sea-700',
  '[&_a:not([class])]:decoration-(--accent)',
  '[&_a:not([class]):hover]:text-sea-800',
  '[&_a:not([class]):hover]:decoration-(--accent-ink)',
  '[&_blockquote:not([class])]:border-(--accent)',
  '[&_blockquote:not([class])]:text-ink-700',
  '[&_li::marker]:text-(--accent-ink)',
  '[&_hr:not([class])]:border-(--accent)',
  '[&_code:not([class])]:bg-sand-200',
  '[&_img:not([class])]:border-sand-300',
)

const TIMES_TONE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-display',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:text-(--accent)',
  '[&_a:not([class])]:text-(--accent-ink)',
  '[&_a:not([class])]:decoration-lagoon-500',
  '[&_a:not([class]):hover]:text-(--accent)',
  '[&_a:not([class]):hover]:decoration-lagoon-600',
  '[&_blockquote:not([class])]:border-lagoon-500',
  '[&_blockquote:not([class])]:text-news-700',
  '[&_li::marker]:text-lagoon-600',
  '[&_hr:not([class])]:border-lagoon-500',
  '[&_code:not([class])]:bg-news-100',
  '[&_img:not([class])]:border-news-200',
)

// The International registry: record-serif headings in graphite, verdigris
// links and rules, and numbered-clause headings kept a touch quieter.
const INTERNATIONAL_TONE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-record',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-medium',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:text-graphite-900',
  '[&_a:not([class])]:text-verdigris-700',
  '[&_a:not([class])]:decoration-verdigris-300',
  '[&_a:not([class]):hover]:text-verdigris-800',
  '[&_a:not([class]):hover]:decoration-verdigris-600',
  '[&_blockquote:not([class])]:border-verdigris-500',
  '[&_blockquote:not([class])]:text-graphite-700',
  '[&_li::marker]:text-verdigris-600',
  '[&_hr:not([class])]:border-paper-300',
  '[&_code:not([class])]:bg-paper-100',
  '[&_img:not([class])]:border-paper-200',
)

const TONES: Record<Tone, string> = {
  gazette: cn(STRUCTURE, GAZETTE_TONE),
  times: cn(STRUCTURE, TIMES_TONE),
  international: cn(STRUCTURE, INTERNATIONAL_TONE),
}

type RichTextProps = {
  className?: string
  data: Article['content'] | Page['content'] | null | undefined
  /** Prose palette: the state Gazette (default), the Azanian Times, or the International registry. */
  tone?: Tone
  /** The style the record wears, for the blocks that draw in its colour (the map's claims); null or absent for the design's own. */
  style?: StyleId | null
}

/**
 * Renders Lexical rich text content, including every custom block (callout,
 * quote, image, gallery, embed, discord, map, skin, model3d, litematic).
 * Server-safe: the only client code is the Discord block's audio/spoiler
 * island, the map's image and copy button, and the Skin/Model3D/Litematic
 * dynamic imports.
 */
export function RichText({ data, className, tone = 'gazette', style = null }: RichTextProps) {
  if (!data?.root?.children?.length) return null

  return (
    <div className={cn(TONES[tone], className)}>
      <PayloadRichText
        converters={convertersFor({ tone, style })}
        data={data as SerializedEditorState}
        disableContainer
      />
    </div>
  )
}
