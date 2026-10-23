import { cn } from '@/blocks/components/shared'
import type { Relation } from '@/maps/data'
import { STANCE_COLOURS } from '@/maps/palette'
import { STANCES, type Stance } from '@/maps/registry'

import { EYEBROW } from '../panels/shared'

/** The stances from friend to foe, neutral in the middle, as the key reads. */
export const STANCE_ORDER: (Stance | 'neutral')[] = ['ally', 'friendly', 'neutral', 'tense', 'hostile', 'war']

export const stanceLabel = (stance: Stance | 'neutral'): string => (stance === 'neutral' ? 'Neutral' : STANCES[stance].label)

/**
 * A stance's sample, as the diplomacy layer washes a nation: hatched, for
 * war. The hatching's id is the same in every sample, which is harmless
 * since they're the same pattern, and keeps this free of hooks for the
 * server-rendered panels.
 */
export function StanceSwatch({ stance, className }: { stance: Stance | 'neutral'; className?: string }) {
  const id = 'az-stance-war-hatch'
  const colour = STANCE_COLOURS[stance]
  return (
    <svg aria-hidden="true" className={cn('h-3 w-4 shrink-0', className)} viewBox="0 0 16 12">
      {stance === 'war' ? (
        <defs>
          <pattern height={4} id={id} patternTransform="rotate(-45)" patternUnits="userSpaceOnUse" width={4}>
            <line stroke={colour.line} strokeWidth={1.4} x1={0} x2={0} y1={0} y2={4} />
          </pattern>
        </defs>
      ) : null}
      <rect fill={colour.line} fillOpacity={Math.min(0.5, colour.fill * 2)} height={10} width={14} x={1} y={1} />
      {stance === 'war' ? <rect fill={`url(#${id})`} height={10} width={14} x={1} y={1} /> : null}
      <rect fill="none" height={10} stroke={colour.line} strokeWidth={1.25} width={14} x={1} y={1} />
    </svg>
  )
}

/**
 * The key to the diplomacy layer, on the map while it's on: the stances
 * from friend to foe, friends on one line and foes on the next, each with
 * how many nations Azania holds it towards; every nation not named is
 * neutral.
 */
export function DiplomacyKey({ relations, className }: { relations: Relation[]; className?: string }) {
  const count = (stance: Stance | 'neutral') => relations.filter((relation) => relation.stance === stance).length
  return (
    <div
      className={cn(
        'border border-sand-300 bg-sand-50/95 px-3 py-2 shadow-[0_1px_2px_rgba(22,25,31,0.08)]',
        className,
      )}
      role="note"
    >
      <p className={EYEBROW}>Azania’s diplomacy</p>
      <ul className="mt-1.5 grid grid-cols-3 gap-x-3 gap-y-1 text-[12px] text-ink-700">
        {STANCE_ORDER.map((stance) => {
          const n = count(stance)
          return (
            <li className="inline-flex items-center gap-1.5" key={stance}>
              <StanceSwatch stance={stance} />
              <span>{stanceLabel(stance)}</span>
              {stance === 'neutral' ? null : n ? (
                <span className="font-mono text-[11px] text-ink-400 tabular-nums">{n}</span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
