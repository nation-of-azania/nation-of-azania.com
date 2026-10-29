'use client'

import { useMemo } from 'react'

import { cn } from '@/blocks/components/shared'
import { homeNationOf, relationWith, sameNation, worldSlug } from '@/maps/abroad'
import { spoken, type Relation } from '@/maps/data'
import { STANCE_COLOURS } from '@/maps/palette'
import type { Stance } from '@/maps/registry'
import type { Siege } from '@/maps/world'

import { useMaps } from '../context'
import { EYEBROW } from '../panels/shared'
import { KEY_ORDER, StanceSwatch, stanceLabel } from './Diplomacy'
import { Icon } from './icons'

/** A nation as the key names it: its relation, its address on the map (null when it isn't on the map just now), and whether it's in a siege. */
type Named = { relation: Relation; slug: string | null; besieged: boolean }

/** Whether a nation is a side in a siege, or the besieged town is its. */
const inSiege = (nation: string, sieges: Siege[]): boolean =>
  sieges.some(
    (siege) => sameNation(siege.attacker, nation) || sameNation(siege.defender, nation) || sameNation(siege.townNation, nation),
  )

/**
 * The key to the diplomacy layer, on the map while it's on, and the way
 * about it: the stances from friend to foe, each with the nations Azania
 * holds it toward, every one a button that opens the nation and brings
 * the map to it, with the admins' line about it on hover; a nation in a
 * siege wears the siege's swords beside its name. Every nation not named
 * is neutral, and the key says how many. On a phone (`compact`) it folds
 * to its eyebrow and a row of counts, and opens on a tap. Its × turns
 * the layer off, as the button in the controls does.
 */
