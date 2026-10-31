'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'

import { Icon, type IconName } from './icons'

/**
 * The map's furniture: square buttons on whitewash with a hairline, as the
 * site's forms are drawn, and the popovers that hang off them.
 */

export const BUTTON =
  'inline-flex items-center justify-center border border-sand-300 bg-sand-50 text-sea-900 shadow-[0_1px_2px_rgba(22,25,31,0.08)] transition-colors hover:border-sea-700 hover:bg-sand-100 focus-visible:outline-saffron-500 aria-pressed:border-sea-800 aria-pressed:bg-sea-800 aria-pressed:text-sand-50 disabled:cursor-not-allowed disabled:opacity-50'

export function IconButton({
  icon,
  label,
  className,
  pressed,
  ...props
}: {
  icon: IconName
  label: string
  className?: string
  pressed?: boolean
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'aria-label'>) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cn(BUTTON, 'h-10 w-10', className)}
      title={label}
      type="button"
      {...props}
    >
      <Icon className="h-5 w-5" name={icon} />
    </button>
  )
}

/** A small text button in the same hand. */
export function TextButton({
  className,
  tone = 'quiet',
  ...props
}: { tone?: 'quiet' | 'primary' | 'danger' } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tones = {
    quiet: 'border border-sand-300 bg-sand-50 text-sea-900 hover:border-sea-700 hover:bg-sand-100',
    primary: 'bg-sea-800 text-sand-50 hover:bg-sea-700 disabled:hover:bg-sea-800',
    danger:
      'border border-coral-600/40 bg-sand-50 text-coral-700 hover:border-coral-600 hover:bg-coral-600/5',
  }
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[14px] font-semibold tracking-wide transition-colors focus-visible:outline-saffron-500 disabled:cursor-not-allowed disabled:opacity-50',
        tones[tone],
        className,
      )}
      type="button"
      {...props}
    />
  )
}

/**
 * A button that opens a small panel beneath it, closed by a click outside,
 * Escape, or choosing. The panel is a listbox, menu or plain group as the
 * caller says.
 */
export function Popover({
  icon,
  label,
  children,
  align = 'right',
  pressed,
  width = 'w-64',
}: {
  icon: IconName
  label: string
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'left' | 'right'
  pressed?: boolean
  width?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    // Escape closes the popover and nothing else: the map's own Escape (the globe, the selection) waits for the next.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)
  return (
    <div className="relative" ref={ref}>
      <IconButton
        aria-controls={id}
        aria-expanded={open}
        icon={icon}
        label={label}
        onClick={() => setOpen((value) => !value)}
        pressed={pressed || open}
      />
      {open ? (
        <div
          className={cn(
            'absolute top-full z-20 mt-1.5 border border-sand-300 bg-sand-50 p-2 text-[15px] text-ink-900 shadow-[0_8px_24px_rgba(22,25,31,0.14)]',
            width,
            align === 'right' ? 'right-0' : 'left-0',
          )}
          id={id}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      ) : null}
    </div>
  )
}

export const EYEBROW =
  'font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-600'

export const FIELD =
  'w-full border border-sand-300 bg-sand-50 px-3 py-2 text-[15px] text-ink-900 transition-colors placeholder:text-ink-400 focus:border-sea-700 focus:outline-none aria-invalid:border-coral-600'

export const LABEL = 'text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500'

/** A labelled field, in the resident area's hand. */
export function Field({
  label,
  note,
  children,
  error,
}: {
  label: string
  note?: string
  children: ReactNode
  error?: string | null
}) {
  return (
    <label className="block">
      <span className={LABEL}>
        {label}
        {note ? (
          <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-400">
            {note}
          </span>
        ) : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {error ? <p className="mt-1.5 text-[13px] font-medium text-coral-700">{error}</p> : null}
    </label>
  )
}

/**
 * A line of status: a note, a warning in the seal's coral, or a success in
 * the sea. Put into a region already on the page that's read out as it
 * changes, it's no region of its own (`live={false}`): one that arrives
 * with its words already in it may never be read out at all.
 */
export function Notice({
  tone = 'note',
  live = true,
  children,
  className,
}: {
  tone?: 'note' | 'warning' | 'success'
  live?: boolean
  children: ReactNode
  className?: string
}) {
  const tones = {
    note: 'border-sand-300 bg-sand-100/70 text-ink-700',
    warning: 'border-coral-600/40 bg-coral-600/5 text-coral-700',
    success: 'border-sea-700/30 bg-sea-100/50 text-sea-800',
  }
  return (
    <p
      className={cn('border px-3 py-2 text-[14px] leading-relaxed', tones[tone], className)}
      role={!live ? undefined : tone === 'warning' ? 'alert' : 'status'}
    >
      {children}
    </p>
  )
}
