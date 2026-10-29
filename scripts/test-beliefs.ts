/**
 * Towns' cultures and religions (src/lib/dynmap.ts) and a nation's shares
 * of them (src/maps/beliefs.ts), checked without a browser: a choice read
 * as the map writes it, the map's placeholders for none read as none, a
 * server site having neither; the shares by people, the towns that
 * haven't chosen last, sites left out. And the residents' names the
 * world carries for the outlaw lists.
 *
 *   pnpm test:beliefs                      the checks
 *   pnpm test:beliefs path/to/markers.json and the live map's, from a copy of its marker file
 */
import { readFileSync } from 'node:fs'

import { townsOf, type MarkerFile } from '../src/lib/dynmap'
import { worldOf } from '../src/lib/world'
import { abroadOf } from '../src/maps/abroad'
import { beliefsOf } from '../src/maps/beliefs'
import { packWorld, unpackWorld } from '../src/maps/world'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

/** A town's area as Towny's Dynmap integration writes it. */
function area(name: string, { religion, culture, ruler = 'Mayor1', nation = 'Northland' }: { religion: string; culture: string; ruler?: string; nation?: string }) {
  const desc = [
    `<div><p><span>&#x1f3f0; <a href="#">${name}</a></span></p><hr />`,
    `<p><span>&#x1f38c; <a href="#">${nation}</a></span></p><hr />`,
    `<p><span>&#x1f6d0; ${religion}</span></p> <p><span>&#x1f54e; Culture - ${culture}</span></p> <hr />`,
    `<p><span>&#x1f451; Ruler:</span></p><img src="x.png" /> <span>${ruler}</span><hr />`,
    `<p><span>&#x1f465; Residents:</span> 2<br /></p><span>${ruler}, Another</span>`,
    `<p><span>⏳ Founded:</span> Jan 17 2026<br /></p>ID 00000000-0000-0000-0000-${String(name.length).padStart(12, '0')}</div>`,
  ].join('')
  return { label: name, desc, x: [0, 16, 16, 0], z: [0, 0, 16, 16], color: '#ff0000' }
}

// Read off the map.
{
  const file: MarkerFile = {
    sets: {
      'towny.markerset': {
        areas: {
          a: area('Chosen', { religion: 'Town Religion - Catholic', culture: 'Norse' }),
          b: area('Undecided', { religion: 'Select your town&#39;s /religion &amp; /cultures', culture: '👑' }),
          c: area('Europe_Quarry', {
            religion: 'Iron Production Site. 333$ passive income per day. Conquerable by nations in the region.',
            culture: 'War',
            ruler: 'Ruler11',
          }),
        },
      },
    },
  } as MarkerFile
  const towns = townsOf(file)
  const chosen = towns.get('chosen')!
  check(chosen.religion === 'Catholic' && chosen.culture === 'Norse', `a town's choices are read (${chosen.religion}, ${chosen.culture})`)
  const undecided = towns.get('undecided')!
  check(undecided.religion === null && undecided.culture === null, "Rulercraft's prompt and its crown are no choice")
  const quarry = towns.get('europe_quarry')!
  check(quarry.kind === 'quarry' && quarry.religion === null && quarry.culture === null, 'a server site has neither: its terms and its "War" aren’t beliefs')
  const world = unpackWorld(JSON.parse(JSON.stringify(packWorld(worldOf(file)))))
  check(world.towns.find((town) => town.name === 'Chosen')?.religion === 'Catholic', 'and the world carries them to the browser')
  const old = unpackWorld({ at: 0, nations: [], towns: [{ ...packWorld(worldOf(file)).towns[0], culture: undefined, religion: undefined, people: undefined }] } as never)
  check(old.towns[0].culture === null && old.towns[0].religion === null, 'a world read before them has none')

  // Its residents' names, for the outlaw lists: the ruler first, a site's none.
  check(world.towns.find((town) => town.name === 'Chosen')?.people.join(',') === 'Mayor1,Another', 'a town carries its residents’ names, the ruler first')
  check(world.towns.find((town) => town.name === 'Europe_Quarry')?.people.length === 0, 'a server site carries none')
  check(Array.isArray(old.towns[0].people) && old.towns[0].people.length === 0, 'nor does a world read before them')
}

// A nation's shares.
{
  const town = (residents: number, culture: string | null, religion: string | null, kind: 'town' | 'quarry' = 'town') => ({ kind, residents, culture, religion })
  const beliefs = beliefsOf([
    town(10, 'Norse', 'Catholic'),
    town(3, 'norse', null),
    town(6, 'Germanic', 'Pagan'),
    town(40, null, null),
    town(1, 'War', 'Iron Production Site', 'quarry'),
  ])
  const said = (shares: typeof beliefs.cultures) => shares.map((share) => `${share.name ?? '—'}:${share.residents}/${share.towns}`).join(' ')
  check(said(beliefs.cultures) === 'Norse:13/2 Germanic:6/1 —:40/1', `cultures by people, one share however spelt, none last however many (${said(beliefs.cultures)})`)
  check(said(beliefs.religions) === 'Catholic:10/1 Pagan:6/1 —:43/2', `religions the same (${said(beliefs.religions)})`)
  check(!said(beliefs.cultures).includes('War'), "a site's neither counts")
  const empty = beliefsOf([])
  check(empty.cultures.length === 0 && empty.religions.length === 0, 'no towns, no shares')
}

// The live map: every choice is some letters, no site has one, and each nation's shares add up.
const live = process.argv[2]
if (live) {
  const file = JSON.parse(readFileSync(live, 'utf8')) as MarkerFile
  const towns = [...townsOf(file).values()]
  check(
    towns.every((town) => [town.culture, town.religion].every((value) => value === null || /\p{L}/u.test(value))),
    'every choice on the live map is a word',
  )
  check(towns.filter((town) => town.kind !== 'town').every((town) => !town.culture && !town.religion), 'and no site on it has one')
  const abroad = abroadOf(worldOf(file), [])
  const sums = abroad.nations.every((nation) => {
    const beliefs = beliefsOf(nation.members)
    const players = nation.members.filter((town) => town.kind === 'town')
    const total = (shares: typeof beliefs.cultures) => shares.reduce((sum, share) => sum + share.towns, 0)
    return total(beliefs.cultures) === players.length && total(beliefs.religions) === players.length
  })
  check(sums, `every nation's shares count each of its players' towns once (${abroad.nations.length} nations)`)
  const biggest = abroad.nations[0]
  const beliefs = beliefsOf(biggest.members)
  console.log(`     ${biggest.name}: ${beliefs.religions.map((share) => `${share.name ?? 'none chosen'} ${share.residents}`).join(', ')}`)
  const chosen = towns.filter((town) => town.kind === 'town')
  console.log(
    `     players' towns: ${chosen.length}, a religion chosen in ${chosen.filter((town) => town.religion).length}, a culture in ${chosen.filter((town) => town.culture).length}`,
  )
}

if (failed) {
  console.error('\nSome belief checks failed.')
  process.exit(1)
}
console.log('\nAll belief checks passed.')
