'use client'

import { SelectInput, useField } from '@payloadcms/ui'
import type { OptionObject, TextFieldClientProps } from 'payload'
import { useEffect, useMemo, useState } from 'react'

import { spoken } from '@/maps/data'
import { WORLD_URL, type PackedWorld } from '@/maps/world'

/**
 * A nation's or a town's name in Settings → Azania Maps, picked from those
 * on the Rulercraft map now (/maps/world.json) rather than typed, so it's
 * spelt as the map has it and the diplomacy layer, the sync and the siege
 * alerts find it. A name already saved stays, said to be gone, when it's no
 * longer on the map; and while the map can't be read, the field takes what
 * it holds. Wired up as the text fields' Field component in
 * src/globals/AzaniaMaps.ts, `of` saying which.
 */

type Of = 'nations' | 'towns'

type Names = { status: 'asking' } | { status: 'known'; options: OptionObject[] } | { status: 'unreachable' }

/** One reading of the world a page, for every field that asks (the lists' entry fields too). */
let reading: Promise<PackedWorld> | null = null
export const readWorld = () =>
  (reading ??= fetch(WORLD_URL, { credentials: 'omit' })
    .then((response) => (response.ok ? (response.json() as Promise<PackedWorld>) : Promise.reject(new Error(String(response.status)))))
    .catch((error: unknown) => {
      reading = null
      throw error
    }))

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

function optionsOf(world: PackedWorld, of: Of): OptionObject[] {
  if (of === 'nations') {
    return [...world.nations]
      .sort((a, b) => spoken(a.name).localeCompare(spoken(b.name)))
      .map((nation) => ({ value: nation.name, label: `${spoken(nation.name)} · ${plural(nation.towns, 'town')}` }))
  }
  return world.towns
    .filter((town) => town.kind === 'town')
    .sort((a, b) => spoken(a.name).localeCompare(spoken(b.name)))
    .map((town) => ({ value: town.name, label: `${spoken(town.name)} · ${town.nation ? spoken(town.nation) : 'no nation'}` }))
}

export function WorldNameField({ field, path: pathFromProps, readOnly, of = 'nations' }: TextFieldClientProps & { of?: Of }) {
  const { path, value, setValue, showError, disabled } = useField<string>({ potentiallyStalePath: pathFromProps })
  const [names, setNames] = useState<Names>({ status: 'asking' })

  useEffect(() => {
    let cancelled = false
    readWorld()
      .then((world) => !cancelled && setNames({ status: 'known', options: optionsOf(world, of) }))
      .catch(() => !cancelled && setNames({ status: 'unreachable' }))
    return () => {
      cancelled = true
    }
  }, [of])

  const options = useMemo(() => {
    const listed = names.status === 'known' ? names.options : []
    // A name saved before, and gone from the map since (or not yet read): kept, and said to be.
    if (!value || listed.some((option) => option.value === value)) return listed
    const gone = names.status === 'known' ? ' · not on the map now' : ''
    return [{ value, label: `${spoken(value)}${gone}` }, ...listed]
  }, [names, value])

  const description = field.admin?.description
  const said = typeof description === 'string' ? description : undefined
  const style = field.admin?.width ? ({ '--field-width': field.admin.width } as React.CSSProperties) : { flex: '1 1 auto' }

  return (
    <SelectInput
      description={
        names.status === 'unreachable'
          ? `${said ? `${said} ` : ''}The Rulercraft map can’t be read just now, so only what’s saved can be kept; try again later.`
          : said
      }
      isClearable={false}
      label={field.label}
      name={field.name}
      onChange={(option) => {
        if (readOnly || disabled) return
        const picked = Array.isArray(option) ? option[0] : option
        setValue(picked && typeof picked === 'object' && 'value' in picked ? String(picked.value) : null)
      }}
      options={options}
      path={path}
      placeholder={
        names.status === 'asking'
          ? 'Reading the map…'
          : of === 'nations'
            ? 'Pick a nation on the map'
            : 'Pick a town on the map'
      }
      readOnly={readOnly || disabled}
      required={field.required}
      showError={showError}
      style={style}
      value={value ?? undefined}
    />
  )
}
