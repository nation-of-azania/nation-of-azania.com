/**
 * A list's entries rendered down to players (src/collections/Lists.ts): a
 * player named outright, a town's residents, a nation's towns' residents,
 * less the towns and players an entry leaves out. What a list *means* is
 * the business of whatever shows it (a sanction list in the Gazette, a
 * guild's roster); here it is only names. Pure, so the changelog's sums
 * can be checked without a database (scripts/test-lists.ts).
 */

export const ENTRY_KINDS = {
  player: 'A player',
  town: 'A town: its residents',
  nation: 'A nation: its towns’ residents',
} as const
export type EntryKind = keyof typeof ENTRY_KINDS

export const isEntryKind = (value: unknown): value is EntryKind => typeof value === 'string' && value in ENTRY_KINDS

/** A Minecraft name as Towny writes it; Bedrock players' carry the server's dot. */
export const PLAYER_NAME = /^\.?\w{3,16}$/

export type ListEntry = {
  /** The entry's own id, which survives edits to it. */
  id: string
  kind: EntryKind
  /** A player's name, or a town's or nation's as the map spells it. */
  name: string
  classes: string[]
  reason?: string | null
  /** A town or nation entry's exceptions: towns (an occupied one, say) and players left off. */
  exceptTowns?: string[]
  exceptPlayers?: string[]
}

/** Why a player is on a list: named, or living in a listed town or nation (and in which town). */
export type Via = { entry: string; kind: EntryKind; name: string; town: string | null }

export type Member = { name: string; classes: string[]; via: Via[] }

/** As much of a town as resolving needs: what the map says lives there. */
export type TownResidents = { name: string; nation: string | null; residents: number; people: string[] }

export type Resolved = {
  /** Every player on the list, by key (playerKey). */
  members: Map<string, Member>
  /** Town and nation entries the map has no trace of: nobody comes onto the list through them. */
  missing: string[]
  /**
   * Whether the map's reading lacks names it should have (a town with
   * residents but none named, as an old cached reading has): the list
   * can't be told from it, and nothing should be changed by it.
   */
  unread: boolean
}

/** Names are one player whatever their case, as Minecraft has it. */
export const playerKey = (name: string) => name.trim().toLowerCase()
const sameName = (a: string | null | undefined, b: string) => Boolean(a) && a!.toLowerCase() === b.toLowerCase()

const unique = (values: string[]) => [...new Set(values)]

export function resolveEntries(entries: ListEntry[], towns: TownResidents[]): Resolved {
  const members = new Map<string, Member>()
  const missing: string[] = []
  let unread = false

  const add = (name: string, entry: ListEntry, town: string | null) => {
    const key = playerKey(name)
    const member = members.get(key) ?? { name: name.trim(), classes: [], via: [] }
    member.classes = unique([...member.classes, ...entry.classes])
    member.via.push({ entry: entry.id, kind: entry.kind, name: entry.name, town })
    members.set(key, member)
  }

  for (const entry of entries) {
    if (entry.kind === 'player') {
      if (PLAYER_NAME.test(entry.name.trim())) add(entry.name, entry, null)
      continue
    }
    const within = towns.filter((town) =>
      entry.kind === 'town' ? sameName(town.name, entry.name) : sameName(town.nation, entry.name),
    )
    if (within.length === 0) {
      missing.push(entry.name)
      continue
    }
    const skipTowns = new Set((entry.exceptTowns ?? []).map(playerKey))
    const skipPlayers = new Set((entry.exceptPlayers ?? []).map(playerKey))
    for (const town of within) {
      if (skipTowns.has(playerKey(town.name))) continue
      if (town.residents > 0 && town.people.length === 0) unread = true
      for (const person of town.people) {
        if (!skipPlayers.has(playerKey(person))) add(person, entry, town.name)
      }
    }
  }
  return { members, missing, unread }
}

