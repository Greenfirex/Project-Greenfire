// Doplňek materiálu modelu — zvýrazní barvy tím, že každý kanál oddálí od šedé.
// Hodnota nad 1 barvy sytí, 1 znamená beze změny.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const SATURATION_CODE = `
{
  float saturationLuma = dot(surfaceAlbedo.rgb, vec3(0.2126, 0.7152, 0.0722));
  surfaceAlbedo.rgb = clamp(mix(vec3(saturationLuma), surfaceAlbedo.rgb, SATURATION_AMOUNT), 0.0, 1.0);
}
`;

export default class ModelSaturationPlugin extends MaterialPluginBase {

  constructor(material, amount = 1.25) {
    super(material, 'ModelSaturation', 150, { SATURATION_AMOUNT: '1.000' }, true, true);
    this.amount = Number.isFinite(amount) ? amount : 1;
  }

  getClassName() {
    return 'ModelSaturationPlugin';
  }

  prepareDefines(defines) {
    defines.SATURATION_AMOUNT = this.amount.toFixed(3);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return { CUSTOM_FRAGMENT_BEFORE_LIGHTS: SATURATION_CODE };
  }
}
