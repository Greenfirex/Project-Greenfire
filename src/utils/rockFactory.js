// Kameny pro obklad útesů, rámy jeskyní a ohniště: model ze sady (načtený při startu hry),
// nebo kámen složený z geometrie v kódu — koule rozkouskovaná šumem, potopená do země.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, pushVertex, buildMesh, mulberry32 } from './meshBuilder.js';
import { getRockRecipe, rockModelUrl } from '../data/catalogs/rocks.js';
import { loadedModel } from './assetLoader.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const templates = new WeakMap();
const materials = new WeakMap();

export function rockRoot(scene, key) {
  const url = rockModelUrl(key);
  return url ? loadedModel(url) : rockTemplate(scene, key);
}

export function rockTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const existing = byKey.get(key);
  if (existing && !existing.isDisposed()) return existing;
  const recipe = getRockRecipe(key);
  if (!recipe) return null;
  const built = buildRockTemplate(scene, key, recipe);
  byKey.set(key, built);
  return built;
}

function buildRockTemplate(scene, key, recipe) {
  const buffer = createBuffer();
  fillRock(buffer, recipe);
  const root = new TransformNode(`tplRock_${key}`, scene);
  const mesh = buildMesh(scene, `rock_${key}`, buffer, rockMaterial(scene, recipe));
  mesh.parent = root;
  root.setEnabled(false);
  return root;
}

function rockMaterial(scene, recipe) {
  let byFile = materials.get(scene);
  if (!byFile) {
    byFile = new Map();
    materials.set(scene, byFile);
  }
  const cacheKey = `${recipe.texture}|${recipe.normal}`;
  const existing = byFile.get(cacheKey);
  if (existing) return existing;

  const material = new StandardMaterial(`rockMat_${recipe.texture}`, scene);
  const color = new Texture(`${ASSET_DIRS.textures}${recipe.texture}`, scene);
  color.wrapU = Texture.WRAP_ADDRESSMODE;
  color.wrapV = Texture.WRAP_ADDRESSMODE;
  color.anisotropicFilteringLevel = 4;
  material.diffuseTexture = color;
  material.diffuseColor = new Color3(1.06, 1.06, 1.04);
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  material.ambientColor = new Color3(0.1, 0.1, 0.1);
  material.backFaceCulling = false;

  const bump = new Texture(`${ASSET_DIRS.textures}${recipe.normal}`, scene);
  bump.wrapU = Texture.WRAP_ADDRESSMODE;
  bump.wrapV = Texture.WRAP_ADDRESSMODE;
  bump.gammaSpace = false;
  material.bumpTexture = bump;

  byFile.set(cacheKey, material);
  return material;
}

function fillRock(buffer, recipe) {
  const parts = Array.isArray(recipe.parts) && recipe.parts.length
    ? recipe.parts
    : [{ seed: recipe.seed, size: recipe.size, offset: [0, 0, 0], roughness: recipe.roughness }];
  const blobs = parts.map((part) => buildBlob(recipe, part));
  let highest = 0;
  for (const blob of blobs) {
    for (const point of blob.points) if (point.y > highest) highest = point.y;
  }
  const height = Math.max(0.001, highest);
  for (const blob of blobs) {
    const project = blob.project;
    for (const face of blob.faces) {
      let a = blob.points[face[0]];
      let b = blob.points[face[1]];
      let c = blob.points[face[2]];
      const normal = Vector3.Cross(b.subtract(a), c.subtract(a));
      if (normal.lengthSquared() < 1e-10) continue;
      normal.normalize();
      const outward = a.add(b).add(c).scale(1 / 3).subtract(blob.middle);
      if (Vector3.Dot(normal, outward) < 0) {
        normal.scaleInPlace(-1);
        const swap = b;
        b = c;
        c = swap;
      }
      pushFace(buffer, a, b, c, normal, project(normal), recipe, height, blob.noise);
    }
  }
}

