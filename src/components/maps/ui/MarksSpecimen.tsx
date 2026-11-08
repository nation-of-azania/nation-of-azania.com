import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'

import '../maps.css'
import { CapBalance, Delta, HeadSlots, Meter, Pips, RankStrip, ReachBar, Tally, type MarkSize } from './Marks'

/**
 * Every mark (./Marks.tsx) laid out for the eye, in both sizes, on each
 * of the three grounds it must hold on: the light panel, the war sidebar
 * (.az-war, written in the dark tokens and mirrored in the light
 * appearance), and the dark appearance (.az-maps[data-theme='dark']).
 * Served on one's own machine only (src/app/(frontend)/dev/marks). Hover
 * a mark for the sentence it says to a screen reader.
 */

const CASES: { name: string; mark: (size: MarkSize) => ReactNode }[] = [
  { name: 'Pips · 2 of 3, the third on now', mark: (size) => <Pips current={2} done={2} noun="sessions fought" of={3} size={size} /> },
  { name: 'Pips · 7 of 9, attackers', mark: (size) => <Pips done={7} noun="sessions fought" of={9} side="attackers" size={size} /> },
  { name: 'Pips · 13 of 20, the 14th on now', mark: (size) => <Pips current={13} done={13} noun="tries" of={20} size={size} /> },
  { name: 'Pips · 26 of 52 falls back to a meter', mark: (size) => <Pips done={26} noun="online" of={52} size={size} /> },
  { name: 'Meter · 6 of 52 online', mark: (size) => <Meter noun="online" of={52} size={size} value={6} /> },
  { name: 'Meter · 6 of 52, 10 needed (a bullet graph)', mark: (size) => <Meter noun="online" of={52} size={size} target={10} value={6} /> },
  { name: 'Meter · 1,030 of 1,230 points, defenders', mark: (size) => <Meter noun="points" of={1230} side="defenders" size={size} value={1030} /> },
  {
    name: 'Tally · 6 held, 8 died, 7 left, of 21 tries',
    mark: (size) => (
      <Tally
        noun="tries"
        of={21}
        parts={[
          { label: 'held', value: 6 },
          { label: 'died', value: 8 },
          { label: 'left', value: 7 },
        ]}
        size={size}
      />
    ),
  },
  {
    name: 'Tally · the sides’ colours, and a rest left as track',
    mark: (size) => (
      <Tally
        noun="fighters"
        of={12}
        parts={[
          { label: 'attackers', side: 'attackers', value: 5 },
          { label: 'defenders', side: 'defenders', value: 4 },
        ]}
        size={size}
      />
    ),
  },
  { name: 'CapBalance · +1,250 now, +5,720 after, with ends', mark: (size) => <CapBalance after={5720} ends={['Azania', 'Sekhra']} names={['Azania', 'Sekhra']} now={1250} size={size} /> },
  { name: 'CapBalance · −3,200, the defenders’, with the figure', mark: (size) => <CapBalance figure now={-3200} size={size} /> },
  { name: 'CapBalance · at the cap, +7,000', mark: (size) => <CapBalance figure now={7000} size={size} /> },
  { name: 'CapBalance · even, −1,400 projected', mark: (size) => <CapBalance after={-1400} figure now={0} size={size} /> },
  { name: 'CapBalance · a lead shrinking: +4,000 to +900', mark: (size) => <CapBalance after={900} figure now={4000} size={size} /> },
  { name: 'RankStrip · 4th of 39', mark: (size) => <RankStrip noun="nations by people" of={39} rank={4} size={size} /> },
  { name: 'RankStrip · 1st of 10', mark: (size) => <RankStrip noun="in Africa" of={10} rank={1} size={size} /> },
  { name: 'RankStrip · 39th of 39', mark: (size) => <RankStrip of={39} rank={39} size={size} /> },
  { name: 'ReachBar · 4,700 of 12,320 blocks', mark: (size) => <ReachBar distance={4700} limit={12320} size={size} /> },
  { name: 'ReachBar · 14,000 blocks, beyond 12,320', mark: (size) => <ReachBar distance={14000} limit={12320} size={size} /> },
  { name: 'HeadSlots · 1 needed · 5 online + 1 ally', mark: (size) => <HeadSlots allies={1} needed={1} online={5} size={size} /> },
  { name: 'HeadSlots · 3 needed · 1 online + 1 ally: out of reach', mark: (size) => <HeadSlots allies={1} needed={3} online={1} size={size} /> },
  { name: 'HeadSlots · 8 needed · 5 online', mark: (size) => <HeadSlots needed={8} online={5} size={size} /> },
  {
    name: 'Delta · up is good; down is good; no change; no better way',
    mark: (size) => (
      <span className="inline-flex flex-wrap items-center gap-2">
        <Delta good="up" noun="people" size={size} value={12} />
        <Delta good="up" size={size} value={-3} />
        <Delta good="down" size={size} value={-3} />
        <Delta size={size} value={0} />
        <Delta size={size} value={2} />
      </span>
    ),
  },
]

/** The marks on one ground, the row size beside the panel size. */
function Ground({ title, className, head, soft }: { title: string; className: string; head: string; soft: string }) {
  return (
    <section className={cn('px-4 py-4', className)}>
      <h2 className={cn('font-label text-[12px] font-semibold uppercase tracking-[0.16em]', soft)}>{title}</h2>
      <div className={cn('mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', head)}>
        {CASES.map((item) => (
          <div className="contents" key={item.name}>
            {(['row', 'panel'] as const).map((size) => (
              <figure className="min-w-0" key={size}>
                <figcaption className={cn('mb-1 truncate text-[12px]', soft)}>
                  {item.name} <span className="opacity-70">· {size}</span>
                </figcaption>
                <div className="max-w-72">{item.mark(size)}</div>
              </figure>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export function MarksSpecimen() {
  return (
    <main className="min-h-screen bg-sand-50 font-body text-ink-900">
      <div className="px-4 pt-4">
        <p className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-saffron-600">Azania Maps · specimen</p>
        <h1 className="mt-1 font-display text-2xl text-sea-950">The panels’ marks</h1>
        <p className="mt-1 max-w-prose text-[14px] text-ink-500">
          Each mark in the row size and the panel size, on the light panel, the war sidebar and the dark appearance. Hover a mark for the sentence it says to a screen reader.
        </p>
      </div>
      <div className="az-maps mt-3" data-theme="light">
        <Ground className="bg-sand-50" head="text-ink-900" soft="text-ink-500" title="Light appearance · a panel" />
        <div className="az-war bg-sea-950 text-sand-50">
          <Ground className="" head="text-sand-50" soft="text-sand-200/75" title="Light appearance · the war sidebar" />
        </div>
      </div>
      <div className="az-maps" data-theme="dark">
        <Ground className="bg-sand-50" head="text-ink-900" soft="text-ink-500" title="Dark appearance · a panel" />
        <div className="az-war bg-sea-950 text-sand-50">
          <Ground className="" head="text-sand-50" soft="text-sand-200/75" title="Dark appearance · the war sidebar" />
        </div>
      </div>
    </main>
  )
}
