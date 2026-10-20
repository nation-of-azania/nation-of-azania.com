import type { CSSProperties, ReactNode } from 'react'

import { GROUND } from '@/maps/palette'

import type { MapCard, MapPicture, MapSubject } from './model'
import { Avatar, type AvatarTone, Canvas, Caps, CrestMark, Dot, FlagTick, col, fitSize, row } from './shared'
import { COLOR, FACE, HEAD_PX, MAP_PICTURE } from './tokens'

/**
 * Azania Maps' card: the map as the page shows it — the panel beside the
 * picture — under a masthead in the Gazette's hand, since the map is set
 * in it. The picture is the clipping renderClip drew, with the thing on it
 * the way the map draws it; the towns' names are set over it here, in the
 * small capitals the map uses. The panel names the thing, shows what the
 * map's own panel would (the ruler's head, a place's glyph, an event's
 * calendar leaf), and closes with the double rule, a few facts and the
 * survey reference in mono.
 */

const WIDTH = 1200
const PANEL = WIDTH - MAP_PICTURE.width
const GUTTER = 36
const COLUMN = PANEL - GUTTER * 2 - 2

const AVATAR: AvatarTone = {
  frame: { background: COLOR.sand100, border: COLOR.sand300, padding: 4 },
  mark: { background: COLOR.sea800, color: COLOR.sand100, font: FACE.alegreya, weight: 400 },
}

export function MapsCard({ card }: { card: MapCard }) {
  return (
    <Canvas background={COLOR.sand50} fontFamily={FACE.sourceSans} color={COLOR.ink900}>
      <Masthead />
      <div style={{ ...row, flex: 1, alignItems: 'stretch' }}>
        <Panel card={card} />
        <Picture picture={card.picture} />
      </div>
    </Canvas>
  )
}

/** The national ribbon over the sea masthead, with the map's wordmark where the Gazette's goes. */
function Masthead() {
  return (
    <div style={{ ...col, flexShrink: 0 }}>
      <div style={{ height: 8, background: COLOR.saffron400 }} />
      <div style={{ height: 3, background: COLOR.coral600 }} />
      <div
        style={{
          ...row,
          justifyContent: 'space-between',
          height: 64,
          padding: `0 ${GUTTER}px`,
          background: COLOR.sea900,
        }}
      >
        <div style={{ ...row, gap: 14 }}>
          <CrestMark color={COLOR.saffron300} height={38} />
          <div style={{ ...col, gap: 7 }}>
            <Caps font={FACE.alegreya} size={23} tracking={0.3} color={COLOR.sand50}>
              <span>Azania</span>
              <span style={{ color: COLOR.saffron300, marginLeft: 9 }}>Maps</span>
            </Caps>
            <Caps font={FACE.sourceSans} size={11} tracking={0.22} color="rgba(235,226,205,0.72)">
              The Nation, charted
            </Caps>
          </div>
        </div>
        <Caps font={FACE.sourceSans} size={13} tracking={0.18} color="rgba(235,226,205,0.78)">
          Towns · Places · Roads · Events
        </Caps>
      </div>
    </div>
  )
}

/** The gazette's double rule: the sea wall over the sunlit water. */
function DoubleRule() {
  return (
    <div style={{ ...col, width: '100%', flexShrink: 0 }}>
      <div style={{ height: 4, background: COLOR.sea800 }} />
      <div style={{ height: 2, marginTop: 3, background: COLOR.saffron400 }} />
    </div>
  )
}

/** The small mark before the eyebrow: what kind of thing this is, drawn as the map draws it. */
function KindMark({ subject }: { subject: MapSubject }) {
  switch (subject.what) {
    case 'nation':
      return <FlagTick height={14} />
    case 'town':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 1.5L14.5 8L8 14.5L1.5 8Z" fill={GROUND.sea800} stroke={GROUND.whitewash} strokeWidth="1.5" />
        </svg>
      )
    case 'place':
      return <Disc colour={subject.category.colour} d={subject.category.d} fill={subject.category.fill} size={28} />
    case 'road':
      return (
        <svg width="30" height="12" viewBox="0 0 30 12" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 6H27" stroke={GROUND.saffronDeep} strokeWidth="8" strokeLinecap="round" />
          <path d="M3 6H27" stroke={GROUND.saffronLight} strokeWidth="4" strokeLinecap="round" />
        </svg>
      )
    case 'event':
      return <Disc colour={GROUND.coral} d="M7 3v18M7 4h10l-3 4 3 4H7" fill={false} size={28} />
  }
}

/** A pin's disc with a category's glyph on its 24 grid, as PlacePin draws it (src/components/maps/layers). */
function Disc({ colour, d, fill, size }: { colour: string; d: string; fill: boolean; size: number }) {
  const r = size / 2
  const scale = (size * 0.58) / 24
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <circle cx={r} cy={r} r={r - 1} fill={colour} stroke={GROUND.whitewash} strokeWidth="1.5" />
      <g transform={`translate(${r - 12 * scale} ${r - 12 * scale}) scale(${scale})`}>
        <path
          d={d}
          fill={fill ? GROUND.whitewash : 'none'}
          stroke={GROUND.whitewash}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}

