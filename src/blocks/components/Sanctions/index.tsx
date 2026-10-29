import Link from 'next/link'

import { getListChange, getListChanges, getSanctionList, sanctionListHref } from '@/lib/sanctions'
import { spoken } from '@/maps/data'
import type { SanctionsBlockType } from '@/payload-types'

import { ChangeLog, ChangeRecord, rollOf } from './parts'
import { PlayerRoll } from './Roll'

type Props = Pick<SanctionsBlockType, 'list' | 'show' | 'change' | 'through' | 'limit' | 'caption'>

const idOf = (value: unknown): number | null =>
  typeof value === 'number' ? value : ((value as { id?: number } | null | undefined)?.id ?? null)

/**
 * Sanction list: a sanction list (src/collections/Lists.ts) in an article,
 * the way a decree cites it: who is on it now (optionally only through one
 * of its towns or nations), one change as recorded (the save that added
 * those a decree names), or its changelog as it grows (residents moving in
 * and out, with dates). Read as a visitor (src/lib/sanctions.ts), so only a
 * public list is ever shown; anything else says so quietly in the frame.
 * Set in the paper's voice through the shell's --design-* properties.
 */
export async function SanctionsBlock({ list: listRef, show, change: changeRef, through, limit, caption }: Props) {
  const listId = idOf(listRef)
  const list = listId == null ? null : await getSanctionList({ id: listId })

  const frame = (body: React.ReactNode, title?: React.ReactNode, href?: string | null) => (
    <figure className="my-10">
      <div className="border-t-[3px] border-(--seal-ink) bg-(--design-ink)/[0.03] px-4 pt-4 pb-5 sm:px-6">
        {title ? (
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            {title}
            {href ? (
              <Link className="text-sm font-medium text-(--design-link) underline-offset-2 hover:underline" href={href}>
                The whole list →
              </Link>
            ) : null}
          </div>
        ) : null}
        {body}
        {href && !title ? (
          <Link className="mt-4 inline-block text-sm font-medium text-(--design-link) underline-offset-2 hover:underline" href={href}>
            The whole list →
          </Link>
        ) : null}
      </div>
      {caption ? <figcaption className="mt-2.5 text-sm leading-normal text-(--design-muted)">{caption}</figcaption> : null}
    </figure>
  )

  if (!list) {
    return frame(<p className="text-sm italic text-(--design-muted)">This sanction list isn’t public, or is no longer kept.</p>)
  }
  const href = await sanctionListHref(list)
  const heading = (eyebrow: string, extra?: string) => (
    <div>
      <p className="font-label text-[11px] uppercase tracking-[0.2em] text-(--seal-ink)">{eyebrow}</p>
      <p className="mt-1 font-(family-name:--design-display) text-xl leading-snug text-(--design-ink)">
        {list.name}
        {extra ? <span className="text-(--design-muted)"> · {extra}</span> : null}
      </p>
    </div>
  )

  if (show === 'change') {
    const changeId = idOf(changeRef)
    const found = changeId == null ? null : await getListChange(changeId)
    if (!found || found.list.id !== list.id) {
      return frame(<p className="text-sm italic text-(--design-muted)">This change is no longer on the record.</p>)
    }
    return frame(<ChangeRecord change={found.change} list={list} />, null, href)
  }

  const place = through?.trim() || null
  if (show === 'log') {
    const changes = await getListChanges(list.id, { name: place, limit: limit ?? 30 })
    return frame(
      <ChangeLog changes={changes} list={list} />,
      heading('Changelog', place ? `through ${spoken(place)}` : undefined),
      href,
    )
  }

  const players = rollOf(list, place)
  return frame(
    <PlayerRoll compact players={players} />,
    heading('Sanction list', place ? `through ${spoken(place)}` : undefined),
    href,
  )
}
