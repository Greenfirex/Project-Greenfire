// Světla ohně pro vlastní programy (tráva, voda, vodopády) — stejný výpočet, jaký Babylon dělá v běžných materiálech:
// slábnutí k okraji dosahu a stín z krychlové mapy u luceren a táborů, takže zdi světlo zastaví.
export const FIRE_SHADOWED_LIGHTS = 3;
export const FIRE_LIGHT_SLOTS = FIRE_SHADOWED_LIGHTS + 1;
export const FIRE_SHADOW_NEAR = 0.05;
export const FIRE_UNIFORM_NAMES = ['fireLightPos', 'fireLightColor', 'fireShadowInfo'];
export const FIRE_SAMPLERS = Array.from({ length: FIRE_SHADOWED_LIGHTS }, (_, index) => `fireShadow${index}`);

const POISSON = ['vec3(-1.0, 1.0, -1.0)', 'vec3(1.0, -1.0, -1.0)', 'vec3(-1.0, -1.0, -1.0)', 'vec3(1.0, -1.0, 1.0)'];

function shadowCode(index) {
  const taps = POISSON.map((offset) => `lit -= fireShadowDepth(fireShadow${index}, dir + ${offset} * fireShadowInfo.y) < depth ? 0.25 : 0.0;`).join('\n          ');
  return `if (fireLightColor[${index}].w > 0.5) {
          vec3 dir = ray / max(dist, 0.0001);
          dir.y = -dir.y;
          float depth = clamp((dist + ${FIRE_SHADOW_NEAR.toFixed(3)}) / (${FIRE_SHADOW_NEAR.toFixed(3)} + pos.w), 0.0, 1.0);
          ${taps}
        }`;
}

function slotCode(index) {
  return `{
    vec4 pos = fireLightPos[${index}];
    vec3 tint = fireLightColor[${index}].rgb;
    if (pos.w > 0.0 && dot(tint, vec3(1.0)) > 0.0001) {
      vec3 ray = point - pos.xyz;
      float dist = length(ray);
      float falloff = max(0.0, 1.0 - dist / pos.w);
      if (falloff > 0.0) {
        float facing = mix(max(dot(normal, -ray / max(dist, 0.0001)), 0.0), 1.0, anySide);
        float lit = 1.0;
        ${index < FIRE_SHADOWED_LIGHTS ? shadowCode(index) : ''}
        total += tint * facing * falloff * max(lit, 0.0);
      }
    }
  }`;
}

export const FIRE_LIGHTS = `
uniform vec4 fireLightPos[${FIRE_LIGHT_SLOTS}];
uniform vec4 fireLightColor[${FIRE_LIGHT_SLOTS}];
uniform vec4 fireShadowInfo;
${FIRE_SAMPLERS.map((name) => `uniform samplerCube ${name};`).join('\n')}

float fireShadowDepth(samplerCube map, vec3 dir) {
  vec4 texel = textureCube(map, dir);
  return fireShadowInfo.x > 0.5
    ? dot(texel, vec4(1.0 / (255.0 * 255.0 * 255.0), 1.0 / (255.0 * 255.0), 1.0 / 255.0, 1.0))
    : texel.x;
}

vec3 fireLightAt(vec3 point, vec3 normal, float anySide) {
  vec3 total = vec3(0.0);
  ${Array.from({ length: FIRE_LIGHT_SLOTS }, (_, index) => slotCode(index)).join('\n  ')}
  return total;
}
`;
