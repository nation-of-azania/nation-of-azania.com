'use client'

import { RefreshRouteOnSave } from '@payloadcms/live-preview-react'
import { usePathname, useRouter } from 'next/navigation'
import { useSyncExternalStore } from 'react'

/**
 * Rendered by article and page routes while Next.js draft mode is on (see
 * src/lib/preview.ts). It re-renders the page whenever the admin saves, so the
 * live preview follows the editor. Outside the admin's preview frame it also
 * shows a bar saying these are unpublished changes, with a way out.
 */
// Browser-only values: empty/framed while server rendering, real once hydrated.
const noSubscription = () => () => {}
const useOrigin = () =>
  useSyncExternalStore(
    noSubscription,
    () => window.location.origin,
    () => '',
  )
const useFramed = () =>
  useSyncExternalStore(
    noSubscription,
    () => window.self !== window.top,
    () => true,
  )

export function PreviewTools() {
  const router = useRouter()
  const pathname = usePathname()
  const origin = useOrigin()
  const framed = useFramed()

  return (
    <>
      {origin ? <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={origin} /> : null}
      {framed ? null : (
        <div
          role="status"
          className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-sea-950 px-4 py-2.5 text-sm text-sand-100 shadow-lg"
        >
          <span>
            <strong className="font-semibold text-saffron-300">Draft preview.</strong> You’re seeing
            unpublished changes.
          </span>
          <a
            href={`/preview/exit?path=${encodeURIComponent(pathname)}`}
            className="font-medium underline underline-offset-4 hover:text-saffron-200"
          >
            Exit preview
          </a>
        </div>
      )}
    </>
  )
}
