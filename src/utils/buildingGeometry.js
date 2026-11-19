// Tvary pro stavby skládané z mnoha kusů do jednoho tělesa: křivá kláda (i sud z prken), její čelo, prkno a plachta.
// Každý kus dostane barvu po bodech (stáří, mech), celek se pak vytvoří jako jeden model.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

export function createBuffer() {
  return { positions: [], uvs: [], colors: [], indices: [] };
}

function pushVertex(buffer, x, y, z, u, v, color) {
  buffer.positions.push(x, y, z);
  buffer.uvs.push(u, v);
  buffer.colors.push(color[0], color[1], color[2], 1);
  return buffer.positions.length / 3 - 1;
}

export const placeAlongX = (z) => (along, lift, side) => [along, lift, z + side];
export const placeAlongZ = (x) => (along, lift, side) => [x - side, lift, along];
export const placeUpright = (x, z) => (along, lift, side) => [x - lift, along, z + side];

export function roughLog(rng, shape, from, to, lift, radius, span) {
  const bend = Math.min(1, (to - from) / span);
  return {
    from,
    to,
    radius,
    startLift: lift + (rng() - 0.5) * 2 * shape.lift,
    endLift: lift + (rng() - 0.5) * 2 * shape.lift,
    sag: (rng() - 0.65) * 2 * shape.sag * bend,
    bow: (rng() - 0.5) * 2 * shape.bow * bend,
    taper: shape.taper * (rng() < 0.5 ? 1 : -1) * rng(),
    bulge: shape.bulge * rng(),
    bulgeWaves: 1 + Math.floor(rng() * 3),
    bulgePhase: rng() * Math.PI * 2,
    segments: Math.max(2, Math.round(shape.segments * Math.max(0.3, bend))),
    sides: shape.logSides,
    shiftU: rng(),
    shiftV: rng(),
  };
}

export function pushSheet(buffer, cols, rows, pointAt, paint) {
  const start = buffer.positions.length / 3;
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      const point = pointAt(c / cols, r / rows);
      pushVertex(buffer, point[0], point[1], point[2], c / cols, 1 - r / rows, paint(point[0], point[1], point[2], 0));
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = start + r * (cols + 1) + c;
      const b = a + cols + 1;
      buffer.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
}

export function logRings(log) {
  const rings = [];
  for (let i = 0; i <= log.segments; i++) {
    const t = i / log.segments;
    const arch = 4 * t * (1 - t);
    rings.push({
      along: log.from + (log.to - log.from) * t,
      lift: log.startLift + (log.endLift - log.startLift) * t + log.sag * arch,
      side: log.bow * arch,
      radius: log.radius * (1 - log.taper * t) * (1 + log.bulge * Math.sin(t * Math.PI * log.bulgeWaves + log.bulgePhase)),
    });
  }
  return rings;
}

export function pushLog(buffer, log, place, paint, tile) {
  const rings = logRings(log);
  const sides = log.sides;
  const start = buffer.positions.length / 3;
  let travelled = 0;
  for (let i = 0; i < rings.length; i++) {
    const ring = rings[i];
    if (i > 0) travelled += Math.abs(ring.along - rings[i - 1].along);
    for (let k = 0; k <= sides; k++) {
      const angle = (k / sides) * Math.PI * 2;
      const up = Math.sin(angle);
      const across = Math.cos(angle);
      const point = place(ring.along, ring.lift + up * ring.radius, ring.side + across * ring.radius);
      const color = paint(point[0], point[1], point[2], up);
      const uv = log.staves
        ? [(k / sides) * log.staves + log.shiftU, travelled / tile + log.shiftV]
        : [travelled / tile + log.shiftU, (angle * ring.radius) / tile + log.shiftV];
      pushVertex(buffer, point[0], point[1], point[2], uv[0], uv[1], color);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < sides; k++) {
      const a = start + i * row + k;
      const b = a + row;
      buffer.indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  return rings;
}

export function pushLogEnd(buffer, ring, sides, spin, facing, place, paint) {
  const center = place(ring.along, ring.lift, ring.side);
  const middle = pushVertex(buffer, center[0], center[1], center[2], 0.5, 0.5, paint(center[0], center[1], center[2], 0));
  const first = buffer.positions.length / 3;
  for (let k = 0; k <= sides; k++) {
    const angle = (k / sides) * Math.PI * 2;
    const up = Math.sin(angle);
    const point = place(ring.along, ring.lift + up * ring.radius, ring.side + Math.cos(angle) * ring.radius);
    pushVertex(buffer, point[0], point[1], point[2], 0.5 + 0.5 * Math.cos(angle + spin), 0.5 + 0.5 * Math.sin(angle + spin), paint(point[0], point[1], point[2], up));
  }
  for (let k = 0; k < sides; k++) {
    if (facing > 0) buffer.indices.push(middle, first + k, first + k + 1);
    else buffer.indices.push(middle, first + k + 1, first + k);
  }
}

const BOX_FACES = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
];

export function pushBox(buffer, box, paint, tile) {
  const half = [box.size[0] / 2, box.size[1] / 2, box.size[2] / 2];
  const tiltX = box.tiltX || 0;
  const tiltZ = box.tiltZ || 0;
  const yaw = box.yaw || 0;
  const transform = (x, y, z) => {
    const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
    const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);
    const x2 = x * Math.cos(tiltZ) - y1 * Math.sin(tiltZ);
    const y2 = x * Math.sin(tiltZ) + y1 * Math.cos(tiltZ);
    const x3 = x2 * Math.cos(yaw) + z1 * Math.sin(yaw);
    const z3 = -x2 * Math.sin(yaw) + z1 * Math.cos(yaw);
    return [box.center[0] + x3, box.center[1] + y2, box.center[2] + z3];
  };
  for (const face of BOX_FACES) {
    const first = buffer.positions.length / 3;
    const spanU = Math.abs(face.u[0]) * box.size[0] + Math.abs(face.u[1]) * box.size[1] + Math.abs(face.u[2]) * box.size[2];
    const spanV = Math.abs(face.v[0]) * box.size[0] + Math.abs(face.v[1]) * box.size[1] + Math.abs(face.v[2]) * box.size[2];
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const local = [0, 1, 2].map((axis) => face.n[axis] * half[axis] + face.u[axis] * su * half[axis] + face.v[axis] * sv * half[axis]);
      const point = transform(local[0], local[1], local[2]);
      const color = paint(point[0], point[1], point[2], face.n[1]);
      const uv = box.uvMap
        ? box.uvMap(((su + 1) / 2) * spanU, ((sv + 1) / 2) * spanV, spanU, spanV)
        : [((su + 1) / 2) * (spanU / tile) + (box.shiftU || 0), ((sv + 1) / 2) * (spanV / tile) + (box.shiftV || 0)];
      pushVertex(buffer, point[0], point[1], point[2], uv[0], uv[1], color);
    }
    buffer.indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
  }
}

export function meshFromBuffer(name, buffer, scene) {
  if (!buffer.indices.length) return null;
  const data = new VertexData();
  data.positions = buffer.positions;
  data.uvs = buffer.uvs;
  data.colors = buffer.colors;
  data.indices = buffer.indices;
  const normals = [];
  VertexData.ComputeNormals(buffer.positions, buffer.indices, normals);
  data.normals = normals;
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  return mesh;
}
