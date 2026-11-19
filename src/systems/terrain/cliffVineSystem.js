// Rostliny na útesech — visuté liany z horní hrany, z poliček, nad vchody do jeskyní a z vršku stěn staveb, a kytičky na hraně.
// Liana se zkrátí podle výšky stěny, aby nesahala pod její patu; ve větru se houpe spodním koncem.
// Modely se náhodně míchají: každý patří do několika skupin (útes, stěna, visící). Nové popínavky si drží
// proporce (keep). Kromě svislých visí liany i vodorovně (drape, podél hrany) a do U mezi dvěma body
// (swag, girlanda podél hrany útesu a přes vchod do jeskyně).
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../../data/catalogs/assetPaths.js';
import { flowerTemplate } from '../../utils/flowerFactory.js';
import { loadModel } from '../../utils/assetLoader.js';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { CLIFF_STONE_MAX_OUT } from './terrainSettings.js';
import { DOOR_OPEN_HALF, DOOR_OPEN_HEIGHT } from '../../data/maps/areaShape.js';
import TreeWindPlugin from '../flora/treeWindPlugin.js';

const CHUNK_WORLD = CELL_SIZE * 8;
const VIEW_MARGIN = 6;
const VIEW_HYSTERESIS = 4;
const VINE_MODELS = [
  { url: `${ASSET_DIRS.plants}cliff_vine.glb`, span: 0.9, lift: 0.1, press: 0, turn: 0.4, pools: ['cliff', 'hang'] },
  { url: `${ASSET_DIRS.plants}cliff_vine_2.glb`, span: 0.85, lift: 0.02, press: 1, turn: 0, pools: ['cliff', 'hang', 'wall'] },
  { url: `${ASSET_DIRS.plants}vine_wall.glb`, span: 1, lift: 0, press: 1, turn: 0, pools: ['wall', 'cliff'], keep: 1.5 },
  { url: `${ASSET_DIRS.plants}vine_hang.glb`, span: 1, lift: 0, press: 0.6, turn: 1.2, pools: ['hang', 'cliff'], keep: 1.4 },
];
const KEEP_LENGTH = [0.7, 3.2];
const KEEP_THICK = [0.7, 1.3];
const EDGE_DRAPE = 0.2;
const EDGE_DRAPE_SPAN = [1, 2.4];
const DRAPE_DROOP = [0.05, 0.35];
const DRAPE_SHARE = [0.6, 1];
const SWAG_SAG = [0.2, 0.45];
const EDGE_SWAG = 0.15;
const EDGE_SWAG_SPAN = [1.2, 2.6];
const DOOR_SWAG = 0.7;
const DOOR_SWAG_SAG = [0.12, 0.25];
const VINE_YAW = 0;
const EDGE_CHANCE = 0.3;
const TERRACE_CHANCE = 0.45;
const WIDTH_RANGE = [0.6, 1.5];
const LENGTH_RANGE = [0.75, 1.35];
const DOOR_VINES = [3, 5];
const DOOR_SPREAD = DOOR_OPEN_HALF + 0.15;
const DOOR_OUT = CLIFF_STONE_MAX_OUT * 0.6;
const DOOR_ABOVE = 0.15;
const DOOR_WIDTH = [0.4, 0.8];
const DOOR_DROP = [0.3, 0.6];
const WALL_CHANCE = 0.4;
const WALL_WIDTH = [0.5, 1.1];
const WALL_DROP = [0.35, 0.85];
const WIND_STRENGTH = 0.08;
const MIN_DROP = 0.6;
const DROP_SHARE = 0.9;
const TOP_OVERLAP = 0.05;
const EDGE_OUT = CLIFF_STONE_MAX_OUT * 0.6;
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
    this.places = {};
    this.chunks = [];
    Promise.all(VINE_MODELS.map((model) => loadModel(this.s, model.url))).then((templates) => {
      this.vines = templates.map((template, index) => this.vineFor(template, index, VINE_MODELS[index])).filter(Boolean);
      if (this.vines.length) this.create(this.places);
    });
  }

  vineFor(template, index, model) {
    const source = template && template.getChildMeshes ? template.getChildMeshes()[0] : null;
    if (!source) return null;
    const mesh = source.clone(`cliffVine_${index}`, null, false);
    mesh.parent = null;
    mesh.bakeCurrentTransformIntoVertices();
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    const height = Math.max(0.01, box.maximum.y - box.minimum.y);
    if (mesh.material) new TreeWindPlugin(mesh.material, { strength: WIND_STRENGTH, height, hangFrom: box.maximum.y });
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    return {
      mesh,
      top: box.maximum.y,
      back: Math.max(0, -box.minimum.z),
      widest: model.span / Math.max(0.01, box.maximum.x - box.minimum.x),
      lift: model.lift,
      press: model.press,
      turn: model.turn,
      pools: model.pools,
      keep: model.keep || 0,
      height,
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

  create(places) {
    this.places = places || {};
    const { edges = [], terraces = [], doors = [], walls = [] } = this.places;
    for (const vine of this.vines) vine.matrices = [];
    for (const flower of this.flowers) flower.matrices = [];
    for (const anchor of edges) {
      this.placeFlowers(anchor);
      this.placeVine(anchor, EDGE_CHANCE, EDGE_OUT);
    }
    for (const anchor of terraces) this.placeVine(anchor, TERRACE_CHANCE, 0);
    for (const door of doors) this.placeDoor(door);
    for (const anchor of walls) this.placeWall(anchor);
    this.buildChunks();
    for (const flower of this.flowers) this.flush(flower.mesh, flower.matrices);
  }

  buildChunks() {
    const byArea = new Map();
    this.vines.forEach((vine, vineIndex) => {
      for (const matrix of vine.matrices) {
        const origin = matrix.getTranslation();
        const areaX = Math.floor(origin.x / CHUNK_WORLD);
        const areaZ = Math.floor(origin.z / CHUNK_WORLD);
        const key = `${vineIndex}|${areaX}|${areaZ}`;
        if (!byArea.has(key)) byArea.set(key, { vineIndex, minX: areaX * CHUNK_WORLD, minZ: areaZ * CHUNK_WORLD, matrices: [], enabled: true });
        byArea.get(key).matrices.push(matrix);
      }
    });
    this.chunks = [...byArea.values()];
    this.showChunks();
  }

  showChunks() {
    this.vines.forEach((vine, vineIndex) => {
      const shown = [];
      for (const chunk of this.chunks) {
        if (chunk.enabled && chunk.vineIndex === vineIndex) shown.push(...chunk.matrices);
      }
      this.flush(vine.mesh, shown);
    });
  }

  updateView(view) {
    if (!view) return;
    const inner = view.radius + VIEW_MARGIN;
    const outer = inner + VIEW_HYSTERESIS;
    let changed = false;
    for (const chunk of this.chunks) {
      const dx = Math.max(chunk.minX - view.x, 0, view.x - (chunk.minX + CHUNK_WORLD));
      const dz = Math.max(chunk.minZ - view.z, 0, view.z - (chunk.minZ + CHUNK_WORLD));
      const distance = Math.hypot(dx, dz);
      const enabled = chunk.enabled ? distance <= outer : distance <= inner;
      if (enabled === chunk.enabled) continue;
      chunk.enabled = enabled;
      changed = true;
    }
    if (changed) this.showChunks();
  }

  vineAt(x, z, salt, pool = 'cliff') {
    const list = this.vines.filter((vine) => vine.pools.includes(pool));
    const from = list.length ? list : this.vines;
    return from[Math.floor(hash(x, z, salt, 11) * from.length) % from.length];
  }

  keepSize(vine, anchor, salt, maxLength) {
    return {
      width: between(KEEP_THICK, hash(anchor.x, anchor.z, salt, 12)),
      length: Math.min(maxLength, between(KEEP_LENGTH, hash(anchor.x, anchor.z, salt, 13))) / vine.height,
    };
  }

  placeVine(anchor, chance, out) {
    if (!this.vines.length) return;
    const drop = Number.isFinite(anchor.drop) ? anchor.drop : 0;
    if ((anchor.depth || 0) < MIN_SHELF_DEPTH || drop < MIN_DROP) return;
    if (hash(anchor.x, anchor.z, 1) > chance) return;
    const vine = this.vineAt(anchor.x, anchor.z, 0, 'cliff');
    const along = { x: -anchor.dirZ, z: anchor.dirX };
    const shape = hash(anchor.x, anchor.z, 9);
    if (shape < EDGE_SWAG) {
      this.swag(vine, anchor, along, between(EDGE_SWAG_SPAN, hash(anchor.x, anchor.z, 10)), 0, out, SWAG_SAG);
      return;
    }
    if (shape < EDGE_SWAG + EDGE_DRAPE) {
      this.drape(vine, anchor, along, between(EDGE_DRAPE_SPAN, hash(anchor.x, anchor.z, 10)), 0, out);
      return;
    }
    if (vine.keep) {
      const size = this.keepSize(vine, anchor, 0, drop * DROP_SHARE);
      this.hang(vine, anchor, size.width, size.length, 0, out);
      return;
    }
    const width = Math.min(between(WIDTH_RANGE, hash(anchor.x, anchor.z, 4)), vine.widest);
    const length = Math.min(width * between(LENGTH_RANGE, hash(anchor.x, anchor.z, 5)), (drop * DROP_SHARE) / vine.height);
    this.hang(vine, anchor, width, length, 0, out);
  }

  placeWall(anchor) {
    if (!this.vines.length || hash(anchor.x, anchor.z, 2) > (anchor.chance ?? WALL_CHANCE)) return;
    const vine = this.vineAt(anchor.x, anchor.z, 3, anchor.look || 'hang');
    const out = anchor.out || 0;
    const along = { x: anchor.alongX || 0, z: anchor.alongZ || 0 };
    if (anchor.shape === 'drape') {
      this.drape(vine, anchor, along, anchor.span * between(DRAPE_SHARE, hash(anchor.x, anchor.z, 8)), 5, out);
      return;
    }
    if (vine.keep) {
      const size = this.keepSize(vine, anchor, 2, anchor.drop * 0.95);
      this.hang(vine, anchor, size.width, size.length, 2, out);
      return;
    }
    const wanted = (anchor.drop * between(WALL_DROP, hash(anchor.x, anchor.z, 7))) / vine.height;
    const width = Math.min(between(WALL_WIDTH, hash(anchor.x, anchor.z, 6)), vine.widest);
    this.hang(vine, anchor, width, Math.min(wanted, width * LENGTH_RANGE[1] * 1.6), 2, out);
  }

  sideSize(vine, anchor, salt, length) {
    if (vine.keep) return { width: between(KEEP_THICK, hash(anchor.x, anchor.z, salt, 12)), length: length / vine.height };
    return { width: Math.min(between(WALL_WIDTH, hash(anchor.x, anchor.z, salt, 6)), vine.widest), length: length / vine.height };
  }

  drape(vine, anchor, along, span, salt, out) {
    const size = this.sideSize(vine, anchor, salt, span);
    const roll = Math.PI / 2 - between(DRAPE_DROOP, hash(anchor.x, anchor.z, salt, 14));
    this.hang(vine, anchor, size.width, size.length, salt, out, roll, along);
  }

  swag(vine, anchor, along, span, salt, out, sagRange) {
    const sag = span * between(sagRange, hash(anchor.x, anchor.z, salt, 15));
    const half = span / 2;
    const reach = Math.hypot(half, sag);
    const roll = Math.atan2(half, sag);
    const size = this.sideSize(vine, anchor, salt, reach);
    this.hang(vine, anchor, size.width, size.length, salt, out, roll, along);
    const other = { ...anchor, x: anchor.x + along.x * span, z: anchor.z + along.z * span };
    const partner = this.vineAt(other.x, other.z, salt + 1, 'cliff');
    const second = this.sideSize(partner, other, salt + 1, reach);
    this.hang(partner, other, second.width, second.length, salt + 1, out, roll, { x: -along.x, z: -along.z });
  }

  placeDoor(door) {
    if (!this.vines.length) return;
    const top = Math.min(door.top, Math.min(door.floor, door.ground) + DOOR_OPEN_HEIGHT);
    const opening = top - Math.max(door.floor, door.ground);
    if (!(opening > MIN_DROP)) return;
    if (hash(door.cx, door.cz, door.dx, door.dz, 7) < DOOR_SWAG) {
      const anchor = {
        x: (door.cx + door.dx / 2) * CELL_SIZE + door.dx * DOOR_OUT + door.dz * DOOR_SPREAD,
        y: top + DOOR_ABOVE,
        z: (door.cz + door.dz / 2) * CELL_SIZE + door.dz * DOOR_OUT - door.dx * DOOR_SPREAD,
        dirX: door.dx,
        dirZ: door.dz,
      };
      const vine = this.vineAt(anchor.x, anchor.z, 20, 'cliff');
      this.swag(vine, anchor, { x: -door.dz, z: door.dx }, DOOR_SPREAD * 2, 20, 0, DOOR_SWAG_SAG);
    }
    const total = DOOR_VINES[0] + Math.floor(hash(door.cx, door.cz, door.dx, door.dz, 1) * (DOOR_VINES[1] - DOOR_VINES[0] + 1));
    for (let index = 0; index < total; index += 1) {
      const slot = total > 1 ? index / (total - 1) : 0.5;
      const across = (slot * 2 - 1) * DOOR_SPREAD + (hash(door.cx, door.cz, index, 2) - 0.5) * 0.25;
      const anchor = {
        x: (door.cx + door.dx / 2) * CELL_SIZE + door.dx * DOOR_OUT - door.dz * across,
        y: top + DOOR_ABOVE,
        z: (door.cz + door.dz / 2) * CELL_SIZE + door.dz * DOOR_OUT + door.dx * across,
        dirX: door.dx,
        dirZ: door.dz,
      };
      const vine = this.vineAt(anchor.x, anchor.z, index, 'cliff');
      const wanted = opening * between(DOOR_DROP, hash(anchor.x, anchor.z, index, 5));
      if (vine.keep) {
        const size = this.keepSize(vine, anchor, index, wanted);
        this.hang(vine, anchor, size.width, size.length, index, 0);
        continue;
      }
      const width = Math.min(between(DOOR_WIDTH, hash(anchor.x, anchor.z, index, 4)), vine.widest);
      this.hang(vine, anchor, width, Math.min(wanted / vine.height, width * LENGTH_RANGE[1]), index, 0);
    }
  }

  hang(vine, anchor, width, length, salt, out, roll = 0, along = null) {
    const yaw = Math.atan2(anchor.dirX, anchor.dirZ) + VINE_YAW + (hash(anchor.x, anchor.z, salt, 3) - 0.5) * vine.turn * (roll ? 0.2 : 1);
    const across = vine.keep ? length * vine.keep * width : width;
    let turn = Quaternion.RotationYawPitchRoll(yaw, 0, roll);
    if (roll && along) {
      const down = new Vector3(0, -1, 0).applyRotationQuaternion(turn);
      if (down.x * along.x + down.z * along.z < 0) turn = Quaternion.RotationYawPitchRoll(yaw, 0, -roll);
    }
    const gap = out + vine.back * across * vine.press;
    const pivot = new Vector3(0, (vine.top - vine.lift * vine.height) * length, 0).applyRotationQuaternion(turn);
    const position = new Vector3(
      anchor.x + anchor.dirX * gap - pivot.x,
      anchor.y + TOP_OVERLAP - pivot.y,
      anchor.z + anchor.dirZ * gap - pivot.z,
    );
    vine.matrices.push(Matrix.Compose(new Vector3(across, length, across), turn, position));
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
    mesh.thinInstanceSetBuffer('matrix', buffer, 16, false);
    mesh.setEnabled(true);
  }

  dispose() {
    this.chunks = [];
    for (const vine of this.vines) vine.mesh.dispose(false, false);
    for (const flower of this.flowers) flower.mesh.dispose(false, false);
    this.vines = [];
    this.flowers = [];
  }
}
