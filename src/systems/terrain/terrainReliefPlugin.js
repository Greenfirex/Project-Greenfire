// Doplňek materiálu země — skládá reliéf z několika map nerovností a v přechodu ho míchá s povrchem souseda.
// Boky nerovností umí i ztmavit přímo v barvě, aby byly vidět i při slunci shora.
// Čísla se pečou do shaderu jako konstanty; váhu přechodu bere z doplňku, který míchá barvy.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const RELIEF_DEFINES = {
  RELIEF_TILE_A: '1.000',
  RELIEF_ANGLE_A: '0.000',
  RELIEF_STRENGTH: '1.000',
  RELIEF_MASK_TILE: '7.000',
  RELIEF_DETAIL: false,
  RELIEF_TILE_B: '1.000',
  RELIEF_ANGLE_B: '0.000',
  RELIEF_MIX_B: '0.000',
  RELIEF_MACRO: '0.000',
  RELIEF_MACRO_TILE: '19.000',
  RELIEF_CAVITY: '0.000',
  RELIEF_NEIGHBOUR: false,
  RELIEF_NEIGHBOUR_TILE: '1.000',
  RELIEF_NEIGHBOUR_ANGLE: '0.000',
  RELIEF_NEIGHBOUR_STRENGTH: '1.000',
  RELIEF_NEIGHBOUR_CAVITY: '0.000',
  RELIEF_NEIGHBOUR_MASK_TILE: '7.000',
  RELIEF_NEIGHBOUR_DETAIL: false,
  RELIEF_NEIGHBOUR_TILE_B: '1.000',
  RELIEF_NEIGHBOUR_ANGLE_B: '0.000',
  RELIEF_NEIGHBOUR_MIX_B: '0.000',
};

const asFloat = (value) => Number(value).toFixed(3);

const RELIEF_CODE = `
uniform sampler2D reliefMapA;
uniform sampler2D reliefMapB;
uniform sampler2D reliefNeighbour;
uniform sampler2D reliefNeighbourB;

float reliefHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float reliefNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = reliefHash(i);
  float b = reliefHash(i + vec2(1.0, 0.0));
  float c = reliefHash(i + vec2(0.0, 1.0));
  float d = reliefHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

vec2 reliefTurn(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x + s * p.y, c * p.y - s * p.x);
}

mat3 reliefFrame(vec3 n) {
  vec3 alongX = vec3(1.0, 0.0, 0.0) - n * n.x;
  vec3 tangent = length(alongX) > 0.001 ? normalize(alongX) : vec3(0.0, 0.0, 1.0);
  vec3 bitangent = normalize(cross(tangent, n));
  return mat3(tangent, bitangent, n);
}

vec3 reliefNormal(vec3 base, vec3 texel, float strength, float angle) {
  vec3 n = texel;
  n.xy = reliefTurn(n.xy, -angle) * strength;
  return normalize(reliefFrame(base) * normalize(n));
}
`;

