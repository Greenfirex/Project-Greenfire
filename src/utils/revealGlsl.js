// Výpočet rentgenu pro programy grafické karty — co v podzemí zmizí, co se ztmaví a kudy dovnitř jde světlo.
// Sdílí ho úprava materiálů, tráva i voda; světlo u vchodů čte z mapy po buňkách, kterou spočítá terén,
// obloha i slunce do jeskyně pronikají jen vchodem a směrem dovnitř slábnou; povrch natočený k vchodu chytí víc oblohy.
// Co je dál, než postava dohlédne, nebo venku výrazně výš než ona, se ztratí v oparu a zešedne; pod zemí ztmavne i vše za skálou.
// Modely se řídí místem, kde stojí; pod zemí se mimo dohled schovají, venku se v oparu rozplynou jen tvorové.
// Povrch, na který postava z jeskyně nevidí, je úplně černý; jeskyně sama zůstane tušená.
import { CELL_SIZE } from './gridMath.js';

export const REVEAL_UNIFORM_NAMES = ['revealCenter', 'revealParams', 'revealMapMin', 'revealLight', 'revealSightEye', 'revealSightDepth', 'revealSightFog'];
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
const DOOR_LIGHT_RISE = '0.6';
const DOOR_SLOPE_FULL = '0.1';
const DOOR_FACING_MAX = '1.6';
const SIGHT_FADE_START = '8.0';
const SIGHT_FADE_END = '14.0';
const SIGHT_BIAS = '0.15';
const SIGHT_BIAS_PER_METER = '0.02';
const SIGHT_SOFT = '0.012';
const SIGHT_DARK = '0.22';
const SIGHT_GREY = '0.6';
const SIGHT_FOG_MAX = '0.6';

export const REVEAL_UNIFORMS = `
uniform vec3 revealCenter;
uniform vec4 revealParams;
uniform vec4 revealMapMin;
uniform vec3 revealLight;
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

float revealSightHidden(vec3 point) {
  if (revealSightEye.w <= 0.001) return 0.0;
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
  float range = revealSightEye.w;
  return max(blocked * revealSightDepth.w, smoothstep(range * ${SIGHT_EDGE.toFixed(2)}, range, dist));
}

vec4 revealSampleAt(vec3 point, out vec4 own) {
  vec2 grid = point.xz / ${CELL_SIZE.toFixed(1)} - revealMapMin.xy;
  vec2 size = revealMapMin.zw;
  own = texture2D(${REVEAL_SAMPLER}, (floor(grid + 0.5) + 0.5) / size);
  vec2 base = floor(grid);
  vec2 frac = grid - base;
  vec2 lit = vec2(0.0);
  vec2 slope = vec2(0.0);
  for (int index = 0; index < 4; index += 1) {
    vec2 corner = vec2(mod(float(index), 2.0), floor(float(index) / 2.0));
    vec4 texel = texture2D(${REVEAL_SAMPLER}, (base + corner + 0.5) / size);
    vec2 weights = mix(1.0 - frac, frac, corner);
    vec2 value = abs(texel.a - own.a) < 0.5 ? texel.rg : own.rg;
    lit += value * weights.x * weights.y;
    vec2 side = corner * 2.0 - 1.0;
    slope += value.g * vec2(side.x * weights.y, side.y * weights.x);
  }
  return vec4(lit, slope);
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

export function revealBlock(color, position, rules, albedo = color, normal = 'vec3(0.0, 1.0, 0.0)') {
  const { above, hide, keep, inside, restore, column = '0.0', dark = '0.0', far = '0.0', sight = '1.0', sightHide = '0.0', rise = sightRiseByHeight(position), point = sightPointOf(position), surface = '1.0', cameraCut = '0.0' } = rules;
  return `
{
  float revealAmount = revealParams.x;
  if (revealAmount > 0.001 || ${inside} > 0.5) {
    vec3 revealDelta = ${position} - revealCenter;
    vec4 revealOwn;
    vec4 revealSample = revealSampleAt(${position}, revealOwn);
    vec2 revealLit = revealSample.xy;
    vec2 revealSlope = revealSample.zw;
    float revealNear = revealOwn.a > 0.5 ? revealLit.r : 0.0;
    float revealInner = revealOwn.a > 0.5 ? 0.0 : revealLit.g;
    vec2 revealTowardDoor = revealOwn.a > 0.5 ? vec2(0.0) : revealSlope / max(length(revealSlope), ${DOOR_SLOPE_FULL});
    vec3 revealDoorDir = normalize(vec3(revealTowardDoor.x, ${DOOR_LIGHT_RISE}, revealTowardDoor.y));
    float revealFacing = clamp(dot(normalize(${normal}), revealDoorDir) / revealDoorDir.y, 0.0, ${DOOR_FACING_MAX});
    float revealOwnLit = revealOwn.a > 0.5 ? step(0.001, revealOwn.r) : 0.0;
    float revealRestore = ${restore} * revealNear * revealOwnLit * (1.0 - revealOwn.b);
    float revealAbove = ${above} * step(revealParams.y, ${position}.y) * (1.0 - revealRestore);
    float revealWithoutSight = revealSightEye.w > 0.001 ? 0.0 : 1.0;
    float revealColumn = ${column} * step(revealParams.w + 0.2, ${position}.y) * (1.0 - revealOwnLit * revealWithoutSight);
    float revealHide = ${hide} * (1.0 - revealRestore);
    float revealHole = max(max(max(revealAbove, revealHide), revealColumn), ${cameraCut}) * revealAmount;
    float revealGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (revealHole > revealGrain) discard;
    ${color}.rgb *= 1.0 - revealWithoutSight * revealAmount * (1.0 - ${keep}) * (1.0 - revealNear * (1.0 - ${dark}));
    float revealGlow = revealDoorGlow(revealOwn, revealInner);
    float revealDoorLight = revealGlow * revealFacing;
    ${color}.rgb += ${albedo}.rgb * revealLight * ${inside} * revealDoorLight;
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
