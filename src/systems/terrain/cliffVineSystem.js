// Rostliny na hranách útesu — visuté liany z modelu, které visí z horní hrany dolů po stěně, a kytičky na hraně.
// Liana se zkrátí podle výšky stěny, aby nesahala pod její patu; kde je stěna nízká, liana se nedává.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';
import { flowerTemplate } from '../../utils/flowerFactory.js';
import { loadModel } from '../../utils/assetLoader.js';

const VINE_URLS = [`${ASSET_DIRS.plants}cliff_vine.glb`, `${ASSET_DIRS.plants}cliff_vine_2.glb`];
const VINE_YAW = 0;
const SPAWN_CHANCE = 0.22;
const SCALE_RANGE = [0.9, 1.4];
const MIN_DROP = 0.6;
const DROP_SHARE = 0.9;
const TOP_OVERLAP = 0.05;
const WALL_GAP = 0.1;
const YAW_SPREAD = 0.5;
const FLOWER_KEYS = ['flower_white', 'flower_yellow', 'flower_pink', 'flower_coral'];
const FLOWER_CHANCE = 0.2;
const FLOWER_MIN = 1;
const FLOWER_MAX = 3;
const MIN_SHELF_DEPTH = 0.16;

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
    this.vines = [];
    this.flowers = FLOWER_KEYS.map((key) => this.flowerFor(key));
    this.anchors = [];
    Promise.all(VINE_URLS.map((url) => loadModel(this.s, url))).then((templates) => {
      this.vines = templates.map((template, index) => this.vineFor(template, index)).filter(Boolean);
      if (this.vines.length) this.create(this.anchors);
    });
  }

  vineFor(template, index) {
    const source = template && template.getChildMeshes ? template.getChildMeshes()[0] : null;
    if (!source) return null;
    const mesh = source.clone(`cliffVine_${index}`, null, false);
    mesh.parent = null;
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    return {
      mesh,
      top: box.maximum.y,
      height: Math.max(0.01, box.maximum.y - box.minimum.y),
      matrices: [],
    };
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

  create(anchors) {
    this.anchors = anchors || [];
    for (const vine of this.vines) vine.matrices = [];
    for (const flower of this.flowers) flower.matrices = [];
    for (const anchor of this.anchors) this.place(anchor);
    for (const vine of this.vines) this.flush(vine.mesh, vine.matrices);
    for (const flower of this.flowers) this.flush(flower.mesh, flower.matrices);
  }

  place(anchor) {
    if (!anchor.always) this.placeFlowers(anchor);
    if (this.vines.length) this.placeVine(anchor);
  }

  placeVine(anchor) {
    const vine = this.vines[Math.floor(hash(anchor.x, anchor.z, 11) * this.vines.length) % this.vines.length];
    const drop = Number.isFinite(anchor.drop) ? anchor.drop : 0;
    if ((anchor.depth || 0) < MIN_SHELF_DEPTH || drop < MIN_DROP) return;
    if (!anchor.always && hash(anchor.x, anchor.z, 1) > SPAWN_CHANCE) return;
    const wanted = between(SCALE_RANGE, hash(anchor.x, anchor.z, 4));
    const scale = Math.min(wanted, (drop * DROP_SHARE) / vine.height);
    const yaw = Math.atan2(anchor.dirX, anchor.dirZ) + VINE_YAW + (hash(anchor.x, anchor.z, 3) - 0.5) * YAW_SPREAD;
    const gap = WALL_GAP * scale;
    const position = new Vector3(
      anchor.x + anchor.dirX * gap,
      anchor.y + TOP_OVERLAP - vine.top * scale,
      anchor.z + anchor.dirZ * gap,
    );
    vine.matrices.push(Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), position));
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
    for (const vine of this.vines) vine.mesh.dispose(false, false);
    for (const flower of this.flowers) flower.mesh.dispose(false, false);
    this.vines = [];
    this.flowers = [];
  }
}
