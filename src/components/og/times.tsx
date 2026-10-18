import type { ReactNode } from 'react'

import type { ArticleCard, CardByline, CardContext, PlaceCard } from './model'
import {
  Avatar,
  type AvatarTone,
  BlossomMark,
  Canvas,
  Caps,
  Dot,
  EmblemImage,
  Picture,
  col,
  fitSize,
  row,
} from './shared'
import { COLOR, FACE, HEAD_PX } from './tokens'

/**
 * The Times' card: the cinnabar utility bar and the paper's nameplate in
 * Archivo Black over newsprint, then the story as the front page sets it —
 * kicker, black headline, the reporter's head printed flat with the lagoon
 * tick under their name. An opinion piece is a person speaking: the solid
 * Opinion tag and the great quotation mark behind the headline. Cherry
 * Blossom sets the story in the pink box the site gives a GirlieTea column,
 * in Fredoka, with the blossom in the tag — the nameplate stays the paper's
 * (src/components/styles/blossom/times.ts). The front page's card is the
 * nameplate itself, full size, over the bar of desks.
 */

type Dress = {
  accentInk: string
  accent: string
  deep: string
  tint: string
  faint: string
  wash: string
  display: string
  headlineWeight: 700 | 900
  nameWeight: 600 | 700
  ratio: number
  label: string
  labelWeight: 600
  box: { ground: string; edge: string } | null
  blossom: boolean
}

const PLAIN: Dress = {
  accentInk: COLOR.cinnabar700,
  accent: COLOR.cinnabar800,
  deep: COLOR.cinnabar900,
  tint: COLOR.cinnabar300,
  faint: COLOR.cinnabar200,
  wash: COLOR.cinnabar100,
  display: FACE.archivo,
  headlineWeight: 900,
  nameWeight: 700,
  ratio: 0.58,
  label: FACE.sourceSans,
  labelWeight: 600,
  box: null,
  blossom: false,
}

const BLOSSOM: Dress = {
  accentInk: COLOR.blossom600,
  accent: COLOR.blossom800,
  deep: COLOR.blossom900,
  tint: COLOR.blossom400,
  faint: COLOR.blossom300,
  wash: COLOR.blossom200,
  display: FACE.fredoka,
  headlineWeight: 700,
  nameWeight: 600,
  ratio: 0.54,
  label: FACE.fredoka,
  labelWeight: 600,
  box: { ground: COLOR.blossom100, edge: COLOR.blossom300 },
  blossom: true,
}

const avatarTone = (dress: Dress): AvatarTone => ({
  mark: { background: dress.wash, color: dress.accent, font: dress.display, weight: dress.headlineWeight },
  radius: dress.box ? 10 : 0,
})

const WIDTH = 1200
const GUTTER = 56

export function TimesCard({ card }: { card: ArticleCard | PlaceCard }) {
  const dress = card.style === 'blossom' ? BLOSSOM : PLAIN
  if (card.kind === 'place' && card.what === 'home') return <FrontPage card={card} />
  return (
    <Canvas background={COLOR.news50} fontFamily={FACE.sourceSans} color={COLOR.news900}>
      <UtilityBar />
      <Nameplate top={card.top} />
      {card.kind === 'article' ? <Story card={card} dress={dress} /> : <Desk card={card} dress={dress} />}
    </Canvas>
  )
}

/** The cinnabar strip over the nameplate. */
function UtilityBar() {
  return (
    <div
      style={{
        ...row,
        justifyContent: 'space-between',
        height: 34,
        padding: `0 ${GUTTER}px`,
        flexShrink: 0,
        background: COLOR.cinnabar800,
      }}
    >
      <Caps font={FACE.sourceSans} weight={600} size={13} tracking={0.2} color={COLOR.news50}>
        Independent Press of the Azanian Coast
      </Caps>
      <Caps font={FACE.sourceSans} weight={600} size={13} tracking={0.2} color="rgba(250,249,246,0.8)">
        The Free Press of Port Azania
      </Caps>
    </div>
  )
}

