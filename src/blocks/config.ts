import type { Block } from 'payload'

import { MINECRAFT_NAME } from '../fields/minecraftName'
import { ASPECTS, MAPS, ZOOMS } from '../lib/dynmap'

/**
 * Lexical content blocks — the shared contract between the CMS schema and the
 * frontend renderer in `src/components/RichText.tsx`.
 *
 * Each block's `slug` is its `blockType` in the stored Lexical JSON. Frontend
 * components receive the block's `fields` object as props.
 *
 * To add a new block: see the "Extending the CMS with custom blocks" section
 * of the README.
 */

export const CalloutBlock: Block = {
  slug: 'callout',
  interfaceName: 'CalloutBlockType',
  labels: { singular: 'Callout', plural: 'Callouts' },
  fields: [
    {
      name: 'style',
      type: 'select',
      required: true,
      defaultValue: 'note',
      options: [
        { label: 'Note', value: 'note' },
        { label: 'Decree', value: 'decree' },
        { label: 'Warning', value: 'warning' },
      ],
    },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
  ],
}

export const QuoteBlock: Block = {
  slug: 'quote',
  interfaceName: 'QuoteBlockType',
  labels: { singular: 'Quote', plural: 'Quotes' },
  fields: [
    { name: 'quote', type: 'textarea', required: true },
    { name: 'attribution', type: 'text' },
    {
      name: 'attributionTitle',
      type: 'text',
      admin: { description: 'e.g. "Chancellor of Azania"' },
    },
  ],
}

export const ImageBlock: Block = {
  slug: 'image',
  interfaceName: 'ImageBlockType',
  labels: { singular: 'Image', plural: 'Images' },
  fields: [
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      filterOptions: { mimeType: { contains: 'image' } },
    },
    { name: 'caption', type: 'text' },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'standard',
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Wide', value: 'wide' },
      ],
    },
  ],
}

export const GalleryBlock: Block = {
  slug: 'gallery',
  interfaceName: 'GalleryBlockType',
  labels: { singular: 'Gallery', plural: 'Galleries' },
  fields: [
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Image', plural: 'Images' },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
          filterOptions: { mimeType: { contains: 'image' } },
        },
        { name: 'caption', type: 'text' },
      ],
    },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: [
        { label: '2 columns', value: '2' },
        { label: '3 columns', value: '3' },
      ],
    },
  ],
}

export const EmbedBlock: Block = {
  slug: 'embed',
  interfaceName: 'EmbedBlockType',
  labels: { singular: 'Embed', plural: 'Embeds' },
  fields: [
    {
      name: 'url',
      type: 'text',
      required: true,
      admin: { description: 'YouTube or Vimeo URL; other URLs render as a link card.' },
    },
    { name: 'caption', type: 'text' },
  ],
}

export const Model3DBlock: Block = {
  slug: 'model3d',
  interfaceName: 'Model3DBlockType',
  labels: { singular: '3D Model', plural: '3D Models' },
  admin: {
    disableBlockName: false,
  },
  fields: [
    {
      name: 'model',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description:
          'A .glb file from the media library. Leave empty to show the placeholder monument.',
      },
      filterOptions: {
        or: [
          { mimeType: { contains: 'gltf' } },
          { mimeType: { equals: 'application/octet-stream' } },
        ],
      },
    },
    { name: 'caption', type: 'text' },
    {
      name: 'autoRotate',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Slowly rotate the model until the visitor interacts.' },
    },
  ],
}

export const LitematicBlock: Block = {
  slug: 'litematic',
  interfaceName: 'LitematicBlockType',
  labels: { singular: 'Litematica Build', plural: 'Litematica Builds' },
  admin: {
    disableBlockName: false,
  },
  fields: [
    {
      name: 'schematic',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description:
          'A .litematic file from the media library (exported from the Litematica mod).',
      },
      // .litematic and .glb both upload as application/octet-stream, so filter
      // by filename rather than MIME to keep the picker to schematics.
      filterOptions: { filename: { like: 'litematic' } },
    },
    { name: 'caption', type: 'text' },
    {
      name: 'autoRotate',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Slowly turn the build until the visitor interacts.' },
    },
  ],
}

