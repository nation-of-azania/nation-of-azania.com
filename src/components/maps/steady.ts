'use client'

/**
 * A timeout that keeps time in a tab out of sight. A browser stretches a
 * hidden page's timers (Chrome to once a second at once, and to once a
 * minute after five minutes), and a window it judges covered, behind the
 * game or minimised, counts as hidden. The live feeds (./live.ts,
 * ./war.ts) go on while the map is out of sight, for whoever glances back
 * at it or shares it in a call, so they keep their time in a small worker,
 * whose timers a browser leaves alone; where no worker can be made, a
 * plain timeout does.
 */

type Pending = Map<number, () => void>

let worker: Worker | null | undefined
const pending: Pending = new Map()
let next = 1

const WORKER = `
const timers = {}
onmessage = (event) => {
  const { id, ms } = event.data
  if (ms < 0) { clearTimeout(timers[id]); delete timers[id]; return }
  timers[id] = setTimeout(() => { delete timers[id]; postMessage(id) }, ms)
}
`

function workerOf(): Worker | null {
  if (worker !== undefined) return worker
  try {
    const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }))
    worker = new Worker(url)
    worker.onmessage = (event: MessageEvent<number>) => {
      const callback = pending.get(event.data)
      pending.delete(event.data)
      callback?.()
    }
  } catch {
    worker = null
  }
  return worker
}

/** Calls `callback` after `ms`, hidden tab or not; the function returned cancels it. */
export function steadyTimeout(callback: () => void, ms: number): () => void {
  const clock = workerOf()
  if (!clock) {
    const timer = window.setTimeout(callback, ms)
    return () => window.clearTimeout(timer)
  }
  const id = next++
  pending.set(id, callback)
  clock.postMessage({ id, ms })
  return () => {
    if (!pending.delete(id)) return
    clock.postMessage({ id, ms: -1 })
  }
}

/**
 * How long the feeds go on in a tab out of sight before they rest: long
 * enough for a battle session watched from behind the game, short enough
 * that a tab forgotten overnight doesn't ask all night. Back in sight, they
 * ask again at once.
 */
export const HIDDEN_FOR_MS = 30 * 60 * 1000
