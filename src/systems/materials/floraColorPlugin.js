// Doplněk materiálu rostliny — srovná barvu listí a přidá společné doladění všech rostlin.
// Listí pozná podle toho, že je zelenější než okolí; kůra a plody zůstanou bez korekce listí.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { FLORA_GRADE } from '../../data/catalogs/floraColor.js';

const LEAF_MASK_GAIN = '12.0';
const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';

const gradeCode = (read, write) => `
{
  vec3 floraColor = ${read};
  float floraLeaf = clamp((floraColor.g - max(floraColor.r, floraColor.b)) * ${LEAF_MASK_GAIN}, 0.0, 1.0);
  floraColor *= mix(vec3(1.0), FLORA_LEAF_TINT, floraLeaf);
  floraColor = mix(vec3(dot(floraColor, ${LUMA})), floraColor, FLORA_SATURATION);
  floraColor *= FLORA_GRADE_GAIN;
  floraColor = mix(vec3(dot(floraColor, ${LUMA})), floraColor, FLORA_GRADE_SATURATION);
  ${write}(clamp(floraColor, 0.0, 1.0));
}
`;

function vec3(values) {
  return `vec3(${values.map((value) => value.toFixed(3)).join(', ')})`;
}

export default class FloraColorPlugin extends MaterialPluginBase {

  constructor(material, setup = {}) {
    super(material, 'FloraColor', 150, {
      FLORA_LEAF_TINT: 'vec3(1.0)',
      FLORA_SATURATION: '1.000',
      FLORA_GRADE_GAIN: 'vec3(1.0)',
      FLORA_GRADE_SATURATION: '1.000',
    }, true, true);
    this.leafTint = setup.leafTint || [1, 1, 1];
    this.saturation = Number.isFinite(setup.saturation) ? setup.saturation : 1;
    this.pbr = material.getClassName() === 'PBRMaterial';
  }

  getClassName() {
    return 'FloraColorPlugin';
  }

  prepareDefines(defines) {
    const { brightness, warmth, saturation } = FLORA_GRADE;
    defines.FLORA_LEAF_TINT = vec3(this.leafTint);
    defines.FLORA_SATURATION = this.saturation.toFixed(3);
    defines.FLORA_GRADE_GAIN = vec3([brightness * (1 + warmth * 0.5), brightness, brightness * (1 - warmth)]);
    defines.FLORA_GRADE_SATURATION = saturation.toFixed(3);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    if (this.pbr) {
      return { CUSTOM_FRAGMENT_BEFORE_LIGHTS: gradeCode('toGammaSpace(surfaceAlbedo.rgb)', 'surfaceAlbedo.rgb = toLinearSpace') };
    }
    return { CUSTOM_FRAGMENT_UPDATE_DIFFUSE: gradeCode('baseColor.rgb', 'baseColor.rgb = ') };
  }
}
