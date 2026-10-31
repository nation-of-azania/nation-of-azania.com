/**
 * A line drawn as one smooth curve through its points, for a map view's
 * curved lines and arrows (src/maps/registry.ts → Drawing, `curve`): a
 * Catmull-Rom spline through every point, as the cubic Béziers an SVG path
 * takes, and the direction it ends in, for an arrowhead to follow. Two
 * points give a straight line; three (start, a bend, end) an arc. Pure, on
 * points already on the page, so the live map, the still and the embed
 * draw the same curve (src/components/maps/layers/DrawingsLayer.tsx).
 */

export type Xy = readonly [number, number]

/** One piece of the curve: from a point to the next, by two control points. */
export type CurvePiece = { from: Xy; c1: Xy; c2: Xy; to: Xy }

/**
 * The curve's pieces: the uniform Catmull-Rom spline through the points,
 * its ends held by repeating the first and last point, so it leaves the
 * first towards the second and arrives at the last from the one before.
 */
export function curvePieces(points: readonly Xy[]): CurvePiece[] {
  const n = points.length
  const at = (index: number) => points[Math.max(0, Math.min(n - 1, index))]
  const pieces: CurvePiece[] = []
  for (let index = 0; index < n - 1; index++) {
    const [p0, p1, p2, p3] = [at(index - 1), at(index), at(index + 1), at(index + 2)]
    pieces.push({
      from: p1,
      c1: [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6],
      c2: [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6],
      to: p2,
    })
  }
  return pieces
}

const xy = ([x, y]: Xy) => `${x.toFixed(1)} ${y.toFixed(1)}`

/** The curve as an SVG path; nothing for no points. */
export function curvePath(points: readonly Xy[]): string {
  if (points.length === 0) return ''
  return `M${xy(points[0])}${curvePieces(points)
    .map(({ c1, c2, to }) => `C${xy(c1)} ${xy(c2)} ${xy(to)}`)
    .join('')}`
}

/**
 * The direction the curve arrives at its last point in, in radians on the
 * page, for an arrowhead: the tangent of its last piece. Null when the
 * line has no length to point along.
 */
export function curveEndAngle(points: readonly Xy[]): number | null {
  const last = curvePieces(points).at(-1)
  if (!last) return null
  for (const from of [last.c2, last.c1, last.from]) {
    const dx = last.to[0] - from[0]
    const dy = last.to[1] - from[1]
    if (Math.hypot(dx, dy) > 1e-6) return Math.atan2(dy, dx)
  }
  return null
}
