'use client'

import { useMemo } from 'react'

import {
  abroadNationPage,
  abroadTownPage,
  homeNationOf,
  relationWith,
  worldSlug,
  type Abroad,
} from '@/maps/abroad'
import type { MapData, MapTown } from '@/maps/data'
import { settlements, siteFacts } from '@/maps/sites'
import type { MapSelection } from '@/maps/url'

import { useMaps } from '../context'
import { AbroadTownPanel, NationPanel } from './AbroadPanel'
import { ComingText, ComingWords } from './coming'
import { EventPanel } from './EventPanel'
import { HomePanel } from './HomePanel'
import { PlacePanel } from './PlacePanel'
import { RoadPanel } from './RoadPanel'
import { EYEBROW } from './shared'
import { SitePanel } from './SitePanel'
import { TownPanel } from './TownPanel'

/**
 * A page's panel before the page itself arrives, drawn by the shell the
 * moment something is opened: the page's own panel, given what the
 * browser already holds (the nation's data, and the world abroad once it
 * has come), with what only the server has — a town's record and census,
 * an event's announcement, the papers — still to come (./coming.tsx).
 * Being the same panel, laid out the same, the page takes its place
 * without a jump. A road, a town abroad and another nation are whole
 * already: the browser holds everything their pages say, worked out by
 * the same functions the server uses (src/maps/abroad.ts).
 */
export function Preview({ selection }: { selection: MapSelection | null }) {
  const { data, world } = useMaps()
  const home = useMemo(() => homeNationOf(data.towns), [data.towns])
  // Worked out once per opening, not on each of the shell's renders: the way there searches every spawn on the server.
  const abroad = useMemo(() => abroadPage(world, selection, home), [world, selection, home])

  if (!selection) return <HomePanel census={undefined} data={data} />
  switch (selection.kind) {
    case 'town': {
      const town = data.towns.find((candidate) => candidate.slug === selection.slug)
      return town ? <OurTown data={data} town={town} /> : <Unknown kind="Town" />
    }
    case 'place': {
      const place = data.places.find((candidate) => candidate.id === selection.id)
      return place ? <PlacePanel articles={undefined} data={data} place={place} /> : <Unknown kind="Place" />
    }
    case 'road': {
      const road = data.roads.find((candidate) => candidate.id === selection.id)
      return road ? <RoadPanel data={data} road={road} /> : <Unknown kind="Road" />
    }
    case 'event': {
      const event = data.events.find((candidate) => candidate.id === selection.id)
      return event ? (
        <EventPanel article={undefined} articles={undefined} data={data} event={event} />
      ) : (
        <Unknown kind="Event" />
      )
    }
    case 'abroad': {
      if (abroad?.kind === 'town') {
        return (
          <AbroadTownPanel
            capital={abroad.capital}
            nation={abroad.nation}
            relation={relationWith(abroad.nation?.name, data.relations)}
            route={abroad.route}
            town={abroad.town}
            trading={abroad.trading}
          />
        )
      }
      // One of Azania's own, by its name abroad: the page sends the reader on to its own.
      const own = abroad?.kind === 'own' ? data.towns.find((town) => town.townyId === abroad.townyId) : null
      return own ? <OurTown data={data} town={own} /> : <Unknown kind="A town abroad" />
    }
    case 'nation': {
      // Azania's own nation is the map's front.
      if (home && worldSlug(home) === selection.slug) return <HomePanel census={undefined} data={data} />
      if (abroad?.kind === 'nation') {
        return (
          <NationPanel
            capital={abroad.capital}
            fit={abroad.fit}
            members={abroad.members}
            nation={abroad.nation}
            ours={settlements(data.towns).map((town) => ({ name: town.name, slug: town.slug, home: town.home }))}
            relation={relationWith(abroad.nation.name, data.relations)}
          />
        )
      }
      return <Unknown kind="Nation" />
    }
  }
}

/** The page abroad a selection names, once the world has come; null for none, or for a selection at home. */
function abroadPage(world: Abroad | null, selection: MapSelection | null, home: string | null) {
  if (!world) return null
  if (selection?.kind === 'abroad') return abroadTownPage(world, selection.slug, home)
  if (selection?.kind === 'nation') return abroadNationPage(world, selection.slug, home)
  return null
}

/** One of Azania's towns, or a site it holds, as its page will show it, the server's part to come. */
function OurTown({ town, data }: { town: MapTown; data: MapData }) {
  const site = siteFacts(town)
  return site ? (
    <SitePanel articles={undefined} data={data} facts={site} record={undefined} town={town} />
  ) : (
    <TownPanel articles={undefined} census={undefined} data={data} record={undefined} town={town} />
  )
}

/**
 * Something the browser knows nothing of yet — a town abroad before the
 * world has come, or a thing just drawn by someone else — as the shape of
 * any panel: its kind, then its name, facts and lines to come.
 */
function Unknown({ kind }: { kind: string }) {
  return (
    <article className="pb-6">
      <header className="px-4 pt-4">
        <p className={EYEBROW}>{kind}</p>
        <ComingText className="mt-1 font-display text-2xl leading-tight" lines={1} />
        <ComingText className="mt-3 text-sm leading-relaxed" lines={2} />
      </header>
      <div aria-hidden="true" className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 px-4">
        {['4.5rem', '6rem', '5rem', '3.5rem'].map((width) => (
          <div key={width}>
            <p className="font-label text-[10px]">
              <ComingWords width="4rem" />
            </p>
            <p className="mt-0.5 text-sm">
              <ComingWords width={width} />
            </p>
          </div>
        ))}
      </div>
      <section className="mt-6 border-t border-sand-300 px-4 pt-4">
        <ComingText className="font-display text-lg" lines={1} />
        <ComingText className="mt-2 text-sm leading-relaxed" lines={3} />
      </section>
    </article>
  )
}
