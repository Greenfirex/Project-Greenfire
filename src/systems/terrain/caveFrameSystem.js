// Skalní rám kolem vchodů do jeskyní — kameny po stranách otvoru, přes jeho horní hranu a u paty.
// Skládá se sám z vchodů, které zná terén; nic se neukládá a každý vchod je jiný, ale pokaždé stejný.
// Kameny zužují a snižují otvor na rozměr z areaShape.js (stejný hlídá chůze) a vrhají stín.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { rockRoot } from '../../utils/rockFactory.js';
import { DOOR_OPEN_HALF, DOOR_OPEN_HEIGHT } from '../../data/maps/areaShape.js';
import { CLIFF_STONE_MAX_OUT } from './terrainSettings.js';

const SIDE_STONES = [
  { key: 'boulder_large_c', scale: 0.75 },
  { key: 'boulder_tall', scale: 0.9 },
  { key: 'boulder_tall', scale: 0.7 },
  { key: 'boulder_small', scale: 1 },
];
const TOP_STONES = [
  { key: 'boulder_small', scale: 1.1 },
  { key: 'boulder_large', scale: 0.55 },
  { key: 'boulder_small', scale: 0.9 },
];
const FOOT_STONE = { key: 'boulder_small', scale: 0.55 };
const ARCH_STONE = { key: 'boulder_small', scale: 0.6 };
const ARCH_ANGLES = [0.3, 0.75, 1.15];
const STACK_OVERLAP = 0.8;
const STACK_LIMIT = 8;
const SINK = 0.08;
const TOP_MARGIN = 0.3;
const TOP_SPACING = 0.4;
const TOP_REACH = 0.8;
const TOP_ROW = 0.35;
const SCALE_JITTER = 0.15;
const PLACE_JITTER = 0.08;
const EDGE_SALT = 21;

