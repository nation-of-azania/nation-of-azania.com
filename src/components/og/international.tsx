import type { ReactNode } from 'react'

import { bylineLabelOf, dateLabelOf } from '@/components/intl/IntlRecord'

import type { ArticleCard, CardContext, PlaceCard } from './model'
import {
  Avatar,
  type AvatarTone,
  Canvas,
  Caps,
  Dot,
  EmblemImage,
  IntlMarkShape,
  Picture,
  Within,
  col,
  fitSize,
  row,
} from './shared'
import { COLOR, FACE, HEAD_PX } from './tokens'

/**
 * The registry's card: the host strip and the nameplate in the record
 * serif on registry paper, then the record as a registry card files it —
 * where it was filed, its number as a badge, its title in Plex Serif, and
 * the details row beneath: who entered it (with their head in a hairline
 * frame), when, and how to cite it — closed by a verdigris rule. No style
 * has an International variant, so there is one dress.
 */

const AVATAR: AvatarTone = {
  frame: { background: COLOR.paper100, border: COLOR.paper300, padding: 3 },
  mark: { background: COLOR.verdigris100, color: COLOR.verdigris800, font: FACE.plexSerif, weight: 500 },
}

const WIDTH = 1200
const GUTTER = 56
const MONO = { font: FACE.plexMono, tracking: 0.14 } as const

export function InternationalCard({ card }: { card: ArticleCard | PlaceCard }) {
  return (
    <Canvas background={COLOR.paper50} fontFamily={FACE.sourceSans} color={COLOR.graphite900}>
      <Masthead top={card.top} />
      {card.kind === 'article' ? <Record card={card} /> : <Place card={card} />}
    </Canvas>
  )
}

/** The host strip, then the mark beside the name and its line, over a paper rule. */
function Masthead({ top }: { top: CardContext }) {
  return (
    <div style={{ ...col, flexShrink: 0 }}>
      <div
        style={{
          ...row,
          justifyContent: 'space-between',
          height: 36,
          padding: `0 ${GUTTER}px`,
          background: COLOR.paper100,
          borderBottom: `1px solid ${COLOR.paper200}`,
        }}
      >
        <Caps font={MONO.font} size={13} tracking={0.12} color={COLOR.graphite500}>
          Neutral ground · hosted by the Nation of Azania
        </Caps>
        <Caps font={MONO.font} size={13} tracking={0.12} color={COLOR.graphite500}>
          The Register
        </Caps>
      </div>
      <div
        style={{
          ...row,
          gap: 18,
          padding: `18px ${GUTTER}px 16px`,
          borderBottom: `2px solid ${COLOR.paper200}`,
        }}
      >
        <IntlMarkShape color={COLOR.verdigris700} size={46} />
        <div style={{ ...col, gap: 8 }}>
          <div
            style={{
              fontFamily: FACE.plexSerif,
              fontWeight: 500,
              fontSize: 32,
              lineHeight: 1,
              letterSpacing: -0.6,
              color: COLOR.graphite900,
            }}
          >
            {top.name}
          </div>
          {top.tagline ? (
            <Caps font={MONO.font} size={12} tracking={0.14} color={COLOR.graphite500}>
              {top.tagline}
            </Caps>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** A label in mono capitals over its value: one cell of the registry card. */
function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ ...col, gap: 10 }}>
      <Caps font={MONO.font} size={12} tracking={0.14} color={COLOR.graphite500}>
        {label}
      </Caps>
      <div style={{ ...row }}>{children}</div>
    </div>
  )
}

