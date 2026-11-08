// Výpočet rentgenu pro programy grafické karty — co v podzemí zmizí, co se ztmaví a kudy dovnitř jde světlo.
// Sdílí ho úprava materiálů, tráva i voda; světlo u vchodů čte z mapy po buňkách, kterou spočítá terén.
import { CELL_SIZE } from './gridMath.js';

export const REVEAL_UNIFORM_NAMES = ['revealCenter', 'revealRight', 'revealUp', 'revealToCam', 'revealParams', 'revealMapMin', 'revealLight'];
export const REVEAL_SAMPLER = 'revealMap';

export const REVEAL_UNIFORMS = `
uniform vec3 revealCenter;
uniform vec3 revealRight;
uniform vec3 revealUp;
uniform vec3 revealToCam;
uniform vec4 revealParams;
uniform vec4 revealMapMin;
uniform vec3 revealLight;
uniform sampler2D ${REVEAL_SAMPLER};
`;

export function revealBlock(color, position, rules) {
  const { above, front, hide, keep, inside, restore, facing = '1.0', column = '0.0' } = rules;
  return `
{
  float revealAmount = revealParams.x;
  if (revealAmount > 0.001 || ${inside} > 0.5) {
    vec3 revealDelta = ${position} - revealCenter;
    float revealDist = length(vec2(dot(revealDelta, revealRight), dot(revealDelta, revealUp)));
    float revealRadius = revealParams.z;
    float revealInside = 1.0 - smoothstep(revealRadius * 0.72, revealRadius, revealDist);
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
    float revealAbove = ${above} * step(revealParams.y, ${position}.y) * (1.0 - ${restore} * revealNear);
    float revealFront = ${front} * step(revealParams.w + 0.2, ${position}.y) * mix(1.0, smoothstep(0.4, 1.0, dot(revealDelta, revealToCam)), ${facing}) * (1.0 - step(0.001, revealNear));
    float revealColumn = ${column} * step(revealParams.w + 0.2, ${position}.y) * step(revealOwn.a, 0.5);
    float revealHide = ${hide} * (1.0 - ${restore} * revealNear);
    float revealHole = max(max(max(revealAbove, revealInside * revealFront), revealHide), revealColumn) * revealAmount;
    float revealGrain = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    if (revealHole > revealGrain) discard;
    ${color}.rgb *= 1.0 - revealAmount * (1.0 - ${keep}) * (1.0 - revealNear);
    ${color}.rgb *= vec3(1.0) + revealLight * ${inside} * mix(clamp((revealInner - 0.5) * 2.0, 0.0, 1.0), revealInner, revealAmount);
  }
}
`;
}
