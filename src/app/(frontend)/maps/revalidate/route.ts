import config from '@payload-config'
import { revalidatePath } from 'next/cache'
import { createLocalReq, getPayload } from 'payload'

import { canDrawOnMap, canDrawViews, getMapRights } from '@/access/maps'

/**
 * Regenerates the cached pages of Azania Maps at once, called by the map
 * after someone draws, so their place, road or event is on the page the
 * server next sends rather than a minute later (the pages otherwise
 * revalidate on their own, see ../layout.tsx). Only for the signed-in
 * people who may draw at all; everyone else waits the minute.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  const may =
    user &&
    (canDrawOnMap(getMapRights(user)) || (await canDrawViews(await createLocalReq({ user }, payload))))
  if (!may) return Response.json({ revalidated: false }, { status: 403 })
  // The layout's own path, route group and all: that is the tag every page beneath it carries.
  revalidatePath('/(frontend)/maps', 'layout')
  return Response.json({ revalidated: true }, { headers: { 'Cache-Control': 'no-store' } })
}