function buildBlob(recipe, part) {
  const size = part.size || recipe.size;
  const offset = part.offset || [0, 0, 0];
  const roughness = Number.isFinite(part.roughness) ? part.roughness : recipe.roughness;
  const rng = mulberry32(part.seed || recipe.seed);
  const noise = valueNoise(rng);
  const sphere = icosphere(recipe.detail);
  const points = sphere.vertices.map((vertex) => {
    const broad = noise(vertex.x * 1.7 + 11, vertex.y * 1.7 + 5, vertex.z * 1.7 + 7) - 0.5;
    const fine = noise(vertex.x * 3.9 + 3, vertex.y * 3.9 + 19, vertex.z * 3.9 + 2) - 0.5;
    const radius = 1 + broad * 2 * roughness + fine * roughness * 0.7;
    return new Vector3(
      vertex.x * radius * size[0],
      vertex.y * radius * size[1],
      vertex.z * radius * size[2],
    );
  });
  const floor = -size[1] * 0.45;
  let lowest = Infinity;
  for (const point of points) {
    if (point.y < floor) point.y = floor + (point.y - floor) * 0.25;
    if (point.y < lowest) lowest = point.y;
  }
  for (const point of points) {
    point.y -= lowest;
    point.x += offset[0];
    point.y += offset[1];
    point.z += offset[2];
  }
  const middle = new Vector3(offset[0], offset[1] + size[1] * 0.4, offset[2]);
  const uvScale = recipe.uvScale;
  const project = (normal) => boxProjection(normal, uvScale);
  return { points, faces: sphere.faces, middle, noise, project };
}

function pushFace(buffer, a, b, c, normal, project, recipe, height, noise) {
  const shadeOf = (point) => {
    const lift = Math.min(1, Math.max(0, point.y / height));
    const mottle = noise(point.x * 6 + 2, point.y * 6 + 8, point.z * 6 + 4);
    const value = (0.86 + 0.16 * lift) * (0.92 + 0.16 * mottle);
    return new Color3(
      recipe.tint[0] * value,
      recipe.tint[1] * value,
      recipe.tint[2] * value,
    );
  };
  const uvA = project(a);
  const uvB = project(b);
  const uvC = project(c);
  const i0 = pushVertex(buffer, a, normal, shadeOf(a), uvA[0], uvA[1]);
  const i1 = pushVertex(buffer, b, normal, shadeOf(b), uvB[0], uvB[1]);
  const i2 = pushVertex(buffer, c, normal, shadeOf(c), uvC[0], uvC[1]);
  buffer.indices.push(i0, i1, i2);
}

function boxProjection(normal, scale) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax >= ay && ax >= az) return (point) => [point.z * scale, point.y * scale];
  if (ay >= az) return (point) => [point.x * scale, point.z * scale];
  return (point) => [point.x * scale, point.y * scale];
}

function icosphere(detail) {
  const golden = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [-1, golden, 0], [1, golden, 0], [-1, -golden, 0], [1, -golden, 0],
    [0, -1, golden], [0, 1, golden], [0, -1, -golden], [0, 1, -golden],
    [golden, 0, -1], [golden, 0, 1], [-golden, 0, -1], [-golden, 0, 1],
  ].map((point) => new Vector3(point[0], point[1], point[2]).normalize());
  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let level = 0; level < detail; level += 1) {
    const midpoints = new Map();
    const middle = (first, second) => {
      const key = first < second ? `${first}_${second}` : `${second}_${first}`;
      const known = midpoints.get(key);
      if (known !== undefined) return known;
      vertices.push(vertices[first].add(vertices[second]).normalize());
      midpoints.set(key, vertices.length - 1);
      return vertices.length - 1;
    };
    const next = [];
    for (const face of faces) {
      const ab = middle(face[0], face[1]);
      const bc = middle(face[1], face[2]);
      const ca = middle(face[2], face[0]);
      next.push([face[0], ab, ca], [face[1], bc, ab], [face[2], ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  return { vertices, faces };
}

function valueNoise(rng) {
  const shuffle = new Uint8Array(256);
  for (let i = 0; i < 256; i += 1) shuffle[i] = i;
  for (let i = 255; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = shuffle[i];
    shuffle[i] = shuffle[j];
    shuffle[j] = swap;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i += 1) perm[i] = shuffle[i & 255];
  const at = (x, y, z) => perm[(perm[(perm[x & 255] + (y & 255)) & 255] + (z & 255)) & 255] / 255;
  const fade = (t) => t * t * (3 - 2 * t);
  const mix = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const fz = fade(z - zi);
    const lowLow = mix(at(xi, yi, zi), at(xi + 1, yi, zi), fx);
    const lowHigh = mix(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), fx);
    const highLow = mix(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), fx);
    const highHigh = mix(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), fx);
    return mix(mix(lowLow, lowHigh, fy), mix(highLow, highHigh, fy), fz);
  };
}
