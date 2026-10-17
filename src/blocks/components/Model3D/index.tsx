import type { Model3DBlockType } from '@/payload-types'

import { resolveMedia } from '../shared'
import { Model3DClient } from './Client'

type Model3DProps = Pick<Model3DBlockType, 'autoRotate' | 'caption' | 'model'>

/**
 * Model3D — an interactive museum exhibit.
 *
 * This entry component is server-safe: it renders only the styled figure
 * frame (double hairline border on parchment) and defers everything
 * three.js-related to the client wrapper, which in turn loads the actual
 * scene with `next/dynamic` and `ssr: false`. Three.js code is therefore
 * never imported on the server or shipped to pages without this block.
 */
export function Model3DBlock({ model, caption, autoRotate }: Model3DProps) {
  const media = resolveMedia(model)
  // Media alt doubles as the exhibit caption when no explicit caption is set.
  const captionText = caption || media?.alt || null
  const label = captionText ?? 'Interactive 3D exhibit'

  return (
    <figure className="my-10">
      <div className="border border-pine-800 bg-parchment-100 p-1.5">
        <div className="border border-gold-400">
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            <Model3DClient autoRotate={autoRotate ?? true} label={label} model={media} />
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
