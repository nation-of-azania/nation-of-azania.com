/**
 * The globe's shaders, as plain GLSL (ES 3.0) for three.js's ShaderMaterial
 * (./engine.ts). Every one of them places what it draws by curl(), the
 * sheet rolled round a ball (src/maps/globe.ts → curlSpot, its line-for-line
 * twin in TypeScript), and writes clip space straight from the container's
 * own pixels: the camera is a formality, one unit a CSS pixel, so a sphere
 * of radius R is R pixels on the page and a click finds its spot without a
 * matrix. Colours go in and out as the bytes they are, never through a
 * colour space, so the world's picture on the globe is the flat map's to
 * the byte; and they come out premultiplied by their alpha, as the page
 * composites them.
 */

/** The shared uniforms and the curl itself. */
const CURL = /* glsl */ `
uniform float uCurl;      // t: 0 the flat sheet, 1 the globe
uniform float uRadius;    // R: pixels to a radian at the facing spot
uniform float uFaceLon;   // the facing spot, in radians
uniform float uFaceLat;
uniform vec2 uCentre;     // where the facing spot is drawn, in the container's pixels (y down)
uniform vec2 uViewport;   // the container's size, in CSS pixels
uniform float uPixelRatio;
uniform float uTilt;      // how far the ball is tipped to bring the facing latitude to the front: 1 the globe at rest, 0 upright

const float PI = 3.14159265;
const float TAU = 6.28318531;

// A spot on the sheet, \`a\` its longitude from the facing spot (unwrapped) and
// \`phi\` its latitude: where it is drawn (x, y), and how squarely it faces the reader.
vec3 curl(float a, float phi) {
  if (uCurl < 1e-3) return vec3(uCentre.x + uRadius * a, uCentre.y - uRadius * (phi - uFaceLat), 1.0);
  float r = uRadius / uCurl;
  float al = uCurl * a;
  float be = uCurl * phi;
  float be0 = uCurl * uFaceLat;
  float th = uTilt * be0;
  vec3 d = vec3(cos(be) * sin(al), sin(be), cos(be) * cos(al));
  float s = sin(th);
  float k = cos(th);
  // The facing latitude comes round to the front, as far as the tilt takes it.
  d = vec3(d.x, d.y * k - d.z * s, d.y * s + d.z * k);
  // The facing spot, turned likewise, at the origin: r·(d − f), across and up the page.
  float fy = sin(be0) * k - cos(be0) * s;
  return vec3(uCentre.x + r * d.x, uCentre.y - r * (d.y - fy), d.z);
}

// Where the ball's middle is drawn: below the facing spot while the ball is upright, at it once tipped all the way.
vec2 ballCentre() {
  float be0 = uCurl * uFaceLat;
  return vec2(uCentre.x, uCentre.y + uRadius / max(uCurl, 1e-3) * sin(be0 - uTilt * be0));
}

vec4 clipOf(vec2 s) {
  return vec4(2.0 * s.x / uViewport.x - 1.0, 1.0 - 2.0 * s.y / uViewport.y, 0.0, 1.0);
}

float wrapAngle(float a) {
  return a - TAU * floor((a + PI) / TAU);
}
`

/** What a fragment shader writes: GLSL 3, so three.js leaves the output for the shader to name. */
const OUT = /* glsl */ `layout(location = 0) out highp vec4 fragColor;`

/** The ground: the sheet of the world, curled, with every nation's fill and edge on it. */
export const GROUND_VERTEX = /* glsl */ `
${CURL}
uniform float uShift;     // a whole turn either way for the sheet's echoes; 0 for the sheet itself
out vec2 vUv;
out float vFacing;
out float vLat;
out float vA;             // the longitude from the facing spot, unwrapped: where on the flat map's run of echoes
out vec2 vNormal;         // which way the ground faces across and up the page, as the ball it's rolled round has it

void main() {
  float a = position.x + uShift;
  float phi = position.y;
  vec3 s = curl(a, phi);
  vFacing = s.z;
  vLat = phi;
  vA = a;
  vNormal = vec2(s.x - uCentre.x, uCentre.y - s.y) * uCurl / uRadius;
  // Unwrapped across: the texture repeats, so the sheet's echoes are the sheet.
  vUv = vec2((uFaceLon + a) / TAU + 0.5, 0.5 - phi / PI);
  gl_Position = clipOf(s.xy);
}
`

