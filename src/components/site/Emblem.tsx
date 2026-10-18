import Image from 'next/image'
import type { ReactNode } from 'react'

import { cn } from '@/blocks/components/shared'
import type { Media } from '@/payload-types'

import { resolveImage } from './format'

type Props = {
  /** The emblem in force for the context (see emblemOf in src/lib/site.ts). */
  media: Media | null
  /** Rendered in the frame when there is no emblem; nothing renders without either. */
  fallback?: ReactNode
  /** Width and height, in CSS px. */
  size?: number
  /** The frame: ground, border and inner padding, in the design's own dress. */
  className?: string
}

/**
 * A context's emblem in a square frame. Uploads are arbitrary images — a
 * tall crest, a wide banner, a photograph — so the picture is fitted inside
 * the frame rather than cropped to it, and the frame's ground (usually the
 * accent wash) fills whatever the image leaves. Alt text comes from the
 * upload itself.
 */
export function Emblem({ media, fallback, size = 96, className }: Props) {
  const image = resolveImage(media, 'thumbnail')
  if (!image && !fallback) return null
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden', className)}
      style={{ width: size, height: size }}
    >
      {image ? (
        <Image
          src={image.url}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={`${size * 2}px`}
          className="h-full w-full object-contain"
        />
      ) : (
        fallback
      )}
    </div>
  )
}
