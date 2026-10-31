'use client'

import { useEffect, useRef, useState } from 'react'

import { readingOf, type BattleReading } from '@/maps/battle'
import { CAPITAL_WAR_RADIUS, WAR_EVERY_S, WAR_LIVE_EVERY_S, type Siege, type War } from '@/maps/world'

import { HIDDEN_FOR_MS, steadyTimeout } from './steady'

/**
 * The war, as the map in the browser has it: /maps/war, asked for as soon
 * as the page is here (it's a few kilobytes) and again every three minutes,
 * as the CDN refreshes it, in sight or, for a while, out of it
 * (./steady.ts). In
 * the war view while a battle is on (`live`), /maps/war/live every half
 * minute instead. A siege is shown whenever there is one, so there's no
 * layer to switch: the map always asks. While the Rulercraft map isn't
 * answering, or the browser is offline, the last sieges known stay on the
 * map, said to be as of then: those shown already, or those the site last
 * saved (src/lib/snapshot.ts). Always a bare path, which every viewer
 * shares at the CDN.
 *
 * Each battle's readings are kept as they come, for this session of it
 * only (src/maps/battle.ts): who took the banner from whom, and how fast
 * the points really rise, which the marker doesn't say.
 */

export type WarState = {
  sieges: Siege[]
  capitals: War['capitals']
  radius: number
  /** When the Rulercraft map last wrote what's shown, in ms since the epoch; 0 until the first answer. */
  at: number
  /** 'asking' until the first answer; 'down' while the map or the connection isn't answering (what's shown is the last known). */
  status: 'asking' | 'live' | 'down'
  /** Each battle's readings this session, oldest first, by the besieged town's id. */
  readings: Record<string, BattleReading[]>
}

const NONE: WarState = { sieges: [], capitals: [], radius: CAPITAL_WAR_RADIUS, at: 0, status: 'asking', readings: {} }

/** Readings kept per battle: a session read every half minute is 120. */
const MOST_READINGS = 150

const isWar = (body: unknown): body is War => {
  const war = body as War
  return Boolean(war) && Array.isArray(war.sieges) && Array.isArray(war.capitals)
}

/**
 * The readings with this answer's added: one per battle on, once per time
 * the map wrote it; a battle's start over when its session has (the points
 * fell, or more time is left than before), and dropped when it's over.
 */
function withReadings(readings: Record<string, BattleReading[]>, war: War): Record<string, BattleReading[]> {
  const next: Record<string, BattleReading[]> = {}
  for (const siege of war.sieges) {
    if (!siege.battle) continue
    const reading = readingOf(siege, war.at)
    const kept = readings[siege.townId] ?? []
    const last = kept.at(-1)
    if (last && last.at === reading.at) {
      next[siege.townId] = kept
      continue
    }
    const anew =
      last &&
      ((reading.points && last.points && reading.points.attacker + reading.points.defender < last.points.attacker + last.points.defender) ||
        (reading.secondsLeft !== null && last.secondsLeft !== null && reading.secondsLeft > last.secondsLeft + 60))
    next[siege.townId] = [...(anew ? [] : kept), reading].slice(-MOST_READINGS)
  }
  return next
}

export function useWar({ live = false }: { live?: boolean } = {}): WarState {
  const [state, setState] = useState<WarState>(NONE)
  // Live only while a battle is on: between sessions the three-minute copy says all there is.
  const battle = state.sieges.some((siege) => siege.battle)
  const fast = live && battle
  const everyS = fast ? WAR_LIVE_EVERY_S : WAR_EVERY_S
  const lastAsked = useRef(0)
  useEffect(() => {
    let cancelled = false
    let cancelTimer: (() => void) | null = null
    const url = fast ? '/maps/war/live' : '/maps/war'
    let hiddenSince = document.visibilityState === 'visible' ? null : Date.now()
    // Out of sight for long enough, the war rests until the tab is back (./steady.ts).
    const resting = () => hiddenSince !== null && Date.now() - hiddenSince > HIDDEN_FOR_MS
    const later = (ms: number) => {
      cancelTimer?.()
      cancelTimer = cancelled || resting() ? null : steadyTimeout(ask, ms)
    }
    const down = () => setState((current) => ({ ...current, status: 'down' }))
    const ask = async () => {
      cancelTimer?.()
      cancelTimer = null
      lastAsked.current = Date.now()
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`The war answered ${response.status}`)
        const body: unknown = await response.json()
        if (cancelled) return
        if (!isWar(body)) down()
        // The map is down: the war as the site last saved it, unless what's shown is newer; said to be the last known.
        else if (body.offline)
          setState((current) =>
            current.at >= body.at
              ? { ...current, status: 'down' }
              : {
                  sieges: body.sieges,
                  capitals: body.capitals,
                  radius: body.radius || CAPITAL_WAR_RADIUS,
                  at: body.at,
                  status: 'down',
                  readings: current.readings,
                },
          )
        else
          setState((current) => ({
            sieges: body.sieges,
            capitals: body.capitals,
            radius: body.radius || CAPITAL_WAR_RADIUS,
            at: body.at,
            status: 'live',
            readings: withReadings(current.readings, body),
          }))
      } catch {
        if (!cancelled) down()
      } finally {
        if (!cancelled) later(everyS * 1000)
      }
    }
    // Back in sight after a while away: ask at once if the last answer is older than the beat, else when it's due.
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') {
        hiddenSince ??= Date.now()
        return
      }
      hiddenSince = null
      const since = Date.now() - lastAsked.current
      if (since >= everyS * 1000) void ask()
      else later(everyS * 1000 - since)
    }
    const onOffline = () => down()
    const onOnline = () => void ask()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    // The first ask at once; a switch of feed asks the new one at once only when the last answer is older than its beat.
    const since = Date.now() - lastAsked.current
    if (!lastAsked.current || since >= everyS * 1000) void ask()
    else later(everyS * 1000 - since)
    return () => {
      cancelled = true
      cancelTimer?.()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [fast, everyS])
  return state
}
