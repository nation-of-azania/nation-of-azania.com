import NextImage from 'next/image'

import type { GalleryBlockType } from '@/payload-types'

import { cn, resolveImage, resolveMedia, type ResolvedImage } from './shared'

type GalleryProps = Pick<GalleryBlockType, 'columns' | 'items'>

type GalleryItem = {
  caption: string | null | undefined
  image: ResolvedImage
  key: string
}

/**
 * Gallery — a plate section: responsive grid of 4:3 framed images with
 * optional captions beneath each plate.
 */
export function GalleryBlock({ items, columns }: GalleryProps) {
  const plates: GalleryItem[] = (items ?? []).flatMap((item, index) => {
    const image = resolveImage(resolveMedia(item.image), 'card')
    if (!image) return []
    return [{ caption: item.caption, image, key: item.id ?? String(index) }]
  })

  if (plates.length === 0) return null

  const three = columns !== '2'

  return (
    <div
      className={cn(
        'my-8 grid grid-cols-1 gap-4 sm:gap-5',
        three ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2',
      )}
    >
      {plates.map((plate) => (
        <figure className="min-w-0" key={plate.key}>
          <div className="relative aspect-[4/3] overflow-hidden border border-parchment-300 bg-parchment-100">
            <NextImage
              alt={plate.image.alt}
              className="object-cover"
              fill
              sizes={
                three
                  ? '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
                  : '(min-width: 640px) 50vw, 100vw'
              }
              src={plate.image.src}
            />
          </div>
          {plate.caption ? (
            <figcaption className="mt-2 text-xs leading-normal text-ink-500">{plate.caption}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  )
}
