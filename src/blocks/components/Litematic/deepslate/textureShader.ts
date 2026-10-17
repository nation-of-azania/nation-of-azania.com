import { ShaderProgram, type StructureRenderer } from 'deepslate'

/**
 * Antialiased-nearest atlas sampling for the block textures — the fix for the
 * block-edge "flicker".
 *
 * DeepSlate samples the atlas with NEAREST magnification. At the scale this
 * viewer frames a build, each 16-px block texture is drawn a few screen pixels
 * PER texel — i.e. magnified — and NEAREST makes texel edges snap from one
 * screen pixel to the next as the build slowly rotates. That snapping is the
 * shimmer/crawl along block edges. Plain LINEAR removes it but softens the
 * pixel-art, badly so when you zoom in (a texel then spans many pixels and the
 * whole thing becomes a gradient).
 *
 * The fix keeps NEAREST-crisp texel INTERIORS but antialiases each texel EDGE
 * over ~1 screen pixel (measured with fwidth): sample the exact texel centre
 * across the interior, and only ramp toward the boundary within half a screen
 * pixel of it. Because the ramp is measured in SCREEN pixels, it stays a
 * hairline when you zoom in (crisp) yet smooths the crawl at normal framing —
 * sharp AND flicker-free, without mipmaps or their atlas bleed.
 *
 * We install it by swapping DeepSlate's structure shader for one whose fragment
 * stage does that snap, then samples with LINEAR. Colour is antialiased this way,
 * but ALPHA is sampled at the exact texel centre so it stays crisp: cutout blocks
 * (chain, ladder, rails, leaves) keep a hard silhouette instead of a
 * half-transparent rim, which over the light page behind the transparent canvas
 * would otherwise read as a pale halo. Everything else is preserved: the
 * per-sprite UV clamp (no bleed across the packed atlas), the vertex tint (our
 * baked AO + face shading) and DeepSlate's own mild face lighting. Needs
 * OES_standard_derivatives (fwidth) — returns false when it's unavailable so the
 * caller can fall back to plain filtering.
 *
 * The shader swap and `atlasTexture` access lean on DeepSlate internals (pinned
 * 0.26); both are guarded so a version bump degrades to "no AA" rather than a
 * crash.
 */

// DeepSlate's own structure vertex shader, copied verbatim so the attribute and
// varying names line up with the mesh buffers and the fragment stage below.
const VERTEX_SRC = `
  attribute vec4 vertPos;
  attribute vec2 texCoord;
  attribute vec4 texLimit;
  attribute vec3 vertColor;
  attribute vec3 normal;

  uniform mat4 mView;
  uniform mat4 mProj;

  varying highp vec2 vTexCoord;
  varying highp vec4 vTexLimit;
  varying highp vec3 vTintColor;
  varying highp float vLighting;

  void main(void) {
    gl_Position = mProj * mView * vertPos;
    vTexCoord = texCoord;
    vTexLimit = texLimit;
    vTintColor = vertColor;
    vLighting = normal.y * 0.2 + abs(normal.z) * 0.1 + 0.8;
  }
`

// The `#extension` directive must be the very first line. `uAtlasSize` is the
// padded atlas size in texels so we can work in per-axis texel units — our
// atlas is 2048×4096, not square, so a single pixel-size scalar won't do.
const FRAGMENT_SRC = `#extension GL_OES_standard_derivatives : enable
  precision highp float;
  varying highp vec2 vTexCoord;
  varying highp vec4 vTexLimit;
  varying highp vec3 vTintColor;
  varying highp float vLighting;

  uniform sampler2D sampler;
  uniform highp vec2 uAtlasSize;

  void main(void) {
    // Sample position within the atlas, in texels.
    vec2 texel = vTexCoord * uAtlasSize;
    // Half a screen pixel expressed in texels. Axis-aligned faces can yield a
    // zero derivative, so floor it away from zero.
    vec2 halfPix = max(fwidth(texel) * 0.5, vec2(1e-5));
    // Offset from the current texel's centre, in [-0.5, 0.5) texels.
    vec2 c = fract(texel) - 0.5;
    // Flat across the interior (sample the exact centre → a crisp texel); ramp
    // to the texel boundary only within half a screen pixel of it → an edge
    // that's antialiased over one screen pixel instead of snapping.
    vec2 ramp = clamp((abs(c) - (0.5 - halfPix)) / halfPix, 0.0, 1.0);
    vec2 snapped = floor(texel) + 0.5 + ramp * 0.5 * sign(c);
    vec2 halfTexel = 0.5 / uAtlasSize;
    // Both samples stay inside their own sprite (no bleed across the atlas).
    vec2 lo = vTexLimit.xy + halfTexel;
    vec2 hi = vTexLimit.zw - halfTexel;

    // Colour: the antialiased-nearest sample — this is what kills the rotating
    // texel crawl on block faces.
    vec3 rgb = texture2D(sampler, clamp(snapped / uAtlasSize, lo, hi)).xyz;

    // Alpha: sampled at the exact texel CENTRE, so it stays crisp. Cutout blocks
    // (chain, ladder, rails, leaves…) have binary 0/1 alpha here, so their
    // silhouette is a hard edge — no half-transparent rim to haze into a pale
    // halo over the light page behind the transparent canvas. Translucent blocks
    // (stained glass…) keep their genuine fractional alpha and stay see-through.
    // The silhouette is smoothed by supersampling instead (see Scene.tsx).
    float alpha = texture2D(sampler, clamp((floor(texel) + 0.5) / uAtlasSize, lo, hi)).a;
    if (alpha < 0.01) discard;

    gl_FragColor = vec4(rgb * vTintColor * vLighting, alpha);
  }
`

/**
 * Replaces the renderer's structure shader with the antialiased-nearest variant
 * and sets the atlas to LINEAR filtering (the shader has already snapped UVs to
 * texel centres, so LINEAR only interpolates inside the hairline edge ramp).
 * Returns false — leaving the renderer untouched — if derivatives aren't
 * supported, the shader fails to compile, or the atlas handle is missing.
 */
export function installSharpTextureShader(
  renderer: StructureRenderer,
  gl: WebGLRenderingContext,
  atlasSize: [number, number],
): boolean {
  // fwidth() needs the derivatives extension; without it, bail to plain filtering.
  if (!gl.getExtension('OES_standard_derivatives')) return false

  const texture = (renderer as unknown as { atlasTexture?: WebGLTexture }).atlasTexture
  if (!texture) return false

  let program: WebGLProgram
  try {
    program = new ShaderProgram(gl, VERTEX_SRC, FRAGMENT_SRC).getProgram()
  } catch {
    return false
  }

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)

  // uAtlasSize never changes, so set it once. drawStructure only rebinds
  // mView/mProj/pixelSize each frame, leaving this program's uniform intact.
  gl.useProgram(program)
  gl.uniform2f(gl.getUniformLocation(program, 'uAtlasSize'), atlasSize[0], atlasSize[1])

  ;(renderer as unknown as { shaderProgram: WebGLProgram }).shaderProgram = program
  return true
}
