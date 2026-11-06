// Rostliny na poličkách útesu — růžice listů, každý list je prohnutý pás s vlastní texturou.
// Listy se střídají ze tří textur, barva se tintí podle zeleně země.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';
import { createCliffLeafGeometry } from '../../utils/leafRosetteFactory.js';
import TreeWindPlugin from '../flora/treeWindPlugin.js';
import { flowerTemplate } from '../../utils/flowerFactory.js';

const TYPES = [
  {
    key: 'calathea',
    leaves: ['cliff_leaf_calathea_a.png', 'cliff_leaf_calathea_b.png', 'cliff_leaf_calathea_c.png'],
    chance: 1,
  },
];
const SPAWN_CHANCE = 0.22;
const FLOWER_KEYS = ['flower_white', 'flower_yellow', 'flower_pink', 'flower_coral'];
const FLOWER_CHANCE = 0.2;
const FLOWER_MIN = 1;
const FLOWER_MAX = 3;
const MIN_SHELF_DEPTH = 0.16;
const SCALE = [0.8, 1.25];
const INSET = 0.15;
const DEFAULT_TINT = [0.95, 1.0, 0.86];

function hash(...values) {
  let h = 2166136261;
  for (const value of values) {
    h ^= Math.round(value * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 65536) / 65536;
}

function between(range, value) {
  return range[0] + (range[1] - range[0]) * value;
}

export default class CliffVineSystem {

  constructor(scene) {
    this.s = scene;
    this.types = TYPES.map((type, index) => this.typeFor(type, index));
    this.flowers = FLOWER_KEYS.map((key) => this.flowerFor(key));
    this.anchors = [];
  }

  typeFor(type, index) {
    const layers = type.leaves.map((file, layer) => ({
      mesh: this.meshFor(`cliffPlant_${type.key}_${layer}`, createCliffLeafGeometry(layer, index + 5), file),
      matrices: [],
    }));
    return { type, layers };
  }

  flowerFor(key) {
    const template = flowerTemplate(this.s, key);
    const source = template.getChildMeshes()[0];
    const mesh = source.clone(`shelfFlower_${key}`, null, false);
    mesh.parent = null;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    return { key, mesh, matrices: [] };
  }

  meshFor(name, geometry, file) {
    const mesh = new Mesh(name, this.s);
    const data = new VertexData();
    data.positions = geometry.positions;
    data.uvs = geometry.uvs;
    data.normals = geometry.normals;
    data.indices = geometry.indices;
    data.colors = geometry.colors;
    data.applyToMesh(mesh);
    const material = new StandardMaterial(`${name}_mat`, this.s);
    const texture = new Texture(`${ASSET_DIRS.textures}${file}`, this.s);
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.diffuseColor = new Color3(DEFAULT_TINT[0], DEFAULT_TINT[1], DEFAULT_TINT[2]);
    material.specularColor = new Color3(0.03, 0.03, 0.03);
    material.emissiveColor = new Color3(0.14, 0.17, 0.1);
    material.backFaceCulling = false;
    material.twoSidedLighting = true;
    material.useAlphaFromDiffuseTexture = true;
    material.transparencyMode = StandardMaterial.MATERIAL_ALPHATEST;
    material.alphaCutOff = 0.35;
    new TreeWindPlugin(material, { strength: 0.035, height: 0.4 });
    mesh.material = material;
    mesh.useVertexColors = true;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    return mesh;
  }

  create(anchors, tint) {
    this.anchors = anchors || [];
    this.applyTint(tint);
    for (const type of this.types) {
      for (const layer of type.layers) layer.matrices = [];
    }
    for (const flower of this.flowers) flower.matrices = [];
    for (const anchor of this.anchors) this.place(anchor);
    for (const type of this.types) {
      for (const layer of type.layers) this.flush(layer.mesh, layer.matrices);
    }
    for (const flower of this.flowers) this.flush(flower.mesh, flower.matrices);
  }

  applyTint(tint) {
    const color = Array.isArray(tint) && tint.length >= 3 ? tint : DEFAULT_TINT;
    for (const type of this.types) {
      for (const layer of type.layers) {
        layer.mesh.material.diffuseColor = new Color3(color[0], color[1], color[2]);
      }
    }
  }

  place(anchor) {
    this.placeFlowers(anchor);
    if ((anchor.depth || 0) < MIN_SHELF_DEPTH) return;
    if (hash(anchor.x, anchor.z, 1) > SPAWN_CHANCE) return;
    const type = this.pickType(hash(anchor.x, anchor.z, 2));
    const yaw = Math.atan2(anchor.dirX, anchor.dirZ) + (hash(anchor.x, anchor.z, 3) - 0.5) * 1.6;
    const scale = between(SCALE, hash(anchor.x, anchor.z, 4));
    const position = new Vector3(
      anchor.x - anchor.dirX * INSET,
      anchor.y - 0.01,
      anchor.z - anchor.dirZ * INSET,
    );
    const matrix = Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), position);
    for (const layer of type.layers) layer.matrices.push(matrix);
  }

  placeFlowers(anchor) {
    const depth = anchor.depth || 0;
    if (depth < 0.1) return;
    if (hash(anchor.x, anchor.z, 7.3) > FLOWER_CHANCE) return;
    const total = FLOWER_MIN + Math.floor(hash(anchor.x, anchor.z, 8.1) * (FLOWER_MAX - FLOWER_MIN + 1));
    for (let index = 0; index < total; index += 1) {
      const pick = Math.floor(hash(anchor.x, anchor.z, index + 17) * this.flowers.length);
      const flower = this.flowers[pick % this.flowers.length];
      const spread = (hash(anchor.x, anchor.z, index + 27) - 0.5) * 0.9;
      const inset = 0.06 + hash(anchor.x, anchor.z, index + 37) * Math.max(0, depth - 0.08);
      const scale = 0.8 + hash(anchor.x, anchor.z, index + 47) * 0.5;
      const yaw = hash(anchor.x, anchor.z, index + 57) * Math.PI * 2;
      flower.matrices.push(Matrix.Compose(
        new Vector3(scale, scale, scale),
        Quaternion.RotationYawPitchRoll(yaw, 0, 0),
        new Vector3(
          anchor.x - anchor.dirX * inset - anchor.dirZ * spread,
          anchor.y,
          anchor.z - anchor.dirZ * inset + anchor.dirX * spread,
        ),
      ));
    }
  }

  pickType(value) {
    let threshold = 0;
    for (const type of this.types) {
      threshold += type.type.chance;
      if (value < threshold) return type;
    }
    return this.types[this.types.length - 1];
  }

  flush(mesh, matrices) {
    const total = matrices.length;
    if (!total) {
      mesh.thinInstanceCount = 0;
      mesh.setEnabled(false);
      return;
    }
    const buffer = new Float32Array(total * 16);
    for (let index = 0; index < total; index += 1) {
      matrices[index].copyToArray(buffer, index * 16);
    }
    mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
    mesh.setEnabled(true);
  }

  dispose() {
    for (const type of this.types) {
      for (const layer of type.layers) layer.mesh.dispose(false, true);
    }
    this.types = [];
  }
}