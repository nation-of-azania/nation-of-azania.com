import { randomBytes } from 'crypto'

import type { Article } from '@/payload-types'

/**
 * Builders for Payload 3 Lexical editor state, matching exactly what
 * @payloadcms/richtext-lexical 3.85 serializes (see SerializedBlockNode et al.
 * in node_modules/@payloadcms/richtext-lexical/dist/nodeTypes.d.ts). The admin
 * editor is strict about these shapes — do not trim "useless-looking" keys.
 */

export type LexicalEditorState = NonNullable<Article['content']>

export interface TextNode {
  type: 'text'
  text: string
  detail: number
  format: number
  mode: 'normal'
  style: string
  version: 1
}

export interface ParagraphNode {
  type: 'paragraph'
  children: TextNode[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
  textFormat: number
  textStyle: ''
}

export interface HeadingNode {
  type: 'heading'
  tag: 'h2' | 'h3' | 'h4'
  children: TextNode[]
  direction: 'ltr'
  format: ''
  indent: 0
  version: 1
}

export interface BlockNode {
  type: 'block'
  fields: { id: string; blockName: string; blockType: string } & Record<string, unknown>
  format: ''
  version: 2
}

export type ContentNode = ParagraphNode | HeadingNode | BlockNode

/** Text formatting bitmask (Lexical): 1 = bold, 2 = italic. */
export const BOLD = 1
export const ITALIC = 2

/** 24-char hex id, the shape Payload uses for block/array row ids. */
export const hexId = (): string => randomBytes(12).toString('hex')

export const text = (content: string, format = 0): TextNode => ({
  type: 'text',
  text: content,
  detail: 0,
  format,
  mode: 'normal',
  style: '',
  version: 1,
})

const toTextNodes = (children: Array<string | TextNode>): TextNode[] =>
  children.map((child) => (typeof child === 'string' ? text(child) : child))

export const paragraph = (...children: Array<string | TextNode>): ParagraphNode => ({
  type: 'paragraph',
  children: toTextNodes(children),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  textFormat: 0,
  textStyle: '',
})

export const heading = (
  content: string,
  tag: HeadingNode['tag'] = 'h2',
): HeadingNode => ({
  type: 'heading',
  tag,
  children: [text(content)],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/**
 * A content block node. `fields` are the block's own fields per
 * src/blocks/config.ts; upload relations are passed as numeric media ids.
 */
export const block = (
  blockType: string,
  fields: Record<string, unknown>,
  blockName = '',
): BlockNode => ({
  type: 'block',
  fields: { id: hexId(), blockName, blockType, ...fields },
  format: '',
  version: 2,
})

/** A gallery `items` row: `{ id, image, caption }`. */
export const galleryItem = (image: number, caption?: string) => ({
  id: hexId(),
  image,
  ...(caption ? { caption } : {}),
})

/** Wrap content nodes into a full editor state for a richText field. */
export const root = (...children: ContentNode[]): LexicalEditorState =>
  ({
    root: {
      type: 'root',
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }) as unknown as LexicalEditorState
