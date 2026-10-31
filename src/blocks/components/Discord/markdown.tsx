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

/**
 * One emoji, as a grapheme: a pictograph with its presentation selector and
 * skin tone, joined into a sequence (👨‍👩‍👧), a flag, a keycap (1️⃣) or a
 * subdivision flag's tag sequence. A pictograph asked to show as text
 * (U+FE0E) isn't one; nor is a bare digit, which is an emoji only in a keycap.
 */
const EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?[\u{E0020}-\u{E007F}]*(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u
/** Whether a run of text could hold an emoji at all, before it's split into graphemes. */
const MAYBE_EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' })
const graphemesOf = (text: string) => Array.from(graphemes.segment(text), (part) => part.segment)

/** Discord shows a message of nothing but emoji this large, up to this many of them. */
const JUMBO_MOST = 30

/**
 * Whether a message is all emoji, which Discord shows "jumbo", 48px rather
 * than 22px: one to thirty of them, with nothing but space between.
 */
export function isJumbo(body: string): boolean {
  const parts = graphemesOf(body.replace(/\s+/g, ''))
  return parts.length > 0 && parts.length <= JUMBO_MOST && parts.every((part) => EMOJI.test(part))
}

type EmojiSize = 'inline' | 'jumbo'

/**
 * Emoji at Discord's sizes, 22px beside 16px text and 48px in a jumbo
 * message, set on the line's bottom as Discord sets its emoji images. They
 * are drawn by the reader's own emoji font, which draws a little larger
 * than its size (Noto Color Emoji about 1.1 times), so the sizes are set
 * a step under Discord's.
 */
const EMOJI_CLASS: Record<EmojiSize, string> = {
  inline: 'text-[1.25em] leading-none align-bottom',
  jumbo: 'text-[2.75rem] leading-none align-bottom',
}

/** Plain text with its emoji set at Discord's size. */
function withEmoji(text: string, keyPrefix: string, size: EmojiSize): ReactNode[] {
  if (!MAYBE_EMOJI.test(text)) return [text]
  const out: ReactNode[] = []
  let run = ''
  let n = 0
  for (const part of graphemesOf(text)) {
    if (!EMOJI.test(part)) {
      run += part
      continue
    }
    if (run) out.push(run)
    run = ''
    out.push(
      <span className={EMOJI_CLASS[size]} data-emoji={size} key={`${keyPrefix}-e${n++}`}>
        {part}
      </span>,
    )
  }
  if (run) out.push(run)
  return out
}

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
function renderInline(source: string, keyPrefix: string, emoji: EmojiSize = 'inline'): ReactNode[] {
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
      out.push(...withEmoji(source.slice(cursor), `${keyPrefix}-t${n++}`, emoji))
      break
    }

    if (best.match.index > cursor) out.push(...withEmoji(source.slice(cursor, best.match.index), `${keyPrefix}-t${n++}`, emoji))

    const key = `${keyPrefix}-${n++}`
    const inner = best.rule.content(best.match)
    out.push(
      best.rule.render({
        // Code, links and mentions keep their text as typed, emoji and all, as Discord shows them.
        children: best.rule.recurse ? renderInline(inner, key, emoji) : inner,
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
 * A message of nothing but emoji shows them jumbo, as Discord does.
 */
export function MessageBody({ body }: { body: string }) {
  const segments = toSegments(body)
  if (segments.length === 0) return null
  const emoji: EmojiSize = isJumbo(body) ? 'jumbo' : 'inline'

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
                {renderInline(segment.text, key, emoji)}
              </blockquote>
            </div>
          )
        }

        return (
          <div className="whitespace-pre-wrap" key={key}>
            {renderInline(segment.text, key, emoji)}
          </div>
        )
      })}
    </>
  )
}
