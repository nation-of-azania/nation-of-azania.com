import type { QuoteBlockType } from '@/payload-types'

type QuoteProps = Pick<QuoteBlockType, 'attribution' | 'attributionTitle' | 'quote'>

/**
 * Quote — a large display-serif pull quote with an oversized decorative
 * quotation mark and a small-caps attribution set off by a gold hairline.
 */
export function QuoteBlock({ quote, attribution, attributionTitle }: QuoteProps) {
  if (!quote) return null

  return (
    <figure className="my-10 sm:px-4">
      <blockquote className="relative pl-10 sm:pl-12">
        <span
          aria-hidden="true"
          className="absolute top-[-0.08em] left-0 font-display text-6xl leading-none text-gold-300 select-none"
        >
          &ldquo;
        </span>
        <p className="font-display text-2xl leading-snug whitespace-pre-line text-pine-900 sm:text-[1.75rem]">
          {quote}
        </p>
      </blockquote>
      {attribution || attributionTitle ? (
        <figcaption className="mt-5 flex items-center gap-3 pl-10 sm:pl-12">
          <span aria-hidden="true" className="h-px w-10 shrink-0 bg-gold-400" />
          <span className="min-w-0">
            {attribution ? (
              <span className="block font-display text-sm font-medium tracking-[0.14em] text-ink-700 uppercase">
                {attribution}
              </span>
            ) : null}
            {attributionTitle ? (
              <span className="mt-0.5 block text-xs tracking-[0.08em] text-ink-500 uppercase">
                {attributionTitle}
              </span>
            ) : null}
          </span>
        </figcaption>
      ) : null}
    </figure>
  )
}
