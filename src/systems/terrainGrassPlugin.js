// Doplněk materiálu trávy — míchá tři textury země do velkých skvrn podle šumu.
// Nahrazuje jen barvu podkladu; osvětlení, tintu i stíny nechává StandardMaterialu.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { grassGroundGlsl } from '../utils/grassGround.js';

export default class TerrainGrassPlugin extends MaterialPluginBase {

  constructor(material, setup) {
    super(material, 'TerrainGrass', 150, {}, true, true);
    this.textures = setup.textures;
    this.tiles = setup.tiles;
    this.state = setup.state || { patch: 1 };
  }

  getClassName() {
    return 'TerrainGrassPlugin';
  }

  getSamplers(samplers) {
    samplers.push('groundTexA', 'groundTexB', 'groundTexC');
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'groundTileA', size: 1, type: 'float' },
        { name: 'groundTileB', size: 1, type: 'float' },
        { name: 'groundTileC', size: 1, type: 'float' },
        { name: 'groundPatch', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('groundTileA', this.tiles[0]);
    ubo.updateFloat('groundTileB', this.tiles[1]);
    ubo.updateFloat('groundTileC', this.tiles[2]);
    ubo.updateFloat('groundPatch', this.state.patch);
    ubo.setTexture('groundTexA', this.textures[0]);
    ubo.setTexture('groundTexB', this.textures[1]);
    ubo.setTexture('groundTexC', this.textures[2]);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: `
uniform sampler2D groundTexA;
uniform sampler2D groundTexB;
uniform sampler2D groundTexC;
${grassGroundGlsl()}`,
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        baseColor.rgb = groundGrass(vPositionW.xz, groundTileA, groundTileB, groundTileC, groundPatch);
      `,
    };
  }
}
