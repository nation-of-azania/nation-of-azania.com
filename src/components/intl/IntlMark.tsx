/**
 * The registry mark of the International contexts: nations as equal points
 * around a round table, with the host at the centre no larger than any of
 * them. Drawn in `currentColor`; decorative, so always paired with the
 * context's name in text.
 */
export function IntlMark({ className }: { className?: string }) {
  const seats = Array.from({ length: 8 }, (_, index) => {
    const angle = (index / 8) * Math.PI * 2 - Math.PI / 2
    return { cx: 16 + Math.cos(angle) * 11, cy: 16 + Math.sin(angle) * 11 }
  })
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      {seats.map((seat, index) => (
        <circle key={index} cx={seat.cx.toFixed(2)} cy={seat.cy.toFixed(2)} r="1.9" fill="currentColor" />
      ))}
      <circle cx="16" cy="16" r="1.9" fill="currentColor" />
    </svg>
  )
}
