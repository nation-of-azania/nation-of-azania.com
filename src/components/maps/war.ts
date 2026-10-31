'use client'

import { useEffect, useRef, useState } from 'react'

import { readingOf, type BattleReading } from '@/maps/battle'
import type { LiveSiege } from '@/maps/players'
import { CAPITAL_WAR_RADIUS, WAR_EVERY_S, WAR_LIVE_EVERY_S, type Siege, type War } from '@/maps/world'

import type { Store } from './hooks'
import type { LiveState } from './live'
import { HIDDEN_FOR_MS, steadyTimeout } from './steady'

/**
 * The war, as the map in the browser has it: /maps/war, asked for as soon
 * as the page is here (it's a few kilobytes) and again every three minutes,
 * as the CDN refreshes it, in sight or, for a while, out of it
 * (./steady.ts). Between those, the sieges come fresh with the players
 * (`feed`, ./live.ts): the map's live feed carries each siege's marker as
 * SiegeWar rewrites it, every fifteen seconds, and each newer one is taken
 * up here at once, the score, the banner, the time left. Only in the war
 * view (`live`), while a battle is on and the feed has brought no marker
 * for 45 seconds (the players layer off, the feed failing), is the marker
 * file read every half minute instead, from /maps/war/live. A siege is shown whenever there is one, so there's no
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

/** Readings kept per battle: a session read every fifteen seconds is 240. */
const MOST_READINGS = 260

/** How long the player feed may go without a siege's marker before the war is read from the marker file again in a battle. */
const FEED_QUIET_MS = 45_000

const isWar = (body: unknown): body is War => {
  const war = body as War
  return Boolean(war) && Array.isArray(war.sieges) && Array.isArray(war.capitals)
}

/**
 * A battle's readings with one more, read at `at`: never one older than the
 * last (the marker file can be older than the feed); started over when the
 * session has (the points fell, or more time is left than before).
 */
function withReading(kept: BattleReading[], siege: Siege, at: number): BattleReading[] {
  const reading = readingOf(siege, at)
  const last = kept.at(-1)
  if (last && reading.at <= last.at) return kept
  const anew =
    last &&
    ((reading.points && last.points && reading.points.attacker + reading.points.defender < last.points.attacker + last.points.defender) ||
      (reading.secondsLeft !== null && last.secondsLeft !== null && reading.secondsLeft > last.secondsLeft + 60))
  return [...(anew ? [] : kept), reading].slice(-MOST_READINGS)
}

/** The readings for a reading of the whole war: the battles on, each read at `at`; the rest dropped. */
function withReadings(readings: Record<string, BattleReading[]>, sieges: Siege[], at: number): Record<string, BattleReading[]> {
  const next: Record<string, BattleReading[]> = {}
  for (const siege of sieges) if (siege.battle) next[siege.townId] = withReading(readings[siege.townId] ?? [], siege, at)
  return next
}

/** A siege as the feed has it, with what the feed can't say (the town's nation) kept from the war's own reading. */
const fromFeed = (live: LiveSiege, known: Siege | undefined): Siege => {
  const { markedAt: _markedAt, ...siege } = live
  return { ...siege, town: siege.town ?? known?.town ?? null, townNation: known?.townNation ?? siege.townNation }
}

export function useWar({ live = false, feed }: { live?: boolean; feed?: Store<LiveState> } = {}): WarState {
  const [state, setState] = useState<WarState>(NONE)
  // When each siege's marker was written, as last taken from the player feed: a reading of the marker file older than it doesn't undo it.
  const marked = useRef(new Map<string, number>())
  // Whether the player feed is bringing the sieges' markers just now (./live.ts): while it is, the 5 MB marker file needn't be read every half minute.
  const [feedAlive, setFeedAlive] = useState(false)
  // Fast only while a battle is on and the feed isn't bringing it: between sessions the three-minute copy says all there is.
  const battle = state.sieges.some((siege) => siege.battle)
  const fast = live && battle && !feedAlive
  const everyS = fast ? WAR_LIVE_EVERY_S : WAR_EVERY_S
  const lastAsked = useRef(0)

  // The sieges as the player feed carries them, every fifteen seconds: taken up as they come, each newer than the last.
  useEffect(() => {
    if (!feed) return
    let quiet: number | undefined
    const take = () => {
      const fresh = feed.get().sieges.filter((siege) => siege.markedAt > (marked.current.get(siege.townId) ?? 0))
      if (!fresh.length) return
      for (const siege of fresh) marked.current.set(siege.townId, siege.markedAt)
      setFeedAlive(true)
      window.clearTimeout(quiet)
      quiet = window.setTimeout(() => setFeedAlive(false), FEED_QUIET_MS)
      setState((current) => {
        const known = new Map(current.sieges.map((siege) => [siege.townId, siege]))
        const byId = new Map(fresh.map((siege) => [siege.townId, siege]))
        const sieges = current.sieges.map((siege) => {
          const live = byId.get(siege.townId)
          return live ? fromFeed(live, siege) : siege
        })
        // A siege the war hasn't read yet: as the feed has it, until the war's next reading names its town's nation.
        for (const live of fresh) if (!known.has(live.townId)) sieges.push(fromFeed(live, undefined))
        const readings = { ...current.readings }
        for (const live of fresh) {
          if (live.battle) readings[live.townId] = withReading(readings[live.townId] ?? [], fromFeed(live, known.get(live.townId)), live.markedAt)
          else delete readings[live.townId]
        }
        return { ...current, sieges, readings }
      })
    }
    take()
    const unsubscribe = feed.subscribe(take)
    return () => {
      unsubscribe()
      window.clearTimeout(quiet)
    }
  }, [feed])

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
          setState((current) => {
            // A siege the feed has brought since the file was written keeps the feed's: the file is the older reading of it.
            const shown = new Map(current.sieges.map((siege) => [siege.townId, siege]))
            const sieges = body.sieges.map((siege) => {
              const newer = (marked.current.get(siege.townId) ?? 0) > body.at ? shown.get(siege.townId) : undefined
              return newer ? { ...newer, townNation: siege.townNation ?? newer.townNation } : siege
            })
            return {
              sieges,
              capitals: body.capitals,
              radius: body.radius || CAPITAL_WAR_RADIUS,
              at: body.at,
              status: 'live',
              readings: withReadings(current.readings, sieges, body.at),
            }
          })
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
