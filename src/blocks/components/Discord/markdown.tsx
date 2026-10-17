import type { ReactNode } from 'react'

import { Spoiler } from './Client'

/**
 * Discord-flavoured markdown → React nodes.
 *
 * Deliberately a subset of Discord's own parser: the inline marks (`**bold**`,
 * `*italic*`, `__underline__`, `~~strike~~`, `` `code` ``, `||spoiler||`),
 * links, @mentions and #channels, plus the two block constructs that carry
 * meaning in a quoted conversation — fenced code and `>` quotes.
 *
 * Everything is built as React elements; no HTML is ever interpolated, so a
 * pasted message cannot inject markup.
 */

type Rule = {
  /** The delimited text, i.e. what gets rendered inside the element. */
  content: (match: RegExpExecArray) => string
  name: string
  pattern: RegExp
  /** false → render `content` verbatim, without looking for nested marks. */
  recurse: boolean
  render: (args: { children: ReactNode; key: string; match: RegExpExecArray }) => ReactNode
  /** Extra veto applied at the match site, e.g. underscores inside a word. */
  allow?: (match: RegExpExecArray, source: string) => boolean
}

const WORD = /[\p{L}\p{N}_]/u

/**
 * Discord happily underlines the middle of `snake_case_names`; we don't, since
 * a quote is more likely to contain a file name than an intentional mark.
 */
const freeStanding = (match: RegExpExecArray, source: string): boolean => {
  const before = source[match.index - 1]
  const after = source[match.index + match[0].length]
  return !(before && WORD.test(before)) && !(after && WORD.test(after))
}

/**
 * An emphasis mark has to hug its text: `*word*` is italic, `* word *` is two
 * asterisks in a sentence. Without this, a stray `**` earlier in the line
 * pairs up with a later `*` and italicises the words between them.
 */
const tight = (match: RegExpExecArray): boolean => !/^\s|\s$/.test(match[1] ?? '')

const tightAndFreeStanding = (match: RegExpExecArray, source: string): boolean =>
  tight(match) && freeStanding(match, source)

const LINK_CLASS = 'text-dc-link hover:underline'
const MENTION_CLASS = 'rounded-[3px] bg-dc-blurple/30 px-[2px] font-medium text-dc-mention'

/**
 * Ordered by precedence: at the same position, the rule listed first wins —
 * which is what keeps `**bold**` from being read as two `*italic*` marks.
 */
const RULES: Rule[] = [
  {
    name: 'code',
    pattern: /(`{1,3})([^`]+?)\1/g,
    content: (m) => m[2],
    recurse: false,
    render: ({ children, key }) => (
      <code
        className="rounded-[3px] bg-dc-panel px-[0.2em] py-[0.1em] font-mono text-[0.85em]"
        key={key}
      >
        {children}
      </code>
    ),
  },
  {
    name: 'spoiler',
    pattern: /\|\|([\s\S]+?)\|\|/g,
    content: (m) => m[1],
    recurse: true,
    render: ({ children, key }) => <Spoiler key={key}>{children}</Spoiler>,
  },
  {
    name: 'bold',
    pattern: /\*\*([\s\S]+?)\*\*/g,
    content: (m) => m[1],
    recurse: true,
    allow: tight,
    render: ({ children, key }) => (
      <strong className="font-semibold" key={key}>
        {children}
      </strong>
    ),
  },
  {
    name: 'underline',
    pattern: /__([\s\S]+?)__/g,
    content: (m) => m[1],
    recurse: true,
    allow: tightAndFreeStanding,
    render: ({ children, key }) => (
      <span className="underline underline-offset-2" key={key}>
        {children}
      </span>
    ),
  },
  {
    name: 'strike',
    pattern: /~~([\s\S]+?)~~/g,
    content: (m) => m[1],
    recurse: true,
    allow: tight,
    render: ({ children, key }) => (
      <s className="opacity-90" key={key}>
        {children}
      </s>
    ),
  },
  {
    name: 'italic-star',
    pattern: /\*([^*\n]+?)\*/g,
    content: (m) => m[1],
    recurse: true,
    allow: tight,
    render: ({ children, key }) => (
      <em className="italic" key={key}>
        {children}
      </em>
    ),
  },
  {
    name: 'italic-underscore',
    pattern: /_([^_\n]+?)_/g,
    content: (m) => m[1],
    recurse: true,
    allow: tightAndFreeStanding,
    render: ({ children, key }) => (
      <em className="italic" key={key}>
        {children}
      </em>
    ),
  },
  {
    name: 'link',
    pattern: /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    content: (m) => m[1],
    recurse: true,
    render: ({ children, key, match }) => (
      <a className={LINK_CLASS} href={match[2]} key={key} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ),
  },
  {
    // Bare URLs. The final character class keeps sentence punctuation
    // ("see https://nation-of-azania.com.") out of the href.
    name: 'autolink',
    pattern: /https?:\/\/[^\s<>"']*[^\s<>"'.,!?;:)\]]/g,
    content: (m) => m[0],
    recurse: false,
    render: ({ children, key, match }) => (
      <a className={LINK_CLASS} href={match[0]} key={key} rel="noopener noreferrer" target="_blank">
        {children}
      </a>
    ),
  },
  {
    name: 'mention',
    pattern: /@[\p{L}\p{N}_.-]{1,32}/gu,
    content: (m) => m[0],
    recurse: false,
    render: ({ children, key }) => (
      <span className={MENTION_CLASS} key={key}>
        {children}
      </span>
    ),
  },
  {
    name: 'channel',
    pattern: /#[\p{L}\p{N}_-]{1,32}/gu,
    content: (m) => m[0],
    recurse: false,
    render: ({ children, key }) => (
      <span className={MENTION_CLASS} key={key}>
        {children}
      </span>
    ),
  },
]