/** The paper's name in black capitals between the lagoon hairline and the cinnabar rule. */
function Nameplate({ top }: { top: CardContext }) {
  const size = fitSize(top.name, { width: WIDTH - 112, max: 48, min: 28, lines: 1, ratio: 0.66 })
  return (
    <div
      style={{
        ...col,
        alignItems: 'center',
        flexShrink: 0,
        padding: '18px 56px 16px',
        borderBottom: `3px solid ${COLOR.cinnabar800}`,
      }}
    >
      <div style={{ width: 440, height: 2, background: COLOR.lagoon500 }} />
      <div
        style={{
          marginTop: 14,
          fontFamily: FACE.archivo,
          fontWeight: 900,
          fontSize: size,
          letterSpacing: -1.5,
          lineHeight: 1,
          textTransform: 'uppercase',
          color: COLOR.cinnabar800,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {top.name}
      </div>
      <Caps font={FACE.sourceSans} size={13} tracking={0.28} color={COLOR.news500} style={{ marginTop: 12 }}>
        {top.tagline || 'Independent of the Chancellery'} · The Free Press of Port Azania
      </Caps>
    </div>
  )
}

/** The Opinion tag: solid accent, with the style's mark as the column's badge. */
function OpinionTag({ dress }: { dress: Dress }) {
  return (
    <div
      style={{
        ...row,
        gap: 7,
        padding: '5px 9px',
        background: dress.accent,
        color: COLOR.news50,
        borderRadius: dress.box ? 6 : 0,
        marginRight: 14,
      }}
    >
      {dress.blossom ? <BlossomMark color={COLOR.news50} size={14} /> : null}
      <span>Opinion</span>
    </div>
  )
}

/** The byline under a headline: a flat head, "By Name" in the grotesque, the desk with the lagoon tick. */
function Byline({ byline, dress }: { byline: CardByline; dress: Dress }) {
  return (
    <div style={{ ...row, gap: 18 }}>
      <Avatar byline={byline} size={HEAD_PX} tone={avatarTone(dress)} />
      <div style={{ ...col, gap: 8 }}>
        <div
          style={{
            ...row,
            fontFamily: dress.display,
            fontWeight: dress.nameWeight,
            fontSize: 25,
            lineHeight: 1,
            color: COLOR.news900,
          }}
        >
          <span style={{ color: COLOR.news500, fontWeight: 600, fontFamily: FACE.sourceSans, marginRight: 8 }}>
            By
          </span>
          <span>{byline.name}</span>
        </div>
        {byline.title ? (
          <div style={{ ...row, gap: 10, fontSize: 19, lineHeight: 1, color: COLOR.news500 }}>
            <div style={{ width: 18, height: 2, background: COLOR.lagoon500 }} />
            <span>{byline.title}</span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** The pink box a style switches on, or the plain newsprint. */
function Panel({ dress, children }: { dress: Dress; children: ReactNode }) {
  if (!dress.box) {
    return <div style={{ ...row, flex: 1, alignItems: 'stretch', padding: `34px ${GUTTER}px 38px` }}>{children}</div>
  }
  return (
    <div style={{ ...col, flex: 1, padding: `24px ${GUTTER - 12}px 26px` }}>
      <div
        style={{
          ...row,
          flex: 1,
          alignItems: 'stretch',
          padding: '24px 40px 28px',
          borderRadius: 30,
          border: `3px solid ${dress.box.edge}`,
          background: dress.box.ground,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Story({ card, dress }: { card: ArticleCard; dress: Dress }) {
  const opinion = card.type === 'opinion'
  const words = opinion ? card.kicker.filter((word) => word !== 'Opinion') : card.kicker
  const picture = card.image ? 420 : 0
  const inset = dress.box ? 12 + 40 : 0
  const column = WIDTH - GUTTER * 2 - inset * 2 - (picture ? picture + 40 : 0)
  const size = fitSize(card.title, {
    width: column,
    max: picture ? 60 : 64,
    min: 38,
    lines: 3,
    ratio: dress.ratio,
  })
  return (
    <Panel dress={dress}>
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0, position: 'relative' }}>
        {opinion ? (
          <div
            style={{
              position: 'absolute',
              top: dress.box ? -36 : -58,
              left: dress.box ? -14 : -18,
              fontFamily: FACE.alegreya,
              fontSize: 300,
              lineHeight: 1,
              color: dress.faint,
              opacity: 0.7,
            }}
          >
            “
          </div>
        ) : null}
        <Caps font={dress.label} weight={dress.labelWeight} size={19} tracking={0.16} color={dress.accentInk}>
          {opinion ? <OpinionTag dress={dress} /> : null}
          {words.map((word, index) => (
            <span key={word} style={{ ...row }}>
              {index > 0 ? <Dot color={COLOR.news300} /> : null}
              <span>{word}</span>
            </span>
          ))}
          {card.date ? (
            <>
              <Dot color={COLOR.news300} />
              <span style={{ color: COLOR.news500, fontWeight: dress.blossom ? 500 : 600 }}>{card.date}</span>
            </>
          ) : null}
        </Caps>
        <div
          style={{
            marginTop: 18,
            fontFamily: dress.display,
            fontWeight: dress.headlineWeight,
            fontSize: size,
            lineHeight: 1.04,
            letterSpacing: dress.blossom ? 0 : -1,
            color: opinion ? dress.deep : COLOR.news900,
            textWrap: 'balance',
            lineClamp: 3,
          }}
        >
          {card.title}
        </div>
        {card.byline ? (
          <div style={{ ...col, marginTop: 24 }}>
            <Byline byline={card.byline} dress={dress} />
          </div>
        ) : null}
        <div style={{ marginTop: 24, height: 3, width: '100%', background: dress.accent }} />
      </div>
      {card.image ? (
        <Picture src={card.image} radius={dress.box ? 18 : 0} style={{ width: picture, flex: 'none', marginLeft: 40 }} />
      ) : null}
    </Panel>
  )
}

/** The front page: the nameplate at full size over the bar of desks. */
function FrontPage({ card }: { card: PlaceCard }) {
  const desks = ['Front Page', ...card.sections, 'Archive']
  const size = fitSize(card.top.name, { width: WIDTH - GUTTER * 2, max: 124, min: 64, lines: 1, ratio: 0.66 })
  return (
    <Canvas background={COLOR.news50} fontFamily={FACE.sourceSans} color={COLOR.news900}>
      <UtilityBar />
      <div style={{ ...col, flex: 1, alignItems: 'center', justifyContent: 'center', padding: `0 ${GUTTER}px 20px` }}>
        <div style={{ width: 680, height: 2, background: COLOR.lagoon500 }} />
        <div
          style={{
            marginTop: 30,
            fontFamily: FACE.archivo,
            fontWeight: 900,
            fontSize: size,
            letterSpacing: -4,
            lineHeight: 1,
            textTransform: 'uppercase',
            color: COLOR.cinnabar800,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {card.top.name}
        </div>
        <Caps font={FACE.sourceSans} size={18} tracking={0.28} color={COLOR.news500} style={{ marginTop: 28 }}>
          {card.top.tagline || 'Independent of the Chancellery'} · The Free Press of Port Azania
        </Caps>
        <div style={{ marginTop: 32, width: '100%', height: 3, background: COLOR.cinnabar800 }} />
        <div
          style={{
            ...row,
            justifyContent: 'center',
            gap: 40,
            width: '100%',
            padding: '18px 24px',
            background: COLOR.news100,
            borderBottom: `1px solid ${COLOR.news200}`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {desks.map((desk) => (
            <Caps key={desk} font={FACE.sourceSans} weight={600} size={15} tracking={0.14} color={COLOR.cinnabar800}>
              {desk}
            </Caps>
          ))}
        </div>
      </div>
    </Canvas>
  )
}

/** A desk, the archive, a standing page: its name in the desk's colour over a rule of the same, its emblem or initial beside. */
function Desk({ card, dress }: { card: PlaceCard; dress: Dress }) {
  const archive = card.what === 'archive'
  const section = card.what === 'section'
  const parent = card.chain.length > 1 ? card.chain[card.chain.length - 2] : null
  const level = archive
    ? card.top.name
    : section
      ? card.chain.length > 2 && parent
        ? `Within ${parent}`
        : 'A desk of the Times'
      : card.chain.length > 1
        ? card.chain.join('  ›  ')
        : card.top.name
  const title = archive ? 'The Archive' : card.title
  const tagline = section ? card.tagline : null
  const framed = section
  const frame = 168
  const column = WIDTH - GUTTER * 2 - (dress.box ? 104 : 0) - (framed ? frame + 40 : 0)
  const size = fitSize(title, {
    width: column,
    max: archive || section ? 84 : 66,
    min: 36,
    lines: 2,
    ratio: archive || section ? 0.66 : dress.ratio,
  })
  return (
    <Panel dress={dress}>
      {framed ? (
        <div style={{ ...col, justifyContent: 'center', marginRight: 40 }}>
          <div
            style={{
              ...row,
              justifyContent: 'center',
              width: frame,
              height: frame,
              flexShrink: 0,
              padding: 10,
              background: dress.wash,
              borderRadius: dress.box ? 18 : 0,
            }}
          >
            {card.emblem ? (
              <EmblemImage src={card.emblem} size={frame - 20} />
            ) : dress.blossom ? (
              <BlossomMark color={dress.accentInk} size={91} />
            ) : (
              <div
                style={{
                  fontFamily: dress.display,
                  fontWeight: dress.headlineWeight,
                  fontSize: 96,
                  lineHeight: 1,
                  color: dress.accent,
                }}
              >
                {card.title.trim().charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        <Caps font={dress.label} weight={dress.labelWeight} size={18} tracking={0.16} color={dress.accentInk}>
          {level}
        </Caps>
        <div
          style={{
            marginTop: 14,
            fontFamily: dress.display,
            fontWeight: dress.headlineWeight,
            fontSize: size,
            lineHeight: 1.04,
            letterSpacing: dress.blossom ? 0 : -1.5,
            color: archive || section ? dress.accentInk : COLOR.news900,
            textTransform: archive || section ? 'uppercase' : 'none',
            textWrap: 'balance',
            lineClamp: 2,
          }}
        >
          {title}
        </div>
        {tagline ? (
          <div style={{ marginTop: 16, fontSize: 26, lineHeight: 1.3, color: COLOR.news700, lineClamp: 2 }}>{tagline}</div>
        ) : null}
        <div style={{ marginTop: 24, height: 3, width: '100%', background: dress.accent }} />
        {section && card.sections.length > 0 ? (
          <Caps
            font={dress.label}
            weight={dress.labelWeight}
            size={15}
            tracking={0.14}
            color={COLOR.news500}
            style={{ marginTop: 16, whiteSpace: 'nowrap', overflow: 'hidden' }}
          >
            <span style={{ marginRight: 14 }}>Within this desk</span>
            <span style={{ color: dress.accentInk }}>{card.sections.join('   ·   ')}</span>
          </Caps>
        ) : null}
      </div>
    </Panel>
  )
}
