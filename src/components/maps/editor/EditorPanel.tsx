'use client'

import { useState, type ReactNode, type RefObject } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapEvent, MapPlace, MapRoad, MapViewData } from '@/maps/data'

import { api, saveMessageOf } from '../api'
import { useMaps } from '../context'
import { useStore } from '../hooks'
import type { SceneApi } from '../MapScene'
import { ViewRows, VIEWS_HINT } from '../panels/views'
import type { Editor } from '../state'
import { BUTTON, EYEBROW, FIELD, Field, Notice, TextButton } from '../ui/chrome'
import { Hint, HintMark } from '../ui/Hint'
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

/** A step back and forward through what's been drawn this session; the keys do the same. */
export function UndoRedo() {
  const { undo, redo, historyStore } = useMaps()
  const { canUndo, canRedo } = useStore(historyStore)
  return (
    <div aria-label="Undo and redo" className="flex" role="group">
      <Hint
        text={
          <>
            Undo the last step: <kbd>⌘Z</kbd> or <kbd>Ctrl+Z</kbd>
          </>
        }
      >
        <button aria-label="Undo" className={cn(BUTTON, 'h-8 w-8')} disabled={!canUndo} onClick={undo} type="button">
          <Icon className="h-4 w-4" name="undo" />
        </button>
      </Hint>
      <Hint
        text={
          <>
            Redo: <kbd>⇧⌘Z</kbd> or <kbd>Ctrl+Y</kbd>
          </>
        }
      >
        <button aria-label="Redo" className={cn(BUTTON, '-ml-px h-8 w-8')} disabled={!canRedo} onClick={redo} type="button">
          <Icon className="h-4 w-4" name="redo" />
        </button>
      </Hint>
    </div>
  )
}

/** The frame every editor sits in: a title (with what the thing is as a hint), a way out, its tools, and room for the form. */
export function EditorFrame({
  eyebrow,
  title,
  hint,
  tools,
  onClose,
  children,
}: {
  eyebrow: string
  title: string
  /** What is being edited, for anyone unsure: a hint on the eyebrow's mark. */
  hint?: ReactNode
  /** Set beside the way out: undo and redo, where there is drawing to undo. */
  tools?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  return (
    <section aria-labelledby="az-editor-title" className="flex min-h-full flex-col">
      <header className="flex items-start gap-3 border-b border-sand-300 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className={EYEBROW}>
            {eyebrow}
            {hint ? <HintMark label={`About ${eyebrow.toLowerCase()}`} text={hint} /> : null}
          </p>
          <h2 className="truncate font-display text-xl text-sea-950" id="az-editor-title">
            {title}
          </h2>
        </div>
        {tools ? <div className="mt-0.5 shrink-0">{tools}</div> : null}
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
 * person — the server's refusal, when it refuses, is shown as it came. A
 * save that never reached the server leaves the draft where it is.
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
      setError(saveMessageOf(caught))
      setBusy(false)
    }
  }
  return (
    <EditorFrame
      eyebrow={town && town.kind !== 'town' ? 'About the site' : 'About the town'}
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
          {busy ? 'Saving…' : error ? 'Try again' : 'Save'}
        </TextButton>
        <TextButton onClick={onClose}>Cancel</TextButton>
      </div>
    </EditorFrame>
  )
}

/** The views the signed-in person has drawn (everyone's, for staff), to open, redraw or link to. */
function ViewsList({
  editor,
  onChange,
  onClose,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'views' }> }) {
  const { rights } = useMaps()
  return (
    <EditorFrame
      eyebrow="Map views"
      hint={VIEWS_HINT}
      onClose={onClose}
      title={editor.everyone ? 'Everyone’s views' : 'My map views'}
    >
      {rights.anywhere ? (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            checked={editor.everyone}
            className="h-4 w-4 accent-sea-800"
            onChange={(event) => onChange({ ...editor, everyone: event.target.checked })}
            type="checkbox"
          />
          Show everyone’s
        </label>
      ) : null}
      <ViewRows className="mt-3" everyone={editor.everyone} />
    </EditorFrame>
  )
}
