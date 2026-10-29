'use client'

import { useId, useMemo, useState, useSyncExternalStore } from 'react'

import { cn } from '@/blocks/components/shared'
import type { AbroadFacts, NationSummary } from '@/maps/abroad'
import { spoken } from '@/maps/data'
import { outlawCommand } from '@/maps/outlaw'

import { useMaps } from '../context'
import type { Store } from '../hooks'
import type { LiveState } from '../live'
import { FIELD, TextButton } from '../ui/chrome'
import { Head } from '../ui/Head'
import { Icon } from '../ui/icons'
import { useCopy } from '../ui/Readouts'
import { Swatch } from '../ui/Swatch'
import { EYEBROW, PanelSection } from './shared'

/**
 * The people of the world abroad, as Towny lists them, for the one thing
 * Azania does with another town's residents: outlaw them. On a town's
 * page, its residents, the ruler first; on a nation's, every resident of
 * every town, by town. Each name has its head, whether they're online
 * just now (while the live layer polls), and `/t outlaw add <name>` to
 * copy, since Towny takes one name a command and a player pastes one
 * line at a time; and the whole list, names or commands, a line each,
 * for notes or a macro. A long list is folded, and the nation's is
 * searched. The names come with the world's reading (src/maps/world.ts →
 * people) and the list says so when a reading hasn't them yet.
 */


/** A town's residents are shown this many before the rest fold. */
const SHOWN = 8
/** A town's list is searched from this many residents. */
const SEARCH_FROM = 12

const count = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/**
 * Who's online, by name in lower case, as the live layer last read it:
 * the store moves every few seconds, so only a change in who's there
 * re-renders a list, not every poll.
 */
function useOnline(store: Store<LiveState>): Set<string> {
  const key = useSyncExternalStore(
    store.subscribe,
    () => {
      const live = store.get()
      return live.status === 'live' ? live.players.map((player) => player.name.toLowerCase()).sort().join('\n') : ''
    },
    () => '',
  )
  return useMemo(() => new Set(key ? key.split('\n') : []), [key])
}

/** Whether a name matches the search, ignoring case and a Bedrock player's dot. */
const matches = (name: string, query: string) => name.replace(/^\./, '').toLowerCase().includes(query)

/** A name's outlaw command, copied by a click: the one in-game primitive, beside every name. */
function CopyCommand({ name }: { name: string }) {
  const [copied, copy] = useCopy()
  const command = outlawCommand(name)
  return (
    <button
      aria-label={`Copy ${command}`}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1 px-1.5 font-mono text-[10.5px] tracking-[0.04em] focus-visible:outline-saffron-500',
        copied ? 'text-sea-800' : 'text-ink-400 hover:text-sea-800',
      )}
      onClick={() => copy(command)}
      title={`Copy ${command}`}
      type="button"
    >
      <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
      <span aria-live="polite">{copied ? 'Copied' : 'outlaw'}</span>
    </button>
  )
}

/** One resident: their head, name, whether they rule the town and whether they're online, and their command. */
function PersonRow({ name, ruler, online }: { name: string; ruler: boolean; online: boolean }) {
  return (
    <li className="flex items-center gap-2.5 py-1">
      <Head name={name} px={24} />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-mono text-[13px] tracking-[0.02em] text-ink-900">{name}</span>
        {ruler ? <span className={cn(EYEBROW, 'shrink-0')}>Ruler</span> : null}
        {online ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-lagoon-600" title="Online now">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-lagoon-500" />
            online
          </span>
        ) : null}
      </span>
      <CopyCommand name={name} />
    </li>
  )
}

/** The whole list copied, as names or as commands, a line each; says how many it copied for a moment. */
function CopyAll({ names, what, className }: { names: string[]; what: 'names' | 'commands'; className?: string }) {
  const [copied, copy] = useCopy()
  const text = (what === 'names' ? names : names.map(outlawCommand)).join('\n')
  return (
    <TextButton
      className={cn('px-2 py-1 text-[12px]', className)}
      disabled={names.length === 0}
      onClick={() => copy(text)}
      title={what === 'names' ? 'Copy every name, one a line' : `Copy ${outlawCommand('<name>')} for everyone, one a line`}
    >
      <Icon className="h-3 w-3" name={copied ? 'check' : 'copy'} />
      {copied ? `Copied ${names.length}` : what === 'names' ? 'Names' : 'Commands'}
    </TextButton>
  )
}