function hash(...values) {
  let h = 2166136261;
  for (const value of values) {
    h ^= Math.round(value * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 65536) / 65536;
}

function flushOut(stone, scale) {
  return CLIFF_STONE_MAX_OUT - stone.half * scale;
}

export default class CaveFrameSystem {

  constructor(scene) {
    this.s = scene;
    this.stones = new Map();
    this.materialFor = null;
  }

  stoneFor(door, key) {
    const id = `${door.style}|${key}`;
    const known = this.stones.get(id);
    if (known) return known;
    const root = rockRoot(this.s, key);
    const source = root ? root.getChildMeshes()[0] : null;
    if (!source) return null;
    const mesh = source.clone(`caveFrame_${door.style}_${key}`, null, false);
    mesh.makeGeometryUnique();
    mesh.material = this.materialFor(door.style, source.material);
    mesh.parent = null;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    mesh.refreshBoundingInfo();
    mesh.receiveShadows = true;
    mesh.metadata = { ...(mesh.metadata || {}), shadowAlways: true };
    const box = mesh.getBoundingInfo().boundingBox;
    const half = (Math.max(box.maximum.x, -box.minimum.x) + Math.max(box.maximum.z, -box.minimum.z)) / 2;
    const stone = { mesh, height: box.maximum.y - box.minimum.y, half, matrices: [] };
    this.stones.set(id, stone);
    return stone;
  }

  create(doors, materialFor) {
    this.materialFor = materialFor;
    for (const stone of this.stones.values()) stone.matrices = [];
    for (const door of doors || []) this.frameDoor(door);
    for (const stone of this.stones.values()) this.flush(stone);
  }

  frameDoor(door) {
    const base = Math.min(door.floor, door.ground);
    if (!door.openLeft) this.frameSide(door, 1, base);
    if (!door.openRight) this.frameSide(door, -1, base);
    const openTop = Math.min(door.top, base + DOOR_OPEN_HEIGHT);
    this.frameArch(door, openTop);
    let index = 0;
    for (let y = openTop; index === 0 || y < door.top; y += TOP_ROW) {
      for (let across = -TOP_REACH; across <= TOP_REACH + 1e-3; across += TOP_SPACING) {
        const spec = TOP_STONES[index % TOP_STONES.length];
        const stone = this.stoneFor(door, spec.key);
        if (!stone) return;
        const scale = this.scaleOf(spec, door, across, index);
        this.put(stone, door, across, flushOut(stone, scale), y, scale, index + 100);
        index += 1;
      }
    }
  }

  frameArch(door, openTop) {
    const stone = this.stoneFor(door, ARCH_STONE.key);
    if (!stone) return;
    for (const side of [1, -1]) {
      ARCH_ANGLES.forEach((angle, index) => {
        const scale = this.scaleOf(ARCH_STONE, door, side, 60 + index);
        const reach = DOOR_OPEN_HALF + stone.half * scale;
        const across = side * reach * Math.cos(angle);
        const y = openTop - DOOR_OPEN_HALF + reach * Math.sin(angle) - (stone.height * scale) / 2;
        this.put(stone, door, across, flushOut(stone, scale), y, scale, side * (60 + index));
      });
    }
  }

  meshes() {
    return [...this.stones.values()].map((stone) => stone.mesh);
  }

  frameSide(door, side, base) {
    const top = door.top - TOP_MARGIN;
    this.stackSide(door, side, base, top, 0, (stone, scale, index) => (
      DOOR_OPEN_HALF + stone.half * scale + hash(door.cx, door.cz, side, index, 2) * PLACE_JITTER
    ));
    this.stackSide(door, side, base, top, EDGE_SALT, () => CELL_SIZE / 2);
    const foot = this.stoneFor(door, FOOT_STONE.key);
    if (!foot) return;
    const footScale = this.scaleOf(FOOT_STONE, door, side, 50);
    this.put(foot, door, side * (DOOR_OPEN_HALF + foot.half * footScale), flushOut(foot, footScale), base - SINK, footScale, side * 50);
  }

  stackSide(door, side, base, top, salt, reachOf) {
    let y = base - SINK;
    for (let index = 0; index < STACK_LIMIT && y < top; index += 1) {
      const spec = SIDE_STONES[(index + salt) % SIDE_STONES.length];
      const stone = this.stoneFor(door, spec.key);
      if (!stone) return;
      const scale = this.scaleOf(spec, door, side, index + salt);
      const across = side * reachOf(stone, scale, index);
      const out = flushOut(stone, scale) + (hash(door.cx, door.cz, side, index + salt, 3) - 1) * PLACE_JITTER;
      this.put(stone, door, across, out, y, scale, index + salt + side * 10);
      y += stone.height * scale * STACK_OVERLAP;
    }
  }

  scaleOf(spec, door, salt, index) {
    return spec.scale * (1 + (hash(door.cx, door.cz, salt, index, 1) - 0.5) * SCALE_JITTER * 2);
  }

  put(stone, door, across, out, y, scale, salt) {
    const { cx, cz, dx, dz } = door;
    const x = (cx + dx / 2) * CELL_SIZE + dx * out - dz * across;
    const z = (cz + dz / 2) * CELL_SIZE + dz * out + dx * across;
    const yaw = hash(cx, cz, dx, dz, salt) * Math.PI * 2;
    stone.matrices.push(Matrix.Compose(new Vector3(scale, scale, scale), Quaternion.RotationYawPitchRoll(yaw, 0, 0), new Vector3(x, y, z)));
  }

  flush(stone) {
    const total = stone.matrices.length;
    if (!total) {
      stone.mesh.thinInstanceCount = 0;
      stone.mesh.setEnabled(false);
      return;
    }
    const buffer = new Float32Array(total * 16);
    for (let index = 0; index < total; index += 1) stone.matrices[index].copyToArray(buffer, index * 16);
    stone.mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
    stone.mesh.setEnabled(true);
  }
}