function Record({ card }: { card: ArticleCard }) {
  const picture = card.image ? 360 : 0
  const column = WIDTH - GUTTER * 2 - (picture ? picture + 40 : 0)
  const size = fitSize(card.title, { width: column, max: picture ? 52 : 56, min: 36, lines: 3, ratio: 0.5 })
  const filedIn = card.chain[card.chain.length - 1]
  const citation = card.number && card.year ? `${card.number}, ${filedIn ?? card.top.name}, ${card.year}` : null
  const above = card.chain.slice(1)
  return (
    <div style={{ ...row, flex: 1, alignItems: 'stretch', padding: `30px ${GUTTER}px 34px` }}>
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        {above.length > 0 ? (
          <Caps font={MONO.font} size={14} tracking={0.14} color={COLOR.graphite500}>
            {above.join('  ›  ')}
          </Caps>
        ) : null}
        <Caps font={MONO.font} size={16} tracking={0.16} color={COLOR.verdigris700} style={{ marginTop: above.length ? 16 : 0 }}>
          {card.number ? (
            <div
              style={{
                ...row,
                padding: '5px 10px',
                marginRight: 14,
                border: `2px solid ${COLOR.verdigris600}`,
                fontWeight: 500,
                color: COLOR.verdigris800,
              }}
            >
              {card.number}
            </div>
          ) : null}
          <span>{card.typeLabel}</span>
          {card.pinned ? (
            <>
              <Dot color={COLOR.paper300} />
              <span style={{ color: COLOR.graphite500 }}>Pinned</span>
            </>
          ) : null}
        </Caps>
        <div
          style={{
            marginTop: 16,
            fontFamily: FACE.plexSerif,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.1,
            letterSpacing: -0.8,
            color: COLOR.graphite900,
            textWrap: 'balance',
            lineClamp: 3,
          }}
        >
          {card.title}
        </div>
        <div
          style={{
            ...row,
            alignItems: 'flex-start',
            gap: 44,
            marginTop: 24,
            paddingTop: 20,
            borderTop: `1px solid ${COLOR.paper200}`,
          }}
        >
          {card.byline ? (
            <Detail label={bylineLabelOf(card)}>
              <div style={{ ...row, gap: 14 }}>
                <Avatar byline={card.byline} size={HEAD_PX} tone={AVATAR} />
                <div style={{ ...col, gap: 7 }}>
                  <div style={{ fontFamily: FACE.plexSerif, fontWeight: 500, fontSize: 23, lineHeight: 1 }}>
                    {card.byline.name}
                  </div>
                  {card.byline.title ? (
                    <Caps font={MONO.font} size={12} tracking={0.1} color={COLOR.graphite500}>
                      {card.byline.title}
                    </Caps>
                  ) : null}
                </div>
              </div>
            </Detail>
          ) : null}
          {card.date ? (
            <Detail label={dateLabelOf(card)}>
              <div style={{ fontSize: 22, lineHeight: 1, color: COLOR.graphite900 }}>{card.date}</div>
            </Detail>
          ) : null}
          {citation ? (
            <Detail label="Cite as">
              <div style={{ fontFamily: FACE.plexMono, fontSize: 17, lineHeight: 1.3, color: COLOR.graphite700 }}>
                {citation}
              </div>
            </Detail>
          ) : null}
        </div>
        <div style={{ marginTop: 30, height: 3, width: '100%', background: COLOR.verdigris600 }} />
      </div>
      {card.image ? (
        <div
          style={{
            ...col,
            width: picture,
            marginLeft: 40,
            padding: 6,
            background: COLOR.paper100,
            border: `1px solid ${COLOR.paper200}`,
          }}
        >
          <Picture src={card.image} />
        </div>
      ) : null}
    </div>
  )
}

/** The overview, an initiative, the register, a standing page. */
function Place({ card }: { card: PlaceCard }) {
  const parent = card.chain.length > 1 ? card.chain[card.chain.length - 2] : null
  const archive = card.what === 'archive'
  const level =
    card.what === 'home'
      ? 'The common register'
      : card.what === 'section'
        ? card.chain.length > 2 && parent
          ? `Within ${parent}`
          : 'Initiative'
        : archive
          ? card.top.name
          : card.chain.join('  ›  ')
  const title = archive ? 'The Register' : card.what === 'home' ? 'What the nations agree, kept in one place.' : card.title
  const tagline = archive
    ? `Everything entered under ${card.top.name}, newest first: announcements, standards, resolutions, reports and case studies.`
    : card.what === 'home'
      ? null
      : card.tagline
  const frame = 184
  const column = WIDTH - GUTTER * 2 - frame - 44
  const size = fitSize(title, { width: column, max: 66, min: 36, lines: 2, ratio: 0.5 })
  return (
    <div style={{ ...row, flex: 1, alignItems: 'stretch', padding: `32px ${GUTTER}px 36px`, gap: 44 }}>
      <div style={{ ...col, justifyContent: 'center' }}>
        <div
          style={{
            ...row,
            justifyContent: 'center',
            width: frame,
            height: frame,
            padding: 12,
            background: COLOR.slateWash,
            border: `1px solid ${COLOR.paper200}`,
          }}
        >
          {card.emblem ? (
            <EmblemImage src={card.emblem} size={frame - 26} />
          ) : (
            <IntlMarkShape color={COLOR.verdigris700} size={100} />
          )}
        </div>
      </div>
      <div style={{ ...col, flex: 1, justifyContent: 'center', minWidth: 0 }}>
        <Caps font={MONO.font} size={15} tracking={0.16} color={COLOR.verdigris700}>
          {level}
        </Caps>
        <div
          style={{
            marginTop: 16,
            fontFamily: FACE.plexSerif,
            fontWeight: 500,
            fontSize: size,
            lineHeight: 1.1,
            letterSpacing: -0.8,
            color: COLOR.graphite900,
            textWrap: 'balance',
            lineClamp: 2,
          }}
        >
          {title}
        </div>
        {tagline ? (
          <div style={{ marginTop: 16, fontSize: 27, lineHeight: 1.35, color: COLOR.graphite700, lineClamp: 2 }}>
            {tagline}
          </div>
        ) : null}
        <div style={{ marginTop: 24, height: 3, width: '100%', background: COLOR.verdigris600 }} />
        {card.what === 'home' || card.what === 'section' ? (
          <div style={{ ...col, marginTop: 18 }}>
            <Within
              label={card.what === 'home' ? 'Initiatives' : `Within ${card.title}`}
              names={card.sections}
              font={MONO.font}
              color={COLOR.graphite500}
              nameColor={COLOR.verdigris700}
              size={14}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