export const DiscordBlock: Block = {
  slug: 'discord',
  interfaceName: 'DiscordBlockType',
  labels: { singular: 'Discord Quote', plural: 'Discord Quotes' },
  admin: { disableBlockName: false },
  fields: [
    {
      name: 'channel',
      type: 'text',
      admin: {
        description:
          'Channel the exchange happened in, e.g. "town-hall" (the # is added). Leave empty to hide the channel bar.',
      },
    },
    {
      name: 'messages',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Message', plural: 'Messages' },
      admin: {
        description:
          'In order, oldest first. Consecutive messages from the same author are grouped under one name and avatar, exactly as Discord does.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'author',
              type: 'text',
              required: true,
              admin: {
                width: '50%',
                description: 'Display name. Spell it identically to group messages together.',
              },
            },
            {
              name: 'timestamp',
              type: 'text',
              admin: {
                width: '50%',
                description: 'Free text, in Discord\'s own wording — e.g. "Today at 21:14".',
              },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'avatar',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { contains: 'image' } },
              admin: {
                width: '50%',
                description:
                  'Set once per person — later messages from the same name reuse it. Without one, a lettered default avatar is drawn.',
              },
            },
            {
              name: 'roleColour',
              type: 'text',
              validate: (value: unknown) =>
                typeof value !== 'string' ||
                value === '' ||
                /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ||
                'Enter a hex colour such as #c9a52f.',
              admin: {
                width: '50%',
                description: 'Name colour from their top Discord role, e.g. #c9a52f. Also set once per person.',
              },
            },
          ],
        },
        {
          name: 'body',
          type: 'textarea',
          admin: {
            description:
              'Discord markdown: **bold**, *italic*, __underline__, ~~strike~~, `code`, ```code blocks```, > quotes, ||spoilers||, links, @mentions and #channels.',
          },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { contains: 'image' } },
              admin: { width: '50%', description: 'Image attached to this message.' },
            },
            {
              name: 'audio',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { contains: 'audio' } },
              admin: { width: '50%', description: 'Audio attached to this message, shown as a player.' },
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'bot',
              type: 'checkbox',
              defaultValue: false,
              label: 'Bot / app',
              admin: { width: '33%', description: 'Adds the APP tag beside the name.' },
            },
            {
              name: 'edited',
              type: 'checkbox',
              defaultValue: false,
              admin: { width: '33%', description: 'Adds the "(edited)" marker.' },
            },
            {
              name: 'startNewGroup',
              type: 'checkbox',
              defaultValue: false,
              label: 'Repeat the name',
              admin: {
                width: '33%',
                description: 'Break the grouping and show name and avatar again — as Discord does after a gap in time.',
              },
            },
          ],
        },
      ],
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Link to the message',
      admin: {
        description:
          'Optional. Right-click the message in Discord → Copy Message Link. Turns the "Discord" pill on the frame into a link to the source.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: { description: 'Optional subtext beneath the quote, for context or attribution.' },
    },
  ],
}

/** A map's subject, as the Map block's fields see each other while validating. */
type MapSubject = { town?: string | null; x?: number | null; z?: number | null }

/** Towny town names: letters, digits, underscores and hyphens, as the map writes them. */
const TOWN_NAME = /^[\w-]{1,40}$/
/** The world's extent, in blocks, in either direction. */
const WORLD_LIMIT = 100_000

const options = (registry: Record<string, { label: string }>) =>
  Object.entries(registry).map(([value, { label }]) => ({ label, value }))

/** A coordinate is needed unless a town names the place; either way it must be on the map. */
const coordinateValidate = (value: unknown, { siblingData }: { siblingData: MapSubject }) => {
  if (value == null || value === '') {
    return Boolean(siblingData?.town?.trim()) || 'Give x and z, or name a town above.'
  }
  return (
    (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WORLD_LIMIT) ||
    `A block coordinate within ±${WORLD_LIMIT.toLocaleString('en-GB')}.`
  )
}

/**
 * The Map block names its place by town or by coordinates; only the shape is
 * checked here, never the map server, so saving never waits on it. A town
 * the map doesn't know is reported on the page, in the figure's frame.
 */
