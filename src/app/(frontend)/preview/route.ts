import config from '@payload-config'
import { draftMode, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { canUseAdmin } from '@/access/scope'

/**
 * Entry point for live preview (src/lib/preview.ts): turns on Next.js draft
 * mode for anyone signed in who can use the admin, then redirects to the
 * page, which renders the latest draft that person may read. Only same-site paths are
 * accepted, so this can't be used as an open redirect.
 */
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '/'
  if (!path.startsWith('/') || path.startsWith('//')) {
    return new Response('Invalid preview path.', { status: 400 })
  }

  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: await headers() }).catch(() => ({ user: null }))
  if (!canUseAdmin(user)) {
    return new Response('Sign in to the admin panel to preview drafts.', {
      status: 403,
    })
  }

  ;(await draftMode()).enable()
  redirect(path)
}
