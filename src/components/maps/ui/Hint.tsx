'use client'

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/blocks/components/shared'

import { Icon } from './icons'

/**
 * The map's one way of saying more than fits on the page: a hint, a few
 * words on a dark plate beside whatever they're about, there when wanted
 * and gone when not. What something means, how a figure is worked out,
 * where the data comes from, what a setting does: all of that lives in
 * hints, so the panels show the facts and little else.
 *
 * A hint shows once the mouse has rested still over its thing for a
 * moment (a pass across it opens nothing), at once when the thing is
 * focused from the keyboard, and on a touch screen after a finger holds
 * on it, or, for a mark that is only there to be asked (`HintMark`, the
 * small ⓘ), on a tap. It closes when the pointer leaves, on Escape, on a
 * scroll, on a tap anywhere else, or when the thing is clicked, since a
 * click means the reader is past reading. It never takes the pointer, so
 * nothing under it is harder to click, and it stays within the window:
 * above its thing where there's room, else below, never off the edge.
 *
 * The words are in the page for a screen reader whether or not the plate
 * shows (`aria-describedby` to a hidden copy), so the hint is read with
 * its thing. The plate is the same in the light panels, the dark war
 * sidebar and over the map: ink under sand, with a hairline, as the
 * players' name tags are.
 */

/** How long the mouse rests still over something before its hint shows. */
const DWELL_MS = 450
/** How long a finger holds on something before its hint shows. */
const PRESS_MS = 420
/** The plate keeps this far from the window's edge, and from its thing. */
const MARGIN = 8
const GAP = 7

type How = 'hover' | 'focus' | 'press' | 'tap'

type Handlers = {
  onPointerEnter?: (event: PointerEvent<HTMLElement>) => void
  onPointerMove?: (event: PointerEvent<HTMLElement>) => void
  onPointerLeave?: (event: PointerEvent<HTMLElement>) => void
  onPointerDown?: (event: PointerEvent<HTMLElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLElement>) => void
  onPointerCancel?: (event: PointerEvent<HTMLElement>) => void
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onBlur?: (event: FocusEvent<HTMLElement>) => void
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void
  'aria-describedby'?: string
}

