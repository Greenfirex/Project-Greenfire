// Jemný obrys modelu — ztmaví místa, kde se plocha odvrací od kamery.
// Nedělá kopii geometrie, takže je zdarma i u stovek kusů; síla i ostrost hrany jsou čísla.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const RIM_CODE = `
{
  vec3 rimView = normalize(vEyePosition.xyz - vPositionW);
  float rimEdge = pow(1.0 - clamp(dot(normalize(vNormalW), rimView), 0.0, 1.0), RIM_POWER);
  finalColor.rgb *= clamp(1.0 - rimEdge * RIM_AMOUNT, 0.0, 1.0);
}
`;

export default class ModelRimPlugin extends MaterialPluginBase {

  constructor(material, setup = {}) {
    super(material, 'ModelRim', 160, { RIM_AMOUNT: '0.000', RIM_POWER: '3.500' }, true, true);
    this.amount = Number.isFinite(setup.amount) ? setup.amount : 0.45;
    this.power = Number.isFinite(setup.power) ? setup.power : 3.5;
  }

  getClassName() {
    return 'ModelRimPlugin';
  }

  prepareDefines(defines) {
    defines.RIM_AMOUNT = this.amount.toFixed(3);
    defines.RIM_POWER = this.power.toFixed(3);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return { CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: RIM_CODE };
  }
}
