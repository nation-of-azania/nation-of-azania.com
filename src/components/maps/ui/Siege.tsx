import { cn } from '@/blocks/components/shared'
import { spoken } from '@/maps/data'
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
import { CapBalance, Pips } from './Marks'

/**
 * A siege's figures in plain words, as the card on the map, the front and
 * a besieged town's page give them: what kind of siege it is, the battle
 * sessions fought (as pips, ui/Marks.tsx), who's ahead (as a tug of war
 * against the ±7,000 cap, the attackers pulling left), who holds the
 * banner, this battle's points and its time left, and the war chest; and
 * SiegeWar's own lines, for anyone who wants them as written.
 */

/** The siege's mark on its own, small, for a card's head or a list. */
export function SiegeBadge({ siege, side, className }: { siege: Siege; side: SiegeSide; className?: string }) {
  return (
    <svg aria-hidden="true" className={cn('h-6 w-6 shrink-0', className)} viewBox="-14 -14 28 28">
      <SiegeMarkGlyph battle={siege.battle} breathe={false} scale={side ? 0.85 : 1} side={side} x={0} y={0} />
    </svg>
  )
}

// The figures' column may narrow below its longest word or line: text in it wraps, anywhere if it must, rather than widen the card.
const ROW = 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-2 py-1'
const LABEL = 'font-label text-[11px] uppercase tracking-[0.16em] text-ink-500 pt-0.5'

export function SiegeFigures({ siege, className }: { siege: Siege; className?: string }) {
  const kind = siegeKind(siege)
  const progress = progressWords(siege)
  const balance = balanceWords(siege)
  const banner = bannerWords(siege)
  const points = pointsOf(siege)
  const chest = chestWords(siege)
  return (
    <div className={cn('text-[14px] leading-snug text-ink-700 [overflow-wrap:anywhere]', className)}>
      {kind ? <p className="mb-1.5">{kind}</p> : null}
      <dl className="divide-y divide-sand-300/60">
        {progress && siege.progress ? (
          <div className={ROW}>
            <dt className={LABEL}>Progress</dt>
            <dd>
              {/* The pips are the image, named by the words; the words beside them are for the eye. */}
              <Pips done={siege.progress.done} figure={false} of={siege.progress.of} words={progress} />{' '}
              <span aria-hidden="true" className="ml-1">
                {progress}
              </span>
            </dd>
          </div>
        ) : null}
        {balance ? (
          <div className={ROW}>
            <dt className={LABEL}>Balance</dt>
            <dd>
              <span aria-hidden="true">{balance}</span>
              {/* Each end named in its side's colour, shortened when the two names would run together (sieges.ts → sideTags). */}
              <CapBalance className="mt-1" ends={sideTags(siege)} names={[spoken(siege.attacker), spoken(siege.defender)]} now={siege.balance ?? 0} size="panel" words={balance} />
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
        <details className="mt-1.5 text-[12px] text-ink-500">
          <summary className="cursor-pointer select-none">As SiegeWar puts it</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-[12px] tracking-[0.02em]">
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
