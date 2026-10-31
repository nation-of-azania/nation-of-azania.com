'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import { INK_COLOURS } from '@/maps/palette'
import { clampSpan, VIEW_SPAN } from '@/maps/view'
import {
  INKS,
  MAP_LAYERS,
  VIEW_ASPECTS,
  type Drawing,
  type Ink,
  type MapLayer,
  type ViewAspect,
} from '@/maps/registry'

import { api, saveMessageOf } from '../api'
import { useMaps } from '../context'
import type { Editor, HighlightTool } from '../state'
import { BUTTON, EYEBROW, FIELD, Field, Notice, TextButton } from '../ui/chrome'
import { Icon, type IconName } from '../ui/icons'
import { EditorFrame, UndoRedo, type EditorPanelProps } from './EditorPanel'

const TOOLS: { tool: HighlightTool; icon: IconName; label: string; hint: string }[] = [
  {
    tool: 'select',
    icon: 'cursor',
    label: 'Pick',
    hint: 'Click a highlight to change or move it.',
  },
  {
    tool: 'pen',
    icon: 'pen',
    label: 'Pen',
    hint: 'Draw freehand on the map: press, drag, release. The map holds still meanwhile.',
  },
  {
    tool: 'line',
    icon: 'line',
    label: 'Line',
    hint: 'Click point by point. Double-click, or press Enter, to finish.',
  },
  {
    tool: 'area',
    icon: 'area',
    label: 'Area',
    hint: 'Click around what to shade. Double-click, or press Enter, to close.',
  },
  {
    tool: 'pin',
    icon: 'pin',
    label: 'Pin',
    hint: 'Click to drop a pin; give it a word or two below.',
  },
  {
    tool: 'text',
    icon: 'text',
    label: 'Note',
    hint: 'Click where a few words should sit, then type them below.',
  },
]

const LAYER_WORDS: Record<MapLayer, string> = {
  towns: 'Towns',
  places: 'Places',
  roads: 'Roads',
  events: 'Events',
}

/**
 * The highlighter: a map view for an article. The frame on the map is the
 * article's picture — move and zoom the map to set what it shows — and
 * the tools mark it up in the fixed inks. Saved, the view is chosen in a
 * Map block by its title.
 */
