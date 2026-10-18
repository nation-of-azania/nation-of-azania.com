'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { type AccountFormState, changePassword } from '@/app/(frontend)/account/actions'

import { CheckMark, Field, FormStatus, SubmitButton } from './FormControls'

type Props = {
  /** The account's username, offered to password managers alongside the new password. */
  username: string
}

/** Mirrors MIN_PASSWORD_LENGTH in the server action, which decides. */
const MIN_PASSWORD_LENGTH = 10

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

/**
 * A new password, confirmed with the current one. The fields are controlled so
 * a failed attempt keeps what was typed, and a successful one clears it all;
 * a single switch shows the three passwords in clear for anyone who prefers
 * to see what they type.
 */
export function PasswordForm({ username }: Props) {
  const [values, setValues] = useState(EMPTY)
  const [revealed, setRevealed] = useState(false)
  const [submission, setSubmission] = useState(0)
  // Fields edited since the last submission: their error has been answered.
  const [edited, setEdited] = useState<Record<string, true>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] = useActionState(
    async (previous: AccountFormState, formData: FormData) => {
      const next = await changePassword(previous, formData)
      if (next?.ok) {
        setValues(EMPTY)
        setRevealed(false)
      }
      setSubmission((n) => n + 1)
      setEdited({})
      return next
    },
    null,
  )
  const errorFor = (field: keyof typeof EMPTY) =>
    edited[field] ? undefined : state?.errors?.[field]

  useEffect(() => {
    if (state && !state.ok && state.errors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [state])

  const set = (field: keyof typeof EMPTY) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setEdited((fields) => ({ ...fields, [field]: true }))
  }

  const longEnough = values.newPassword.length >= MIN_PASSWORD_LENGTH
  const type = revealed ? 'text' : 'password'

  return (
    <section
      id="your-password"
      aria-labelledby="your-password-heading"
      className="border border-sand-300 bg-sand-100/50 p-6"
    >
      <h3
        id="your-password-heading"
        className="text-[11px] uppercase tracking-[0.2em] text-saffron-600"
      >
        Password
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        Changing it signs every other device out of your account. This one stays signed in.
      </p>

      <form
        ref={formRef}
        action={formAction}
        aria-busy={pending || undefined}
        onSubmit={(event) => {
          if (pending) event.preventDefault()
        }}
        noValidate
        className="mt-6 flex flex-col gap-5"
      >
        {/*
         * Password managers file a new password under the account it belongs
         * to when the form names the account. Present but out of the way.
         */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
        />
        <Field
          label="Current password"
          name="currentPassword"
          type={type}
          autoComplete="current-password"
          required
          value={values.currentPassword}
          onChange={set('currentPassword')}
          error={errorFor('currentPassword')}
        />
        <Field
          label="New password"
          hint={
            <span className="inline-flex items-center gap-1.5">
              <CheckMark
                className={
                  longEnough ? 'size-3 text-sea-700' : 'size-3 text-sand-300 transition-colors'
                }
              />
              At least {MIN_PASSWORD_LENGTH} characters.
            </span>
          }
          name="newPassword"
          type={type}
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={values.newPassword}
          onChange={set('newPassword')}
          error={errorFor('newPassword')}
        />
        <Field
          label="Confirm new password"
          name="confirmPassword"
          type={type}
          autoComplete="new-password"
          required
          value={values.confirmPassword}
          onChange={set('confirmPassword')}
          error={errorFor('confirmPassword')}
        />
        <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={revealed}
            onChange={(event) => setRevealed(event.target.checked)}
            className="size-4 accent-sea-800"
          />
          Show passwords
        </label>

        <div>
          <FormStatus state={state} announceKey={submission} />
          <SubmitButton pending={pending} pendingLabel="Changing…" className="w-full sm:w-auto">
            Change password
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
