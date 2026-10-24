import { cn } from '@/blocks/components/shared'

/**
 * What a panel shows of the server's part of a page while it's on its
 * way. The shell draws a panel the moment something is opened, from what
 * the browser already holds (./Preview.tsx), and these stand in for the
 * rest — a town's own lines, its census, the papers — shaped like what is
 * coming, under the same headings, so the reader can see what is being
 * fetched. They are bars in the sand of the page with a light passing over
 * them, shown only after a moment's grace, so a page that comes at once
 * never flashes them (the look is in ../maps.css: .az-coming). What the
 * server sends in their place fades in where they stood (.az-arrive).
 */

/** Something the server sends with the page: undefined while the page is on its way. */
export type Coming<T> = T | undefined

/**
 * The bar itself, laid over an invisible letter so that it takes exactly
 * the room a line of the surrounding text would, baseline and all, and is
 * as heavy as that text's letters.
 */
function Bar({ block = false, width, className }: { block?: boolean; width: string; className?: string }) {
  return (
    <span className={cn('relative', block ? 'block' : 'inline-block align-baseline', className)} style={{ width: block ? undefined : width }}>
      {'​'}
      <span
        className="az-coming absolute left-0 top-1/2 h-[0.62em] -translate-y-1/2"
        style={{ width: block ? width : '100%' }}
      />
    </span>
  )
}

/** A few words still on their way, inline: a fact's value, a figure. */
export function ComingWords({ width = '5rem', className }: { width?: string; className?: string }) {
  return (
    <span aria-hidden="true">
      <Bar className={className} width={width} />
    </span>
  )
}

/** The widths of a paragraph's lines, ragged as set type is, the last one short. */
const RAGGED = ['100%', '94%', '97%', '91%', '62%']

/**
 * A paragraph still on its way, in the type of the paragraph it stands
 * for (`className`), so each line is as tall as one of its lines; `last`
 * is how far its last line runs.
 */
export function ComingText({
  lines = 3,
  last = RAGGED[RAGGED.length - 1],
  className,
}: {
  lines?: number
  last?: string
  className?: string
}) {
  const widths = [...RAGGED.slice(0, lines - 1), last]
  return (
    <div aria-hidden="true" className={className}>
      {widths.map((width, index) => (
        <Bar block key={index} width={width} />
      ))}
    </div>
  )
}

/** The papers' clippings still on their way, as ./shared.tsx → ArticleLinks sets them: kicker, title, date. */
export function ComingClippings({ count = 1 }: { count?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-sand-300/70">
      {Array.from({ length: count }, (_, index) => (
        <li className="py-2.5" key={index}>
          <Bar block className="font-label text-[10px]" width="9rem" />
          <Bar block className="mt-0.5 font-display text-base leading-snug" width={index % 2 ? '68%' : '86%'} />
          <Bar block className="text-xs" width="5.5rem" />
        </li>
      ))}
    </ul>
  )
}
