import { cn } from '@/blocks/components/shared'

import { BylineAvatar } from './BylineAvatar'
import { WaxSeal } from './Seal'
import type { ResolvedByline } from './format'

/**
 * How the Gazette credits people. An official record names the office with
 * the person — "Luixiter, Chancellor" — so the role is never dropped, and the
 * head is mounted in a small sand frame like a portrait in a register.
 */

type Props = {
  byline: ResolvedByline
  className?: string
}

/**
 * The card credit: a 24px framed head, then "Name, Role" on one quiet line.
 * Sits at the foot of article and document cards.
 */
export function GazetteCredit({ byline, className }: Props) {
  return (
    <p className={cn('flex items-center gap-2.5 text-xs leading-snug text-ink-400', className)}>
      <BylineAvatar byline={byline} size={24} tone="gazette" />
      <span className="min-w-0">
        <span className="font-medium text-ink-700">{byline.name}</span>
        {byline.title ? <span>, {byline.title}</span> : null}
      </span>
    </p>
  )
}

/**
 * The article-page byline: a 40px framed head, "By Name" in the display
 * serif, and the office beneath as a saffron eyebrow.
 */
export function GazetteByline({ byline, className }: Props) {
  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <BylineAvatar byline={byline} size={40} tone="gazette" />
      <div className="min-w-0">
        <p className="font-display text-lg leading-tight text-sea-950">
          <span className="italic text-ink-500">By </span>
          {byline.name}
        </p>
        {byline.title ? (
          <p className="mt-1 text-[11px] uppercase leading-none tracking-[0.18em] text-(--accent-ink)">
            {byline.title}
          </p>
        ) : null}
      </div>
    </div>
  )
}

type SignatureProps = Props & {
  /** ISO timestamp of entry into the record, for the <time> element. */
  dateTime?: string | null
  /** The same date, already formatted for reading. */
  date?: string | null
  /** The line above the signatory; "Given under the hand of" for a decree. */
  heading?: string
  /** Press the Seal of the Nation beside the signature: decrees only. */
  sealed?: boolean
}

/**
 * The signature block that closes a document of state: "Given under the hand
 * of" the signatory, with the Seal of the Nation pressed beside it for a
 * decree, and the date it entered the record.
 */
export function GazetteSignature({
  byline,
  dateTime,
  date,
  heading = 'Given under the hand of',
  sealed = true,
  className,
}: SignatureProps) {
  return (
    <aside
      aria-label="Signature"
      className={cn(
        'flex flex-wrap items-center gap-x-12 gap-y-6 border-t border-sand-300 pt-8',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-(--accent-ink)">{heading}</p>
        <div className="mt-4 flex items-center gap-4">
          <BylineAvatar byline={byline} size={48} tone="gazette" />
          <div className="min-w-0">
            <p className="font-display text-2xl leading-none text-sea-950">{byline.name}</p>
            {byline.title ? (
              <p className="mt-2 text-[11px] uppercase leading-none tracking-[0.18em] text-ink-500">
                {byline.title}
              </p>
            ) : null}
          </div>
        </div>
        {date && dateTime ? (
          <p className="mt-4 text-xs text-ink-400">
            Entered into the record on <time dateTime={dateTime}>{date}</time>.
          </p>
        ) : null}
      </div>
      {sealed ? <WaxSeal className="ms-1" /> : null}
    </aside>
  )
}