export const GROUND_FRAGMENT = /* glsl */ `
${CURL}
${OUT}
uniform sampler2D uSheet;     // the world's picture, as the flat map lays it
uniform float uHasSheet;      // 0 until it has come: the sea alone, with the borders on it
uniform sampler2D uNumbers;   // who holds each cell (src/maps/raster.ts)
uniform vec2 uNumbersSize;
uniform sampler2D uAzania;    // how much of each patch is Azania's, for its halo
uniform sampler2D uPalette;   // per number: row 0 its edge and its wash's strength, row 1 its edge's strength and whether it shows, row 2 its wash
uniform float uOverlay;       // the borders and fills, faded in and out with the globe
uniform float uSelected;      // the open nation's number, else −1
uniform float uHover;         // the nation under the pointer's, else −1
uniform float uFlatX0;        // the facing spot's x as the flat map has it, unwrapped
uniform float uSkirt;         // an echo's fade as the sheet curls; 1 for the sheet itself
uniform vec4 uPole;           // the cosines of the latitudes the North Pole's reading along its circles begins at and is whole by, then its fade's
uniform float uPoleGrain;     // the ground, in radians, the picture is read across along its circle where the fade is whole
uniform float uPoleLevel;     // the picture's mipmap whose rows are two and a half degrees each
in vec2 vUv;
in float vFacing;
in float vLat;
in float vA;
in vec2 vNormal;

const vec3 SEA = vec3(15.0, 38.0, 56.0) / 255.0;            // GROUND.sea, #0f2638
const vec3 WHITEWASH = vec3(251.0, 248.0, 241.0) / 255.0;   // GROUND.whitewash, #fbf8f1
const vec3 SAFFRON_LIGHT = vec3(232.0, 182.0, 92.0) / 255.0; // GROUND.saffronLight, #e8b65c
const vec3 HAZE = vec3(195.0, 211.0, 223.0) / 255.0;        // sea-200, #c3d3df
const float BLOCKS_PER_RADIAN = 11734.2;                    // src/maps/globe.ts
const float WORLD_WEST = -36864.0;                          // src/maps/source.ts
const float WORLD_EAST = 36864.0;

int numberAt(vec2 uv) {
  return int(texture(uNumbers, uv).r * 255.0 + 0.5);
}

// Of the four cells \`ox\` and \`oy\` away, how many hold another number than \`id\`.
float differing(int id, vec2 uv, vec2 ox, vec2 oy) {
  return float(numberAt(uv + ox) != id) + float(numberAt(uv - ox) != id) + float(numberAt(uv + oy) != id) + float(numberAt(uv - oy) != id);
}

// An offset of \`px\` CSS pixels along the screen, \`step\` its size in cells per pixel, made at least \`least\` cells long.
vec2 reach(vec2 step, float px, float least) {
  float cells = length(step * uNumbersSize) * px;
  return step * px * max(1.0, least / max(cells, 1e-5));
}

// How far the curl has gathered the ground at latitude \`lat\` round the North Pole, between two latitudes of the
// globe's, given by their cosines (src/maps/globe.ts → poleShare): never on the flat map, nor in the south.
float poleShare(float lat, float fromCos, float toCos) {
  if (lat <= 0.0) return 0.0;
  return 1.0 - smoothstep(toCos, fromCos, cos(uCurl * lat));
}

// The picture as the far north needs it read. A pixel there spans far more of its circle of latitude than of its
// meridian, and the GPU, reading the picture as coarsely as the pixel is wide (or at best four times finer), smears
// each patch of ice along the meridian into a ray towards the pole. Read instead with sixteen taps of its own along
// the circle, across \`span\` texels of it, each only as coarse as the pixel is tall (or as the taps are spaced, where
// the span outruns them), the ice keeps its shape.
vec4 alongLatitude(vec2 uv, float span, float tall, vec2 size) {
  float lod = log2(max(max(tall, span / 16.0), 1e-3));
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) sum += textureLod(uSheet, uv + vec2(((float(i) + 0.5) / 16.0 - 0.5) * span / size.x, 0.0), lod);
  return sum / 16.0;
}

// A circle of latitude's own colour: the picture's row, averaged from its mipmap at sixteen fixed longitudes, so
// that every pixel on the circle is given the same whichever way the globe is turned, and each circle blends into
// the next.
vec4 ringColour(float v) {
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 16; i++) sum += textureLod(uSheet, vec2((float(i) + 0.5) / 16.0, v), uPoleLevel);
  return sum / 16.0;
}

void main() {
  vec2 uv = vUv;
  float facing = vFacing;
  float lat = vLat;
  vec3 normal = vec3(vNormal, facing);
  float cover = 1.0;
  if (uCurl > 0.999) {
    // The globe itself: each pixel's own spot, worked back exactly from where it is, as a click is
    // (src/maps/globe.ts → pickLonLat), so the picture and the borders are true to the pixel.
    vec2 page = vec2(gl_FragCoord.x, uViewport.y * uPixelRatio - gl_FragCoord.y) / uPixelRatio;
    vec2 middle = ballCentre();
    float dx = (page.x - middle.x) / uRadius;
    float dy = -(page.y - middle.y) / uRadius;
    float q = dx * dx + dy * dy;
    float dz = sqrt(max(0.0, 1.0 - q));
    float s = sin(uTilt * uFaceLat);
    float k = cos(uTilt * uFaceLat);
    float y = dy * k + dz * s;
    float z = -dy * s + dz * k;
    lat = asin(clamp(y, -1.0, 1.0));
    uv = vec2((uFaceLon + atan(dx, z)) / TAU + 0.5, 0.5 - lat / PI);
    facing = dz;
    normal = vec3(dx, dy, dz);
    // The limb, smoothed across a device pixel.
    cover = clamp((1.0 - sqrt(q)) * uRadius * uPixelRatio + 0.5, 0.0, 1.0);
  }
  // A pixel's step across the sheet; the longitude's jump of a whole turn behind the pole taken out.
  vec2 gx = dFdx(uv);
  vec2 gy = dFdy(uv);
  gx.x -= floor(gx.x + 0.5);
  gy.x -= floor(gy.x + 0.5);

  vec4 sheet = textureGrad(uSheet, uv, gx, gy);
  // The Arctic, which would pinch into a starburst about the pole (src/maps/globe.ts → POLE): read along its circles of
  // latitude as the curl gathers it, and in its last few degrees faded into each circle's own colour, the picture read
  // across ever more of the circle as it goes.
  if (lat > 0.0 && uHasSheet > 0.0) {
    float along = poleShare(lat, uPole.x, uPole.y);
    if (along > 0.0) {
      float fade = poleShare(lat, uPole.z, uPole.w);
      vec2 size = vec2(textureSize(uSheet, 0));
      float wide = length(vec2(gx.x, gy.x)) * size.x;
      float tall = length(vec2(gx.y, gy.y)) * size.y;
      // Across the pixel's own width at the least, and, as the fade comes in, across up to the grain of ground, which is
      // as many more texels of the row as the curl has gathered it.
      float span = max(wide, uPoleGrain * size.x / TAU * fade / max(cos(uCurl * lat), 1e-3));
      sheet = mix(sheet, alongLatitude(uv, span, tall, size), along);
      if (fade > 0.0) sheet = mix(sheet, ringColour(uv.y), fade);
    }
  }
  vec3 colour = mix(SEA, sheet.rgb, sheet.a * uHasSheet);

  // Flat, the sheet is the flat map's twin, echoes and all: past the real world's edges, as the flat
  // map lays them (layers/WorldEdge.tsx), each echo washed pale, like a sheet seen through tracing
  // paper; the wash lifts as the sheet curls, since a globe has no echoes.
  float lying = 1.0 - smoothstep(0.0, 0.3, uCurl);
  if (lying > 0.0) {
    float rawX = uFlatX0 + vA * BLOCKS_PER_RADIAN;
    if (rawX < WORLD_WEST || rawX >= WORLD_EAST) colour = mix(colour, WHITEWASH, 0.5 * lying);
  }

  int id = numberAt(uv);
  vec4 own = texelFetch(uPalette, ivec2(id, 0), 0);
  vec4 more = texelFetch(uPalette, ivec2(id, 1), 0);
  vec3 wash = texelFetch(uPalette, ivec2(id, 2), 0).rgb;
  float shown = more.g;
  float picked = float(float(id) == uSelected && id > 0);
  float hovered = float(float(id) == uHover && id > 0);

  // The nation's wash.
  float fill = own.a * shown * uOverlay * (picked > 0.5 ? 1.8 : hovered > 0.5 ? 1.4 : 1.0);
  colour = mix(colour, wash, clamp(fill, 0.0, 1.0));

  // Its edge, wherever a neighbour within a pixel or so holds another number: a firm line and a soft
  // shoulder, each side of a border drawing its own; the unclaimed draw none, so a nation is edged
  // along its coast too, and a nation's own towns, one number, are never parted. Azania's is broader.
  vec2 px = gx * uPixelRatio;
  vec2 py = gy * uPixelRatio;
  float broad = id == 1 ? 1.5 : 1.0;
  float near = differing(id, uv, reach(px, 1.0 * broad, 0.6), reach(py, 1.0 * broad, 0.6));
  float far = differing(id, uv, reach(px, 1.7 * broad, 1.0), reach(py, 1.7 * broad, 1.0));
  float edge = clamp(0.65 * min(near, 1.0) + 0.35 * min(far, 1.0), 0.0, 1.0);
  if (picked > 0.5) {
    // The open nation, lifted: a whitewash rim inside its edge.
    float rim = differing(id, uv, reach(px, 2.6, 1.6), reach(py, 2.6, 1.6));
    colour = mix(colour, WHITEWASH, 0.85 * min(rim, 1.0) * uOverlay);
    edge = max(edge, 0.8 * min(near + far, 1.0));
  }
  // Right at the limb a pixel spans too much ground to say where an edge is: the edges fade into the haze there.
  colour = mix(colour, own.rgb, edge * more.r * shown * uOverlay * smoothstep(0.02, 0.12, facing));

  // Azania's halo, beyond its own claims: a warm band hugging their edge, and a fainter light
  // screened over the ground further out, both from the share of the patch about each pixel that is Azania's.
  if (id != 1) {
    float hug = smoothstep(0.0, 0.3, textureLod(uAzania, uv, 1.5).r);
    float bloom = smoothstep(0.0, 0.25, textureLod(uAzania, uv, 3.0).r);
    colour = mix(colour, SAFFRON_LIGHT, 0.5 * hug * uOverlay);
    vec3 light = SAFFRON_LIGHT * 0.3 * bloom * uOverlay;
    colour = 1.0 - (1.0 - colour) * (1.0 - light);
  }

  // The world's edge, where it would be joined in the game if the world wrapped, which it doesn't:
  // a dashed hairline down the meridian of x = ±36,864, as the flat map draws its seams, dashed from
  // the north pole down (6 on, 4 off), a shade darker while the sheet still lies flat as the flat map's.
  float turns = abs(uv.x - floor(uv.x + 0.5));
  float apart = turns / max(length(vec2(gx.x, gy.x)), 1e-6) / uPixelRatio;
  float dash = step(mod(uRadius * (0.5 * PI - lat), 10.0), 6.0);
  float seam = clamp(1.0 - apart, 0.0, 1.0) * step(turns, 0.01) * smoothstep(0.05, 0.15, facing);
  colour = mix(colour, vec3(0.0), mix(0.45, 0.5, lying) * dash * seam);

  // The graticule, every 30°, a whisper of whitewash that comes in as the sheet closes into the globe:
  // open ocean reads as turning when it's turned. The meridians fade out before they crowd at the poles.
  float lined = smoothstep(0.85, 1.0, uCurl) * uOverlay;
  if (lined > 0.0) {
    float lonDeg = (uv.x - 0.5) * 360.0;
    float latDeg = degrees(lat);
    float perLon = max(length(vec2(gx.x, gy.x)) * 360.0, 1e-6);
    float perLat = max(length(vec2(dFdx(latDeg), dFdy(latDeg))), 1e-6);
    float offLon = abs(fract(lonDeg / 30.0 + 0.5) - 0.5) * 30.0 / perLon;
    float offLat = abs(fract(latDeg / 30.0 + 0.5) - 0.5) * 30.0 / perLat;
    float half_ = 0.5 * uPixelRatio;
    float meridian = (1.0 - smoothstep(half_ - 0.5, half_ + 0.5, offLon)) * (1.0 - smoothstep(70.0, 82.0, abs(latDeg)));
    float parallel = (1.0 - smoothstep(half_ - 0.5, half_ + 0.5, offLat)) * step(abs(latDeg), 89.0);
    colour = mix(colour, WHITEWASH, 0.06 * max(meridian, parallel) * lined * smoothstep(0.05, 0.2, facing));
  }

  // Light on the ball, once it is one: a soft fall towards the limb and a little more from the upper
  // left than the lower right, so it reads round, with no sun and no night (the spot facing the reader is
  // left exactly its colour on the flat map); then the air towards the limb.
  float round_ = smoothstep(0.6, 1.0, uCurl);
  vec3 light = normalize(vec3(-0.45, 0.55, 0.7));
  float shade = mix(0.9, 1.0, pow(clamp(facing, 0.0, 1.0), 0.35)) + 0.07 * (dot(normal, light) - light.z);
  colour *= mix(1.0, shade, round_);
  colour = mix(colour, HAZE, 0.22 * pow(1.0 - clamp(facing, 0.0, 1.0), 2.5) * round_);

  fragColor = vec4(colour * cover, cover) * uSkirt;
}
`

