// Skládá stromy z geometrie v kódu — kmen s kůrou a korunu z průhledných karet.
// Šablona se staví jednou pro každý recept a do světa se vkládá jejím klonem.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getTreeRecipe } from '../data/catalogs/trees.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TreeWindPlugin from '../systems/treeWindPlugin.js';

const templates = new WeakMap();
const stumps = new WeakMap();
const logs = new WeakMap();
const fronds = new WeakMap();
const textures = new WeakMap();
const cutMaterials = new WeakMap();
const TREE_BRIGHTNESS = 1.12;
const CARD_ROLL = 0.7;
const CARD_ASPECT = 0.7;

export function treeTemplate(scene, key) {
  return cachedTemplate(templates, scene, key, (recipe) => buildTree(scene, key, recipe));
}

export function treeStumpTemplate(scene, key) {
  return cachedTemplate(stumps, scene, key, (recipe) => buildStump(scene, key, recipe));
}

export function treeLogTemplate(scene, key) {
  return cachedTemplate(logs, scene, key, (recipe) => buildLog(scene, key, recipe));
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
  } else if (recipe.shape === 'broadleaf') {
    buildBroadleaf(bark, leaves, recipe, rng);
  } else {
    buildTrunk(bark, recipe, rng);
    buildBranches(bark, leaves, recipe, rng);
    buildTop(leaves, recipe, rng);
  }

  const root = new TransformNode(`tplTree_${key}`, scene);
  const barkMesh = buildMesh(scene, `tree_${key}_bark`, bark, barkMaterial(scene, key, recipe));
  const leafMesh = buildMesh(scene, `tree_${key}_leaves`, leaves, leafMaterial(scene, key, recipe));
  const flatLeaves = recipe.shape === 'palm' || recipe.shape === 'broadleaf';
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

function buildMesh(scene, name, buffer, material) {
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
}

function cutMaterial(scene) {
  let material = cutMaterials.get(scene);
  if (material) return material;
  material = new StandardMaterial('treeCut', scene);
  material.diffuseColor = new Color3(0.72, 0.58, 0.42);
  material.specularColor = new Color3(0.05, 0.05, 0.04);
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

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createBuffer() {
  return { positions: [], normals: [], colors: [], uvs: [], indices: [] };
}

function pushVertex(buffer, point, normal, color, u, v) {
  buffer.positions.push(point.x, point.y, point.z);
  buffer.normals.push(normal.x, normal.y, normal.z);
  buffer.colors.push(color.r, color.g, color.b, 1);
  buffer.uvs.push(u, v);
  return buffer.positions.length / 3 - 1;
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
      addBranchCards(leafBuffer, recipe, rng, start, direction, length, t);
    }
  }
}

function addBranchCards(buffer, recipe, rng, start, direction, length, t) {
  const count = Math.max(1, recipe.cardsPerBranch);
  const up = Vector3.Up();
  const lateral = Vector3.Cross(direction, up).normalize();
  const cardLength = length * recipe.cardLength;
  const cardHeight = length * recipe.cardHeight;
  for (let c = 0; c < count; c += 1) {
    const step = count === 1 ? 0.5 : c / (count - 1);
    const along = 0.35 + 0.55 * step;
    const center = start.add(direction.scale(length * along));
    const color = leafShade(recipe, t, rng);
    const uv = pickLeafUv(recipe, rng);
    const tilt = up.add(lateral.scale((rng() - 0.5) * 0.5)).normalize();
    const size = (0.9 + rng() * 0.2) * (1 - 0.35 * step);
    const roll = (rng() - 0.5) * CARD_ROLL;
    addCard(buffer, center, direction, rollLateral(tilt, direction, roll),
      cardLength * size, cardHeight * size, color, uv);
    addCard(buffer, center, direction, rollLateral(lateral, direction, roll),
      cardLength * size, cardHeight * size, color, uv);
  }
  const inner = start.add(direction.scale(length * 0.24));
  const innerColor = leafShade(recipe, t, rng);
  const innerUv = pickLeafUv(recipe, rng);
  addCard(buffer, inner, direction, up, cardLength * 0.7, cardHeight * 0.7, innerColor, innerUv);
  addCard(buffer, inner, direction, lateral, cardLength * 0.7, cardHeight * 0.7, innerColor, innerUv);
}

function rollLateral(lateral, forward, angle) {
  return lateral.scale(Math.cos(angle))
    .add(Vector3.Cross(forward, lateral).scale(Math.sin(angle)))
    .normalize();
}

function pickLeafUv(recipe, rng) {
  const windows = recipe.leafUv;
  if (!windows || !windows.length) return null;
  return windows[Math.floor(rng() * windows.length)];
}

