'use client'

import { useEffect, useState, type ReactNode, type RefObject } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapEvent, MapPlace, MapRoad, MapViewData } from '@/maps/data'
import { VIEW_ASPECTS } from '@/maps/registry'

import { api, ApiError } from '../api'
import { useMaps } from '../context'
import type { SceneApi } from '../MapScene'
import type { Editor } from '../state'
import { EYEBROW, FIELD, Field, Notice, TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { EventForm, PlaceForm, RoadForm } from './forms'
import { ViewForm } from './ViewForm'

export type EditorPanelProps = {
  editor: Editor
  onChange: (editor: Editor | null) => void
  onClose: () => void
  onSaved: (kind: 'place' | 'road' | 'event', item: MapPlace | MapRoad | MapEvent) => void
  onViewSaved: (view: MapViewData) => void
  sceneApi: RefObject<SceneApi | null>
}

/** The message a failed save shows: the server's own words, as Payload sent them. */
export const messageOf = (error: unknown): string =>
  error instanceof ApiError
    ? error.message
    : error instanceof Error
      ? error.message
      : 'Something went wrong.'

/** The frame every editor sits in: a title, a way out, and room for the form. */
export function EditorFrame({
  eyebrow,
  title,
  onClose,
  children,
}: {
  eyebrow: string
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section aria-labelledby="az-editor-title" className="flex min-h-full flex-col">
      <header className="flex items-start gap-3 border-b border-sand-300 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className={EYEBROW}>{eyebrow}</p>
          <h2 className="truncate font-display text-xl text-sea-950" id="az-editor-title">
            {title}
          </h2>
        </div>
        <button
          aria-label="Close the editor"
          className="-mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center text-ink-500 hover:text-ink-900 focus-visible:outline-saffron-500"
          onClick={onClose}
          type="button"
        >
          <Icon className="h-4 w-4" name="close" />
        </button>
      </header>
      <div className="flex-1 px-4 py-4">{children}</div>
    </section>
  )
}

/**
 * The editor in the panel: one form per kind of thing. Each form keeps
 * the draft in the shell's editor state, so the map draws it as it's
 * typed and dragged, and saves through the REST API as the signed-in
 * person — the server's refusal, when it refuses, is shown as it came.
 */
export function EditorPanel(props: EditorPanelProps) {
  const { editor } = props
  switch (editor.kind) {
    case 'place':
      return <PlaceForm {...props} editor={editor} />
    case 'road':
      return <RoadForm {...props} editor={editor} />
    case 'event':
      return <EventForm {...props} editor={editor} />
    case 'view':
      return <ViewForm {...props} editor={editor} />
    case 'views':
      return <ViewsList {...props} editor={editor} />
    case 'about':
      return <AboutForm {...props} editor={editor} />
    default:
      return null
  }
}

/** A mayor's few lines about their town, saved on the town itself. */
function AboutForm({
  editor,
  onChange,
  onClose,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'about' }> }) {
  const { data, refresh } = useMaps()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const town = data.towns.find((candidate) => candidate.id === editor.town)
  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.saveAbout(editor.town, editor.text.trim())
      onClose()
      refresh()
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }
  return (
    <EditorFrame
      eyebrow="About the town"
      onClose={onClose}
      title={town?.name.replace(/_/g, ' ') ?? 'Town'}
    >
      <Field label="A few lines" note={`${editor.text.length}/600`}>
        <textarea
          className={cn(FIELD, 'min-h-40')}
          maxLength={600}
          onChange={(event) => onChange({ ...editor, text: event.target.value })}
          placeholder="What the town is, who built it, what to see. Shown on its page on Azania Maps."
          value={editor.text}
        />
      </Field>
      {error ? (
        <Notice className="mt-3" tone="warning">
          {error}
        </Notice>
      ) : null}
      <div className="mt-4 flex gap-2">
        <TextButton disabled={busy} onClick={save} tone="primary">
          {busy ? 'Saving…' : 'Save'}
        </TextButton>
        <TextButton onClick={onClose}>Cancel</TextButton>
      </div>
    </EditorFrame>
  )
}

/** The views the signed-in person has drawn (everyone's, for staff), to open or redraw. */
function ViewsList({
  editor,
  onChange,
  onClose,
  onViewSaved,
  sceneApi,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'views' }> }) {
  const { rights, look } = useMaps()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .myViews(editor.everyone ? null : (rights.user?.id ?? null))
      .then((list) => !cancelled && onChange({ ...editor, list }))
      .catch((caught) => !cancelled && setError(messageOf(caught)))
    return () => {
      cancelled = true
    }
    // Reload when the scope flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.everyone, rights.user?.id])

  const open = (view: MapViewData) => {
    onViewSaved(view)
    onClose()
    look({ centre: view.centre, span: view.span, aspect: view.aspect })
  }
  const edit = (view: MapViewData) => {
    onChange({
      kind: 'view',
      id: view.id,
      draft: {
        title: view.title,
        aspect: view.aspect,
        layers: view.layers,
        drawings: view.drawings,
      },
      tool: 'select',
      ink: 'red',
      weight: 2,
      arrow: false,
      selected: null,
      pending: [],
      createdBy: view.createdBy,
    })
    look({ centre: view.centre, span: view.span, aspect: view.aspect })
  }

  return (
    <EditorFrame
      eyebrow="Map views"
      onClose={onClose}
      title={editor.everyone ? 'Everyone’s views' : 'My views'}
    >
      <p className="text-[13px] leading-relaxed text-ink-500">
        A view is a framed piece of the map with highlights, for an article’s Map block. Open one to
        see it here, or redraw it.
      </p>
      {rights.anywhere ? (
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            checked={editor.everyone}
            className="h-4 w-4 accent-sea-800"
            onChange={(event) =>
              onChange({ ...editor, everyone: event.target.checked, list: null })
            }
            type="checkbox"
          />
          Show everyone’s
        </label>
      ) : null}
      {error ? (
        <Notice className="mt-3" tone="warning">
          {error}
        </Notice>
      ) : null}
      {!editor.list && !error ? <p className="mt-4 text-sm text-ink-500">Fetching…</p> : null}
      {editor.list && editor.list.length === 0 ? (
        <Notice className="mt-4">
          No views yet. Choose “New map view” from the pencil to draw one.
        </Notice>
      ) : null}
      <ul className="mt-3 divide-y divide-sand-300 border-y border-sand-300">
        {editor.list?.map((view) => (
          <li className="flex items-center gap-3 py-2.5" key={view.id}>
            <Icon className="h-4 w-4 shrink-0 text-saffron-600" name="frame" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink-900">
                {view.title}
              </span>
              <span className="block text-xs text-ink-500">
                {VIEW_ASPECTS[view.aspect].label} · {view.span.toLocaleString('en-GB')} blocks
                across · {view.drawings.length} highlight
                {view.drawings.length === 1 ? '' : 's'}
              </span>
            </span>
            <TextButton className="px-2 py-1" onClick={() => open(view)}>
              Show
            </TextButton>
            <TextButton className="px-2 py-1" onClick={() => edit(view)}>
              Edit
            </TextButton>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        To use a view: in the Registry, add a <strong>Map</strong> block to an article and choose
        the view by its title.{' '}
        <a
          className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
          href="/admin/collections/articles"
          rel="noopener"
          target="_blank"
        >
          Open the Registry <span aria-hidden="true">↗</span>
        </a>
      </p>
      {sceneApi ? null : null}
    </EditorFrame>
  )
}
