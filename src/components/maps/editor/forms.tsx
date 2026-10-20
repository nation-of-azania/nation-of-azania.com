'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import { roadLength, roadPoints, spoken, type MapPlace } from '@/maps/data'
import { samplePath, type RoadShape } from '@/maps/geo'
import { PlaceIcon } from '@/maps/icons'
import { GROUP_COLOURS } from '@/maps/palette'
import {
  PLACE_CATEGORIES,
  PLACE_GROUPS,
  ROAD_KINDS,
  ROAD_SHAPES,
  type PlaceCategory,
  type PlaceGroup,
  type RoadKind,
} from '@/maps/registry'
import { fromLocalInput } from '@/maps/time'

import { api } from '../api'
import { useMaps } from '../context'
import type { Editor } from '../state'
import { BUTTON, FIELD, Field, Notice, TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { EditorFrame, messageOf, type EditorPanelProps } from './EditorPanel'
import { withinRights } from './rights'
import { withCornerToggled, withoutPointAt } from './road'

/** A category, chosen by its icon: the groups as rows, each pin as a button. */
export function CategoryPicker({
  value,
  onChange,
}: {
  value: PlaceCategory
  onChange: (category: PlaceCategory) => void
}) {
  const groups = Object.keys(PLACE_GROUPS) as PlaceGroup[]
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Category">
      {groups.map((group) => (
        <div key={group}>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
            {PLACE_GROUPS[group]}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {(
              Object.entries(PLACE_CATEGORIES) as [
                PlaceCategory,
                { label: string; group: PlaceGroup },
              ][]
            )
              .filter(([, category]) => category.group === group)
              .map(([key, category]) => (
                <button
                  aria-checked={value === key}
                  aria-label={category.label}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform focus-visible:outline-saffron-500',
                    value === key
                      ? 'scale-110 border-saffron-500 shadow-[0_0_0_2px_#fbf8f1_inset]'
                      : 'border-transparent hover:scale-105',
                  )}
                  key={key}
                  onClick={() => onChange(key)}
                  role="radio"
                  style={{ background: GROUP_COLOURS[group] }}
                  title={category.label}
                  type="button"
                >
                  <PlaceIcon category={key} className="h-5 w-5 text-sand-50" />
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const Actions = ({
  busy,
  onSave,
  onClose,
  onDelete,
  canSave,
}: {
  busy: boolean
  onSave: () => void
  onClose: () => void
  onDelete?: () => void
  canSave: boolean
}) => (
  <div className="mt-5 flex flex-wrap items-center gap-2">
    <TextButton disabled={busy || !canSave} onClick={onSave} tone="primary">
      {busy ? 'Saving…' : 'Save'}
    </TextButton>
    <TextButton onClick={onClose}>Cancel</TextButton>
    {onDelete ? (
      <TextButton className="ml-auto" disabled={busy} onClick={onDelete} tone="danger">
        <Icon className="h-3.5 w-3.5" name="trash" /> Delete
      </TextButton>
    ) : null}
  </div>
)

const RightsNote = ({ ok }: { ok: boolean }) =>
  ok ? null : (
    <Notice className="mt-3" tone="warning">
      That reaches outside your town’s claims. Mayors draw inside their own towns; move it within
      the claims shown in gold.
    </Notice>
  )

export function PlaceForm({
  editor,
  onChange,
  onClose,
  onSaved,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'place' }> }) {
  const { data, rights, remove } = useMaps()
  const { draft } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ok = withinRights([...(draft.point ? [draft.point] : []), ...draft.outline], data, rights)
  const canSave = Boolean(
    draft.point &&
    draft.name.trim() &&
    ok &&
    (draft.outline.length === 0 || draft.outline.length >= 3),
  )

  const save = async () => {
    if (!draft.point) return
    setBusy(true)
    setError(null)
    try {
      const y = draft.y.trim() === '' ? null : Number(draft.y)
      const place = await api.savePlace(editor.id, {
        name: draft.name.trim(),
        category: draft.category,
        description: draft.description.trim(),
        point: { x: draft.point[0], z: draft.point[1], y: Number.isFinite(y) ? y : null },
        outline: draft.outline.length >= 3 ? draft.outline : null,
      })
      onSaved('place', place)
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  const hint = editor.placing
    ? 'Click the map where the pin should stand.'
    : editor.tracing
      ? 'Click around the building to trace it. Click the first point again, or press Enter, to close the outline.'
      : draft.point
        ? 'Drag the pin to move it. An outline is optional: trace one for a building.'
        : ''

  return (
    <EditorFrame
      eyebrow={editor.id ? 'Edit the place' : 'Add a place'}
      onClose={onClose}
      title={draft.name.trim() || 'A new place'}
    >
      {hint ? <Notice>{hint}</Notice> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <TextButton
          className="px-2.5 py-1.5"
          onClick={() => onChange({ ...editor, placing: true, tracing: false })}
          aria-pressed={editor.placing}
        >
          <Icon className="h-3.5 w-3.5" name="crosshair" />{' '}
          {draft.point ? 'Move the pin' : 'Drop the pin'}
        </TextButton>
        {draft.point ? (
          <TextButton
            className="px-2.5 py-1.5"
            onClick={() => onChange({ ...editor, tracing: !editor.tracing, placing: false })}
            aria-pressed={editor.tracing}
          >
            <Icon className="h-3.5 w-3.5" name="area" />{' '}
            {editor.tracing
              ? 'Done tracing'
              : draft.outline.length
                ? 'Continue the outline'
                : 'Trace an outline'}
          </TextButton>
        ) : null}
        {draft.outline.length ? (
          <TextButton
            className="px-2.5 py-1.5"
            onClick={() =>
              onChange({ ...editor, tracing: false, draft: { ...draft, outline: [] } })
            }
          >
            Clear outline
          </TextButton>
        ) : null}
      </div>
      {draft.point ? (
        <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
          X {draft.point[0]} · Z {draft.point[1]}
          {draft.outline.length ? ` · outline of ${draft.outline.length} points` : ''}
        </p>
      ) : null}
      <RightsNote ok={ok} />
      <div className="mt-4 space-y-4">
        <Field label="Name">
          <input
            className={FIELD}
            maxLength={80}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, name: event.target.value } })
            }
            value={draft.name}
          />
        </Field>
        <Field label="Category" note={PLACE_CATEGORIES[draft.category].label}>
          <CategoryPicker
            onChange={(category) => onChange({ ...editor, draft: { ...draft, category } })}
            value={draft.category}
          />
        </Field>
        <Field label="Description" note="optional">
          <textarea
            className={cn(FIELD, 'min-h-24')}
            maxLength={600}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, description: event.target.value } })
            }
            placeholder="A line or two: what it is, who runs it, when it’s open."
            value={draft.description}
          />
        </Field>
        <Field label="Height (Y)" note="optional, for places underground or in the sky">
          <input
            className={cn(FIELD, 'w-32')}
            inputMode="numeric"
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, y: event.target.value } })
            }
            value={draft.y}
          />
        </Field>
      </div>
      {error ? (
        <Notice className="mt-4" tone="warning">
          {error}
        </Notice>
      ) : null}
      <Actions
        busy={busy}
        canSave={canSave}
        onClose={onClose}
        onDelete={
          editor.id
            ? () => window.confirm('Delete this place from the map?') && remove('place', editor.id!)
            : undefined
        }
        onSave={save}
      />
    </EditorFrame>
  )
}

