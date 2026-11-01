import type { Payload } from 'payload'

import { ALLIANCE_DAYS, alliancesOf, alliancesSeen, type Alliance, type AllianceBattle } from '../maps/alliances'

/**
 * Every alliance known now (src/maps/alliances.ts): Azania's own allies by
 * its diplomacy, the diplomats' list of others' (Settings → Azania Maps),
 * and those the battles of the last ALLIANCE_DAYS show. For a run with the
 * database awake: the battle tracker's save, /maps/fighters. `battles`,
 * when the caller has read them already (with their fighters), saves
 * reading them again.
 */
export async function knownAlliances(payload: Payload, now = Date.now(), battles?: AllianceBattle[]): Promise<Alliance[]> {
  const [settings, recent] = await Promise.all([
    payload.findGlobal({ slug: 'azania-maps', depth: 0 }),
    battles
      ? Promise.resolve(battles)
      : payload
          .find({
            collection: 'battles',
            where: { startedAt: { greater_than: new Date(now - ALLIANCE_DAYS * 86_400_000).toISOString() } },
            pagination: false,
            depth: 0,
            select: { startedAt: true, town: true, attacker: true, defender: true, fighters: true },
          })
          .then((found) => found.docs as unknown as AllianceBattle[]),
  ])
  return alliancesOf({
    azania: (settings.nations ?? []).map((nation) => nation.name ?? '').filter(Boolean),
    relations: settings.relations ?? [],
    told: settings.alliances ?? [],
    seen: alliancesSeen(recent, now),
  })
}
