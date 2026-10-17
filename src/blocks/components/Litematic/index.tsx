import type { LitematicBlockType } from '@/payload-types'

import { resolveMedia } from '../shared'
import { LitematicClient } from './Client'

type LitematicProps = Pick<LitematicBlockType, 'autoRotate' | 'caption' | 'schematic'>

/**
 * Litematic — an interactive viewer for a Litematica `.litematic` build.
 *
 * Server-safe, exactly like Model3D: this entry renders only the styled figure
 * frame and defers all three.js/parsing work to the client wrapper, which loads
 * the scene via `next/dynamic` with `ssr: false`. Nothing three.js-related is
 * imported on the server or shipped to pages without this block.
 */
export function LitematicBlock({ schematic, caption, autoRotate }: LitematicProps) {
  const media = resolveMedia(schematic)
  const captionText = caption || media?.alt || null
  const label = captionText ?? 'Interactive Litematica build'

  return (
    <figure className="my-10">
      <div className="border border-pine-800 bg-parchment-100 p-1.5">
        <div className="border border-gold-400">
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            <LitematicClient autoRotate={autoRotate ?? true} label={label} schematic={media} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-2 bottom-1.5 text-[0.625rem] tracking-[0.18em] text-ink-400 uppercase select-none"
            >
              Drag to rotate
            </span>
          </div>
        </div>
      </div>
      {captionText ? (
        <figcaption className="mx-auto mt-3 max-w-prose text-center text-sm leading-normal text-ink-500">
          {captionText}
        </figcaption>
      ) : null}
    </figure>
  )
}