/** The words above the name: the kind, and where it is. */
function eyebrowOf(subject: MapSubject): ReactNode {
  const parts: string[] =
    subject.what === 'nation'
      ? ['The Nation of Azania']
      : subject.what === 'town'
        ? ['Town', subject.nation ?? 'Without a nation']
        : subject.what === 'place'
          ? [subject.category.label, ...(subject.town ? [subject.town] : [])]
          : subject.what === 'road'
            ? [subject.kind, subject.town ?? 'Between towns']
            : ['Event', ...(subject.town ? [subject.town] : [])]
  return parts.map((part, index) => (
    <span key={part} style={{ ...row }}>
      {index > 0 ? <Dot color={COLOR.sand300} /> : null}
      <span style={{ color: index > 0 ? COLOR.sea700 : COLOR.saffron600 }}>{part}</span>
    </span>
  ))
}

const titleOf = (subject: MapSubject): string =>
  subject.what === 'nation' ? 'Azania Maps' : subject.what === 'event' ? subject.title : subject.name

/** The particulars beside the picture. */
function Panel({ card }: { card: MapCard }) {
  const { subject } = card
  const title = titleOf(subject)
  const size = fitSize(title, { width: COLUMN, max: subject.what === 'nation' ? 58 : 52, min: 30, lines: 3, ratio: 0.46 })
  return (
    <div
      style={{
        ...col,
        justifyContent: 'space-between',
        width: PANEL,
        flexShrink: 0,
        padding: `30px ${GUTTER}px 28px`,
        borderRight: `1.5px solid ${COLOR.sand300}`,
        background: COLOR.sand50,
      }}
    >
      <div style={{ ...col, minWidth: 0 }}>
        <Caps font={FACE.sourceSans} size={16} tracking={0.2} color={COLOR.saffron600}>
          <KindMark subject={subject} />
          <span style={{ ...row, marginLeft: 12 }}>{eyebrowOf(subject)}</span>
        </Caps>
        <div
          style={{
            marginTop: 16,
            fontFamily: FACE.alegreya,
            fontSize: size,
            lineHeight: 1.06,
            color: COLOR.sea950,
            textWrap: 'balance',
            lineClamp: 3,
          }}
        >
          {title}
        </div>
        <Particulars subject={subject} />
      </div>
      <div style={{ ...col, marginTop: 18 }}>
        <DoubleRule />
        {card.facts.length ? (
          <div style={{ ...row, flexWrap: 'wrap', alignItems: 'flex-start', marginTop: 14 }}>
            {card.facts.map((fact, index) => (
              <div
                key={fact.label}
                style={{ ...col, gap: 5, width: COLUMN / 2, marginTop: index >= 2 ? 20 : 0, paddingRight: 12 }}
              >
                <Caps font={FACE.sourceSans} size={11} tracking={0.18} color={COLOR.ink500}>
                  {fact.label}
                </Caps>
                <div
                  style={{
                    fontSize: 21,
                    fontWeight: 600,
                    lineHeight: 1.15,
                    color: COLOR.ink900,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {fact.value}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {card.survey ? (
          <div
            style={{
              marginTop: 16,
              fontFamily: FACE.plexMono,
              fontSize: 14,
              letterSpacing: 0.8,
              lineHeight: 1,
              color: COLOR.ink500,
              whiteSpace: 'nowrap',
            }}
          >
            {card.survey}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** What the map's own panel shows under the name, by kind. */
function Particulars({ subject }: { subject: MapSubject }) {
  switch (subject.what) {
    case 'nation':
      return (
        <div style={{ marginTop: 16, fontSize: 21, lineHeight: 1.35, color: COLOR.ink500 }}>
          Its towns, places, roads and events, on the Rulercraft map.
        </div>
      )
    case 'town':
      return (
        <div style={{ ...col, marginTop: 20 }}>
          {subject.ruler ? (
            <div style={{ ...row, gap: 16 }}>
              <Avatar byline={subject.ruler} size={HEAD_PX} tone={AVATAR} />
              <div style={{ ...col, gap: 8 }}>
                <Caps font={FACE.sourceSans} size={12} tracking={0.18} color={COLOR.ink500}>
                  Ruler
                </Caps>
                <div style={{ fontFamily: FACE.alegreya, fontSize: 28, lineHeight: 1, color: COLOR.sea950 }}>
                  {subject.ruler.name}
                </div>
              </div>
            </div>
          ) : null}
          {subject.spawn ? (
            <div style={{ ...row, gap: 12, marginTop: subject.ruler ? 18 : 0 }}>
              <div
                style={{
                  fontFamily: FACE.plexMono,
                  fontWeight: 500,
                  fontSize: 17,
                  lineHeight: 1,
                  padding: '8px 11px',
                  color: COLOR.sea800,
                  background: COLOR.sand100,
                  border: `1px solid ${COLOR.sand300}`,
                }}
              >
                {subject.spawn.command}
              </div>
              {subject.spawn.open !== null ? (
                <Caps font={FACE.sourceSans} size={12} tracking={0.16} color={subject.spawn.open ? COLOR.ink500 : COLOR.coral700}>
                  {subject.spawn.open ? 'Open to all' : 'Residents only'}
                </Caps>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    case 'place':
      return subject.description ? <Lines clamp={3}>{subject.description}</Lines> : null
    case 'road':
      return <Lines clamp={3}>{subject.description}</Lines>
    case 'event':
      return (
        <div style={{ ...col, marginTop: 18 }}>
          <div style={{ ...row, gap: 16, alignItems: 'stretch' }}>
            <div
              style={{
                ...col,
                alignItems: 'center',
                justifyContent: 'center',
                width: 74,
                padding: '8px 0 9px',
                flexShrink: 0,
                background: COLOR.sand100,
                border: `1.5px solid ${COLOR.sand300}`,
              }}
            >
              <Caps font={FACE.sourceSans} weight={600} size={11} tracking={0.16} color={COLOR.coral700}>
                {subject.leaf.weekday}
              </Caps>
              <div style={{ marginTop: 4, fontFamily: FACE.alegreya, fontSize: 38, lineHeight: 1, color: COLOR.sea950 }}>
                {subject.leaf.day}
              </div>
              <Caps font={FACE.sourceSans} size={11} tracking={0.16} color={COLOR.ink500} style={{ marginTop: 5 }}>
                {subject.leaf.month}
              </Caps>
            </div>
            <div style={{ ...col, justifyContent: 'center', gap: 7, minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1, color: COLOR.ink900 }}>{subject.time}</div>
              <Lines clamp={2} size={18} color={COLOR.ink500} style={{ marginTop: 0 }}>
                {subject.where}
              </Lines>
            </div>
          </div>
          {subject.description ? (
            <Lines clamp={2} size={18} style={{ marginTop: 14 }}>
              {subject.description}
            </Lines>
          ) : null}
        </div>
      )
  }
}

/** A few lines of prose under the name, cut with an ellipsis where they run long. */
function Lines({
  children,
  clamp,
  size = 20,
  color = COLOR.ink700,
  style,
}: {
  children: ReactNode
  clamp: number
  size?: number
  color?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'block', marginTop: 16, fontSize: size, lineHeight: 1.35, color, lineClamp: clamp, ...style }}>
      {children}
    </div>
  )
}

/** The clipping, the towns' names over it; the sea alone, with a word, while the map isn't answering. */
function Picture({ picture }: { picture: MapPicture }) {
  const { width, height } = MAP_PICTURE
  return (
    <div style={{ ...col, position: 'relative', width, height, flexShrink: 0, background: GROUND.sea, overflow: 'hidden' }}>
      {picture.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori draws this, not a browser.
        <img src={picture.src} width={width} height={height} alt="" style={{ width, height }} />
      ) : (
        <div style={{ ...col, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <CrestMark color="rgba(235,226,205,0.28)" height={64} />
          <Caps font={FACE.sourceSans} size={14} tracking={0.22} color="rgba(235,226,205,0.7)" style={{ marginTop: 10 }}>
            The Rulercraft map isn’t answering just now
          </Caps>
          <Caps font={FACE.sourceSans} size={12} tracking={0.18} color="rgba(235,226,205,0.45)">
            The picture will be back when it is
          </Caps>
        </div>
      )}
      {picture.labels.map((label) => (
        <TownName key={`${label.x},${label.y}`} {...label} />
      ))}
    </div>
  )
}

/** A town's name in small capitals over its home block, with the map's lozenge under it. */
function TownName({ x, y, text, selected }: MapPicture['labels'][number]) {
  const size = 14
  const tracking = size * 0.14
  const w = Math.round(text.length * size * 0.66 + text.length * tracking + 22)
  const h = 28
  // The lozenge's centre lands on the home block; the name sits 8 px above it.
  return (
    <div style={{ ...col, position: 'absolute', left: Math.round(x - w / 2), top: Math.round(y - h - 15), width: w }}>
      <div
        style={{
          ...row,
          justifyContent: 'center',
          width: w,
          height: h,
          background: 'rgba(251,248,241,0.94)',
          border: `1px solid ${COLOR.sand300}`,
          fontFamily: FACE.sourceSans,
          fontWeight: 600,
          fontSize: size,
          letterSpacing: tracking,
          lineHeight: 1,
          color: selected ? COLOR.saffron600 : COLOR.sea800,
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
      <div style={{ ...row, justifyContent: 'center', width: w, marginTop: 8 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M7 1L13 7L7 13L1 7Z"
            fill={selected ? GROUND.saffron : GROUND.sea800}
            stroke={GROUND.whitewash}
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  )
}
