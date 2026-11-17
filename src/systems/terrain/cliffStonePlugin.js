// Doplněk kamenů obkladu a rámů — kámen má tvar a reliéf z modelu, ale barvu a texturu stěny útesu,
// promítnutou podle polohy ve světě, takže vypadá vytesaný ze stejné skály. Volitelně přidá vrstvy
// jako na stěně a mech: vršek zezelená celý, boky v ostrůvcích, spodek zůstane holý.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const DEFINITIONS = `uniform sampler2D cliffStoneStrataSampler;
uniform sampler2D cliffStoneMossSampler;
float cliffStoneHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float cliffStoneNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cliffStoneHash(i), cliffStoneHash(i + vec2(1.0, 0.0)), f.x), mix(cliffStoneHash(i + vec2(0.0, 1.0)), cliffStoneHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

const STONE_CODE = `
vec3 stoneWeights = pow(abs(normalW), vec3(4.0));
stoneWeights /= max(dot(stoneWeights, vec3(1.0)), 0.0001);
vec3 stonePoint = vPositionW / CLIFF_STONE_TILE;
vec2 stoneSideUv = abs(normalW.x) > abs(normalW.z) ? stonePoint.zy : stonePoint.xy;
vec3 stoneColor = texture2D(diffuseSampler, stonePoint.zy).rgb * stoneWeights.x
  + texture2D(diffuseSampler, stonePoint.xz).rgb * stoneWeights.y
  + texture2D(diffuseSampler, stonePoint.xy).rgb * stoneWeights.z;
baseColor.rgb = stoneColor * CLIFF_STONE_SHADE;
float stoneStripe = 0.5 + 0.5 * sin(vPositionW.y * 1.15 + sin(vPositionW.x * 0.13 + vPositionW.z * 0.17) * 2.1);
vec3 stoneStrata = texture2D(cliffStoneStrataSampler, stoneSideUv * 0.55 + vec2(13.1, 7.7)).rgb * CLIFF_STONE_SHADE;
baseColor.rgb = mix(baseColor.rgb, stoneStrata, smoothstep(0.32, 0.80, stoneStripe) * 0.30 * CLIFF_STONE_STRATA);
vec2 stoneMossUv = stoneWeights.y > 0.5 ? vPositionW.xz : stoneSideUv * CLIFF_STONE_TILE;
float stoneMossUp = smoothstep(0.2, 0.7, normalW.y);
float stoneMossPatch = cliffStoneNoise(stoneMossUv * 1.6) * 0.65 + cliffStoneNoise(stoneMossUv * 4.3 + 7.1) * 0.35;
float stoneMossSide = smoothstep(0.42, 0.62, stoneMossPatch) * smoothstep(-0.35, 0.1, normalW.y) * 0.75;
vec3 stoneMoss = texture2D(cliffStoneMossSampler, stoneMossUv * 0.7).rgb * vec3(0.82, 0.95, 0.72);
baseColor.rgb = mix(baseColor.rgb, stoneMoss, max(stoneMossUp * 0.85, stoneMossSide) * CLIFF_STONE_MOSS);
`;

export default class CliffStonePlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'CliffStone', 200, { CLIFF_STONE_TILE: '1.000', CLIFF_STONE_SHADE: '1.000', CLIFF_STONE_STRATA: '0.0', CLIFF_STONE_MOSS: '0.0' }, true, true);
    this.tile = setup.tile;
    this.shade = setup.shade;
    this.strataTexture = setup.strata || null;
    this.mossTexture = setup.moss || null;
    this.fallbackTexture = material.diffuseTexture;
  }

  getClassName() {
    return 'CliffStonePlugin';
  }

  prepareDefines(defines) {
    defines.CLIFF_STONE_TILE = this.tile.toFixed(3);
    defines.CLIFF_STONE_SHADE = this.shade.toFixed(3);
    defines.CLIFF_STONE_STRATA = this.strataTexture ? '1.0' : '0.0';
    defines.CLIFF_STONE_MOSS = this.mossTexture ? '1.0' : '0.0';
  }

  getSamplers(samplers) {
    samplers.push('cliffStoneStrataSampler', 'cliffStoneMossSampler');
  }

  bindForSubMesh(ubo) {
    ubo.setTexture('cliffStoneStrataSampler', this.strataTexture || this.fallbackTexture);
    ubo.setTexture('cliffStoneMossSampler', this.mossTexture || this.fallbackTexture);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return { CUSTOM_FRAGMENT_DEFINITIONS: DEFINITIONS, CUSTOM_FRAGMENT_UPDATE_DIFFUSE: STONE_CODE };
  }
}
