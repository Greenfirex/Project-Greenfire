// Noční světlo na modelech z Meshy — jejich „fyzikální“ materiál by jinak slabé měsíční světlo zesílil a v noci by svítily.
// V noci přepočítá slabé světlo tak, aby tmavlo stejně jako terén; silné světlo (pochodeň, oheň) zůstane skoro beze změny.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { RegisterMaterialPlugin } from '@babylonjs/core/Materials/materialPluginManager';

const NIGHT_CURVE = '0.7';
const LUMA = 'vec3(0.2126, 0.7152, 0.0722)';
const NIGHT_CODE = `
#ifndef UNLIT
{
  float nightLit = max(dot(diffuseBase, ${LUMA}), 0.0);
  float nightScale = mix(1.0, pow(clamp(nightLit / max(nightLightLevel, 0.001), 0.0, 1.0), ${NIGHT_CURVE}), nightLightAmount);
  finalDiffuse *= nightScale;
  #ifdef SPECULARTERM
  finalSpecularScaled *= nightScale;
  #endif
}
#endif
`;
const night = { amount: 0, level: 1 };

export function setNightLight(amount, level) {
  night.amount = Math.max(0, Math.min(1, Number(amount) || 0));
  night.level = Math.max(0.001, Number(level) || 1);
}

class NightLightPlugin extends MaterialPluginBase {

  constructor(material) {
    super(material, 'NightLight', 180, {}, true, true);
  }

  getClassName() {
    return 'NightLightPlugin';
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'nightLightAmount', size: 1, type: 'float' },
        { name: 'nightLightLevel', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('nightLightAmount', night.amount);
    ubo.updateFloat('nightLightLevel', night.level);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return { CUSTOM_FRAGMENT_BEFORE_FINALCOLORCOMPOSITION: NIGHT_CODE };
  }
}

RegisterMaterialPlugin('NightLight', (material) => (material.getClassName() === 'PBRMaterial' ? new NightLightPlugin(material) : null));
