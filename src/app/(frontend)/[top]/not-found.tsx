import { ContextHomeLink } from '@/components/site/ContextHomeLink'

/**
 * A missing page inside a top-level context, within that context's chrome.
 * The page cannot know which design wraps it, so it speaks in the voice the
 * shell sets as custom properties (--design-display, --design-ink, …): the
 * Gazette's serif, the Times' black grotesque, the registry's record face.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center md:py-32">
      <p className="text-[11px] uppercase tracking-[0.24em] text-(--design-accent)">
        Not found · 404
      </p>
      <h1 className="mt-4 text-balance font-(family-name:--design-display) font-(--design-weight) text-4xl leading-tight text-(--design-ink) md:text-5xl">
        There is nothing at this address.
      </h1>
      <p className="mt-5 max-w-md text-(--design-muted)">
        It was never published, has been moved, or has since been taken down. The menu above
        has everything that is.
      </p>
      <ContextHomeLink className="mt-9 text-sm font-semibold text-(--design-link) underline decoration-(--design-accent) underline-offset-4 transition-colors hover:text-(--design-ink)">
        Return to the front page
      </ContextHomeLink>
    </div>
  )
}
