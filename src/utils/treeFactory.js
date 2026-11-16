// Skládá stromy z geometrie v kódu — kmen s kůrou a korunu z průhledných karet.
// Šablona se staví jednou pro každý recept a do světa se vkládá jejím klonem.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, pushVertex, buildMesh, mulberry32 } from './meshBuilder.js';
import { buildTreeSkeleton } from './treeSkeleton.js';
import { getTreeRecipe } from '../data/catalogs/trees.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TreeWindPlugin from '../systems/flora/treeWindPlugin.js';
import FloraColorPlugin from '../systems/materials/floraColorPlugin.js';

const templates = new WeakMap();
const stumps = new WeakMap();
const logs = new WeakMap();
const branches = new WeakMap();
const fronds = new WeakMap();
const textures = new WeakMap();
const cutMaterials = new WeakMap();
const TREE_BRIGHTNESS = 1.12;
const CARD_ROLL = 0.7;
const CARD_ASPECT = 0.7;
const CARD_BEND = 0.12;
const PINE_CARD_BEND = 0.22;

export function treeTemplate(scene, key) {
  return cachedTemplate(templates, scene, key, (recipe) => buildTree(scene, key, recipe));
}

export function treeStumpTemplate(scene, key) {
  return cachedTemplate(stumps, scene, key, (recipe) => buildStump(scene, key, recipe));
}

export function treeLogTemplate(scene, key) {
  return cachedTemplate(logs, scene, key, (recipe) => buildLog(scene, key, recipe));
}

export function treeBranchTemplate(scene, key) {
  return cachedTemplate(branches, scene, key, (recipe) => buildBranch(scene, key, recipe));
}

export function treeFrondTemplate(scene, key) {
  return cachedTemplate(fronds, scene, key, (recipe) => buildFrond(scene, key, recipe));
}

function cachedTemplate(store, scene, key, build) {
  let byKey = store.get(scene);
  if (!byKey) {
    byKey = new Map();
    store.set(scene, byKey);
  }
  const existing = byKey.get(key);
  if (existing && !existing.isDisposed()) return existing;
  const recipe = getTreeRecipe(key);
  if (!recipe) return null;
  const built = build(recipe);
  byKey.set(key, built);
  return built;
}

function buildTree(scene, key, recipe) {
  const rng = mulberry32(recipe.seed);
  const bark = createBuffer();
  const leaves = createBuffer();
  const crown = createBuffer();
  if (recipe.shape === 'palm') {
    buildPalmTrunk(bark, crown, recipe, rng);
    buildPalmCrown(leaves, recipe, rng);
  } else if (recipe.shape === 'skeleton') {
    buildSkeletonTree(bark, leaves, recipe);
  } else {
    buildTrunk(bark, recipe, rng);
    buildBranches(bark, leaves, recipe, rng);
    buildTop(leaves, recipe, rng);
  }

  const root = new TransformNode(`tplTree_${key}`, scene);
  const barkMesh = buildMesh(scene, `tree_${key}_bark`, bark, barkMaterial(scene, key, recipe));
  const leafMesh = buildMesh(scene, `tree_${key}_leaves`, leaves, leafMaterial(scene, key, recipe));
  const flatLeaves = recipe.shape === 'palm' || recipe.shape === 'skeleton';
  if (flatLeaves) leafMesh.receiveShadows = false;
  barkMesh.parent = root;
  leafMesh.parent = root;
  if (crown.positions.length) {
    const crownMesh = buildMesh(scene, `tree_${key}_crown`, crown, crownMaterial(scene, key, recipe));
    if (flatLeaves) crownMesh.receiveShadows = false;
    crownMesh.parent = root;
  }
  root.setEnabled(false);
  return root;
}

function barkMaterial(scene, key, recipe, wind = true) {
  const material = new StandardMaterial(`treeBark_${key}`, scene);
  material.diffuseTexture = textureFor(scene, recipe.barkTexture || 'pine_bark.jpg', true);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0.03, 0.03, 0.03);
  if (wind) addWind(material, recipe);
  return material;
}

function leafMaterial(scene, key, recipe) {
  const material = new StandardMaterial(`treeLeaf_${key}`, scene);
  material.diffuseTexture = textureFor(scene, recipe.leafTexture || 'pine_twig.png', false);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0.02, 0.02, 0.02);
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.45;
  material.backFaceCulling = false;
  material.twoSidedLighting = false;
  addWind(material, recipe);
  return material;
}

function addWind(material, recipe) {
  new TreeWindPlugin(material, {
    strength: recipe.height * 0.013,
    height: recipe.height,
  });
  new FloraColorPlugin(material);
}

function cutMaterial(scene) {
  let material = cutMaterials.get(scene);
  if (material) return material;
  material = new StandardMaterial('treeCut', scene);
  material.diffuseColor = new Color3(0.72, 0.58, 0.42);
  material.specularColor = new Color3(0.05, 0.05, 0.04);
  material.backFaceCulling = false;
  cutMaterials.set(scene, material);
  return material;
}

