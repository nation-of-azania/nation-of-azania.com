'use client'

/*
 * How the marks' layer moves mid-zoom (./overlay.ts), element by element.
 * What's drawn there was drawn for one view; the map is shown at another,
 * the ground scaled by k and shifted. Each element is moved there on its
 * own, written each frame of a zoom as plain values and taken away again
 * once the layer is drawn for the view:
 *
 * - A mark or a name (layers/projection.ts → upright) is only shifted, to
 *   where its point has gone: it keeps its size because nothing over it
 *   is ever scaled. It used to be scaled back inside a group scaled with
 *   the ground, which looks the same, but Chromium lays out every text
 *   under a group whose scale changes, whatever undoes it below: with a
 *   couple of hundred names on the page, a pinch spent some 20 times as
 *   long laying text out, and dropped frames by the dozen.
 * - Anything else drawn there (a siege's line, the seams, the editor's
 *   lines) is scaled and shifted with the ground, its lines keeping their
 *   width on the page (maps.css); text set along a path too, its type held
 *   its size (`data-az-type`), and an editor's road its width as each zoom
 *   would draw it (`data-az-width`). An element's own transform, if it has
 *   one, is kept, after the move.
 *
 * Plain values rather than CSS reading a custom property, for the cost: a
 * property inherited down the overlay restyles every element in it each
 * frame, and a value with var() in it is parsed afresh each time it's read.
 */

/** A move of the layer's pixels: scaled by `k`, then shifted by (x, y). */
export type Move = { k: number; x: number; y: number }

/** The attributes the layers describe their elements by, and the transform an element may have of its own. */
const ATTRIBUTES = ['data-az-at', 'data-az-width', 'data-az-dash', 'data-az-type', 'data-az-hatch', 'transform']

/** What one element asks for, read once from its attributes, with its own transform as a matrix (null for none). */
type Own = DOMMatrix | null
type Item =
  | { kind: 'at'; element: SVGElement; own: Own; ax: number; ay: number }
  | { kind: 'ground'; element: SVGElement; own: Own }
  | { kind: 'width'; element: SVGElement; own: Own; width: number[]; dash: number[] | null }
  | { kind: 'type'; element: SVGElement; own: Own; type: number[] }
  | { kind: 'hatch'; element: SVGElement; turn: number }

const numbers = (value: string | null): number[] => (value ? value.split(' ').map(Number) : [])

/** An element's own transform attribute as one matrix, or null. */
function ownOf(element: SVGElement): Own {
  const list = (element as SVGGraphicsElement).transform?.baseVal
  if (!list?.numberOfItems) return null
  let matrix = new DOMMatrix()
  for (let i = 0; i < list.numberOfItems; i++) matrix = matrix.multiply(DOMMatrix.fromMatrix(list.getItem(i).matrix))
  return matrix
}

/** Elements that draw nothing themselves, or draw only where they're used; never moved. */
const UNDRAWN = new Set(['title', 'desc', 'style', 'linearGradient', 'radialGradient', 'clipPath', 'mask', 'marker', 'symbol', 'filter'])

/**
 * Everything under `root` that moves: its marks and names, and whatever
 * else it draws. Groups are gone through, not moved, so a mark in one is
 * moved on its own; a group with a transform of its own is moved whole.
 */
function collect(root: Element): Item[] {
  const items: Item[] = []
  const visit = (parent: Element) => {
    for (const child of parent.children) {
      const element = child as SVGElement
      const tag = element.localName
      if (UNDRAWN.has(tag)) continue
      if (tag === 'defs' || tag === 'pattern') {
        // Drawn where it's used; a hatching's pattern keeps its spacing (TownsLayer).
        for (const pattern of element.matches('pattern') ? [element] : element.querySelectorAll<SVGElement>('pattern')) {
          const hatch = pattern.getAttribute('data-az-hatch')
          if (hatch) items.push({ kind: 'hatch', element: pattern, turn: Number(hatch) })
        }
        continue
      }
      const own = ownOf(element)
      const at = element.getAttribute('data-az-at')
      if (at) {
        const [ax, ay] = numbers(at)
        items.push({ kind: 'at', element, own, ax, ay })
        continue
      }
      const width = element.getAttribute('data-az-width')
      if (width) {
        const dash = element.getAttribute('data-az-dash')
        items.push({ kind: 'width', element, own, width: numbers(width), dash: dash ? numbers(dash) : null })
        continue
      }
      const type = element.getAttribute('data-az-type')
      if (type) {
        items.push({ kind: 'type', element, own, type: numbers(type) })
        continue
      }
      if ((tag === 'g' || tag === 'a') && !own) visit(element)
      else items.push({ kind: 'ground', element, own })
    }
  }
  visit(root)
  return items
}

