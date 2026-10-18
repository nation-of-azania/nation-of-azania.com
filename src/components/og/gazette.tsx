import type { CSSProperties } from 'react'

import { isStateDocument } from '@/components/site/format'

import type { ArticleCard, CardByline, CardContext, PlaceCard } from './model'
import {
  Avatar,
  type AvatarTone,
  BlossomMark,
  Canvas,
  Caps,
  CrestMark,
  Dot,
  EmblemImage,
  FlagTick,
  Picture,
  SealMark,
  WaxSeal,
  Within,
  breadcrumbOf,
  col,
  fitSize,
  fitText,
  row,
} from './shared'
import { COLOR, FACE, HEAD_PX } from './tokens'

/**
 * The Gazette's card: the deep-water masthead under the national ribbon,
 * then sand, with the kicker in saffron, the headline in Alegreya and the
 * double rule beneath, and the signatory's head in a sand frame — a clipping
 * of the official record. A document of state is set as the instrument it
 * is: letterhead, crest and type under the seal, everything centred, and the
 * signature with the Seal of the Nation pressed beside a decree's. Cherry
 * Blossom keeps all of that and takes the style's rose for the saffron, its
 * bubbly face for the headline and labels, and its blossom where the seal
 * would be, as the site does (src/components/styles/blossom/gazette.ts).
 */

type Dress = {
  accentInk: string
  accent: string
  wash: string
  sealInk: string
  seal: string
  display: string
  displayWeight: 400 | 500
  /** The display face's average glyph width, for fitting headlines. */
  ratio: number
  label: string
  labelWeight: 400 | 500
  blossom: boolean
}

const PLAIN: Dress = {
  accentInk: COLOR.saffron600,
  accent: COLOR.saffron400,
  wash: COLOR.sand100,
  sealInk: COLOR.coral700,
  seal: COLOR.coral600,
  display: FACE.alegreya,
  displayWeight: 400,
  ratio: 0.46,
  label: FACE.sourceSans,
  labelWeight: 400,
  blossom: false,
}

const BLOSSOM: Dress = {
  accentInk: COLOR.blossom700,
  accent: COLOR.blossom400,
  wash: COLOR.blossomPlank,
  sealInk: COLOR.blossom700,
  seal: COLOR.blossom400,
  display: FACE.fredoka,
  displayWeight: 500,
  ratio: 0.52,
  label: FACE.fredoka,
  labelWeight: 500,
  blossom: true,
}

const AVATAR: AvatarTone = {
  frame: { background: COLOR.sand100, border: COLOR.sand300, padding: 4 },
  mark: { background: COLOR.sea800, color: COLOR.sand100, font: FACE.alegreya, weight: 400 },
}

const WIDTH = 1200
const GUTTER = 64

export function GazetteCard({ card }: { card: ArticleCard | PlaceCard }) {
  const dress = card.style === 'blossom' ? BLOSSOM : PLAIN
  return (
    <Canvas background={COLOR.sand50} fontFamily={FACE.sourceSans} color={COLOR.ink900}>
      <Masthead top={card.top} />
      {card.kind === 'article' ? (
        isStateDocument(card) ? (
          <Instrument card={card} dress={dress} />
        ) : (
          <Record card={card} dress={dress} />
        )
      ) : (
        <Place card={card} dress={dress} />
      )}
    </Canvas>
  )
}

/** The national ribbon over the sea masthead: crest, wordmark and the Gazette's line. */
function Masthead({ top }: { top: CardContext }) {
  return (
    <div style={{ ...col, flexShrink: 0 }}>
      <div style={{ height: 8, background: COLOR.saffron400 }} />
      <div style={{ height: 3, background: COLOR.coral600 }} />
      <div
        style={{
          ...row,
          justifyContent: 'space-between',
          height: 86,
          padding: `0 ${GUTTER}px`,
          background: COLOR.sea900,
        }}
      >
        <div style={{ ...row, gap: 18 }}>
          <CrestMark color={COLOR.saffron300} height={52} />
          <div style={{ ...col, gap: 8 }}>
            <Caps font={FACE.alegreya} size={28} tracking={0.3} color={COLOR.sand50}>
              Azania
            </Caps>
            <Caps font={FACE.sourceSans} size={13} tracking={0.22} color="rgba(235,226,205,0.72)">
              Official Gazette of the Nation
            </Caps>
          </div>
        </div>
        <Caps font={FACE.sourceSans} size={14} tracking={0.18} color="rgba(235,226,205,0.78)">
          {top.tagline ?? top.name}
        </Caps>
      </div>
    </div>
  )
}

/** The gazette's double rule: the sea wall over the sunlit water. */
function DoubleRule({ accent, width, style }: { accent: string; width?: number; style?: CSSProperties }) {
  return (
    <div style={{ ...col, width: width ?? '100%', flexShrink: 0, ...style }}>
      <div style={{ height: 4, background: COLOR.sea800 }} />
      <div style={{ height: 2, marginTop: 3, background: accent }} />
    </div>
  )
}

