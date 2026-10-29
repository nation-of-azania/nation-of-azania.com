/**
 * Lists rendered down to players (src/lists/resolve.ts), checked without a
 * database: players named outright, a town's and a nation's residents, the
 * towns and players an entry leaves out, names in any case, a reading that
 * can't say who lives where; and the changelog's sums: who came onto a
 * list, who left it, who keeps the date they came, what an edit did.
 *
 *   pnpm test:lists
 */
import {
  changeSummary,
  diffEntries,
  diffMembers,
  resolveEntries,
  type ListEntry,
  type TownResidents,
} from '../src/lists/resolve'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const names = (keys: Iterable<string>) => [...keys].sort().join(',')

const towns: TownResidents[] = [
  { name: 'Panda_Vallarta', nation: 'Imperial_Avalonia', residents: 3, people: ['Its_Pandaz', 'BTriangle', 'Hutmore'] },
  { name: 'Ravenswatch', nation: 'Imperial_Avalonia', residents: 1, people: ['Knightmare6361'] },
  { name: 'Argentina', nation: 'Imperial_Avalonia', residents: 1, people: ['1Kakashi'] },
  { name: 'Port_Azania', nation: 'Azania', residents: 2, people: ['IPaaat', '.BedrockSam'] },
]

const participants: ListEntry[] = ['Its_Pandaz', 'Juizy1', 'hutmore'].map((name, index) => ({
  id: `p${index}`,
  kind: 'player',
  name,
  classes: ['Indefinite', 'War crime', 'Moral code'],
}))
const avalonia: ListEntry = {
  id: 'n1',
  kind: 'nation',
  name: 'imperial_avalonia',
  classes: ['Moral code'],
  exceptTowns: ['Argentina'],
}

// Resolving.
{
  const { members, missing, unread } = resolveEntries([...participants, avalonia], towns)
  check(names(members.keys()) === 'btriangle,hutmore,its_pandaz,juizy1,knightmare6361', 'a nation’s residents join the named players; an excepted town’s residents don’t')
  check(!members.has('1kakashi'), 'Argentina, held by occupation, is left out')
  const pandaz = members.get('its_pandaz')!
  check(pandaz.via.length === 2 && pandaz.via.some((via) => via.kind === 'nation' && via.town === 'Panda_Vallarta'), 'a player named and resident is on through both, with their town')
  check(pandaz.classes.join('|') === 'Indefinite|War crime|Moral code', 'classes from every entry, once each')
  check(members.get('hutmore')!.name === 'hutmore', 'the first entry to name a player gives the spelling')
  check(missing.length === 0 && !unread, 'nothing missing, everything read')
}
{
  const { members } = resolveEntries([{ ...avalonia, exceptTowns: [], exceptPlayers: ['knightmare6361'] }], towns)
  check(names(members.keys()) === '1kakashi,btriangle,hutmore,its_pandaz', 'an excepted player is left out, in any case')
}
{
  const { members, missing } = resolveEntries([{ id: 't1', kind: 'town', name: 'Port_Azania', classes: [] }, { id: 'n2', kind: 'nation', name: 'Atlantis', classes: [] }], towns)
  check(names(members.keys()) === '.bedrocksam,ipaaat', 'a town’s residents, Bedrock players’ dots kept')
  check(missing.join() === 'Atlantis', 'a nation the map doesn’t have is reported, and brings nobody')
}
{
  const { unread } = resolveEntries([avalonia], [{ name: 'Ravenswatch', nation: 'Imperial_Avalonia', residents: 4, people: [] }])
  check(unread, 'a town with residents but no names makes the reading unfit to change the list by')
  const { members } = resolveEntries([{ id: 'x', kind: 'player', name: 'not a name!', classes: [] }], towns)
  check(members.size === 0, 'a name Minecraft wouldn’t allow brings nobody')
}

// The changelog's sums.
{
  const first = resolveEntries([...participants, avalonia], towns)
  const one = diffMembers({}, first.members, '2026-10-29T12:00:00.000Z')
  check(one.changes.length === 5 && one.changes.every((change) => change.action === 'added'), 'the first save adds everyone')
  check(Object.values(one.roster).every((member) => member.since === '2026-10-29T12:00:00.000Z'), 'everyone is on it since then')

  // Knightmare leaves the nation, Kakashi's town is no longer excepted, BTriangle moves town within it.
  const moved: TownResidents[] = [
    { name: 'Panda_Vallarta', nation: 'Imperial_Avalonia', residents: 2, people: ['Its_Pandaz', 'Hutmore'] },
    { name: 'Ravenswatch', nation: null, residents: 1, people: ['Knightmare6361'] },
    { name: 'Argentina', nation: 'Imperial_Avalonia', residents: 2, people: ['1Kakashi', 'BTriangle'] },
  ]
  const second = resolveEntries([...participants, { ...avalonia, exceptTowns: [] }], moved)
  const two = diffMembers(one.roster, second.members, '2026-10-30T08:00:00.000Z')
  const said = two.changes.map((change) => `${change.action}:${change.name}`).join(',')
  check(said === 'added:1Kakashi,removed:Knightmare6361', `one came, one left (${said})`)
  const left = two.changes.find((change) => change.action === 'removed')!
  check(left.via[0]?.name === 'imperial_avalonia' && left.via[0]?.town === 'Ravenswatch', 'who left is recorded with why they were on it')
  check(two.roster.btriangle?.since === '2026-10-29T12:00:00.000Z' && two.roster.btriangle?.via[0]?.town === 'Argentina', 'who moved town keeps their date, and their town is updated')
  check(two.roster['1kakashi']?.since === '2026-10-30T08:00:00.000Z', 'who came is on it since now')
  check(changeSummary([], two.changes) === '+1 −1 players', `summed up (${changeSummary([], two.changes)})`)
}
{
  const before: ListEntry[] = [...participants, avalonia]
  const after: ListEntry[] = [
    { ...participants[0], reason: 'Leader and initiator' },
    participants[1],
    { ...avalonia, exceptTowns: ['argentina'] },
    { id: 'p9', kind: 'player', name: 'Pesimkos', classes: ['Moral code'] },
  ]
  const changes = diffEntries(before, after)
  const said = changes.map((change) => `${change.action}:${change.name}`).join(',')
  check(said === 'changed:Its_Pandaz,added:Pesimkos,removed:hutmore', `an edit: one changed, one added, one removed, an exception's case ignored (${said})`)
  check(changeSummary(changes, []) === '1 entry added, 1 removed, 1 changed', `summed up (${changeSummary(changes, [])})`)
  check(diffEntries(before, before).length === 0, 'saving without changes changes nothing')
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
