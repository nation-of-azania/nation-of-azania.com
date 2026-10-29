'use client'

import { FieldDescription, FieldError, FieldLabel, TextInput, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import { useEffect, useMemo, useState } from 'react'

import { spoken } from '@/maps/data'

import { readWorld, WorldNameField } from './WorldNameField'

/**
 * A list entry's fields in Lists (src/collections/Lists.ts), made to be
 * filled from the map rather than from memory: the name follows the entry's
 * kind (a nation or town picked from those on the map, as WorldNameField
 * does; a player typed, with the residents the map knows suggested, and a
 * word when the name isn't in any town, with the nearest spelling that is:
 * "ClaytonPlaysMC" for "ClaytonPlayzMC"); and the classes ticked from the
 * list's own, above, instead of typed. Wired up as the fields' Field
 * components there.
 */

/** "entries.3.kind" beside "entries.3.name". */
const sibling = (path: string, name: string) => path.replace(/[^.]+$/, name)

type Resident = { name: string; town: string; nation: string | null }

/** Edit distance, small names only: enough to catch a letter swapped or doubled. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const was = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = was
    }
  }
  return row[b.length]
}

/** The name field: a nation or town from the map, or a player with the map's residents to hand. */
export function EntryNameField(props: TextFieldClientProps) {
  const kind = useFormFields(([fields]) => fields?.[sibling(props.path, 'kind')]?.value)
  if (kind === 'town' || kind === 'nation') return <WorldNameField {...props} of={kind === 'town' ? 'towns' : 'nations'} />
  return <PlayerNameField {...props} />
}

function PlayerNameField({ field, path: pathFromProps, readOnly }: TextFieldClientProps) {
  const { path, value, setValue, showError, disabled } = useField<string>({ potentiallyStalePath: pathFromProps })
  const [residents, setResidents] = useState<Map<string, Resident> | null>(null)

  useEffect(() => {
    let cancelled = false
    readWorld()
      .then((world) => {
        if (cancelled) return
        const known = new Map<string, Resident>()
        for (const town of world.towns) {
          for (const name of town.people ?? []) known.set(name.toLowerCase(), { name, town: town.name, nation: town.nation })
        }
        setResidents(known)
      })
      .catch(() => {
        // The map can't be read: the name is taken as typed.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const typed = (value ?? '').trim()
  const found = typed && residents ? residents.get(typed.toLowerCase()) : undefined
  const { nearest, matches } = useMemo(() => {
    if (!residents || typed.length < 2 || found) return { nearest: null, matches: [] as Resident[] }
    const lower = typed.toLowerCase()
    const all = [...residents.values()]
    const matches = all.filter((resident) => resident.name.toLowerCase().includes(lower)).slice(0, 6)
    let nearest: Resident | null = null
    let best = 3
    for (const resident of all) {
      const d = distance(lower, resident.name.toLowerCase())
      if (d < best) [best, nearest] = [d, resident]
    }
    return { nearest, matches }
  }, [residents, typed, found])

  const description = typeof field.admin?.description === 'string' ? field.admin.description : undefined
  const locked = readOnly || disabled
  const take = (name: string) => !locked && setValue(name)
  const where = (resident: Resident) => `${spoken(resident.town)}${resident.nation ? `, ${spoken(resident.nation)}` : ''}`

  return (
    <div className="list-entry-name">
      <TextInput
        description={description}
        label={field.label}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => !locked && setValue(event.target.value)}
        path={path}
        readOnly={locked}
        required={field.required}
        showError={showError}
        value={value ?? ''}
      />
      {found ? (
        <p className="list-entry-name__note">Lives in {where(found)} on the map now.</p>
      ) : typed && residents ? (
        <p className="list-entry-name__note list-entry-name__note--warn" role="status">
          Not in any town on the map now: they’re listed all the same, but check the spelling.
          {nearest && nearest.name !== typed ? (
            <>
              {' '}
              The map has{' '}
              <button className="list-entry-name__take" disabled={locked} onClick={() => take(nearest.name)} type="button">
                {nearest.name}
              </button>{' '}
              in {where(nearest)}.
            </>
          ) : null}
        </p>
      ) : null}
      {matches.length > 0 && !(matches.length === 1 && nearest && matches[0].name === nearest.name) ? (
        <ul aria-label="Residents on the map" className="list-entry-name__matches">
          {matches.map((resident) => (
            <li key={resident.name}>
              <button className="list-entry-name__take" disabled={locked} onClick={() => take(resident.name)} type="button">
                {resident.name}
              </button>
              <span> · {where(resident)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** The classes field: the list's own classes, ticked. A saved class the list no longer has stays, said to be gone. */
export function EntryClassesField({ field, path: pathFromProps, readOnly }: TextFieldClientProps) {
  const { path, value, setValue, showError, disabled } = useField<string[]>({ potentiallyStalePath: pathFromProps })
  // The list's classes, joined into one string so the form's other changes don't re-render this.
  const joined = useFormFields(([fields]) =>
    Object.entries(fields ?? {})
      .flatMap(([key, state]) => {
        const at = /^classes\.(\d+)\.name$/.exec(key)
        const name = typeof state?.value === 'string' ? state.value.trim() : ''
        return at && name ? [[Number(at[1]), name] as const] : []
      })
      .sort(([a], [b]) => a - b)
      .map(([, name]) => name)
      .join('\u0000'),
  )
  const available = joined ? joined.split('\u0000') : []
  const chosen = Array.isArray(value) ? value : []
  const has = (name: string) => chosen.some((item) => item.toLowerCase() === name.toLowerCase())
  const gone = chosen.filter((item) => !available.some((name) => name.toLowerCase() === item.toLowerCase()))
  const locked = readOnly || disabled
  const toggle = (name: string) => {
    if (locked) return
    setValue(has(name) ? chosen.filter((item) => item.toLowerCase() !== name.toLowerCase()) : [...chosen, name])
  }
  const description = typeof field.admin?.description === 'string' ? field.admin.description : undefined

  return (
    <div className={`field-type list-entry-classes${showError ? ' error' : ''}`}>
      <FieldLabel label={field.label ?? 'Classes'} path={path} />
      <FieldError path={path} showError={showError} />
      {available.length === 0 && gone.length === 0 ? (
        <p className="list-entry-classes__empty">Add the list’s classes above first.</p>
      ) : (
        <div className="list-entry-classes__chips" role="group" aria-label="Classes">
          {available.map((name) => (
            <label className="list-entry-classes__chip" key={name}>
              <input checked={has(name)} disabled={locked} onChange={() => toggle(name)} type="checkbox" />
              <span>{name}</span>
            </label>
          ))}
          {gone.map((name) => (
            <label className="list-entry-classes__chip list-entry-classes__chip--gone" key={`gone-${name}`} title="No longer one of the list’s classes">
              <input checked disabled={locked} onChange={() => toggle(name)} type="checkbox" />
              <span>{name} · not a class now</span>
            </label>
          ))}
        </div>
      )}
      {description ? <FieldDescription description={description} path={path} /> : null}
    </div>
  )
}
