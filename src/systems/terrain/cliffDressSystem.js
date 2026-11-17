// Skalní kusy na útesech — překrývající se kameny, které rozbijí rovnou stěnu, horní hranu i rohy.
// Skládá se sám ze stran útesů, které zná terén; nic se neukládá a pokaždé to vypadá stejně.
// Stejně obloží i stěny jeskyní (strana s inside: bez teras a mechu).
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { rockRoot } from '../../utils/rockFactory.js';
import { rockModelUrl } from '../../data/catalogs/rocks.js';

const CHUNK_WORLD = CELL_SIZE * 8;
const VIEW_MARGIN = 6;
const VIEW_HYSTERESIS = 4;
const PIECES = {
  stone: {
    wall: ['cliff_stone_wide', 'cliff_stone_tall', 'cliff_stone_slab', 'cliff_stone_wide_b', 'cliff_stone_tall_b', 'cliff_stone_block', 'cliff_stone_ledge', 'cliff_stone_stack'],
    corner: ['cliff_stone_block', 'cliff_stone_tall', 'cliff_stone_tall_b'],
    terrace: 'cliff_stone_slab',
    moss: 0.45,
  },
  dirt: {
    wall: ['cliff_clod_round', 'cliff_clod_wide', 'cliff_clod_tall', 'cliff_clod_pair'],
    corner: ['cliff_clod_round', 'cliff_clod_tall'],
    terrace: 'cliff_clod_wide',
    moss: 0,
  },
};
const TERRACE_MIN_WALL = 2.5;
const TERRACE_CHANCE = 0.3;
const TERRACE_HEIGHT = [0.35, 0.65];
const TERRACE_OUT = [0.4, 0.55];
const TERRACE_WIDE = [0.8, 1.05];
const TERRACE_THICK = 0.6;
const TERRACE_DEEP = [1, 1.25];
const TERRACE_GRASS_SPREAD = 0.4;
const TERRACE_GRASS_EDGE = 0.05;
const CORNER_SCALE = [0.55, 0.72];
const CORNER_OUT = 0.05;
const MIN_WALL = 0.6;
const LOW_WALL = 1.2;
const LOW_WALL_SCALE = 0.7;
const SCALE_RANGE = [0.85, 1.1];
const END_ALONG = -0.55;
const END_SLACK = 0.15;
const STRETCH_WIDE = [0.85, 1.3];
const STRETCH_TALL = [0.8, 1.25];
const STRETCH_DEEP = [0.85, 1.15];
const TILT = 0.28;
const LINTEL_GAP = 0.08;
const MAX_OUT = 0.35;
const MIN_OUT = 0.1;
const SINK = 0.15;
const LIP_MAX = 0.18;
const ROW_OVERLAP = 0.6;
const ROW_LIMIT = 40;
const COLUMNS_EVEN = [-0.5, 0.5];
const COLUMNS_ODD = [-1, 0];
const ALONG_JITTER = 0.15;
const YAW_JITTER = 0.5;
const DOOR_CLEAR = 0.25;

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

export default class CliffDressSystem {

  constructor(scene) {
    this.s = scene;
    this.shapes = new Map();
    this.chunks = [];
    this.pieces = [];
    this.terraceAnchors = [];
  }

  shapeFor(key) {
    const known = this.shapes.get(key);
    if (known) return known;
    const root = rockRoot(this.s, key);
    const source = root ? root.getChildMeshes()[0] : null;
    if (!source) return null;
    const box = source.getBoundingInfo().boundingBox;
    const shape = {
      key,
      source,
      model: Boolean(rockModelUrl(key)),
      height: box.maximum.y - box.minimum.y,
      front: Math.max(box.maximum.z, -box.minimum.z),
      side: Math.max(box.maximum.x, -box.minimum.x),
    };
    this.shapes.set(key, shape);
    return shape;
  }

  create(faces, materialFor) {
    this.disposeChunks();
    this.pieces = [];
    this.terraceAnchors = [];
    const placed = (faces || []).filter((face) => PIECES[face.style] && (face.lintel ? face.top > face.foot : face.top - face.foot >= MIN_WALL));
    const sides = new Set((faces || []).map((face) => `${face.cx},${face.cz}|${face.dx},${face.dz}`));
    for (const face of placed) this.dressFace(face, sides);
    this.dressCorners(placed);
    for (const face of placed) {
      if (face.lintel || face.inside || face.top - face.foot < TERRACE_MIN_WALL) continue;
      if (hash(face.x, face.z, 40) < TERRACE_CHANCE) this.dressTerrace(face);
    }
    this.buildChunks(materialFor);
  }

