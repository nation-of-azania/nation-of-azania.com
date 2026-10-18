import type { ReactNode } from 'react'

/**
 * The gazette's signature double rule: a 3px sea bar directly above a 1px
 * saffron hairline — the sea wall and the sunlit water. Used under page
 * titles and above section heads. The hairline is the accent slot, so under
 * a style it takes the style's colour (src/components/styles/slots.ts).
 */
export function DoubleRule({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="h-[3px] bg-sea-800" />
      <div className="mt-[2px] h-px bg-(--accent)" />
    </div>
  )
}

type SectionHeadingProps = {
  /** id placed on the h2 so sections can use aria-labelledby. */
  id: string
  eyebrow: string
  title: string
  /** Optional right-aligned action, e.g. an "All articles →" link. */
  action?: ReactNode
  /** Leave out the double rule when one already runs just above. */
  rule?: boolean
}

export function SectionHeading({ id, eyebrow, title, action, rule = true }: SectionHeadingProps) {
  return (
    <header>
      {rule ? <DoubleRule /> : null}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">{eyebrow}</p>
          <h2 id={id} className="mt-1.5 font-display text-2xl text-sea-950 md:text-3xl">
            {title}
          </h2>
        </div>
        {action}
      </div>
    </header>
  )
}
