import Link from 'next/link'
import type { ComponentProps } from 'react'

const VARIANTS = {
  /** Solid pine — the main call to action on parchment. */
  primary: 'bg-pine-800 text-parchment-50 hover:bg-pine-700',
  /** Hairline outline — the quieter companion action on parchment. */
  outline:
    'border border-pine-700/40 text-pine-800 hover:border-pine-700 hover:bg-pine-100/60',
  /** Gold outline — for use on pine-900/950 bands. */
  gold: 'border border-gold-400/60 text-gold-200 hover:border-gold-300 hover:text-gold-100',
} as const

type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: keyof typeof VARIANTS
}

/** A restrained rectangular button-link in the gazette manner. */
export function LinkButton({ variant = 'primary', className, ...props }: LinkButtonProps) {
  const classes = [
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold tracking-wide transition-colors',
    VARIANTS[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <Link {...props} className={classes} />
}
