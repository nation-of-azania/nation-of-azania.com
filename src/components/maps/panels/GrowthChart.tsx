'use client'

import { useId, useState, type ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import type { CensusPoint } from '@/lib/maps'

import { HintMark } from '../ui/Hint'
import { ComingWords, type Coming } from './coming'

/**
 * Growth, as the daily census records it: one measure per chart, the line
 * in one hue with a wash beneath, the latest value as the figure, and the
 * date under the pointer. Residents and claimed chunks are different
 * scales, so they are two charts, never one with two axes. Every colour is
 * a token's class (the hue as the text colour, drawn in currentColor), so
 * the dark appearance follows of itself.
 */

type Measure = 'residents' | 'chunks'

/** Each measure's hue, as a text-colour class the chart draws in: the sea for people, saffron for the ground. */
const HUES: Record<Measure, string> = {
  residents: 'text-sea-500',
  chunks: 'text-saffron-500',
}

/** The chart's frame, in its own units: the line within the padding, the latest figure in the right margin, the dates beneath. */
const FRAME = { width: 320, height: 96, pad: { left: 8, right: 44, top: 10, bottom: 18 } }

const compact = (value: number) =>
  value >= 10000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString('en-GB')

const dayLabel = (date: string) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(parsed)
}

export function GrowthChart({
  points,
  measure,
  label,
  className,
}: {
  points: CensusPoint[]
  measure: Measure
  label: string
  className?: string
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const hue = HUES[measure]
  const { width, height, pad } = FRAME
  const values = points.map((point) => point[measure])
  const latest = values[values.length - 1] ?? 0
  const first = values[0] ?? 0
  const min = Math.min(...values, latest)
  const max = Math.max(...values, latest)
  const span = max - min || Math.max(1, max * 0.2)
  const low = Math.max(0, min - span * 0.25)
  const high = max + span * 0.25
  const x = (index: number) =>
    pad.left +
    (points.length > 1
      ? (index / (points.length - 1)) * (width - pad.left - pad.right)
      : (width - pad.left - pad.right) / 2)
  const y = (value: number) =>
    pad.top + (1 - (value - low) / (high - low)) * (height - pad.top - pad.bottom)
  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(point[measure]).toFixed(1)}`,
    )
    .join('')
  const area =
    points.length > 1
      ? `${line}L${x(points.length - 1).toFixed(1)} ${(height - pad.bottom).toFixed(1)}L${x(0).toFixed(1)} ${(height - pad.bottom).toFixed(1)}Z`
      : ''
  const delta = latest - first
  const shown = hover != null ? points[hover] : null
  const title = `${label}: ${compact(latest)}${points.length > 1 ? `, from ${compact(first)} on ${dayLabel(points[0].date)}` : ''}`

  return (
    <figure className={cn('min-w-0', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          {label}
        </span>
        <span className="text-[15px] text-ink-700">
          <span className="font-semibold text-ink-900">
            {shown ? compact(shown[measure]) : compact(latest)}
          </span>
          <span className="ml-1.5 text-[13px] text-ink-500">
            {shown
              ? dayLabel(shown.date)
              : points.length > 1
                ? `${delta >= 0 ? '+' : ''}${compact(delta)} since ${dayLabel(points[0].date)}`
                : 'today'}
          </span>
        </span>
      </figcaption>
      <svg
        aria-labelledby={`${id}-title`}
        className="mt-1 h-24 w-full"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          if (points.length < 2) return
          const rect = event.currentTarget.getBoundingClientRect()
          const px = ((event.clientX - rect.left) / rect.width) * width
          const index = Math.round(
            ((px - pad.left) / (width - pad.left - pad.right)) * (points.length - 1),
          )
          setHover(Math.max(0, Math.min(points.length - 1, index)))
        }}
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <title id={`${id}-title`}>{title}</title>
        {/* Hairline grid: the floor, and one line through the middle. */}
        <line
          className="stroke-sand-200"
          strokeWidth={1}
          x1={pad.left}
          x2={width - pad.right}
          y1={height - pad.bottom}
          y2={height - pad.bottom}
        />
        <line
          className="stroke-sand-200"
          strokeWidth={1}
          x1={pad.left}
          x2={width - pad.right}
          y1={y((low + high) / 2)}
          y2={y((low + high) / 2)}
        />
        <g className={hue}>
          {area ? <path d={area} fill="currentColor" fillOpacity={0.12} /> : null}
          {points.length > 1 ? (
            <path
              d={line}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {points.length > 0 ? (
            <circle
              className="stroke-sand-50"
              cx={x(hover ?? points.length - 1)}
              cy={y((shown ?? points[points.length - 1])[measure])}
              fill="currentColor"
              r={4.5}
              strokeWidth={2}
            />
          ) : null}
        </g>
        {hover != null ? (
          <line
            className="stroke-ink-500"
            strokeDasharray="0"
            strokeOpacity={0.4}
            strokeWidth={1}
            x1={x(hover)}
            x2={x(hover)}
            y1={pad.top}
            y2={height - pad.bottom}
          />
        ) : null}
        <text
          className="fill-ink-500 font-body"
          fontSize={10}
          x={width - pad.right + 6}
          y={y(latest) + 3.5}
        >
          {compact(latest)}
        </text>
        {points.length > 1 ? (
          <>
            <text className="fill-ink-400 font-body" fontSize={9} x={pad.left} y={height - 5}>
              {dayLabel(points[0].date)}
            </text>
            <text
              className="fill-ink-400 font-body"
              fontSize={9}
              textAnchor="end"
              x={width - pad.right}
              y={height - 5}
            >
              {dayLabel(points[points.length - 1].date)}
            </text>
          </>
        ) : null}
      </svg>
    </figure>
  )
}

/**
 * A word-sized line of a measure's census, beside its count (Tufte's
 * sparkline): the shape of the last while, no axes, the figure printed
 * next to it by whoever draws it. Nothing is said in it a screen reader
 * needs, since the count and the chart carry the words.
 */
export function Spark({ values, measure, className }: { values: number[]; measure: Measure; className?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const path = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${((i / (values.length - 1)) * 60).toFixed(1)} ${(14 - ((v - min) / (max - min || 1)) * 12 + 1).toFixed(1)}`)
    .join('')
  return (
    <svg aria-hidden="true" className={cn('az-arrive min-w-0', HUES[measure], className)} preserveAspectRatio="none" viewBox="0 0 60 16">
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** A frame's margin as a share of its width or height, for laying HTML over it. */
const share = (part: number, whole: number) => `${(part / whole) * 100}%`

/**
 * A chart whose census is on its way (./coming.tsx): its label, the
 * figure to come, and the frame the line will be drawn in, its floor
 * ruled as the chart rules it, with a line's silhouette rising across it
 * and the two dates beneath. As tall as the chart, to the pixel.
 */
export function GrowthChartComing({ label, className }: { label: string; className?: string }) {
  const { width, height, pad } = FRAME
  const across = { left: share(pad.left, width), right: share(pad.right, width) }
  return (
    <figure aria-hidden="true" className={cn('min-w-0', className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          {label}
        </span>
        <span className="text-[15px]">
          <ComingWords width="6.5rem" />
        </span>
      </figcaption>
      <div className="relative mt-1 h-24 w-full">
        <span
          className="az-coming az-coming-rise absolute"
          style={{ ...across, top: share(pad.top, height), bottom: share(pad.bottom, height) }}
        />
        <span
          className="absolute border-t border-sand-200"
          style={{ ...across, bottom: share(pad.bottom, height) }}
        />
        <span className="az-coming absolute bottom-[3px] h-[7px] w-7" style={{ left: across.left }} />
        <span className="az-coming absolute bottom-[3px] h-[7px] w-7" style={{ right: across.right }} />
      </div>
    </figure>
  )
}

/**
 * A figure with a trend beneath: the nation's totals, at a glance. The
 * trend is the census's, still to come while the page is on its way. What
 * the figure counts, and what the trend rests on, is the tile's hint.
 */
export function StatTile({
  label,
  value,
  points,
  measure,
  hint,
}: {
  label: string
  value: number
  points: Coming<CensusPoint[]>
  measure: Measure | null
  hint?: ReactNode
}) {
  const values = measure && points ? points.map((point) => point[measure]) : []
  return (
    <div className="border border-sand-300 bg-sand-50 px-3 py-2.5">
      <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-500">
        {label}
        {hint ? <HintMark className="-mr-1.5" label={`About ${label.toLowerCase()}`} text={hint} /> : null}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="font-body text-2xl font-semibold leading-none text-ink-900">
          {value.toLocaleString('en-GB')}
        </p>
        {/* The trend gives way to a long figure, narrowing rather than spilling out of the tile. */}
        {measure && points === undefined ? (
          <span aria-hidden="true" className="az-coming az-coming-rise h-4 w-16 min-w-0" />
        ) : measure ? (
          <Spark className="h-4 w-16" measure={measure} values={values} />
        ) : null}
      </div>
    </div>
  )
}
