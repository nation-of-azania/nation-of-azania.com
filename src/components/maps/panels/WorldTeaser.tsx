'use client'

import Link from 'next/link'

import { WORLD_PATH } from '@/maps/url'

import { useMaps } from '../context'
import { Icon } from '../ui/icons'

/**
 * The way from the map's front to the world view (./WorldPanel.tsx): a
 * row under the nation's figures, with the server's own once the world
 * has come, so the nation's totals have the world's beside them.
 */
export function WorldTeaser() {
  const { world } = useMaps()
  // Players' towns alone, as the view counts them, and the nations with one.
  const towns = world?.reading.towns.filter((town) => town.kind === 'town')
  const residents = towns?.reduce((sum, town) => sum + town.residents, 0)
  const nations = new Set(towns?.map((town) => town.nation?.trim()).filter(Boolean)).size
  return (
    <Link className="group mx-4 mt-3 flex items-center gap-3 border border-sand-300 bg-sand-50 px-3 py-2.5 transition-colors hover:border-sea-700 hover:bg-sand-100" href={WORLD_PATH}>
      <Icon className="h-5 w-5 shrink-0 text-sea-700" name="globe" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-ink-900 group-hover:text-sea-800">The world in numbers</span>
        <span className="block truncate text-[13px] text-ink-500">
          {towns && residents != null
            ? `${towns.length.toLocaleString('en-GB')} towns and ${residents.toLocaleString('en-GB')} people in ${nations} nations, continent by continent`
            : 'Every continent, nation and town on the server, and where Azania stands'}
        </span>
      </span>
      <Icon className="h-4 w-4 shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5" name="arrow" />
    </Link>
  )
}
