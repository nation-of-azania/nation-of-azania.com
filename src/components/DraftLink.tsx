import { Crest } from '@/components/site/Crest'
import { formatDate } from '@/components/site/format'
import { LinkButton } from '@/components/site/LinkButton'

/**
 * What a draft link's reader is told (src/app/(frontend)/draft/[token]):
 * that the article is a draft, shared with them privately and still liable
 * to change, and until when the link works; or, once it has run out, that it
 * has.
 */

/**
 * A slip across the top of the shared page, under the masthead and before
 * the article. It speaks in whichever design's voice the shell sets as
 * custom properties (--design-ink, --design-accent, …; see each design's
 * Shell), so the same note reads as the Gazette's, the Times' or the
 * registry's. In the flow, not fixed: it covers nothing, and a reader who
 * scrolls on has read it.
 */
export function DraftLinkNote({ expiresAt, published }: { expiresAt: string; published: boolean }) {
  return (
    <aside
      role="note"
      aria-label="About this draft"
      className="border-y border-(--design-accent)/35 bg-(--design-accent)/8"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5 px-6 py-4 md:flex-row md:items-baseline md:gap-6">
        <p className="shrink-0 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-(--design-accent)">
          Shared draft
        </p>
        <p className="text-sm leading-relaxed text-(--design-muted)">
          <strong className="font-semibold text-(--design-ink)">
            {published ? 'The latest draft of a published article.' : 'An unpublished draft.'}
          </strong>{' '}
          It was shared with you privately and may still change: this link always shows the
          newest draft. It works until{' '}
          <time dateTime={expiresAt} className="font-semibold text-(--design-ink)">
            {formatDate(expiresAt)}
          </time>
          . Please don’t pass it on.
        </p>
      </div>
    </aside>
  )
}

/**
 * The page a link shows once it has run out, in the nation's own style (it
 * renders outside any design's shell, like the site's 404). If the article
 * has since been published, the reader is sent to it.
 */
export function DraftLinkExpired({
  expiresAt,
  publishedHref,
}: {
  expiresAt: string
  publishedHref: string | null
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center md:py-32">
      <Crest className="h-16 w-auto text-sand-300" />
      <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-coral-700">
        Draft link · Expired
      </p>
      <h1 className="mt-4 text-balance font-display text-4xl text-sea-950">
        This draft link has run out.
      </h1>
      <p className="mt-4 max-w-md text-ink-500">
        It showed a draft until{' '}
        <time dateTime={expiresAt} className="text-ink-700">
          {formatDate(expiresAt)}
        </time>
        . Draft links are short-lived on purpose;{' '}
        {publishedHref
          ? 'but the article has since been published, and the record is open to all.'
          : 'whoever sent it can make you a new one.'}
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
        {publishedHref ? (
          <LinkButton href={publishedHref} variant="primary">
            Read the published article
          </LinkButton>
        ) : null}
        <LinkButton href="/" variant={publishedHref ? 'outline' : 'primary'}>
          Return home
        </LinkButton>
      </div>
    </div>
  )
}
