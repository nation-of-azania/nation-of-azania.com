import { cn } from '@/blocks/components/shared'
import { STANCE_COLOURS } from '@/maps/palette'
import { STANCES, type Stance } from '@/maps/registry'

/**
 * The diplomacy's words and samples, shared by the map's key
 * (./DiplomacyKey.tsx), the legend, the panels and the front: pure, with
 * no hook in them, so the server-rendered panels can use them as they are.
 */

/** The stances from friend to foe, neutral in the middle, as a legend reads. */
export const STANCE_ORDER: (Stance | 'neutral')[] = ['ally', 'friendly', 'neutral', 'tense', 'hostile', 'war']

/** The stances as the key lists them: friend to foe, and the neutral, who are everyone else, last. */
export const KEY_ORDER: (Stance | 'neutral')[] = ['ally', 'friendly', 'tense', 'hostile', 'war', 'neutral']

export const stanceLabel = (stance: Stance | 'neutral'): string => (stance === 'neutral' ? 'Neutral' : STANCES[stance].label)

/** Where Azania stands with a nation, in a sentence. */
export const STANCE_WORDS: Record<Stance | 'neutral', (nation: string) => string> = {
  ally: (nation) => `${nation} is Azania’s ally`,
  friendly: (nation) => `Azania is on friendly terms with ${nation}`,
  neutral: (nation) => `Azania is neutral towards ${nation}`,
  tense: (nation) => `Relations between Azania and ${nation} are tense`,
  hostile: (nation) => `${nation} is hostile to Azania`,
  war: (nation) => `Azania is at war with ${nation}`,
}

/**
 * The war's hatching within a sample, as the segments themselves rather
 * than a pattern: a pattern wants an id, and the first of that id in the
 * page wins, which may stand in a folded key where it draws nothing.
 * Lines at 45°, bottom left to top right, `step` apart.
 */
function hatchPath(x: number, y: number, width: number, height: number, step = 2.8): string {
  let d = ''
  for (let c = x + y + step; c < x + width + y + height; c += step) {
    const x0 = Math.max(x, c - y - height)
    const x1 = Math.min(x + width, c - y)
    if (x1 <= x0) continue
    d += `M${x0.toFixed(2)} ${(c - x0).toFixed(2)}L${x1.toFixed(2)} ${(c - x1).toFixed(2)}`
  }
  return d
}

/**
 * A stance's sample, as the diplomacy layer washes a nation: hatched, for
 * war. Free of hooks and of ids, for the server-rendered panels and for
 * the many places a sample is drawn.
 */
export function StanceSwatch({ stance, className }: { stance: Stance | 'neutral'; className?: string }) {
  const colour = STANCE_COLOURS[stance]
  return (
    <svg aria-hidden="true" className={cn('h-3 w-4 shrink-0', className)} viewBox="0 0 16 12">
      <rect fill={colour.line} fillOpacity={Math.min(0.6, colour.fill * 1.2)} height={10} width={14} x={1} y={1} />
      {stance === 'war' ? <path d={hatchPath(1, 1, 14, 10)} stroke={colour.line} strokeWidth={1.3} /> : null}
      <rect fill="none" height={10} stroke={colour.line} strokeWidth={1.25} width={14} x={1} y={1} />
    </svg>
  )
}