/** A player on the list as last recorded: since when, and why. */
export type MemberState = Member & { since: string }
/** The list as last recorded, by key (playerKey). */
export type Roster = Record<string, MemberState>

export type PlayerChange = {
  action: 'added' | 'removed'
  name: string
  classes: string[]
  /** Why they're on it (added), or were (removed). */
  via: Via[]
}

/**
 * The list now against the list as last recorded: who came onto it, who
 * left it, and the roster to record, in which those who stayed keep the
 * date they came onto it.
 */
export function diffMembers(before: Roster, now: Map<string, Member>, at: string): { roster: Roster; changes: PlayerChange[] } {
  const roster: Roster = {}
  const changes: PlayerChange[] = []
  for (const [key, member] of now) {
    const was = before[key]
    roster[key] = { ...member, since: was?.since ?? at }
    if (!was) changes.push({ action: 'added', name: member.name, classes: member.classes, via: member.via })
  }
  for (const [key, was] of Object.entries(before)) {
    if (!now.has(key)) changes.push({ action: 'removed', name: was.name, classes: was.classes, via: was.via })
  }
  changes.sort((a, b) => a.action.localeCompare(b.action) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  return { roster, changes }
}

export type EntryChange = {
  action: 'added' | 'removed' | 'changed'
  kind: EntryKind
  name: string
  classes: string[]
  reason: string | null
  exceptTowns: string[]
  exceptPlayers: string[]
}

const sameSet = (a: string[] = [], b: string[] = []) =>
  a.length === b.length && unique(a.map(playerKey)).sort().join('\n') === unique(b.map(playerKey)).sort().join('\n')

const asChange = (action: EntryChange['action'], entry: ListEntry): EntryChange => ({
  action,
  kind: entry.kind,
  name: entry.name,
  classes: entry.classes,
  reason: entry.reason?.trim() || null,
  exceptTowns: entry.exceptTowns ?? [],
  exceptPlayers: entry.exceptPlayers ?? [],
})

/** What an edit did to the entries: matched by id, so a renamed entry is a change, not a removal and an addition. */
export function diffEntries(before: ListEntry[], after: ListEntry[]): EntryChange[] {
  const old = new Map(before.map((entry) => [entry.id, entry]))
  const changes: EntryChange[] = []
  for (const entry of after) {
    const was = old.get(entry.id)
    old.delete(entry.id)
    if (!was) changes.push(asChange('added', entry))
    else if (
      was.kind !== entry.kind ||
      was.name.trim().toLowerCase() !== entry.name.trim().toLowerCase() ||
      !sameSet(was.classes, entry.classes) ||
      (was.reason?.trim() || null) !== (entry.reason?.trim() || null) ||
      !sameSet(was.exceptTowns, entry.exceptTowns) ||
      !sameSet(was.exceptPlayers, entry.exceptPlayers)
    ) {
      changes.push(asChange('changed', entry))
    }
  }
  for (const entry of old.values()) changes.push(asChange('removed', entry))
  return changes
}

/** "+3 −1 players; 2 entries added, 1 changed": a change, in a line. */
export function changeSummary(entries: EntryChange[], players: PlayerChange[]): string {
  const added = players.filter((change) => change.action === 'added').length
  const removed = players.length - added
  const counts = [added ? `+${added}` : null, removed ? `−${removed}` : null].filter(Boolean)
  const people = counts.length ? `${counts.join(' ')} player${added + removed === 1 ? '' : 's'}` : null
  const tally = (['added', 'removed', 'changed'] as const)
    .map((action) => [action, entries.filter((entry) => entry.action === action).length] as const)
    .filter(([, n]) => n > 0)
  const edits = tally.length
    ? tally.map(([action, n], index) => (index === 0 ? `${n} entr${n === 1 ? 'y' : 'ies'} ${action}` : `${n} ${action}`)).join(', ')
    : null
  return [people, edits].filter(Boolean).join('; ') || 'No change'
}