export const MapBlock: Block = {
  slug: 'map',
  interfaceName: 'MapBlockType',
  labels: { singular: 'Map', plural: 'Maps' },
  admin: { disableBlockName: false },
  fields: [
    {
      name: 'town',
      type: 'text',
      label: 'Town',
      admin: {
        description:
          'A Towny town on the Rulercraft map, spelt as the map has it (e.g. GirlieTown). The clipping centres on its home block and outlines its claims. Leave empty to centre on coordinates instead.',
      },
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() || undefined : value)],
      },
      validate: (value: null | string | undefined, { siblingData }: { siblingData: MapSubject }) => {
        if (!value?.trim()) {
          return (
            (siblingData?.x != null && siblingData?.z != null) ||
            'Name a town, or give x and z below.'
          )
        }
        return TOWN_NAME.test(value.trim()) || 'Town names are letters, digits, _ and -, as on the map.'
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'x',
          type: 'number',
          admin: {
            width: '50%',
            description: 'Block coordinates to centre on. With a town, they move the centre within its claims.',
          },
          validate: coordinateValidate,
        },
        { name: 'z', type: 'number', admin: { width: '50%' }, validate: coordinateValidate },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'zoom',
          type: 'select',
          required: true,
          defaultValue: 'town',
          options: options(ZOOMS),
          admin: { width: '40%' },
        },
        {
          name: 'map',
          type: 'select',
          required: true,
          defaultValue: 'flat',
          options: options(MAPS),
          admin: { width: '30%' },
        },
        {
          name: 'aspect',
          type: 'select',
          required: true,
          defaultValue: 'wide',
          options: options(ASPECTS),
          admin: { width: '30%' },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'claims',
          type: 'checkbox',
          defaultValue: true,
          label: 'Outline the claims',
          admin: {
            width: '33%',
            description: 'Draw the town’s Towny claims on the clipping.',
            condition: (_, siblingData) => Boolean(siblingData?.town),
          },
        },
        {
          name: 'pin',
          type: 'checkbox',
          defaultValue: false,
          label: 'Pin the centre',
          admin: { width: '33%', description: 'A pin on the home block, or on the coordinates.' },
        },
        {
          name: 'facts',
          type: 'checkbox',
          defaultValue: true,
          label: 'Show town facts',
          admin: {
            width: '33%',
            description: 'The ruler, residents, nation and founding, as the map records them.',
            condition: (_, siblingData) => Boolean(siblingData?.town),
          },
        },
      ],
    },
    {
      name: 'caption',
      type: 'text',
      admin: { description: 'What the reader is looking at. The coordinates and a link to the live map are added beneath.' },
    },
  ],
}

/**
 * A player's skin in an interactive viewer; the name follows the same rule
 * as a byline's Minecraft name, here required, since the skin is the point.
 */
export const SkinBlock: Block = {
  slug: 'skin',
  interfaceName: 'SkinBlockType',
  labels: { singular: 'Player Skin', plural: 'Player Skins' },
  admin: { disableBlockName: false },
  fields: [
    {
      name: 'minecraftName',
      type: 'text',
      label: 'Minecraft name',
      required: true,
      admin: { description: 'The player to show, as named in the game (e.g. DefinitelyCasi).' },
      validate: (value: null | string | undefined) =>
        (typeof value === 'string' && MINECRAFT_NAME.test(value.trim())) ||
        'Enter a Minecraft username: 3–16 letters, digits or underscores.',
      hooks: {
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() || undefined : value)],
      },
    },
    {
      name: 'animation',
      type: 'select',
      required: true,
      defaultValue: 'idle',
      options: [
        { label: 'Idle (breathing, arms at rest)', value: 'idle' },
        { label: 'Walking on the spot', value: 'walk' },
        { label: 'Waving', value: 'wave' },
        { label: 'Still', value: 'still' },
      ],
      admin: {
        description:
          'Played once the viewer has loaded. Visitors who ask their device for less motion get the still pose, and can still turn the player by hand.',
      },
    },
    {
      name: 'caption',
      type: 'text',
      admin: { description: 'Optional, beneath the player’s name.' },
    },
  ],
}

/** Every block available in article/page content, in menu order. */
export const contentBlocks: Block[] = [
  CalloutBlock,
  QuoteBlock,
  ImageBlock,
  GalleryBlock,
  EmbedBlock,
  DiscordBlock,
  MapBlock,
  SkinBlock,
  Model3DBlock,
  LitematicBlock,
]
