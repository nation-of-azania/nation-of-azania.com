/**
 * The globe's motions: small tweens stepped by its own frame loop
 * (./Globe.tsx), so nothing moves between the frames it draws and nothing
 * is drawn once everything has come to rest. Each tween has a name, and a
 * new one of the same name takes over from the old where it stands. A
 * tween's clock starts at the first frame it is stepped in, so a slow
 * first frame (the GPU warming to a shader) never swallows its start.
 */

export type Easing = (k: number) => number

export const ease = {
  linear: ((k) => k) as Easing,
  outCubic: ((k) => 1 - (1 - k) ** 3) as Easing,
  inOutCubic: ((k) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2)) as Easing,
}

/** Whether the reader has asked for less motion: a cut, or a short fade, instead of a movement. */
export const lessMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export type Tween = {
  ms: number
  /** How long after it's started the tween waits before its first step: the later parts of one motion, run as tweens of their own. */
  delay?: number
  ease?: Easing
  /** Called each frame with the eased share of the way, 0 to 1. */
  step: (k: number) => void
  /** Called once, after the last step. */
  done?: () => void
}

export type Motion = {
  /** Starts a tween by name, in place of any running under it. */
  run: (name: string, tween: Tween) => void
  /** Stops a tween where it stands, without its ending. */
  stop: (name: string) => void
  stopAll: () => void
  running: (name?: string) => boolean
  /** Steps every tween to `now`; true while any is still going. */
  step: (now: number) => boolean
}

export function createMotion(): Motion {
  const tweens = new Map<string, Tween & { start: number | null }>()
  return {
    run: (name, tween) => {
      tweens.set(name, { ...tween, start: null })
    },
    stop: (name) => {
      tweens.delete(name)
    },
    stopAll: () => tweens.clear(),
    running: (name) => (name ? tweens.has(name) : tweens.size > 0),
    step: (now) => {
      for (const [name, tween] of [...tweens]) {
        if (tweens.get(name) !== tween) continue
        if (tween.start === null) tween.start = now
        const elapsed = now - tween.start - (tween.delay ?? 0)
        if (elapsed < 0) continue
        const k = tween.ms > 0 ? Math.min(1, elapsed / tween.ms) : 1
        tween.step((tween.ease ?? ease.linear)(k))
        if (k >= 1 && tweens.get(name) === tween) {
          tweens.delete(name)
          tween.done?.()
        }
      }
      return tweens.size > 0
    },
  }
}

/** A number a share of the way between two others. */
export const mix = (a: number, b: number, k: number): number => a + (b - a) * k

/** Hermite's smooth step from `a` to `b`, as GLSL has it: 0 below, 1 above, easing in and out between. */
export const smoothstep = (a: number, b: number, x: number): number => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
