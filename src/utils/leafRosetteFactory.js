// Skládá růžici listů pro rostlinu na poličce útesu — každý list je prohnutý pás.
// Listy se rozdělují do tří vrstev, takže se v trsu střídají tři tvary.
import { mulberry32 } from './meshBuilder.js';

const SEGMENTS = 3;
const LEAF_COUNT = 20;
const LEAF_LAYERS = 3;

function create() {
  return { positions: [], uvs: [], normals: [], indices: [], colors: [] };
}

function blade(out, spec) {
  const sideX = -spec.outZ;
  const sideZ = spec.outX;
  const normalX = spec.outX * 0.35;
  const normalZ = spec.outZ * 0.35;
  const normalY = 0.9;
  const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
  const grid = [];
  for (let step = 0; step <= SEGMENTS; step += 1) {
    const t = step / SEGMENTS;
    const half = spec.width * 0.5 * (1 - spec.taper * t);
    const reach = spec.length * t;
    const bow = spec.bend * spec.length * t * t - spec.curl * spec.length * t * t * t;
    const cx = spec.x + spec.dirX * reach + spec.outX * bow;
    const cy = spec.y + spec.dirY * reach;
    const cz = spec.z + spec.dirZ * reach + spec.outZ * bow;
    const shade = spec.shadeFrom + (spec.shadeTo - spec.shadeFrom) * t;
    grid.push([
      [cx - sideX * half, cy, cz - sideZ * half, 0, t, shade],
      [cx + sideX * half, cy, cz + sideZ * half, 1, t, shade],
    ]);
  }
  for (const row of grid) {
    for (const point of row) {
      out.positions.push(point[0], point[1], point[2]);
      out.uvs.push(point[3], point[4]);
      out.normals.push(normalX / normalLength, normalY / normalLength, normalZ / normalLength);
      out.colors.push(point[5], point[5], point[5], 1);
    }
  }
  const base = out.positions.length / 3 - grid.length * 2;
  for (let step = 0; step < grid.length - 1; step += 1) {
    const a = base + step * 2;
    out.indices.push(a, a + 3, a + 1, a, a + 2, a + 3);
  }
}

export function createCliffLeafGeometry(layer, seed = 1) {
  const rng = mulberry32(seed * 31 + layer * 7);
  const out = create();
  for (let index = 0; index < LEAF_COUNT; index += 1) {
    if (index % LEAF_LAYERS !== layer) continue;
    const yaw = (index / LEAF_COUNT) * Math.PI * 2 + (rng() - 0.5) * 0.8;
    const pitch = 0.25 + rng() * 0.85;
    const length = 0.24 + rng() * 0.2;
    const width = length * (0.5 + rng() * 0.22);
    const outX = Math.cos(yaw);
    const outZ = Math.sin(yaw);
    blade(out, {
      x: outX * 0.035,
      y: 0.01 + rng() * 0.04,
      z: outZ * 0.035,
      dirX: outX * Math.sin(pitch),
      dirY: Math.cos(pitch),
      dirZ: outZ * Math.sin(pitch),
      outX,
      outZ,
      length,
      width,
      taper: 0.12,
      bend: 0.05,
      curl: 0.14,
      shadeFrom: 0.88,
      shadeTo: 1.05,
    });
  }
  return out;
}