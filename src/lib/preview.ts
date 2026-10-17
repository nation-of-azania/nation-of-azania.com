import type { GeneratePreviewURL, LivePreviewConfig, PayloadRequest } from 'payload'

/**
 * Live preview for articles and pages. The admin shows the real frontend page
 * in an iframe beside the editor; the URL goes through /preview, which checks
 * the editor's session and turns on Next.js draft mode, so the page renders
 * the latest draft. RefreshPreview (src/components/RefreshPreview.tsx)
 * refreshes it after every save, and with 1.5 s autosave that's nearly live.
 */

/** The admin's own origin, so the preview works on any domain the admin is opened on. */
const originOf = (req: PayloadRequest): string => {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!host) return process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const protocol =
    req.headers.get('x-forwarded-proto') ??
    (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? 'http' : 'https')
  return `${protocol}://${host}`
}

/** Where a document lives on the site; null until it has a slug. */
type PathOf = (data: Record<string, unknown>) => string | null

export const articlePath: PathOf = (data) =>
  typeof data.slug === 'string' && data.slug
    ? data.section === 'times'
      ? `/times/${data.slug}`
      : `/gov/articles/${data.slug}`
    : null

export const pagePath: PathOf = (data) =>
  typeof data.slug === 'string' && data.slug ? `/gov/${data.slug}` : null

const previewUrl = (req: PayloadRequest, path: string) =>
  `${originOf(req)}/preview?path=${encodeURIComponent(path)}`

/** `admin.livePreview` for a collection whose documents live at `pathOf(data)`. */
export const livePreview = (pathOf: PathOf): LivePreviewConfig => ({
  url: ({ data, req }) => {
    const path = pathOf(data)
    return path ? previewUrl(req, path) : null
  },
  breakpoints: [
    { label: 'Phone', name: 'phone', width: 390, height: 844 },
    { label: 'Tablet', name: 'tablet', width: 820, height: 1180 },
    { label: 'Desktop', name: 'desktop', width: 1440, height: 900 },
  ],
})

/** `admin.preview`: the "Preview" button, opening the draft in a new tab. */
export const previewButton =
  (pathOf: PathOf): GeneratePreviewURL =>
  (doc, { req }) => {
    const path = pathOf(doc)
    return path ? previewUrl(req, path) : null
  }
