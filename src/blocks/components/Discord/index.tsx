import NextImage from 'next/image'

import type { DiscordBlockType, Media } from '@/payload-types'

import { cn, resolveImage, resolveMedia } from '../shared'
import { DiscordAudio } from './Client'
import { MessageBody } from './markdown'

type DiscordProps = Pick<
  DiscordBlockType,
  'caption' | 'channel' | 'messages' | 'sourceUrl'
>

type RawMessage = NonNullable<DiscordBlockType['messages']>[number]

/**
 * Discord attachments are laid out inside a 550 × 350 box in the message list;
 * anything larger is scaled down to fit.
 */
const MAX_ATTACHMENT_WIDTH = 550
const MAX_ATTACHMENT_HEIGHT = 350

/** Discord's default-avatar palette, picked from the account id — here, the name. */
const DEFAULT_AVATARS = ['#5865f2', '#747f8d', '#3ba55d', '#faa81a', '#ed4245']

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

function hash(value: string): number {
  let out = 0
  for (let i = 0; i < value.length; i++) out = (out * 31 + value.charCodeAt(i)) >>> 0
  return out
}

/** Relative luminance, so the initial stays legible on the lighter defaults. */
function isLight(hex: string): boolean {
  const full =
    hex.length === 4
      ? hex
          .slice(1)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(1)
  const channel = (offset: number) => {
    const srgb = parseInt(full.slice(offset, offset + 2), 16) / 255
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4) > 0.45
}

/** Only ever emit http(s) hrefs, whatever an editor pastes into the field. */
function safeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

type Identity = {
  avatar: Media | null
  bot: boolean
  colour: string | null
  name: string
}

type Message = {
  audio: Media | null
  body: string | null
  edited: boolean
  image: Media | null
  key: string
  timestamp: string | null
  /** The message in English, when it was written in another language. */
  translation: string | null
}

type Group = Identity & { key: string; messages: Message[] }

/**
 * Consecutive messages from one author collapse into a single group, the way
 * Discord does — name, avatar and timestamp appear once, at the top.
 *
 * Discord breaks a group after a seven-minute gap; timestamps here are free
 * text, so the editor breaks it explicitly with "Repeat the name" instead.
 *
 * Avatar, role colour and the bot tag are looked up per author rather than per
 * message, so they only have to be filled in once in the admin.
 */
function toGroups(messages: RawMessage[]): Group[] {
  const identities = new Map<string, Identity>()

  for (const message of messages) {
    const name = message.author?.trim()
    if (!name) continue
    const known = identities.get(name)
    const avatar = resolveMedia(message.avatar)
    const colour = message.roleColour?.trim()
    if (!known) {
      identities.set(name, {
        avatar,
        bot: Boolean(message.bot),
        colour: colour && HEX.test(colour) ? colour : null,
        name,
      })
      continue
    }
    // Later messages may carry details the first one omitted.
    if (!known.avatar && avatar) known.avatar = avatar
    if (!known.colour && colour && HEX.test(colour)) known.colour = colour
    if (message.bot) known.bot = true
  }

  const groups: Group[] = []

  messages.forEach((message, index) => {
    const name = message.author?.trim()
    if (!name) return

    const body = message.body?.trim() || null
    const image = resolveMedia(message.image)
    const audio = resolveMedia(message.audio)
    if (!body && !image && !audio) return

    const entry: Message = {
      audio,
      body,
      edited: Boolean(message.edited),
      image,
      key: message.id ?? `m${index}`,
      timestamp: message.timestamp?.trim() || null,
      translation: message.translation?.trim() || null,
    }

    const last = groups.at(-1)
    if (last && last.name === name && !message.startNewGroup) {
      last.messages.push(entry)
      return
    }

    const identity = identities.get(name)
    groups.push({
      avatar: identity?.avatar ?? null,
      bot: identity?.bot ?? false,
      colour: identity?.colour ?? null,
      key: entry.key,
      messages: [entry],
      name,
    })
  })

  return groups
}

function Avatar({ identity }: { identity: Identity }) {
  const image = resolveImage(identity.avatar, 'thumbnail')

  if (image) {
    return (
      <NextImage
        alt={image.alt || `${identity.name}'s avatar`}
        className="absolute top-0.5 left-3 h-9 w-9 rounded-full object-cover sm:left-4 sm:h-10 sm:w-10"
        height={80}
        sizes="40px"
        src={image.src}
        width={80}
      />
    )
  }

  const background = DEFAULT_AVATARS[hash(identity.name) % DEFAULT_AVATARS.length]
  return (
    <span
      aria-hidden="true"
      className="absolute top-0.5 left-3 flex h-9 w-9 items-center justify-center rounded-full text-base font-medium select-none sm:left-4 sm:h-10 sm:w-10"
      style={{ background, color: isLight(background) ? '#1e1f22' : '#ffffff' }}
    >
      {[...identity.name][0]?.toUpperCase() ?? '?'}
    </span>
  )
}

