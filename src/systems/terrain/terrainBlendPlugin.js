// Doplněk materiálu terénu — přimíchá barvu až tří sousedních povrchů podle váhových map.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const SECOND_SLOT = 'TERRAIN_BLEND_SECOND';
const THIRD_SLOT = 'TERRAIN_BLEND_THIRD';

export default class TerrainBlendPlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'TerrainBlend', 200, {
      [SECOND_SLOT]: false,
      [THIRD_SLOT]: false,
    }, true, true);
    this.blends = setup.blends || [];
    this.weights = setup.weights;
  }

  getClassName() {
    return 'TerrainBlendPlugin';
  }

  setBlendSetup(setup) {
    const next = setup.blends || [];
    if (Boolean(next[1]) !== Boolean(this.blends[1])) this.markAllDefinesAsDirty();
    if (Boolean(next[2]) !== Boolean(this.blends[2])) this.markAllDefinesAsDirty();
    this.blends = next;
    this.weights = setup.weights;
  }

  prepareDefines(defines) {
    defines[SECOND_SLOT] = Boolean(this.blends[1]);
    defines[THIRD_SLOT] = Boolean(this.blends[2]);
  }

  getSamplers(samplers) {
    samplers.push('blendSampler', 'blendWeightSampler');
    if (this.blends[1]) samplers.push('blendSampler2');
    if (this.blends[2]) samplers.push('blendSampler3');
  }

  getUniforms() {
    return { ubo: [
      { name: 'blendOrigin', size: 2, type: 'vec2' },
      { name: 'blendScale', size: 2, type: 'vec2' },
      { name: 'blendTile', size: 1, type: 'float' },
      { name: 'blendColor', size: 3, type: 'vec3' },
      { name: 'blendTile2', size: 1, type: 'float' },
      { name: 'blendColor2', size: 3, type: 'vec3' },
      { name: 'blendTile3', size: 1, type: 'float' },
      { name: 'blendColor3', size: 3, type: 'vec3' },
    ] };
  }

  bindSlot(ubo, slot, suffix) {
    ubo.updateFloat(`blendTile${suffix}`, slot.tile);
    ubo.updateColor3(`blendColor${suffix}`, slot.color);
    ubo.setTexture(`blendSampler${suffix}`, slot.texture);
  }

  bindForSubMesh(ubo) {
    const weights = this.weights;
    ubo.updateFloat2('blendOrigin', weights.origin.x, weights.origin.y);
    ubo.updateFloat2('blendScale', weights.scale.x, weights.scale.y);
    ubo.setTexture('blendWeightSampler', weights.texture);
    if (this.blends[0]) this.bindSlot(ubo, this.blends[0], '');
    if (this.blends[1]) this.bindSlot(ubo, this.blends[1], '2');
    if (this.blends[2]) this.bindSlot(ubo, this.blends[2], '3');
  }

  sampleCode(suffix, channel) {
    const amount = suffix === '' ? 'blendAmount' : `blendAmount${suffix}`;
    const sample = suffix === '' ? 'blendSample' : `blendSample${suffix}`;
    const tile = suffix === '' ? 'blendTile' : `blendTile${suffix}`;
    const color = suffix === '' ? 'blendColor' : `blendColor${suffix}`;
    return `
          float ${amount} = blendWeights.${channel};
          vec3 ${sample} = texture2D(blendSampler${suffix}, vPositionW.xz / ${tile}).rgb * vColor.rgb;
          baseColor.rgb = mix(baseColor.rgb, ${sample}, ${amount});
          diffuseColor = mix(diffuseColor, ${color}, ${amount});
    `;
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
        uniform sampler2D blendSampler;
        uniform sampler2D blendWeightSampler;
        #ifdef ${SECOND_SLOT}
          uniform sampler2D blendSampler2;
        #endif
        #ifdef ${THIRD_SLOT}
          uniform sampler2D blendSampler3;
        #endif
      `,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: [
        'vec3 blendWeights = texture2D(blendWeightSampler, clamp((vPositionW.xz - blendOrigin) * blendScale, vec2(0.0), vec2(1.0))).rgb;',
        this.sampleCode('', 'r'),
        `#ifdef ${SECOND_SLOT}`,
        this.sampleCode('2', 'g'),
        '#endif',
        `#ifdef ${THIRD_SLOT}`,
        this.sampleCode('3', 'b'),
        '#endif',
      ].join('\n'),
    };
  }
}