export function Hint({
  text,
  children,
  toggle = false,
  described = true,
}: {
  /** The hint's words: a sentence or two, with a `<strong>` or a `<code>` where it helps. */
  text: ReactNode
  /** The thing the hint is about: one element, which takes the hint's listeners and `aria-describedby`. */
  children: ReactElement<Handlers>
  /** A tap or a click on the thing opens and closes the hint, for a thing that does nothing else (the ⓘ mark). */
  toggle?: boolean
  /** Whether the words are given to a screen reader with the thing: not when they're its name already (an icon button's). */
  described?: boolean
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const how = useRef<How | null>(null)
  const anchor = useRef<HTMLElement | null>(null)
  const plate = useRef<HTMLSpanElement>(null)
  const timer = useRef<number | undefined>(undefined)
  // A long press just opened the hint: the click that follows the press is no tap.
  const pressed = useRef(false)

  const clear = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = undefined
  }, [])
  const show = useCallback((element: HTMLElement, by: How) => {
    anchor.current = element
    how.current = by
    setOpen(true)
  }, [])
  const hide = useCallback(() => {
    clear()
    how.current = null
    setOpen(false)
  }, [clear])

  // While the plate shows: Escape (taken here, so the popovers and the map keep theirs), a scroll, a resize or a
  // press anywhere but on the thing itself closes it.
  useEffect(() => {
    if (!open) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      hide()
    }
    const onDown = (event: globalThis.PointerEvent) => {
      if (anchor.current?.contains(event.target as Node)) return
      hide()
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('resize', hide)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, hide])

  useEffect(() => clear, [clear])

  // The plate beside its thing, set in place before it's painted: above, centred, where there's room; else below;
  // never off the window's edge. Written to the plate itself, since nothing else need render for it.
  useLayoutEffect(() => {
    const element = anchor.current
    const bubble = plate.current
    if (!open || !element || !bubble) return
    const at = element.getBoundingClientRect()
    const width = bubble.offsetWidth
    const height = bubble.offsetHeight
    const left = Math.min(Math.max(MARGIN, at.left + at.width / 2 - width / 2), window.innerWidth - width - MARGIN)
    const above = at.top - height - GAP
    const side = above >= MARGIN ? 'above' : 'below'
    const top = side === 'above' ? above : Math.min(at.bottom + GAP, window.innerHeight - height - MARGIN)
    const nib = Math.min(Math.max(12, at.left + at.width / 2 - left), width - 12)
    bubble.style.left = `${left}px`
    bubble.style.top = `${top}px`
    bubble.style.setProperty('--az-nib', `${nib}px`)
    bubble.dataset.side = side
  }, [open, text])

  if (!isValidElement(children)) return children
  const theirs = children.props
  // The thing's own listeners run first, then the hint's.
  const listeners: Handlers = {
    // The thing is taken from the event at once: React lets go of `currentTarget` once a handler returns.
    onPointerEnter: (event) => {
      theirs.onPointerEnter?.(event)
      if (event.pointerType !== 'mouse' || open) return
      const thing = event.currentTarget
      clear()
      timer.current = window.setTimeout(() => show(thing, 'hover'), DWELL_MS)
    },
    onPointerMove: (event) => {
      theirs.onPointerMove?.(event)
      // The mouse must rest: each move starts the wait again.
      if (event.pointerType !== 'mouse' || open) return
      const thing = event.currentTarget
      clear()
      timer.current = window.setTimeout(() => show(thing, 'hover'), DWELL_MS)
    },
    onPointerLeave: (event) => {
      theirs.onPointerLeave?.(event)
      if (event.pointerType !== 'mouse') return
      clear()
      if (how.current === 'hover') hide()
    },
    onPointerDown: (event) => {
      theirs.onPointerDown?.(event)
      if (event.pointerType === 'mouse') {
        // A click is past reading: the plate goes, unless the thing is the mark, whose click decides.
        clear()
        if (!toggle) hide()
        return
      }
      const thing = event.currentTarget
      clear()
      pressed.current = false
      timer.current = window.setTimeout(() => {
        pressed.current = true
        show(thing, 'press')
      }, PRESS_MS)
    },
    onPointerUp: (event) => {
      theirs.onPointerUp?.(event)
      clear()
    },
    onPointerCancel: (event) => {
      theirs.onPointerCancel?.(event)
      clear()
    },
    onContextMenu: (event) => {
      theirs.onContextMenu?.(event)
      // A finger held on the thing is asking for the hint, not the browser's menu.
      if (pressed.current || timer.current !== undefined) event.preventDefault()
    },
    onClick: (event) => {
      theirs.onClick?.(event)
      if (pressed.current) {
        // The click that ends a long press: the plate stays.
        pressed.current = false
        how.current = 'tap'
        return
      }
      if (!toggle) return hide()
      if (open && how.current !== 'hover') hide()
      else show(event.currentTarget, 'tap')
    },
    onFocus: (event) => {
      theirs.onFocus?.(event)
      // From the keyboard, at once; a click's focus opens nothing of itself.
      if (event.currentTarget.matches(':focus-visible')) show(event.currentTarget, 'focus')
    },
    onBlur: (event) => {
      theirs.onBlur?.(event)
      hide()
    },
    ...(described ? { 'aria-describedby': theirs['aria-describedby'] ? `${theirs['aria-describedby']} ${id}` : id } : {}),
  }

  return (
    <>
      {/* The listeners read the refs only when they run, as any handler does; the lint can't see that through cloneElement. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {cloneElement(children, listeners)}
      {described ? (
        <span className="sr-only" id={id}>
          {text}
        </span>
      ) : null}
      {open
        ? createPortal(
            <span aria-hidden="true" className="az-hint" data-side="above" ref={plate} style={{ left: -9999, top: -9999 }}>
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  )
}

/**
 * The small ⓘ that carries a hint where nothing else would: beside a
 * heading, a label or a figure. It is only there to be asked, so a tap
 * on it opens the hint as a hover does, and it takes the keyboard (Enter
 * or Space). Set in the colour of the text about it, quietly, until it's
 * wanted. A span playing a button rather than a button: it may stand in
 * a form's `<label>`, where a real button would become the label's
 * control, and its click is kept from reaching the label.
 */
export function HintMark({
  text,
  label = 'More about this',
  className,
}: {
  text: ReactNode
  /** What the mark is called, for a screen reader; the hint itself is read after it. */
  label?: string
  className?: string
}) {
  return (
    <Hint text={text} toggle>
      <span
        aria-label={label}
        className={cn('az-hint-mark', className)}
        onClick={(event) => event.preventDefault()}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          event.currentTarget.click()
        }}
        role="button"
        tabIndex={0}
      >
        <Icon className="h-[14px] w-[14px]" name="info" />
      </span>
    </Hint>
  )
}