function Headline({
  text,
  width,
  dress,
  max,
  centred,
  lines = 3,
  size = fitSize(text, { width, max, min: 40, lines, ratio: dress.ratio }),
}: {
  text: string
  width: number
  dress: Dress
  max: number
  centred?: boolean
  lines?: number
  size?: number
}) {
  return (
    <div
      style={{
        fontFamily: dress.display,
        fontWeight: dress.displayWeight,
        fontSize: size,
        lineHeight: 1.08,
        color: COLOR.sea950,
        textWrap: 'balance',
        lineClamp: lines,
        textAlign: centred ? 'center' : 'left',
      }}
    >
      {text}
    </div>
  )
}

/** "By Name" in the display serif, the office beneath as an eyebrow. */
function Byline({ byline, dress }: { byline: CardByline; dress: Dress }) {
  return (
    <div style={{ ...row, gap: 18 }}>
      <Avatar byline={byline} size={HEAD_PX} tone={AVATAR} />
      <div style={{ ...col, gap: 9 }}>
        <div
          style={{
            ...row,
            fontFamily: dress.display,
            fontWeight: dress.displayWeight,
            fontSize: 30,
            lineHeight: 1,
            color: COLOR.sea950,
          }}
        >
          <span style={{ color: COLOR.ink500, marginRight: 9 }}>By</span>
          <span>{byline.name}</span>
        </div>
        {byline.title ? (
          <Caps font={dress.label} weight={dress.labelWeight} size={15} tracking={0.18} color={dress.accentInk}>
            {byline.title}
          </Caps>
        ) : null}
      </div>
    </div>
  )
}

