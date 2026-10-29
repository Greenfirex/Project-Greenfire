// Společné skládání modelů z čísel — používají ho stromy i kameny.
// Drží jen surovou geometrii a mezipaměť šumu, o vzhledu rozhoduje volající.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';

export function createBuffer() {
  return { positions: [], normals: [], colors: [], uvs: [], indices: [] };
}

export function pushVertex(buffer, point, normal, color, u, v) {
  buffer.positions.push(point.x, point.y, point.z);
  buffer.normals.push(normal.x, normal.y, normal.z);
  buffer.colors.push(color.r, color.g, color.b, 1);
  buffer.uvs.push(u, v);
  return buffer.positions.length / 3 - 1;
}

export function buildMesh(scene, name, buffer, material) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = buffer.positions;
  data.normals = buffer.normals;
  data.colors = buffer.colors;
  data.uvs = buffer.uvs;
  data.indices = buffer.indices;
  data.applyToMesh(mesh);
  mesh.hasVertexAlpha = false;
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.material = material;
  return mesh;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
