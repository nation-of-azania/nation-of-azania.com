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

/** Where a document lives on the site; null until it has a slug and a context. */
type PathOf = (data: Record<string, unknown>, req: PayloadRequest) => Promise<string | null>

/** The stored path of the document's context, e.g. "/intl/transport/roads". */
const contextPathOf = async (data: Record<string, unknown>, req: PayloadRequest) => {
  const context = data.context as number | { id?: number; path?: string | null } | null | undefined
  if (context && typeof context === 'object' && context.path) return context.path
  const id = typeof context === 'number' ? context : context?.id
  if (!id) return null
  const doc = await req.payload.findByID({ collection: 'contexts', id, depth: 0, req }).catch(() => null)
  return doc?.path ?? null
}

/** Articles live in their top-level context's archive: /<top>/articles/<slug>. */
export const articlePath: PathOf = async (data, req) => {
  const contextPath = typeof data.slug === 'string' && data.slug ? await contextPathOf(data, req) : null
  return contextPath ? `/${contextPath.split('/')[1]}/articles/${data.slug}` : null
}

/** Pages live under their context: /<context path>/<slug>. */
export const pagePath: PathOf = async (data, req) => {
  const contextPath = typeof data.slug === 'string' && data.slug ? await contextPathOf(data, req) : null
  return contextPath ? `${contextPath}/${data.slug}` : null
}

const previewUrl = (req: PayloadRequest, path: string) =>
  `${originOf(req)}/preview?path=${encodeURIComponent(path)}`

/** `admin.livePreview` for a collection whose documents live at `pathOf(data)`. */
export const livePreview = (pathOf: PathOf): LivePreviewConfig => ({
  url: async ({ data, req }) => {
    const path = await pathOf(data, req)
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
  async (doc, { req }) => {
    const path = await pathOf(doc, req)
    return path ? previewUrl(req, path) : null
  }
