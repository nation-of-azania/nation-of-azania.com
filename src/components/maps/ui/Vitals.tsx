import { cn } from '@/blocks/components/shared'
import { MAX_ARMOR, MAX_HEALTH } from '@/maps/players'

/**
 * A player's health and armour as the feed gives them (0–20 each), drawn
 * as the game's own HUD draws them so a fighter reads them without
 * thinking: ten hearts, with halves, and ten chestplates, each row from
 * one element masked with the icon ten times over and filled to the share
 * (maps.css → .az-vital), with the figure beside it, bold and tabular so
 * nothing jitters as the feed moves. In the war view this is the loudest
 * thing wherever a player appears: the rosters (panels/WarPanel.tsx, the
 * player list), and the one player's own, large. Low health burns and
 * pulses; no armour is flagged too. On the map the heads draw their own
 * (layers/PlayersLayer.tsx), the same colours.
 */

/** Health at or under this reads as low: three hearts. */
export const LOW_HEALTH = 6

export function Vitals({
  health,
  armor,
  size = 'row',
  className,
}: {
  health: number | null
  armor: number | null
  /** In a roster's row; or the one player's own, large; or in a list where there's less room. */
  size?: 'row' | 'large' | 'list'
  className?: string
}) {
  const bar = (kind: 'health' | 'armour', value: number | null, max: number) => {
    const share = value === null ? 0 : Math.max(0, Math.min(1, value / max))
    const low = kind === 'health' && value !== null && value <= LOW_HEALTH
    const none = kind === 'armour' && value === 0
    const words = value === null ? `${kind} unknown` : `${kind} ${value} of ${max}`
    return (
      <span
        aria-label={words}
        className="az-vital"
        data-kind={kind}
        data-low={low ? '' : undefined}
        data-none={none ? '' : undefined}
        role="img"
        style={{ '--az-share': share } as React.CSSProperties}
        title={words}
      >
        <span aria-hidden="true" className="az-vital-icons" />
        <span className="az-vital-figure">{value === null ? '–' : value}</span>
      </span>
    )
  }
  return (
    <span className={cn('az-vitals', className)} data-size={size}>
      {bar('health', health, MAX_HEALTH)}
      {bar('armour', armor, MAX_ARMOR)}
    </span>
  )
}
