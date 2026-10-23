'use client'

import { useMemo } from 'react'

import { homeNationOf, sameNation } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import { azaniaSide, bySiegeWeight, siegeHeadline, siegeTitle, type SiegeSide } from '@/maps/sieges'
import type { Siege } from '@/maps/world'

import { useMaps } from '../context'
import { TextButton } from '../ui/chrome'
import { SiegeBadge, SiegeFigures } from '../ui/Siege'
import { PanelSection } from './shared'

/**
 * The sieges in the panels, read from the war the shell polls (the panels
 * themselves are cached pages, and a siege moves by the battle session):
 * Azania's own at the top of the front, unmissable; the rest of the
 * server's lower down; a besieged town's on its page; a nation's on its.
 */

/** Every siege with Azania's side in it, Azania's own first. */
function useSieges(): { siege: Siege; side: SiegeSide }[] {
  const { war, data } = useMaps()
  return useMemo(() => {
    const home = { nation: homeNationOf(data.towns), towns: data.towns }
    return bySiegeWeight(war.sieges.map((siege) => ({ siege, side: azaniaSide(siege, home) })))
  }, [war.sieges, data.towns])
}

/** Said under the sieges while the Rulercraft map isn't answering: they're the last known, as of when. */
function Stale() {
  const { war } = useMaps()
  if (war.status !== 'down' || !war.at) return null
  const at = new Date(war.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  return (
    <p className="mt-1 text-[11px] italic text-ink-500">
      As last known, at {at}: the Rulercraft map isn’t answering just now.
    </p>
  )
}

/** One siege in full: its badge, Azania's part in a headline, its figures, and the way to it on the map. */
function SiegeBlock({ siege, side, className }: { siege: Siege; side: SiegeSide; className?: string }) {
  const { openSiege } = useMaps()
  return (
    <section
      aria-label={siegeTitle(siege)}
      className={`border border-l-4 border-coral-600/40 border-l-coral-600 bg-coral-600/5 px-3 py-2.5 ${className ?? ''}`}
    >
      <div className="flex items-start gap-2.5">
        <SiegeBadge className="mt-0.5 h-8 w-8" side={side} siege={siege} />
        <div className="min-w-0 flex-1">
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.2em] text-coral-700">
            {siege.battle ? 'Siege · a battle on' : 'Siege · quiet'}
          </p>
          <h2 className="font-display text-xl leading-tight text-coral-700">{siegeHeadline(siege, side)}</h2>
          <p className="mt-0.5 text-[13px] text-ink-500">{siegeTitle(siege)}</p>
        </div>
      </div>
      <SiegeFigures className="mt-2" siege={siege} />
      <TextButton className="mt-2 px-2.5 py-1.5" onClick={() => openSiege(siege.townId)} tone="primary">
        Show on the map
      </TextButton>
      <Stale />
    </section>
  )
}

/** Azania's sieges, at the top of the front: its towns besieged, then those it presses. */
export function OurSieges() {
  const ours = useSieges().filter((entry) => entry.side)
  if (!ours.length) return null
  return (
    <div className="mt-4 space-y-3 px-4">
      {ours.map(({ siege, side }) => (
        <SiegeBlock key={siege.townId} side={side} siege={siege} />
      ))}
    </div>
  )
}

/** A siege as a row: its badge, title, and town and progress, with Show. */
function SiegeRow({ siege, side }: { siege: Siege; side: SiegeSide }) {
  const { openSiege } = useMaps()
  return (
    <li className="flex items-center gap-3 px-4 py-2">
      <SiegeBadge side={side} siege={siege} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink-900">{siegeTitle(siege)}</span>
        <span className="block truncate text-xs text-ink-500">
          {[
            siege.town ? spoken(siege.town) : null,
            siege.progress ? `${siege.progress.done} of ${siege.progress.of} fought` : null,
            siege.battle ? 'a battle on' : 'quiet',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <TextButton className="shrink-0 px-2.5 py-1" onClick={() => openSiege(siege.townId)}>
        Show
      </TextButton>
    </li>
  )
}

/** The rest of the server's sieges, on the front: Azania isn't in them, but they are news. */
export function OtherSieges() {
  const others = useSieges().filter((entry) => !entry.side)
  if (!others.length) return null
  return (
    <PanelSection flush title={`Sieges on the server · ${others.length}`}>
      <ul className="divide-y divide-sand-300/70">
        {others.map(({ siege, side }) => (
          <SiegeRow key={siege.townId} side={side} siege={siege} />
        ))}
      </ul>
      <div className="px-4">
        <Stale />
      </div>
    </PanelSection>
  )
}

/** A town's own siege, on its page, Azanian or abroad, by Towny's id. */
export function TownSiege({ townyId }: { townyId: string | null }) {
  const entry = useSieges().find(({ siege }) => townyId && siege.townId === townyId)
  if (!entry) return null
  return <SiegeBlock className="mx-4 mt-4" side={entry.side} siege={entry.siege} />
}

/** A nation's sieges, on its page: those it presses and those it holds out against. */
export function NationSieges({ nation }: { nation: string }) {
  const theirs = useSieges().filter(
    ({ siege }) =>
      sameNation(siege.attacker, nation) || sameNation(siege.defender, nation) || sameNation(siege.townNation, nation),
  )
  if (!theirs.length) return null
  return (
    <PanelSection flush title={`Sieges · ${theirs.length}`}>
      <ul className="divide-y divide-sand-300/70">
        {theirs.map(({ siege, side }) => (
          <SiegeRow key={siege.townId} side={side} siege={siege} />
        ))}
      </ul>
    </PanelSection>
  )
}
