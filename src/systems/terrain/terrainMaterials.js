// Část terénu: materiály — textury povrchů, skal a hlíny, prolínání, reliéf, kaustika a mokrý okraj.
// Patří k TerrainSystem (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { getDecoration, DEFAULT_FLOOR } from '../../data/catalogs/decorations.js';
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';
import TerrainBlendPlugin from './terrainBlendPlugin.js';
import TerrainReliefPlugin from './terrainReliefPlugin.js';
import TerrainCausticPlugin from './terrainCausticPlugin.js';
import TerrainWetPlugin from './terrainWetPlugin.js';
import CliffSurfacePlugin from './cliffSurfacePlugin.js';
import CliffMossPlugin from './cliffMossPlugin.js';
import { SURFACE_VERTEX_TINT, color3 } from './terrainSettings.js';

const CLIFF_TEXTURE = `${ASSET_DIRS.textures}Rock050_1K-JPG_Color.jpg`;
const CLIFF_NORMAL = `${ASSET_DIRS.textures}Rock050_1K-JPG_NormalGL.jpg`;
const CLIFF_STRATA_TEXTURE = `${ASSET_DIRS.textures}Rock023_1K-JPG_Color.jpg`;
const CLIFF_MOSS_TEXTURE = `${ASSET_DIRS.textures}Rock063_1K-JPG_Color.jpg`;
const CLAY_CLIFF_TEXTURE = `${ASSET_DIRS.textures}Ground071_1K-JPG_Color.jpg`;
const CLAY_CLIFF_NORMAL = `${ASSET_DIRS.textures}Ground071_1K-JPG_NormalGL.jpg`;
const DRESS_MOSS_TEXTURE = `${ASSET_DIRS.textures}Grass001_1K-JPG_Color.jpg`;

