import { RULES } from './battle'

/**
 * The sums behind the panels' small marks (src/components/maps/ui/Marks.tsx):
 * how a count is grouped into pips, where a balance sits against the cap,
 * where a rank sits on its scale, how far a distance runs against a limit,
 * how the needed are set against the online; and the words each mark says
 * for a screen reader, the sentence the mark took the place of. Pure, so
 * the marks are checked without a browser (scripts/test-marks.ts).
 *
 * Two conventions hold everywhere here. The attackers are on the left and
 * the defenders on the right, so a balance in the attackers' favour runs
 * towards the left (a tug of war pulling to their side). And a siege
 * balance is always drawn against the ±7,000 cap (battle.ts → RULES), the
 * cap as walls at both ends.
 */

/** A count of this many or fewer is drawn as pips; past it, as a meter. */
export const PIPS_MAX = 20
/** Pips are grouped in fives, read without counting. */
export const PIP_GROUP = 5

export const n = (value: number): string => Math.round(value).toLocaleString('en-GB')
export const signed = (value: number): string => (value > 0 ? `+${n(value)}` : n(value))

/** "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st". */
export function ordinal(value: number): string {
  const rest = value % 100
  if (rest >= 11 && rest <= 13) return `${value}th`
  const last = value % 10
  return `${value}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`
}

/** A value's share of a whole, 0 to 1; nothing of nothing is nothing. */
export const share = (value: number, of: number): number => (of > 0 ? Math.max(0, Math.min(1, value / of)) : 0)

/** Whether a count is drawn as pips (20 or fewer, one each) or falls back to a meter. */
export const asPips = (of: number): boolean => of > 0 && of <= PIPS_MAX

/** The pips in groups of five: 13 is [5, 5, 3]. */
export function pipGroups(of: number): number[] {
  const groups: number[] = []
  for (let left = Math.max(0, Math.floor(of)); left > 0; left -= PIP_GROUP) groups.push(Math.min(PIP_GROUP, left))
  return groups
}

export type PipState = 'done' | 'current' | 'todo'

/** What the pip at `index` (from 0) is: done, the one on now (`current`, from 0), or still to come. */
export function pipState(index: number, done: number, current: number | null = null): PipState {
  if (index < done) return 'done'
  return current !== null && index === current ? 'current' : 'todo'
}

/** "2 of 3 sessions fought"; with the noun left out, "2 of 3". */
export function countWords(done: number, of: number, noun?: string): string {
  return `${n(done)} of ${n(of)}${noun ? ` ${noun}` : ''}`
}

/** "6 of 52 online; 10 needed", for a meter with a target tick. */
export function meterWords(value: number, of: number, noun?: string, target?: number | null): string {
  const base = countWords(value, of, noun)
  return target == null ? base : `${base}; ${n(target)} needed`
}

export type TallyPart = { label: string; value: number }

/** "6 held, 8 died, 7 left, of 21 tries": each part with its figure, then the whole when it's given. */
export function tallyWords(parts: TallyPart[], of?: number | null, noun?: string): string {
  const said = parts.filter((part) => part.value > 0).map((part) => `${n(part.value)} ${part.label}`)
  const whole = of != null ? `of ${n(of)}${noun ? ` ${noun}` : ''}` : ''
  if (!said.length) return whole ? `none ${whole}` : 'none'
  return whole ? `${said.join(', ')}, ${whole}` : said.join(', ')
}

/** A horizontal span of a bar, as fractions of its width from the left. */
export type Span = { left: number; width: number }

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

/**
 * Where a balance sits on a bar drawn against ±cap: the attackers' end is
 * the left wall (0), even is the middle (0.5), the defenders' end the right
 * wall (1). Beyond the cap it sits on the wall.
 */
export function capX(balance: number, cap: number = RULES.balanceCap): number {
  return 0.5 - clamp(balance, -cap, cap) / (2 * cap)
}

/** The span between two balances on the capped bar, from even to the balance by default. */
export function capSpan(to: number, from = 0, cap: number = RULES.balanceCap): Span {
  const a = capX(from, cap)
  const b = capX(to, cap)
  return { left: Math.min(a, b), width: Math.abs(b - a) }
}

