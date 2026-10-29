import { formatDate, minecraftHeadUrl } from '@/components/site/format'
import type { ListChangeView, SanctionList } from '@/lib/sanctions'
import type { EntryChange, ListEntry, PlayerChange, Via } from '@/lists/resolve'
import { spoken } from '@/maps/data'

import { cn } from '../shared'
import { ClassMarks, type RollPlayer } from './Roll'

/**
 * The pieces a sanction list is shown with, on its page and in the
 * Sanction list block: why a player is on it, one change as recorded, and
 * the changelog. Server components in the voice of whichever paper shows
 * them (the shell's --design-* properties), the seal's colour (--seal-ink)
 * for what the list does to people.
 */

const plural = (n: number, word: string) => `${n.toLocaleString('en-GB')} ${word}${n === 1 ? '' : 's'}`

/** A change's people shown before the rest fold away. */
const SHOWN = 12

/**
 * The players a change moved beyond those its own entries name: a player
 * named in an edit is already there, with their reason and classes, so only
 * the residents a town or nation brought (or took) are listed again.
 */
const beyondEntries = (change: ListChangeView): PlayerChange[] =>
  change.entries.length
    ? change.players.filter((player) => !player.via.every((via) => via.kind === 'player'))
    : change.players

/** Why a player is on a list, from the first reason that applies: their own entry's, or where they live. */
export function whyOf(via: Via[], entries: ListEntry[]): string {
  const named = via.find((item) => item.kind === 'player')
  if (named) return entries.find((entry) => entry.id === named.entry)?.reason?.trim() || 'Named on the list'
  const through = via[0]
  if (!through) return ''
  const town = through.town ? spoken(through.town) : null
  if (through.kind === 'town') return `Resident of ${spoken(through.name)}`
  return town ? `Resident of ${town}, ${spoken(through.name)}` : `Resident of ${spoken(through.name)}`
}

/** A list's roster as the roll shows it. */
export function rollOf(list: SanctionList, through?: string | null): RollPlayer[] {
  const wanted = through?.trim().toLowerCase()
  return list.players
    .filter((player) => !wanted || player.via.some((via) => via.name.toLowerCase() === wanted))
    .map((player) => ({
      key: player.key,
      name: player.name,
      classes: orderedClasses(player.classes, list),
      why: whyOf(player.via, list.entries),
      since: formatDate(player.since),
      sinceAt: player.since ?? null,
    }))
}

/** Classes in the order the list gives them, so every row reads alike. */
export function orderedClasses(classes: string[], list: Pick<SanctionList, 'classes'>): string[] {
  const order = list.classes.map((item) => item.name.toLowerCase())
  const rank = (name: string) => {
    const at = order.indexOf(name.toLowerCase())
    return at === -1 ? order.length : at
  }
  return [...classes].sort((a, b) => rank(a) - rank(b))
}

const ENTRY_WORDS: Record<EntryChange['kind'], string> = {
  player: 'Player',
  town: 'Town',
  nation: 'Nation',
}

const ACTION_WORDS: Record<EntryChange['action'], string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Amended',
}

/** A player's name with their head, small, as a change lists them. */
function PlayerTag({ change, mark }: { change: PlayerChange; mark: '+' | '−' }) {
  const where = change.via.find((via) => via.kind !== 'player')
  return (
    <li
      className={cn(
        'inline-flex items-center gap-1.5 border py-0.5 pr-2 pl-0.5 text-[13px]',
        mark === '+' ? 'border-(--seal-ink)/35' : 'border-(--design-ink)/15 text-(--design-muted)',
      )}
      title={where?.town ? `${mark === '+' ? 'Resident' : 'Was resident'} of ${spoken(where.town)}` : undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- an 18px head from mc-heads.net, pixelated. */}
      <img
        alt=""
        className={cn('h-[18px] w-[18px] [image-rendering:pixelated]', mark === '−' && 'opacity-60 grayscale')}
        height={18}
        loading="lazy"
        src={minecraftHeadUrl(change.name, 32)}
        width={18}
      />
      <span aria-hidden="true" className={cn('font-mono text-[11px]', mark === '+' ? 'text-(--seal-ink)' : 'text-(--design-muted)')}>
        {mark}
      </span>
      <span className={cn('font-mono', mark === '−' && 'line-through decoration-(--design-muted)/60')}>{change.name}</span>
    </li>
  )
}

function PlayerTags({ changes, action, label }: { changes: PlayerChange[]; action: PlayerChange['action']; label: string }) {
  const these = changes.filter((change) => change.action === action)
  if (these.length === 0) return null
  return (
    <div className="mt-3">
      <p className="font-label text-[10px] font-semibold uppercase tracking-[0.18em] text-(--design-muted)">
        {label} · {these.length}
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {these.map((change) => (
          <PlayerTag change={change} key={`${change.action}-${change.name}`} mark={action === 'added' ? '+' : '−'} />
        ))}
      </ul>
    </div>
  )
}