function crownMaterial(scene, key, recipe) {
  const material = new StandardMaterial(`treeCrown_${key}`, scene);
  material.diffuseColor = new Color3(0.32, 0.46, 0.18);
  material.specularColor = new Color3(0.04, 0.04, 0.03);
  addWind(material, recipe);
  return material;
}

function assembleTemplate(scene, name, parts) {
  const root = new TransformNode(name, scene);
  for (const [buffer, material] of parts) {
    if (!buffer.positions.length) continue;
    const mesh = buildMesh(scene, `${name}_${material.name}`, buffer, material);
    mesh.parent = root;
  }
  root.setEnabled(false);
  return root;
}

function textureFor(scene, file, repeat) {
  let byName = textures.get(scene);
  if (!byName) {
    byName = new Map();
    textures.set(scene, byName);
  }
  const existing = byName.get(file);
  if (existing) return existing;
  const texture = new Texture(`${ASSET_DIRS.textures}${file}`, scene);
  const wrap = repeat ? Texture.WRAP_ADDRESSMODE : Texture.CLAMP_ADDRESSMODE;
  texture.wrapU = wrap;
  texture.wrapV = wrap;
  texture.anisotropicFilteringLevel = 8;
  if (file.endsWith('.png')) texture.hasAlpha = true;
  byName.set(file, texture);
  return texture;
}

function addTriangle(buffer, a, b, c, color, uvA, uvB, uvC, softUp) {
  let normal = Vector3.Cross(b.subtract(a), c.subtract(a));
  if (normal.lengthSquared() < 1e-12) return;
  normal.normalize();
  if (softUp) normal = normal.scale(0.45).add(softUp.scale(0.55)).normalize();
  const i0 = pushVertex(buffer, a, normal, color, uvA[0], uvA[1]);
  const i1 = pushVertex(buffer, b, normal, color, uvB[0], uvB[1]);
  const i2 = pushVertex(buffer, c, normal, color, uvC[0], uvC[1]);
  buffer.indices.push(i0, i1, i2);
}

function addQuad(buffer, a, b, c, d, color, softUp, uv) {
  const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
  addTriangle(buffer, a, b, c, color, [u0, v0], [u1, v0], [u1, v1], softUp);
  addTriangle(buffer, a, c, d, color, [u0, v0], [u1, v1], [u0, v1], softUp);
}

function addQuadRange(buffer, a, b, c, d, color, u0, u1, softUp) {
  addTriangle(buffer, a, c, b, color, [u0, 0], [u1, 1], [u0, 1], softUp);
  addTriangle(buffer, a, d, c, color, [u0, 0], [u1, 0], [u1, 1], softUp);
}

function addCard(buffer, center, forward, lateral, length, height, color, uv) {
  const along = forward.scale(length * 0.5);
  const across = lateral.scale(height * 0.5);
  const a = center.subtract(along).subtract(across);
  const b = center.add(along).subtract(across);
  const c = center.add(along).add(across);
  const d = center.subtract(along).add(across);
  addQuad(buffer, a, b, c, d, color, Vector3.Up(), uv);
}

function addBentCard(buffer, center, forward, lateral, length, height, color, uv, bend) {
  const faceCross = Vector3.Cross(forward, lateral);
  if (faceCross.lengthSquared() < 1e-8) {
    addCard(buffer, center, forward, lateral, length, height, color, uv);
    return;
  }
  const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
  const face = faceCross.normalize();
  const across = lateral.scale(height * 0.5);
  const grid = [];
  for (let i = 0; i <= 2; i += 1) {
    const si = i - 1;
    const bow = (1 - si * si) * bend * length;
    const along = center.add(forward.scale(si * length * 0.5)).subtract(face.scale(bow));
    grid.push([along.subtract(across), along.add(across)]);
  }
  const uvAt = (i, j) => [u0 + (i / 2) * (u1 - u0), v0 + j * (v1 - v0)];
  for (let i = 0; i < 2; i += 1) {
    addTriangle(buffer, grid[i][0], grid[i + 1][0], grid[i + 1][1], color,
      uvAt(i, 0), uvAt(i + 1, 0), uvAt(i + 1, 1), Vector3.Up());
    addTriangle(buffer, grid[i][0], grid[i + 1][1], grid[i][1], color,
      uvAt(i, 0), uvAt(i + 1, 1), uvAt(i, 1), Vector3.Up());
  }
}

function tangentAt(points, index) {
  if (index === 0) return points[1].subtract(points[0]).normalize();
  if (index === points.length - 1) return points[index].subtract(points[index - 1]).normalize();
  return points[index + 1].subtract(points[index - 1]).normalize();
}

function perpendicular(vector) {
  const axis = Math.abs(vector.y) < 0.9 ? Vector3.Up() : Vector3.Right();
  return Vector3.Cross(vector, axis).normalize();
}