/** The underside of the sheet as it curls: the deep, so a glimpse of it reads as the sea and not a fault. */
export const BACK_FRAGMENT = /* glsl */ `
${CURL}
${OUT}
in vec2 vUv;
in float vFacing;
in float vLat;
in float vA;
in vec2 vNormal;
const vec3 DEEP = vec3(20.0, 51.0, 75.0) / 255.0; // sea-800, #14334b
void main() {
  fragColor = vec4(DEEP, 1.0);
}
`

/** The atmosphere: a lagoon light falling away beyond the limb, on a square behind the ball. */
export const GLOW_VERTEX = /* glsl */ `
${CURL}
out vec2 vAt;
out vec2 vMiddle;
void main() {
  vMiddle = ballCentre();
  vAt = vMiddle + position.xy * 1.6 * uRadius;
  gl_Position = clipOf(vAt);
}
`

export const GLOW_FRAGMENT = /* glsl */ `
${CURL}
${OUT}
uniform float uGlow;
in vec2 vAt;
in vec2 vMiddle;
const vec3 LAGOON_LIGHT = vec3(138.0, 203.0, 210.0) / 255.0; // lagoon-300, #8acbd2
void main() {
  float d = length(vAt - vMiddle) / uRadius;
  // Falling to nothing before the square's edge, so the square itself never shows.
  float alpha = d > 1.0 ? 0.5 * exp(-9.0 * (d - 1.0)) * (1.0 - smoothstep(1.4, 1.6, d)) : 0.0;
  alpha *= smoothstep(0.75, 1.0, uCurl) * uGlow;
  fragColor = vec4(LAGOON_LIGHT * alpha, alpha);
}
`

