'use client'

import { useEffect, useRef, useState } from 'react'

import { roadPoints, type MapData, type MapRights } from '@/maps/data'
import { roundPoint, samplePath, type Point } from '@/maps/geo'
import { GROUND, INK_COLOURS } from '@/maps/palette'

import { useLatest } from '../hooks'
import { DrawingsLayer } from '../layers/DrawingsLayer'
import { EventMark } from '../layers/EventsLayer'
import { PlacePin } from '../layers/PlacesLayer'
import { pathOf, type Projection } from '../layers/projection'
import { RoadsLayer } from '../layers/RoadsLayer'
import { L, toPoint, useLeaflet } from '../leaflet/canvas'
import type { Editor } from '../state'
import { withinRights } from './rights'
import { betweenPoints, withCornerToggled, withoutPointAt, withPointAt } from './road'

type Props = {
  data: MapData
  rights: MapRights
  editor: Editor
  onEditor: (editor: Editor | null) => void
  projection: Projection
}

/**
 * A handle on a point: dragged with the pointer (the map stays still
 * meanwhile), clicked to pick it. Native listeners, since the handle must
 * stop Leaflet's own drag before it starts and the map's click after. A
 * square handle marks a sharp corner on a curved road.
 */
function Handle({
  point,
  projection,
  onDrag,
  onPick,
  picked,
  small,
  square,
  colour = GROUND.saffron,
}: {
  point: Point
  projection: Projection
  onDrag: (point: Point) => void
  /** A click without a drag; the event says which keys were held. */
  onPick?: (event: PointerEvent) => void
  picked?: boolean
  small?: boolean
  square?: boolean
  colour?: string
}) {
  const { map } = useLeaflet()
  const ref = useRef<SVGGElement>(null)
  const handlers = useLatest({ onDrag, onPick })

  useEffect(() => {
    const element = ref.current
    if (!element) return
    L.DomEvent.disableClickPropagation(element as unknown as HTMLElement)
    let moved = false
    const onPointerDown = (event: PointerEvent) => {
      event.stopPropagation()
      event.preventDefault()
      moved = false
      map.dragging.disable()
      element.setPointerCapture(event.pointerId)
      const onMove = (move: PointerEvent) => {
        moved = true
        const latlng = map.mouseEventToLatLng(move as unknown as MouseEvent)
        handlers.current.onDrag(roundPoint(toPoint(latlng)))
      }
      const onUp = (up: PointerEvent) => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerup', onUp)
        element.removeEventListener('pointercancel', onUp)
        map.dragging.enable()
        if (!moved) handlers.current.onPick?.(up)
      }
      element.addEventListener('pointermove', onMove)
      element.addEventListener('pointerup', onUp)
      element.addEventListener('pointercancel', onUp)
    }
    element.addEventListener('pointerdown', onPointerDown)
    return () => element.removeEventListener('pointerdown', onPointerDown)
  }, [map, handlers])

  const [x, y] = projection.project(point)
  const r = small ? 4 : 6
  const paint = {
    fill: picked ? colour : GROUND.whitewash,
    stroke: picked ? GROUND.whitewash : colour,
    strokeWidth: 2,
  }
  return (
    <g className="az-handle" ref={ref}>
      {square ? (
        <rect height={r * 2} width={r * 2} x={x - r} y={y - r} {...paint} />
      ) : (
        <circle cx={x} cy={y} r={r} {...paint} />
      )}
    </g>
  )
}


/** Douglas–Peucker: fewer points along a freehand stroke, within a tolerance in blocks. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  const [ax, az] = points[0]
  const [bx, bz] = points[points.length - 1]
  let farthest = 0
  let index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, pz] = points[i]
    const length = Math.hypot(bx - ax, bz - az)
    const distance =
      length === 0
        ? Math.hypot(px - ax, pz - az)
        : Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / length
    if (distance > farthest) {
      farthest = distance
      index = i
    }
  }
  if (farthest <= tolerance) return [points[0], points[points.length - 1]]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}

/**
 * The editor's marks on the map: the draft being drawn, with handles on
 * its points, and the pen for a map view's freehand strokes. Keys: Enter
 * finishes a line, Backspace takes the last point back, Delete removes
 * what's picked, Escape steps out.
 */
