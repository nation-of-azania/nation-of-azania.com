import { cn } from '@/blocks/components/shared'
import { nationInk, NO_NATION } from '@/maps/palette'

/**
 * A nation's colour as a small square (a town's, round), as the map draws
 * its claims: the tempered colour for the edge, a wash of it inside. For
 * the search's rows, the panels' eyebrows and the lists.
 */
export function Swatch({
  colour,
  round = false,
  className,
}: {
  colour: string | null | undefined
  round?: boolean
  className?: string
}) {
  const ink = colour ? nationInk(colour).line : NO_NATION.line
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-3 w-3 shrink-0 border', round && 'rounded-full', className)}
      style={{
        background: `color-mix(in srgb, ${ink} 30%, transparent)`,
        borderColor: ink,
        borderStyle: colour ? 'solid' : 'dashed',
      }}
    />
  )
}
