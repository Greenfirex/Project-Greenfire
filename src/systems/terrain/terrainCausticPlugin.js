// Kaustika na dně — světelná síť od vln se přidá k zemi, která je pod hladinou.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { causticGlsl } from '../../utils/waterCaustics.js';
import { SEA_DIRECTION, WATER_MAX_DEPTH, SEA_DISTANCE_REACH } from '../../utils/waterWaves.js';
import { HEIGHT_STEP, MIN_HEIGHT } from '../../data/maps/layoutStore.js';

const CAUSTIC_CODE = `${causticGlsl()}
uniform sampler2D seaDrySampler;
float seaDryAt(vec2 point, vec4 area) {
  vec2 cell = floor(point / ${CELL_SIZE.toFixed(1)} - area.xy + 0.5);
  return texture2D(seaDrySampler, (cell + 0.5) / area.zw).r;
}
float lakeLevelAt(vec2 point, vec4 area) {
  vec2 cell = floor(point / ${CELL_SIZE.toFixed(1)} - area.xy + 0.5);
  float code = floor(texture2D(seaDrySampler, (cell + 0.5) / area.zw).b * 255.0 + 0.5);
  return code < 0.5 ? -1000.0 : (code - 1.0 + ${MIN_HEIGHT.toFixed(1)}) * ${HEIGHT_STEP.toFixed(2)};
}
float waterCellAt(vec2 point, vec4 area) {
  vec2 cell = floor(point / ${CELL_SIZE.toFixed(1)} - area.xy + 0.5);
  return texture2D(seaDrySampler, (cell + 0.5) / area.zw).g < 0.002 ? 1.0 : 0.0;
}
float seaDistanceAt(vec2 point, vec4 area) {
  vec2 grid = point / ${CELL_SIZE.toFixed(1)} - area.xy;
  vec2 base = floor(grid);
  vec2 f = grid - base;
  float a = texture2D(seaDrySampler, (base + vec2(0.5, 0.5)) / area.zw).g;
  float b = texture2D(seaDrySampler, (base + vec2(1.5, 0.5)) / area.zw).g;
  float c = texture2D(seaDrySampler, (base + vec2(0.5, 1.5)) / area.zw).g;
  float d = texture2D(seaDrySampler, (base + vec2(1.5, 1.5)) / area.zw).g;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * ${SEA_DISTANCE_REACH.toFixed(1)};
}
`;

export default class TerrainCausticPlugin extends MaterialPluginBase {

  constructor(material, seaDry) {
    super(material, 'TerrainCaustic', 210, {}, true, true);
    this.time = 0;
    this.level = -1000;
    this.dirX = SEA_DIRECTION[0];
    this.dirZ = SEA_DIRECTION[1];
    this.color = new Color3(1, 1, 1);
    this.strength = 0;
    this.maxDepth = WATER_MAX_DEPTH;
    this.seaDry = seaDry;
  }

  getSamplers(samplers) {
    samplers.push('seaDrySampler');
  }

  getClassName() {
    return 'TerrainCausticPlugin';
  }

  setCaustics(time, level, dirX, dirZ, color, strength, maxDepth) {
    this.time = Number.isFinite(time) ? time : 0;
    this.level = Number.isFinite(level) ? level : -1000;
    this.dirX = Number.isFinite(dirX) ? dirX : SEA_DIRECTION[0];
    this.dirZ = Number.isFinite(dirZ) ? dirZ : SEA_DIRECTION[1];
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
        { name: 'seaDryArea', size: 4, type: 'vec4' },
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
    ubo.updateVector4('seaDryArea', this.seaDry.area);
    if (this.seaDry.texture) ubo.setTexture('seaDrySampler', this.seaDry.texture);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: CAUSTIC_CODE,
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        float causticLake = lakeLevelAt(vPositionW.xz, seaDryArea);
        bool causticInLake = causticLake > -999.0 && waterCellAt(vPositionW.xz, seaDryArea) > 0.5;
        float causticDepthNow = (causticInLake ? causticLake : causticLevel) - vPositionW.y;
        if (causticDepthNow > 0.0 && (causticInLake || seaDryAt(vPositionW.xz, seaDryArea) < 0.5)) {
          float causticT = clamp(causticDepthNow / max(causticMaxDepth, 0.001), 0.0, 1.0);
          float causticFade = smoothstep(0.25, 0.7, causticT) * (1.0 - 0.3 * smoothstep(0.7, 1.0, causticT));
          float causticValue = causticPattern(vPositionW.xz, causticDir, causticTime);
          color.rgb += causticColor * causticValue * causticStrength * causticFade;
        }
      `,
    };
  }
}
