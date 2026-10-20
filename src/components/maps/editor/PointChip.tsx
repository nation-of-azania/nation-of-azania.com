'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import type { Point } from '@/maps/geo'

import type { EditorUpdate } from '../context'
import { useLatest } from '../hooks'
import { L, toLatLng, useLeaflet } from '../leaflet/canvas'
import type { Editor } from '../state'
import { Icon, type IconName } from '../ui/icons'
import { removePoint } from './points'
import { reversed, withCornerToggled, withoutPointAt } from './road'

/** What can be done with the picked point, worked out from the editor. */
type Picked = {
  point: Point
  /** Absent when the line can spare no more points. */
  remove?: () => void
  corner?: { on: boolean; toggle: () => void }
  /** Carry on drawing from this end of the line. */
  carryOn?: () => void
  unpick: () => void
}

function pickedOf(editor: Editor, onEditor: (update: EditorUpdate) => void): Picked | null {
  switch (editor.kind) {
    case 'road': {
      const { draft, vertex } = editor
      if (vertex == null || !draft.line[vertex] || editor.drawing) return null
      const last = draft.line.length - 1
      const inner = vertex >= 1 && vertex <= last - 1
      return {
        point: draft.line[vertex],
        remove:
          draft.line.length > 2
            ? () => onEditor({ ...editor, vertex: null, draft: withoutPointAt(draft, vertex) })
            : undefined,
        corner:
          draft.shape === 'curved' && inner
            ? {
                on: draft.corners.includes(vertex),
                toggle: () => onEditor({ ...editor, draft: withCornerToggled(draft, vertex) }),
              }
            : undefined,
        carryOn:
          (vertex === 0 || vertex === last) && draft.line.length >= 2
            ? () =>
                onEditor({
                  ...editor,
                  vertex: null,
                  drawing: true,
                  // From what was the start, the road is run the other way first.
                  draft: vertex === 0 ? reversed(draft) : draft,
                })
            : undefined,
        unpick: () => onEditor({ ...editor, vertex: null }),
      }
    }
    case 'place': {
      const { draft, vertex } = editor
      if (vertex == null || !draft.outline[vertex] || editor.tracing || editor.placing) return null
      return {
        point: draft.outline[vertex],
        remove:
          draft.outline.length > 3
            ? () =>
                onEditor({
                  ...editor,
                  vertex: null,
                  draft: { ...draft, outline: removePoint(draft.outline, vertex) },
                })
            : undefined,
        unpick: () => onEditor({ ...editor, vertex: null }),
      }
    }
    case 'view': {
      const { draft, selected, vertex } = editor
      const drawing = selected != null ? draft.drawings[selected] : null
      if (
        vertex == null ||
        editor.tool !== 'select' ||
        !drawing ||
        (drawing.kind !== 'line' && drawing.kind !== 'area') ||
        !drawing.points[vertex]
      )
        return null
      const least = drawing.kind === 'line' ? 2 : 3
      return {
        point: drawing.points[vertex],
        remove:
          drawing.points.length > least
            ? () =>
                onEditor({
                  ...editor,
                  vertex: null,
                  draft: {
                    ...draft,
                    drawings: draft.drawings.map((d, i) =>
                      i === selected ? { ...drawing, points: removePoint(drawing.points, vertex) } : d,
                    ),
                  },
                })
            : undefined,
        unpick: () => onEditor({ ...editor, vertex: null }),
      }
    }
    default:
      return null
  }
}

function ChipButton({
  icon,
  label,
  children,
  pressed,
  disabled,
  title,
  onClick,
}: {
  icon: IconName
  label?: string
  children?: ReactNode
  pressed?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 px-2.5 text-[12px] font-semibold tracking-wide text-sea-900 transition-colors hover:bg-sand-100 focus-visible:outline-saffron-500 disabled:cursor-not-allowed disabled:opacity-40',
        pressed && 'bg-sea-800 text-sand-50 hover:bg-sea-700',
      )}
      disabled={disabled}
      onClick={onClick}
      title={title ?? label}
      type="button"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" name={icon} />
      {children}
    </button>
  )
}

