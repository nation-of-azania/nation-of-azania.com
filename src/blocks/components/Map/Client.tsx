'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * The two small islands of the Map block. The figure itself is rendered on
 * the server; these only need the browser: an image that steps aside when
 * the map server fails to draw it, and a button that copies coordinates.
 */

type ClipProps = {
  alt: string
  className?: string
  /** Shown in the clipping's place if the map server can't draw it, so the frame never holds a broken image. */
  fallback: ReactNode
  height: number
  src: string
  width: number
}

export function MapClip({ src, alt, width, height, fallback, className }: ClipProps) {
  const ref = useRef<HTMLImageElement>(null)
  const [failed, setFailed] = useState(false)

  // An image that failed before hydration fired its error event into the
  // void; it shows as complete with no pixels, so look once on mount.
  useEffect(() => {
    const image = ref.current
    if (image?.complete && image.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) return <>{fallback}</>
  return (
    // eslint-disable-next-line @next/next/no-img-element -- our own /mapclip route, already a sized JPEG cached at the CDN; next/image could only re-encode it
    <img
      alt={alt}
      className={className}
      decoding="async"
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
      ref={ref}
      src={src}
      width={width}
    />
  )
}

type CopyProps = {
  className?: string
  /** What goes to the clipboard: the coordinates as a player would type them after /tp. */
  text: string
}

export function CopyCoordinates({ text, className }: CopyProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // No clipboard (an insecure context, or permission refused): the coordinates are on the page to select.
    }
  }

  return (
    <button
      aria-label={`Copy the coordinates ${text}`}
      className={className}
      onClick={copy}
      title="Copy for /tp"
      type="button"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