export function Tools({ data, rights, editor, onEditor, projection }: Props) {
  const { map } = useLeaflet()
  const editorRef = useLatest(editor)
  const [stroke, setStroke] = useState<Point[] | null>(null)
  const penning = editor.kind === 'view' && editor.tool === 'pen'

  // The pen: a press on the map starts a stroke, a release keeps it.
  useEffect(() => {
    if (!penning) return
    const container = map.getContainer()
    let points: Point[] | null = null
    const at = (event: PointerEvent) =>
      roundPoint(toPoint(map.mouseEventToLatLng(event as unknown as MouseEvent)))
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      event.preventDefault()
      container.setPointerCapture(event.pointerId)
      points = [at(event)]
      setStroke(points)
    }
    const onMove = (event: PointerEvent) => {
      if (!points) return
      points = [...points, at(event)]
      setStroke(points)
    }
    const onUp = () => {
      if (!points) return
      const current = editorRef.current
      // A block at this zoom is one pixel-ish; keep the stroke's shape, drop its jitter.
      const tolerance = Math.max(0.5, 1.5 / projection.ppb)
      const simplified = simplify(points, tolerance)
      points = null
      setStroke(null)
      if (current.kind === 'view' && simplified.length >= 2) {
        onEditor({
          ...current,
          selected: current.draft.drawings.length,
          draft: {
            ...current.draft,
            drawings: [
              ...current.draft.drawings,
              {
                kind: 'line',
                points: simplified,
                ink: current.ink,
                weight: current.weight,
                arrow: current.arrow,
              },
            ],
          },
        })
      }
    }
    container.addEventListener('pointerdown', onDown)
    container.addEventListener('pointermove', onMove)
    container.addEventListener('pointerup', onUp)
    container.addEventListener('pointercancel', onUp)
    return () => {
      container.removeEventListener('pointerdown', onDown)
      container.removeEventListener('pointermove', onMove)
      container.removeEventListener('pointerup', onUp)
      container.removeEventListener('pointercancel', onUp)
    }
  }, [map, penning, projection.ppb, onEditor, editorRef])

  // Keys, anywhere but in a field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const current = editorRef.current
      const undo = event.key === 'z' && (event.metaKey || event.ctrlKey)
      switch (current.kind) {
        case 'road': {
          if (event.key === 'Enter' && current.drawing) onEditor({ ...current, drawing: false })
          else if ((event.key === 'Backspace' || undo) && current.drawing)
            onEditor({
              ...current,
              draft: withoutPointAt(current.draft, current.draft.line.length - 1),
            })
          else if ((event.key === 'Delete' || event.key === 'Backspace') && current.vertex != null)
            onEditor({ ...current, vertex: null, draft: withoutPointAt(current.draft, current.vertex) })
          else if (event.key === 'Escape')
            onEditor(
              current.drawing
                ? { ...current, drawing: false }
                : current.vertex != null
                  ? { ...current, vertex: null }
                  : null,
            )
          else return
          break
        }
        case 'place': {
          if (event.key === 'Enter' && current.tracing) onEditor({ ...current, tracing: false })
          else if ((event.key === 'Backspace' || undo) && current.tracing)
            onEditor({
              ...current,
              draft: { ...current.draft, outline: current.draft.outline.slice(0, -1) },
            })
          else if (event.key === 'Escape')
            onEditor(
              current.tracing || current.placing
                ? { ...current, tracing: false, placing: false }
                : null,
            )
          else return
          break
        }
        case 'event': {
          if (event.key === 'Escape')
            onEditor(current.picking ? { ...current, picking: false } : null)
          else return
          break
        }
        case 'view': {
          if (event.key === 'Enter' && current.pending.length) {
            const enough =
              current.tool === 'line' ? current.pending.length >= 2 : current.pending.length >= 3
            if (!enough) return
            const drawing =
              current.tool === 'line'
                ? {
                    kind: 'line' as const,
                    points: current.pending,
                    ink: current.ink,
                    weight: current.weight,
                    arrow: current.arrow,
                  }
                : { kind: 'area' as const, points: current.pending, ink: current.ink }
            onEditor({
              ...current,
              pending: [],
              selected: current.draft.drawings.length,
              draft: { ...current.draft, drawings: [...current.draft.drawings, drawing] },
            })
          } else if (event.key === 'Backspace' && current.pending.length)
            onEditor({ ...current, pending: current.pending.slice(0, -1) })
          else if (undo)
            onEditor({
              ...current,
              selected: null,
              draft: { ...current.draft, drawings: current.draft.drawings.slice(0, -1) },
            })
          else if (
            (event.key === 'Delete' || event.key === 'Backspace') &&
            current.selected != null
          )
            onEditor({
              ...current,
              selected: null,
              draft: {
                ...current.draft,
                drawings: current.draft.drawings.filter((_, i) => i !== current.selected),
              },
            })
          else if (event.key === 'Escape')
            onEditor(
              current.pending.length
                ? { ...current, pending: [] }
                : current.selected != null
                  ? { ...current, selected: null }
                  : { ...current, tool: 'select' },
            )
          else return
          break
        }
        default:
          return
      }
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEditor, editorRef])

  switch (editor.kind) {
    case 'place': {
      const { draft } = editor
      const ok = withinRights(
        [...(draft.point ? [draft.point] : []), ...draft.outline],
        data,
        rights,
      )
      const colour = ok ? GROUND.saffron : GROUND.coral
      return (
        <g className="az-tools">
          {draft.outline.length > 0 ? (
            <path
              d={pathOf(projection, draft.outline, !editor.tracing)}
              fill={colour}
              fillOpacity={0.15}
              stroke={colour}
              strokeDasharray={editor.tracing ? '5 4' : undefined}
              strokeLinejoin="round"
              strokeWidth={2}
            />
          ) : null}
          {draft.outline.map((point, index) => (
            <Handle
              colour={colour}
              key={index}
              onDrag={(next) =>
                onEditor({
                  ...editor,
                  draft: {
                    ...draft,
                    outline: draft.outline.map((p, i) => (i === index ? next : p)),
                  },
                })
              }
              onPick={
                index === 0 && editor.tracing && draft.outline.length >= 3
                  ? () => onEditor({ ...editor, tracing: false })
                  : undefined
              }
              point={point}
              projection={projection}
              small
            />
          ))}
          {draft.point ? (
            <>
              <PlacePin
                place={{ category: draft.category }}
                selected
                x={projection.project(draft.point)[0]}
                y={projection.project(draft.point)[1]}
              />
              <Handle
                colour={colour}
                onDrag={(next) => onEditor({ ...editor, draft: { ...draft, point: next } })}
                point={draft.point}
                projection={projection}
              />
            </>
          ) : null}
        </g>
      )
    }
    case 'road': {
      const { draft } = editor
      // Judged along the course, as the server does: a bend can't swing outside the claims.
      const ok = withinRights(samplePath(roadPoints(draft)), data, rights)
      const colour = ok ? GROUND.saffron : GROUND.coral
      const curved = draft.shape === 'curved'
      return (
        <g className="az-tools">
          {draft.line.length >= 2 ? (
            <RoadsLayer
              projection={projection}
              roads={[{ id: -1, ...draft, name: draft.name || null, town: null }]}
            />
          ) : null}
          {/* The points joined up: the road itself when straight, the thread the curve follows when curved. */}
          {draft.line.length >= 1 ? (
            <path
              d={pathOf(projection, draft.line)}
              fill="none"
              stroke={colour}
              strokeDasharray="4 4"
              strokeOpacity={curved ? 0.5 : 0.9}
              strokeWidth={1.5}
            />
          ) : null}
          {!editor.drawing
            ? betweenPoints(draft).map((point, index) => (
                <Handle
                  colour={colour}
                  key={`mid-${index}`}
                  onDrag={(next) =>
                    onEditor({ ...editor, vertex: index + 1, draft: withPointAt(draft, index + 1, next) })
                  }
                  onPick={() =>
                    onEditor({ ...editor, vertex: index + 1, draft: withPointAt(draft, index + 1, point) })
                  }
                  point={point}
                  projection={projection}
                  small
                />
              ))
            : null}
          {draft.line.map((point, index) => (
            <Handle
              colour={colour}
              key={index}
              onDrag={(next) =>
                onEditor({
                  ...editor,
                  draft: { ...draft, line: draft.line.map((p, i) => (i === index ? next : p)) },
                })
              }
              onPick={(event) =>
                // Alt-click makes a point a sharp corner of a curved road, and back.
                curved && event.altKey
                  ? onEditor({ ...editor, vertex: index, draft: withCornerToggled(draft, index) })
                  : onEditor({ ...editor, vertex: editor.vertex === index ? null : index })
              }
              picked={editor.vertex === index}
              point={point}
              projection={projection}
              square={curved && draft.corners.includes(index)}
            />
          ))}
        </g>
      )
    }
    case 'event': {
      const { draft } = editor
      const place =
        draft.place != null ? data.places.find((candidate) => candidate.id === draft.place) : null
      const point = place?.point ?? draft.point
      if (!point) return null
      const ok = withinRights([point], data, rights)
      const [x, y] = projection.project(point)
      return (
        <g className="az-tools">
          <EventMark phase="upcoming" selected x={x + 16} y={y - 14} />
          {!place ? (
            <Handle
              colour={ok ? GROUND.saffron : GROUND.coral}
              onDrag={(next) => onEditor({ ...editor, draft: { ...draft, point: next } })}
              point={point}
              projection={projection}
            />
          ) : null}
        </g>
      )
    }
    case 'view': {
      const ink = INK_COLOURS[editor.ink]
      return (
        <g className="az-tools">
          <DrawingsLayer
            drawings={editor.draft.drawings}
            onSelect={
              editor.tool === 'select'
                ? (index) => onEditor({ ...editor, selected: index })
                : undefined
            }
            projection={projection}
            selected={editor.selected}
          />
          {editor.pending.length > 0 ? (
            <>
              <path
                d={pathOf(projection, editor.pending, editor.tool === 'area')}
                fill={editor.tool === 'area' ? ink.fill : 'none'}
                fillOpacity={0.15}
                stroke={ink.fill}
                strokeDasharray="5 4"
                strokeLinecap="round"
                strokeWidth={2.5}
              />
              {editor.pending.map((point, index) => (
                <Handle
                  colour={ink.fill}
                  key={index}
                  onDrag={(next) =>
                    onEditor({
                      ...editor,
                      pending: editor.pending.map((p, i) => (i === index ? next : p)),
                    })
                  }
                  point={point}
                  projection={projection}
                  small
                />
              ))}
            </>
          ) : null}
          {stroke && stroke.length > 1 ? (
            <path
              d={pathOf(projection, stroke)}
              fill="none"
              stroke={ink.fill}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={4}
            />
          ) : null}
          {editor.selected != null && editor.tool === 'select' ? (
            <SelectedHandles editor={editor} onEditor={onEditor} projection={projection} />
          ) : null}
        </g>
      )
    }
    default:
      return null
  }
}

