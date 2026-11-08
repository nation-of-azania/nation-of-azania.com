/**
 * The sums behind the panels' marks (src/maps/marks.ts): how counts group
 * into pips, where a balance sits against the cap (the attackers' end on
 * the left), a rank on its strip, a distance against a limit, the needed
 * against the online, and the words each mark says for a screen reader.
 *
 *   pnpm test:marks
 */
import { RULES } from '../src/maps/battle'
import {
  asPips,
  capBalanceWords,
  capSpan,
  capX,
  countWords,
  deltaWords,
  headSlotsWords,
  meterWords,
  ordinal,
  pipGroups,
  pipState,
  rankCell,
  rankWords,
  reachScale,
  reachWords,
  share,
  sideOfBalance,
  signed,
  slotsOf,
  tallyWords,
} from '../src/maps/marks'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9

// Figures and words.
check(signed(1250) === '+1,250' && signed(-500) === '-500' && signed(0) === '0', 'signed figures, with the thousands mark')
check([1, 2, 3, 4, 11, 12, 13, 21, 22, 103, 111].map(ordinal).join() === '1st,2nd,3rd,4th,11th,12th,13th,21st,22nd,103rd,111th', 'ordinals, the teens included')
check(countWords(2, 3, 'sessions fought') === '2 of 3 sessions fought' && countWords(2, 3) === '2 of 3', 'a count’s words')
check(meterWords(6, 52, 'online', 10) === '6 of 52 online; 10 needed' && meterWords(6, 52) === '6 of 52', 'a meter’s words, with and without a target')

// Pips: grouped in fives up to twenty, a meter past that.
check(pipGroups(3).join() === '3' && pipGroups(13).join() === '5,5,3' && pipGroups(20).join() === '5,5,5,5' && pipGroups(0).length === 0, 'pips group in fives')
check(asPips(20) && !asPips(21) && !asPips(0), 'twenty or fewer are pips; more, or none, a meter')
check(pipState(0, 1, 1) === 'done' && pipState(1, 1, 1) === 'current' && pipState(2, 1, 1) === 'todo' && pipState(1, 1) === 'todo', 'a pip is done, on now or to come')
check(near(share(3, 4), 0.75) && share(5, 4) === 1 && share(-1, 4) === 0 && share(1, 0) === 0, 'a share is clamped, and nothing of nothing is nothing')

// The tally.
check(
  tallyWords(
    [
      { label: 'held', value: 6 },
      { label: 'died', value: 8 },
      { label: 'left', value: 7 },
    ],
    21,
    'tries',
  ) === '6 held, 8 died, 7 left, of 21 tries',
  'a tally’s words',
)
check(tallyWords([{ label: 'held', value: 0 }], 3, 'tries') === 'none of 3 tries' && tallyWords([{ label: 'held', value: 2 }]) === '2 held', 'a tally with nothing in it, and one without a whole')

// The capped balance: the attackers' end is the left wall.
check(capX(0) === 0.5 && capX(RULES.balanceCap) === 0 && capX(-RULES.balanceCap) === 1, 'even in the middle, the attackers’ cap at the left wall, the defenders’ at the right')
check(capX(9000) === 0 && capX(-9000) === 1, 'past the cap sits on the wall')
check(near(capX(3500), 0.25) && near(capX(-3500), 0.75), 'half the cap is a quarter from the wall')
check(near(capX(1000, 2000), 0.25), 'any cap will do')
const lead = capSpan(1250)
check(near(lead.left, capX(1250)) && near(lead.width, 0.5 - capX(1250)), 'the attackers’ lead spans from its mark to the middle')
const run = capSpan(5720, 1250)
check(near(run.left, capX(5720)) && near(run.width, capX(1250) - capX(5720)), 'a session’s run spans from now to after')
check(sideOfBalance(1) === 'attackers' && sideOfBalance(-1) === 'defenders' && sideOfBalance(0) === null, 'whose favour a balance is in')
check(capBalanceWords(1250, 5720, ['Azania', 'Sekhra']) === 'Azania ahead by 1,250; after this session, Azania ahead by 5,720 (the cap is ±7,000)', 'the balance’s words, now and after')
check(capBalanceWords(-300) === 'The defenders ahead by 300 (the cap is ±7,000)', 'the defenders by their part when unnamed')
check(capBalanceWords(0) === 'Even (the cap is ±7,000)' && capBalanceWords(0, -1400) === 'Even; after this session, the defenders ahead by 1,400 (the cap is ±7,000)', 'even, now or to start with')
check(capBalanceWords(7000, 7000, ['Azania', 'Sekhra']) === 'Azania ahead by 7,000, at the cap', 'at the cap, said once when after is the same, and the cap not said again')
check(capBalanceWords(8000, null, ['Azania', 'Sekhra']) === 'Azania ahead by 7,000, at the cap', 'past the cap is said as the cap')
check(capBalanceWords(1250, 7000, ['Azania', 'Sekhra']) === 'Azania ahead by 1,250; after this session, Azania ahead by 7,000, at the cap', 'reaching the cap this session')

// The rank strip.
const fourth = rankCell(4, 39)
check(near(fourth.left, 3 / 39) && near(fourth.width, 1 / 39), 'the fourth of 39 sits in the fourth cell')
check(rankCell(1, 1).left === 0 && rankCell(1, 1).width === 1 && rankCell(5, 0).width === 0, 'one of one fills the strip; of none, nothing')
check(rankWords(4, 39, 'nations by people') === '4th of 39 nations by people', 'a rank’s words')

// The reach bar.
const within = reachScale(4700, 12320)
check(within.within && near(within.fill, 4700 / 12320) && within.wall === 1, 'within reach: the wall at the end')
const beyond = reachScale(14000, 12320)
check(!beyond.within && beyond.fill === 1 && near(beyond.wall, 12320 / 14000), 'beyond reach: the fill runs past the wall')
check(reachWords(4700, 12320) === '4,700 of 12,320 blocks: within reach', 'within reach, in words')
check(reachWords(14000, 12320) === '14,000 blocks, 1,680 beyond the 12,320-block reach', 'beyond reach, in words')

// Head slots.
const slots = slotsOf(1, 5, 1)
check(slots.length === 6 && slots[0].slot && slots[0].mark === 'resident' && !slots[1].slot && slots[5].mark === 'ally', 'one slot filled by a resident, five spare, the ally last')
const unmet = slotsOf(3, 1, 1)
check(unmet.length === 3 && unmet[0].mark === 'resident' && unmet[1].mark === 'ally' && unmet[2].mark === null && unmet[2].slot, 'three needed with two to hand: the third slot stays hollow')
check(slotsOf(0, 2).every((slot) => !slot.slot) && slotsOf(2, 0).every((slot) => slot.slot && slot.mark === null), 'none needed, or nobody online')
check(headSlotsWords(1, 5, 1) === '1 holder needed; 5 online and 1 ally: enough', 'enough, in words')
check(headSlotsWords(3, 2) === '3 holders needed; only 2 online: out of reach', 'out of reach, in words')

// The delta chip.
check(deltaWords(12, 'people') === 'up 12 people' && deltaWords(-3) === 'down 3' && deltaWords(0) === 'no change', 'a delta’s words')

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