export function ViewForm({
  editor,
  onChange,
  onClose,
  onViewSaved,
  sceneApi,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'view' }> }) {
  const { rights, refresh } = useMaps()
  const { draft } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAs, setSavedAs] = useState<string | null>(null)
  const [frame, setFrame] = useState<{ centre: [number, number]; span: number } | null>(null)
  const textRef = useRef<HTMLInputElement>(null)

  // The frame's figures, kept current as the map moves.
  useEffect(() => {
    const read = () => setFrame(sceneApi.current?.frame(draft.aspect) ?? null)
    read()
    const handle = window.setInterval(read, 500)
    return () => window.clearInterval(handle)
  }, [sceneApi, draft.aspect])

  const selected = editor.selected != null ? draft.drawings[editor.selected] : null
  useEffect(() => {
    if (selected && (selected.kind === 'text' || selected.kind === 'pin')) textRef.current?.focus()
  }, [editor.selected, selected])

  const setTool = (tool: HighlightTool) =>
    onChange({
      ...editor,
      tool,
      pending: [],
      vertex: null,
      selected: tool === 'select' ? editor.selected : null,
    })
  const update = (next: Drawing) =>
    onChange({
      ...editor,
      draft: {
        ...draft,
        drawings: draft.drawings.map((d, i) => (i === editor.selected ? next : d)),
      },
    })
  const removeSelected = () =>
    onChange({
      ...editor,
      selected: null,
      vertex: null,
      draft: { ...draft, drawings: draft.drawings.filter((_, i) => i !== editor.selected) },
    })

  /** Drawings fit to store: notes without words are dropped. */
  const keep = (drawings: Drawing[]) => drawings.filter((d) => d.kind !== 'text' || d.text.trim())

  const save = async () => {
    const current = sceneApi.current?.frame(draft.aspect)
    if (!current) return
    setBusy(true)
    setError(null)
    try {
      const view = await api.saveView(editor.id, {
        title: draft.title.trim(),
        centre: { x: current.centre[0], z: current.centre[1] },
        span: clampSpan(current.span),
        aspect: draft.aspect,
        layers: draft.layers,
        drawings: keep(draft.drawings).map((d) =>
          d.kind === 'text' ? { ...d, text: d.text.trim() } : d,
        ),
      })
      onChange({
        ...editor,
        id: view.id,
        draft: { ...draft, drawings: view.drawings },
        selected: null,
        vertex: null,
      })
      onViewSaved(view)
      setSavedAs(view.title)
      refresh()
    } catch (caught) {
      setError(saveMessageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (
      !editor.id ||
      !window.confirm('Delete this map view? Articles showing it will say it’s gone.')
    )
      return
    setBusy(true)
    try {
      await api.remove('map-views', editor.id)
      onClose()
      refresh()
    } catch (caught) {
      setError(saveMessageOf(caught))
      setBusy(false)
    }
  }

  const tool = TOOLS.find((candidate) => candidate.tool === editor.tool)!
  const own = editor.createdBy == null || editor.createdBy === rights.user?.id || rights.anywhere

  return (
    <EditorFrame
      eyebrow={editor.id ? 'Edit the map view' : 'New map view'}
      onClose={onClose}
      title={draft.title.trim() || 'An untitled view'}
      tools={<UndoRedo />}
    >
      {!own ? (
        <Notice tone="warning">This view belongs to someone else; staff may edit it.</Notice>
      ) : null}
      <Field label="Title" note="for finding it in the Map block; readers don’t see it">
        <input
          className={FIELD}
          maxLength={100}
          onChange={(event) =>
            onChange({ ...editor, draft: { ...draft, title: event.target.value } })
          }
          placeholder="e.g. Petal Lane to the Tea Room"
          value={draft.title}
        />
      </Field>

      <Field label="Frame">
        <div className="mt-4 flex" role="group" aria-label="Aspect">
          {(Object.keys(VIEW_ASPECTS) as ViewAspect[]).map((aspect, index) => (
            <button
              aria-pressed={draft.aspect === aspect}
              className={cn(
                BUTTON,
                'h-9 flex-1 px-2 text-[11px] font-semibold uppercase tracking-[0.1em]',
                index > 0 && '-ml-px',
              )}
              key={aspect}
              onClick={() => onChange({ ...editor, draft: { ...draft, aspect } })}
              title={VIEW_ASPECTS[aspect].label}
              type="button"
            >
              {aspect}
            </button>
          ))}
        </div>
      </Field>
      <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
        {frame
          ? `${clampSpan(frame.span).toLocaleString('en-GB')} blocks across${frame.span > VIEW_SPAN.max ? ' (the whole world: a view is no wider)' : ''} · centre X ${frame.centre[0]} Z ${frame.centre[1]}`
          : 'Move and zoom the map to set the frame.'}
      </p>

      <fieldset className="mt-4">
        <legend className={EYEBROW}>Layers in the picture</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {(Object.keys(MAP_LAYERS) as MapLayer[]).map((layer) => (
            <label className="flex cursor-pointer items-center gap-1.5 text-sm" key={layer}>
              <input
                checked={draft.layers.includes(layer)}
                className="h-4 w-4 accent-sea-800"
                onChange={(event) =>
                  onChange({
                    ...editor,
                    draft: {
                      ...draft,
                      layers: event.target.checked
                        ? [...draft.layers, layer]
                        : draft.layers.filter((l) => l !== layer),
                    },
                  })
                }
                type="checkbox"
              />
              {LAYER_WORDS[layer]}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className={EYEBROW}>Highlighter</legend>
        <div className="mt-1.5 flex" role="group" aria-label="Tool">
          {TOOLS.map((candidate, index) => (
            <button
              aria-label={candidate.label}
              aria-pressed={editor.tool === candidate.tool}
              className={cn(BUTTON, 'h-10 flex-1', index > 0 && '-ml-px')}
              key={candidate.tool}
              onClick={() => setTool(candidate.tool)}
              title={candidate.label}
              type="button"
            >
              <Icon className="h-5 w-5" name={candidate.icon} />
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">
          <strong className="font-semibold text-ink-700">{tool.label}.</strong> {tool.hint}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5" role="radiogroup" aria-label="Ink">
            {(Object.keys(INKS) as Ink[]).map((ink) => (
              <button
                aria-checked={editor.ink === ink}
                aria-label={INK_COLOURS[ink].label}
                className={cn(
                  'h-7 w-7 rounded-full border-2 transition-transform focus-visible:outline-saffron-500',
                  editor.ink === ink
                    ? 'scale-110 border-sea-900'
                    : 'border-sand-300 hover:scale-105',
                )}
                key={ink}
                onClick={() => {
                  onChange({ ...editor, ink })
                  if (selected) update({ ...selected, ink })
                }}
                role="radio"
                style={{ background: INK_COLOURS[ink].fill }}
                title={INK_COLOURS[ink].label}
                type="button"
              />
            ))}
          </div>
          {editor.tool === 'pen' || editor.tool === 'line' || selected?.kind === 'line' ? (
            <>
              <div className="flex" role="group" aria-label="Weight">
                {([1, 2, 3] as const).map((weight, index) => (
                  <button
                    aria-label={['Thin', 'Medium', 'Bold'][index]}
                    aria-pressed={
                      (selected?.kind === 'line' ? (selected.weight ?? 2) : editor.weight) ===
                      weight
                    }
                    className={cn(BUTTON, 'h-8 w-9', index > 0 && '-ml-px')}
                    key={weight}
                    onClick={() => {
                      onChange({ ...editor, weight })
                      if (selected?.kind === 'line') update({ ...selected, weight })
                    }}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="w-4 rounded-full bg-current"
                      style={{ height: 1.5 + weight }}
                    />
                  </button>
                ))}
              </div>
              <button
                aria-pressed={selected?.kind === 'line' ? Boolean(selected.arrow) : editor.arrow}
                className={cn(
                  BUTTON,
                  'h-8 gap-1 px-2 text-[11px] font-semibold uppercase tracking-[0.1em]',
                )}
                onClick={() => {
                  const arrow = selected?.kind === 'line' ? !selected.arrow : !editor.arrow
                  onChange({ ...editor, arrow })
                  if (selected?.kind === 'line') update({ ...selected, arrow })
                }}
                type="button"
              >
                <Icon className="h-4 w-4" name="arrow" /> Arrow
              </button>
              <button
                aria-pressed={selected?.kind === 'line' ? Boolean(selected.curve) : editor.curve}
                className={cn(
                  BUTTON,
                  'h-8 gap-1 px-2 text-[11px] font-semibold uppercase tracking-[0.1em]',
                )}
                onClick={() => {
                  const curve = selected?.kind === 'line' ? !selected.curve : !editor.curve
                  onChange({ ...editor, curve })
                  if (selected?.kind === 'line') update({ ...selected, curve })
                }}
                title="One smooth curve through the line’s points: click a start, a bend and an end for an arc"
                type="button"
              >
                <Icon className="h-4 w-4" name="curve" /> Curve
              </button>
            </>
          ) : null}
        </div>
      </fieldset>

      {selected ? (
        <div className="mt-4 border border-saffron-400/60 bg-saffron-100/40 p-3">
          <p className={EYEBROW}>
            Picked:{' '}
            {selected.kind === 'line'
              ? 'stroke'
              : selected.kind === 'area'
                ? 'area'
                : selected.kind}
          </p>
          {selected.kind === 'line' || selected.kind === 'area' ? (
            <p className="mt-1 text-xs leading-snug text-ink-500">
              Its points are edited on the map: drag one to move it, press the line or a + to add
              one there, click one to remove it.
            </p>
          ) : null}
          {selected.kind === 'text' ? (
            <Field label="The note">
              <input
                className={FIELD}
                maxLength={80}
                onChange={(event) => update({ ...selected, text: event.target.value })}
                ref={textRef}
                value={selected.text}
              />
            </Field>
          ) : (
            <Field label="Label" note="optional">
              <input
                className={FIELD}
                maxLength={80}
                onChange={(event) =>
                  update({ ...selected, label: event.target.value || undefined })
                }
                ref={textRef}
                value={selected.label ?? ''}
              />
            </Field>
          )}
          <div className="mt-2 flex gap-2">
            <TextButton className="px-2.5 py-1.5" onClick={removeSelected} tone="danger">
              <Icon className="h-3.5 w-3.5" name="trash" /> Remove
            </TextButton>
            <TextButton
              className="px-2.5 py-1.5"
              onClick={() => onChange({ ...editor, selected: null, vertex: null })}
            >
              Done
            </TextButton>
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <span>
          {draft.drawings.length} highlight{draft.drawings.length === 1 ? '' : 's'}
        </span>
        {draft.drawings.length ? (
          <TextButton
            className="px-2 py-1"
            onClick={() =>
              window.confirm('Clear every highlight?') &&
              onChange({
                ...editor,
                selected: null,
                vertex: null,
                draft: { ...draft, drawings: [] },
              })
            }
          >
            Clear all
          </TextButton>
        ) : null}
      </div>

      {error ? (
        <Notice className="mt-4" tone="warning">
          {error}
        </Notice>
      ) : null}
      {savedAs ? (
        <Notice className="mt-4" tone="success">
          Saved. To show it in an article: in the Registry, add a <strong>Map</strong> block and
          choose “{savedAs}” as its map view.{' '}
          <a
            className="underline decoration-dotted underline-offset-2"
            href="/admin/collections/articles"
            rel="noopener"
            target="_blank"
          >
            Open the Registry <span aria-hidden="true">↗</span>
          </a>
        </Notice>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <TextButton disabled={busy || !draft.title.trim() || !frame} onClick={save} tone="primary">
          {busy ? 'Saving…' : error ? 'Try again' : editor.id ? 'Save changes' : 'Save the view'}
        </TextButton>
        <TextButton onClick={onClose}>{savedAs ? 'Done' : 'Cancel'}</TextButton>
        {editor.id && own ? (
          <TextButton className="ml-auto" disabled={busy} onClick={remove} tone="danger">
            <Icon className="h-3.5 w-3.5" name="trash" /> Delete
          </TextButton>
        ) : null}
      </div>
    </EditorFrame>
  )
}
