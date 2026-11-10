// Doplněk skalních kusů — na plochy, které míří vzhůru, přimíchá mech, jako by na kameni rostl.
// Rozhoduje jen sklon plochy, takže boky kamene zůstanou holé a vršek zezelená.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

export default class CliffMossPlugin extends MaterialPluginBase {

  constructor(material, mossTexture) {
    super(material, 'CliffMoss', 200, {}, true, true);
    this.mossTexture = mossTexture;
  }

  getClassName() {
    return 'CliffMossPlugin';
  }

  getSamplers(samplers) {
    samplers.push('cliffTopMossSampler');
  }

  bindForSubMesh(ubo) {
    ubo.setTexture('cliffTopMossSampler', this.mossTexture);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: 'uniform sampler2D cliffTopMossSampler;',
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        float mossUp = smoothstep(0.2, 0.7, normalW.y);
        vec3 mossSample = texture2D(cliffTopMossSampler, vMainUV1 * 1.4 + vec2(3.7, 1.9)).rgb;
        baseColor.rgb = mix(baseColor.rgb, mossSample * vec3(0.82, 0.95, 0.72), mossUp * 0.85);
      `,
    };
  }
}