const css = (m: DOMMatrix) => `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.e}, ${m.f})`

/** The move, then the element's own transform. */
function moved(move: Move, own: Own): string {
  const { k, x, y } = move
  if (!own) return `matrix(${k}, 0, 0, ${k}, ${x}, ${y})`
  return css(new DOMMatrix([k, 0, 0, k, x, y]).multiply(own))
}

/** Sets one element right for the layer moved by `move`, or back as drawn when it isn't. */
function write(item: Item, move: Move, rest: boolean): void {
  const style = item.element.style
  const { k, x, y } = move
  switch (item.kind) {
    case 'at': {
      // Shifted to where its point has gone, never scaled.
      if (rest) {
        style.removeProperty('transform')
        return
      }
      const dx = (k - 1) * item.ax + x
      const dy = (k - 1) * item.ay + y
      style.transform = item.own
        ? css(new DOMMatrix([1, 0, 0, 1, dx, dy]).multiply(item.own))
        : `translate(${dx}px, ${dy}px)`
      return
    }
    case 'ground':
      if (rest) style.removeProperty('transform')
      else style.transform = moved(move, item.own)
      return
    case 'width': {
      // The line keeps its width on the page (maps.css), so this is in the page's px: a road's, as this zoom would draw it.
      if (rest) {
        style.removeProperty('transform')
        style.removeProperty('stroke-width')
        style.removeProperty('stroke-dasharray')
        return
      }
      style.transform = moved(move, item.own)
      const [min, base, max, times, plus, least] = item.width
      const w = Math.min(max, Math.max(min, base * k))
      style.strokeWidth = `${Math.max(least, times * w + plus)}px`
      if (item.dash) style.strokeDasharray = item.dash.map((n) => `${n * w}px`).join(' ')
      return
    }
    case 'type': {
      if (rest) {
        style.removeProperty('transform')
        style.removeProperty('font-size')
        style.removeProperty('letter-spacing')
        style.removeProperty('stroke-width')
        return
      }
      style.transform = moved(move, item.own)
      const [size, tracking, halo] = item.type
      style.fontSize = `${size / k}px`
      style.letterSpacing = `${tracking / k}px`
      style.strokeWidth = `${halo / k}px`
      return
    }
    case 'hatch':
      // A pattern's own transform, where the browser takes one from CSS; elsewhere the hatching scales with the ground.
      if (rest || k === 1) style.removeProperty('transform')
      else style.transform = `rotate(${item.turn}deg) scale(${1 / k})`
      return
  }
}

export type Steady = {
  /** The layer is shown moved by `move` from the view it was drawn for (none: drawn for the view). */
  apply: (move: Move) => void
  disconnect: () => void
}

const STILL: Move = { k: 1, x: 0, y: 0 }
const isStill = (move: Move) => move.k === 1 && move.x === 0 && move.y === 0

/** Moves everything under `root` as the map is shown, element by element. */
export function createSteady(root: SVGGElement): Steady {
  let move = STILL
  let items: Item[] | null = null
  const writeAll = () => {
    items ??= collect(root)
    const rest = isStill(move)
    for (const item of items) write(item, move, rest)
  }
  // React draws into the layer when it likes; anything it adds or changes mid-zoom is set right before it's painted.
  const observer = new MutationObserver(() => {
    items = null
    if (!isStill(move)) writeAll()
  })
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  })
  return {
    apply: (next) => {
      if (next.k === move.k && next.x === move.x && next.y === move.y) return
      move = next
      writeAll()
    },
    disconnect: () => observer.disconnect(),
  }
}