function buildTop(buffer, recipe, rng) {
  const top = trunkAxis(recipe, 0.96);
  const count = 3;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + rng() * 0.6;
    const direction = new Vector3(Math.cos(angle) * 0.45, 1, Math.sin(angle) * 0.45).normalize();
    const lateral = Vector3.Cross(direction, Vector3.Up()).normalize();
    const color = leafShade(recipe, 1, rng);
    const size = recipe.height * 0.16;
    const center = top.add(direction.scale(size * 0.3));
    addCard(buffer, center, direction, Vector3.Up(), size, size * 0.55, color);
    addCard(buffer, center, direction, lateral, size, size * 0.55, color);
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
  const bark = createBuffer();
  const cut = createBuffer();
  const y = radius;
  const half = length / 2;
  const points = [new Vector3(-half, y, 0), new Vector3(0, y, 0), new Vector3(half, y, 0)];
  const radii = [radius * 0.94, radius, radius * 0.94];
  addTube(bark, points, radii, sides, () => new Color3(0.95, 0.92, 0.88), [1, Math.max(1, length / 0.9)]);
  addCap(cut, new Vector3(half, y, 0), new Vector3(1, 0, 0), radius * 0.94, sides, new Color3(1, 1, 1));
  addCap(cut, new Vector3(-half, y, 0), new Vector3(-1, 0, 0), radius * 0.94, sides, new Color3(1, 1, 1));
  return assembleTemplate(scene, `tplLog_${key}`, [
    [bark, barkMaterial(scene, `${key}_log`, recipe, false)],
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

function buildBroadleaf(bark, leaves, recipe, rng) {
  const top = Math.min(0.9, Math.max(0.2, recipe.trunkTop));
  const rings = Math.max(3, recipe.trunkRings);
  const points = [];
  const radii = [];
  for (let i = 0; i < rings; i += 1) {
    const t = (i / (rings - 1)) * top;
    points.push(trunkAxis(recipe, t));
    radii.push(recipe.trunkRadius * Math.pow(1 - t / top, 0.75) + 0.03);
  }
  addTube(bark, points, radii, recipe.trunkSides, (t) => barkShade(recipe, t, rng),
    [1, Math.max(1, recipe.height / 2.6)]);
  addCap(bark, points[points.length - 1], tangentAt(points, points.length - 1),
    radii[radii.length - 1], recipe.trunkSides, barkShade(recipe, top, rng));

  const fork = points[points.length - 1];
  const limbs = Math.max(2, recipe.limbs);
  const reach = recipe.limbLength;
  const rootRadius = radii[radii.length - 1] * 0.85;
  for (let i = 0; i < limbs; i += 1) {
    const angle = (i / limbs) * Math.PI * 2 + rng() * 0.5;
    const outward = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const direction = outward.scale(recipe.limbSpread).add(Vector3.Up()).normalize();
    const start = fork.subtract(Vector3.Up().scale(0.06));
    const mid = start.add(direction.scale(reach * 0.55));
    const rise = direction.add(Vector3.Up().scale(0.2)).normalize();
    const end = mid.add(rise.scale(reach * 0.45));
    const limb = [start, mid, end];
    addTube(bark, limb, [rootRadius, rootRadius * 0.55, 0.025],
      Math.max(5, recipe.trunkSides - 3), (t) => barkShade(recipe, top + t * 0.3, rng), [1, 1.4]);
    addCap(bark, end, tangentAt(limb, 2), 0.025, 6, barkShade(recipe, 1, rng));
  }

  buildBroadleafCrown(leaves, recipe, rng, fork.add(Vector3.Up().scale(recipe.crownLift)));
}

function buildBroadleafCrown(buffer, recipe, rng, base) {
  const layers = Math.max(1, recipe.layers);
  const perLayer = Math.max(4, recipe.cardsPerLayer);
  for (let l = 0; l < layers; l += 1) {
    const lf = (l + 0.5) / layers;
    const shell = 0.5 + 0.5 * Math.sin(Math.PI * lf);
    const level = recipe.crownHeight * (lf - 0.5);
    for (let i = 0; i < perLayer; i += 1) {
      const angle = rng() * Math.PI * 2;
      const rise = (rng() - 0.5) * 1.1;
      const direction = new Vector3(Math.cos(angle), rise, Math.sin(angle)).normalize();
      const radial = recipe.crownRadius * shell * (0.75 + rng() * 0.35);
      const position = base.add(new Vector3(
        direction.x * radial,
        level + direction.y * recipe.crownHeight * 0.4,
        direction.z * radial,
      ));
      const normal = direction.add(Vector3.Up().scale(0.2)).normalize();
      const size = recipe.cardSize * (0.8 + rng() * 0.4);
      addFacingCard(buffer, position, normal, size, leafShade(recipe, 0.4 + 0.55 * lf, rng),
        pickLeafUv(recipe, rng), rng() * Math.PI * 2);
    }
  }
  const tuft = Math.max(2, Math.round(perLayer * 0.3));
  for (let i = 0; i < tuft; i += 1) {
    const angle = rng() * Math.PI * 2;
    const position = base.add(new Vector3(
      Math.cos(angle) * recipe.crownRadius * 0.35,
      recipe.crownHeight * 0.55,
      Math.sin(angle) * recipe.crownRadius * 0.35,
    ));
    const normal = new Vector3(Math.cos(angle), 1.6, Math.sin(angle)).normalize();
    addFacingCard(buffer, position, normal, recipe.cardSize * 0.9,
      leafShade(recipe, 1, rng), pickLeafUv(recipe, rng), rng() * Math.PI * 2);
  }
}

function addFacingCard(buffer, center, normal, size, color, uv, roll) {
  const face = normal.normalize();
  const helper = Math.abs(face.y) < 0.9 ? Vector3.Up() : Vector3.Right();
  const tangent = Vector3.Cross(face, helper).normalize();
  const bitangent = Vector3.Cross(face, tangent).normalize();
  const forward = tangent.scale(Math.cos(roll)).add(bitangent.scale(Math.sin(roll))).normalize();
  const lateral = Vector3.Cross(face, forward).normalize();
  addCard(buffer, center, forward, lateral, size, size * CARD_ASPECT, color, uv);
}