  dressTerrace(face) {
    const shape = this.shapeFor(PIECES[face.style].terrace);
    if (!shape) return;
    const ledge = face.foot + (face.top - face.foot) * between(TERRACE_HEIGHT, hash(face.x, face.z, 41));
    const scaleX = between(TERRACE_WIDE, hash(face.x, face.z, 42));
    const scaleZ = between(TERRACE_DEEP, hash(face.x, face.z, 43));
    const reachOut = between(TERRACE_OUT, hash(face.x, face.z, 44));
    const out = reachOut - shape.front * scaleZ;
    const alongX = face.dx !== 0 ? 0 : 1;
    const alongZ = face.dx !== 0 ? 1 : 0;
    const along = (hash(face.x, face.z, 45) - 0.5) * 0.4;
    this.pieces.push({
      key: shape.key,
      style: face.style,
      mossy: true,
      scaleX,
      scaleY: TERRACE_THICK,
      scaleZ,
      yaw: Math.atan2(face.dx, face.dz) + (hash(face.x, face.z, 46) - 0.5) * 0.3,
      pitch: 0,
      roll: Math.PI,
      x: face.x + face.dx * out + alongX * along,
      y: ledge,
      z: face.z + face.dz * out + alongZ * along,
    });
    const spread = shape.side * scaleX * TERRACE_GRASS_SPREAD;
    const front = reachOut - TERRACE_GRASS_EDGE;
    for (const step of [-1, 0, 1]) {
      const across = along + step * spread;
      this.terraceAnchors.push({
        x: face.x + face.dx * front + alongX * across,
        y: ledge,
        z: face.z + face.dz * front + alongZ * across,
        dirX: face.dx,
        dirZ: face.dz,
        depth: front,
      });
    }
  }

  dressCorners(faces) {
    const byCell = new Map();
    for (const face of faces) {
      if (face.lintel) continue;
      const id = `${face.cx},${face.cz}`;
      if (!byCell.has(id)) byCell.set(id, []);
      byCell.get(id).push(face);
    }
    for (const list of byCell.values()) {
      for (const first of list) {
        if (first.dx === 0) continue;
        for (const second of list) {
          if (second.dz === 0) continue;
          this.dressCorner({
            style: first.style,
            inside: first.inside,
            x: first.x,
            z: second.z,
            dirX: first.dx * Math.SQRT1_2,
            dirZ: second.dz * Math.SQRT1_2,
            top: Math.min(first.top, second.top),
            foot: Math.max(first.foot, second.foot),
          });
        }
      }
    }
  }

  dressCorner(corner) {
    const keys = PIECES[corner.style].corner;
    const yaw = Math.atan2(corner.dirX, corner.dirZ);
    let y = corner.foot - SINK;
    for (let row = 0; row < ROW_LIMIT; row += 1) {
      const shape = this.shapeFor(keys[Math.floor(hash(corner.x, corner.z, row, 21) * keys.length) % keys.length]);
      if (!shape) return;
      const look = this.lookOf(corner.x, corner.z, row, between(CORNER_SCALE, hash(corner.x, corner.z, row, 7)));
      look.scaleX = Math.min(look.scaleX, look.scaleZ);
      look.pitch = 0;
      look.roll = 0;
      const reach = shape.height * look.scaleY;
      const capped = y + reach * ROW_OVERLAP >= corner.top;
      const out = CORNER_OUT - shape.front * look.scaleZ;
      this.pieces.push({
        ...look,
        key: shape.key,
        style: corner.style,
        mossy: !corner.inside && capped && hash(corner.x, corner.z, row, 31) < PIECES[corner.style].moss,
        yaw: yaw + look.turn,
        x: corner.x + corner.dirX * out,
        y: capped ? corner.top + hash(corner.x, corner.z, row, 9) * LIP_MAX * 0.5 - reach : y,
        z: corner.z + corner.dirZ * out,
      });
      if (capped) return;
      y += reach * ROW_OVERLAP;
    }
  }

