'use client'

import { type ComponentProps, type ReactNode, useId } from 'react'

import type { AccountFormState } from '@/app/(frontend)/account/actions'
import { cn } from '@/blocks/components/shared'

/**
 * The form furniture of the resident area — one set of fields, labels, status
 * lines and buttons shared by the sign-in form and the account settings, so
 * every form a resident meets is the same form.
 */

/**
 * A text field on sand. Focus keeps the site's saffron outline and darkens the
 * hairline to sea, so the active field reads at a glance; a field marked
 * invalid takes the coral of the seal.
 */
export const fieldClass =
  'w-full border border-sand-300 bg-sand-50 px-3.5 py-2.5 text-ink-900 transition-colors placeholder:text-ink-400 focus:border-sea-700 aria-invalid:border-coral-600'

export const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500'

const buttonClass =
  'inline-flex items-center justify-center bg-sea-800 px-5 py-2.5 text-sm font-semibold tracking-wide text-sand-50 transition-colors hover:bg-sea-700 aria-disabled:cursor-wait aria-disabled:opacity-70 aria-disabled:hover:bg-sea-800'

type FieldProps = Omit<ComponentProps<'input'>, 'id' | 'className' | 'aria-invalid' | 'aria-describedby'> & {
  label: string
  /** A quiet addition after the label, e.g. "optional". */
  labelNote?: string
  /** Guidance shown above the input and read with it. */
  hint?: ReactNode
  /** The field's error, shown below the input and read with it. */
  error?: string
}

/**
 * Label, hint, input and error, wired together: the hint and the error are the
 * input's description, and an error marks it invalid, so a screen reader
 * hears everything a sighted reader sees.
 */
export function Field({ label, labelNote, hint, error, ...input }: FieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
        {labelNote ? (
          <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-400">
            {labelNote}
          </span>
        ) : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-ink-500">
          {hint}
        </p>
      ) : null}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(errorId, hintId) || undefined}
        className={fieldClass}
        {...input}
      />
      {error ? (
        <p id={errorId} className="text-xs font-medium leading-relaxed text-coral-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type SubmitButtonProps = {
  pending: boolean
  /** The label while the action runs, e.g. "Saving…". */
  pendingLabel: string
  children: ReactNode
  className?: string
}

/**
 * The form's action. While the action runs it is marked disabled rather than
 * made so, which keeps keyboard focus on it (a disabled button drops focus to
 * the page) — the form itself ignores a second submission meanwhile.
 */
export function SubmitButton({ pending, pendingLabel, children, className }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      aria-disabled={pending || undefined}
      className={cn(buttonClass, className)}
    >
      {pending ? pendingLabel : children}
    </button>
  )
}

type FormStatusProps = {
  state: AccountFormState
  /**
   * Changes with every submission. Keying the message on it re-inserts the
   * node, so assistive technology announces "Saved." again on a second save.
   */
  announceKey: number
}

/**
 * Two live regions that are always in the document — one polite for success,
 * one assertive for failure — so screen readers announce the outcome of a
 * submission. The form's per-field errors are shown by the fields themselves.
 *
 * The regions are empty blocks until they have something to say, so they take
 * no room; the message carries its own bottom margin. Place it in block flow
 * (not as a flex item with a gap), directly above the form's actions.
 */
export function FormStatus({ state, announceKey }: FormStatusProps) {
  const success = state?.ok ? state.message : undefined
  const failure = state && !state.ok ? state.message : undefined

  return (
    <>
      <div role="status" aria-atomic="true">
        {success ? (
          <p
            key={announceKey}
            className="mb-5 flex items-start gap-2 border border-sea-700/30 bg-sea-100/50 px-3.5 py-2.5 text-sm text-sea-800"
          >
            <CheckMark className="mt-[3px] size-3.5 shrink-0" />
            <span>{success}</span>
          </p>
        ) : null}
      </div>
      <div role="alert" aria-atomic="true">
        {failure ? (
          <p
            key={announceKey}
            className="mb-5 border border-coral-600/40 bg-coral-600/5 px-3.5 py-2.5 text-sm text-coral-700"
          >
            {failure}
          </p>
        ) : null}
      </div>
    </>
  )
}

/** A small tick, drawn rather than typed so every font renders it alike. */
export function CheckMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} fill="none">
      <path
        d="M3 8.5 6.5 12 13 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
