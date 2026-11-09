// Skalní rám kolem vchodů do jeskyní — kameny po stranách otvoru, přes jeho horní hranu a u paty.
// Skládá se sám z vchodů, které zná terén; nic se neukládá a každý vchod je jiný, ale pokaždé stejný.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { rockTemplate } from '../../utils/rockFactory.js';

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
const SIDE_ACROSS = 1.02;
const SIDE_OUT = 0.15;
const STACK_OVERLAP = 0.8;
const STACK_LIMIT = 8;
const SINK = 0.08;
const TOP_MARGIN = 0.3;
const TOP_OUT = 0.12;
const TOP_SPACING = 0.4;
const TOP_REACH = 0.8;
const TOP_EMBED = 0;
const FOOT_ACROSS = 0.72;
const FOOT_OUT = 0.45;
const SCALE_JITTER = 0.15;
const PLACE_JITTER = 0.08;

function hash(...values) {
  let h = 2166136261;
  for (const value of values) {
    h ^= Math.round(value * 1000) | 0;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 65536) / 65536;
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
    const source = rockTemplate(this.s, key).getChildMeshes()[0];
    const mesh = source.clone(`caveFrame_${door.style}_${key}`, null, false);
    mesh.makeGeometryUnique();
    mesh.material = this.materialFor(door.style);
    mesh.parent = null;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    mesh.refreshBoundingInfo();
    const box = mesh.getBoundingInfo().boundingBox;
    const stone = { mesh, height: box.maximum.y - box.minimum.y, matrices: [] };
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
    let index = 0;
    for (let across = -TOP_REACH; across <= TOP_REACH + 1e-3; across += TOP_SPACING) {
      const spec = TOP_STONES[index % TOP_STONES.length];
      const stone = this.stoneFor(door, spec.key);
      const scale = this.scaleOf(spec, door, across, 1);
      this.put(stone, door, across, TOP_OUT, door.top - stone.height * scale * TOP_EMBED, scale, index + 100);
      index += 1;
    }
  }

  frameSide(door, side, base) {
    let y = base - SINK;
    const top = door.top - TOP_MARGIN;
    for (let index = 0; index < STACK_LIMIT && y < top; index += 1) {
      const spec = SIDE_STONES[index % SIDE_STONES.length];
      const stone = this.stoneFor(door, spec.key);
      const scale = this.scaleOf(spec, door, side, index);
      const across = side * (SIDE_ACROSS + (hash(door.cx, door.cz, side, index, 2) - 0.5) * PLACE_JITTER * 2);
      const out = SIDE_OUT + (hash(door.cx, door.cz, side, index, 3) - 0.5) * PLACE_JITTER * 2;
      this.put(stone, door, across, out, y, scale, index + side * 10);
      y += stone.height * scale * STACK_OVERLAP;
    }
    const foot = this.stoneFor(door, FOOT_STONE.key);
    this.put(foot, door, side * FOOT_ACROSS, FOOT_OUT, base - SINK, this.scaleOf(FOOT_STONE, door, side, 50), side * 50);
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
