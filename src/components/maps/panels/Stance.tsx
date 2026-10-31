'use client'

import { useId, useState, type FormEvent } from 'react'

import { cn } from '@/blocks/components/shared'
import { relationWith } from '@/maps/abroad'
import { spoken, type Relation } from '@/maps/data'
import { STANCE_COLOURS } from '@/maps/palette'
import type { Stance } from '@/maps/registry'

import { api, saveMessageOf } from '../api'
import { useMaps, useMapsIfAny } from '../context'
import { FIELD, LABEL, Notice, TextButton } from '../ui/chrome'
import { KEY_ORDER, STANCE_WORDS, StanceSwatch, stanceLabel } from '../ui/Diplomacy'
import { Icon } from '../ui/icons'
import { LayerToggle } from './islands'
import { EYEBROW, PanelSection } from './shared'

/**
 * Where Azania stands with a nation, on the nation's page and on its
 * towns': the stance in a sentence, in its colour, with the admins' line
 * about it, a way to show the diplomacy layer, and, for Azania's admins
 * and diplomats, the stance set right here. The pages are cached for
 * everyone, so the panel takes the stance from the shell, which holds
 * what a diplomat has just set ahead of the pages, and falls back on the
 * page's own line.
 */

const LINK = 'text-sea-700 underline decoration-dotted underline-offset-2 hover:text-sea-900 focus-visible:outline-saffron-500'

/** How long a note may be, as the Registry allows (src/app/(frontend)/maps/diplomacy/route.ts). */
const NOTE_MAX = 140

export function StanceNote({
  nation,
  relation: served,
  quietWhenNeutral = false,
  className,
}: {
  /** The nation's name as the map spells it. */
  nation: string
  /** The stance as the page was rendered; null for neutral. */
  relation: Relation | null
  /** On a town's page, a neutral nation isn't worth a line, unless the reader may set the stance. */
  quietWhenNeutral?: boolean
  className?: string
}) {
  const maps = useMapsIfAny()
  const relation = maps ? relationWith(nation, maps.data.relations) : served
  const stance = relation?.stance ?? 'neutral'
  // Only the Registry's own word gives the controls: nothing while it's still asked, nor when it can't be reached.
  const mayEdit = Boolean(maps && maps.rightsStatus === 'known' && maps.rights.diplomacy)
  const [editing, setEditing] = useState(false)
  if (stance === 'neutral' && quietWhenNeutral && !mayEdit) return null
  const colour = STANCE_COLOURS[stance]
  return (
    <section
      aria-label={`Azania’s stance toward ${spoken(nation)}`}
      className={cn('border-l-[3px] px-3 py-2', className)}
      style={{ borderColor: colour.line, background: `color-mix(in srgb, ${colour.line} 9%, transparent)` }}
    >
      {editing && maps ? (
        <StanceForm nation={nation} onDone={() => setEditing(false)} relation={relation} />
      ) : (
        <div className="flex items-start gap-2.5">
          <StanceSwatch className="mt-1" stance={stance} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold leading-snug" style={{ color: colour.text }}>
              {STANCE_WORDS[stance](spoken(nation))}
            </p>
            {relation?.note ? <p className="mt-0.5 text-[14px] leading-snug text-ink-700">{relation.note}</p> : null}
            {maps ? (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                <LayerToggle className={LINK} layer="diplomacy" off="Hide the diplomacy layer" on="Show on the map" />
                {mayEdit ? (
                  <button className={cn('inline-flex items-center gap-1', LINK)} onClick={() => setEditing(true)} type="button">
                    <Icon className="h-3 w-3" name="pencil" /> Set the stance
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

/**
 * The stance set, in place: the six stances to choose from, a line for
 * readers, and Save. Saved through the Registry as the signed-in person,
 * whose refusal is shown as it came; a save that never got there leaves
 * the choice where it is, to try again. Neutral takes the nation off the
 * list, since every nation not named is neutral.
 */
function StanceForm({ nation, relation, onDone }: { nation: string; relation: Relation | null; onDone: () => void }) {
  const { setRelations, refresh } = useMaps()
  const id = useId()
  const was: Stance | 'neutral' = relation?.stance ?? 'neutral'
  const [stance, setStance] = useState<Stance | 'neutral'>(was)
  const [note, setNote] = useState(relation?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const changed = stance !== was || note.trim() !== (relation?.note ?? '')

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!changed || busy) return
    setBusy(true)
    setError(null)
    try {
      const relations = await api.saveStance(nation, stance, note.trim())
      setRelations(relations)
      refresh()
      onDone()
    } catch (caught) {
      setError(saveMessageOf(caught))
      setBusy(false)
    }
  }

  return (
    <form aria-labelledby={`${id}-title`} className="min-w-0" onSubmit={save}>
      <p className={EYEBROW} id={`${id}-title`}>
        Azania’s stance toward {spoken(nation)}
      </p>
      <div aria-label="Stance" className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3" role="radiogroup">
        {KEY_ORDER.map((choice) => {
          const picked = stance === choice
          return (
            <label
              className={cn(
                'flex cursor-pointer items-center gap-1.5 border px-2 py-1.5 text-[13px] font-semibold transition-colors has-focus-visible:outline-2 has-focus-visible:outline-saffron-500 motion-reduce:transition-none',
                picked ? 'border-sea-800 bg-sand-100 text-ink-900' : 'border-sand-300 bg-sand-50 text-ink-700 hover:border-sea-700',
              )}
              key={choice}
            >
              <input
                checked={picked}
                className="sr-only"
                disabled={busy}
                name={`${id}-stance`}
                onChange={() => setStance(choice)}
                type="radio"
                value={choice}
              />
              <StanceSwatch stance={choice} />
              <span className="truncate">{stanceLabel(choice)}</span>
            </label>
          )
        })}
      </div>
      <label className="mt-3 block">
        <span className={LABEL}>
          Note
          <span className="ms-1.5 font-normal normal-case tracking-normal text-ink-400">
            for readers · {note.length}/{NOTE_MAX}
          </span>
        </span>
        <input
          className={cn(FIELD, 'mt-1.5')}
          disabled={busy}
          maxLength={NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Treaty of Oasis, October 2026"
          type="text"
          value={note}
        />
      </label>
      <p className="mt-1.5 text-[12px] leading-snug text-ink-500">
        {stance === 'neutral'
          ? `Neutral takes ${spoken(nation)} off the list: every nation not named is neutral.`
          : 'Shown to everyone, on the map and on the nation’s page.'}
      </p>
      {error ? (
        <Notice className="mt-2" tone="warning">
          {error}
        </Notice>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TextButton disabled={busy || !changed} tone="primary" type="submit">
          {busy ? 'Saving…' : error ? 'Try again' : 'Save'}
        </TextButton>
        <TextButton disabled={busy} onClick={onDone}>
          Cancel
        </TextButton>
      </div>
    </form>
  )
}

/**
 * On the map's front, for a diplomat while no stance is set at all: where
 * to go to set one, since the front's own list of the diplomacy is empty
 * and says nothing. Nothing for anyone else.
 */
export function DiplomatHint({ relations }: { relations: number }) {
  const { rights, rightsStatus } = useMaps()
  if (relations > 0 || rightsStatus !== 'known' || !rights.diplomacy) return null
  return (
    <PanelSection title="Diplomacy">
      <p className="text-[15px] leading-relaxed text-ink-700">
        No stances are set yet, so every nation is neutral. Open another nation, from the map or the search, and set where
        Azania stands with it; the map’s diplomacy layer draws it for everyone.
      </p>
    </PanelSection>
  )
}
