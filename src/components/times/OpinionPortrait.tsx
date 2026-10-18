import { cn } from '@/blocks/components/shared'
import { BylineAvatar, type AvatarSize } from '@/components/site/BylineAvatar'
import type { ResolvedByline } from '@/components/site/format'

/**
 * What an opinion piece shows in place of a picture: the writer's head under
 * a great opening quotation mark, since a signed view is a person speaking.
 * Used by the story cards and by the front page's lead slot.
 */
export function OpinionPortrait({
  byline,
  boxed,
  size = 64,
  className,
}: {
  byline: ResolvedByline
  /** Inside a style's box: round the panel's corners to match. */
  boxed?: boolean
  size?: AvatarSize
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative flex w-full flex-col items-center justify-center overflow-hidden bg-(--accent-wash) px-6 text-center',
        boxed && 'rounded-xl',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-3 left-4 select-none font-display text-[160px] leading-none text-(--accent-tint)/60"
      >
        “
      </span>
      <BylineAvatar byline={byline} size={size} tone="times" className="relative" />
      <p className="relative mt-3 font-news text-sm font-bold uppercase tracking-[0.1em] text-(--accent-deep)">
        {byline.name}
      </p>
      {byline.title ? (
        <p className="relative mt-1 text-xs text-(--accent)/80">{byline.title}</p>
      ) : null}
    </div>
  )
}
