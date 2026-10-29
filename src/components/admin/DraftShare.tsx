'use client'

import { Button, TextInput, toast, useAuth, useConfig, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import type { UIFieldClientProps } from 'payload'
import { useEffect, useId, useState } from 'react'

import { DRAFT_LINK_DEFAULT_DAYS, DRAFT_LINK_MAX_DAYS, draftLinkPath } from '@/lib/draftLinks'
import type { DraftLink, User } from '@/payload-types'

/**
 * "Share the draft", in the article editor's sidebar: makes links that show
 * the article's latest draft to anyone who has one, lists the links still
 * running, and revokes them (src/collections/DraftLinks.ts). Everything goes
 * through the REST API with the editor's own session, so the collection's
 * access rules decide what each person may see and do; the server's own
 * words are shown when it refuses. Wired up as a UI field in
 * src/collections/Articles.ts.
 */

const DAY_MS = 24 * 60 * 60 * 1000

/** How long a link may last, as offered: a day, a week (the default), a month (the most). */
const LASTS: { days: number; label: string }[] = [
  { days: 1, label: 'A day' },
  { days: DRAFT_LINK_DEFAULT_DAYS, label: 'A week' },
  { days: DRAFT_LINK_MAX_DAYS, label: 'A month' },
]

const idOf = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : (value as { id?: number } | null | undefined)?.id

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** "6 days left", "3 hours left", "20 minutes left": how long a link has to run, as of `now`. */
function timeLeft(expiresAt: string, now: number): string {
  const ms = new Date(expiresAt).getTime() - now
  if (ms <= 0) return 'ended'
  const minutes = Math.max(1, Math.round(ms / 60_000))
  if (minutes < 60) return `${plural(minutes, 'minute')} left`
  const hours = Math.round(ms / 3_600_000)
  if (hours < 48) return `${plural(hours, 'hour')} left`
  return `${plural(Math.round(ms / DAY_MS), 'day')} left`
}

const untilFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** The message in a Payload error response: a field's own, else the error's, else ours. */
function messageOf(json: unknown, fallback: string): string {
  const errors = (json as { errors?: { message?: string; data?: { errors?: { message?: string }[] } }[] } | null)
    ?.errors
  return errors?.[0]?.data?.errors?.[0]?.message ?? errors?.[0]?.message ?? fallback
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

/** Puts text on the clipboard; false where the browser won't allow it (no clipboard API, or an insecure origin). */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

const live = (link: DraftLink, now: number) => new Date(link.expiresAt).getTime() > now

const byExpiry = (a: DraftLink, b: DraftLink) => a.expiresAt.localeCompare(b.expiresAt)

/** Element ids for a link's row, to put the keyboard on its buttons; `prefix` is the panel's own (useId). */
const copyId = (prefix: string, linkId: number) => `${prefix}-copy-${linkId}`
const keepId = (prefix: string, linkId: number) => `${prefix}-keep-${linkId}`
const urlId = (prefix: string, linkId: number) => `${prefix}-url-${linkId}`

/** The article's links, with the moment they were read (what "6 days left" counts from). */
type Links =
  | { status: 'reading' }
  | { status: 'read'; docs: DraftLink[]; at: number }
  | { status: 'failed'; message: string }

/** The links still running for an article, soonest to end first. */
async function readLinks(base: string, articleId: number | string): Promise<Links> {
  const query = new URLSearchParams({
    'where[article][equals]': String(articleId),
    sort: 'expiresAt',
    depth: '1',
    limit: '50',
  })
  try {
    const response = await fetch(`${base}?${query}`, { credentials: 'include' })
    const json = await readJson(response)
    if (!response.ok) throw new Error(messageOf(json, `The links couldn’t be read (${response.status}).`))
    const at = Date.now()
    const docs = ((json as { docs?: DraftLink[] })?.docs ?? []).filter((link) => live(link, at))
    return { status: 'read', docs, at }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'The links couldn’t be read.' }
  }
}

export function DraftShare(_props: UIFieldClientProps) {
  const { id } = useDocumentInfo()
  const { user } = useAuth<User>()
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  // The article's context, as the form has it now: a link needs somewhere for the draft to appear.
  const contextId = useFormFields(([fields]) => idOf(fields?.context?.value))
  const base = `${api}/draft-links`
  const prefix = useId()

  const [links, setLinks] = useState<Links>({ status: 'reading' })
  const [days, setDays] = useState(DRAFT_LINK_DEFAULT_DAYS)
  const [note, setNote] = useState('')
  const [making, setMaking] = useState(false)
  const [makeError, setMakeError] = useState<string | null>(null)
  /** The link just made, to point out and to put the keyboard on. */
  const [fresh, setFresh] = useState<number | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  /** A link whose address is shown in full, for a browser that won't copy it. */
  const [shown, setShown] = useState<number | null>(null)
  const [confirming, setConfirming] = useState<number | null>(null)
  const [revoking, setRevoking] = useState<number | null>(null)
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    if (id == null) return
    let cancelled = false
    readLinks(base, id).then((read) => {
      if (!cancelled) setLinks(read)
    })
    return () => {
      cancelled = true
    }
  }, [base, id])

  // The link just made: the keyboard goes to its Copy button, so Enter copies it.
  useEffect(() => {
    if (fresh != null) document.getElementById(copyId(prefix, fresh))?.focus()
  }, [prefix, fresh])

  // Before revoking, the keyboard rests on Keep: a second Enter changes nothing.
  useEffect(() => {
    if (confirming != null) document.getElementById(keepId(prefix, confirming))?.focus()
  }, [prefix, confirming])

  // An address shown in full is selected, ready for Ctrl+C.
  useEffect(() => {
    if (shown != null) (document.getElementById(urlId(prefix, shown)) as HTMLInputElement | null)?.select()
  }, [prefix, shown])

  useEffect(() => {
    if (copied == null) return
    const timer = window.setTimeout(() => setCopied(null), 2500)
    return () => window.clearTimeout(timer)
  }, [copied])

  const urlOf = (link: DraftLink) => `${window.location.origin}${draftLinkPath(link.token ?? '')}`

  const copy = async (link: DraftLink) => {
    if (await copyText(urlOf(link))) {
      setCopied(link.id)
      setShown(null)
      toast.success('Link copied.')
    } else {
      setShown(link.id)
    }
  }

  const make = async () => {
    if (id == null || contextId == null || making) return
    setMaking(true)
    setMakeError(null)
    try {
      const response = await fetch(base, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article: id,
          expiresAt: new Date(Date.now() + days * DAY_MS).toISOString(),
          note: note.trim() || undefined,
        }),
      })
      const json = await readJson(response)
      if (!response.ok) throw new Error(messageOf(json, `The link couldn’t be made (${response.status}).`))
      const doc = (json as { doc: DraftLink }).doc
      const at = Date.now()
      setLinks((before) => ({
        status: 'read',
        at,
        docs: [...(before.status === 'read' ? before.docs.filter((link) => live(link, at)) : []), doc].sort(byExpiry),
      }))
      setNote('')
      setFresh(doc.id)
      setConfirming(null)
      // On the clipboard at once where the browser allows it; otherwise the Copy button has the keyboard.
      if (await copyText(urlOf(doc))) {
        setCopied(doc.id)
        toast.success('Link made and copied.')
      }
    } catch (error) {
      setMakeError(error instanceof Error ? error.message : 'The link couldn’t be made.')
    } finally {
      setMaking(false)
    }
  }

  const revoke = async (link: DraftLink) => {
    setRevoking(link.id)
    setListError(null)
    try {
      const response = await fetch(`${base}/${link.id}`, { method: 'DELETE', credentials: 'include' })
      // Gone already is gone: revoked, as asked.
      if (!response.ok && response.status !== 404) {
        throw new Error(messageOf(await readJson(response), `The link couldn’t be revoked (${response.status}).`))
      }
      setLinks((before) =>
        before.status === 'read' ? { ...before, docs: before.docs.filter((each) => each.id !== link.id) } : before,
      )
      if (fresh === link.id) setFresh(null)
      toast.success('Link revoked.')
    } catch (error) {
      setListError(error instanceof Error ? error.message : 'The link couldn’t be revoked.')
    } finally {
      setRevoking(null)
      setConfirming(null)
    }
  }

  const docs = links.status === 'read' ? links.docs : []
  const readAt = links.status === 'read' ? links.at : 0

  return (
    <section className="draft-share" aria-labelledby={`${prefix}-title`}>
      <h3 className="draft-share__title" id={`${prefix}-title`}>
        Share the draft
      </h3>
      <p className="draft-share__lead">
        Anyone with a link can read the latest draft, including edits made after you send it, until the link runs
        out. No account needed.
      </p>

      {id == null ? (
        <p className="draft-share__hint">Save the article first; then you can share its draft.</p>
      ) : contextId == null ? (
        <p className="draft-share__hint">Choose where the article is published (its context, above) before sharing it.</p>
      ) : (
        // Not a <form>: the panel already sits inside the document's form, and Enter in a field would save the article.
        <div className="draft-share__form">
          <fieldset className="draft-share__lasts">
            <legend className="draft-share__label">Lasts</legend>
            <div className="draft-share__pills">
              {LASTS.map((option) => (
                <label
                  key={option.days}
                  className={['draft-share__pill', days === option.days && 'draft-share__pill--on']
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name={`${prefix}-lasts`}
                    value={option.days}
                    checked={days === option.days}
                    onChange={() => setDays(option.days)}
                    disabled={making}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
          <TextInput
            path={`${prefix}-note`}
            label="For"
            placeholder="Who it’s for, e.g. Council review"
            value={note}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNote(event.target.value.slice(0, 80))}
            onKeyDown={(event) => {
              // Enter makes the link, not a save of the article.
              if (event.key === 'Enter') {
                event.preventDefault()
                void make()
              }
            }}
            readOnly={making}
          />
          <Button
            type="button"
            buttonStyle="secondary"
            size="small"
            margin={false}
            disabled={making}
            onClick={() => void make()}
          >
            {making ? 'Making a link…' : 'Make a link'}
          </Button>
          {makeError ? (
            <p className="draft-share__error" role="alert">
              {makeError}
            </p>
          ) : null}
        </div>
      )}

      {links.status === 'failed' ? (
        <p className="draft-share__error" role="alert">
          {links.message}
        </p>
      ) : null}

      {id != null && links.status === 'read' ? (
        docs.length ? (
          <>
            <h4 className="draft-share__subtitle">Links out ({docs.length})</h4>
            <ul className="draft-share__links">
              {docs.map((link) => {
                const maker = typeof link.createdBy === 'object' ? link.createdBy : null
                const mine = idOf(link.createdBy) === user?.id
                const name = link.note?.trim() || 'Unnamed link'
                const until = untilFormatter.format(new Date(link.expiresAt))
                return (
                  <li
                    key={link.id}
                    className={['draft-share__link', fresh === link.id && 'draft-share__link--fresh']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <div className="draft-share__row">
                      <span className="draft-share__note">
                        {fresh === link.id ? <span className="draft-share__new">New</span> : null}
                        {name}
                      </span>
                      <span className="draft-share__ends" title={`Until ${until}`}>
                        {timeLeft(link.expiresAt, readAt)}
                      </span>
                    </div>
                    {maker && !mine ? <p className="draft-share__by">by {maker.name}</p> : null}
                    {confirming === link.id ? (
                      <div className="draft-share__confirm" role="group" aria-label={`Revoke the link for ${name}?`}>
                        <span>Revoke it? Whoever has it loses the draft.</span>
                        <div className="draft-share__actions">
                          <Button
                            buttonStyle="pill"
                            className="draft-share__danger"
                            size="xsmall"
                            margin={false}
                            disabled={revoking === link.id}
                            onClick={() => void revoke(link)}
                          >
                            {revoking === link.id ? 'Revoking…' : 'Revoke'}
                          </Button>
                          <Button
                            id={keepId(prefix, link.id)}
                            buttonStyle="pill"
                            size="xsmall"
                            margin={false}
                            disabled={revoking === link.id}
                            onClick={() => setConfirming(null)}
                          >
                            Keep
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="draft-share__actions">
                        <Button
                          id={copyId(prefix, link.id)}
                          buttonStyle="pill"
                          size="xsmall"
                          margin={false}
                          aria-label={`Copy the link for ${name}`}
                          onClick={() => void copy(link)}
                        >
                          {copied === link.id ? 'Copied' : 'Copy link'}
                        </Button>
                        <a
                          className="draft-share__open"
                          href={draftLinkPath(link.token ?? '')}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open the link for ${name} in a new tab`}
                        >
                          Open&nbsp;↗
                        </a>
                        <Button
                          buttonStyle="pill"
                          size="xsmall"
                          margin={false}
                          aria-label={`Revoke the link for ${name}`}
                          onClick={() => setConfirming(link.id)}
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                    {shown === link.id ? (
                      <div className="draft-share__shown">
                        <label className="draft-share__label" htmlFor={urlId(prefix, link.id)}>
                          Copy it from here
                        </label>
                        <input
                          id={urlId(prefix, link.id)}
                          className="draft-share__url"
                          readOnly
                          value={urlOf(link)}
                          onFocus={(event) => event.currentTarget.select()}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </>
        ) : contextId != null ? (
          <p className="draft-share__empty">No links out.</p>
        ) : null
      ) : null}

      {listError ? (
        <p className="draft-share__error" role="alert">
          {listError}
        </p>
      ) : null}
    </section>
  )
}
