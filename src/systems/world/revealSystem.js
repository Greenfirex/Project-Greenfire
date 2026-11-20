// Rentgen kamery v podzemí — plynule schová všechno nad výškou řezu a svět mimo jeskyni ztmaví.
// Sám si připojí všechny materiály; pod jeskyní kreslí černé pozadí, aby nebylo vidět do prázdna.
// Na povrchu drží průhled — co stojí mezi kamerou a postavou, se plynule vyřízne; kde je pod dírou skála,
// kreslí na úrovni řezu tmavé kamenné dno, aby útes nevypadal dutý.
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { RawTexture } from '@babylonjs/core/Materials/Textures/rawTexture';
import { RawCubeTexture } from '@babylonjs/core/Materials/Textures/rawCubeTexture';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Constants } from '@babylonjs/core/Engines/constants';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3, Vector4 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import RevealPlugin from '../materials/revealPlugin.js';
import { CLIFF_TEXTURE, CLIFF_NORMAL } from '../../data/catalogs/assetPaths.js';
import { REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, REVEAL_CUT_ABOVE_FLOOR, PEEK, peekAmount } from '../../utils/revealGlsl.js';

const FADE_SECONDS = 0.4;
const PEEK_RADIUS = 2.2;
const PEEK_FADE_SECONDS = 0.3;
const CAP_RADIUS = 5;
const CAP_STEP = 0.2;
const CAP_REBUILD = 0.25;
const CAP_ROCK_ABOVE = 0.05;
const CAP_COLOR = new Color3(0.5, 0.47, 0.44);
const CAP_TILE = 2;
const CUT_FOLLOW = 10;
const BACKDROP_RADIUS = 400;
const BACKDROP_BELOW_FLOOR = 0.15;
const PLUGIN_CLASSES = new Set(['StandardMaterial', 'PBRMaterial', 'PBRMetallicRoughnessMaterial', 'PBRSpecularGlossinessMaterial']);

const OVERLAY_MATERIALS = /^(hologramMat_|brushMasterMat|hoverCellMat|creatureRadiusMat|zonesMaterial_|creatureMark|swingTrailMaterial)/;

function materialKind(name) {
  if (name === 'revealBackdropMat') return 'backdrop';
  if (name.startsWith('caveFrameMat_')) return 'frame';
  if (name === 'terrainCaveCeilingMat') return 'ceiling';
  if (name === 'terrainCaveRingMat') return 'caveRing';
  if (name.startsWith('terrainCaveDressMat')) return 'caveDress';
  if (name.includes('Cave')) return 'cave';
  if (name.startsWith('terrain')) return 'terrain';
  return OVERLAY_MATERIALS.test(name) ? 'overlay' : 'model';
}

export default class RevealSystem {

