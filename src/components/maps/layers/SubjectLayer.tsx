import { outlineToRing, type Outline, type Point } from '@/maps/geo'
import { GROUND } from '@/maps/palette'

import { pathOf, upright, type Projection } from './projection'

/**
 * The subject of a Map block as its clipping draws it (src/lib/dynmap.ts →
 * renderClip): a Towny town's claims outlined in the paper's ink, and a pin
 * on the centre when the block asks for one. Any town's, Azania's or another
 * nation's, since the clipping outlines either. Sent to the embedded map as
 * plain data (src/blocks/components/Map/index.tsx), so the live map keeps
 * what the still showed when it takes the still's place.
 */
export type Subject = {
  /** The paper's ink, or the style's: what the clipping drew in. */
  ink: string
  /** The town's claims; none when the block leaves them off. */
  claims: Outline[]
  /** The block's centre, when pinned. */
  pin: Point | null
}

type Props = {
  projection: Projection
  subject: Subject
  /**
   * The claims, or the pin. The live map draws the claims with the ground
   * and the pin over it, where it keeps its size mid-zoom
   * (leaflet/canvas.tsx → OnTop), as RoadsLayer draws its roads and names.
   */
  part: 'claims' | 'pin'
}

/** The ink line's width: the clipping's, once its 1,200 px picture is set in a column. */
const STROKE = 2

/**
 * The subject as the clipping draws it: the claims under a whitewash halo,
 * an ink line and a light wash of the same ink, and on the centre a
 * whitewash disc with an ink dot. The claims lie over the towns' own tint
 * and under the roads, a boundary on the ground; the pin over everything,
 * as the clipping's is.
 */
export function SubjectLayer({ projection, subject, part }: Props) {
  if (part === 'pin') {
    if (!subject.pin) return null
    const [x, y] = projection.project(subject.pin)
    return (
      <g className="az-subject" {...upright(x, y)}>
        <circle cx={x} cy={y} fill={GROUND.whitewash} r={7} />
        <circle cx={x} cy={y} fill={subject.ink} r={4.5} />
      </g>
    )
  }
  const d = subject.claims.map((claim) => pathOf(projection, outlineToRing(claim), true)).join('')
  if (!d) return null
  return (
    <g className="az-subject">
      <path
        d={d}
        fill={subject.ink}
        fillOpacity={0.16}
        stroke={GROUND.whitewash}
        strokeLinejoin="round"
        strokeOpacity={0.85}
        strokeWidth={STROKE + 3}
      />
      <path d={d} fill="none" stroke={subject.ink} strokeLinejoin="round" strokeWidth={STROKE} />
    </g>
  )
}
