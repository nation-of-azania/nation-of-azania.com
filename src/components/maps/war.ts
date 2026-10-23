'use client'

import { useEffect, useState } from 'react'

import { CAPITAL_WAR_RADIUS, WAR_EVERY_S, type Siege, type War } from '@/maps/world'

/**
 * The war, as the map in the browser has it: /maps/war, asked for as soon
 * as the page is here (it's a few kilobytes) and again every three minutes
 * while the tab is in view, as the CDN refreshes it — never otherwise. A
 * siege is shown whenever there is one, so there's no layer to switch: the
 * map always asks. While the Rulercraft map isn't answering, or the
 * browser is offline, the last sieges known stay on the map, said to be
 * as of then. Always the bare path, which every viewer shares at the CDN.
 */

export type WarState = {
  sieges: Siege[]
  capitals: War['capitals']
  radius: number
  /** When the Rulercraft map last wrote what's shown, in ms since the epoch; 0 until the first answer. */
  at: number
  /** 'asking' until the first answer; 'down' while the map or the connection isn't answering (what's shown is the last known). */
  status: 'asking' | 'live' | 'down'
}

const NONE: WarState = { sieges: [], capitals: [], radius: CAPITAL_WAR_RADIUS, at: 0, status: 'asking' }

const isWar = (body: unknown): body is War => {
  const war = body as War
  return Boolean(war) && Array.isArray(war.sieges) && Array.isArray(war.capitals)
}

export function useWar(): WarState {
  const [state, setState] = useState<WarState>(NONE)
  useEffect(() => {
    let cancelled = false
    let timer: number | undefined
    let last = 0
    const visible = () => document.visibilityState === 'visible'
    const down = () => setState((current) => ({ ...current, status: 'down' }))
    const ask = async () => {
      window.clearTimeout(timer)
      last = Date.now()
      try {
        const response = await fetch('/maps/war')
        if (!response.ok) throw new Error(`The war answered ${response.status}`)
        const body: unknown = await response.json()
        if (cancelled) return
        // Offline with nothing kept: the last sieges known stand.
        if (!isWar(body) || body.offline) down()
        else
          setState({
            sieges: body.sieges,
            capitals: body.capitals,
            radius: body.radius || CAPITAL_WAR_RADIUS,
            at: body.at,
            status: 'live',
          })
      } catch {
        if (!cancelled) down()
      } finally {
        if (!cancelled && visible()) timer = window.setTimeout(ask, WAR_EVERY_S * 1000)
      }
    }
    // Back to the tab after a while away: ask at once; away from it, stop.
    const onVisibility = () => {
      if (!visible()) return window.clearTimeout(timer)
      const since = Date.now() - last
      if (since >= WAR_EVERY_S * 1000) void ask()
      else timer = window.setTimeout(ask, WAR_EVERY_S * 1000 - since)
    }
    const onOffline = () => down()
    const onOnline = () => void ask()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    void ask()
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])
  return state
}