/** Handles on the picked highlight, to nudge its points. */
function SelectedHandles({
  editor,
  onEditor,
  projection,
}: {
  editor: Extract<Editor, { kind: 'view' }>
  onEditor: (editor: Editor) => void
  projection: Projection
}) {
  const index = editor.selected!
  const drawing = editor.draft.drawings[index]
  if (!drawing) return null
  const ink = INK_COLOURS[drawing.ink].fill
  const update = (next: typeof drawing) =>
    onEditor({
      ...editor,
      draft: {
        ...editor.draft,
        drawings: editor.draft.drawings.map((d, i) => (i === index ? next : d)),
      },
    })
  if (drawing.kind === 'pin' || drawing.kind === 'text') {
    return (
      <Handle
        colour={ink}
        onDrag={(at) => update({ ...drawing, at })}
        point={drawing.at}
        projection={projection}
        small
      />
    )
  }
  // A stroke with many points gets a handle at each end and every few along; a line, one per point.
  const step = Math.max(1, Math.floor(drawing.points.length / 12))
  return (
    <>
      {drawing.points.map((point, i) =>
        i % step === 0 || i === drawing.points.length - 1 ? (
          <Handle
            colour={ink}
            key={i}
            onDrag={(next) =>
              update({ ...drawing, points: drawing.points.map((p, j) => (j === i ? next : p)) })
            }
            point={point}
            projection={projection}
            small
          />
        ) : null,
      )}
    </>
  )
}
