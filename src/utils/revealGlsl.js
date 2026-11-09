// Výpočet rentgenu pro programy grafické karty — co v podzemí zmizí, co se ztmaví a kudy dovnitř jde světlo.
// Sdílí ho úprava materiálů, tráva i voda; světlo u vchodů čte z mapy po buňkách, kterou spočítá terén.
import { CELL_SIZE } from './gridMath.js';

export const REVEAL_UNIFORM_NAMES = ['revealCenter', 'revealParams', 'revealMapMin', 'revealLight'];
export const REVEAL_SAMPLER = 'revealMap';
const DOOR_FLOOR_LIGHT = '0.25';
const SIGHT_FADE_START = '8.0';
const SIGHT_FADE_END = '14.0';

export const REVEAL_UNIFORMS = `
uniform vec3 revealCenter;
uniform vec4 revealParams;
uniform vec4 revealMapMin;
uniform vec3 revealLight;
uniform sampler2D ${REVEAL_SAMPLER};
`;

export function revealBlock(color, position, rules, albedo = color) {
  const { above, hide, keep, inside, restore, column = '0.0', dark = '0.0', floorGlow = '0.0', far = '0.0' } = rules;
  return `
{
  float revealAmount = revealParams.x;
  if (revealAmount > 0.001 || ${inside} > 0.5) {
    vec3 revealDelta = ${position} - revealCenter;
    vec2 revealGrid = ${position}.xz / ${CELL_SIZE.toFixed(1)} - revealMapMin.xy;
    vec2 revealSize = revealMapMin.zw;
    vec4 revealOwn = texture2D(${REVEAL_SAMPLER}, (floor(revealGrid + 0.5) + 0.5) / revealSize);
    vec2 revealBase = floor(revealGrid);
    vec2 revealFrac = revealGrid - revealBase;
    vec2 revealLit = vec2(0.0);
    for (int revealIndex = 0; revealIndex < 4; revealIndex += 1) {
      vec2 revealStep = vec2(mod(float(revealIndex), 2.0), floor(float(revealIndex) / 2.0));
      vec4 revealTexel = texture2D(${REVEAL_SAMPLER}, (revealBase + revealStep + 0.5) / revealSize);
      vec2 revealWeights = mix(1.0 - revealFrac, revealFrac, revealStep);
      vec2 revealValue = abs(revealTexel.a - revealOwn.a) < 0.5 ? revealTexel.rg : revealOwn.rg;
      revealLit += revealValue * revealWeights.x * revealWeights.y;
    }
    float revealNear = revealOwn.a > 0.5 ? revealLit.r : 0.0;
    float revealInner = revealOwn.a > 0.5 ? 0.0 : revealLit.g;
    float revealOwnLit = revealOwn.a > 0.5 ? step(0.001, revealOwn.r) : 0.0;
    float revealRestore = ${restore} * revealNear * revealOwnLit * (1.0 - revealOwn.b);
    float revealAbove = ${above} * step(revealParams.y, ${position}.y) * (1.0 - revealRestore);
    float revealColumn = ${column} * step(revealParams.w + 0.2, ${position}.y) * (1.0 - revealOwnLit);
    float revealHide = ${hide} * (1.0 - revealRestore);
    float revealHole = max(max(revealAbove, revealHide), revealColumn) * revealAmount;
    float revealGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (revealHole > revealGrain) discard;
    ${color}.rgb *= 1.0 - revealAmount * (1.0 - ${keep}) * (1.0 - revealNear * (1.0 - ${dark}));
    float revealGlow = mix(clamp((revealInner - 0.5) * 2.0, 0.0, 1.0), revealInner, revealAmount);
    ${color}.rgb *= vec3(1.0) + revealLight * ${inside} * (1.0 - ${floorGlow}) * revealGlow;
    ${color}.rgb += ${albedo}.rgb * revealLight * ${DOOR_FLOOR_LIGHT} * ${floorGlow} * revealGlow;
    ${color}.rgb *= 1.0 - ${far} * revealAmount * revealParams.z * smoothstep(${SIGHT_FADE_START}, ${SIGHT_FADE_END}, length(revealDelta)) * (1.0 - revealGlow);
  }
}
`;
}
