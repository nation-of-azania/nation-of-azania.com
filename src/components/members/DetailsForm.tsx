'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { type AccountFormState, updateAccount } from '@/app/(frontend)/account/actions'
import { BylineAvatar } from '@/components/site/BylineAvatar'
import { isMinecraftName, minecraftHeadUrl, type ResolvedByline } from '@/components/site/format'

import { Field, FormStatus, SubmitButton } from './FormControls'

type Props = {
  /** The display name on record. */
  name: string
  /** The Minecraft name on record, or "" for none. */
  minecraftName: string
}

/**
 * A value that trails the live one by a moment, so a head is only requested
 * once the typist pauses rather than for every letter of the name.
 */
function useSettled<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

/**
 * The resident's display name and Minecraft name, with the credit the Gazette
 * would print for them drawn live above the fields: the name as typed, and
 * the head for the Minecraft name once it is one. The page is re-rendered by
 * the action on success, so the header and standing follow the saved details.
 */
export function DetailsForm({ name: savedName, minecraftName: savedMinecraftName }: Props) {
  const [name, setName] = useState(savedName)
  const [minecraftName, setMinecraftName] = useState(savedMinecraftName)
  const [submission, setSubmission] = useState(0)
  // Fields edited since the last submission: their error has been answered.
  const [edited, setEdited] = useState<Record<string, true>>({})
  const formRef = useRef<HTMLFormElement>(null)

  const [state, formAction, pending] = useActionState(
    async (previous: AccountFormState, formData: FormData) => {
      const next = await updateAccount(previous, formData)
      setSubmission((n) => n + 1)
      setEdited({})
      return next
    },
    null,
  )
  const errorFor = (field: string) => (edited[field] ? undefined : state?.errors?.[field])

  // After a failed submission, take the reader to the first field at fault:
  // its label, value and error are then read together.
  useEffect(() => {
    if (state && !state.ok && state.errors) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    }
  }, [state])

  const dirty = name.trim() !== savedName || minecraftName.trim() !== savedMinecraftName
  // "Saved." gives way to "Unsaved changes" as soon as the details differ again.
  const shownState = state?.ok && dirty ? null : state

  // The credit as the Gazette would set it. The head waits for the typing to
  // settle; the name does not, since it costs nothing to redraw.
  const settledMinecraftName = useSettled(minecraftName.trim(), 400)
  const headName = isMinecraftName(settledMinecraftName) ? settledMinecraftName : null
  const preview: ResolvedByline = {
    name: name.trim() || savedName,
    avatar: headName ? { url: minecraftHeadUrl(headName), alt: '', pixelated: true } : undefined,
  }
  const headNote = headName
    ? `${headName}’s head, from their skin on Rulercraft.`
    : settledMinecraftName
      ? 'Not a Minecraft name yet, so your initials stand in.'
      : 'Without a Minecraft name, your initials stand in for a head.'

  return (
    <section
      id="your-details"
      aria-labelledby="your-details-heading"
      className="border border-sand-300 bg-sand-100/50 p-6"
    >
      <h3 id="your-details-heading" className="text-[11px] uppercase tracking-[0.2em] text-saffron-600">
        Your details
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-500">
        How the Register and the papers name you. Byline profiles that carry your Minecraft name
        follow it when it changes.
      </p>

      {/* The specimen: the byline, as it would be set on an article. */}
      <div className="mt-5 border border-sand-300 bg-sand-50 px-4 py-3.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400">As the Gazette credits you</p>
        <div className="mt-3 flex items-center gap-3.5">
          <BylineAvatar byline={preview} size={48} tone="gazette" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-tight text-sea-950">
              <span className="italic text-ink-500">By </span>
              {preview.name}
            </p>
            <p className="mt-1 text-xs leading-snug text-ink-500">{headNote}</p>
          </div>
        </div>
      </div>

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
        <Field
          label="Display name"
          hint="Shown here, and on anything you write without a byline."
          name="name"
          type="text"
          autoComplete="nickname"
          required
          maxLength={60}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setEdited((fields) => ({ ...fields, name: true }))
          }}
          error={errorFor('name')}
        />
        <Field
          label="Minecraft name"
          labelNote="optional"
          hint="Your head on bylines. 3–16 letters, digits or underscores, with a leading dot for Bedrock players."
          name="minecraftName"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={17}
          value={minecraftName}
          onChange={(event) => {
            setMinecraftName(event.target.value)
            setEdited((fields) => ({ ...fields, minecraftName: true }))
          }}
          error={errorFor('minecraftName')}
        />

        <div>
          <FormStatus state={shownState} announceKey={submission} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full sm:w-auto">
              Save details
            </SubmitButton>
            {dirty && !pending ? (
              <span className="text-xs text-saffron-600">Unsaved changes</span>
            ) : null}
          </div>
        </div>
      </form>
    </section>
  )
}
