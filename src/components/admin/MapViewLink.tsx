'use client'

import { useField } from '@payloadcms/ui'
import type { FieldDescriptionClientProps } from 'payload'

import { mapsHref } from '@/maps/url'

/**
 * The Map block's "Map view" field, described: the field's own line, then
 * the way to Azania Maps, where views are drawn — to draw a new one, or to
 * open the chosen one again. Wired up as the field's Description component
 * in src/blocks/config.ts, so it reads the value through the form.
 */
export function MapViewLink({ path, field }: FieldDescriptionClientProps) {
  const { value } = useField<number | string | { id: number | string } | null>({ path })
  const id = value && typeof value === 'object' ? value.id : (value ?? null)
  // The field's static description reaches the client, though the client type leaves it out.
  const text = (field.admin as { description?: unknown } | undefined)?.description
  // One child: Payload lays the description out as a flex row, which would set the link apart.
  return (
    <div className="field-description">
      <span>
        {typeof text === 'string' ? `${text} ` : null}
        <a
          href={id ? mapsHref({ view: Number(id), draw: 'view' }) : mapsHref({ draw: 'view' })}
          rel="noopener noreferrer"
          style={{ whiteSpace: 'nowrap' }}
          target="_blank"
        >
          {id ? 'Edit this view ↗' : 'Draw a new view on Azania Maps ↗'}
        </a>
      </span>
    </div>
  )
}