/**
 * Formats whose animation has to be preserved. (Animated WebP exists too, but
 * cannot be told from a still one by MIME type alone, so it is not covered.)
 */
const ANIMATED_TYPES = new Set(['image/gif', 'image/apng'])

/**
 * An image attachment, scaled into Discord's 550 × 350 attachment box.
 *
 * Shown, not linked: clicking it would only dump the raw file into a new tab,
 * which is worse than the preview it replaces.
 */
function Attachment({ media }: { media: Media }) {
  const image = resolveImage(media, 'card')
  if (!image) return null

  /*
   * Sharp keeps a single frame when it builds our resized copies, so an
   * animated attachment has to be the file that was uploaded, passed through
   * Next's optimiser untouched — `unoptimized` guarantees that rather than
   * relying on the optimiser to recognise the animation itself.
   */
  const animated = ANIMATED_TYPES.has(media.mimeType ?? '')
  const src = animated ? (media.url ?? image.src) : image.src

  const natural = { height: media.height || image.height, width: media.width || image.width }
  const scale = Math.min(
    MAX_ATTACHMENT_WIDTH / natural.width,
    MAX_ATTACHMENT_HEIGHT / natural.height,
    1,
  )
  const width = Math.round(natural.width * scale)

  return (
    <NextImage
      alt={image.alt}
      className="mt-2 h-auto max-w-full rounded-lg"
      height={Math.round(natural.height * scale)}
      sizes={`(max-width: 640px) 100vw, ${width}px`}
      src={src}
      style={{ width }}
      unoptimized={animated}
      width={width}
    />
  )
}