function addTube(buffer, points, radii, sides, shadeAt, uvRepeat) {
  const frames = [];
  let right = null;
  for (let i = 0; i < points.length; i += 1) {
    const tangent = tangentAt(points, i);
    let next = right ? right.subtract(tangent.scale(Vector3.Dot(right, tangent))) : perpendicular(tangent);
    if (next.lengthSquared() < 1e-6) next = perpendicular(tangent);
    right = next.normalize();
    frames.push({ right, up: Vector3.Cross(tangent, right).normalize() });
  }

  const start = buffer.positions.length / 3;
  for (let i = 0; i < points.length; i += 1) {
    const shade = shadeAt(i / (points.length - 1));
    const frame = frames[i];
    const radius = radii[i];
    const v = (i / (points.length - 1)) * uvRepeat[1];
    for (let s = 0; s < sides; s += 1) {
      const angle = (s / sides) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const normal = new Vector3(
        frame.right.x * cos + frame.up.x * sin,
        frame.right.y * cos + frame.up.y * sin,
        frame.right.z * cos + frame.up.z * sin,
      ).normalize();
      pushVertex(buffer, points[i].add(normal.scale(radius)), normal, shade,
        (s / sides) * uvRepeat[0], v);
    }
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const nextSide = (s + 1) % sides;
      const a = start + i * sides + s;
      const b = start + i * sides + nextSide;
      const c = start + (i + 1) * sides + s;
      const d = start + (i + 1) * sides + nextSide;
      buffer.indices.push(a, c, b, b, c, d);
    }
  }
}

function addCap(buffer, center, tangent, radius, sides, color) {
  const normal = tangent.normalize();
  const right = perpendicular(normal);
  const up = Vector3.Cross(normal, right).normalize();
  const centerIndex = pushVertex(buffer, center, normal, color, 0.5, 0.5);
  const ring = [];
  for (let s = 0; s < sides; s += 1) {
    const angle = (s / sides) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const point = center.add(right.scale(cos * radius)).add(up.scale(sin * radius));
    ring.push(pushVertex(buffer, point, normal, color, 0.5 + cos * 0.5, 0.5 + sin * 0.5));
  }
  for (let s = 0; s < sides; s += 1) {
    const next = (s + 1) % sides;
    buffer.indices.push(centerIndex, ring[s], ring[next]);
    buffer.indices.push(centerIndex, ring[next], ring[s]);
  }
}


function trunkAxis(recipe, t) {
  return new Vector3(
    recipe.lean * t * t,
    recipe.height * t,
    recipe.lean * 0.3 * Math.sin(t * 2.2) * t,
  );
}

function barkShade(recipe, t, rng) {
  const from = recipe.barkTint;
  const to = recipe.barkTintTop;
  const mix = Math.min(1, Math.max(0, t) * 0.9);
  const jitter = (0.94 + rng() * 0.12) * TREE_BRIGHTNESS;
  return new Color3(
    (from[0] + (to[0] - from[0]) * mix) * jitter,
    (from[1] + (to[1] - from[1]) * mix) * jitter,
    (from[2] + (to[2] - from[2]) * mix) * jitter,
  );
}

function leafShade(recipe, t, rng) {
  const from = recipe.leafTint;
  const to = recipe.leafTintTop;
  const mix = Math.min(1, Math.max(0, t) * 0.8 + rng() * 0.2);
  const jitter = (0.95 + rng() * 0.1) * TREE_BRIGHTNESS;
  return new Color3(
    (from[0] + (to[0] - from[0]) * mix) * jitter,
    (from[1] + (to[1] - from[1]) * mix) * jitter,
    (from[2] + (to[2] - from[2]) * mix) * jitter,
  );
}

function buildTrunk(buffer, recipe, rng) {
  const rings = Math.max(3, recipe.trunkRings);
  const points = [];
  const radii = [];
  for (let i = 0; i < rings; i += 1) {
    const t = i / (rings - 1);
    points.push(trunkAxis(recipe, t));
    radii.push(recipe.trunkRadius * Math.pow(1 - t, 0.85) + 0.02);
  }
  addTube(buffer, points, radii, recipe.trunkSides, (t) => barkShade(recipe, t, rng), [1, 2.4]);
  addCap(buffer, points[points.length - 1], tangentAt(points, points.length - 1),
    radii[radii.length - 1], recipe.trunkSides, barkShade(recipe, 1, rng));
}