/**
 * The marks: each a point the size of its mark, drawn in its own fragment
 * as a disc or a rounded square with a rim, a core, and a ring about it,
 * smoothed across a device pixel. Out of sight round the back, a mark
 * isn't drawn at all; coming round the limb it fades in.
 */
export const POINTS_VERTEX = /* glsl */ `
${CURL}
uniform float uMarks;     // all the marks, faded in and out with the globe
// position.xy: the mark's longitude and latitude, in radians; position.z, 1 for a battle, whose ring swells.
in float aSize;           // the body's width, in CSS pixels
in vec4 aStyle;           // its shape (0 a disc, 1 a rounded square), rim width, core width, and the ring's gap
in vec4 aFill;
in vec4 aRim;
in vec4 aCore;
in vec4 aRing;
out vec4 vFill;
out vec4 vRim;
out vec4 vCore;
out vec4 vRing;
out vec4 vStyle;
out float vSpan;
out float vSize;
out float vFade;
out float vBattle;

void main() {
  vec3 s = curl(wrapAngle(position.x - uFaceLon), position.y);
  // A battle's point is wide enough for its swelling ring, which reaches 20 px across.
  float span = max(aSize + 2.0 * aStyle.w + 6.0, position.z * 24.0);
  vBattle = position.z;
  vFill = aFill;
  vRim = aRim;
  vCore = aCore;
  vRing = aRing;
  vStyle = aStyle;
  vSpan = span;
  vSize = aSize;
  vFade = smoothstep(0.05, 0.2, s.z) * uMarks;
  gl_PointSize = span * uPixelRatio;
  // Round the back, nowhere at all.
  gl_Position = s.z < 0.05 || vFade <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : clipOf(s.xy);
}
`