export default class TerrainReliefPlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'TerrainRelief', 120, RELIEF_DEFINES, true, true);
    this.primary = setup.primary;
    this.detail = setup.detail || null;
    this.strength = setup.strength;
    this.maskTile = setup.maskTile;
    this.macro = setup.macro;
    this.macroTile = setup.macroTile;
    this.cavity = setup.cavity;
    this.neighbour = setup.neighbour || null;
  }

  getClassName() {
    return 'TerrainReliefPlugin';
  }

  setNeighbour(neighbour) {
    const next = neighbour || null;
    const hadDetail = Boolean(this.neighbour && this.neighbour.detail);
    if (Boolean(next) !== Boolean(this.neighbour) || Boolean(next && next.detail) !== hadDetail) this.markAllDefinesAsDirty();
    this.neighbour = next;
  }

  prepareDefines(defines) {
    defines.RELIEF_TILE_A = asFloat(this.primary.tile);
    defines.RELIEF_ANGLE_A = asFloat(this.primary.angle);
    defines.RELIEF_STRENGTH = asFloat(this.strength);
    defines.RELIEF_MASK_TILE = asFloat(this.maskTile);
    defines.RELIEF_MACRO = asFloat(this.macro);
    defines.RELIEF_MACRO_TILE = asFloat(this.macroTile);
    defines.RELIEF_CAVITY = asFloat(this.cavity);
    const detail = this.detail;
    defines.RELIEF_DETAIL = Boolean(detail);
    if (detail) {
      defines.RELIEF_TILE_B = asFloat(detail.tile);
      defines.RELIEF_ANGLE_B = asFloat(detail.angle);
      defines.RELIEF_MIX_B = asFloat(detail.mix);
    }
    const neighbour = this.neighbour;
    defines.RELIEF_NEIGHBOUR = Boolean(neighbour);
    const neighbourDetail = neighbour ? neighbour.detail : null;
    defines.RELIEF_NEIGHBOUR_DETAIL = Boolean(neighbourDetail);
    if (neighbour) {
      defines.RELIEF_NEIGHBOUR_TILE = asFloat(neighbour.primary.tile);
      defines.RELIEF_NEIGHBOUR_ANGLE = asFloat(neighbour.primary.angle);
      defines.RELIEF_NEIGHBOUR_STRENGTH = asFloat(neighbour.strength);
      defines.RELIEF_NEIGHBOUR_CAVITY = asFloat(neighbour.cavity);
      defines.RELIEF_NEIGHBOUR_MASK_TILE = asFloat(neighbour.maskTile);
    }
    if (neighbourDetail) {
      defines.RELIEF_NEIGHBOUR_TILE_B = asFloat(neighbourDetail.tile);
      defines.RELIEF_NEIGHBOUR_ANGLE_B = asFloat(neighbourDetail.angle);
      defines.RELIEF_NEIGHBOUR_MIX_B = asFloat(neighbourDetail.mix);
    }
  }

  getSamplers(samplers) {
    samplers.push('reliefMapA', 'reliefMapB', 'reliefNeighbour', 'reliefNeighbourB');
  }

  bindForSubMesh(ubo) {
    const neighbour = this.neighbour;
    ubo.setTexture('reliefMapA', this.primary.texture);
    ubo.setTexture('reliefMapB', this.detail ? this.detail.texture : this.primary.texture);
    ubo.setTexture('reliefNeighbour', neighbour ? neighbour.primary.texture : this.primary.texture);
    const neighbourDetail = neighbour && neighbour.detail ? neighbour.detail.texture : null;
    ubo.setTexture('reliefNeighbourB', neighbourDetail || this.primary.texture);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: RELIEF_CODE,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
        vec2 reliefWorld = vPositionW.xz;
        vec3 reliefBase = normalize(normalW);
        vec3 reliefResult = reliefNormal(
          reliefBase,
          texture2D(reliefMapA, reliefTurn(reliefWorld / RELIEF_TILE_A, RELIEF_ANGLE_A)).xyz * 2.0 - 1.0,
          RELIEF_STRENGTH,
          RELIEF_ANGLE_A
        );
        #ifdef RELIEF_DETAIL
          vec3 reliefSecond = reliefNormal(
            reliefBase,
            texture2D(reliefMapB, reliefTurn(reliefWorld / RELIEF_TILE_B, RELIEF_ANGLE_B)).xyz * 2.0 - 1.0,
            RELIEF_STRENGTH,
            RELIEF_ANGLE_B
          );
          float reliefMask = smoothstep(0.32, 0.78, reliefNoise(reliefWorld / RELIEF_MASK_TILE)) * RELIEF_MIX_B;
          reliefResult = normalize(mix(reliefResult, reliefSecond, reliefMask));
        #endif
        float reliefCavity = RELIEF_CAVITY;
        #ifdef RELIEF_NEIGHBOUR
          vec2 reliefWeightUv = clamp((reliefWorld - blendOrigin) * blendScale, vec2(0.0), vec2(1.0));
          float reliefAmount = texture2D(blendWeightSampler, reliefWeightUv).r;
          vec3 reliefOther = reliefNormal(
            reliefBase,
            texture2D(reliefNeighbour, reliefTurn(reliefWorld / RELIEF_NEIGHBOUR_TILE, RELIEF_NEIGHBOUR_ANGLE)).xyz * 2.0 - 1.0,
            RELIEF_NEIGHBOUR_STRENGTH,
            RELIEF_NEIGHBOUR_ANGLE
          );
          #ifdef RELIEF_NEIGHBOUR_DETAIL
            vec3 reliefOtherSecond = reliefNormal(
              reliefBase,
              texture2D(reliefNeighbourB, reliefTurn(reliefWorld / RELIEF_NEIGHBOUR_TILE_B, RELIEF_NEIGHBOUR_ANGLE_B)).xyz * 2.0 - 1.0,
              RELIEF_NEIGHBOUR_STRENGTH,
              RELIEF_NEIGHBOUR_ANGLE_B
            );
            float reliefOtherMask = smoothstep(0.32, 0.78, reliefNoise(reliefWorld / RELIEF_NEIGHBOUR_MASK_TILE)) * RELIEF_NEIGHBOUR_MIX_B;
            reliefOther = normalize(mix(reliefOther, reliefOtherSecond, reliefOtherMask));
          #endif
          reliefResult = normalize(mix(reliefResult, reliefOther, reliefAmount));
          reliefCavity = mix(RELIEF_CAVITY, RELIEF_NEIGHBOUR_CAVITY, reliefAmount);
        #endif
        float reliefFlat = clamp(dot(reliefResult, reliefBase), 0.0, 1.0);
        normalW = reliefResult;
      `,
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        color.rgb *= 1.0 - reliefCavity * (1.0 - reliefFlat);
        if (RELIEF_MACRO > 0.0) {
          float reliefPatch = reliefNoise(vPositionW.xz / RELIEF_MACRO_TILE + vec2(3.7, 1.9));
          color.rgb *= 1.0 + (reliefPatch - 0.5) * 2.0 * RELIEF_MACRO;
        }
      `,
    };
  }
}
