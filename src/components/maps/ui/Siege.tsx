import { cn } from '@/blocks/components/shared'
import { spoken } from '@/maps/data'
import { GROUND } from '@/maps/palette'
import {
  balanceWords,
  bannerWords,
  chestWords,
  pointsOf,
  progressWords,
  sideTags,
  siegeKind,
  timeWords,
  type SiegeSide,
} from '@/maps/sieges'
import type { Siege } from '@/maps/world'

import { SiegeMarkGlyph } from '../layers/SiegesLayer'

/**
 * A siege's figures in plain words, as the card on the map, the front and
 * a besieged town's page give them: what kind of siege it is, the battle
 * sessions fought (as pips), who's ahead (as a tug of war about the
 * middle), who holds the banner, this battle's points and its time left,
 * and the war chest; and SiegeWar's own lines, for anyone who wants them
 * as written.
 */

/** The siege's mark on its own, small, for a card's head or a list. */
export function SiegeBadge({ siege, side, className }: { siege: Siege; side: SiegeSide; className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-6 w-6 shrink-0', className)} viewBox="-14 -14 28 28">
      <SiegeMarkGlyph battle={siege.battle} breathe={false} scale={side ? 0.85 : 1} side={side} x={0} y={0} />
    </svg>
  )
}

/** The sessions fought, one pip each. */
function Pips({ done, of }: { done: number; of: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: Math.min(of, 12) }, (_, i) => (
        <span className={cn('h-2 w-2.5', i < done ? 'bg-coral-700' : 'border border-ink-400/50 bg-sand-50')} key={i} />
      ))}
    </span>
  )
}

/**
 * Who's ahead, as a bar about the middle: the attacker's lead runs left in
 * coral, the defender's right in sea, each end named in its side's colour
 * (shortened when the two names would run together: sieges.ts → sideTags).
 */
function Balance({ siege }: { siege: Siege }) {
  const balance = siege.balance ?? 0
  // A lead of a couple of hundred fills most of a side; the bar never quite fills.
  const share = Math.abs(balance) / (Math.abs(balance) + 200)
  const [attacker, defender] = sideTags(siege)
  return (
    <span className="block">
      <span aria-hidden="true" className="relative mt-1 block h-2 bg-sand-200">
        <span className="absolute inset-y-0 left-1/2 w-px bg-ink-400" />
        {balance ? (
          <span
            className="absolute inset-y-0"
            style={{
              background: balance > 0 ? GROUND.coral : GROUND.sea500,
              left: balance > 0 ? `${50 - share * 50}%` : '50%',
              width: `${share * 50}%`,
            }}
          />
        ) : null}
      </span>
      <span className="mt-0.5 flex justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.12em]">
        <abbr className="min-w-0 truncate no-underline" style={{ color: GROUND.coral }} title={spoken(siege.attacker)}>
          {attacker}
        </abbr>
        <abbr className="min-w-0 truncate no-underline" style={{ color: GROUND.sea500 }} title={spoken(siege.defender)}>
          {defender}
        </abbr>
      </span>
    </span>
  )
}

// The figures' column may narrow below its longest word or line: text in it wraps, anywhere if it must, rather than widen the card.
const ROW = 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 py-1'
const LABEL = 'font-label text-[10px] uppercase tracking-[0.16em] text-ink-500 pt-0.5'

export function SiegeFigures({ siege, className }: { siege: Siege; className?: string }) {
  const kind = siegeKind(siege)
  const progress = progressWords(siege)
  const balance = balanceWords(siege)
  const banner = bannerWords(siege)
  const points = pointsOf(siege)
  const chest = chestWords(siege)
  return (
    <div className={cn('text-[13px] leading-snug text-ink-700 [overflow-wrap:anywhere]', className)}>
      {kind ? <p className="mb-1.5">{kind}</p> : null}
      <dl className="divide-y divide-sand-300/60">
        {progress && siege.progress ? (
          <div className={ROW}>
            <dt className={LABEL}>Progress</dt>
            <dd>
              <Pips done={siege.progress.done} of={siege.progress.of} /> <span className="ml-1">{progress}</span>
            </dd>
          </div>
        ) : null}
        {balance ? (
          <div className={ROW}>
            <dt className={LABEL}>Balance</dt>
            <dd>
              {balance}
              <Balance siege={siege} />
            </dd>
          </div>
        ) : null}
        {banner ? (
          <div className={ROW}>
            <dt className={LABEL}>Banner</dt>
            <dd>{banner}</dd>
          </div>
        ) : null}
        <div className={ROW}>
          <dt className={LABEL}>Battle</dt>
          <dd>
            {timeWords(siege)}
            {points && siege.battle ? (
              <span className="block text-ink-500">
                Points this battle: {spoken(siege.attacker)} {points.attacker.toLocaleString('en-GB')},{' '}
                {spoken(siege.defender)} {points.defender.toLocaleString('en-GB')}
              </span>
            ) : null}
          </dd>
        </div>
        {chest ? (
          <div className={ROW}>
            <dt className={LABEL}>At stake</dt>
            <dd>{chest}</dd>
          </div>
        ) : null}
      </dl>
      {siege.lines.length ? (
        <details className="mt-1.5 text-[11px] text-ink-500">
          <summary className="cursor-pointer select-none">As SiegeWar puts it</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-[10.5px] tracking-[0.02em]">
            {siege.lines.map((line) => (
              <li key={line.label}>
                {line.label}: {line.value}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
