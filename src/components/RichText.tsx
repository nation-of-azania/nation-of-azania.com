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

import type {
  Article,
  CalloutBlockType,
  DiscordBlockType,
  EmbedBlockType,
  GalleryBlockType,
  ImageBlockType,
  LitematicBlockType,
  Model3DBlockType,
  Page,
  QuoteBlockType,
} from '@/payload-types'

import { CalloutBlock } from '@/blocks/components/Callout'
import { DiscordBlock } from '@/blocks/components/Discord'
import { EmbedBlock } from '@/blocks/components/Embed'
import { GalleryBlock } from '@/blocks/components/Gallery'
import { ImageBlock } from '@/blocks/components/Image'
import { LitematicBlock } from '@/blocks/components/Litematic'
import { Model3DBlock } from '@/blocks/components/Model3D'
import { QuoteBlock } from '@/blocks/components/Quote'
import { cn } from '@/blocks/components/shared'

type ContentBlocks =
  | CalloutBlockType
  | DiscordBlockType
  | EmbedBlockType
  | GalleryBlockType
  | ImageBlockType
  | LitematicBlockType
  | Model3DBlockType
  | QuoteBlockType

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

const converters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  blocks: {
    callout: ({ node }) => <CalloutBlock {...node.fields} />,
    discord: ({ node }) => <DiscordBlock {...node.fields} />,
    embed: ({ node }) => <EmbedBlock {...node.fields} />,
    gallery: ({ node }) => <GalleryBlock {...node.fields} />,
    image: ({ node }) => <ImageBlock {...node.fields} />,
    litematic: ({ node }) => <LitematicBlock {...node.fields} />,
    model3d: ({ node }) => <Model3DBlock {...node.fields} />,
    quote: ({ node }) => <QuoteBlock {...node.fields} />,
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

const GAZETTE_TONE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-display',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:text-pine-900',
  '[&_a:not([class])]:text-pine-700',
  '[&_a:not([class])]:decoration-gold-400',
  '[&_a:not([class]):hover]:text-pine-800',
  '[&_a:not([class]):hover]:decoration-gold-600',
  '[&_blockquote:not([class])]:border-gold-400',
  '[&_blockquote:not([class])]:text-ink-700',
  '[&_li::marker]:text-gold-600',
  '[&_hr:not([class])]:border-gold-400',
  '[&_code:not([class])]:bg-parchment-200',
  '[&_img:not([class])]:border-parchment-300',
)

const TIMES_TONE = cn(
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:font-display',
  '[&_:is(h1,h2,h3,h4,h5,h6):not([class])]:text-maroon-800',
  '[&_a:not([class])]:text-maroon-700',
  '[&_a:not([class])]:decoration-tgold-500',
  '[&_a:not([class]):hover]:text-maroon-800',
  '[&_a:not([class]):hover]:decoration-tgold-600',
  '[&_blockquote:not([class])]:border-tgold-500',
  '[&_blockquote:not([class])]:text-news-700',
  '[&_li::marker]:text-tgold-600',
  '[&_hr:not([class])]:border-tgold-500',
  '[&_code:not([class])]:bg-news-100',
  '[&_img:not([class])]:border-news-200',
)

const TONES = {
  gazette: cn(STRUCTURE, GAZETTE_TONE),
  times: cn(STRUCTURE, TIMES_TONE),
} as const

type RichTextProps = {
  className?: string
  data: Article['content'] | Page['content'] | null | undefined
  /** Prose palette: the state Gazette (default) or the Condor Times. */
  tone?: keyof typeof TONES
}

/**
 * Renders Lexical rich text content, including every custom block (callout,
 * quote, image, gallery, embed, discord, model3d, litematic). Server-safe: the
 * only client code is the Discord block's audio/spoiler island and the
 * Model3D/Litematic dynamic imports.
 */
export function RichText({ data, className, tone = 'gazette' }: RichTextProps) {
  if (!data?.root?.children?.length) return null

  return (
    <div className={cn(TONES[tone], className)}>
      <PayloadRichText
        converters={converters}
        data={data as SerializedEditorState}
        disableContainer
      />
    </div>
  )
}
