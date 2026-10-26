/*
 * Tweens for the names' hand-over (./names.ts): a value on its way from one
 * number to another over a stretch of time, eased as CSS eases, read off by
 * the clock. Pure arithmetic, no DOM, so it runs in Node for the tests
 * (scripts/test-names.ts) as it runs in the browser.
 */

/** An easing: progress in time (0 to 1) to progress in value (0 to 1). */
export type Ease = (p: number) => number

/** How many points of the curve a bezier easing keeps; between them it reads straight lines. */
const STEPS = 64

/**
 * A cubic bezier easing as CSS has it, `cubic-bezier(x1, y1, x2, y2)`, as a
 * table of 64 points read back with straight lines between them. The error
 * against the exact curve is under 0.002 for the easings the map uses,
 * which is far below anything a frame could show, and a read costs a
 * multiply and an add rather than a root found by iteration.
 */
export function bezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t
  const table = new Float64Array(STEPS)
  for (let i = 1; i < STEPS - 1; i++) {
    const x = i / (STEPS - 1)
    // x grows with t while the control points stay in [0, 1], so a bisection finds the t for x.
    let low = 0
    let high = 1
    for (let step = 0; step < 48; step++) {
      const mid = (low + high) / 2
      if (at(x1, x2, mid) < x) low = mid
      else high = mid
    }
    table[i] = at(y1, y2, (low + high) / 2)
  }
  table[0] = 0
  table[STEPS - 1] = 1
  return (p) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    const scaled = p * (STEPS - 1)
    const i = Math.floor(scaled)
    return table[i] + (table[i + 1] - table[i]) * (scaled - i)
  }
}

/** A glide's ease: off smartly, easing in to land, `cubic-bezier(0.2, 0, 0, 1)`. */
export const GLIDE_EASE = bezier(0.2, 0, 0, 1)

/** CSS's own `ease-out`, `cubic-bezier(0, 0, 0.58, 1)`: for fades. */
export const EASE_OUT = bezier(0, 0, 0.58, 1)

/** A value on its way: from `from` to `to`, setting off `delay` ms after `start` and taking `duration` ms. */
export type Tween = {
  from: number
  to: number
  start: number
  duration: number
  delay: number
  ease: Ease
}

/** The tween's value at `now`: `from` until it sets off, `to` once it has landed, eased between. */
export function valueAt(tween: Tween, now: number): number {
  const elapsed = now - tween.start - tween.delay
  if (elapsed >= tween.duration) return tween.to
  if (elapsed <= 0) return tween.from
  return tween.from + (tween.to - tween.from) * tween.ease(elapsed / tween.duration)
}

/** Whether the tween has landed by `now`. */
export const done = (tween: Tween, now: number): boolean => now >= tween.start + tween.delay + tween.duration
