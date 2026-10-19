import type { GlobalConfig } from 'payload'

import { isAdmin } from '../access'
import { isWebhookUrl } from '../lib/discord'

/**
 * Where newly published articles are announced in Discord (src/lib/discord.ts).
 * Admins only, to read as well as to change: a webhook URL lets anyone who
 * has it post to that channel, so it never leaves the admin panel.
 */
export const Discord: GlobalConfig = {
  slug: 'discord',
  label: 'Discord',
  admin: {
    group: 'Settings',
    description:
      'Newly published articles are announced in Discord. Each channel takes the articles of a context and everything below it; the most specific channel wins.',
  },
  access: {
    read: isAdmin,
    update: isAdmin,
  },
  fields: [
    {
      name: 'enabled',
      type: 'checkbox',
      label: 'Announce new articles',
      defaultValue: true,
      admin: { description: 'Off: nothing is posted anywhere, whatever is set below.' },
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
  ],
}
