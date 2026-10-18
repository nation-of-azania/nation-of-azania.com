import { Canvas, Caps, CrestMark, FlagTick, col, row } from './shared'
import { COLOR, FACE } from './tokens'

/**
 * The card for everything that is not a page of a publication — sign-in,
 * a missing page, a path a crawler made up: the nation itself, crest and
 * wordmark on the deep water under the national ribbon, as the Gazette's
 * masthead has it. Nothing here comes from the database, so it also stands
 * in when the database cannot be reached.
 */
export function GenericCard() {
  return (
    <Canvas background={COLOR.sea900} fontFamily={FACE.sourceSans} color={COLOR.sand50}>
      <div style={{ height: 10, background: COLOR.saffron400 }} />
      <div style={{ height: 4, background: COLOR.coral600 }} />
      <div style={{ ...col, flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 14 }}>
        <CrestMark color={COLOR.saffron300} height={176} />
        <Caps font={FACE.alegreya} size={74} tracking={0.32} color={COLOR.sand50} style={{ marginTop: 30, marginLeft: 24 }}>
          Azania
        </Caps>
        <Caps font={FACE.sourceSans} size={17} tracking={0.26} color="rgba(235,226,205,0.78)" style={{ marginTop: 22 }}>
          <FlagTick height={14} />
          <span style={{ marginLeft: 14 }}>A harbour nation on the Rulercraft realm</span>
        </Caps>
      </div>
      <div
        style={{
          ...row,
          justifyContent: 'center',
          height: 58,
          borderTop: '1px solid rgba(235,226,205,0.18)',
        }}
      >
        <Caps font={FACE.sourceSans} size={14} tracking={0.22} color="rgba(235,226,205,0.6)">
          The Gazette · The Azanian Times · International
        </Caps>
      </div>
    </Canvas>
  )
}
