// Doplněk materiálu terénu — přimíchá barvu až tří sousedních povrchů podle váhových map.
// Soused s třítexturovým podkladem (tráva) se počítá stejným předpisem jako jeho vlastní plocha.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { grassGroundGlsl } from '../utils/grassGround.js';

const SECOND_SLOT = 'TERRAIN_BLEND_SECOND';
const THIRD_SLOT = 'TERRAIN_BLEND_THIRD';
const GROUND = 'TERRAIN_BLEND_GROUND';
const GROUND_SLOTS = ['TERRAIN_BLEND_GROUND1', 'TERRAIN_BLEND_GROUND2', 'TERRAIN_BLEND_GROUND3'];

export default class TerrainBlendPlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'TerrainBlend', 200, {
      [SECOND_SLOT]: false,
      [THIRD_SLOT]: false,
      [GROUND]: false,
      [GROUND_SLOTS[0]]: false,
      [GROUND_SLOTS[1]]: false,
      [GROUND_SLOTS[2]]: false,
    }, true, true);
    this.blends = setup.blends || [];
    this.patch = setup.patch || null;
  }

  getClassName() {
    return 'TerrainBlendPlugin';
  }

  setBlendSetup(setup) {
    const next = setup.blends || [];
    if (Boolean(next[1]) !== Boolean(this.blends[1])) this.markAllDefinesAsDirty();
    if (Boolean(next[2]) !== Boolean(this.blends[2])) this.markAllDefinesAsDirty();
    if (Boolean(setup.patch) !== Boolean(this.patch)) this.markAllDefinesAsDirty();
    this.blends = next;
    this.patch = setup.patch || null;
  }

  prepareDefines(defines) {
    defines[SECOND_SLOT] = Boolean(this.blends[1]);
    defines[THIRD_SLOT] = Boolean(this.blends[2]);
    defines[GROUND] = Boolean(this.patch);
    for (let i = 0; i < GROUND_SLOTS.length; i += 1) {
      defines[GROUND_SLOTS[i]] = Boolean(this.blends[i] && this.blends[i].patch);
    }
  }

  getSamplers(samplers) {
    samplers.push('blendSampler', 'blendWeightSampler');
    if (this.blends[1]) samplers.push('blendSampler2', 'blendWeightSampler2');
    if (this.blends[2]) samplers.push('blendSampler3', 'blendWeightSampler3');
    if (this.patch) samplers.push('groundTexA', 'groundTexB', 'groundTexC');
  }

  getUniforms() {
    const ubo = [
      { name: 'blendTile', size: 1, type: 'float' },
      { name: 'blendColor', size: 3, type: 'vec3' },
      { name: 'blendOrigin', size: 2, type: 'vec2' },
      { name: 'blendScale', size: 2, type: 'vec2' },
      { name: 'blendTile2', size: 1, type: 'float' },
      { name: 'blendColor2', size: 3, type: 'vec3' },
      { name: 'blendOrigin2', size: 2, type: 'vec2' },
      { name: 'blendScale2', size: 2, type: 'vec2' },
      { name: 'blendTile3', size: 1, type: 'float' },
      { name: 'blendColor3', size: 3, type: 'vec3' },
      { name: 'blendOrigin3', size: 2, type: 'vec2' },
      { name: 'blendScale3', size: 2, type: 'vec2' },
    ];
    if (this.patch) {
      ubo.push(
        { name: 'groundTileA', size: 1, type: 'float' },
        { name: 'groundTileB', size: 1, type: 'float' },
        { name: 'groundTileC', size: 1, type: 'float' },
        { name: 'groundPatch2', size: 1, type: 'float' },
      );
    }
    return { ubo };
  }

  bindSlot(ubo, slot, suffix) {
    ubo.updateFloat(`blendTile${suffix}`, slot.tile);
    ubo.updateColor3(`blendColor${suffix}`, slot.color);
    ubo.updateFloat2(`blendOrigin${suffix}`, slot.origin.x, slot.origin.y);
    ubo.updateFloat2(`blendScale${suffix}`, slot.scale.x, slot.scale.y);
    ubo.setTexture(`blendSampler${suffix}`, slot.texture);
    ubo.setTexture(`blendWeightSampler${suffix}`, slot.weights);
  }

  bindForSubMesh(ubo) {
    if (this.blends[0]) this.bindSlot(ubo, this.blends[0], '');
    if (this.blends[1]) this.bindSlot(ubo, this.blends[1], '2');
    if (this.blends[2]) this.bindSlot(ubo, this.blends[2], '3');
    if (!this.patch) return;
    ubo.updateFloat('groundTileA', this.patch.tiles[0]);
    ubo.updateFloat('groundTileB', this.patch.tiles[1]);
    ubo.updateFloat('groundTileC', this.patch.tiles[2]);
    ubo.updateFloat('groundPatch2', this.patch.state.patch);
    ubo.setTexture('groundTexA', this.patch.textures[0]);
    ubo.setTexture('groundTexB', this.patch.textures[1]);
    ubo.setTexture('groundTexC', this.patch.textures[2]);
  }

  sampleCode(slot, suffix) {
    const uv = suffix === '' ? 'blendUv' : `blendUv${suffix}`;
    const origin = suffix === '' ? 'blendOrigin' : `blendOrigin${suffix}`;
    const scale = suffix === '' ? 'blendScale' : `blendScale${suffix}`;
    const weight = suffix === '' ? 'blendWeightSampler' : `blendWeightSampler${suffix}`;
    const amount = suffix === '' ? 'blendAmount' : `blendAmount${suffix}`;
    const sample = suffix === '' ? 'blendSample' : `blendSample${suffix}`;
    const tile = suffix === '' ? 'blendTile' : `blendTile${suffix}`;
    const color = suffix === '' ? 'blendColor' : `blendColor${suffix}`;
    return `
          vec2 ${uv} = (vPositionW.xz - ${origin}) * ${scale};
          float ${amount} = texture2D(${weight}, clamp(${uv}, vec2(0.0), vec2(1.0))).r;
          #ifdef ${slot.ground}
            vec3 ${sample} = groundGrass(vPositionW.xz, groundTileA, groundTileB, groundTileC, groundPatch2);
          #else
            vec3 ${sample} = texture2D(blendSampler${suffix}, vPositionW.xz / ${tile}).rgb * vColor.rgb;
          #endif
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
          uniform sampler2D blendWeightSampler2;
        #endif
        #ifdef ${THIRD_SLOT}
          uniform sampler2D blendSampler3;
          uniform sampler2D blendWeightSampler3;
        #endif
        #ifdef ${GROUND}
          uniform sampler2D groundTexA;
          uniform sampler2D groundTexB;
          uniform sampler2D groundTexC;
          ${grassGroundGlsl()}
        #endif
      `,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: [
        this.sampleCode({ ground: GROUND_SLOTS[0] }, ''),
        `#ifdef ${SECOND_SLOT}`,
        this.sampleCode({ ground: GROUND_SLOTS[1] }, '2'),
        '#endif',
        `#ifdef ${THIRD_SLOT}`,
        this.sampleCode({ ground: GROUND_SLOTS[2] }, '3'),
        '#endif',
      ].join('\n'),
    };
  }
}
