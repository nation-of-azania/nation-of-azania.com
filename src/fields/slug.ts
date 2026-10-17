import type { TextField } from 'payload'

export const slugify = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

/**
 * URL slug, auto-generated from another field (default: `title`) when left
 * empty. Editable in the sidebar for manual overrides.
 */
export const slugField = (source = 'title'): TextField => ({
  name: 'slug',
  type: 'text',
  unique: true,
  index: true,
  admin: {
    position: 'sidebar',
    description: `Leave empty to generate from ${source}.`,
  },
  hooks: {
    beforeValidate: [
      ({ value, data }) => {
        const base =
          typeof value === 'string' && value.trim().length > 0
            ? value
            : ((data?.[source] as string | undefined) ?? '')
        const slug = slugify(base)
        return slug.length > 0 ? slug : undefined
      },
    ],
  },
})