function buildBranches(barkBuffer, leafBuffer, recipe, rng) {
  const whorls = Math.max(2, recipe.whorls);
  for (let w = 0; w < whorls; w += 1) {
    const step = w / (whorls - 1);
    const t = recipe.crownStart + (recipe.crownEnd - recipe.crownStart) * step;
    const center = trunkAxis(recipe, t);
    const count = recipe.branchesMin
      + Math.floor(rng() * (recipe.branchesMax - recipe.branchesMin + 1));
    const baseAngle = rng() * Math.PI * 2;
    const taper = 1 - (recipe.crownTaper || 0) * Math.pow(step, 0.8);
    const length = recipe.height * (recipe.branchLength + 0.1 * (1 - t)) * taper;
    for (let b = 0; b < count; b += 1) {
      const angle = baseAngle + (b / count) * Math.PI * 2 + (rng() - 0.5) * 0.3;
      const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const direction = outward.subtract(Vector3.Up().scale(recipe.droop * (1 - t * 0.4))).normalize();
      const start = center.add(outward.scale(0.04));
      const mid = start.add(direction.scale(length * 0.55));
      const tip = mid.add(direction.scale(length * 0.45)).add(Vector3.Up().scale(length * 0.06));
      addTube(barkBuffer, [start, mid, tip], [0.05, 0.028, 0.012], 5,
        (k) => barkShade(recipe, 0.35 + k * 0.45, rng), [1, 1.2]);
      addCap(barkBuffer, tip, direction, 0.012, 5, barkShade(recipe, 0.8, rng));
      addBranchCards(leafBuffer, recipe, rng, start, direction, length, t, step);
    }
  }
}

function addBranchCards(buffer, recipe, rng, start, direction, length, t, step) {
  const tipSparse = Math.max(0, (step - 0.75) / 0.25);
  const count = Math.max(1, Math.round(recipe.cardsPerBranch * (1 - 0.45 * tipSparse)));
  const up = Vector3.Up();
  const lateral = Vector3.Cross(direction, up).normalize();
  const cardLength = length * recipe.cardLength;
  const cardHeight = length * recipe.cardHeight;
  for (let c = 0; c < count; c += 1) {
    const slot = count === 1 ? 0.5 : c / (count - 1);
    const along = 0.35 + 0.55 * slot;
    const center = start.add(direction.scale(length * along));
    const color = leafShade(recipe, t, rng);
    const uv = pickLeafUv(recipe, rng);
    const tilt = up.add(lateral.scale((rng() - 0.5) * 0.5)).normalize();
    const size = (0.9 + rng() * 0.2) * (1 - 0.35 * slot);
    const roll = (rng() - 0.5) * CARD_ROLL;
    addBentCard(buffer, center, direction, rollLateral(tilt, direction, roll),
      cardLength * size, cardHeight * size, color, uv, PINE_CARD_BEND);
    addBentCard(buffer, center, direction, rollLateral(lateral, direction, roll),
      cardLength * size, cardHeight * size, color, uv, PINE_CARD_BEND);
  }
  const inner = start.add(direction.scale(length * 0.24));
  const innerColor = leafShade(recipe, t, rng);
  const innerUv = pickLeafUv(recipe, rng);
  addCard(buffer, inner, direction, up, cardLength * 0.85, cardHeight * 0.85, innerColor, innerUv);
  addCard(buffer, inner, direction, lateral, cardLength * 0.85, cardHeight * 0.85, innerColor, innerUv);
}

function rollLateral(lateral, forward, angle) {
  return lateral.scale(Math.cos(angle))
    .add(Vector3.Cross(forward, lateral).scale(Math.sin(angle)))
    .normalize();
}

function pickLeafUv(recipe, rng) {
  const windows = recipe.leafUv;
  if (!windows || !windows.length) return null;
  const [u0, v0, u1, v1] = windows[Math.floor(rng() * windows.length)];
  return rng() < 0.5 ? [u1, v0, u0, v1] : [u0, v0, u1, v1];
}

function buildTop(buffer, recipe, rng) {
  const top = trunkAxis(recipe, 0.96);
  const count = 3;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.6;
    const direction = new Vector3(Math.cos(angle) * 0.45, 1, Math.sin(angle) * 0.45).normalize();
    const lateral = Vector3.Cross(direction, Vector3.Up()).normalize();
    const color = leafShade(recipe, 1, rng);
    const size = recipe.height * 0.12;
    const center = top.add(direction.scale(size * 0.3));
    addBentCard(buffer, center, direction, Vector3.Up(), size, size * 0.55, color, null, PINE_CARD_BEND);
    addBentCard(buffer, center, direction, lateral, size, size * 0.55, color, null, PINE_CARD_BEND);
  }
}


function buildStump(scene, key, recipe) {
  const sides = Math.max(6, recipe.trunkSides);
  const height = Math.max(0.3, recipe.height * 0.08);
  const radius = Math.max(0.1, recipe.trunkRadius * 1.15);
  const bark = createBuffer();
  const cut = createBuffer();
  const points = [new Vector3(0, 0, 0), new Vector3(0, height * 0.55, 0), new Vector3(0, height, 0)];
  const radii = [radius, radius * 0.98, radius * 0.92];
  addTube(bark, points, radii, sides, () => new Color3(0.95, 0.92, 0.88), [1, 0.4]);
  addCap(cut, new Vector3(0, height, 0), Vector3.Up(), radius * 0.92, sides, new Color3(1, 1, 1));
  return assembleTemplate(scene, `tplStump_${key}`, [
    [bark, barkMaterial(scene, `${key}_stump`, recipe, false)],
    [cut, cutMaterial(scene)],
  ]);
}