function ChannelBar({ channel }: { channel: string }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-dc-line bg-dc-panel px-4 pt-4 pb-2.5">
      <span aria-hidden="true" className="text-xl leading-none font-light text-dc-muted">
        #
      </span>
      <span className="truncate text-[0.9375rem] font-medium text-dc-name">
        {channel.replace(/^#/, '')}
      </span>
    </div>
  )
}

/**
 * A message's translation, under the original rather than in its place: the
 * reader sees what was said, and what it means. Set off by a rule in the
 * client's quote style, under a small label, and marked as English for
 * screen readers.
 */
function Translation({ text }: { text: string }) {
  return (
    <div className="mt-1 mb-0.5 border-l-[3px] border-dc-bar pl-3 text-dc-icon" lang="en">
      <p className="text-[0.6875rem] leading-4 font-semibold tracking-[0.02em] text-dc-muted uppercase">Translation</p>
      <div className="text-[0.9375rem] leading-[1.25rem] italic">
        <MessageBody body={text} />
      </div>
    </div>
  )
}

/**
 * Discord Quote — an exchange lifted out of Discord and shown the way it looks
 * in the client: dark chat surface, 40px avatars in a 72px gutter, and
 * consecutive messages from one person grouped under a single name.
 *
 * Server-rendered apart from the audio player and spoiler reveals
 * (`Client.tsx`). Measurements follow Discord's cozy layout — see the comments
 * on each rule — with the gutter narrowed on small screens, where 72px of
 * indent would leave nothing for the message.
 */
export function DiscordBlock({ channel, messages, sourceUrl, caption }: DiscordProps) {
  const groups = toGroups(messages ?? [])
  if (groups.length === 0) return null

  const source = safeUrl(sourceUrl)
  const channelName = channel?.trim() || null

  return (
    <figure className="my-8 font-discord">
      <div className="relative">
        <div className="overflow-hidden rounded-xl border border-dc-well bg-dc-chat shadow-[0_2px_12px_rgba(27,25,19,0.14)]">
          {channelName ? <ChannelBar channel={channelName} /> : null}

          <ol className="py-4" role="list">
            {groups.map((group, groupIndex) => (
              // `my-0!` overrides the prose list spacing from RichText, which
              // is the one default rule that is not scoped away from blocks.
              <li className="my-0!" key={group.key}>
                <div
                  className={cn(
                    // Cozy rows carry 0.125rem vertical padding in the client;
                    // the group's 2px top sits above the name (the bottom is
                    // the last message's own pb). Avatar top-0.5 matches it,
                    // so avatar and name stay top-aligned. Right padding is
                    // the client's 24px (--space-xl) row padding.
                    'relative pt-[2px] pr-4 pl-14 sm:pr-6 sm:pl-[72px]',
                    groupIndex > 0 && 'mt-[17px]',
                  )}
                >
                  <Avatar identity={group} />

                  {/* A div, not a heading: usernames must not enter the
                      article's heading outline. min-h, as in the client, so an
                      unusually long name can still wrap on narrow screens. */}
                  <div className="min-h-[1.375rem] text-base leading-[1.375rem]">
                    {/* 500, as the dark client sets usernames in gg sans. A
                        fallback without a medium face (Arial) shows it at 400. */}
                    <span
                      className={cn('font-medium', !group.colour && 'text-dc-name')}
                      style={group.colour ? { color: group.colour } : undefined}
                    >
                      {group.name}
                    </span>
                    {group.bot ? (
                      <span className="ml-2 inline-block translate-y-[-1px] rounded-[3px] bg-dc-blurple px-[0.275rem] align-middle text-[0.625rem] leading-[0.9375rem] font-medium text-white uppercase">
                        App
                      </span>
                    ) : null}
                    {group.messages[0].timestamp ? (
                      /* h-5 (1.25rem) is the client's own trick: a 12px span
                         sharing a baseline with the 16px name would grow the
                         line box past 1.375rem; capping the inline-block keeps
                         the header exactly one line-height tall, the text
                         overflowing its box invisibly.

                         ml-2, not the client's ml-1: Discord's header sets
                         `white-space: break-spaces`, so the literal space
                         between the name and timestamp spans is preserved and
                         adds ~4px to the 0.25rem margin. Our JSX strips that
                         whitespace, so the margin has to carry both. */
                      <span className="ml-2 inline-block h-5 text-xs leading-[1.375rem] font-medium text-dc-muted">
                        {group.messages[0].timestamp}
                      </span>
                    ) : null}
                  </div>

                  {group.messages.map((message, messageIndex) => (
                    <div
                      className={cn(
                        'group/msg relative text-base leading-[1.375rem] break-words text-dc-text',
                        // In the client the header and the first line of text
                        // are consecutive 22px line boxes with nothing between
                        // them; only follow-up messages carry the 2px breather.
                        messageIndex === 0 ? 'pb-[2px]' : 'py-[2px]',
                      )}
                      key={message.key}
                    >
                      {/* Grouped messages keep their own time in the gutter,
                          shown on hover — exactly Discord's behaviour. */}
                      {messageIndex > 0 && message.timestamp ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-[3px] -left-14 w-14 pr-2.5 text-right text-[0.6875rem] leading-[1.375rem] text-dc-muted opacity-0 transition-opacity group-hover/msg:opacity-100 sm:-left-[72px] sm:w-[72px]"
                        >
                          {message.timestamp}
                        </span>
                      ) : null}

                      {message.body ? <MessageBody body={message.body} /> : null}

                      {message.edited ? (
                        <span className="ml-1 text-[0.625rem] leading-none text-dc-muted">
                          (edited)
                        </span>
                      ) : null}

                      {message.translation ? <Translation text={message.translation} /> : null}

                      {message.image ? <Attachment media={message.image} /> : null}

                      {message.audio?.url ? (
                        <DiscordAudio
                          filename={message.audio.filename ?? 'audio'}
                          filesize={message.audio.filesize ?? null}
                          src={message.audio.url}
                          title={message.audio.alt || 'audio attachment'}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* The label sits astride the top border, like a plate on a frame.
            With a message link it doubles as the way back to the source. */}
        {source ? (
          <a
            className="absolute -top-[11px] left-4 inline-flex h-[22px] items-center gap-1 rounded-full bg-dc-blurple px-2.5 text-[0.625rem] font-semibold tracking-[0.14em] text-white uppercase shadow-sm transition-colors hover:bg-[#4752c4]"
            href={source}
            rel="noopener noreferrer"
            target="_blank"
            title="View this exchange on Discord"
          >
            Discord
            <span aria-hidden="true" className="text-[0.5625rem] tracking-normal">
              &#8599;
            </span>
            <span className="sr-only">— view this exchange on Discord</span>
          </a>
        ) : (
          <span className="absolute -top-[11px] left-4 inline-flex h-[22px] items-center rounded-full bg-dc-blurple px-2.5 text-[0.625rem] font-semibold tracking-[0.14em] text-white uppercase shadow-sm">
            Discord
          </span>
        )}
      </div>

      {caption ? (
        <figcaption className="mt-3 text-sm leading-normal text-ink-500">{caption}</figcaption>
      ) : null}
    </figure>
  )
}
