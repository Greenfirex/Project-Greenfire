// Rentgen kamery v podzemí — plynule schová všechno nad výškou řezu a svět mimo jeskyni ztmaví.
// Sám si připojí všechny materiály; pod jeskyní kreslí černé pozadí, aby nebylo vidět do prázdna.
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import RevealPlugin from '../materials/revealPlugin.js';
import { REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER } from '../../utils/revealGlsl.js';

const FADE_SECONDS = 0.4;
const CUT_ABOVE_FLOOR = 3;
const CUT_FOLLOW = 10;
const SIGHT_RADIUS = 12;
const BACKDROP_RADIUS = 400;
const BACKDROP_BELOW_FLOOR = 0.15;
const DAY_LIGHT = [2.6, 2.4, 2.0];
const NIGHT_LIGHT = 0.25;
const PLUGIN_CLASSES = new Set(['StandardMaterial', 'PBRMaterial', 'PBRMetallicRoughnessMaterial', 'PBRSpecularGlossinessMaterial']);

const OVERLAY_MATERIALS = /^(hologramMat_|brushMasterMat|hoverCellMat|creatureRadiusMat|zonesMaterial_|creatureMark)/;

function materialKind(name) {
  if (name === 'revealBackdropMat') return 'backdrop';
  if (name === 'terrainCaveCeilingMat') return 'ceiling';
  if (name.includes('Cave')) return 'cave';
  if (name.startsWith('terrain')) return 'terrain';
  return OVERLAY_MATERIALS.test(name) ? 'overlay' : 'model';
}

export default class RevealSystem {

  constructor(scene) {
    this.s = scene;
    this.state = {
      center: new Vector3(0, 0, 0),
      right: new Vector3(1, 0, 0),
      up: new Vector3(0, 1, 0),
      toCam: new Vector3(0, 1, 0),
      amount: 0,
      cut: 0,
      radius: SIGHT_RADIUS,
      floor: 0,
      kept: new Set(),
      map: null,
      mapMin: new Vector4(0, 0, 1, 1),
      light: new Vector3(0, 0, 0),
    };
    this.paramsVector = new Vector4(0, 0, 0, 0);
    this.progress = 0;
    this.wasOpen = false;
    this.pending = [];
    this.shaders = new Set();
    this.backdrop = null;
    this.lightMapTexture = null;
    this.litCells = 0;
    this.emptyMap = this.rawMap(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.state.map = this.emptyMap;
    this.setDayness(1);
    this.watchMaterials();
  }

  watchMaterials() {
    this.pending.push(...this.s.materials);
    this.s.onNewMaterialAddedObservable.add((material) => this.pending.push(material));
    this.s.onMaterialRemovedObservable.add((material) => this.shaders.delete(material));
  }

  attachPending() {
    if (!this.pending.length) return;
    for (const material of this.pending.splice(0)) this.attach(material);
  }

  attach(material) {
    const className = material.getClassName();
    if (className === 'ShaderMaterial') {
      const uniforms = material.options && material.options.uniforms;
      if (uniforms && uniforms.includes(REVEAL_UNIFORM_NAMES[0])) this.shaders.add(material);
      return;
    }
    if (!PLUGIN_CLASSES.has(className)) return;
    if (material.pluginManager && material.pluginManager.getPlugin('Reveal')) return;
    new RevealPlugin(material, this.state, materialKind(material.name || ''));
    if (material._uniformBufferLayoutBuilt || material.getBindedMeshes().length) this.forgetCompiled(material);
    material.markAsDirty(Material.AllDirtyFlag);
  }

  setLightMap(map) {
    const state = this.state;
    if (this.lightMapTexture) this.lightMapTexture.dispose();
    this.lightMapTexture = null;
    state.map = this.emptyMap;
    state.mapMin.set(0, 0, 1, 1);
    this.litCells = map ? map.lit : 0;
    if (!map) return;
    this.lightMapTexture = this.rawMap(map.data, map.width, map.height);
    state.map = this.lightMapTexture;
    state.mapMin.set(map.minX, map.minZ, map.width, map.height);
  }

  rawMap(data, width, height) {
    const texture = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_RGBA, this.s, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    return texture;
  }

  setDayness(value) {
    const strength = NIGHT_LIGHT + (1 - NIGHT_LIGHT) * value;
    this.state.light.set(DAY_LIGHT[0] * strength, DAY_LIGHT[1] * strength, DAY_LIGHT[2] * strength);
  }

  forgetCompiled(material) {
    for (const mesh of material.getBindedMeshes()) {
      for (const subMesh of mesh.subMeshes || []) subMesh.materialDefines = null;
    }
  }

  isOpen() {
    return this.progress > 0;
  }

  setKeptMeshes(meshes) {
    const { kept } = this.state;
    kept.clear();
    for (const mesh of meshes) kept.add(mesh);
  }

  ensureBackdrop() {
    if (this.backdrop) return;
    const material = new StandardMaterial('revealBackdropMat', this.s);
    material.disableLighting = true;
    material.emissiveColor = new Color3(0, 0, 0);
    material.diffuseColor = new Color3(0, 0, 0);
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    const backdrop = CreateDisc('revealBackdrop', { radius: BACKDROP_RADIUS, tessellation: 48 }, this.s);
    backdrop.rotation.x = Math.PI / 2;
    backdrop.isPickable = false;
    backdrop.material = material;
    backdrop.setEnabled(false);
    this.backdrop = backdrop;
  }

  updateCamera(camera) {
    const { right, up, toCam } = this.state;
    camera.getDirectionToRef(Vector3.Right(), right);
    camera.getDirectionToRef(Vector3.Up(), up);
    camera.position.subtractToRef(camera.target, toCam);
    toCam.normalize();
  }

  update(dt, active, position, camera) {
    this.attachPending();
    const step = Math.max(0, dt) / FADE_SECONDS;
    this.progress = Math.max(0, Math.min(1, this.progress + (active ? step : -step)));
    const state = this.state;
    state.amount = this.progress * this.progress * (3 - 2 * this.progress);
    if (position) {
      state.center.copyFrom(position);
      const goal = position.y + CUT_ABOVE_FLOOR;
      const follow = this.progress > 0 && this.wasOpen ? 1 - Math.exp(-CUT_FOLLOW * Math.max(0, dt)) : 1;
      state.cut += (goal - state.cut) * follow;
      state.floor = position.y;
    }
    this.wasOpen = this.progress > 0;
    if (camera) this.updateCamera(camera);
    this.pushShaderUniforms();
    this.updateBackdrop(position);
  }

  pushShaderUniforms() {
    const { center, right, up, toCam, amount, cut, radius, floor, map, mapMin, light } = this.state;
    for (const material of this.shaders) {
      material.setVector3('revealCenter', center);
      material.setVector3('revealRight', right);
      material.setVector3('revealUp', up);
      material.setVector3('revealToCam', toCam);
      material.setTexture(REVEAL_SAMPLER, map);
      material.setVector4('revealMapMin', mapMin);
      material.setVector3('revealLight', light);
      material.setVector4('revealParams', this.paramsVector.set(amount, cut, radius, floor));
    }
  }

  updateBackdrop(position) {
    const open = this.state.amount > 0.001 && Boolean(position);
    if (!open) {
      if (this.backdrop) this.backdrop.setEnabled(false);
      return;
    }
    this.ensureBackdrop();
    this.backdrop.setEnabled(true);
    this.backdrop.material.alpha = this.state.amount;
    this.backdrop.position.set(position.x, this.state.floor - BACKDROP_BELOW_FLOOR, position.z);
  }
}