function buildLog(scene, key, recipe) {
  const sides = Math.max(6, Math.min(10, recipe.trunkSides));
  const length = Math.max(0.9, recipe.height * 0.42);
  const radius = Math.max(0.08, recipe.trunkRadius * 0.85);
  const rng = mulberry32(recipe.seed);
  const bark = createBuffer();
  const cut = createBuffer();
  const y = radius;
  const half = length / 2;
  const bend = (rng() - 0.5) * radius * (Number.isFinite(recipe.bend) ? recipe.bend : 0.7);
  const points = [
    new Vector3(-half, y, 0),
    new Vector3(-half * 0.42, y + bend * 0.35, bend),
    new Vector3(0, y + bend * 0.55, bend * 0.7),
    new Vector3(half * 0.46, y + bend * 0.2, bend * 0.3),
    new Vector3(half, y, 0),
  ];
  const radii = [radius * 0.9, radius, radius * 0.96, radius * 0.92, radius * 0.82];
  const gap = radius * (Number.isFinite(recipe.split) ? recipe.split : 0.42);
  const leftPoints = points.map((point) => point.add(new Vector3(0, radius * 0.05, -gap)));
  const rightPoints = points.map((point) => point.add(new Vector3(0, -radius * 0.04, gap)));
  addHalfTube(bark, cut, leftPoints, radii.map((value) => value * 0.95), sides, [1, Math.max(1, length / 0.9)], 0, Math.PI);
  addHalfTube(bark, cut, rightPoints, radii.map((value) => value * 0.88), sides, [1, Math.max(1, length / 0.9)], Math.PI, Math.PI * 2);
  addRaggedCap(cut, leftPoints[0], new Vector3(-1, 0, 0), radii[0] * 0.95, sides, new Color3(1, 1, 1), rng);
  addRaggedCap(cut, leftPoints[leftPoints.length - 1], new Vector3(1, 0, 0), radii[radii.length - 1] * 0.95, sides, new Color3(1, 1, 1), rng);
  addRaggedCap(cut, rightPoints[0], new Vector3(-1, 0, 0), radii[0] * 0.88, sides, new Color3(1, 1, 1), rng);
  addRaggedCap(cut, rightPoints[rightPoints.length - 1], new Vector3(1, 0, 0), radii[radii.length - 1] * 0.88, sides, new Color3(1, 1, 1), rng);
  addLogBranches(bark, cut, points, radius, sides, rng, recipe.branchCount);
  return assembleTemplate(scene, `tplLog_${key}`, [
    [bark, barkMaterial(scene, `${key}_log`, recipe, false)],
    [cut, cutMaterial(scene)],
  ]);
}

function addHalfTube(bark, cut, points, radii, sides, uvRepeat, angleStart, angleEnd) {
  const frames = [];
  let right = null;
  for (let i = 0; i < points.length; i += 1) {
    const tangent = tangentAt(points, i);
    let next = right ? right.subtract(tangent.scale(Vector3.Dot(right, tangent))) : perpendicular(tangent);
    if (next.lengthSquared() < 1e-6) next = perpendicular(tangent);
    right = next.normalize();
    frames.push({ right, up: Vector3.Cross(tangent, right).normalize() });
  }
  const start = bark.positions.length / 3;
  for (let i = 0; i < points.length; i += 1) {
    const frame = frames[i];
    const shade = () => new Color3(0.95, 0.92, 0.88);
    const v = (i / (points.length - 1)) * uvRepeat[1];
    for (let s = 0; s <= sides; s += 1) {
      const angle = angleStart + ((angleEnd - angleStart) * s) / sides;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const normal = new Vector3(
        frame.right.x * cos + frame.up.x * sin,
        frame.right.y * cos + frame.up.y * sin,
        frame.right.z * cos + frame.up.z * sin,
      ).normalize();
      pushVertex(bark, points[i].add(normal.scale(radii[i])), normal, shade(),
        (s / sides) * uvRepeat[0], v);
    }
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let s = 0; s < sides; s += 1) {
      const a = start + i * (sides + 1) + s;
      const b = a + 1;
      const c = a + sides + 1;
      const d = c + 1;
      bark.indices.push(a, c, b, b, c, d);
    }
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const frame = frames[i];
    const nextFrame = frames[i + 1];
    const a = points[i].add(new Vector3(frame.right.x * radii[i], frame.right.y * radii[i], frame.right.z * radii[i]));
    const b = points[i + 1].add(new Vector3(nextFrame.right.x * radii[i + 1], nextFrame.right.y * radii[i + 1], nextFrame.right.z * radii[i + 1]));
    const c = points[i + 1].add(new Vector3(-nextFrame.right.x * radii[i + 1], -nextFrame.right.y * radii[i + 1], -nextFrame.right.z * radii[i + 1]));
    const d = points[i].add(new Vector3(-frame.right.x * radii[i], -frame.right.y * radii[i], -frame.right.z * radii[i]));
    addQuad(cut, a, b, c, d, new Color3(1, 1, 1), Vector3.Up(), [0, i / (points.length - 1), 1, (i + 1) / (points.length - 1)]);
  }
}

