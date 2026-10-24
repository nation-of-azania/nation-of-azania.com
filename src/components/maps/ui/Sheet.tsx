'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'

export type SheetState = 'peek' | 'half' | 'full'

const HEIGHTS: Record<SheetState, string> = {
  peek: '4.75rem',
  half: '50vh',
  full: 'calc(100vh - 4.5rem)',
}

/**
 * The panel on a phone: a sheet drawn up from the foot of the screen, with
 * a handle to pull. Three resting heights — a peek that leaves the map
 * free, half, and nearly all — reached by dragging the handle, tapping it,
 * or the keyboard (the handle is a button). The sheet's body scrolls on
 * its own once it's up.
 */
export function Sheet({
  state,
  onState,
  handle,
  page,
  children,
  className,
}: {
  state: SheetState
  onState: (state: SheetState) => void
  /** The peek line: what the sheet holds, in one line. */
  handle: ReactNode
  /** Which page the sheet holds: another one opens at its top, not where the last was scrolled to. */
  page?: string
  children: ReactNode
  className?: string
}) {
  const [dragging, setDragging] = useState<{
    startY: number
    startHeight: number
    height: number
  } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state !== 'peek' && sheetRef.current) sheetRef.current.scrollTop = 0
  }, [state, page])

  const onPointerDown = (event: React.PointerEvent) => {
    const height = sheetRef.current?.parentElement?.getBoundingClientRect().height ?? 0
    setDragging({ startY: event.clientY, startHeight: height, height })
    ;(event.target as Element).setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return
    const height = Math.max(60, dragging.startHeight + (dragging.startY - event.clientY))
    setDragging({ ...dragging, height })
  }
  const onPointerUp = () => {
    if (!dragging) return
    const moved = dragging.height - dragging.startHeight
    const viewport = window.innerHeight
    if (Math.abs(moved) < 12) {
      // A tap: step up, or back down from the top.
      onState(state === 'peek' ? 'half' : state === 'half' ? 'full' : 'peek')
    } else {
      const ratio = dragging.height / viewport
      onState(ratio < 0.3 ? 'peek' : ratio < 0.72 ? 'half' : 'full')
    }
    setDragging(null)
  }

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex flex-col border-t border-sand-300 bg-sand-50 shadow-[0_-8px_24px_rgba(22,25,31,0.16)]',
        !dragging && 'transition-[height] duration-300 ease-out motion-reduce:transition-none',
        className,
      )}
      style={{ height: dragging ? `${dragging.height}px` : HEIGHTS[state] }}
    >
      <button
        aria-expanded={state !== 'peek'}
        aria-label={
          state === 'peek'
            ? 'Open the panel'
            : state === 'half'
              ? 'Open the panel fully'
              : 'Close the panel'
        }
        className="flex w-full shrink-0 touch-none flex-col items-center px-4 pb-2 pt-2 text-left focus-visible:outline-saffron-500"
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp') onState(state === 'peek' ? 'half' : 'full')
          if (event.key === 'ArrowDown') onState(state === 'full' ? 'half' : 'peek')
        }}
        onPointerCancel={() => setDragging(null)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        type="button"
      >
        <span aria-hidden="true" className="mb-2 h-1 w-10 rounded-full bg-sand-300" />
        <span className="flex w-full items-center">{handle}</span>
      </button>
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto overscroll-contain',
          state === 'peek' && 'overflow-hidden',
        )}
        ref={sheetRef}
      >
        {children}
      </div>
    </div>
  )
}
