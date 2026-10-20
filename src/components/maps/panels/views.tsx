'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/blocks/components/shared'
import type { MapViewData } from '@/maps/data'
import { VIEW_ASPECTS } from '@/maps/registry'
import { mapsHref } from '@/maps/url'

import { api, messageOf } from '../api'
import { useMaps } from '../context'
import { viewEditor } from '../state'
import { Notice, TextButton } from '../ui/chrome'
import { Icon } from '../ui/icons'
import { useCopy } from '../ui/Readouts'
import { PanelSection } from './shared'

/**
 * A person's map views, wherever they're listed: on the map's own front
 * for anyone who may draw them, and under the pencil. Each can be shown
 * on the map, redrawn, or linked to — the link an article's Map block
 * carries, which opens the map framed on the view with its highlights.
 */

/** What a view is, said once wherever views are listed. */
export function ViewsExplainer({ className }: { className?: string }) {
  return (
    <p className={cn('text-[13px] leading-relaxed text-ink-500', className)}>
      A map view is a framed piece of the map with highlights drawn on it, for an article’s{' '}
      <strong className="font-semibold text-ink-700">Map</strong> block. Readers see it in the
      article, or through its link; it isn’t drawn on the public map.
    </p>
  )
}

/** How a view is put in an article, for those who have one. */
function RegistryNote() {
  return (
    <p className="mt-4 text-xs leading-relaxed text-ink-500">
      To use one: in the Registry, add a <strong>Map</strong> block to an article and choose the
      view by its title.{' '}
      <a
        className="text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900"
        href="/admin/collections/articles"
        rel="noopener"
        target="_blank"
      >
        Open the Registry <span aria-hidden="true">↗</span>
      </a>
    </p>
  )
}

/** The views, fetched afresh each time the list is shown or the scope flips, with a way to ask again. */
function useViews(everyone: boolean) {
  const { rights } = useMaps()
  const [list, setList] = useState<MapViewData[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const user = rights.user?.id ?? null
  useEffect(() => {
    let cancelled = false
    api
      .myViews(everyone ? null : user)
      .then((views) => !cancelled && setList(views))
      .catch((caught: unknown) => !cancelled && setError(messageOf(caught)))
    return () => {
      cancelled = true
    }
  }, [everyone, user, attempt])
  const retry = () => {
    setError(null)
    setList(null)
    setAttempt((count) => count + 1)
  }
  return { list, error, retry }
}

function ViewRow({ view }: { view: MapViewData }) {
  const { rights, showView, edit, look, closeEditor, data } = useMaps()
  const [copied, copy] = useCopy()
  const own = view.createdBy == null || view.createdBy === rights.user?.id || rights.anywhere
  const redraw = () => {
    closeEditor()
    edit(viewEditor(view, view.layers))
    look({ centre: view.centre, span: view.span, aspect: view.aspect })
  }
  // Absolute, so it can be pasted anywhere; the same address a Map block's mark carries.
  const link = () => `${window.location.origin}${mapsHref({ view: view.id })}`
  const highlights = view.drawings.length
  const [x, z] = view.centre
  const town = data.towns.find(
    (candidate) =>
      candidate.bounds &&
      x >= candidate.bounds.minX &&
      x <= candidate.bounds.maxX &&
      z >= candidate.bounds.minZ &&
      z <= candidate.bounds.maxZ,
  )
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-saffron-600" name="frame" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink-900">{view.title}</span>
          <span className="block text-xs text-ink-500">
            {VIEW_ASPECTS[view.aspect].label} · {view.span.toLocaleString('en-GB')} blocks across ·{' '}
            {highlights} highlight{highlights === 1 ? '' : 's'}
            {town ? ` · ${town.name.replace(/_/g, ' ')}` : ''}
          </span>
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
        <TextButton className="px-2 py-1" onClick={() => showView(view)}>
          <Icon className="h-3.5 w-3.5" name="eye" /> Show
        </TextButton>
        {own ? (
          <TextButton className="px-2 py-1" onClick={redraw}>
            <Icon className="h-3.5 w-3.5" name="pencil" /> Edit
          </TextButton>
        ) : null}
        <TextButton
          aria-label={copied ? 'Copied the link' : 'Copy the link to this view'}
          className="px-2 py-1"
          onClick={() => copy(link())}
        >
          <Icon className="h-3.5 w-3.5" name={copied ? 'check' : 'copy'} />{' '}
          <span aria-live="polite">{copied ? 'Copied' : 'Copy link'}</span>
        </TextButton>
      </div>
    </li>
  )
}

/** The rows themselves: fetching, failed (with Retry), empty, or the list. */
export function ViewRows({
  everyone,
  limit,
  className,
}: {
  everyone: boolean
  /** Show at most this many, with a word about the rest. */
  limit?: number
  className?: string
}) {
  const { list, error, retry } = useViews(everyone)
  const { edit } = useMaps()
  const shown = limit != null && list ? list.slice(0, limit) : list
  const rest = list && shown ? list.length - shown.length : 0
  return (
    <div className={className}>
      {error ? (
        <Notice className="flex items-center gap-3" tone="warning">
          <span className="min-w-0 flex-1">{error}</span>
          <TextButton className="shrink-0 px-2 py-1" onClick={retry}>
            Retry
          </TextButton>
        </Notice>
      ) : !list ? (
        <p className="text-sm text-ink-500">Fetching…</p>
      ) : list.length === 0 ? (
        <Notice>
          {everyone ? 'No views drawn yet.' : 'None of yours yet.'} Choose “New map view” to draw
          one.
        </Notice>
      ) : (
        <ul className="divide-y divide-sand-300 border-y border-sand-300">
          {shown!.map((view) => (
            <ViewRow key={view.id} view={view} />
          ))}
        </ul>
      )}
      {rest > 0 ? (
        <TextButton
          className="mt-2 px-2 py-1"
          onClick={() => edit({ kind: 'views', everyone })}
        >
          All {list!.length} views
        </TextButton>
      ) : null}
      {list?.length ? <RegistryNote /> : null}
    </div>
  )
}

/**
 * On the map's own front, for anyone who may draw views: theirs, so a view
 * made for an article has a home on /maps, with a way to draw another.
 */
export function YourViews() {
  const { rights, edit, layers } = useMaps()
  const [everyone, setEveryone] = useState(false)
  if (!rights.views) return null
  return (
    <PanelSection
      action={
        <TextButton
          className="px-2 py-1"
          onClick={() =>
            edit({ ...viewEditor(null, layers), createdBy: rights.user?.id ?? null })
          }
        >
          <Icon className="h-3.5 w-3.5" name="frame" /> New map view
        </TextButton>
      }
      title={everyone ? 'Everyone’s map views' : 'Your map views'}
    >
      <ViewsExplainer />
      {rights.anywhere ? (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
          <input
            checked={everyone}
            className="h-4 w-4 accent-sea-800"
            onChange={(event) => setEveryone(event.target.checked)}
            type="checkbox"
          />
          Show everyone’s
        </label>
      ) : null}
      <ViewRows className="mt-3" everyone={everyone} limit={6} />
    </PanelSection>
  )
}
