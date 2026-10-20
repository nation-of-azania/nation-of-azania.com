import type { ComponentProps } from 'react'

import { cn } from '@/blocks/components/shared'

/**
 * The feed mark: the dot and two arcs every reader knows, drawn in
 * `currentColor` so it takes each paper's ink — sea, cinnabar, verdigris,
 * GirlieTown's rose — rather than the usual orange. Decorative: always
 * paired with a word.
 */
export function FeedGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
    >
      <circle cx="3" cy="13" r="1.5" fill="currentColor" stroke="none" />
      <path d="M2 7a7 7 0 0 1 7 7" />
      <path d="M2 2a12 12 0 0 1 12 12" />
    </svg>
  )
}

type Props = Omit<ComponentProps<'a'>, 'href'> & {
  /** The feed's URL: feedHref(context) or SITE_FEED_HREF (src/lib/site.ts). */
  href: string
  glyphClassName?: string
}

/**
 * A link to an RSS feed (src/lib/feed.ts): the glyph, then the words each
 * design chooses, in its own type and colours. A plain anchor, not Next's
 * Link, since a feed is not a page and would be prefetched for nothing.
 */
export function FeedLink({ href, className, glyphClassName, children, ...props }: Props) {
  return (
    <a
      href={href}
      type="application/rss+xml"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    >
      <FeedGlyph className={cn('h-3 w-3 shrink-0', glyphClassName)} />
      {children}
    </a>
  )
}
