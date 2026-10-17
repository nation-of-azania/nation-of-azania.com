import Link from 'next/link'
import type { ComponentProps } from 'react'

const VARIANTS = {
  /** Solid sea — the main call to action on sand. */
  primary: 'bg-sea-800 text-sand-50 hover:bg-sea-700',
  /** Hairline outline — the quieter companion action on sand. */
  outline:
    'border border-sea-700/40 text-sea-800 hover:border-sea-700 hover:bg-sea-100/60',
  /** Saffron outline — for use on sea-900/950 bands. */
  gold: 'border border-saffron-400/60 text-saffron-200 hover:border-saffron-300 hover:text-saffron-100',
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