export const POINTS_FRAGMENT = /* glsl */ `
${CURL}
${OUT}
in vec4 vFill;
in vec4 vRim;
in vec4 vCore;
in vec4 vRing;
in vec4 vStyle;
in float vSpan;
in float vSize;
in float vFade;
in float vBattle;
uniform float uPulse;     // where a battle's ring is in its swell, 0 to 1 (0 for none)
const vec3 CORAL_DEEP = vec3(166.0, 55.0, 39.0) / 255.0; // GROUND.coralDeep, #a63727

// How far a point is outside the mark's body (negative inside), in CSS pixels.
float body(vec2 p, float half_, float square) {
  if (square < 0.5) return length(p) - half_;
  float corner = half_ * 0.5;
  vec2 q = abs(p) - vec2(half_ - corner);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - corner;
}

float coverage(float outside) {
  return clamp(0.5 - outside * uPixelRatio, 0.0, 1.0);
}

vec4 over(vec4 top, vec4 under) {
  return top + under * (1.0 - top.a);
}

void main() {
  vec2 p = (gl_PointCoord - 0.5) * vSpan;
  float half_ = vSize * 0.5;
  float square = vStyle.x;
  float d = body(p, half_, square);
  vec4 colour = vec4(0.0);
  if (vRing.a > 0.0) {
    float ring = abs(body(p, half_ + vStyle.w, square)) - 1.0;
    colour = vec4(vRing.rgb, 1.0) * vRing.a * coverage(ring);
  }
  vec4 inner = vec4(vFill.rgb, 1.0) * vFill.a;
  if (vStyle.y > 0.0) inner = mix(inner, vec4(vRim.rgb, 1.0) * vRim.a, clamp(0.5 + (d + vStyle.y) * uPixelRatio, 0.0, 1.0));
  if (vStyle.z > 0.0) inner = mix(inner, vec4(vCore.rgb, 1.0) * vCore.a, coverage(length(p) - vStyle.z * 0.5));
  colour = over(inner * coverage(d), colour);
  if (vBattle > 0.5 && uPulse > 0.0) {
    // A battle on: a ring swells from the mark, 9 px across to 20, fading as it goes.
    float swell = abs(length(p) - mix(4.5, 10.0, uPulse)) - 0.75;
    colour = over(colour, vec4(CORAL_DEEP, 1.0) * 0.6 * (1.0 - uPulse) * coverage(swell));
  }
  fragColor = colour * vFade;
}
`