export function RoadForm({
  editor,
  onChange,
  onClose,
  onSaved,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'road' }> }) {
  const { data, rights, remove } = useMaps()
  const { draft } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Judged along the course, as the server does: a bend can't swing outside the claims.
  const ok = withinRights(samplePath(roadPoints(draft)), data, rights)
  const canSave = draft.line.length >= 2 && ok
  const length = Math.round(roadLength(draft))
  const curved = draft.shape === 'curved'
  // A corner is an inner point: the ends have nothing to turn between.
  const pickedInner = editor.vertex != null && editor.vertex >= 1 && editor.vertex <= draft.line.length - 2
  const pickedCorner = editor.vertex != null && draft.corners.includes(editor.vertex)
  const setShape = (shape: RoadShape) =>
    onChange({ ...editor, draft: { ...draft, shape, corners: shape === 'curved' ? draft.corners : [] } })

  const save = async () => {
    setBusy(true)
    setError(null)
    try {
      const road = await api.saveRoad(editor.id, {
        name: draft.name.trim() || undefined,
        kind: draft.kind,
        line: draft.line,
        shape: draft.shape,
        corners: draft.shape === 'curved' ? draft.corners : [],
      })
      onSaved('road', road)
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  return (
    <EditorFrame
      eyebrow={editor.id ? 'Edit the road' : 'Draw a road'}
      onClose={onClose}
      title={draft.name.trim() || 'A new road'}
    >
      <Notice>
        {editor.drawing
          ? `Click along the road, point by point${curved ? '; the bends follow' : ''}. Double-click, or press Enter, to finish. Backspace takes the last point back.`
          : `Drag a point to move it. Drag a small handle to add a point between two. Click a point and press Delete to remove it.${curved ? ' Alt-click a point to make it a sharp corner.' : ''}`}
      </Notice>
      <div className="mt-3 flex flex-wrap gap-2">
        <TextButton
          className="px-2.5 py-1.5"
          onClick={() => onChange({ ...editor, drawing: !editor.drawing, vertex: null })}
          aria-pressed={editor.drawing}
        >
          <Icon className="h-3.5 w-3.5" name={editor.drawing ? 'check' : 'pen'} />{' '}
          {editor.drawing ? 'Finish drawing' : 'Continue drawing'}
        </TextButton>
        {editor.vertex != null ? (
          <TextButton
            className="px-2.5 py-1.5"
            onClick={() =>
              onChange({ ...editor, vertex: null, draft: withoutPointAt(draft, editor.vertex!) })
            }
          >
            Remove point
          </TextButton>
        ) : null}
        {curved && pickedInner ? (
          <TextButton
            aria-pressed={pickedCorner}
            className="px-2.5 py-1.5"
            onClick={() => onChange({ ...editor, draft: withCornerToggled(draft, editor.vertex!) })}
            title="A corner is a sharp turn in a curved road, as at a junction; the bends either side flow on."
          >
            <Icon className="h-3.5 w-3.5" name="corner" /> Sharp corner
          </TextButton>
        ) : null}
        {draft.line.length ? (
          <TextButton
            className="px-2.5 py-1.5"
            onClick={() =>
              onChange({
                ...editor,
                drawing: true,
                vertex: null,
                draft: { ...draft, line: [], corners: [] },
              })
            }
          >
            Start over
          </TextButton>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
        {draft.line.length} point{draft.line.length === 1 ? '' : 's'}
        {curved && draft.corners.length
          ? ` · ${draft.corners.length} sharp corner${draft.corners.length === 1 ? '' : 's'}`
          : ''}{' '}
        · {length.toLocaleString('en-GB')} blocks
      </p>
      <RightsNote ok={ok} />
      <div className="mt-4 space-y-4">
        <Field
          label="Shape"
          note={curved ? 'bends flow smoothly from point to point' : 'the everyday choice'}
        >
          <div className="flex" role="group" aria-label="Shape">
            {(Object.keys(ROAD_SHAPES) as RoadShape[]).map((shape, index) => (
              <button
                aria-pressed={draft.shape === shape}
                className={cn(
                  BUTTON,
                  'h-9 flex-1 px-2 text-[11px] font-semibold uppercase tracking-[0.1em]',
                  index > 0 && '-ml-px',
                )}
                key={shape}
                onClick={() => setShape(shape)}
                title={ROAD_SHAPES[shape].label}
                type="button"
              >
                {shape}
              </button>
            ))}
          </div>
          {curved ? (
            <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
              Where the road should turn sharply, as at a junction, pick the point and mark it a{' '}
              <strong className="font-semibold text-ink-700">sharp corner</strong> (or alt-click
              it); it’s drawn square.
            </p>
          ) : null}
        </Field>
        <Field label="Name" note="optional; plenty of paths have none">
          <input
            className={FIELD}
            maxLength={80}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, name: event.target.value } })
            }
            value={draft.name}
          />
        </Field>
        <Field label="Class">
          <select
            className={FIELD}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, kind: event.target.value as RoadKind } })
            }
            value={draft.kind}
          >
            {(Object.keys(ROAD_KINDS) as RoadKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {ROAD_KINDS[kind].label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? (
        <Notice className="mt-4" tone="warning">
          {error}
        </Notice>
      ) : null}
      <Actions
        busy={busy}
        canSave={canSave}
        onClose={onClose}
        onDelete={
          editor.id
            ? () => window.confirm('Delete this road from the map?') && remove('road', editor.id!)
            : undefined
        }
        onSave={save}
      />
    </EditorFrame>
  )
}

