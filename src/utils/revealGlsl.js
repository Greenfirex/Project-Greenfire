// Výpočet rentgenu pro programy grafické karty — co v podzemí zmizí, co se ztmaví a kudy dovnitř jde světlo.
// Sdílí ho úprava materiálů, tráva i voda; světlo u vchodů čte z mapy po buňkách, kterou spočítá terén,
// obloha i slunce do jeskyně pronikají jen vchodem a směrem dovnitř slábnou; povrch natočený k vchodu chytí víc oblohy.
// Co je dál, než postava dohlédne, nebo venku výrazně výš než ona, se ztratí v oparu a zešedne; pod zemí ztmavne i vše za skálou.
// Modely se řídí místem, kde stojí; pod zemí se mimo dohled schovají, venku se v oparu rozplynou jen tvorové.
// Model na vyšší zemi zešedne jen tam, kam postavě brání ve výhledu skála (koruna palmy nad hranou útesu je vidět).
// Povrch, na který postava z jeskyně nevidí, je úplně černý; jeskyně sama zůstane tušená.
// Průhled: co stojí mezi kamerou a postavou, blízko spojnice a výš než její nohy, se vyřízne.
import { CELL_SIZE } from './gridMath.js';
import { smoothstep } from './noise.js';

export const REVEAL_UNIFORM_NAMES = ['revealCenter', 'revealParams', 'revealMapMin', 'revealSightEye', 'revealSightDepth', 'revealSightFog', 'revealPeek', 'revealPeekEye'];
export const REVEAL_SAMPLER = 'revealMap';
export const REVEAL_SIGHT_SAMPLER = 'revealSightMap';
export const REVEAL_CUT_ABOVE_FLOOR = 3;
export const SIGHT_GROUND_LIFT = 0.6;
export const SIGHT_RISE_START = -0.6;
export const SIGHT_RISE_FULL = 0.9;
export const SIGHT_HIGHER_START = 0.2;
export const SIGHT_HIGHER_FULL = 0.8;

export const SIGHT_EDGE = 0.7;

export function sightRiseByHeight(position, up = 'sightUp') {
  return `(smoothstep(${SIGHT_RISE_START.toFixed(2)}, ${SIGHT_RISE_FULL.toFixed(2)}, ${position}.y - revealSightEye.y) * ${up})`;
}

export function sightPointOf(position, up = 'sightUp') {
  return `(${position} + vec3(0.0, ${SIGHT_GROUND_LIFT.toFixed(2)} * ${up}, 0.0))`;
}
const SIGHT_FADE_START = '8.0';
const SIGHT_FADE_END = '14.0';
const SIGHT_BIAS = '0.15';
const SIGHT_BIAS_PER_METER = '0.02';
const SIGHT_SOFT = '0.012';
const SIGHT_DARK = '0.22';
const SIGHT_GREY = '0.6';
const SIGHT_FOG_MAX = '0.6';
export const PEEK = { chest: 1.0, frontGap: 0.6, frontSoft: 0.8, feetFrom: 0.3, feetTo: 0.7, edge: 0.55 };
const PEEK_GLSL = Object.fromEntries(Object.entries(PEEK).map(([name, value]) => [name, value.toFixed(2)]));

export function peekAmount(x, y, z, peek, eye) {
  if (peek.w <= 0.001) return 0;
  const ax = peek.x - eye.x;
  const ay = peek.y + PEEK.chest - eye.y;
  const az = peek.z - eye.z;
  const span = Math.hypot(ax, ay, az) || 0.0001;
  const ox = x - eye.x;
  const oy = y - eye.y;
  const oz = z - eye.z;
  const along = (ox * ax + oy * ay + oz * az) / span;
  if (along < 0) return 0;
  const front = smoothstep(0, PEEK.frontSoft, span - PEEK.frontGap - along);
  const across = Math.hypot(ox - (ax / span) * along, oy - (ay / span) * along, oz - (az / span) * along);
  const near = 1 - smoothstep(eye.w * PEEK.edge, eye.w, across);
  const above = smoothstep(peek.y + PEEK.feetFrom, peek.y + PEEK.feetTo, y);
  return peek.w * front * near * above;
}