/**
 * The reach of Azania's war: a ring of `war.radius` blocks about its
 * capital, drawn as the flat map draws it (layers/ReachLayer.tsx), a
 * dashed line of the deep sea in a whitewash casing, laid on the ground by
 * curl() like everything else. A strip of two vertices a sample, pushed
 * apart across the line on the page, so it keeps its width at every zoom;
 * its dashes are measured along the ground, so they close up towards the
 * limb as the ground does.
 */
export const REACH_VERTEX = /* glsl */ `
${CURL}
// position: the sample's longitude and latitude, and which side of the line (−1 or 1).
in vec2 aPrev;            // the samples either side, to find the line's way across the page
in vec2 aNext;
in float aAlong;          // how far round the ring, in radians of the globe
out float vAcross;
out float vAlong;
out float vFacing;
void main() {
  vec3 here = curl(wrapAngle(position.x - uFaceLon), position.y);
  vec3 before = curl(wrapAngle(aPrev.x - uFaceLon), aPrev.y);
  vec3 after = curl(wrapAngle(aNext.x - uFaceLon), aNext.y);
  vec2 way = after.xy - before.xy;
  vec2 across = length(way) > 1e-4 ? normalize(vec2(-way.y, way.x)) : vec2(0.0, 1.0);
  vAcross = position.z;
  vAlong = aAlong * uRadius;
  vFacing = here.z;
  gl_Position = clipOf(here.xy + across * position.z * 2.5);
}
`

export const REACH_FRAGMENT = /* glsl */ `
${CURL}
${OUT}
uniform float uReach;      // the ring faded in and out with the globe's overlay
in float vAcross;
in float vAlong;
in float vFacing;
const vec3 WHITEWASH = vec3(251.0, 248.0, 241.0) / 255.0; // GROUND.whitewash, #fbf8f1
const vec3 DEEP = vec3(20.0, 51.0, 75.0) / 255.0;          // GROUND.sea800, #14334b
void main() {
  float px = abs(vAcross) * 2.5;
  float casing = clamp(2.5 - px, 0.0, 1.0) * 0.7;
  float dash = step(mod(vAlong, 16.0), 10.0);
  float core = clamp(1.5 - px, 0.0, 1.0) * 0.9 * dash;
  vec4 colour = vec4(WHITEWASH, 1.0) * casing;
  colour = vec4(DEEP, 1.0) * core + colour * (1.0 - core);
  fragColor = colour * uReach * smoothstep(0.02, 0.12, vFacing);
}
`
