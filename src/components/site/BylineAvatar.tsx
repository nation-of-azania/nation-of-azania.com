import Image from 'next/image'

import { cn } from '@/blocks/components/shared'

import { bylineInitials, type ResolvedByline } from './format'

/**
 * Display sizes for byline avatars, in CSS px. All are multiples of 8, so the
 * 8×8 skin pixels of a Minecraft head land on whole device pixels at 1× and
 * 2× — no half-pixel seams.
 */
export type AvatarSize = 24 | 32 | 40 | 48 | 64

/**
 * The size `minecraftHeadUrl` requests. It is declared as the intrinsic size
 * so the image proxy serves the head unresampled (it never upscales) and the
 * browser does the only scaling, nearest-neighbour, down to the display size.
 */
const HEAD_SOURCE_PX = 64

/**
 * Each publication frames its people differently. The Gazette mounts them
 * like portrait miniatures — a hairline sand frame and a thin mat — and, for
 * people without a face, stamps their initials in sea on sand. The Times
 * prints them flat, as a newspaper would, with a cinnabar monogram.
 */
export type AvatarTone = 'gazette' | 'times'

const TONE: Record<AvatarTone, { frame: string; mark: string }> = {
  gazette: {
    frame: 'box-content border border-sand-300 bg-sand-100 p-0.5',
    mark: 'bg-sea-800 font-mark text-sand-100',
  },
  times: {
    frame: 'bg-news-100',
    mark: 'bg-cinnabar-100 font-news font-black text-cinnabar-800',
  },
}

type Props = {
  byline: Pick<ResolvedByline, 'name' | 'avatar'>
  size: AvatarSize
  tone: AvatarTone
  className?: string
}

/**
 * The face on a byline: the player's head (pixel art, kept crisp), an uploaded
 * avatar (smooth, cropped square), or — for bylines with neither, such as
 * "The Editors" — a monogram of the name in the publication's letterform.
 */
export function BylineAvatar({ byline, size, tone, className }: Props) {
  const { avatar, name } = byline
  const tones = TONE[tone]
  const box = { width: size, height: size }
  const initials = avatar ? '' : bylineInitials(name)

  return (
    <span className={cn('inline-block shrink-0 overflow-hidden', tones.frame, className)}>
      {avatar?.pixelated ? (
        <Image
          src={avatar.url}
          alt={avatar.alt}
          width={HEAD_SOURCE_PX}
          height={HEAD_SOURCE_PX}
          quality={100}
          style={box}
          className="pixelated block"
        />
      ) : avatar ? (
        <Image
          src={avatar.url}
          alt={avatar.alt}
          width={size}
          height={size}
          style={box}
          className="block object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{ ...box, fontSize: Math.round(size * (initials.length > 1 ? 0.4 : 0.52)) }}
          className={cn(
            'flex select-none items-center justify-center leading-none tracking-[0.04em]',
            tones.mark,
          )}
        >
          {initials}
        </span>
      )}
    </span>
  )
}