function addLogBranches(bark, cut, points, radius, sides, rng, branchCount) {
  const count = Number.isFinite(branchCount) ? branchCount : 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i += 1) {
    const base = points[1 + Math.floor(rng() * (points.length - 2))];
    const direction = new Vector3((rng() - 0.5) * 1.4, 0.35 + rng() * 0.5, (rng() - 0.5) * 1.4).normalize();
    const start = base.add(direction.scale(radius * 0.5));
    const end = start.add(direction.scale(radius * (0.8 + rng() * 0.9)));
    addTube(bark, [start, end], [radius * 0.36, radius * 0.13], 5, () => new Color3(0.93, 0.9, 0.85), [1, 0.7]);
    addRaggedCap(cut, end, direction, radius * 0.13, 5, new Color3(1, 1, 1), rng);
  }
}

function addRaggedCap(buffer, center, tangent, radius, sides, color, rng) {
  const normal = tangent.normalize();
  const right = perpendicular(normal);
  const up = Vector3.Cross(normal, right).normalize();
  const capCenter = center.add(normal.scale((rng() - 0.5) * radius * 0.25));
  const centerIndex = pushVertex(buffer, capCenter, normal, color, 0.5, 0.5);
  const ring = [];
  for (let s = 0; s < sides; s += 1) {
    const angle = (s / sides) * Math.PI * 2;
    const reach = radius * (0.72 + rng() * 0.36);
    const point = capCenter
      .add(right.scale(Math.cos(angle) * reach))
      .add(up.scale(Math.sin(angle) * reach));
    ring.push(pushVertex(buffer, point, normal, color, 0.5 + Math.cos(angle) * 0.5, 0.5 + Math.sin(angle) * 0.5));
  }
  for (let s = 0; s < sides; s += 1) {
    const next = (s + 1) % sides;
    buffer.indices.push(centerIndex, ring[s], ring[next]);
    buffer.indices.push(centerIndex, ring[next], ring[s]);
  }
}

function buildBranch(scene, key, recipe) {
  const sides = Math.max(5, Math.min(8, recipe.trunkSides));
  const length = Math.max(1.1, recipe.height * 0.55);
  const radius = Math.max(0.04, recipe.trunkRadius * 0.55);
  const angle = Number.isFinite(recipe.branchAngle) ? recipe.branchAngle : 0.8;
  const rng = mulberry32(recipe.seed);
  const bark = createBuffer();
  const cut = createBuffer();
  const y = radius;
  const main = [
    new Vector3(-length * 0.5, y, 0),
    new Vector3(0, y + radius * 0.15, 0),
    new Vector3(length * 0.5, y, 0),
  ];
  addTube(bark, main, [radius * 0.75, radius, radius * 0.62], sides, () => new Color3(0.95, 0.92, 0.88), [1, Math.max(1, length / 0.7)]);
  addRaggedCap(cut, main[0], new Vector3(-1, 0, 0), radius * 0.75, sides, new Color3(1, 1, 1), rng);
  addRaggedCap(cut, main[2], new Vector3(1, 0, 0), radius * 0.62, sides, new Color3(1, 1, 1), rng);
  const fork = new Vector3(-length * 0.06, y, 0);
  const firstEnd = fork.add(new Vector3(length * Math.cos(angle) * 0.34, radius * 0.12, length * Math.sin(angle) * 0.24));
  addTube(bark, [fork, firstEnd], [radius * 0.62, radius * 0.26], sides, () => new Color3(0.94, 0.9, 0.85), [1, Math.max(1, length / 0.5)]);
  addRaggedCap(cut, firstEnd, new Vector3(0.4, 0, 0.9), radius * 0.26, sides, new Color3(1, 1, 1), rng);
  const secondEnd = fork.add(new Vector3(length * 0.18, radius * 0.2, -length * 0.3));
  addTube(bark, [fork, secondEnd], [radius * 0.5, radius * 0.22], sides, () => new Color3(0.92, 0.88, 0.83), [1, Math.max(1, length / 0.5)]);
  addRaggedCap(cut, secondEnd, new Vector3(0.2, 0, -1), radius * 0.22, sides, new Color3(1, 1, 1), rng);
  return assembleTemplate(scene, `tplBranch_${key}`, [
    [bark, barkMaterial(scene, `${key}_branch`, recipe, false)],
    [cut, cutMaterial(scene)],
  ]);
}