/** A line of the search's field, for a list long enough to want one. */
function SearchField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const id = useId()
  return (
    <label className="relative block" htmlFor={id}>
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" name="search" />
      <input
        className={cn(FIELD, 'py-1.5 pl-8 text-[13px]')}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        type="search"
        value={value}
      />
    </label>
  )
}

/** Said where a town's names haven't been read yet: the map's reading from before they were. */
const NOT_READ = 'Towny’s list of names hasn’t been read yet; it comes with the map’s next reading.'

/** The rulers of the names: the ruler's name as Towny lists it, matched loosely, since the two lists don't always agree on case. */
const isRuler = (name: string, ruler: string | null) => Boolean(ruler) && name.toLowerCase() === ruler!.toLowerCase()

/** A town's people with its ruler first, however the map listed them, and the rest as they came. */
const rulerFirst = (people: string[], ruler: string | null): string[] =>
  ruler ? [...people.filter((name) => isRuler(name, ruler)), ...people.filter((name) => !isRuler(name, ruler))] : people

/**
 * A town abroad's residents: folded past the first few, searched when
 * there are many, every name with its command and the whole list to copy.
 */
export function Residents({ town }: { town: Pick<AbroadFacts, 'name' | 'people' | 'residents' | 'ruler' | 'kind'> }) {
  const { liveStore } = useMaps()
  const online = useOnline(liveStore)
  const [all, setAll] = useState(false)
  const [query, setQuery] = useState('')
  if (town.kind !== 'town' || (town.residents === 0 && town.people.length === 0)) return null
  const people = rulerFirst(town.people, town.ruler)
  const q = query.trim().toLowerCase()
  const found = q ? people.filter((name) => matches(name, q)) : people
  const shown = all || q ? found : found.slice(0, SHOWN)
  const here = people.filter((name) => online.has(name.toLowerCase())).length
  return (
    <PanelSection
      action={
        people.length ? (
          <span className="flex shrink-0 items-center gap-1">
            <CopyAll names={people} what="names" />
            <CopyAll names={people} what="commands" />
          </span>
        ) : null
      }
      title={`Residents · ${(people.length || town.residents).toLocaleString('en-GB')}`}
    >
      {people.length === 0 ? (
        <p className="text-sm italic text-ink-500">{NOT_READ}</p>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-ink-500">
            As Towny lists them{town.ruler ? ', the ruler first' : ''}
            {here ? `; ${here} online now` : ''}. Each name’s{' '}
            <code className="font-mono text-[12px] text-ink-700">{outlawCommand('name')}</code> is a click away.
          </p>
          {people.length >= SEARCH_FROM ? (
            <div className="mt-2">
              <SearchField label="Find a name" onChange={setQuery} value={query} />
            </div>
          ) : null}
          <ul className="mt-1 divide-y divide-sand-300/60">
            {shown.map((name) => (
              <PersonRow key={name} name={name} online={online.has(name.toLowerCase())} ruler={isRuler(name, town.ruler)} />
            ))}
          </ul>
          {q && found.length === 0 ? <p className="mt-1 text-sm italic text-ink-500">Nobody by that name here.</p> : null}
          {!q && found.length > SHOWN ? (
            <button
              aria-expanded={all}
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500"
              onClick={() => setAll((value) => !value)}
              type="button"
            >
              <Icon className={cn('h-3 w-3 transition-transform motion-reduce:transition-none', all && 'rotate-180')} name="chevron" />
              {all ? 'Fewer' : `All ${people.length}`}
            </button>
          ) : null}
        </>
      )}
    </PanelSection>
  )
}

/**
 * A nation's people, town by town: each town folded, its residents and
 * its own list to copy within, the capital first and then the biggest;
 * searched across every town, the towns with a match opened. The
 * totals, and the whole nation's list to copy, at the head.
 */
