import Link from 'next/link'

/** Said in the panel, with the map still there to look at. */
export default function NotOnTheMap() {
  return (
    <div className="px-4 py-8 text-center">
      <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-700">
        Not on the map
      </p>
      <h1 className="mt-2 font-display text-2xl text-sea-950">Nothing here by that name.</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        It may have been taken off the map, or the link is wrong.
      </p>
      <Link
        className="mt-4 inline-block text-sm font-semibold text-sea-700 hover:text-sea-900"
        href="/maps"
      >
        ← Back to the map
      </Link>
    </div>
  )
}