export function DiplomacyKey({
  relations,
  compact = false,
  onHide,
  className,
}: {
  relations: Relation[]
  compact?: boolean
  onHide: () => void
  className?: string
}) {
  const { data, world, war, select, rights, rightsStatus } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  const named = useMemo<Map<Stance | 'neutral', Named[]>>(() => {
    const byStance = new Map<Stance | 'neutral', Named[]>()
    for (const relation of relations) {
      const nation = world?.nationByName.get(relation.nation) ?? world?.nations.find((candidate) => sameNation(candidate.name, relation.nation))
      const entry: Named = {
        relation,
        // Without the world, the address is the name's; the page says if there's nothing there.
        slug: world ? (nation?.slug ?? null) : worldSlug(relation.nation),
        besieged: inSiege(relation.nation, war.sieges),
      }
      byStance.set(relation.stance, [...(byStance.get(relation.stance) ?? []), entry])
    }
    for (const list of byStance.values()) list.sort((a, b) => a.relation.nation.localeCompare(b.relation.nation))
    return byStance
  }, [relations, world, war.sieges])
  // The neutral: every other nation on the map, Azania's own not among them.
  const neutral = world
    ? world.nations.filter((nation) => !sameNation(nation.name, home) && !relationWith(nation.name, relations)).length
    : null
  const diplomat = rightsStatus === 'known' && rights.diplomacy

  const counts = (
    <ul aria-label="By stance" className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {KEY_ORDER.map((stance) => {
        const n = stance === 'neutral' ? neutral : (named.get(stance)?.length ?? 0)
        if (stance !== 'neutral' && !n) return null
        return (
          <li className="inline-flex items-center gap-1 text-[11px] text-ink-700" key={stance}>
            <StanceSwatch className="h-2.5 w-3.5" stance={stance} />
            <span className="sr-only">{stanceLabel(stance)}</span>
            <span className="font-mono tabular-nums">{n ?? '·'}</span>
          </li>
        )
      })}
    </ul>
  )

  const rows = (
    <ul className="divide-y divide-sand-300/60">
      {KEY_ORDER.map((stance) => {
        const list = named.get(stance) ?? []
        if (stance !== 'neutral' && list.length === 0) return null
        const colour = STANCE_COLOURS[stance]
        return (
          <li className="flex items-start gap-2.5 py-1.5" key={stance}>
            <StanceSwatch className="mt-[3px]" stance={stance} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: colour.text }}>
                {stanceLabel(stance)}
              </p>
              {stance === 'neutral' ? (
                <p className="text-[12px] leading-snug text-ink-500">
                  {neutral === null ? 'Every other nation' : neutral === 1 ? 'The one other nation' : `The ${neutral} other nations`}
                </p>
              ) : (
                <ul className="mt-0.5 flex flex-wrap gap-x-1 gap-y-0.5">
                  {list.map(({ relation, slug, besieged }) => (
                    <li key={relation.nation}>
                      {slug ? (
                        <button
                          className="group inline-flex max-w-full items-center gap-1 border border-transparent px-1 py-0.5 text-left text-[12px] font-semibold leading-snug text-ink-900 hover:border-sand-300 hover:bg-sand-100 focus-visible:outline-saffron-500"
                          onClick={() => select({ kind: 'nation', slug })}
                          title={relation.note ? `${relation.note} · Open ${spoken(relation.nation)}` : `Open ${spoken(relation.nation)} on the map`}
                          type="button"
                        >
                          <span className="truncate">{spoken(relation.nation)}</span>
                          {besieged ? <SiegeHint /> : null}
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-1 py-0.5 text-[12px] font-semibold leading-snug text-ink-400"
                          title={`${spoken(relation.nation)} isn’t on the Rulercraft map just now${relation.note ? ` · ${relation.note}` : ''}`}
                        >
                          <span className="truncate">{spoken(relation.nation)}</span>
                          {besieged ? <SiegeHint /> : null}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )

  const hide = (
    <button
      aria-label="Hide the diplomacy layer"
      className="-mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink-500 hover:text-ink-900 focus-visible:outline-saffron-500"
      onClick={onHide}
      title="Hide the diplomacy layer"
      type="button"
    >
      <Icon className="h-3.5 w-3.5" name="close" />
    </button>
  )

  const foot =
    relations.length === 0 ? (
      <p className="mt-1.5 text-[12px] leading-snug text-ink-500">
        No stances set yet, so every nation is neutral.{diplomat ? ' Open a nation and set where Azania stands with it.' : ''}
      </p>
    ) : diplomat ? (
      <p className="mt-1.5 border-t border-sand-300/60 pt-1.5 text-[11px] leading-snug text-ink-400">
        You can set a stance from any nation’s page.
      </p>
    ) : null

  const frame = cn(
    'az-diplomacy-key border border-sand-300 bg-sand-50/95 shadow-[0_1px_2px_rgba(22,25,31,0.08)]',
    compact ? 'w-[17rem] max-w-full' : 'w-[22rem] max-w-full',
    className,
  )

  if (compact) {
    return (
      <details aria-label="Azania’s diplomacy" className={cn(frame, 'group')}>
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 focus-visible:outline-saffron-500 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">
            <span className={cn(EYEBROW, 'block')}>Diplomacy</span>
            <span className="mt-1 block group-open:hidden">{counts}</span>
          </span>
          <Icon className="h-3.5 w-3.5 shrink-0 text-ink-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" name="chevron" />
          {hide}
        </summary>
        <div className="max-h-[40vh] overflow-y-auto border-t border-sand-300/60 px-3 pb-2">
          {rows}
          {foot}
        </div>
      </details>
    )
  }

  return (
    <section aria-label="Azania’s diplomacy" className={cn(frame, 'px-3 py-2')}>
      <div className="flex items-start gap-2">
        <p className={cn(EYEBROW, 'min-w-0 flex-1')}>Azania’s diplomacy</p>
        {hide}
      </div>
      <div className="mt-1 max-h-[46vh] overflow-y-auto">
        {rows}
        {foot}
      </div>
    </section>
  )
}

/** The swords beside a nation in a siege, in the key: small, in the seal's coral. */
function SiegeHint() {
  return (
    <span className="inline-flex shrink-0 items-center text-coral-700" title="In a siege">
      <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth={2.4} viewBox="0 0 24 24">
        <path d="M5 5l11 11M14 18l4-4M16 16l3 3M19 5L8 16M6 14l4 4M8 16l-3 3" />
      </svg>
      <span className="sr-only">, in a siege</span>
    </span>
  )
}
