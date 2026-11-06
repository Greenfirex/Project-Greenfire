// Doplněk skalní stěny — míchá světlé vrstvy a mech do základní skály podle polohy.
// Maska mechu chodí z vrcholů, takže sedí na každé stěně bez ohledu na její výšku.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

export default class CliffSurfacePlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'CliffSurface', 200, {}, true, true);
    this.strataTexture = setup.strata;
    this.mossTexture = setup.moss;
  }

  getClassName() {
    return 'CliffSurfacePlugin';
  }

  getSamplers(samplers) {
    samplers.push('cliffStrataSampler', 'cliffMossSampler');
  }

  getAttributes(attributes) {
    attributes.push('mossMask');
  }

  bindForSubMesh(ubo) {
    ubo.setTexture('cliffStrataSampler', this.strataTexture);
    ubo.setTexture('cliffMossSampler', this.mossTexture);
  }

  getCustomCode(shaderType) {
    if (shaderType === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: 'attribute float mossMask;\nvarying float vMossMask;',
        CUSTOM_VERTEX_MAIN_END: 'vMossMask = mossMask;',
      };
    }
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: 'uniform sampler2D cliffStrataSampler;\nuniform sampler2D cliffMossSampler;\nvarying float vMossMask;',
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        vec2 strataUv = vMainUV1 * vec2(0.55, 0.55) + vec2(13.1, 7.7);
        vec3 strataSample = texture2D(cliffStrataSampler, strataUv).rgb;
        float stripe = 0.5 + 0.5 * sin(vPositionW.y * 1.15 + sin(vPositionW.x * 0.13 + vPositionW.z * 0.17) * 2.1);
        float strataAmount = smoothstep(0.32, 0.80, stripe) * 0.30;
        baseColor.rgb = mix(baseColor.rgb, strataSample * vColor.rgb, strataAmount);
        vec2 mossUv = vec2(vMainUV1.x * 0.5, vMainUV1.y) * 1.15 + vec2(5.3, 2.9);
        vec3 mossSample = texture2D(cliffMossSampler, mossUv).rgb;
        float mossAmount = clamp(vMossMask, 0.0, 1.0) * 0.62;
        baseColor.rgb = mix(baseColor.rgb, mossSample * vColor.rgb, mossAmount);
      `,
    };
  }
}