/** First match at or after `from` that the rule's own guard accepts. */
function nextMatch(rule: Rule, source: string, from: number): RegExpExecArray | null {
  rule.pattern.lastIndex = from
  let match = rule.pattern.exec(source)
  while (match && rule.allow && !rule.allow(match, source)) {
    rule.pattern.lastIndex = match.index + 1
    match = rule.pattern.exec(source)
  }
  return match
}

/** Renders one line's worth of text, resolving inline marks left to right. */
function renderInline(source: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let cursor = 0
  let n = 0

  while (cursor < source.length) {
    let best: { match: RegExpExecArray; rule: Rule } | null = null
    for (const rule of RULES) {
      const match = nextMatch(rule, source, cursor)
      if (match && (!best || match.index < best.match.index)) best = { match, rule }
    }

    if (!best) {
      out.push(source.slice(cursor))
      break
    }

    if (best.match.index > cursor) out.push(source.slice(cursor, best.match.index))

    const key = `${keyPrefix}-${n++}`
    const inner = best.rule.content(best.match)
    out.push(
      best.rule.render({
        children: best.rule.recurse ? renderInline(inner, key) : inner,
        key,
        match: best.match,
      }),
    )
    cursor = best.match.index + best.match[0].length
  }

  return out
}

type Segment =
  | { kind: 'code'; language: string; text: string }
  | { kind: 'quote'; text: string }
  | { kind: 'text'; text: string }

const FENCE = /```(?:([a-zA-Z0-9+#._-]*)\n)?([\s\S]*?)```/g
const LINE_QUOTE = /^>\s?/
const BLOCK_QUOTE = /^>>>\s?/

/** Splits the non-fenced parts of a message into `>` quotes and plain runs. */
function splitQuotes(source: string): Segment[] {
  const segments: Segment[] = []
  const lines = source.split('\n')
  let run: string[] = []
  let mode: 'quote' | 'text' = 'text'

  const flush = () => {
    if (run.length === 0) return
    const text = run.join('\n')
    // Trailing blank lines around a fence are an artefact of the split.
    if (text.trim().length > 0) segments.push({ kind: mode, text })
    run = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // ">>>" quotes everything that follows, to the end of the message.
    if (BLOCK_QUOTE.test(line)) {
      flush()
      const rest = [line.replace(BLOCK_QUOTE, ''), ...lines.slice(i + 1)].join('\n')
      if (rest.trim().length > 0) segments.push({ kind: 'quote', text: rest })
      return segments
    }

    const quoted = LINE_QUOTE.test(line)
    if (quoted !== (mode === 'quote')) {
      flush()
      mode = quoted ? 'quote' : 'text'
    }
    run.push(quoted ? line.replace(LINE_QUOTE, '') : line)
  }

  flush()
  return segments
}

/** Splits a message body into fenced code blocks and everything else. */
function toSegments(body: string): Segment[] {
  const segments: Segment[] = []
  let cursor = 0

  FENCE.lastIndex = 0
  let fence = FENCE.exec(body)
  while (fence) {
    if (fence.index > cursor) segments.push(...splitQuotes(body.slice(cursor, fence.index)))
    segments.push({ kind: 'code', language: fence[1] ?? '', text: fence[2].replace(/\n$/, '') })
    cursor = fence.index + fence[0].length
    fence = FENCE.exec(body)
  }

  if (cursor < body.length) segments.push(...splitQuotes(body.slice(cursor)))
  return segments
}

/**
 * Renders a message body. `whitespace-pre-wrap` keeps the author's own line
 * breaks, exactly as Discord does — chat is written in short lines on purpose.
 */
export function MessageBody({ body }: { body: string }) {
  const segments = toSegments(body)
  if (segments.length === 0) return null

  return (
    <>
      {segments.map((segment, index) => {
        const key = `s${index}`

        if (segment.kind === 'code') {
          return (
            <pre
              className="my-1.5 max-w-full overflow-x-auto rounded border border-dc-well bg-dc-panel p-2 text-[0.875rem] leading-[1.125rem]"
              key={key}
            >
              <code className="font-mono">{segment.text}</code>
            </pre>
          )
        }

        if (segment.kind === 'quote') {
          return (
            <div className="my-1 flex gap-3" key={key}>
              <span aria-hidden="true" className="w-1 shrink-0 rounded-[4px] bg-dc-bar" />
              <blockquote className="min-w-0 whitespace-pre-wrap">
                {renderInline(segment.text, key)}
              </blockquote>
            </div>
          )
        }

        return (
          <div className="whitespace-pre-wrap" key={key}>
            {renderInline(segment.text, key)}
          </div>
        )
      })}
    </>
  )
}