function buildFrond(scene, key, recipe) {
  const buffer = createBuffer();
  const from = new Vector3(0, 0.03, 0);
  const to = new Vector3(1, 0.03, 0);
  const lateral = new Vector3(0, 0, 1);
  addFrondQuad(buffer, from, to, lateral, recipe.frondWidth || 0.5, 0, 1, new Color3(1, 1, 1));
  return assembleTemplate(scene, `tplFrond_${key}`, [
    [buffer, leafMaterial(scene, `${key}_frond`, recipe)],
  ]);
}

function palmAxis(recipe, t) {
  return new Vector3(
    recipe.lean * Math.pow(t, 1.4),
    recipe.height * t,
    recipe.lean * 0.22 * Math.sin(t * 2.1) * t,
  );
}

function buildPalmTrunk(bark, crown, recipe, rng) {
  const sides = recipe.trunkSides;
  const rings = Math.max(4, recipe.trunkRings);
  const shaftBottom = 0.82;
  const shaftTop = 0.9;
  const points = [];
  const radii = [];
  for (let i = 0; i < rings; i += 1) {
    const t = (i / (rings - 1)) * shaftBottom;
    points.push(palmAxis(recipe, t));
    const flare = 1 + 0.55 * Math.pow(1 - t, 6);
    radii.push((recipe.trunkRadius * flare * (1 - 0.2 * t)) + 0.02);
  }
  addTube(bark, points, radii, sides,
    (t) => barkShade(recipe, t, rng), [1, Math.max(2, recipe.height / 2.4)]);

  const topRadius = radii[radii.length - 1];
  const shaft = [
    palmAxis(recipe, shaftBottom),
    palmAxis(recipe, (shaftBottom + shaftTop) * 0.5),
    palmAxis(recipe, shaftTop),
  ];
  addTube(crown, shaft, [topRadius, topRadius * 0.94, topRadius * 0.8], sides,
    () => new Color3(1, 1, 1), [1, 1]);
  addCap(crown, shaft[2], tangentAt(shaft, 2), topRadius * 0.8, sides, new Color3(1, 1, 1));
}

function buildPalmCrown(buffer, recipe, rng) {
  const tiers = [
    { t: 0.82, share: 0.22, length: 0.85, droop: 0.55, tip: 0.35 },
    { t: 0.85, share: 0.26, length: 1.0, droop: 0.3, tip: 0.1 },
    { t: 0.88, share: 0.28, length: 1.05, droop: 0.05, tip: 0.0 },
    { t: 0.9, share: 0.24, length: 0.95, droop: -0.3, tip: -0.5 },
  ];
  const total = Math.max(8, Math.round(recipe.fronds * 1.8));
  let offset = rng() * Math.PI * 2;
  for (const tier of tiers) {
    const count = Math.max(2, Math.round(total * tier.share));
    const origin = palmAxis(recipe, tier.t)
      .add(new Vector3((rng() - 0.5) * 0.14, 0, (rng() - 0.5) * 0.14));
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.22;
      const droop = recipe.frondDroop + tier.droop + rng() * 0.15;
      const tipDroop = recipe.frondTipDroop + tier.tip + rng() * 0.2;
      const length = recipe.frondLength * tier.length * (0.85 + rng() * 0.3);
      addFrond(buffer, origin, angle, droop, tipDroop, length, recipe, leafShade(recipe, 0.9, rng));
    }
    offset += 0.7;
  }
  const tuft = 3 + Math.round(rng() * 2);
  const crownTop = palmAxis(recipe, 0.9);
  const tuftAngle = rng() * Math.PI * 2;
  for (let i = 0; i < tuft; i += 1) {
    const angle = tuftAngle + (i / tuft) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const droop = -0.8 - rng() * 0.35;
    const tipDroop = -1.0 - rng() * 0.3;
    const length = recipe.frondLength * (0.5 + rng() * 0.2);
    addFrond(buffer, crownTop, angle, droop, tipDroop, length, recipe, leafShade(recipe, 0.85, rng), true);
  }
}

function addFrond(buffer, origin, angle, droop, tipDroop, length, recipe, color, crossed = false) {
  const width = length * recipe.frondWidth;
  const lateral = new Vector3(Math.cos(angle + Math.PI / 2), 0, Math.sin(angle + Math.PI / 2));
  const first = frondDirection(angle, droop);
  const second = frondDirection(angle, tipDroop);
  const p0 = origin;
  const p1 = p0.add(first.scale(length * 0.55));
  const p2 = p1.add(second.scale(length * 0.45));
  addFrondQuad(buffer, p0, p1, lateral, width, 0, 0.55, color);
  addFrondQuad(buffer, p1, p2, lateral, width, 0.55, 1, color);
  if (crossed) {
    const sideA = Vector3.Cross(first, lateral).normalize();
    const sideB = Vector3.Cross(second, lateral).normalize();
    addFrondQuad(buffer, p0, p1, sideA, width, 0, 0.55, color);
    addFrondQuad(buffer, p1, p2, sideB, width, 0.55, 1, color);
  }
}