/** Whose favour a balance is in: positive is the attackers', as SiegeWar counts it. */
export const sideOfBalance = (balance: number): 'attackers' | 'defenders' | null => (balance > 0 ? 'attackers' : balance < 0 ? 'defenders' : null)

/**
 * "Azania ahead by 1,250; after this session, Azania ahead by 5,720 (the
 * cap is ±7,000)": the sides by the names given (attacker first), else by
 * their parts; "Even" when it is; "at the cap" when the balance can go no
 * further.
 */
export function capBalanceWords(now: number, after: number | null = null, names: [attacker: string, defender: string] = ['the attackers', 'the defenders'], cap: number = RULES.balanceCap): string {
  const who = (balance: number) => (balance > 0 ? names[0] : names[1])
  const atCap = (balance: number) => Math.abs(balance) >= cap
  const lead = (balance: number) => (balance === 0 ? 'even' : `${who(balance)} ahead by ${n(Math.min(Math.abs(balance), cap))}${atCap(balance) ? ', at the cap' : ''}`)
  const first = lead(now)
  const said = `${first[0].toUpperCase()}${first.slice(1)}${after === null || after === now ? '' : `; after this session, ${lead(after)}`}`
  return atCap(now) || (after !== null && atCap(after)) ? said : `${said} (the cap is ±${n(cap)})`
}

/** Where rank `rank` of `of` sits on a strip: the first at the left, each rank one cell wide. */
export function rankCell(rank: number, of: number): Span {
  if (of <= 0) return { left: 0, width: 0 }
  const width = 1 / of
  return { left: (clamp(rank, 1, of) - 1) * width, width }
}

/** "4th of 39 nations by people". */
export function rankWords(rank: number, of: number, noun?: string): string {
  return `${ordinal(rank)} of ${n(of)}${noun ? ` ${noun}` : ''}`
}

/**
 * A distance against a limit: the bar runs to the limit when the distance
 * is within it, else to the distance, with the limit's wall where it falls.
 */
export function reachScale(distance: number, limit: number): { fill: number; wall: number; within: boolean } {
  const far = Math.max(distance, limit, 1)
  return { fill: clamp(distance / far, 0, 1), wall: clamp(limit / far, 0, 1), within: distance <= limit }
}

/** "4,700 of 12,320 blocks: within reach", or "14,000 blocks, 1,680 beyond the 12,320-block reach". */
export function reachWords(distance: number, limit: number, unit = 'blocks'): string {
  if (distance <= limit) return `${n(distance)} of ${n(limit)} ${unit}: within reach`
  return `${n(distance)} ${unit}, ${n(distance - limit)} beyond the ${n(limit)}-${unit.replace(/s$/, '')} reach`
}

export type Slot = { slot: boolean; mark: 'resident' | 'ally' | null }

/**
 * The marks of HeadSlots: one slot for each needed, filled in turn by the
 * residents online and then the allies, then the spare online beyond the
 * slots; an unfilled slot is a need unmet.
 */
export function slotsOf(needed: number, online: number, allies = 0): Slot[] {
  const marks: Slot['mark'][] = [...Array<'resident'>(Math.max(0, online)).fill('resident'), ...Array<'ally'>(Math.max(0, allies)).fill('ally')]
  const count = Math.max(needed, marks.length)
  return Array.from({ length: count }, (_, i) => ({ slot: i < needed, mark: marks[i] ?? null }))
}

/** "1 holder needed; 5 online and 1 ally: enough", or "3 holders needed; only 2 online: out of reach". */
export function headSlotsWords(needed: number, online: number, allies = 0, noun = 'holder'): string {
  const have = online + allies
  const enough = have >= needed
  const who = `${n(online)} online${allies ? ` and ${n(allies)} ${allies === 1 ? 'ally' : 'allies'}` : ''}`
  return `${n(needed)} ${noun}${needed === 1 ? '' : 's'} needed; ${enough ? who : `only ${who}`}: ${enough ? 'enough' : 'out of reach'}`
}

/** "up 12 people", "down 3", "no change". */
export function deltaWords(value: number, noun?: string): string {
  if (value === 0) return 'no change'
  return `${value > 0 ? 'up' : 'down'} ${n(Math.abs(value))}${noun ? ` ${noun}` : ''}`
}
