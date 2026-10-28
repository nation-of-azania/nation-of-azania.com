import type { Payload } from 'payload'

import { nextSessions, scheduleOf } from '../maps/sessions'
import { clip, postWebhook, siteUrl } from './discord'

/**
 * Siege alerts in Discord: a post in a channel when a siege is laid against
 * one of Azania's towns, as SiegeWar marks it on the Rulercraft map, and,
 * as the admins choose, when a battle begins at one, when one ends, and
 * when Azania lays a siege of its own. Set under Settings → Discord
 * (src/globals/Discord.ts); off until a webhook is set. A role can be
 * pinged for what calls for defenders: a new siege against Azania, and a
 * battle at one.
 */

export type SiegeAlertSettings = {
  enabled?: boolean | null
  webhookUrl?: string | null
  role?: string | null
  battles?: boolean | null
  ended?: boolean | null
  laidByAzania?: boolean | null
  /** When battle sessions start ("12:00, 18:00, 00:00"), in `sessionZone`. */
  sessionTimes?: string | null
  sessionZone?: string | null
  /** The last battle session the watch saw running, in words. */
  sessionsSeen?: string | null
}

/** The side colour of a siege alert: cinnabar, the colour of the war. */
export const SIEGE_COLOUR = 0x9b2c1a

const DISCORD_HOST = /^https:\/\/(?:\w+\.)?discord(?:app)?\.com\//

/** A role's ID as Discord copies it (17 to 20 digits), or as a mention (`<@&…>`); null when it's neither. */
export function roleId(value: string | null | undefined): string | null {
  const match = /^(?:<@&)?(\d{17,20})>?$/.exec(value?.trim() ?? '')
  return match ? match[1] : null
}

/**
 * Why Discord won't take a webhook: it doesn't know it, most often because
 * it was deleted or the URL was cut short. Null when it will, and when
 * Discord can't be asked just now, which isn't the webhook's fault. Asking
 * reads the webhook (its name and channel) and posts nothing.
 */
export async function webhookProblem(url: string): Promise<string | null> {
  if (!DISCORD_HOST.test(url)) return null
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
    if (response.status === 401 || response.status === 404) {
      return 'Discord doesn’t know this webhook: it may have been deleted, or the URL is cut short. Copy it again from the channel’s settings.'
    }
    return null
  } catch {
    return null
  }
}

/** What a channel is told it will hear, as a sentence. */
function promised(settings: SiegeAlertSettings): string {
  const when = [
    'as soon as a siege against one of Azania’s towns shows on the map',
    settings.battles ? 'when fighting starts at one' : null,
    settings.ended ? 'when one ends' : null,
  ].filter((clause): clause is string => clause !== null)
  const list = when.length > 1 ? `${when.slice(0, -1).join(', ')} and ${when.at(-1)}` : when[0]
  return `Azania Maps will post here ${list}.${settings.laidByAzania ? ' The sieges Azania lays are posted too.' : ''}`
}

/**
 * Tells a channel that siege alerts will come to it, and how a role will
 * be pinged, without pinging it: posted when an admin sets the webhook or
 * the role, so the channel shows at once that the settings work. Resolves
 * to whether Discord took it; never throws.
 */
export async function greetSiegeChannel(payload: Payload, settings: SiegeAlertSettings): Promise<boolean> {
  const url = settings.webhookUrl?.trim()
  if (!url) return false
  const role = roleId(settings.role)
  const pings = role
    ? `<@&${role}> will be pinged for each new siege against Azania${settings.battles ? ' and when fighting starts at one' : ''}.`
    : 'No role will be pinged.'
  const schedule = scheduleOf(settings.sessionTimes, settings.sessionZone)
  const sessions = schedule
    ? `Battle sessions, as set, in your own time: ${nextSessions(Date.now(), schedule, schedule.times.length)
        .map((start) => `<t:${Math.round(start / 1000)}:t>`)
        .join(' · ')}. If that’s wrong, fix the times or the time zone in the settings.`
    : 'No battle session times are set, so the alerts can’t say when to fight.'
  try {
    const response = await postWebhook(url, {
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: 'Siege alerts',
          url: `${siteUrl()}/maps`,
          description: clip(`${promised(settings)}\n\n${pings}\n\n${sessions}`, 4000),
          color: SIEGE_COLOUR,
          footer: { text: 'Read off the Rulercraft map every five minutes' },
        },
      ],
    })
    if (!response.ok) payload.logger.warn(`[discord] the siege channel wasn't greeted: Discord answered ${response.status}`)
    return response.ok
  } catch (error) {
    payload.logger.warn(`[discord] the siege channel wasn't greeted: ${(error as Error).message}`)
    return false
  }
}
