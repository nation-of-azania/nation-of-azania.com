import { cn } from '@/blocks/components/shared'

/**
 * The Azanian tricolour as a tiny swatch — sea, saffron, coral — used beside
 * "The Nation of Azania" eyebrows. Purely decorative.
 */
export function FlagTick({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex h-3 w-[27px] shrink-0 overflow-hidden rounded-[1px]', className)}
    >
      <span className="h-full w-1/3 bg-flag-sea" />
      <span className="h-full w-1/3 bg-flag-saffron" />
      <span className="h-full w-1/3 bg-flag-coral" />
    </span>
  )
}
