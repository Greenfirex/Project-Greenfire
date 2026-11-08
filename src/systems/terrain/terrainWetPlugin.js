// Mokrý pruh na zemi u vody — ztmaví a mírně ochladí písek i trávu podle vzdálenosti od hladiny.
// Drží jen tvar pruhu; kde je voda a jak vysoko, mu hlásí systém terénu.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Color3 } from '@babylonjs/core/Maths/math.color';

const WET_CODE = `
float wetHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float wetShape(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = wetHash(i);
  float b = wetHash(i + vec2(1.0, 0.0));
  float c = wetHash(i + vec2(0.0, 1.0));
  float d = wetHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

export default class TerrainWetPlugin extends MaterialPluginBase {

  constructor(material, strength = 0.5) {
    super(material, 'TerrainWet', 200, {}, true, true);
    this.baseStrength = Math.max(0, Math.min(1, Number.isFinite(strength) ? strength : 0));
    this.level = null;
    this.tint = new Color3(0.66, 0.7, 0.75);
  }

  getClassName() {
    return 'TerrainWetPlugin';
  }

  setWet(level) {
    this.level = Number.isFinite(level) ? level : null;
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'wetLevel', size: 1, type: 'float' },
        { name: 'wetStrength', size: 1, type: 'float' },
        { name: 'wetTint', size: 3, type: 'vec3' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    const wet = this.level !== null;
    ubo.updateFloat('wetLevel', wet ? this.level : -1000);
    ubo.updateFloat('wetStrength', wet ? this.baseStrength : 0);
    ubo.updateColor3('wetTint', this.tint);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: WET_CODE,
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        if (wetStrength > 0.0 && seaDryAt(vPositionW.xz, seaDryArea) < 0.5) {
          float wetAbove = vPositionW.y - wetLevel;
          float wetEdge = (wetShape(vPositionW.xz * 0.85) - 0.5) * 0.18;
          float wetAmount = 1.0 - smoothstep(-0.05, 0.30, wetAbove + wetEdge);
          color.rgb *= mix(vec3(1.0), wetTint, clamp(wetAmount, 0.0, 1.0) * wetStrength);
        }
      `,
    };
  }
}
