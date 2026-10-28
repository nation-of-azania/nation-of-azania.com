import { ValidationError, type GlobalAfterChangeHook, type GlobalBeforeChangeHook, type GlobalConfig } from 'payload'

import { isAdmin } from '../access'
import { isWebhookUrl } from '../lib/discord'
import { greetSiegeChannel, roleId, webhookProblem, type SiegeAlertSettings } from '../lib/siegeAlerts'
import { isTimeZone, sessionTimes } from '../maps/sessions'

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
 * The channel hears at once that the alerts will come to it, and when the
 * battle sessions are, in each reader's own time: whenever an admin
 * changes the alerts' settings (the watch's own notes aside).
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
    Boolean(now.laidByAzania) === Boolean(before.laidByAzania) &&
    (now.sessionTimes ?? null) === (before.sessionTimes ?? null) &&
    (now.sessionZone ?? null) === (before.sessionZone ?? null)
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
          'A post in a channel as soon as a siege against one of Azania’s towns shows on the Rulercraft map: its flame, from the moment the banner is placed, long before any fighting. The map is checked every five minutes, so the alert comes within minutes, and says when its battle sessions are, in each reader’s own time. Off until a webhook is set; saving these settings posts a short note to the channel, so you can see it works and check the session times.',
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
              label: 'Also when fighting starts',
              defaultValue: false,
              admin: {
                width: '33%',
                description:
                  'A second post, each battle session, when the siege’s flame turns to crossed swords: fighting has begun at the banner. The first post doesn’t wait for this.',
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
        {
          type: 'row',
          fields: [
            {
              name: 'sessionTimes',
              type: 'text',
              label: 'Battle sessions start at',
              defaultValue: '12:00, 18:00, 00:00',
              admin: {
                width: '40%',
                description:
                  'Rulercraft’s battle sessions, an hour each, as times of day in the time zone beside: 12:00, 18:00 and 00:00 UTC (19:00, 01:00 and 07:00 in Thai time), all year. The alerts give the next ones as Discord timestamps, which each reader sees in their own time.',
              },
              validate: (value: string | null | undefined) =>
                !value?.trim() || sessionTimes(value) !== null || 'Times of day, separated by commas, such as 12:00, 18:00, 00:00.',
            },
            {
              name: 'sessionZone',
              type: 'text',
              label: 'In the time zone',
              defaultValue: 'UTC',
              admin: {
                width: '25%',
                description:
                  'By its tz name. The server keeps UTC: its sessions stayed put when Europe’s clocks went back in October 2026. A zone with summer time (Europe/Berlin) would move them an hour.',
              },
              validate: (value: string | null | undefined) =>
                !value?.trim() || isTimeZone(value) || 'A time zone by its tz name, such as UTC, Europe/Berlin or Asia/Bangkok.',
            },
            {
              name: 'sessionsSeen',
              type: 'text',
              label: 'Seen on the map',
              admin: {
                width: '35%',
                readOnly: true,
                description: 'The last battle session seen running on the map, and whether the times agree. Filled in by the watch.',
              },
            },
          ],
        },
      ],
    },
  ],
}
