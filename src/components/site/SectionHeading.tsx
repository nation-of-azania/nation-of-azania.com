import type { ReactNode } from 'react'

/**
 * The gazette's signature double rule: a 3px pine bar directly above a 1px
 * gold hairline. Used under page titles and above section heads.
 */
export function DoubleRule({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="h-[3px] bg-pine-800" />
      <div className="mt-[2px] h-px bg-gold-400" />
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
}

export function SectionHeading({ id, eyebrow, title, action }: SectionHeadingProps) {
  return (
    <header>
      <DoubleRule />
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold-600">{eyebrow}</p>
          <h2 id={id} className="mt-1.5 font-display text-2xl text-pine-950 md:text-3xl">
            {title}
          </h2>
        </div>
        {action}
      </div>
    </header>
  )
}