function frondDirection(angle, droop) {
  return new Vector3(
    Math.cos(angle) * Math.cos(droop),
    -Math.sin(droop),
    Math.sin(angle) * Math.cos(droop),
  );
}

function addFrondQuad(buffer, from, to, lateral, width, u0, u1, color) {
  const half = lateral.scale(width * 0.5);
  const a = from.subtract(half);
  const b = from.add(half);
  const c = to.add(half);
  const d = to.subtract(half);
  addQuadRange(buffer, a, b, c, d, color, u0, u1, Vector3.Up());
}

function addFacingCard(buffer, center, normal, size, color, uv, roll) {
  const face = normal.normalize();
  const helper = Math.abs(face.y) < 0.9 ? Vector3.Up() : Vector3.Right();
  const tangent = Vector3.Cross(face, helper).normalize();
  const bitangent = Vector3.Cross(face, tangent).normalize();
  const forward = tangent.scale(Math.cos(roll)).add(bitangent.scale(Math.sin(roll))).normalize();
  const lateral = Vector3.Cross(face, forward).normalize();
  const [u0, v0, u1, v1] = uv || [0, 0, 1, 1];
  const halfLength = size * 0.5;
  const halfHeight = size * CARD_ASPECT * 0.5;
  const bend = size * CARD_BEND;
  const grid = [];
  for (let i = 0; i <= 2; i += 1) {
    const row = [];
    for (let j = 0; j <= 2; j += 1) {
      const si = i - 1;
      const sj = j - 1;
      const pull = (1 - si * si) * (1 - sj * sj);
      row.push(center
        .add(forward.scale(si * halfLength))
        .add(lateral.scale(sj * halfHeight))
        .subtract(face.scale(pull * bend)));
    }
    grid.push(row);
  }
  const uvAt = (i, j) => [
    u0 + (i / 2) * (u1 - u0),
    v0 + (j / 2) * (v1 - v0),
  ];
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      const a = grid[i][j];
      const b = grid[i + 1][j];
      const c = grid[i + 1][j + 1];
      const d = grid[i][j + 1];
      const up = Vector3.Up();
      addTriangle(buffer, a, b, c, color, uvAt(i, j), uvAt(i + 1, j), uvAt(i + 1, j + 1), up);
      addTriangle(buffer, a, c, d, color, uvAt(i, j), uvAt(i + 1, j + 1), uvAt(i, j + 1), up);
    }
  }
}

function buildSkeletonTree(bark, leaves, recipe) {
  const rng = mulberry32(recipe.seed + 7);
  const skeleton = buildTreeSkeleton(recipe);
  const sides = Math.max(4, recipe.branchSides || 6);
  const levels = Math.max(2, recipe.levels);
  for (const segment of skeleton.segments) {
    const direction = segment.end.subtract(segment.start);
    const length = direction.length();
    if (length < 1e-4) continue;
    const mid = segment.start.add(direction.scale(0.5));
    const shade = segment.level / (levels - 1);
    addTube(bark, [segment.start, mid, segment.end],
      [segment.radius, (segment.radius + segment.radiusEnd) * 0.5, segment.radiusEnd],
      sides, (t) => barkShade(recipe, Math.min(1, shade + t * 0.12), rng), [1, 1]);
    addCap(bark, segment.end, direction.scale(1 / length), segment.radiusEnd, sides,
      barkShade(recipe, 1, rng));
  }
  for (const card of leafCardList(recipe, skeleton)) {
    addFacingCard(leaves, card.position, card.normal, card.size, card.color, card.uv, card.roll);
  }
}

function leafCardList(recipe, skeleton) {
  const rng = mulberry32(recipe.seed + 31);
  const windows = recipe.leafUv && recipe.leafUv.length ? recipe.leafUv : [[0, 0, 1, 1]];
  const cards = [];
  const perTip = Math.max(1, recipe.cardsPerTip);
  for (const tip of skeleton.tips) {
    for (let i = 0; i < perTip; i += 1) {
      const yaw = rng() * Math.PI * 2;
      const roll = rng() * Math.PI * 2;
      const normal = new Vector3(Math.cos(yaw), rng() - 0.2, Math.sin(yaw)).normalize();
      const size = recipe.cardSize * (0.8 + rng() * 0.4);
      const window = Math.floor(rng() * windows.length);
      const [wu0, wv0, wu1, wv1] = windows[window];
      const mirror = rng() < 0.5;
      cards.push({
        position: tip.point.add(normal.scale(size * 0.3)),
        normal,
        roll,
        size,
        uv: mirror ? [wu1, wv0, wu0, wv1] : [wu0, wv0, wu1, wv1],
        color: leafShade(recipe, 0.55 + rng() * 0.45, rng),
      });
    }
  }
  return cards;
}
