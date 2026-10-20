import {
  isAspectName,
  isMapName,
  isZoomName,
  renderClip,
  townCentre,
  type Outline,
} from '@/lib/dynmap'
import { getTownByName } from '@/lib/maps'

/**
 * A clipping of the Rulercraft map as a JPEG, for the Map block:
 *
 *   /mapclip?town=GirlieTown&zoom=town&aspect=wide
 *   /mapclip?x=4296&z=4952&zoom=street&pin=1
 *   /mapclip?x=4296&z=4945&span=160&aspect=wide
 *
 * `town` centres on a Towny town and outlines its claims (claims=0 leaves
 * them off); x/z centre anywhere. `span`, blocks across, frames a map view
 * exactly in place of a named zoom. Stitched from Dynmap's tiles on demand
 * and cached at the CDN, so the map server sees one request per clipping a
 * day.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMIT = 100_000

const bad = (message: string) =>
  new Response(message, { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const zoom = query.get('zoom') ?? 'town'
  const map = query.get('map') ?? 'flat'
  const aspect = query.get('aspect') ?? 'wide'
  if (!isZoomName(zoom) || !isMapName(map) || !isAspectName(aspect)) return bad('Unknown zoom, map or aspect.')
  const spanParam = query.get('span')
  const span = spanParam == null ? undefined : Number(spanParam)
  if (span !== undefined && !(Number.isFinite(span) && span >= 32 && span <= 40000)) return bad('A span is 32 to 40,000 blocks.')

  const townName = query.get('town')
  if (townName && !/^[\w-]{1,40}$/.test(townName)) return bad('Not a town name.')
  const town = townName ? await getTownByName(townName) : null
  if (town === 'offline') {
    return new Response('The map is not answering just now.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  if (townName && !town) return bad(`No town called "${townName}" on the map.`)

  const xParam = query.get('x')
  const zParam = query.get('z')
  const centre =
    xParam != null && zParam != null
      ? { x: Number(xParam), z: Number(zParam) }
      : town
        ? townCentre(town)
        : null
  if (!centre || !Number.isFinite(centre.x) || !Number.isFinite(centre.z)) return bad('Give x and z, or a town.')
  if (Math.abs(centre.x) > LIMIT || Math.abs(centre.z) > LIMIT) return bad('Outside the world.')

  const outlines: Outline[] = town && query.get('claims') !== '0' ? town.outlines : []
  const colour = query.get('colour') ?? undefined

  try {
    const { image, complete, offline } = await renderClip({
      x: centre.x,
      z: centre.z,
      zoom,
      span,
      map,
      aspect,
      outlines,
      pin: query.get('pin') === '1',
      colour: colour ? `#${colour.replace(/^#/, '')}` : undefined,
    })
    // Nothing came back at all: say so, rather than hand out bare ground that looks like sea.
    if (offline) {
      return new Response('The map is not answering just now.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
    return new Response(new Uint8Array(image), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': complete
          ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
          : 'public, max-age=300, s-maxage=600',
        'X-Robots-Tag': 'noindex',
      },
    })
  } catch {
    return new Response('The map could not be drawn just now.', { status: 502 })
  }
}
