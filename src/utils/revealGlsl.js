// Výpočet rentgenu pro programy grafické karty — co v podzemí zmizí, co se ztmaví a kudy dovnitř jde světlo.
// Sdílí ho úprava materiálů, tráva i voda; světlo u vchodů čte z mapy po buňkách, kterou spočítá terén,
// obloha i slunce do jeskyně pronikají jen vchodem a směrem dovnitř slábnou; povrch natočený k vchodu chytí víc oblohy.
import { CELL_SIZE } from './gridMath.js';

export const REVEAL_UNIFORM_NAMES = ['revealCenter', 'revealParams', 'revealMapMin', 'revealLight'];
export const REVEAL_SAMPLER = 'revealMap';
const DOOR_LIGHT_RISE = '0.6';
const DOOR_SLOPE_FULL = '0.1';
const DOOR_FACING_MAX = '1.6';
const SIGHT_FADE_START = '8.0';
const SIGHT_FADE_END = '14.0';

export const REVEAL_UNIFORMS = `
uniform vec3 revealCenter;
uniform vec4 revealParams;
uniform vec4 revealMapMin;
uniform vec3 revealLight;
uniform sampler2D ${REVEAL_SAMPLER};

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

float revealDoorGlow(vec4 own, float inner) {
  if (own.a > 0.5) return 0.0;
  return mix(clamp((inner - 0.5) * 2.0, 0.0, 1.0), inner, revealParams.x);
}
`;

export function revealBlock(color, position, rules, albedo = color, normal = 'vec3(0.0, 1.0, 0.0)') {
  const { above, hide, keep, inside, restore, column = '0.0', dark = '0.0', far = '0.0' } = rules;
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
    float revealColumn = ${column} * step(revealParams.w + 0.2, ${position}.y) * (1.0 - revealOwnLit);
    float revealHide = ${hide} * (1.0 - revealRestore);
    float revealHole = max(max(revealAbove, revealHide), revealColumn) * revealAmount;
    float revealGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (revealHole > revealGrain) discard;
    ${color}.rgb *= 1.0 - revealAmount * (1.0 - ${keep}) * (1.0 - revealNear * (1.0 - ${dark}));
    float revealGlow = revealDoorGlow(revealOwn, revealInner);
    float revealDoorLight = revealGlow * revealFacing;
    ${color}.rgb += ${albedo}.rgb * revealLight * ${inside} * revealDoorLight;
    ${color}.rgb *= 1.0 - ${far} * revealAmount * revealParams.z * smoothstep(${SIGHT_FADE_START}, ${SIGHT_FADE_END}, length(revealDelta)) * (1.0 - revealGlow);
  }
}
`;
}