/** Articles, found by title as the writer types, to link one to an event. */
function ArticlePicker({
  value,
  onChange,
}: {
  value: { id: number; title: string } | null
  onChange: (article: { id: number; title: string } | null) => void
}) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<{ query: string; docs: { id: number; title: string }[] }>({
    query: '',
    docs: [],
  })
  const wanted = query.trim()
  useEffect(() => {
    if (wanted.length < 2) return
    let cancelled = false
    const handle = window.setTimeout(() => {
      api
        .articles(wanted)
        .then((docs) => !cancelled && setFound({ query: wanted, docs }))
        .catch(() => !cancelled && setFound({ query: wanted, docs: [] }))
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [wanted])
  // Only answers to the question as it stands.
  const results = found.query === wanted ? found.docs : []
  if (value) {
    return (
      <p className="flex items-center gap-2 border border-sand-300 bg-sand-100/60 px-3 py-2 text-sm">
        <Icon className="h-4 w-4 shrink-0 text-sea-700" name="article" />
        <span className="min-w-0 flex-1 truncate">{value.title}</span>
        <button
          aria-label="Unlink the article"
          className="text-ink-500 hover:text-ink-900"
          onClick={() => onChange(null)}
          type="button"
        >
          <Icon className="h-4 w-4" name="close" />
        </button>
      </p>
    )
  }
  return (
    <div>
      <input
        className={FIELD}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search published articles by title"
        value={query}
      />
      {results.length ? (
        <ul className="mt-1 border border-sand-300 bg-sand-50">
          {results.map((article) => (
            <li key={article.id}>
              <button
                className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-sand-100"
                onClick={() => onChange(article)}
                type="button"
              >
                {article.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function EventForm({
  editor,
  onChange,
  onClose,
  onSaved,
}: EditorPanelProps & { editor: Extract<Editor, { kind: 'event' }> }) {
  const { data, rights, remove } = useMaps()
  const { draft } = editor
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const place =
    draft.place != null ? data.places.find((candidate) => candidate.id === draft.place) : null
  const point = place?.point ?? draft.point
  const ok = point ? withinRights([point], data, rights) : true
  const startsAt = fromLocalInput(draft.startsAt)
  const endsAt = fromLocalInput(draft.endsAt)
  const endsBeforeStart = Boolean(startsAt && endsAt && endsAt < startsAt)
  const canSave = Boolean(draft.title.trim() && startsAt && point && ok && !endsBeforeStart)

  // The places the person may hold an event at.
  const places = data.places.filter(
    (candidate) =>
      rights.anywhere || (candidate.town != null && rights.towns.includes(candidate.town)),
  )
  const townName = (candidate: MapPlace) => {
    const town = data.towns.find((t) => t.id === candidate.town)
    return town ? spoken(town.name) : 'Between towns'
  }

  const save = async () => {
    if (!startsAt || !point) return
    setBusy(true)
    setError(null)
    try {
      const event = await api.saveEvent(editor.id, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        startsAt,
        endsAt,
        host: draft.host.trim(),
        place: draft.place,
        point: draft.place == null ? { x: point[0], z: point[1] } : undefined,
        article: draft.article?.id ?? (editor.id ? null : undefined),
      })
      onSaved('event', event)
    } catch (caught) {
      setError(messageOf(caught))
      setBusy(false)
    }
  }

  return (
    <EditorFrame
      eyebrow={editor.id ? 'Edit the event' : 'Add an event'}
      onClose={onClose}
      title={draft.title.trim() || 'A new event'}
    >
      {editor.picking ? <Notice>Click the map where it’s held.</Notice> : null}
      <div className="space-y-4">
        <Field label="Title">
          <input
            className={FIELD}
            maxLength={100}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, title: event.target.value } })
            }
            value={draft.title}
          />
        </Field>
        <Field label="Where">
          <select
            className={FIELD}
            onChange={(event) => {
              const id = event.target.value ? Number(event.target.value) : null
              onChange({
                ...editor,
                picking: false,
                draft: { ...draft, place: id, point: id == null ? draft.point : null },
              })
            }}
            value={draft.place ?? ''}
          >
            <option value="">A point on the map</option>
            {places.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name} · {townName(candidate)}
              </option>
            ))}
          </select>
          {draft.place == null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TextButton
                aria-pressed={editor.picking}
                className="px-2.5 py-1.5"
                onClick={() => onChange({ ...editor, picking: !editor.picking })}
              >
                <Icon className="h-3.5 w-3.5" name="crosshair" />{' '}
                {draft.point ? 'Pick again' : 'Pick on the map'}
              </TextButton>
              {draft.point ? (
                <span className="font-mono text-[11px] tracking-[0.06em] text-ink-500 tabular-nums">
                  X {draft.point[0]} · Z {draft.point[1]} · drag the handle to adjust
                </span>
              ) : null}
            </div>
          ) : null}
        </Field>
        <RightsNote ok={ok} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts">
            <input
              className={FIELD}
              onChange={(event) =>
                onChange({ ...editor, draft: { ...draft, startsAt: event.target.value } })
              }
              type="datetime-local"
              value={draft.startsAt}
            />
          </Field>
          <Field
            error={endsBeforeStart ? 'Ends after it starts.' : null}
            label="Ends"
            note="optional"
          >
            <input
              className={FIELD}
              onChange={(event) =>
                onChange({ ...editor, draft: { ...draft, endsAt: event.target.value } })
              }
              type="datetime-local"
              value={draft.endsAt}
            />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-ink-500">
          Times are in your own time zone; readers see them in theirs.
        </p>
        <Field label="Host" note="optional">
          <input
            className={FIELD}
            maxLength={80}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, host: event.target.value } })
            }
            placeholder="Who’s holding it, as readers should see it"
            value={draft.host}
          />
        </Field>
        <Field label="Description" note="optional">
          <textarea
            className={cn(FIELD, 'min-h-24')}
            maxLength={1000}
            onChange={(event) =>
              onChange({ ...editor, draft: { ...draft, description: event.target.value } })
            }
            value={draft.description}
          />
        </Field>
        <Field label="Article" note="optional: the one announcing it">
          <ArticlePicker
            onChange={(article) => onChange({ ...editor, draft: { ...draft, article } })}
            value={draft.article}
          />
        </Field>
      </div>
      {error ? (
        <Notice className="mt-4" tone="warning">
          {error}
        </Notice>
      ) : null}
      <Actions
        busy={busy}
        canSave={canSave}
        onClose={onClose}
        onDelete={
          editor.id
            ? () => window.confirm('Delete this event?') && remove('event', editor.id!)
            : undefined
        }
        onSave={save}
      />
    </EditorFrame>
  )
}