/**
 * A small chip beside the point just picked on the map, with what can be
 * done to it right there — remove it, make it a sharp corner (a curved
 * road), carry on drawing from it (an end) — rather than buttons away in
 * the panel. Ordinary DOM over the map, kept in place as the map moves
 * and hidden while it zooms, since it would lag the zoom's animation.
 */
export function PointChip({
  editor,
  onEditor,
}: {
  editor: Editor
  onEditor: (update: EditorUpdate) => void
}) {
  const { map } = useLeaflet()
  const ref = useRef<HTMLDivElement>(null)
  const picked = pickedOf(editor, onEditor)
  const point = useLatest(picked?.point ?? null)

  // Where the chip sits: to the point's right, else its left, else (a phone) below it.
  const place = () => {
    const element = ref.current
    const at = point.current
    if (!element || !at) return
    const p = map.latLngToContainerPoint(toLatLng(at))
    const size = map.getSize()
    const width = element.offsetWidth
    const margin = 8
    const gap = 18
    if (p.x + gap + width <= size.x - margin) {
      element.dataset.side = 'right'
      element.style.transform = `translate(${p.x + gap}px, ${p.y}px) translateY(-50%)`
    } else if (p.x - gap - width >= margin) {
      element.dataset.side = 'left'
      element.style.transform = `translate(${p.x - gap - width}px, ${p.y}px) translateY(-50%)`
    } else {
      element.dataset.side = 'below'
      const x = Math.min(Math.max(p.x - width / 2, margin), size.x - width - margin)
      element.style.setProperty('--az-nib', `${p.x - x}px`)
      element.style.transform = `translate(${x}px, ${p.y + gap}px)`
    }
  }
  const placeRef = useLatest(place)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    L.DomEvent.disableClickPropagation(element)
    L.DomEvent.disableScrollPropagation(element)
    const follow = () => placeRef.current()
    const hide = () => {
      element.style.visibility = 'hidden'
    }
    const show = () => {
      element.style.visibility = ''
      placeRef.current()
    }
    map.on('move zoom', follow)
    map.on('zoomstart', hide)
    map.on('zoomend', show)
    return () => {
      map.off('move zoom', follow)
      map.off('zoomstart', hide)
      map.off('zoomend', show)
    }
  }, [map, placeRef])

  // The point moved (dragged), or another was picked.
  useEffect(() => {
    place()
  })

  if (!picked) return null
  return (
    <div
      aria-label="The picked point"
      className="az-chip pointer-events-auto absolute left-0 top-0 z-[500] flex items-stretch divide-x divide-sand-300 border border-sand-300 bg-sand-50 shadow-[0_2px_8px_rgba(22,25,31,0.18)]"
      data-side="right"
      ref={ref}
      role="toolbar"
    >
      <ChipButton
        disabled={!picked.remove}
        icon="trash"
        onClick={picked.remove}
        title={picked.remove ? 'Remove this point (Delete)' : 'The line can’t spare this point'}
      >
        Remove
      </ChipButton>
      {picked.corner ? (
        <ChipButton
          icon="corner"
          onClick={picked.corner.toggle}
          pressed={picked.corner.on}
          title={
            picked.corner.on
              ? 'A sharp corner: click to let the bends flow through again'
              : 'Turn sharply here, as at a junction (or alt-click the point)'
          }
        >
          Sharp corner
        </ChipButton>
      ) : null}
      {picked.carryOn ? (
        <ChipButton
          icon="pen"
          onClick={picked.carryOn}
          title="Carry on drawing from this end: click along the map, Enter to finish"
        >
          Continue from here
        </ChipButton>
      ) : null}
      <ChipButton icon="close" label="Done with this point" onClick={picked.unpick} />
    </div>
  )
}