/** "Edit of the list", "The map", with its date and note: what a change is, in its heading. */
function ChangeHeading({ change, list }: { change: ListChangeView; list?: Pick<SanctionList, 'name'> }) {
  const date = formatDate(change.at)
  return (
    <header>
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--design-accent)">
        {change.source === 'edit' ? 'Amendment' : 'Residence'}
        {list ? ` · ${list.name}` : ''}
      </p>
      <p className="mt-1 font-(family-name:--design-display) text-xl leading-snug text-(--design-ink)">
        <time dateTime={change.at} title={new Date(change.at).toUTCString()}>
          {date}
        </time>
        {change.note ? <span className="text-(--design-muted)"> · {change.note}</span> : null}
      </p>
    </header>
  )
}

/** What an edit did to the entries: each named, its kind, classes and reason. */
function EntryChanges({ entries, list }: { entries: EntryChange[]; list: Pick<SanctionList, 'classes'> }) {
  if (entries.length === 0) return null
  return (
    <ul className="mt-4 divide-y divide-(--design-ink)/10 border-y border-(--design-ink)/15">
      {entries.map((entry, index) => (
        <li className="grid gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] sm:items-baseline" key={`${entry.action}-${entry.name}-${index}`}>
          <p className="font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-(--design-muted)">
            {ACTION_WORDS[entry.action]} · {ENTRY_WORDS[entry.kind]}
          </p>
          <div className="min-w-0">
            <p
              className={cn(
                'text-[15px] text-(--design-ink)',
                entry.kind === 'player' ? 'font-mono' : 'font-semibold',
                entry.action === 'removed' && 'line-through decoration-(--design-muted)/60',
              )}
            >
              {entry.kind === 'player' ? entry.name : spoken(entry.name)}
            </p>
            {entry.reason ? <p className="text-[13px] leading-snug text-(--design-muted)">{entry.reason}</p> : null}
            {entry.exceptTowns.length || entry.exceptPlayers.length ? (
              <p className="text-[13px] leading-snug text-(--design-muted)">
                Except {[...entry.exceptTowns.map(spoken), ...entry.exceptPlayers].join(', ')}
              </p>
            ) : null}
          </div>
          <ClassMarks classes={orderedClasses(entry.classes, list)} />
        </li>
      ))}
    </ul>
  )
}

/**
 * One change, as it was recorded: its date and note, what it did to the
 * entries, and the players it brought onto the list or took off it.
 */
export function ChangeRecord({
  change,
  list,
  className,
}: {
  change: ListChangeView
  list: Pick<SanctionList, 'name' | 'classes'>
  className?: string
}) {
  return (
    <div className={className}>
      <ChangeHeading change={change} list={list} />
      <EntryChanges entries={change.entries} list={list} />
      <PlayerTags action="added" changes={beyondEntries(change)} label={change.entries.length ? 'Residents placed on the list' : 'Placed on the list'} />
      <PlayerTags action="removed" changes={beyondEntries(change)} label={change.entries.length ? 'Residents taken off the list' : 'Taken off the list'} />
      {change.players.length === 0 && change.entries.length > 0 ? (
        <p className="mt-3 text-sm italic text-(--design-muted)">No player came onto the list or left it with this change.</p>
      ) : null}
    </div>
  )
}

/** "Moved into Ravenswatch" / "Left Imperial Avalonia": a resident's change, said of the place. */
function movement(change: PlayerChange): string {
  const where = change.via.find((via) => via.kind !== 'player')
  if (!where) return change.action === 'added' ? 'Named on the list' : 'No longer named'
  const place = spoken(where.name)
  const town = where.town && where.kind === 'nation' ? ` (${spoken(where.town)})` : ''
  return change.action === 'added' ? `Resident of ${place}${town}` : `No longer a resident of ${place}${town ? `; was in ${spoken(where.town!)}` : ''}`
}

/**
 * The changelog, newest first, each change with its date: the edits, and
 * the residents the map saw come and go. A resident who left shows as a
 * past resident, struck through, still on the record.
 */
