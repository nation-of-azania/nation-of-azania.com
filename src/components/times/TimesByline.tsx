import { cn } from '@/blocks/components/shared'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import type { ResolvedByline } from '@/components/site/format'

/**
 * How the Azanian Times credits its people: head, name in tracked caps, and
 * the desk or beat beneath — the way a newspaper prints a reporter.
 */

type Props = {
  byline: ResolvedByline
  className?: string
}

const CREDIT = {
  /** Story cards in the front-page grid. */
  card: { size: 32, name: 'text-[11px] tracking-[0.12em]', title: 'text-[11px]' },
  /** The lead story, which gets a little more room. */
  lead: { size: 40, name: 'text-xs tracking-[0.12em]', title: 'text-xs' },
} as const

/**
 * The card credit: a flat head beside a two-line stack — the name in bold
 * tracked caps over the role in quiet grey.
 */
export function TimesCredit({
  byline,
  variant = 'card',
  className,
}: Props & { variant?: keyof typeof CREDIT }) {
  const style = CREDIT[variant]
  return (
    <p className={cn('flex items-center gap-2.5', className)}>
      <BylineAvatar byline={byline} size={style.size} tone="times" />
      <span className="min-w-0 leading-tight">
        <span
          className={cn('block font-news font-bold uppercase text-news-900', style.name)}
        >
          {byline.name}
        </span>
        {byline.title ? (
          <span className={cn('mt-0.5 block text-news-500', style.title)}>{byline.title}</span>
        ) : null}
      </span>
    </p>
  )
}

/**
 * The byline under a headline: a 48px head, "By Name" in the news grotesque,
 * and the role beneath, with a lagoon tick to mark the paper's own people.
 */
export function TimesByline({ byline, className }: Props) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <BylineAvatar byline={byline} size={48} tone="times" />
      <div className="min-w-0 leading-tight">
        <p className="font-news text-[15px] font-bold text-news-900">
          <span className="font-medium text-news-500">By </span>
          {byline.name}
        </p>
        {byline.title ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-news-500">
            <span aria-hidden="true" className="h-px w-4 bg-lagoon-500" />
            {byline.title}
          </p>
        ) : null}
      </div>
    </div>
  )
}
