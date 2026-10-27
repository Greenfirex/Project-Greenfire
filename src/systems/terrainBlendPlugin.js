// Doplněk materiálu terénu — přimíchá texturu sousedního povrchu podle váhové mapy.
// Osvětlení a stíny zůstávají na StandardMaterialu, míchá se jen barva podkladu.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

export default class TerrainBlendPlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'TerrainBlend', 200, {}, true, true);
    this.blendTexture = setup.texture;
    this.weightTexture = setup.weights;
    this.blendTile = setup.tile;
    this.blendColor = setup.color;
    this.weightOrigin = setup.origin;
    this.weightScale = setup.scale;
  }

  getClassName() {
    return 'TerrainBlendPlugin';
  }

  setBlend(texture, tile, color, weights, origin, scale) {
    this.blendTexture = texture;
    this.blendTile = tile;
    this.blendColor = color;
    this.weightTexture = weights;
    this.weightOrigin = origin;
    this.weightScale = scale;
  }

  getSamplers(samplers) {
    samplers.push('blendSampler', 'blendWeightSampler');
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'blendTile', size: 1, type: 'float' },
        { name: 'blendColor', size: 3, type: 'vec3' },
        { name: 'blendOrigin', size: 2, type: 'vec2' },
        { name: 'blendScale', size: 2, type: 'vec2' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('blendTile', this.blendTile);
    ubo.updateColor3('blendColor', this.blendColor);
    ubo.updateFloat2('blendOrigin', this.weightOrigin.x, this.weightOrigin.y);
    ubo.updateFloat2('blendScale', this.weightScale.x, this.weightScale.y);
    ubo.setTexture('blendSampler', this.blendTexture);
    ubo.setTexture('blendWeightSampler', this.weightTexture);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: 'uniform sampler2D blendSampler;\nuniform sampler2D blendWeightSampler;',
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        vec2 blendUv = (vPositionW.xz - blendOrigin) * blendScale;
        float blendAmount = texture2D(blendWeightSampler, clamp(blendUv, vec2(0.0), vec2(1.0))).r;
        vec3 blendSample = texture2D(blendSampler, vPositionW.xz / blendTile).rgb;
        baseColor.rgb = mix(baseColor.rgb, blendSample * vColor.rgb, blendAmount);
        diffuseColor = mix(diffuseColor, blendColor, blendAmount);
      `,
    };
  }
}
