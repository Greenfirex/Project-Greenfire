// Rybka složená z protáhlého těla a ploutví — malý tvar, který hejno jen kopíruje.
// Šablona se staví jednou pro každý typ rybky, hejno z ní dělá jen matice.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { createBuffer, buildMesh, pushVertex } from './meshBuilder.js';
import { getFishType, fishSize } from '../data/catalogs/fish.js';

const templates = new WeakMap();

export function fishTemplate(scene, kind) {
  let byKind = templates.get(scene);
  if (!byKind) {
    byKind = new Map();
    templates.set(scene, byKind);
  }
  const cached = byKind.get(kind);
  if (cached && !cached.isDisposed()) return cached;
  const type = getFishType(kind);
  const built = buildFish(scene, kind, type);
  byKind.set(kind, built);
  return built;
}

function buildFish(scene, kind, type) {
  const buffer = createBuffer();
  const size = fishSize(type);
  fillBody(buffer, type, size);
  fillFin(buffer, type, size, [[-0.5, 0], [-0.88, 0.95], [-0.5, 0.35], [-0.88, -0.95]]);
  fillFin(buffer, type, size, [[0.08, 0.32], [-0.18, 0.92], [-0.3, 0.3]]);
  finishNormals(buffer);
  return buildMesh(scene, `fishBody_${kind}`, buffer, fishMaterial(scene, kind));
}

function fillBody(buffer, type, size) {
  const rings = 6;
  const sides = 8;
  const half = size.length * 0.5;
  const grid = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const t = ring / rings;
    const profile = Math.pow(Math.sin(Math.PI * (0.12 + 0.78 * t)), 0.85);
    const x = -half + size.length * t;
    const radiusY = size.height * 0.5 * profile;
    const radiusZ = size.width * 0.5 * profile;
    const row = [];
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const up = Math.sin(angle);
      const point = new Vector3(x, up * radiusY, Math.cos(angle) * radiusZ);
      const mix = (up + 1) * 0.5;
      const color = new Color3(
        type.bellyTint[0] + (type.bodyTint[0] - type.bellyTint[0]) * mix,
        type.bellyTint[1] + (type.bodyTint[1] - type.bellyTint[1]) * mix,
        type.bellyTint[2] + (type.bodyTint[2] - type.bellyTint[2]) * mix,
      );
      row.push(pushVertex(buffer, point, Vector3.Up(), color, side / sides, t));
    }
    grid.push(row);
  }
  for (let ring = 0; ring < rings; ring += 1) {
    for (let side = 0; side < sides; side += 1) {
      const a = grid[ring][side];
      const b = grid[ring][(side + 1) % sides];
      const c = grid[ring + 1][(side + 1) % sides];
      const d = grid[ring + 1][side];
      buffer.indices.push(a, b, c, a, c, d);
    }
  }
  const body = new Color3(type.bodyTint[0], type.bodyTint[1], type.bodyTint[2]);
  const nose = pushVertex(buffer, new Vector3(half, 0, 0), new Vector3(1, 0, 0), body, 0.5, 1);
  for (let side = 0; side < sides; side += 1) {
    buffer.indices.push(grid[rings][side], grid[rings][(side + 1) % sides], nose);
  }
  const tail = pushVertex(buffer, new Vector3(-half, 0, 0), new Vector3(-1, 0, 0), body, 0.5, 0);
  for (let side = 0; side < sides; side += 1) {
    buffer.indices.push(grid[0][(side + 1) % sides], grid[0][side], tail);
  }
}

function fillFin(buffer, type, size, shape) {
  const color = new Color3(type.finTint[0], type.finTint[1], type.finTint[2]);
  const points = shape.map(([x, y]) => new Vector3(x * size.length, y * size.height, 0));
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = pushVertex(buffer, points[0], new Vector3(0, 1, 0), color, 0, 0);
    const b = pushVertex(buffer, points[index], new Vector3(0, 1, 0), color, 0.5, 0.5);
    const c = pushVertex(buffer, points[index + 1], new Vector3(0, 1, 0), color, 1, 1);
    buffer.indices.push(a, b, c);
  }
}

function finishNormals(buffer) {
  let normals = [];
  VertexData.ComputeNormals(buffer.positions, buffer.indices, normals);
  const count = buffer.positions.length / 3;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let vertex = 0; vertex < count; vertex += 1) {
    cx += buffer.positions[vertex * 3];
    cy += buffer.positions[vertex * 3 + 1];
    cz += buffer.positions[vertex * 3 + 2];
  }
  cx /= count;
  cy /= count;
  cz /= count;
  let score = 0;
  for (let vertex = 0; vertex < count; vertex += 1) {
    score += normals[vertex * 3] * (buffer.positions[vertex * 3] - cx)
      + normals[vertex * 3 + 1] * (buffer.positions[vertex * 3 + 1] - cy)
      + normals[vertex * 3 + 2] * (buffer.positions[vertex * 3 + 2] - cz);
  }
  if (score < 0) {
    for (let index = 0; index < buffer.indices.length; index += 3) {
      const swap = buffer.indices[index + 1];
      buffer.indices[index + 1] = buffer.indices[index + 2];
      buffer.indices[index + 2] = swap;
    }
    normals = [];
    VertexData.ComputeNormals(buffer.positions, buffer.indices, normals);
  }
  buffer.normals = normals;
}

function fishMaterial(scene, kind) {
  const material = new StandardMaterial(`fishMat_${kind}`, scene);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0.35, 0.38, 0.4);
  material.ambientColor = new Color3(0.18, 0.2, 0.22);
  material.backFaceCulling = false;
  return material;
}
