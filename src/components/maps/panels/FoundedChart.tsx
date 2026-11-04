'use client'

import { useId, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import type { WorldStats } from '@/maps/worldStats'

/**
 * When the towns standing today were founded: a bar a month, the towns
 * founded that month, in the growth charts' frame (./GrowthChart.tsx),
 * with the month under the pointer written above. Towns that have since
 * fallen aren't in it, so it isn't a history of the server, and the copy
 * beside it says so.
 */

const FRAME = { width: 320, height: 96, pad: { left: 8, right: 34, top: 10, bottom: 18 } }

const monthLabel = (month: string, withYear = true) => {
  const parsed = new Date(`${month}-01T00:00:00Z`)
  return new Intl.DateTimeFormat('en-GB', { month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(parsed)
}

export function FoundedChart({ months, className }: { months: WorldStats['founded']; className?: string }) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const { width, height, pad } = FRAME
  const inner = { width: width - pad.left - pad.right, height: height - pad.top - pad.bottom }
  const most = Math.max(1, ...months.map((month) => month.towns))
  const slot = months.length ? inner.width / months.length : inner.width
  const bar = Math.max(1, Math.min(slot * 0.72, 14))
  const x = (index: number) => pad.left + slot * index + (slot - bar) / 2
  const y = (towns: number) => pad.top + (1 - towns / most) * inner.height
  const shown = hover != null ? months[hover] : null
  const busiest = months.reduce((best, month) => (month.towns > best.towns ? month : best), months[0])
  const title = months.length
    ? `Towns standing today by the month they were founded, ${monthLabel(months[0].month)} to ${monthLabel(months[months.length - 1].month)}; the busiest month ${monthLabel(busiest.month)}, with ${busiest.towns}.`
    : 'No founding dates recorded.'
  if (!months.length) return null

  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">Founded</span>
        <span className="text-[15px] text-ink-700">
          <span className="font-semibold text-ink-900">{shown ? shown.towns : busiest.towns}</span>
          <span className="ml-1.5 text-[13px] text-ink-500">
            {shown
              ? `${shown.towns === 1 ? 'town' : 'towns'} in ${monthLabel(shown.month)}, ${shown.residents.toLocaleString('en-GB')} people today`
              : `in ${monthLabel(busiest.month)}, the busiest month`}
          </span>
        </span>
      </figcaption>
      <svg
        aria-labelledby={`${id}-title`}
        className="mt-1 h-24 w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const px = ((event.clientX - rect.left) / rect.width) * width
          const index = Math.floor((px - pad.left) / slot)
          setHover(index >= 0 && index < months.length ? index : null)
        }}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id={`${id}-title`}>{title}</title>
        <line className="stroke-sand-300" strokeWidth={1} x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} />
        <line className="stroke-sand-200" strokeWidth={1} x1={pad.left} x2={width - pad.right} y1={y(most / 2)} y2={y(most / 2)} />
        {months.map((month, index) =>
          month.towns > 0 ? (
            <rect
              className={cn('transition-opacity duration-150 motion-reduce:transition-none', hover != null && hover !== index ? 'opacity-50' : 'opacity-100')}
              fill="#2c6b93"
              height={height - pad.bottom - y(month.towns)}
              key={month.month}
              width={bar}
              x={x(index)}
              y={y(month.towns)}
            />
          ) : null,
        )}
        {hover != null ? (
          <line className="stroke-ink-500" strokeOpacity={0.4} strokeWidth={1} x1={x(hover) + bar / 2} x2={x(hover) + bar / 2} y1={pad.top} y2={height - pad.bottom} />
        ) : null}
        <text className="fill-ink-500 font-body" fontSize={10} x={width - pad.right + 6} y={pad.top + 3.5}>
          {most}
        </text>
        <text className="fill-ink-400 font-body" fontSize={9} x={pad.left} y={height - 5}>
          {monthLabel(months[0].month, months.length > 12)}
        </text>
        <text className="fill-ink-400 font-body" fontSize={9} textAnchor="end" x={width - pad.right} y={height - 5}>
          {monthLabel(months[months.length - 1].month)}
        </text>
      </svg>
    </figure>
  )
}
