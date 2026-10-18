import { readFile } from 'node:fs/promises'

import { FACE } from '@/components/og/tokens'

/**
 * The faces the link-preview cards are set in (src/components/og), as
 * Satori wants them: TTF buffers, one per weight. Static instances of the
 * site's own Google fonts, committed beside this file (see LICENSE.md), since
 * Satori reads neither woff2 nor next/font. Kept to the weights the cards
 * use: regular Alegreya for the Gazette's headlines, Archivo Black for the
 * Times', Plex Serif Medium for the registry's, Fredoka in the three weights
 * Cherry Blossom sets, and the label faces beside them.
 *
 * The files are referenced through `new URL(…, import.meta.url)`, which the
 * bundler resolves to the built output, so the route works from `next build`
 * as well as from the source tree.
 */
export type CardFont = {
  name: string
  data: ArrayBuffer
  weight: 400 | 500 | 600 | 700 | 900
  style: 'normal'
}

const FILES: { name: string; weight: CardFont['weight']; url: URL }[] = [
  { name: FACE.alegreya, weight: 400, url: new URL('./Alegreya-Regular.ttf', import.meta.url) },
  { name: FACE.archivo, weight: 700, url: new URL('./Archivo-Bold.ttf', import.meta.url) },
  { name: FACE.archivo, weight: 900, url: new URL('./Archivo-Black.ttf', import.meta.url) },
  { name: FACE.sourceSans, weight: 400, url: new URL('./SourceSans3-Regular.ttf', import.meta.url) },
  { name: FACE.sourceSans, weight: 600, url: new URL('./SourceSans3-SemiBold.ttf', import.meta.url) },
  { name: FACE.plexSerif, weight: 500, url: new URL('./IBMPlexSerif-Medium.ttf', import.meta.url) },
  { name: FACE.plexMono, weight: 400, url: new URL('./IBMPlexMono-Regular.ttf', import.meta.url) },
  { name: FACE.plexMono, weight: 500, url: new URL('./IBMPlexMono-Medium.ttf', import.meta.url) },
  { name: FACE.fredoka, weight: 500, url: new URL('./Fredoka-Medium.ttf', import.meta.url) },
  { name: FACE.fredoka, weight: 600, url: new URL('./Fredoka-SemiBold.ttf', import.meta.url) },
  { name: FACE.fredoka, weight: 700, url: new URL('./Fredoka-Bold.ttf', import.meta.url) },
]

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer

let loading: Promise<CardFont[]> | null = null

/** Every card font, read once per process and shared by every card after. */
export function loadCardFonts(): Promise<CardFont[]> {
  loading ??= Promise.all(
    FILES.map(async ({ url, ...font }) => ({
      ...font,
      style: 'normal' as const,
      data: toArrayBuffer(await readFile(url)),
    })),
  ).catch((error: unknown) => {
    // A failed read is not cached: the next card tries again.
    loading = null
    throw error
  })
  return loading
}
