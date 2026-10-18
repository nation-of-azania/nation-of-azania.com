import Link from 'next/link'

/** A missing page inside a top-level context, within that context's chrome. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center md:py-32">
      <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">404</p>
      <h1 className="mt-4 text-balance font-display text-4xl">There is nothing here.</h1>
      <p className="mt-4 max-w-md opacity-80">
        This page was never published, or has since been taken down.
      </p>
      <Link href="/" className="mt-9 text-sm font-medium underline underline-offset-4">
        Return home
      </Link>
    </div>
  )
}
