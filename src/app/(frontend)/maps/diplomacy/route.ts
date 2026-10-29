import config from '@payload-config'
import { getPayload } from 'payload'

import { canSetDiplomacy } from '@/access/maps'
import { relationsOf } from '@/lib/maps'
import { worldReading } from '@/lib/snapshot'
import { sameNation } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import { isStance } from '@/maps/registry'

/**
 * Sets Azania's stance toward one nation, from that nation's panel on Azania
 * Maps: `{ nation, stance, note }`, where a stance of 'neutral' takes the
 * nation off the list (every nation not on it is neutral). For admins and
 * diplomats (src/access/maps.ts). The nation is named as the Rulercraft map
 * spells it now, so the diplomacy layer finds it; one already on the list
 * can be changed or taken off though it's gone from the map. The rest of
 * the list is left as it is, and the map's pages are refreshed by the
 * settings' own hook (src/globals/AzaniaMaps.ts). Answers with the whole
 * diplomacy as the map shows it.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NOTE_MAX = 140

const refuse = (message: string, status: number) =>
  Response.json({ errors: [{ message }] }, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(request: Request) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) return refuse('You’re signed out. Sign in and try again.', 401)
  if (!canSetDiplomacy(user)) return refuse('Only admins and diplomats may set Azania’s diplomacy.', 403)

  let body: { nation?: unknown; stance?: unknown; note?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return refuse('Send the nation and the stance as JSON.', 400)
  }
  const asked = typeof body.nation === 'string' ? body.nation.trim() : ''
  const stance = body.stance
  if (!asked) return refuse('Which nation?', 400)
  if (stance !== 'neutral' && !isStance(stance)) return refuse('That isn’t a stance.', 400)
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, NOTE_MAX) : ''

  const settings = await payload.findGlobal({ slug: 'azania-maps', depth: 0 })
  if ((settings.nations ?? []).some((nation) => sameNation(nation.name, asked))) return refuse('That’s Azania.', 400)
  const relations = settings.relations ?? []
  const listed = relations.find((relation) => sameNation(relation.nation, asked))
  // The map's own spelling; a nation gone from the map only if it's on the list already.
  const world = (await worldReading())?.value ?? null
  const onMap = world?.nations.find((nation) => sameNation(nation.name, asked))
  if (!onMap && !listed) {
    return refuse(
      world ? `There’s no nation called ${spoken(asked)} on the Rulercraft map.` : 'The Rulercraft map can’t be read just now; try again in a minute.',
      world ? 404 : 503,
    )
  }
  const name = onMap?.name ?? listed!.nation

  // Its place on the list kept, so the admin panel's order holds; any other spelling of it dropped.
  const others = relations.filter((relation) => !sameNation(relation.nation, asked))
  const next =
    stance === 'neutral'
      ? others
      : listed
        ? relations
            .filter((relation) => relation === listed || !sameNation(relation.nation, asked))
            .map((relation) => (relation === listed ? { ...relation, nation: name, stance, note: note || null } : relation))
        : [...others, { nation: name, stance, note: note || null }]

  const saved = await payload.updateGlobal({ slug: 'azania-maps', data: { relations: next }, depth: 0, user })
  return Response.json({ relations: relationsOf(saved.relations) }, { headers: { 'Cache-Control': 'no-store' } })
}
