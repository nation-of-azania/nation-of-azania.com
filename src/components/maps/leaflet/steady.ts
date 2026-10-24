'use client'

/*
 * What keeps the overlay's marks, names and lines their size on the page
 * while the overlay is scaled mid-zoom (layers/projection.ts says which
 * and how, in data attributes): written each frame of a zoom as plain
 * values — a transform, a width, a type size — on just the elements that
 * ask for one, and taken away again once the overlay is drawn for the
 * view, when it isn't scaled at all. Plain values rather than CSS reading
 * a custom property, for the cost: a property inherited down the overlay
 * restyles every element in it each frame, and a value with var() in it
 * is parsed afresh each time it's read. Measured on a phone's CPU, these
 * writes cost about a quarter as much.
 */

/** The attributes the layers describe their steady elements by. */
const ATTRIBUTES = ['data-az-at', 'data-az-width', 'data-az-dash', 'data-az-type', 'data-az-hatch']
const SELECTOR = '[data-az-at],[data-az-width],[data-az-type],[data-az-hatch]'

/** What one element asks for, read once from its attributes. */
type Item =
  | { kind: 'at'; element: SVGElement; ax: number; ay: number }
  | { kind: 'width'; element: SVGElement; width: number[]; dash: number[] | null }
  | { kind: 'type'; element: SVGElement; type: number[] }
  | { kind: 'hatch'; element: SVGElement; turn: number }

const numbers = (value: string | null): number[] => (value ? value.split(' ').map(Number) : [])

function itemOf(element: SVGElement): Item | null {
  const at = element.getAttribute('data-az-at')
  if (at) {
    const [ax, ay] = numbers(at)
    return { kind: 'at', element, ax, ay }
  }
  const width = element.getAttribute('data-az-width')
  if (width) {
    const dash = element.getAttribute('data-az-dash')
    return { kind: 'width', element, width: numbers(width), dash: dash ? numbers(dash) : null }
  }
  const type = element.getAttribute('data-az-type')
  if (type) return { kind: 'type', element, type: numbers(type) }
  const hatch = element.getAttribute('data-az-hatch')
  if (hatch) return { kind: 'hatch', element, turn: Number(hatch) }
  return null
}

/** Sets one element right for the overlay scaled by `k`, or back as drawn at 1. */
function write(item: Item, k: number): void {
  const style = item.element.style
  const rest = k === 1
  switch (item.kind) {
    case 'at': {
      // Scaled back about its point: the point stays where the overlay puts it, the rest keeps its size.
      const s = 1 / k
      if (rest) style.removeProperty('transform')
      else style.transform = `matrix(${s}, 0, 0, ${s}, ${item.ax * (1 - s)}, ${item.ay * (1 - s)})`
      return
    }
    case 'width': {
      // The line keeps its width on the page (maps.css), so this is in the page's px: a road's, as this zoom would draw it.
      if (rest) {
        style.removeProperty('stroke-width')
        style.removeProperty('stroke-dasharray')
        return
      }
      const [min, base, max, times, plus, least] = item.width
      const w = Math.min(max, Math.max(min, base * k))
      style.strokeWidth = `${Math.max(least, times * w + plus)}px`
      if (item.dash) style.strokeDasharray = item.dash.map((n) => `${n * w}px`).join(' ')
      return
    }
    case 'type': {
      if (rest) {
        style.removeProperty('font-size')
        style.removeProperty('letter-spacing')
        style.removeProperty('stroke-width')
        return
      }
      const [size, tracking, halo] = item.type
      style.fontSize = `${size / k}px`
      style.letterSpacing = `${tracking / k}px`
      style.strokeWidth = `${halo / k}px`
      return
    }
    case 'hatch':
      // A pattern's own transform, where the browser takes one from CSS; elsewhere the hatching scales with the ground.
      if (rest) style.removeProperty('transform')
      else style.transform = `rotate(${item.turn}deg) scale(${1 / k})`
      return
  }
}

export type Steady = {
  /** The overlay is scaled by `k` (1 when drawn for the view). */
  apply: (k: number) => void
  disconnect: () => void
}

/** Keeps the steady elements under `root` right as it's scaled. */
export function createSteady(root: SVGGElement): Steady {
  let k = 1
  let items: Item[] | null = null
  const writeAll = () => {
    items ??= [...root.querySelectorAll<SVGElement>(SELECTOR)].flatMap(
      (element) => itemOf(element) ?? [],
    )
    for (const item of items) write(item, k)
  }
  // React draws into the overlay when it likes; anything it adds or changes mid-zoom is set right before it's painted.
  const observer = new MutationObserver(() => {
    items = null
    if (k !== 1) writeAll()
  })
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  })
  return {
    apply: (next) => {
      if (next === k) return
      k = next
      writeAll()
    },
    disconnect: () => observer.disconnect(),
  }
}