  dressFace(face, sides) {
    const pieces = PIECES[face.style];
    const low = face.top - face.foot < LOW_WALL ? LOW_WALL_SCALE : 1;
    const yaw = Math.atan2(face.dx, face.dz);
    const alongX = face.dx !== 0 ? 0 : 1;
    const alongZ = face.dx !== 0 ? 1 : 0;
    const openAt = (step) => !sides.has(`${face.cx + alongX * step},${face.cz + alongZ * step}|${face.dx},${face.dz}`)
      && !sides.has(`${face.cx + alongX * step + face.dx},${face.cz + alongZ * step + face.dz}|${-alongX * step},${-alongZ * step}`);
    const openBefore = openAt(-1);
    const openAfter = openAt(1);
    let y = face.lintel ? face.foot + LINTEL_GAP : face.foot - SINK;
    for (let row = 0; row < ROW_LIMIT; row += 1) {
      const columns = row % 2 ? COLUMNS_ODD : COLUMNS_EVEN;
      let tallest = 0;
      let finished = false;
      columns.forEach((column, index) => {
        const salt = row * 10 + index;
        const shape = this.shapeFor(pieces.wall[Math.floor(hash(face.x, face.z, salt, 1) * pieces.wall.length) % pieces.wall.length]);
        if (!shape) {
          finished = true;
          return;
        }
        const scale = between(SCALE_RANGE, hash(face.x, face.z, salt, 2)) * low;
        const lip = hash(face.x, face.z, salt, 3) * LIP_MAX;
        const look = this.lookOf(face.x, face.z, salt, scale);
        if (face.lintel) look.scaleY = Math.min(look.scaleY, (face.top + lip - face.foot - LINTEL_GAP) / shape.height);
        const reach = shape.height * look.scaleY;
        const capped = y + reach * ROW_OVERLAP >= face.top;
        if (capped) finished = true;
        const along = (openBefore && column <= -1 ? END_ALONG : column) + (hash(face.x, face.z, salt, 4) - 0.5) * ALONG_JITTER * 2;
        tallest = Math.max(tallest, reach);
        if ((face.doorAfter && along > DOOR_CLEAR) || (face.doorBefore && along < -DOOR_CLEAR)) return;
        const towardEnd = (openAfter && along > 0) || (openBefore && along < 0);
        if (towardEnd) look.scaleX = Math.min(look.scaleX, (1 + END_SLACK - Math.abs(along)) / shape.side);
        const out = (towardEnd ? MIN_OUT : between([MIN_OUT, MAX_OUT], hash(face.x, face.z, salt, 5))) - shape.front * look.scaleZ;
        this.pieces.push({
          ...look,
          key: shape.key,
          style: face.style,
          mossy: !face.inside && capped && hash(face.x, face.z, salt, 31) < pieces.moss,
          yaw: yaw + look.turn + (hash(face.x, face.z, salt, 6) - 0.5) * YAW_JITTER,
          x: face.x + face.dx * out + alongX * along,
          y: capped ? face.top + lip - reach : y,
          z: face.z + face.dz * out + alongZ * along,
        });
      });
      if (finished) return;
      y += tallest * ROW_OVERLAP;
    }
  }

  lookOf(x, z, salt, scale) {
    return {
      scaleX: scale * between(STRETCH_WIDE, hash(x, z, salt, 11)),
      scaleY: scale * between(STRETCH_TALL, hash(x, z, salt, 12)),
      scaleZ: scale * between(STRETCH_DEEP, hash(x, z, salt, 13)),
      pitch: (hash(x, z, salt, 14) - 0.5) * TILT,
      roll: (hash(x, z, salt, 15) - 0.5) * TILT,
      turn: hash(x, z, salt, 16) < 0.5 ? 0 : Math.PI,
    };
  }

  buildChunks(materialFor) {
    const byArea = new Map();
    for (const piece of this.pieces) {
      const areaX = Math.floor(piece.x / CHUNK_WORLD);
      const areaZ = Math.floor(piece.z / CHUNK_WORLD);
      const id = `${piece.key}|${piece.style}|${piece.mossy ? 1 : 0}|${areaX}|${areaZ}`;
      if (!byArea.has(id)) byArea.set(id, { key: piece.key, style: piece.style, mossy: piece.mossy, areaX, areaZ, matrices: [] });
      byArea.get(id).matrices.push(Matrix.Compose(
        new Vector3(piece.scaleX, piece.scaleY, piece.scaleZ),
        Quaternion.RotationYawPitchRoll(piece.yaw, piece.pitch, piece.roll),
        new Vector3(piece.x, piece.y, piece.z),
      ));
    }
    for (const area of byArea.values()) {
      const shape = this.shapeFor(area.key);
      const mesh = shape.source.clone(`cliffDress_${area.key}_${area.mossy ? 'moss_' : ''}${area.areaX}_${area.areaZ}`, null, false);
      mesh.makeGeometryUnique();
      mesh.parent = null;
      mesh.material = materialFor(area.style, area.mossy, shape.model ? shape.source.material : null);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      mesh.alwaysSelectAsActiveMesh = true;
      const buffer = new Float32Array(area.matrices.length * 16);
      area.matrices.forEach((matrix, index) => matrix.copyToArray(buffer, index * 16));
      mesh.thinInstanceSetBuffer('matrix', buffer, 16, true);
      mesh.setEnabled(true);
      this.chunks.push({ mesh, minX: area.areaX * CHUNK_WORLD, minZ: area.areaZ * CHUNK_WORLD, enabled: true });
    }
  }

  updateView(view) {
    if (!view) return;
    const inner = view.radius + VIEW_MARGIN;
    const outer = inner + VIEW_HYSTERESIS;
    for (const chunk of this.chunks) {
      const dx = Math.max(chunk.minX - view.x, 0, view.x - (chunk.minX + CHUNK_WORLD));
      const dz = Math.max(chunk.minZ - view.z, 0, view.z - (chunk.minZ + CHUNK_WORLD));
      const distance = Math.hypot(dx, dz);
      const enabled = chunk.enabled ? distance <= outer : distance <= inner;
      if (enabled === chunk.enabled) continue;
      chunk.enabled = enabled;
      chunk.mesh.setEnabled(enabled);
    }
  }

  disposeChunks() {
    for (const chunk of this.chunks) chunk.mesh.dispose(false, false);
    this.chunks = [];
  }
}