export const REVEAL_UNIFORMS = `
uniform vec4 revealPeek;
uniform vec4 revealPeekEye;

float revealPeekAt(vec3 point) {
  if (revealPeek.w <= 0.001) return 0.0;
  vec3 chest = revealPeek.xyz + vec3(0.0, ${PEEK_GLSL.chest}, 0.0);
  vec3 axis = chest - revealPeekEye.xyz;
  float span = length(axis);
  vec3 dir = axis / max(span, 0.0001);
  vec3 offset = point - revealPeekEye.xyz;
  float along = dot(offset, dir);
  float front = smoothstep(0.0, ${PEEK_GLSL.frontSoft}, span - ${PEEK_GLSL.frontGap} - along) * step(0.0, along);
  float radius = revealPeekEye.w;
  float near = 1.0 - smoothstep(radius * ${PEEK_GLSL.edge}, radius, length(offset - dir * along));
  float above = smoothstep(revealPeek.y + ${PEEK_GLSL.feetFrom}, revealPeek.y + ${PEEK_GLSL.feetTo}, point.y);
  return revealPeek.w * front * near * above;
}

uniform vec3 revealCenter;
uniform vec4 revealParams;
uniform vec4 revealMapMin;
uniform sampler2D ${REVEAL_SAMPLER};
uniform vec4 revealSightEye;
uniform vec4 revealSightDepth;
uniform vec3 revealSightFog;
uniform samplerCube ${REVEAL_SIGHT_SAMPLER};

float revealSightReach(vec3 direction) {
  vec4 texel = textureCube(${REVEAL_SIGHT_SAMPLER}, direction);
  float stored = revealSightDepth.z > 0.5
    ? dot(texel, vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0))
    : texel.x;
  return stored * revealSightDepth.y - revealSightDepth.x;
}

float revealSightBlocked(vec3 point) {
  vec3 ray = point - revealSightEye.xyz;
  float dist = length(ray);
  vec3 direction = ray / max(dist, 0.0001);
  direction.y = -direction.y;
  float slack = ${SIGHT_BIAS} + dist * ${SIGHT_BIAS_PER_METER};
  float mapRange = revealSightDepth.y - revealSightDepth.x;
  float blocked = 0.0;
  for (int index = 0; index < 4; index += 1) {
    vec3 corner = vec3(mod(float(index), 2.0), floor(float(index) / 2.0), mod(float(index) + 1.0, 2.0)) * 2.0 - 1.0;
    float reach = revealSightReach(direction + corner * ${SIGHT_SOFT});
    blocked += reach < mapRange - 0.01 && dist > reach + slack ? 0.25 : 0.0;
  }
  return blocked;
}

float revealSightHidden(vec3 point) {
  if (revealSightEye.w <= 0.001) return 0.0;
  float dist = length(point - revealSightEye.xyz);
  float range = revealSightEye.w;
  return max(revealSightBlocked(point) * revealSightDepth.w, smoothstep(range * ${SIGHT_EDGE.toFixed(2)}, range, dist));
}

vec4 revealSampleAt(vec3 point, out vec4 own) {
  vec2 grid = point.xz / ${CELL_SIZE.toFixed(1)} - revealMapMin.xy;
  vec2 size = revealMapMin.zw;
  own = texture2D(${REVEAL_SAMPLER}, (floor(grid + 0.5) + 0.5) / size);
  vec2 base = floor(grid);
  vec2 frac = grid - base;
  vec2 lit = vec2(0.0);
  for (int index = 0; index < 4; index += 1) {
    vec2 corner = vec2(mod(float(index), 2.0), floor(float(index) / 2.0));
    vec4 texel = texture2D(${REVEAL_SAMPLER}, (base + corner + 0.5) / size);
    vec2 weights = mix(1.0 - frac, frac, corner);
    vec2 value = abs(texel.a - own.a) < 0.5 ? texel.rg : own.rg;
    lit += value * weights.x * weights.y;
  }
  return vec4(lit, 0.0, 0.0);
}

float revealCaveAhead(vec3 point, vec3 eye) {
  vec2 ahead = normalize(point.xz - eye.xz);
  for (int index = 1; index <= 5; index += 1) {
    vec2 grid = (point.xz + ahead * float(index) * 0.5) / ${CELL_SIZE.toFixed(1)} - revealMapMin.xy;
    if (texture2D(${REVEAL_SAMPLER}, (floor(grid + 0.5) + 0.5) / revealMapMin.zw).a < 0.5) return 1.0;
  }
  return 0.0;
}

float revealRockBehind(vec3 point, vec3 eye) {
  vec2 back = normalize(eye.xz - point.xz);
  for (int index = 0; index < 2; index += 1) {
    vec2 grid = (point.xz + back * (0.75 + float(index) * 0.5)) / ${CELL_SIZE.toFixed(1)} - revealMapMin.xy;
    if (texture2D(${REVEAL_SAMPLER}, (floor(grid + 0.5) + 0.5) / revealMapMin.zw).a > 0.5) return 1.0;
  }
  return 0.0;
}

float revealDoorGlow(vec4 own, float inner) {
  if (own.a > 0.5) return 0.0;
  return mix(clamp((inner - 0.5) * 2.0, 0.0, 1.0), inner, revealParams.x);
}
`;

