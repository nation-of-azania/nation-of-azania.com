'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '../shared'

/**
 * The only interactive parts of the Discord Quote block: the audio attachment
 * player and spoiler reveals. Everything else in the block renders on the
 * server, so a quote without audio or spoilers ships no client JS beyond this
 * module's (small) footprint.
 */

/** Discord shows attachment sizes as e.g. "1.2 MB" / "812.00 KB". */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(2)} ${units[unit]}`
}

/** m:ss, the format in Discord's player. Unknown durations read "--:--". */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M4.6 2.6a.7.7 0 0 1 .71.02l7.2 4.79a.7.7 0 0 1 0 1.18l-7.2 4.79A.7.7 0 0 1 4.25 12.8V3.2a.7.7 0 0 1 .35-.6Z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
      <rect height="10" rx="0.9" width="3.2" x="4" y="3" />
      <rect height="10" rx="0.9" width="3.2" x="8.8" y="3" />
    </svg>
  )
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
      <path d="M8.3 2.2a.6.6 0 0 1 .35.55v10.5a.6.6 0 0 1-.98.47L4.8 11.2H2.6a.9.9 0 0 1-.9-.9V5.7a.9.9 0 0 1 .9-.9h2.2l2.87-2.52a.6.6 0 0 1 .63-.08Z" />
      {muted ? (
        <path
          d="m11.1 6.1 3.1 3.1m0-3.1-3.1 3.1"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.3"
        />
      ) : (
        <path
          d="M10.9 5.6a3.2 3.2 0 0 1 0 4.8M12.7 3.6a5.9 5.9 0 0 1 0 8.8"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.3"
        />
      )}
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2.5a.85.85 0 0 1 .85.85v7.1l2.3-2.3a.85.85 0 1 1 1.2 1.2l-3.75 3.75a.85.85 0 0 1-1.2 0L5.65 9.35a.85.85 0 1 1 1.2-1.2l2.3 2.3v-7.1A.85.85 0 0 1 10 2.5Zm-6 10.6a.85.85 0 0 1 .85.85v1.4h10.3v-1.4a.85.85 0 1 1 1.7 0v1.65c0 .8-.65 1.45-1.45 1.45H4.6c-.8 0-1.45-.65-1.45-1.45v-1.65a.85.85 0 0 1 .85-.85Z" />
    </svg>
  )
}

type AudioProps = {
  filename: string
  filesize: number | null
  src: string
  title: string
}

/**
 * Discord's audio attachment: a metadata row (file name, size, download) above
 * a control bar (play, elapsed, scrubber, duration, mute).
 *
 * The scrubber is a real `<input type="range">` laid transparently over the
 * drawn track, so dragging, arrow keys and screen readers all work while the
 * visible bar keeps Discord's look.
 */
export function DiscordAudio({ src, filename, filesize, title }: AudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(Number.NaN)

  /*
   * All state is mirrored from the element rather than tracked alongside it:
   * the browser pauses on its own (end of media, another tab taking over audio
   * focus), and — the reason this is an effect and not a set of JSX handlers —
   * a cached clip can finish loading its metadata *before* hydration, leaving
   * no event for React to hear. Reading the element once on mount catches that
   * case; the listeners catch everything after.
   */
  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const syncPlayback = () => setPlaying(!el.paused)
    const syncTime = () => setCurrent(el.currentTime)
    const syncDuration = () => setDuration(el.duration)
    const syncVolume = () => setMuted(el.muted)

    syncPlayback()
    syncTime()
    syncDuration()
    syncVolume()

    const events: Array<[string, () => void]> = [
      ['play', syncPlayback],
      ['pause', syncPlayback],
      ['ended', syncPlayback],
      ['timeupdate', syncTime],
      ['durationchange', syncDuration],
      ['loadedmetadata', syncDuration],
      ['volumechange', syncVolume],
    ]
    for (const [event, handler] of events) el.addEventListener(event, handler)
    return () => {
      for (const [event, handler] of events) el.removeEventListener(event, handler)
    }
  }, [])

  const toggle = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) void el.play().catch(() => setPlaying(false))
    else el.pause()
  }, [])

  const seek = useCallback((value: number) => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = value
    setCurrent(value)
  }, [])

  const known = Number.isFinite(duration) && duration > 0
  const progress = known ? Math.min(100, (current / duration) * 100) : 0

  return (
    <div className="mt-2 max-w-[400px] overflow-hidden rounded-lg border border-dc-well bg-dc-panel">
      <audio preload="metadata" ref={audioRef} src={src} />

      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1">
          <a
            className="block truncate text-[0.9375rem] leading-tight text-dc-link hover:underline"
            href={src}
            rel="noopener noreferrer"
            target="_blank"
          >
            {filename}
          </a>
          <span className="mt-0.5 block text-xs text-dc-muted">
            {filesize ? formatSize(filesize) : title}
          </span>
        </span>
        <a
          aria-label={`Download ${filename}`}
          className="shrink-0 text-dc-icon transition-colors hover:text-dc-text"
          download
          href={src}
        >
          <DownloadIcon />
        </a>
      </div>

      <div className="flex items-center gap-2.5 bg-dc-well px-3 py-2">
        <button
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="shrink-0 text-dc-icon transition-colors hover:text-dc-text"
          onClick={toggle}
          type="button"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <span className="w-9 shrink-0 text-right font-mono text-[0.6875rem] text-dc-muted tabular-nums">
          {formatTime(current)}
        </span>

        {/*
         * The scrubber is the range input itself — styled through its track
         * and thumb pseudo-elements rather than hidden under a drawn bar, so
         * pointer, keyboard and assistive tech all address the same element.
         * `--seek` carries the played fraction into the track's gradient,
         * which is the one part that has to come from inline style.
         */}
        <input
          aria-label={`Seek within ${title}`}
          className={cn(
            'h-3 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent',
            'focus-visible:outline-none',
            '[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full',
            '[&::-webkit-slider-runnable-track]:bg-[linear-gradient(to_right,var(--color-dc-blurple)_var(--seek),var(--color-dc-bar)_var(--seek))]',
            '[&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3',
            '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow',
            '[&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full',
            '[&::-moz-range-track]:bg-[linear-gradient(to_right,var(--color-dc-blurple)_var(--seek),var(--color-dc-bar)_var(--seek))]',
            '[&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white',
            'focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-white/80',
            'focus-visible:[&::-moz-range-thumb]:ring-2 focus-visible:[&::-moz-range-thumb]:ring-white/80',
            !known && '[&::-webkit-slider-thumb]:hidden [&::-moz-range-thumb]:hidden',
          )}
          disabled={!known}
          max={known ? duration : 0}
          min={0}
          onChange={(event) => seek(Number(event.currentTarget.value))}
          step="any"
          style={{ '--seek': `${progress}%` } as React.CSSProperties}
          type="range"
          value={current}
        />

        <span className="w-9 shrink-0 font-mono text-[0.6875rem] text-dc-muted tabular-nums">
          {formatTime(duration)}
        </span>

        <button
          aria-label={muted ? 'Unmute' : 'Mute'}
          aria-pressed={muted}
          className="shrink-0 text-dc-icon transition-colors hover:text-dc-text"
          onClick={() => {
            const el = audioRef.current
            if (el) el.muted = !el.muted
          }}
          type="button"
        >
          <VolumeIcon muted={muted} />
        </button>
      </div>
    </div>
  )
}

/**
 * Discord's `||spoiler||`: blacked out until clicked, then plain text for the
 * rest of the visit. A real button so it is keyboard-reachable, and the text
 * stays in the accessibility tree either way (screen readers announce the
 * hidden state rather than being handed the answer silently).
 */
export function Spoiler({ children }: { children: React.ReactNode }) {
  const [revealed, setRevealed] = useState(false)

  if (revealed) {
    return <span className="rounded-[3px] bg-dc-bar/35 px-[2px]">{children}</span>
  }

  return (
    <button
      aria-label="Spoiler, click to reveal"
      className="rounded-[3px] bg-dc-well px-[2px] text-transparent transition-colors hover:bg-[#26272b]"
      onClick={() => setRevealed(true)}
      type="button"
    >
      {children}
    </button>
  )
}
