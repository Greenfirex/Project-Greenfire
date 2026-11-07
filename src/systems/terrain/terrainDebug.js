// Ladicí pohledy terénu — barevné pásky na rozích útesů (?corners) a hmota jako kostky (?solid).
// Ve hře se nezapínají; terén je přidá jen podle adresy stránky.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { buildCornerEdges } from '../../utils/terrainCorners.js';
import { buildRunBlocks } from './runBlocks.js';

const CORNER_DEBUG_LIFT = 0.06;
const CORNER_DEBUG_WIDTH = 0.03;
const CORNER_DEBUG_COLORS = {
  corner: [1, 0.16, 0.08],
  inner: [0.2, 0.5, 1],
  diagonal: [1, 0.85, 0.1],
};

function appendCornerRibbon(group, px, pz, y0, y1) {
  const width = CORNER_DEBUG_WIDTH;
  const start = group.positions.length / 3;
  group.positions.push(
    px, y0, pz - width, px, y1, pz - width, px, y1, pz + width, px, y0, pz + width,
    px - width, y0, pz, px + width, y0, pz, px + width, y1, pz, px - width, y1, pz,
  );
  group.indices.push(
    start, start + 1, start + 2, start, start + 2, start + 3,
    start + 4, start + 5, start + 6, start + 4, start + 6, start + 7,
  );
}

function cornerDebugMaterial(terrain, kind) {
  const cacheKey = `cornerDebug|${kind}`;
  const cached = terrain.materials.get(cacheKey);
  if (cached) return cached;
  const rgb = CORNER_DEBUG_COLORS[kind] || [1, 1, 1];
  const material = new StandardMaterial(`terrainCornerDebugMat_${kind}`, terrain.s);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.diffuseColor = new Color3(rgb[0], rgb[1], rgb[2]);
  material.emissiveColor = new Color3(rgb[0], rgb[1], rgb[2]);
  terrain.materials.set(cacheKey, material);
  return material;
}

export function buildCornerDebugMeshes(terrain) {
  const edges = buildCornerEdges(terrain.layout || {}, {
    runs: terrain.solidRuns(),
    hardEdge: (cx, cz, dx, dz) => terrain.hardEdgeAt(cx, cz, dx, dz),
  });
  const groups = new Map();
  for (const edge of edges) {
    if (edge.kind === 'seam') continue;
    let group = groups.get(edge.kind);
    if (!group) {
      group = { positions: [], indices: [] };
      groups.set(edge.kind, group);
    }
    const px = edge.gx + edge.outX * CORNER_DEBUG_LIFT;
    const pz = edge.gz + edge.outZ * CORNER_DEBUG_LIFT;
    appendCornerRibbon(group, px, pz, edge.y0, edge.y1);
  }
  const meshes = [];
  for (const [kind, group] of groups) {
    if (!group.positions.length) continue;
    const mesh = new Mesh(`terrainCornerDebug_${kind}`, terrain.s);
    const data = new VertexData();
    data.positions = group.positions;
    data.indices = group.indices;
    data.normals = [];
    VertexData.ComputeNormals(group.positions, group.indices, data.normals);
    data.applyToMesh(mesh);
    mesh.material = cornerDebugMaterial(terrain, kind);
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.metadata = { cornerDebug: true, kind };
    meshes.push(mesh);
  }
  return meshes;
}

export function buildSolidBlockMesh(terrain, world, tile) {
  const blocks = buildRunBlocks(world, { cellSize: CELL_SIZE, tile });
  if (!blocks) return null;
  const mesh = new Mesh('terrainRunBlocks', terrain.s);
  const data = new VertexData();
  data.positions = blocks.positions;
  data.indices = blocks.indices;
  data.uvs = blocks.uvs;
  data.colors = blocks.colors;
  data.normals = [];
  VertexData.ComputeNormals(blocks.positions, blocks.indices, data.normals);
  data.applyToMesh(mesh);
  mesh.setVerticesData('mossMask', new Float32Array(blocks.positions.length / 3), false, 1);
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.material = terrain.cliffMaterialFor('stone');
  return mesh;
}