export function ChangeLog({
  changes,
  list,
  className,
}: {
  changes: ListChangeView[]
  list: Pick<SanctionList, 'classes'>
  className?: string
}) {
  if (changes.length === 0) {
    return <p className={cn('text-sm italic text-(--design-muted)', className)}>Nothing has changed yet.</p>
  }
  return (
    <ol className={cn('relative border-l border-(--design-ink)/15 pl-5', className)}>
      {changes.map((change) => {
        const people = [...beyondEntries(change)].sort((a, b) => a.action.localeCompare(b.action) || a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
        const row = (person: PlayerChange) => (
          <li className="flex flex-wrap items-baseline gap-x-2 text-[13px]" key={`${person.action}-${person.name}`}>
            <span
              className={cn(
                'font-mono text-[14px]',
                person.action === 'added' ? 'text-(--design-ink)' : 'text-(--design-muted) line-through decoration-(--design-muted)/60',
              )}
            >
              <span aria-hidden="true" className={person.action === 'added' ? 'text-(--seal-ink)' : ''}>
                {person.action === 'added' ? '+ ' : '− '}
              </span>
              {person.name}
            </span>
            <span className="text-(--design-muted)">
              {person.action === 'added' ? 'placed on the list' : 'taken off the list'} · {movement(person)}
            </span>
          </li>
        )
        return (
          <li className="relative pb-6 last:pb-0" key={change.id}>
            <span
              aria-hidden="true"
              className={cn(
                'absolute top-1.5 -left-[25px] h-2.5 w-2.5 rotate-45 border',
                change.source === 'edit' ? 'border-(--seal-ink) bg-(--seal-ink)' : 'border-(--design-ink)/40 bg-(--design-ink)/10',
              )}
            />
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-(--design-muted)">
              <time dateTime={change.at} title={new Date(change.at).toUTCString()}>
                {formatDate(change.at)}
              </time>
              {' · '}
              {change.source === 'edit' ? 'Amendment' : 'Residence'}
            </p>
            <p className="mt-0.5 text-[15px] text-(--design-ink)">
              {change.note ?? (change.source === 'world' ? 'Seen on the map' : change.summary)}
              {change.note ? <span className="text-(--design-muted)"> · {change.summary}</span> : null}
            </p>
            {change.entries.length ? <EntryChanges entries={change.entries} list={list} /> : null}
            {people.length ? <ul className="mt-2 space-y-1">{people.slice(0, SHOWN).map(row)}</ul> : null}
            {people.length > SHOWN ? (
              <details className="group mt-1">
                <summary className="cursor-pointer text-[13px] font-medium text-(--design-link) marker:text-(--design-muted)">
                  <span className="group-open:hidden">{plural(people.length - SHOWN, 'more player')}</span>
                  <span className="hidden group-open:inline">Fewer</span>
                </summary>
                <ul className="mt-1 space-y-1">{people.slice(SHOWN).map(row)}</ul>
              </details>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/** What a list names: players with their reasons, and the towns and nations whose residents it takes. */
export function ListEntries({ list, className }: { list: SanctionList; className?: string }) {
  const counts = new Map<string, number>()
  for (const player of list.players) {
    for (const via of player.via) if (via.kind !== 'player') counts.set(via.entry, (counts.get(via.entry) ?? 0) + 1)
  }
  const places = list.entries.filter((entry) => entry.kind !== 'player')
  const named = list.entries.filter((entry) => entry.kind === 'player')
  return (
    <div className={cn('grid gap-8 md:grid-cols-2', className)}>
      {places.length ? (
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--design-muted)">Towns and nations</p>
          <ul className="mt-3 space-y-3">
            {places.map((entry) => (
              <li className="border-l-[3px] border-(--seal-ink) pl-3" key={entry.id}>
                <p className="font-(family-name:--design-display) text-lg leading-snug text-(--design-ink)">
                  {spoken(entry.name)}
                  <span className="ml-2 font-label text-[10px] uppercase tracking-[0.16em] text-(--design-muted)">
                    {ENTRY_WORDS[entry.kind]} · {plural(counts.get(entry.id) ?? 0, 'resident')} listed
                  </span>
                </p>
                {entry.reason ? <p className="text-[13px] leading-snug text-(--design-muted)">{entry.reason}</p> : null}
                {entry.exceptTowns?.length || entry.exceptPlayers?.length ? (
                  <p className="text-[13px] leading-snug text-(--design-muted)">
                    Except {[...(entry.exceptTowns ?? []).map(spoken), ...(entry.exceptPlayers ?? [])].join(', ')}
                  </p>
                ) : null}
                <ClassMarks className="mt-1.5" classes={orderedClasses(entry.classes, list)} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {named.length ? (
        <div>
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--design-muted)">Named</p>
          <ul className="mt-3 space-y-2">
            {named.map((entry) => (
              <li key={entry.id}>
                <p className="font-mono text-[15px] text-(--design-ink)">{entry.name}</p>
                {entry.reason ? <p className="text-[13px] leading-snug text-(--design-muted)">{entry.reason}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/** The list's classes and what each means. */
export function ClassLegend({ list, className }: { list: SanctionList; className?: string }) {
  if (list.classes.length === 0) return null
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)]', className)}>
      {list.classes.map((item) => (
        <div className="contents" key={item.name}>
          <dt>
            <ClassMarks classes={[item.name]} />
          </dt>
          <dd className="text-sm leading-snug text-(--design-muted)">{item.description ?? ''}</dd>
        </div>
      ))}
    </dl>
  )
}