/** A dispatch or an explanation: kicker, headline, rule, byline, and its picture beside. */
function Record({ card, dress }: { card: ArticleCard; dress: Dress }) {
  const picture = card.image ? 400 : 0
  const column = WIDTH - GUTTER * 2 - (picture ? picture + 44 : 0)
  return (
    <div style={{ ...row, flex: 1, alignItems: 'stretch', padding: `40px ${GUTTER}px 44px` }}>
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        <Caps font={dress.label} weight={dress.labelWeight} size={19} tracking={0.2} color={dress.accentInk}>
          {card.section ? (
            <>
              <span style={{ color: COLOR.sea700 }}>{card.section.name}</span>
              <Dot color={COLOR.sand300} />
            </>
          ) : null}
          <span>{card.typeLabel}</span>
          {card.date ? (
            <>
              <Dot color={COLOR.sand300} />
              <span style={{ color: COLOR.ink400 }}>{card.date}</span>
            </>
          ) : null}
        </Caps>
        <div style={{ ...col, marginTop: 20 }}>
          <Headline text={card.title} width={column} dress={dress} max={picture ? 60 : 66} />
        </div>
        <DoubleRule accent={dress.accent} style={{ marginTop: 26 }} />
        {card.byline || card.pinned ? (
          <div style={{ ...row, marginTop: 26, justifyContent: 'space-between' }}>
            {card.byline ? <Byline byline={card.byline} dress={dress} /> : <div />}
            {card.pinned ? (
              <div style={{ ...row, gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 8, background: dress.seal }} />
                <Caps font={dress.label} weight={dress.labelWeight} size={14} tracking={0.18} color={dress.sealInk}>
                  Pinned document
                </Caps>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {card.image ? (
        <div
          style={{
            ...col,
            width: picture,
            marginLeft: 44,
            padding: 8,
            background: COLOR.sand100,
            border: `1.5px solid ${COLOR.sand300}`,
          }}
        >
          <Picture src={card.image} />
        </div>
      ) : null}
    </div>
  )
}

/** A decree, a statement, a notice: the letterhead, the type under the seal, the signature. */
function Instrument({ card, dress }: { card: ArticleCard; dress: Dress }) {
  const decree = card.type === 'decree'
  const Badge = dress.blossom ? BlossomMark : SealMark
  const headline = fitText(card.title, { width: WIDTH - 192, max: 64, min: 40, lines: 3, ratio: dress.ratio })
  // A three-line title has the crest and the gaps give way a little.
  const tall = headline.lines >= 3
  const gap = tall ? 14 : 22
  return (
    <div
      style={{
        ...col,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '18px 96px 22px',
        overflow: 'hidden',
      }}
    >
      <CrestMark color={COLOR.sea900} height={tall ? 52 : 72} />
      <Caps
        font={dress.label}
        weight={dress.labelWeight}
        size={16}
        tracking={0.24}
        color={COLOR.ink500}
        style={{ marginTop: tall ? 12 : 18 }}
      >
        <FlagTick height={14} />
        <span style={{ marginLeft: 12 }}>The Nation of Azania</span>
        {card.section ? (
          <>
            <Dot color={COLOR.sand300} />
            <span style={{ color: COLOR.sea700 }}>{card.section.name}</span>
          </>
        ) : null}
      </Caps>
      <Caps
        font={dress.label}
        weight={dress.labelWeight}
        size={16}
        tracking={0.24}
        color={dress.sealInk}
        style={{ marginTop: 11 }}
      >
        <Badge color={dress.sealInk} size={17} />
        <span style={{ marginLeft: 11 }}>{card.typeLabel}</span>
        {card.date ? (
          <>
            <Dot color={COLOR.sand300} />
            <span style={{ color: COLOR.ink500 }}>{card.date}</span>
          </>
        ) : null}
      </Caps>
      <div style={{ ...col, marginTop: gap, width: '100%', alignItems: 'center' }}>
        <Headline text={card.title} width={WIDTH - 192} dress={dress} max={64} size={headline.size} centred />
      </div>
      <DoubleRule accent={dress.accent} width={360} style={{ marginTop: gap }} />
      {card.byline ? (
        <div style={{ ...row, marginTop: gap, gap: 36 }}>
          <div style={{ ...col, alignItems: 'center' }}>
            <Caps font={dress.label} weight={dress.labelWeight} size={13} tracking={0.2} color={dress.accentInk}>
              {decree ? 'Given under the hand of' : 'Issued by'}
            </Caps>
            <div style={{ ...row, marginTop: 12, gap: 16 }}>
              <Avatar byline={card.byline} size={HEAD_PX} tone={AVATAR} />
              <div style={{ ...col, alignItems: 'flex-start', gap: 8 }}>
                <div
                  style={{
                    fontFamily: dress.display,
                    fontWeight: dress.displayWeight,
                    fontSize: 28,
                    lineHeight: 1,
                    color: COLOR.sea950,
                  }}
                >
                  {card.byline.name}
                </div>
                {card.byline.title ? (
                  <Caps font={dress.label} weight={dress.labelWeight} size={13} tracking={0.18} color={COLOR.ink500}>
                    {card.byline.title}
                  </Caps>
                ) : null}
              </div>
            </div>
          </div>
          {decree ? <WaxSeal size={76} /> : null}
        </div>
      ) : null}
    </div>
  )
}

/** The Gazette, an office of state, a standing page: emblem or crest, eyebrow, name, tagline, rule. */
function Place({ card, dress }: { card: PlaceCard; dress: Dress }) {
  const parent = card.chain.length > 1 ? card.chain[card.chain.length - 2] : null
  const archive = card.what === 'archive'
  const eyebrow =
    card.what === 'home'
      ? 'The Nation of Azania'
      : card.what === 'section'
        ? card.chain.length > 2 && parent
          ? `Within ${parent}`
          : 'An office of state'
        : archive
          ? 'Published by Authority of the Chancellery'
          : breadcrumbOf(card.chain, 'The Nation of Azania')
  const title = archive ? 'The Azania Gazette' : card.title
  const tagline = archive
    ? 'Decrees, dispatches and chronicles of the nation, newest first.'
    : card.tagline
  const frame = 200
  const column = WIDTH - GUTTER * 2 - frame - 48
  return (
    <div style={{ ...row, flex: 1, padding: `36px ${GUTTER}px 40px`, gap: 48 }}>
      <div
        style={{
          ...row,
          justifyContent: 'center',
          width: frame,
          height: frame,
          flexShrink: 0,
          padding: 12,
          background: dress.wash,
          border: `1.5px solid ${COLOR.sand300}`,
        }}
      >
        {card.emblem ? (
          <EmblemImage src={card.emblem} size={frame - 26} />
        ) : dress.blossom ? (
          <BlossomMark color={dress.accentInk} size={104} />
        ) : (
          <CrestMark color={dress.accentInk} height={128} />
        )}
      </div>
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        <Caps font={dress.label} weight={dress.labelWeight} size={18} tracking={0.22} color={dress.accentInk}>
          <FlagTick height={15} />
          <span style={{ marginLeft: 14 }}>{eyebrow}</span>
        </Caps>
        <div style={{ ...col, marginTop: 18 }}>
          <Headline text={title} width={column} dress={dress} max={76} lines={2} />
        </div>
        {tagline ? (
          <div
            style={{
              marginTop: 16,
              fontSize: 29,
              lineHeight: 1.3,
              color: COLOR.ink500,
              lineClamp: 2,
            }}
          >
            {tagline}
          </div>
        ) : null}
        <DoubleRule accent={dress.accent} style={{ marginTop: 24 }} />
        {card.what === 'home' || card.what === 'section' ? (
          <div style={{ ...col, marginTop: 18 }}>
            <Within
              label={card.what === 'home' ? 'Offices of state' : 'Within this office'}
              names={card.sections}
              font={dress.label}
              weight={dress.labelWeight}
              color={dress.accentInk}
              nameColor={COLOR.sea700}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
