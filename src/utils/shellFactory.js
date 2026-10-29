// Lastura složená z vějíře žeber — drobná ozdoba na písku i velká sbíratelná mušle.
// Šablona se staví jednou pro každý recept a do světa se vkládá jejím klonem.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { createBuffer, buildMesh } from './meshBuilder.js';
import { getShellRecipe } from '../data/catalogs/shells.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const RINGS = 6;
const RIDGE_HEIGHT = 0.12;

const templates = new WeakMap();
const materials = new WeakMap();

export function shellTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const existing = byKey.get(key);
  if (existing && !existing.isDisposed()) return existing;
  const recipe = getShellRecipe(key);
  if (!recipe) return null;
  const built = buildShellTemplate(scene, key, recipe);
  byKey.set(key, built);
  return built;
}

function buildShellTemplate(scene, key, recipe) {
  const buffer = createBuffer();
  fillShell(buffer, recipe);
  const root = new TransformNode(`tplShell_${key}`, scene);
  const mesh = buildMesh(scene, `shell_${key}`, buffer, shellMaterial(scene, recipe));
  mesh.parent = root;
  root.setEnabled(false);
  return root;
}

function fillShell(buffer, recipe) {
  const [width, height, depth] = recipe.size;
  const ribs = Math.max(2, recipe.ribs || 7);
  const segments = Math.max(4, ribs * 2);
  const tint = recipe.tint || [1, 1, 1];
  const widthScale = width / Math.max(depth, 0.001);
  const halfAngle = recipe.spread || 1.15;
  const wave = recipe.wave || 0;
  const curl = recipe.curl || 0;
  const thickness = height * (recipe.thickness || 0.45);
  const ringCount = RINGS + 2;
  const lastRing = ringCount - 1;

  for (let ring = 0; ring < ringCount; ring += 1) {
    const edge = ring === lastRing;
    const t = edge ? 1 : 0.22 + (0.78 * ring) / RINGS;
    const shape = Math.sin(Math.PI * 0.62 * t) / Math.sin(Math.PI * 0.62);
    for (let segment = 0; segment <= segments; segment += 1) {
      const angle = -halfAngle + (2 * halfAngle * segment) / segments;
      const spread = Math.cos(angle);
      const ripple = 1 + wave * Math.cos(ribs * angle) * t;
      const ridge = (segment % 2 === 0 ? RIDGE_HEIGHT : 0) * height * t;
      const y = height * shape * (0.62 + 0.38 * spread)
        + ridge
        + curl * height * (1 - spread) * t
        - (edge ? thickness : 0);
      buffer.positions.push(
        Math.sin(angle) * depth * t * widthScale * ripple,
        y,
        Math.cos(angle) * depth * t * ripple,
      );
      buffer.normals.push(0, 1, 0);
      buffer.uvs.push(segment / segments, t);
      const shade = segment % 2 === 0 ? 1 : 0.94;
      buffer.colors.push(tint[0] * shade, tint[1] * shade, tint[2] * shade, 1);
    }
  }

  for (let ring = 0; ring < lastRing; ring += 1) {
    for (let segment = 0; segment < segments; segment += 1) {
      const a = ring * (segments + 1) + segment;
      const b = a + segments + 1;
      buffer.indices.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }

  let normals = [];
  VertexData.ComputeNormals(buffer.positions, buffer.indices, normals);
  let up = 0;
  for (let index = 1; index < normals.length; index += 3) up += normals[index];
  if (up < 0) {
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

function shellMaterial(scene, recipe) {
  let byFile = materials.get(scene);
  if (!byFile) {
    byFile = new Map();
    materials.set(scene, byFile);
  }
  const cacheKey = `${recipe.texture}|${recipe.normal}`;
  const existing = byFile.get(cacheKey);
  if (existing) return existing;

  const material = new StandardMaterial(`shellMat_${cacheKey}`, scene);
  const color = new Texture(`${ASSET_DIRS.textures}${recipe.texture}`, scene);
  color.wrapU = Texture.WRAP_ADDRESSMODE;
  color.wrapV = Texture.WRAP_ADDRESSMODE;
  color.anisotropicFilteringLevel = 4;
  material.diffuseTexture = color;
  material.diffuseColor = new Color3(1.1, 1.08, 1.04);
  material.specularColor = new Color3(0.22, 0.22, 0.22);
  material.ambientColor = new Color3(0.14, 0.13, 0.12);
  material.backFaceCulling = false;

  if (recipe.normal) {
    const bump = new Texture(`${ASSET_DIRS.textures}${recipe.normal}`, scene);
    bump.wrapU = Texture.WRAP_ADDRESSMODE;
    bump.wrapV = Texture.WRAP_ADDRESSMODE;
    bump.gammaSpace = false;
    material.bumpTexture = bump;
  }

  byFile.set(cacheKey, material);
  return material;
}
