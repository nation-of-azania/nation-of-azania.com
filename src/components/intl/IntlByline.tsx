import { cn } from '@/blocks/components/shared'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import type { ResolvedByline } from '@/components/site/format'

/**
 * How the International registry names its people: a person and the nation
 * or office they speak for — "Ilse Varnholt, Delegate of Norvessa" — never a
 * name alone, since on shared ground it matters whom one represents.
 */

type Props = {
  byline: ResolvedByline
  className?: string
}

/** The one-line credit on record rows: a 24px head, the name, the role. */
export function IntlCredit({ byline, className }: Props) {
  return (
    <p className={cn('flex items-center gap-2.5 text-xs leading-snug text-graphite-500', className)}>
      <BylineAvatar byline={byline} size={24} tone="international" />
      <span className="min-w-0">
        <span className="font-medium text-graphite-700">{byline.name}</span>
        {byline.title ? <span>, {byline.title}</span> : null}
      </span>
    </p>
  )
}

/** The credit in a record's details: a 40px head, the name, the role in mono beneath. */
export function IntlByline({ byline, className }: Props) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BylineAvatar byline={byline} size={40} tone="international" />
      <div className="min-w-0 leading-tight">
        <p className="font-record text-[15px] font-medium text-graphite-900">{byline.name}</p>
        {byline.title ? (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-graphite-500">
            {byline.title}
          </p>
        ) : null}
      </div>
    </div>
  )
}
