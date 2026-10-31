/**
 * The curves a map view's lines can be drawn as (src/maps/curves.ts),
 * checked without a browser: the curve passes through every point, two
 * points stay a straight line, an arrowhead follows the direction the
 * curve ends in, and a curve is stored and checked like any other line
 * (src/maps/registry.ts → drawingsProblem).
 *
 *   pnpm test:curves
 */
import { curveEndAngle, curvePath, curvePieces, type Xy } from '../src/maps/curves'
import { drawingsProblem } from '../src/maps/registry'

let failed = false
function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'ok  ' : 'FAIL'} — ${what}`)
  if (!ok) failed = true
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
const same = (a: Xy, b: Xy) => near(a[0], b[0]) && near(a[1], b[1])

// A Bézier piece's point at t, to see where the curve actually runs.
const at = ({ from, c1, c2, to }: ReturnType<typeof curvePieces>[number], t: number): Xy => {
  const u = 1 - t
  const mix = (i: 0 | 1) => u * u * u * from[i] + 3 * u * u * t * c1[i] + 3 * u * t * t * c2[i] + t * t * t * to[i]
  return [mix(0), mix(1)]
}

{
  const arc: Xy[] = [[0, 0], [50, -40], [100, 0]]
  const pieces = curvePieces(arc)
  check(pieces.length === 2 && same(pieces[0].from, arc[0]) && same(pieces[0].to, arc[1]) && same(pieces[1].to, arc[2]), 'the curve runs through every point, start, bend and end')
  check(near(pieces[0].c2[1] - arc[1][1], 0) && near(pieces[1].c1[1] - arc[1][1], 0), 'it passes the bend level, smoothly: no corner there')
  const middle = at(pieces[0], 0.5)
  check(middle[1] < -20 && middle[1] > -40, `between start and bend it bows out like an arc (${middle[1].toFixed(1)})`)
  check(near(curveEndAngle(arc)!, Math.atan2(40, 50)), 'an arrowhead follows the direction the curve arrives in')
  check(curvePath(arc) === 'M0.0 0.0C8.3 -6.7 33.3 -40.0 50.0 -40.0C66.7 -40.0 91.7 -6.7 100.0 0.0', `the path is the curve's Béziers (${curvePath(arc)})`)
}
{
  const straight: Xy[] = [[0, 0], [30, 30]]
  const [piece] = curvePieces(straight)
  check(near(piece.c1[0], piece.c1[1]) && near(piece.c2[0], piece.c2[1]), 'two points stay a straight line')
  check(near(curveEndAngle(straight)!, Math.PI / 4), 'and its head points along it')
}
{
  check(curveEndAngle([[5, 5]]) === null, 'one point has no direction')
  check(curveEndAngle([[5, 5], [5, 5]]) === null, 'nor two on top of each other')
  check(curvePath([]) === '', 'no points, no path')
}
{
  const line = (extra: Record<string, unknown>) => [{ kind: 'line', points: [[0, 0], [10, 10]], ink: 'red', ...extra }]
  check(drawingsProblem(line({})) === null, 'a line without a curve is kept as it was')
  check(drawingsProblem(line({ curve: true, arrow: true })) === null, 'a curved arrow is stored')
  check(drawingsProblem(line({ curve: 'yes' })) !== null, 'a curve is true or false, nothing else')
}

if (failed) {
  console.error('\nSome checks failed.')
  process.exit(1)
}
console.log('\nAll checks passed.')