export default {
  cliffMaterialFor(style) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const key = style === 'dirt' ? 'dirt' : 'stone';
    if (!this.cliffMaterials[key]) {
      this.cliffMaterials[key] = key === 'dirt' ? this.dirtCliffMaterial() : this.stoneCliffMaterial();
    }
    return this.cliffMaterials[key];
  },

  caveDressMaterial(style) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const key = `caveDress_${style}`;
    if (!this.cliffMaterials[key]) {
      const cliff = this.cliffMaterialFor(style);
      const material = new StandardMaterial(`terrainCaveDressMat_${style}`, this.s);
      material.diffuseTexture = cliff.diffuseTexture;
      material.bumpTexture = cliff.bumpTexture;
      material.diffuseColor = cliff.diffuseColor.clone();
      material.specularColor = cliff.specularColor.clone();
      material.backFaceCulling = false;
      this.cliffMaterials[key] = material;
    }
    return this.cliffMaterials[key];
  },

  caveFrameMaterial(style) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const cliff = this.cliffMaterialFor(style);
    const key = `frame_${cliff.name}`;
    if (!this.cliffMaterials[key]) {
      const material = new StandardMaterial(`caveFrameMat_${style}`, this.s);
      material.diffuseTexture = cliff.diffuseTexture;
      material.bumpTexture = cliff.bumpTexture;
      material.diffuseColor = cliff.diffuseColor.clone();
      material.specularColor = cliff.specularColor.clone();
      material.backFaceCulling = false;
      this.cliffMaterials[key] = material;
    }
    return this.cliffMaterials[key];
  },

  cliffDressMaterial(style, mossy = false) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const key = `dress_${style}${mossy ? '_moss' : ''}`;
    if (!this.cliffMaterials[key]) {
      const cliff = this.cliffMaterialFor(style);
      const material = new StandardMaterial(`terrainCliffDressMat_${style}${mossy ? '_moss' : ''}`, this.s);
      material.diffuseTexture = cliff.diffuseTexture;
      material.bumpTexture = cliff.bumpTexture;
      material.diffuseColor = cliff.diffuseColor.clone();
      material.specularColor = cliff.specularColor.clone();
      material.backFaceCulling = false;
      if (mossy) new CliffMossPlugin(material, this.cliffBlendTexture(DRESS_MOSS_TEXTURE));
      this.cliffMaterials[key] = material;
    }
    return this.cliffMaterials[key];
  },

  caveRockMaterial(ceiling) {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    const key = ceiling ? 'caveCeiling' : 'caveWall';
    if (!this.cliffMaterials[key]) {
      const material = ceiling ? this.stoneCliffMaterial(false) : this.dirtCliffMaterial(false);
      material.name = ceiling ? 'terrainCaveCeilingMat' : 'terrainCaveWallMat';
      material.backFaceCulling = true;
      material.cullBackFaces = ceiling;
      material.twoSidedLighting = !ceiling;
      this.cliffMaterials[key] = material;
    }
    return this.cliffMaterials[key];
  },

  caveRingMaterial() {
    if (!this.cliffMaterials) this.cliffMaterials = {};
    if (!this.cliffMaterials.caveRing) {
      const material = this.dirtCliffMaterial(false);
      material.name = 'terrainCaveRingMat';
      material.backFaceCulling = false;
      material.twoSidedLighting = true;
      this.cliffMaterials.caveRing = material;
    }
    return this.cliffMaterials.caveRing;
  },

  stoneCliffMaterial(nearWater = true) {
    const material = new StandardMaterial('terrainCliffStoneMat', this.s);
    const texture = new Texture(CLIFF_TEXTURE, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(1.02, 1.01, 0.98);
    material.specularColor = new Color3(0.05, 0.05, 0.05);
    material.backFaceCulling = false;
    const bump = new Texture(CLIFF_NORMAL, this.s);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    material.twoSidedLighting = true;
    bump.level = 1.4;
    material.bumpTexture = bump;
    const strata = this.cliffBlendTexture(CLIFF_STRATA_TEXTURE);
    const moss = this.cliffBlendTexture(CLIFF_MOSS_TEXTURE);
    new CliffSurfacePlugin(material, { strata, moss });
    if (nearWater) this.addCliffWaterPlugins(material, 0.5);
    return material;
  },

  cliffBlendTexture(url) {
    const texture = new Texture(url, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    this.cliffBlendTextures.push(texture);
    return texture;
  },

  addCliffWaterPlugins(material, wet) {
    this.causticPlugins.push(new TerrainCausticPlugin(material, this.seaDry));
    this.wetPlugins.push(new TerrainWetPlugin(material, wet));
  },

  dirtCliffMaterial(nearWater = true) {
    const material = new StandardMaterial('terrainCliffDirtMat', this.s);
    const texture = new Texture(CLAY_CLIFF_TEXTURE, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(0.88, 0.82, 0.72);
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    const bump = new Texture(CLAY_CLIFF_NORMAL, this.s);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    bump.anisotropicFilteringLevel = 4;
    bump.level = 1.2;
    material.bumpTexture = bump;
    if (nearWater) this.addCliffWaterPlugins(material, 0.55);
    return material;
  },

  surfaceConfig(key) {
    const def = getDecoration(key);
    if (def && def.surface && def.surface.texture) return def.surface;
    const fallback = getDecoration(DEFAULT_FLOOR);
    return fallback && fallback.surface && fallback.surface.texture ? fallback.surface : null;
  },

  blendSetupFor(blend) {
    const blends = blend.partners.map((partner) => {
      return {
        texture: this.blendTextureFor(partner.key),
        weights: partner.weights.texture,
        tile: partner.tile,
        color: partner.color,
        origin: partner.weights.origin,
        scale: partner.weights.scale,
      };
    });
    return { blends };
  },

  bandMaterialFor(key, map) {
    const cacheKey = 'band|' + key;
    const cached = this.materials.get(cacheKey);
    if (cached) return cached;
    const cfg = this.surfaceConfig(key) || {};
    const material = new StandardMaterial('terrainBandMat_' + key, this.s);
    const colorTexture = new Texture(CLAY_CLIFF_TEXTURE, this.s);
    colorTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    colorTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    colorTexture.anisotropicFilteringLevel = 4;
    material.diffuseTexture = colorTexture;
    const bumpTexture = new Texture(CLAY_CLIFF_NORMAL, this.s);
    bumpTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    bumpTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    bumpTexture.gammaSpace = false;
    bumpTexture.anisotropicFilteringLevel = 4;
    material.bumpTexture = bumpTexture;
    material.diffuseColor = color3(cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]));
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
    material.useVertexColor = true;
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    this.materials.set(cacheKey, material);
    return material;
  },

  materialFor(key, map, blend = null, underground = false) {
    const baseKey = blend ? `${key}|${blend.partners.map((partner) => partner.key).join('+')}` : key;
    const cacheKey = underground ? `Cave|${baseKey}` : baseKey;
    let material = this.materials.get(cacheKey);
    if (!material) {
      const cfg = this.surfaceConfig(key);
      material = new StandardMaterial(`terrainSurfaceMat_${cacheKey}`, this.s);
      material.diffuseTexture = new Texture(cfg.texture, this.s);
      material.specularColor = new Color3(0.02, 0.02, 0.02);
      material.ambientColor = color3(cfg.ambient || [0.08, 0.08, 0.07]);
      material.useVertexColor = true;
      material.backFaceCulling = false;
      material.twoSidedLighting = true;
      material.diffuseColor = this.surfaceDiffuse(cfg, map);
      this.materials.set(cacheKey, material);
      const relief = this.reliefSetupFor(key, blend);
      if (relief) this.reliefPlugins.set(cacheKey, new TerrainReliefPlugin(material, relief));
      if (!underground) {
        this.causticPlugins.push(new TerrainCausticPlugin(material, this.seaDry));
        this.wetPlugins.push(new TerrainWetPlugin(material, cfg.wet === undefined ? 0.4 : cfg.wet));
      }
      if (blend) {
        this.blendPlugins.set(cacheKey, new TerrainBlendPlugin(material, this.blendSetupFor(blend)));
      }
      return material;
    }
    const plugin = this.blendPlugins.get(cacheKey);
    if (plugin && blend) plugin.setBlendSetup(this.blendSetupFor(blend));
    const reliefPlugin = this.reliefPlugins.get(cacheKey);
    if (reliefPlugin) reliefPlugin.setNeighbour(this.reliefNeighbourFor(blend));
    return material;
  },

  reliefSetupFor(key, blend) {
    const cfg = this.surfaceConfig(key);
    if (!cfg || !cfg.relief || !cfg.relief.map) return null;
    const relief = cfg.relief;
    return {
      primary: this.reliefMapFor(relief.map),
      detail: relief.detail ? this.reliefMapFor(relief.detail) : null,
      strength: relief.strength === undefined ? 1 : relief.strength,
      maskTile: relief.maskTile || 7,
      macro: relief.macro || 0,
      macroTile: relief.macroTile || 19,
      neighbour: this.reliefNeighbourFor(blend),
    };
  },

  reliefMapFor(map) {
    return {
      texture: this.reliefTexture(map.texture),
      tile: map.tile || 1,
      angle: map.angle || 0,
      mix: map.mix === undefined ? 1 : map.mix,
    };
  },

  reliefNeighbourFor(blend) {
    if (!blend || !blend.partners.length) return null;
    const cfg = this.surfaceConfig(blend.partners[0].key);
    if (!cfg || !cfg.relief || !cfg.relief.map) return null;
    const map = cfg.relief.map;
    return {
      texture: this.reliefTexture(map.texture),
      tile: map.tile || 1,
      angle: map.angle || 0,
      strength: cfg.relief.strength === undefined ? 1 : cfg.relief.strength,
    };
  },

  reliefTexture(url) {
    let texture = this.reliefTextures.get(url);
    if (!texture) {
      texture = new Texture(url, this.s);
      texture.wrapU = Texture.WRAP_ADDRESSMODE;
      texture.wrapV = Texture.WRAP_ADDRESSMODE;
      texture.gammaSpace = false;
      texture.anisotropicFilteringLevel = 8;
      this.reliefTextures.set(url, texture);
    }
    return texture;
  },

  surfaceColor(key, map) {
    const cfg = this.surfaceConfig(key);
    if (!cfg) return new Color3(1, 1, 1);
    return this.surfaceDiffuse(cfg, map);
  },

  surfaceDiffuse(cfg, map) {
    const tint = cfg.mapTint ? this.tintOf(map) : (cfg.color || [1, 1, 1]);
    if (!cfg.shade) return color3(tint);
    return color3(tint.map((value, index) => value * cfg.shade / SURFACE_VERTEX_TINT[index]));
  },

  blendTextureFor(key) {
    let texture = this.blendTextures.get(key);
    if (!texture) {
      const cfg = this.surfaceConfig(key);
      texture = new Texture(cfg.texture, this.s);
      this.blendTextures.set(key, texture);
    }
    return texture;
  },

  grassShade(map) {
    const tone = (map && map.colors && map.colors.surfaceTint) || [0.5, 0.62, 0.45];
    return [
      tone[0] * 2 * SURFACE_VERTEX_TINT[0],
      tone[1] * 2 * SURFACE_VERTEX_TINT[1],
      tone[2] * 2 * SURFACE_VERTEX_TINT[2],
    ];
  },

  updateCaustics(time, level, dirX, dirZ, color, strength, maxDepth) {
    for (const plugin of this.causticPlugins) {
      plugin.setCaustics(time, level, dirX, dirZ, color, strength, maxDepth);
    }
  },

  setSeaDry(texture, area) {
    this.seaDry.texture = texture;
    this.seaDry.area.copyFrom(area);
  },

  updateWetLevel(level) {
    for (const plugin of this.wetPlugins) plugin.setWet(level);
  },

  disposeMaterials() {
    for (const material of this.materials.values()) {
      if (material) material.dispose(false, true);
    }
    this.materials.clear();
    this.blendPlugins.clear();
    this.reliefPlugins.clear();
    this.causticPlugins.length = 0;
    this.wetPlugins.length = 0;
    for (const texture of this.reliefTextures.values()) {
      if (texture) texture.dispose();
    }
    this.reliefTextures.clear();
    for (const texture of this.blendTextures.values()) {
      if (texture) texture.dispose();
    }
    this.blendTextures.clear();
    if (this.cliffMaterials) {
      for (const material of Object.values(this.cliffMaterials)) {
        if (material) material.dispose(false, true);
      }
      this.cliffMaterials = null;
    }
    for (const texture of this.cliffBlendTextures) {
      if (texture) texture.dispose();
    }
    this.cliffBlendTextures.length = 0;
  },

  tintOf(map) {
    const tone = map.colors.surfaceTint || [0.5, 0.62, 0.45];
    return [tone[0] * 2, tone[1] * 2, tone[2] * 2];
  },
};
