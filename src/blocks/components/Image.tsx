import NextImage from 'next/image'

import type { ImageBlockType } from '@/payload-types'

import { cn, resolveImage, resolveMedia } from './shared'

type ImageProps = Pick<ImageBlockType, 'caption' | 'image' | 'layout'>

/**
 * Image — a mounted print: hairline parchment frame, optional centered
 * caption. The 'wide' layout breaks slightly out of the text column on
 * large screens.
 */
export function ImageBlock({ image, caption, layout }: ImageProps) {
  const wide = layout === 'wide'
  const resolved = resolveImage(resolveMedia(image), wide ? 'hero' : 'card')
  if (!resolved) return null

  return (
    <figure className={cn('my-8', wide && 'lg:-mx-12 xl:-mx-20')}>
      <div className="border border-parchment-300 bg-parchment-100 p-1">
        <NextImage
          alt={resolved.alt}
          className="h-auto w-full"
          height={resolved.height}
          sizes={wide ? '(min-width: 1024px) 56rem, 100vw' : '(min-width: 1024px) 42rem, 100vw'}
          src={resolved.src}
          width={resolved.width}
        />
      </div>
      {caption ? (
        <figcaption className="mx-auto mt-3 max-w-prose text-center text-sm leading-normal text-ink-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
