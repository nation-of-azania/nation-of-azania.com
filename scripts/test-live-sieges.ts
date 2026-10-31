/**
 * The sieges the players feed passes on (src/lib/livePlayers.ts →
 * siegeUpdatesOf), read from the map's live feed as SiegeWar rewrites each
 * siege's marker: checked on an update recorded from a real battle (the
 * Cyprus siege, 31 October 2026), with the town borders Towny rewrites
 * beside it left out, and an ended siege said to have ended.
 *
 *   pnpm test:live-sieges
 */
import { siegeUpdatesOf } from '../src/lib/livePlayers'
import { bannerOf, readingOf } from '../src/maps/battle'
import { pointsOf } from '../src/maps/sieges'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}

// As the feed carried it at 18:28:23 UTC, the third attacker just come to the banner.
const real = {
  msg: 'markerupdated',
  x: 7091.0,
  y: 64.0,
  z: -7305.0,
  id: '3b7572e8-4873-42bd-a812-7e4ed5ae6be0',
  label: 'Siege: The_Balkan_Kingdom vs Syrian_Empire',
  icon: 'siegewar.battle',
  set: 'siegewar.markerset',
  markup: true,
  desc: '<b>Siege: The_Balkan_Kingdom vs Syrian_Empire</b><hr />Town: Cyprus<br />Type: Conquest<br />War Chest: $0<br />Siege Progress: 1/3<br />Siege Status: Contested<br />Siege Balance: 3280<br />Banner Control: Attackers (3)<br />Battle Points: &#43;1460 / 0<br />Battle Time Left: 31.8 minutes',
  dim: '32x32',
  minzoom: -1,
  maxzoom: -1,
  ctype: 'markers',
  type: 'component',
  timestamp: 1793471303583,
}
const towny = { msg: 'markerupdated', id: 'Cyprus__home', set: 'towny.markerset', icon: 'fortress', label: 'Cyprus', x: 7000, z: -7300, timestamp: 1 }
const tile = { type: 'tile', name: 'flat/0_0/zz_1_1.webp', timestamp: 2 }

const { rewritten, ended } = siegeUpdatesOf([tile, towny, real])
check(rewritten.length === 1 && ended.length === 0, 'one siege read; the tile and the town border left out')
const siege = rewritten[0]
check(siege?.townId === real.id && siege.markedAt === real.timestamp, 'keyed by the town, timed by the marker')
check(siege?.town === 'Cyprus' && siege.attacker === 'The_Balkan_Kingdom' && siege.defender === 'Syrian_Empire', 'its town and sides')
check(siege?.at[0] === 7091 && siege.at[1] === -7305 && siege.battle, 'its banner, and a battle on')
check(siege?.balance === 3280 && siege.progress?.done === 1 && siege.progress.of === 3, 'its balance and progress')
check(JSON.stringify(bannerOf(siege!)) === '{"side":"attackers","holders":3}', 'three attackers hold the banner')
check(JSON.stringify(pointsOf(siege!)) === '{"attacker":1460,"defender":0}', 'the points, the escaped plus read as a plus (not 431460)')
check(readingOf(siege!, siege!.markedAt).secondsLeft === 1908, '31.8 minutes left')

const gone = siegeUpdatesOf([{ msg: 'markerdeleted', set: 'siegewar.markerset', id: real.id, timestamp: 3 }])
check(gone.ended[0] === real.id && gone.rewritten.length === 0, 'a deleted marker is a siege ended')
check(siegeUpdatesOf(null).rewritten.length === 0 && siegeUpdatesOf([{ set: 'siegewar.markerset' }]).rewritten.length === 0, 'nothing odd is trusted')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