export function revealBlock(color, position, rules, normal = 'vec3(0.0, 1.0, 0.0)') {
  const { above, hide, keep, inside, restore, column = '0.0', dark = '0.0', far = '0.0', sight = '1.0', sightHide = '0.0', rise = sightRiseByHeight(position), point = sightPointOf(position), surface = '1.0', cameraCut = '0.0', peek = '1.0' } = rules;
  return `
{
  if (${peek} * revealPeekAt(${position}) > fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
  float revealAmount = revealParams.x;
  if (revealAmount > 0.001 || ${inside} > 0.5) {
    vec3 revealDelta = ${position} - revealCenter;
    vec4 revealOwn;
    vec4 revealSample = revealSampleAt(${position}, revealOwn);
    vec2 revealLit = revealSample.xy;
    float revealNear = revealOwn.a > 0.5 ? revealLit.r : 0.0;
    float revealInner = revealOwn.a > 0.5 ? 0.0 : revealLit.g;
    float revealOwnLit = revealOwn.a > 0.5 ? step(0.001, revealOwn.r) : 0.0;
    float revealRestore = ${restore} * revealNear * revealOwnLit * (1.0 - revealOwn.b);
    float revealAbove = ${above} * step(revealParams.y, ${position}.y) * (1.0 - revealRestore);
    float revealWithoutSight = revealSightEye.w > 0.001 ? 0.0 : 1.0;
    float revealColumnFloor = mix(revealParams.w + 0.2, max(revealParams.w + 0.2, revealSightEye.y), revealOwnLit);
    float revealColumn = ${column} * step(revealColumnFloor, ${position}.y) * (1.0 - revealOwnLit * revealWithoutSight);
    float revealHide = ${hide} * (1.0 - revealRestore);
    float revealHole = max(max(max(revealAbove, revealHide), revealColumn), ${cameraCut}) * revealAmount;
    float revealGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (revealHole > revealGrain) discard;
    ${color}.rgb *= 1.0 - revealWithoutSight * revealAmount * (1.0 - ${keep}) * (1.0 - revealNear * (1.0 - ${dark}));
    float revealGlow = revealDoorGlow(revealOwn, revealInner);
    ${color}.rgb *= 1.0 - ${far} * revealAmount * revealParams.z * smoothstep(${SIGHT_FADE_START}, ${SIGHT_FADE_END}, length(revealDelta)) * (1.0 - revealGlow);
  }
  if (${sight} > 0.5 && revealSightEye.w > 0.001) {
    float sightUp = max(normalize(${normal}).y, 0.0);
    float sightRise = ${rise} * (1.0 - revealSightDepth.w);
    float sightHidden = max(revealSightHidden(${point}), sightRise);
    float sightGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (${sightHide} * sightHidden > sightGrain) discard;
    float sightOutdoor = 1.0 - revealSightDepth.w;
    vec3 sightGrey = vec3(dot(${color}.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 sightDim = mix(${color}.rgb, sightGrey, ${SIGHT_GREY}) * ${SIGHT_DARK} * (1.0 - ${surface} * revealSightDepth.w);
    ${color}.rgb = mix(${color}.rgb, sightGrey, sightHidden * sightOutdoor);
    vec3 sightFar = mix(sightDim, revealSightFog, sightOutdoor);
    ${color}.rgb = mix(${color}.rgb, sightFar, sightHidden * mix(${SIGHT_FOG_MAX}, 1.0, revealSightDepth.w));
  }
}
`;
}