  constructor(scene) {
    this.s = scene;
    this.state = {
      center: new Vector3(0, 0, 0),
      amount: 0,
      cut: 0,
      sightFade: 1,
      floor: 0,
      kept: new Set(),
      creatures: new Set(),
      underground: new Set(),
      map: null,
      mapMin: new Vector4(0, 0, 1, 1),
      sightMap: null,
      sightEye: new Vector4(0, 0, 0, 0),
      sightDepth: new Vector4(0, 1, 0, 0),
      sightFog: new Color3(0, 0, 0),
      peek: new Vector4(0, 0, 0, 0),
      peekEye: new Vector4(0, 0, 0, PEEK_RADIUS),
    };
    this.paramsVector = new Vector4(0, 0, 0, 0);
    this.progress = 0;
    this.wasOpen = false;
    this.pending = [];
    this.shaders = new Set();
    this.backdrop = null;
    this.cap = null;
    this.capAt = null;
    this.rockHeightAt = null;
    this.lightMapTexture = null;
    this.lightBounds = new Vector4(0, 0, 1, 1);
    this.editorMapTexture = null;
    this.editorBounds = new Vector4(0, 0, 1, 1);
    this.litCells = 0;
    this.lowestVisible = Infinity;
    this.emptyMap = this.rawMap(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.state.map = this.emptyMap;
    this.openSight = this.allVisibleCube();
    this.state.sightMap = this.openSight;
    this.sightOn = false;
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
    if (this.lightMapTexture) this.lightMapTexture.dispose();
    this.lightMapTexture = map ? this.rawMap(map.data, map.width, map.height) : null;
    this.litCells = map ? map.lit : 0;
    this.lowestVisible = map ? map.lowestVisible : Infinity;
    if (map) this.lightBounds.set(map.minX, map.minZ, map.width, map.height);
    this.useCurrentMap();
  }

  setEditorMap(map) {
    if (this.editorMapTexture) this.editorMapTexture.dispose();
    this.editorMapTexture = map ? this.rawMap(map.data, map.width, map.height) : null;
    if (map) this.editorBounds.set(map.minX, map.minZ, map.width, map.height);
    this.useCurrentMap();
  }

  useCurrentMap() {
    const { state } = this;
    if (this.editorMapTexture) {
      state.map = this.editorMapTexture;
      state.mapMin.copyFrom(this.editorBounds);
    } else if (this.lightMapTexture) {
      state.map = this.lightMapTexture;
      state.mapMin.copyFrom(this.lightBounds);
    } else {
      state.map = this.emptyMap;
      state.mapMin.set(0, 0, 1, 1);
    }
  }

  rawMap(data, width, height) {
    const texture = new RawTexture(data, width, height, Constants.TEXTUREFORMAT_RGBA, this.s, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    return texture;
  }

  allVisibleCube() {
    const face = new Uint8Array([255, 255, 255, 255]);
    return new RawCubeTexture(this.s, [face, face, face, face, face, face], 1, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_UNSIGNED_BYTE, false, false, Texture.NEAREST_SAMPLINGMODE);
  }

  setSight(sight) {
    const { state } = this;
    this.sightOn = Boolean(sight && sight.active);
    if (!this.sightOn) {
      state.sightMap = this.openSight;
      state.sightEye.set(0, 0, 0, 0);
      state.sightDepth.set(0, 1, 0, 0);
      return;
    }
    state.sightMap = sight.map;
    state.sightEye.set(sight.eye.x, sight.eye.y, sight.eye.z, sight.range);
    state.sightFog.copyFrom(this.s.fogMode !== Scene.FOGMODE_NONE ? this.s.fogColor : this.s.clearColor);
    state.sightDepth.set(sight.near, sight.near + sight.mapRange, sight.packed ? 1 : 0, sight.hide);
  }

  forgetCompiled(material) {
    for (const mesh of material.getBindedMeshes()) {
      for (const subMesh of mesh.subMeshes || []) subMesh.materialDefines = null;
    }
  }

  setPeek(dt, feet, eye) {
    const { peek, peekEye } = this.state;
    const on = Boolean(feet && eye);
    const step = Math.max(0, dt) / PEEK_FADE_SECONDS;
    const strength = on ? Math.min(1, peek.w + step) : Math.max(0, peek.w - step);
    if (on) {
      peek.set(feet.x, feet.y, feet.z, strength);
      peekEye.set(eye.x, eye.y, eye.z, PEEK_RADIUS);
    } else {
      peek.w = strength;
    }
    this.updateCap(peek.w > 0.001 ? peek : null);
  }

  updateCap(feet) {
    if (!feet || !this.rockHeightAt) {
      if (this.cap) this.cap.setEnabled(false);
      this.capAt = null;
      return;
    }
    const y = feet.y + PEEK.feetFrom;
    const at = this.capAt;
    if (at && Math.abs(at.x - feet.x) < CAP_REBUILD && Math.abs(at.z - feet.z) < CAP_REBUILD && Math.abs(at.y - y) < CAP_REBUILD) {
      this.cap.setEnabled(this.capFilled);
      return;
    }
    this.capAt = new Vector3(feet.x, y, feet.z);
    this.ensureCap();
    const count = Math.round((CAP_RADIUS * 2) / CAP_STEP) + 1;
    const cx = Math.round(feet.x / CAP_STEP) * CAP_STEP;
    const cz = Math.round(feet.z / CAP_STEP) * CAP_STEP;
    this.cap.position.set(cx, y, cz);
    const positions = [];
    const normals = [];
    const uvs = [];
    const rock = [];
    for (let j = 0; j < count; j += 1) {
      for (let i = 0; i < count; i += 1) {
        const x = i * CAP_STEP - CAP_RADIUS;
        const z = j * CAP_STEP - CAP_RADIUS;
        positions.push(x, 0, z);
        normals.push(0, 1, 0);
        uvs.push((cx + x) / CAP_TILE, (cz + z) / CAP_TILE);
        const height = this.rockHeightAt(cx + x, cz + z);
        rock.push(Number.isFinite(height) && height > y + CAP_ROCK_ABOVE);
      }
    }
    const indices = [];
    for (let j = 0; j < count - 1; j += 1) {
      for (let i = 0; i < count - 1; i += 1) {
        const a = j * count + i;
        const b = a + 1;
        const c = a + count;
        const d = c + 1;
        if (rock[a] && rock[b] && rock[c] && rock[d]) indices.push(a, c, b, b, c, d);
      }
    }
    this.capFilled = indices.length > 0;
    if (this.capFilled) Object.assign(new VertexData(), { positions, normals, uvs, indices }).applyToMesh(this.cap, true);
    this.cap.setEnabled(this.capFilled);
  }

  capTexture(url) {
    const texture = new Texture(url, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 4;
    return texture;
  }

  ensureCap() {
    if (this.cap) return;
    const material = new StandardMaterial('revealPeekCapMat', this.s);
    material.diffuseTexture = this.capTexture(CLIFF_TEXTURE);
    material.bumpTexture = this.capTexture(CLIFF_NORMAL);
    material.bumpTexture.gammaSpace = false;
    material.diffuseColor = CAP_COLOR;
    material.specularColor = new Color3(0, 0, 0);
    material.backFaceCulling = false;
    this.cap = new Mesh('revealPeekCap', this.s);
    this.cap.isPickable = false;
    this.cap.material = material;
    this.cap.setEnabled(false);
  }

  peekAt(x, y, z) {
    return peekAmount(x, y, z, this.state.peek, this.state.peekEye);
  }

  isOpen() {
    return this.progress > 0;
  }

  setCreatureMeshes(meshes) {
    this.state.creatures = meshes;
  }

  setUndergroundMeshes(meshes) {
    const { underground } = this.state;
    underground.clear();
    for (const mesh of meshes) underground.add(mesh);
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

  update(dt, active, position, camera, view = null) {
    this.attachPending();
    const step = Math.max(0, dt) / FADE_SECONDS;
    this.progress = Math.max(0, Math.min(1, this.progress + (active ? step : -step)));
    const state = this.state;
    state.amount = this.progress * this.progress * (3 - 2 * this.progress);
    state.sightFade = view || this.sightOn ? 0 : 1;
    if (view) {
      state.center.copyFrom(camera.target);
      state.cut = view.cut;
      state.floor = view.floor;
    } else if (position) {
      state.center.copyFrom(position);
      const goal = position.y + REVEAL_CUT_ABOVE_FLOOR;
      const follow = this.progress > 0 && this.wasOpen ? 1 - Math.exp(-CUT_FOLLOW * Math.max(0, dt)) : 1;
      state.cut += (goal - state.cut) * follow;
      state.floor = position.y;
    }
    this.wasOpen = this.progress > 0;
    this.pushShaderUniforms();
    this.updateBackdrop(view ? state.center : position);
  }

  pushShaderUniforms() {
    const { center, amount, cut, sightFade, floor, map, mapMin, sightMap, sightEye, sightDepth, sightFog, peek, peekEye } = this.state;
    for (const material of this.shaders) {
      material.setTexture(REVEAL_SIGHT_SAMPLER, sightMap);
      material.setVector4('revealSightEye', sightEye);
      material.setVector4('revealSightDepth', sightDepth);
      material.setColor3('revealSightFog', sightFog);
      material.setVector4('revealPeek', peek);
      material.setVector4('revealPeekEye', peekEye);
      material.setVector3('revealCenter', center);
      material.setTexture(REVEAL_SAMPLER, map);
      material.setVector4('revealMapMin', mapMin);
      material.setVector4('revealParams', this.paramsVector.set(amount, cut, sightFade, floor));
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
    this.backdrop.position.set(position.x, Math.min(this.state.floor, this.lowestVisible) - BACKDROP_BELOW_FLOOR, position.z);
  }
}
