import { ValidationError, type GlobalAfterChangeHook, type GlobalBeforeChangeHook, type GlobalConfig } from 'payload'

import { isAdmin } from '../access'
import { isWebhookUrl } from '../lib/discord'
import { greetSiegeChannel, roleId, webhookProblem, type SiegeAlertSettings } from '../lib/siegeAlerts'

/**
 * Where Discord hears from the site (src/lib/discord.ts): newly published
 * articles, and siege alerts off the Rulercraft map (src/lib/siegeAlerts.ts).
 * Admins only, to read as well as to change: a webhook URL lets anyone who
 * has it post to that channel, so it never leaves the admin panel.
 */

const sieges = (doc: unknown): SiegeAlertSettings => (doc as { sieges?: SiegeAlertSettings } | null)?.sieges ?? {}

/**
 * A siege webhook newly set is asked of Discord before it's saved, so a
 * deleted or mistyped one is refused in the form rather than found out at
 * the first siege; a role pasted as a mention is kept as its ID.
 */
const checkSiegeWebhook: GlobalBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const next = sieges(data)
  const url = next.webhookUrl?.trim()
  if (data.sieges) {
    data.sieges.webhookUrl = url || null
    data.sieges.role = roleId(next.role) ?? (next.role?.trim() || null)
  }
  if (!url || url === sieges(originalDoc).webhookUrl?.trim()) return data
  const problem = await webhookProblem(url)
  if (problem) {
    throw new ValidationError({ global: 'discord', errors: [{ path: 'sieges.webhookUrl', message: problem }], req })
  }
  return data
}

/**
 * The channel hears at once that the alerts will come to it: whenever an
 * admin sets the webhook or the role, or switches the alerts back on.
 */
const greetSiegeChannelOnChange: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const now = sieges(doc)
  const before = sieges(previousDoc)
  if (!req.user || now.enabled === false || !now.webhookUrl) return doc
  const same =
    now.webhookUrl === before.webhookUrl &&
    (now.role ?? null) === (before.role ?? null) &&
    before.enabled !== false &&
    Boolean(now.battles) === Boolean(before.battles) &&
    Boolean(now.ended) === Boolean(before.ended) &&
    Boolean(now.laidByAzania) === Boolean(before.laidByAzania)
  if (!same) await greetSiegeChannel(req.payload, now)
  return doc
}

export const Discord: GlobalConfig = {
  slug: 'discord',
  label: 'Discord',
  admin: {
    group: 'Settings',
    description:
      'Newly published articles are announced in Discord, each channel taking the articles of a context and everything below it (the most specific channel wins); and sieges on the Rulercraft map can be posted to a channel of their own.',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  hooks: {
    beforeChange: [checkSiegeWebhook],
    afterChange: [greetSiegeChannelOnChange],
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Announce new articles',
      defaultValue: true,
      admin: { description: 'Off: no article is announced anywhere, whatever channels are set below. Siege alerts have a switch of their own.' },
    },
    {
      name: 'channels',
      type: 'array',
      labels: { singular: 'Channel', plural: 'Channels' },
      admin: { initCollapsed: false },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'context',
              type: 'relationship',
              relationTo: 'contexts',
              required: true,
              admin: { width: '40%', description: 'Its articles, and those of everything below it.' },
            },
            {
              name: 'webhookUrl',
              label: 'Webhook URL',
              type: 'text',
              required: true,
              admin: {
                width: '60%',
                description: 'In Discord: the channel’s settings → Integrations → Webhooks → Copy Webhook URL.',
              },
              validate: (value: string | null | undefined) =>
                (typeof value === 'string' && isWebhookUrl(value.trim())) ||
                'Paste a Discord webhook URL (https://discord.com/api/webhooks/…).',
            },
          ],
        },
      ],
    },
    {
      name: 'sieges',
      type: 'group',
      label: 'Siege alerts',
      admin: {
        description:
          'A post in a channel when a siege is laid against one of Azania’s towns, as SiegeWar marks it on the Rulercraft map. The map is checked every five minutes, so an alert comes a few minutes after the banner is placed. Off until a webhook is set; saving a new webhook or role posts a short note to the channel, so you can see it works.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          label: 'Post siege alerts',
          defaultValue: true,
          admin: { description: 'Off: nothing is posted, and the webhook below is kept for later.' },
        },
        {
          type: 'row',
          fields: [
            {
              name: 'webhookUrl',
              label: 'Webhook URL',
              type: 'text',
              admin: {
                width: '60%',
                description:
                  'In Discord: the channel’s settings → Integrations → Webhooks → New Webhook → Copy Webhook URL. Its name and avatar there are what the alerts are posted as.',
              },
              validate: (value: string | null | undefined) =>
                !value?.trim() ||
                isWebhookUrl(value.trim()) ||
                'Paste a Discord webhook URL (https://discord.com/api/webhooks/…).',
            },
            {
              name: 'role',
              label: 'Role to ping',
              type: 'text',
              admin: {
                width: '40%',
                description:
                  'Optional: pinged for each new siege against Azania, and for each battle at one if those are posted. In Discord, with Developer Mode on (User Settings → Advanced): Server Settings → Roles → ⋯ next to the role → Copy Role ID.',
              },
              validate: (value: string | null | undefined) =>
                !value?.trim() || roleId(value) !== null || 'Paste the role’s ID: a long number, such as 1234567890123456789.',
            },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'battles',
              type: 'checkbox',
              label: 'When a battle begins at one',
              defaultValue: false,
              admin: {
                width: '33%',
                description: 'When fighting starts at the banner of a siege against Azania, during a battle session.',
              },
            },
            {
              name: 'ended',
              type: 'checkbox',
              label: 'When one ends',
              defaultValue: true,
              admin: { width: '33%', description: 'When the siege is gone from the map, with how it stood when it was last seen.' },
            },
            {
              name: 'laidByAzania',
              type: 'checkbox',
              label: 'Sieges Azania lays',
              defaultValue: false,
              admin: { width: '34%', description: 'Also post the sieges Azania lays against other towns. Never pings.' },
            },
          ],
        },
      ],
    },
  ],
}