export function NationPeople({ nation, members }: { nation: Pick<NationSummary, 'name' | 'colour' | 'residents'>; members: AbroadFacts[] }) {
  const { liveStore } = useMaps()
  const online = useOnline(liveStore)
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<Set<string>>(() => new Set())
  const towns = useMemo(
    () =>
      members
        .filter((town) => town.kind === 'town' && (town.residents > 0 || town.people.length > 0))
        .map((town) => ({ ...town, people: rulerFirst(town.people, town.ruler) }))
        .sort((a, b) => Number(b.capital) - Number(a.capital) || b.residents - a.residents || a.name.localeCompare(b.name)),
    [members],
  )
  const everyone = useMemo(() => towns.flatMap((town) => town.people), [towns])
  if (towns.length === 0) return null
  const q = query.trim().toLowerCase()
  const unread = towns.filter((town) => town.people.length === 0 && town.residents > 0).length
  const here = everyone.filter((name) => online.has(name.toLowerCase())).length
  const toggle = (slug: string, open: boolean) =>
    setOpened((current) => {
      const next = new Set(current)
      if (open) next.add(slug)
      else next.delete(slug)
      return next
    })
  const listed = towns
    .map((town) => ({ town, found: q ? town.people.filter((name) => matches(name, q)) : town.people }))
    .filter(({ town, found }) => !q || found.length > 0 || matches(town.name, q))

  return (
    <PanelSection
      action={
        everyone.length ? (
          <span className="flex shrink-0 items-center gap-1">
            <CopyAll names={everyone} what="names" />
            <CopyAll names={everyone} what="commands" />
          </span>
        ) : null
      }
      flush
      title={`People · ${(everyone.length || nation.residents).toLocaleString('en-GB')}`}
    >
      <div className="px-4">
        <p className="text-[13px] leading-relaxed text-ink-500">
          {everyone.length ? (
            <>
              {count(everyone.length, 'resident')} in {count(towns.length, 'town')}, as Towny lists them
              {here ? `; ${here} online now` : ''}. Each name’s{' '}
              <code className="font-mono text-[12px] text-ink-700">{outlawCommand('name')}</code> is a click away, and a
              town’s whole list within it.
            </>
          ) : (
            NOT_READ
          )}
        </p>
        {everyone.length ? (
          <div className="mt-2">
            <SearchField label="Find a name or a town" onChange={setQuery} value={query} />
          </div>
        ) : null}
        {unread && everyone.length ? (
          <p className="mt-1.5 text-[11px] italic leading-snug text-ink-500">
            {unread === 1 ? 'One town’s names haven’t' : `${unread} towns’ names haven’t`} been read yet; they come with the
            map’s next reading.
          </p>
        ) : null}
      </div>
      {everyone.length ? (
        <ul className="mt-2 divide-y divide-sand-300/70 border-t border-sand-300/70">
          {listed.map(({ town, found }) => (
            <li key={town.slug}>
              <details
                className="group"
                onToggle={(event) => toggle(town.slug, event.currentTarget.open)}
                open={q ? true : opened.has(town.slug)}
              >
                <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-2 hover:bg-sand-100 focus-visible:outline-saffron-500 [&::-webkit-details-marker]:hidden">
                  <Swatch className={town.capital ? 'h-3.5 w-3.5 border-2' : undefined} colour={nation.colour} round />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {spoken(town.name)}
                      {town.capital ? <span className={`${EYEBROW} ml-2 align-middle`}>Capital</span> : null}
                    </span>
                    <span className="block truncate text-xs text-ink-500">
                      {town.people.length
                        ? `${count(q ? found.length : town.people.length, q ? 'match' : 'resident')}${
                            town.people.some((name) => online.has(name.toLowerCase()))
                              ? ` · ${town.people.filter((name) => online.has(name.toLowerCase())).length} online`
                              : ''
                          }`
                        : `${count(town.residents, 'resident')} · names not read yet`}
                      {town.ruler ? ` · ${town.ruler}` : ''}
                    </span>
                  </span>
                  <Icon
                    className="h-3.5 w-3.5 shrink-0 text-ink-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    name="chevron"
                  />
                </summary>
                <div className="border-t border-sand-300/50 bg-sand-100/40 px-4 pb-2 pl-7">
                  {town.people.length ? (
                    <>
                      <ul className="divide-y divide-sand-300/60">
                        {found.map((name) => (
                          <PersonRow key={name} name={name} online={online.has(name.toLowerCase())} ruler={isRuler(name, town.ruler)} />
                        ))}
                      </ul>
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-ink-500">
                        <span className="mr-1">{spoken(town.name)}’s list:</span>
                        <CopyAll names={town.people} what="names" />
                        <CopyAll names={town.people} what="commands" />
                      </p>
                    </>
                  ) : (
                    <p className="py-2 text-[13px] italic text-ink-500">{NOT_READ}</p>
                  )}
                </div>
              </details>
            </li>
          ))}
          {listed.length === 0 ? (
            <li className="px-4 py-2 text-sm italic text-ink-500">Nobody by that name in {spoken(nation.name)}.</li>
          ) : null}
        </ul>
      ) : null}
      <p className="mt-2 px-4 text-[11px] leading-snug text-ink-400">
        Towny takes one name a command: paste a name’s line in chat. The whole list, a line each, is for notes or a macro.
      </p>
    </PanelSection>
  )
}
