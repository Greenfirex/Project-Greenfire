// Kaustika na dně — světelná síť od vln se přidá k zemi, která je pod hladinou.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { causticGlsl } from '../utils/waterCaustics.js';

const CAUSTIC_CODE = causticGlsl();

export default class TerrainCausticPlugin extends MaterialPluginBase {

  constructor(material) {
    super(material, 'TerrainCaustic', 210, {}, true, true);
    this.time = 0;
    this.level = -1000;
    this.dirX = 0.94;
    this.dirZ = 0.34;
    this.color = new Color3(1, 1, 1);
    this.strength = 0;
    this.maxDepth = 2.5;
  }

  getClassName() {
    return 'TerrainCausticPlugin';
  }

  setCaustics(time, level, dirX, dirZ, color, strength, maxDepth) {
    this.time = Number.isFinite(time) ? time : 0;
    this.level = Number.isFinite(level) ? level : -1000;
    this.dirX = Number.isFinite(dirX) ? dirX : 0.94;
    this.dirZ = Number.isFinite(dirZ) ? dirZ : 0.34;
    if (color) this.color = color;
    this.strength = Number.isFinite(strength) ? strength : 0;
    if (Number.isFinite(maxDepth) && maxDepth > 0) this.maxDepth = maxDepth;
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'causticTime', size: 1, type: 'float' },
        { name: 'causticLevel', size: 1, type: 'float' },
        { name: 'causticDir', size: 2, type: 'vec2' },
        { name: 'causticColor', size: 3, type: 'vec3' },
        { name: 'causticStrength', size: 1, type: 'float' },
        { name: 'causticMaxDepth', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('causticTime', this.time);
    ubo.updateFloat('causticLevel', this.level);
    ubo.updateFloat2('causticDir', this.dirX, this.dirZ);
    ubo.updateColor3('causticColor', this.color);
    ubo.updateFloat('causticStrength', this.strength);
    ubo.updateFloat('causticMaxDepth', this.maxDepth);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: CAUSTIC_CODE,
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        float causticDepthNow = causticLevel - vPositionW.y;
        if (causticDepthNow > 0.0) {
          float causticT = clamp(causticDepthNow / max(causticMaxDepth, 0.001), 0.0, 1.0);
          float causticFade = smoothstep(0.25, 0.7, causticT) * (1.0 - 0.3 * smoothstep(0.7, 1.0, causticT));
          float causticValue = causticPattern(vPositionW.xz, causticDir, causticTime);
          color.rgb += causticColor * causticValue * causticStrength * causticFade;
        }
      `,
    };
  }
}
