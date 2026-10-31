import { cn } from '@/blocks/components/shared'
import { MAX_ARMOR, MAX_HEALTH } from '@/maps/players'

import { Icon } from './icons'

/**
 * A player's health and armour as the feed gives them (0–20 each, two to
 * a heart and two to an armour icon): a bar for each, with its figure,
 * as the war view's rosters show them (panels/WarPanel.tsx). On the map
 * the heads draw the same bars by hand (layers/PlayersLayer.tsx;
 * maps.css → .az-vital). Health that has fallen low is said in a hotter
 * red, so the one who needs to fall back stands out of a list.
 */

/** Health at or under this reads as low: three hearts. */
export const LOW_HEALTH = 6

export function Vitals({
  health,
  armor,
  large = false,
  className,
}: {
  health: number | null
  armor: number | null
  /** The one player's own, with room: taller bars and the figures over them. */
  large?: boolean
  className?: string
}) {
  const bar = (kind: 'health' | 'armour', value: number | null, max: number) => {
    const share = value === null ? 0 : Math.max(0, Math.min(1, value / max))
    const low = kind === 'health' && value !== null && value <= LOW_HEALTH
    const words = value === null ? `${kind} unknown` : `${kind} ${value} of ${max}`
    return (
      <span
        aria-label={words}
        className={cn('az-vital', large ? 'az-vital-large' : null)}
        data-kind={kind}
        data-low={low ? '' : undefined}
        role="img"
        style={{ '--az-share': share } as React.CSSProperties}
        title={words}
      >
        <Icon className={large ? 'h-4 w-4' : 'h-3 w-3'} name={kind === 'health' ? 'heart' : 'shield'} />
        <span className="az-vital-track">
          <span className="az-vital-fill" />
        </span>
        <span className="az-vital-figure">{value === null ? '–' : large ? `${value} / ${max}` : value}</span>
      </span>
    )
  }
  return (
    <span className={cn('az-vitals', large ? 'flex flex-col gap-1.5' : 'inline-grid grid-cols-2 gap-x-3', className)}>
      {bar('health', health, MAX_HEALTH)}
      {bar('armour', armor, MAX_ARMOR)}
    </span>
  )
}
