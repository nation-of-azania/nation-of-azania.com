'use client'

import Link from 'next/link'
import { useMemo, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import { homeNationOf, sameNation, worldSlug } from '@/maps/abroad'
import { alliancesWith, type Alliance, type AllianceSource } from '@/maps/alliances'
import { spoken } from '@/maps/data'
import { MAPS_PATH, nationHref } from '@/maps/url'

import { useAlliances } from '../alliances'
import { useMaps } from '../context'
import { agoWords, type Tone } from '../ui/Fighter'
import { Icon } from '../ui/icons'
import { PanelSection } from './shared'

/**
 * A nation's allies, as far as Azania Maps can know them (the Rulercraft
 * map names none: src/maps/alliances.ts), each with how it's known: set in
 * Azania's own diplomacy, told by the diplomats (with their note), or seen
 * in the battles, where a player of the one fought for the other, who and
 * when last. On the war sidebar's dark (`tone="war"`, a nation's section,
 * each ally a button to its own section) and on a nation's page abroad
 * (`tone="panel"`, each a link to its page). The list is worth having
 * because SiegeWar counts a mutual ally's soldiers for either side of a
 * siege, so who is allied with whom says who may turn up.
 */

const TONES: Record<Tone, { ink: string; soft: string; faint: string; line: string; link: string }> = {
  war: {
    ink: 'text-sand-50',
    soft: 'text-sand-200/80',
    faint: 'text-sand-300/70',
    line: 'divide-sand-50/10 border-sand-50/10',
    link: 'inline-flex max-w-full items-center gap-1.5 border border-sand-50/20 px-2 py-0.5 text-[14px] font-semibold leading-snug text-sand-50 hover:border-sand-50/45 hover:bg-sand-50/5 focus-visible:outline-saffron-400',
  },
  panel: {
    ink: 'text-ink-900',
    soft: 'text-ink-700',
    faint: 'text-ink-500',
    line: 'divide-sand-300/70 border-sand-300/70',
    link: 'inline-flex max-w-full items-center gap-1.5 text-[15px] font-semibold text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500',
  },
}

const SOURCE_WORDS: Record<AllianceSource, string> = {
  diplomacy: 'set in Azania’s diplomacy',
  told: 'told by the diplomats',
  seen: 'seen fighting together',
}

/** "set in Azania's diplomacy · seen fighting together: Its_Pandaz, quadecaelite68 · 2 battles, last 3 days ago". */
export function knownWords(alliance: Alliance, now: number): string {
  return alliance.sources
    .map((source) => {
      if (source !== 'seen' || !alliance.seen) return SOURCE_WORDS[source]
      const { players, battles, last } = alliance.seen
      const who = players.length ? `: ${players.slice(0, 4).join(', ')}${players.length > 4 ? ` and ${players.length - 4} more` : ''}` : ''
      return `${SOURCE_WORDS.seen}${who} · ${battles} battle${battles === 1 ? '' : 's'}, last ${agoWords(last, now)}`
    })
    .join(' · ')
}

export function AlliesList({
  nation,
  alliances,
  status,
  tone,
  now,
  onPick,
  className,
}: {
  nation: string
  alliances: Alliance[]
  /** How the records' asking goes: until 'ready', only Azania's own diplomacy is in the list. */
  status: 'idle' | 'asking' | 'ready' | 'down'
  tone: Tone
  now: number
  /** On the war sidebar: an ally's name opens its own section. Without it, the name links to its page. */
  onPick?: (nation: string) => void
  className?: string
}) {
  const { data } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  const t = TONES[tone]
  const allies = useMemo(() => alliancesWith(nation, alliances), [nation, alliances])
  const waiting = status !== 'ready'
  if (!allies.length) {
    return (
      <p className={cn('text-[14px] leading-snug', t.soft, className)}>
        {status === 'down'
          ? 'No ally set in Azania’s diplomacy; the rest of the records couldn’t be read just now.'
          : waiting
            ? 'No ally set in Azania’s diplomacy; reading the records for the rest…'
            : 'No ally known: none set in Azania’s diplomacy, none told by the diplomats, none seen fighting together.'}
      </p>
    )
  }
  const name = (ally: string): ReactNode =>
    onPick ? (
      <button className={t.link} onClick={() => onPick(ally)} type="button">
        <Icon className="h-3.5 w-3.5 opacity-70" name="people" />
        <span className="truncate">{spoken(ally)}</span>
      </button>
    ) : (
      <Link className={t.link} href={sameNation(ally, home) ? MAPS_PATH : nationHref(worldSlug(ally))}>
        {spoken(ally)}
      </Link>
    )
  return (
    <ul className={cn('divide-y border-y', t.line, className)}>
      {allies.map(({ ally, alliance }) => (
        <li className="py-1.5" key={ally}>
          {name(ally)}
          <p className={cn('mt-0.5 text-[13px] leading-snug', t.soft)}>{knownWords(alliance, now)}</p>
          {alliance.note ? <p className={cn('mt-0.5 text-[13px] italic leading-snug', t.faint)}>{alliance.note}</p> : null}
        </li>
      ))}
      {waiting ? <li className={cn('py-1.5 text-[13px]', t.faint)}>{status === 'down' ? 'The rest of the records couldn’t be read just now.' : 'Reading the records for the rest…'}</li> : null}
    </ul>
  )
}

/** A nation's allies on its page abroad: a section, asking for the records as it opens. */
export function NationAllies({ nation }: { nation: string }) {
  const { alliances, status } = useAlliances('alone')
  const { now } = useMaps()
  return (
    <PanelSection
      hint="As far as Azania Maps can know, since the Rulercraft map names no allies: set by Azania’s diplomats, or seen in the battles, where a player of the one fought for the other. SiegeWar counts a mutual ally’s soldiers for either side of a siege."
      title="Allies"
    >
      <AlliesList alliances={alliances} nation={nation} now={now} status={status} tone="panel" />
    </PanelSection>
  )
}
