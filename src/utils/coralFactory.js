// Koraly ze dna — jeden shluk se v kódu skládá z vějířů, trsů a mozkových korálů.
// Šablona se staví jednou pro každý recept a do světa se vkládá jejím klonem.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { createBuffer, buildMesh, pushVertex, mulberry32 } from './meshBuilder.js';
import { getCoralRecipe } from '../data/catalogs/corals.js';

const templates = new WeakMap();
const materials = new WeakMap();

export function coralTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const existing = byKey.get(key);
  if (existing && !existing.isDisposed()) return existing;
  const recipe = getCoralRecipe(key);
  if (!recipe) return null;
  const built = buildCoralTemplate(scene, key, recipe);
  byKey.set(key, built);
  return built;
}

function buildCoralTemplate(scene, key, recipe) {
  const buffer = createBuffer();
  fillClump(buffer, recipe);
  finishNormals(buffer);
  const root = new TransformNode(`tplCoral_${key}`, scene);
  const mesh = buildMesh(scene, `coral_${key}`, buffer, coralMaterial(scene, key));
  mesh.parent = root;
  root.setEnabled(false);
  return root;
}

function shadeBetween(base, tip) {
  return (t) => new Color3(
    base[0] + (tip[0] - base[0]) * t,
    base[1] + (tip[1] - base[1]) * t,
    base[2] + (tip[2] - base[2]) * t,
  );
}

function fillBranches(buffer, recipe) {
  const [width, height] = recipe.size;
  const rng = mulberry32(recipe.seed || 1);
  const count = Math.max(3, recipe.branches || 6);
  const lean = recipe.lean === undefined ? 0.5 : recipe.lean;
  const shade = shadeBetween(recipe.baseTint, recipe.tipTint);
  for (let branch = 0; branch < count; branch += 1) {
    const angle = (branch / count) * Math.PI * 2 + rng() * 0.3;
    const reach = (0.15 + rng() * 0.35) * width * lean;
    const start = new Vector3(Math.cos(angle) * reach * 0.35, 0, Math.sin(angle) * reach * 0.35);
    const points = [];
    const radii = [];
    const steps = 4;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const spread = reach * (0.25 + 0.75 * t);
      points.push(new Vector3(
        start.x + Math.cos(angle) * spread * t,
        height * t * (0.9 + rng() * 0.12),
        start.z + Math.sin(angle) * spread * t,
      ));
      radii.push(recipe.radius * (1 - 0.72 * t));
    }
    addTube(buffer, points, radii, 6, shade);
  }
}

function fillFan(buffer, recipe) {
  const height = recipe.size[1];
  const rng = mulberry32(recipe.seed || 1);
  const count = Math.max(5, recipe.branches || 9);
  const half = (recipe.spread || 1.1) * 0.5;
  const shade = shadeBetween(recipe.baseTint, recipe.tipTint);
  for (let branch = 0; branch < count; branch += 1) {
    const t = count === 1 ? 0.5 : branch / (count - 1);
    const angle = -half + 2 * half * t;
    const points = [];
    const radii = [];
    const steps = 4;
    for (let step = 0; step <= steps; step += 1) {
      const k = step / steps;
      const reach = (0.32 + 0.68 * k) * height;
      points.push(new Vector3(
        (t - 0.5) * 0.05 + Math.sin(angle) * reach,
        Math.cos(angle) * reach,
        (rng() - 0.5) * 0.02,
      ));
      radii.push(recipe.radius * (1 - 0.6 * k));
    }
    addTube(buffer, points, radii, 5, shade);
  }
}

function fillBrain(buffer, recipe) {
  const [width, height, depth] = recipe.size;
  const rings = 6;
  const sides = 20;
  const shade = shadeBetween(recipe.baseTint, recipe.tipTint);
  const grid = [];
  for (let ring = 0; ring <= rings; ring += 1) {
    const phi = (ring / rings) * 1.45;
    const y = Math.sin(phi) * height;
    const narrow = Math.cos(phi);
    const row = [];
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const ridge = 1 + (recipe.ridge || 0.08) * Math.sin((recipe.ribs || 8) * angle + phi * 2.5);
      const point = new Vector3(
        Math.cos(angle) * width * 0.5 * narrow * ridge,
        y,
        Math.sin(angle) * depth * 0.5 * narrow * ridge,
      );
      row.push(pushVertex(buffer, point, Vector3.Up(), shade(ring / rings), side / sides, ring / rings));
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
  const top = pushVertex(buffer, new Vector3(0, height, 0), Vector3.Up(), shade(1), 0.5, 1);
  for (let side = 0; side < sides; side += 1) {
    buffer.indices.push(grid[rings][side], grid[rings][(side + 1) % sides], top);
  }
  const bottom = pushVertex(buffer, new Vector3(0, 0, 0), Vector3.Down(), shade(0), 0.5, 0);
  for (let side = 0; side < sides; side += 1) {
    buffer.indices.push(grid[0][(side + 1) % sides], grid[0][side], bottom);
  }
}

function addTube(buffer, points, radii, sides, shade) {
  const rings = [];
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const direction = next.subtract(previous);
    const axis = direction.lengthSquared() < 1e-8 ? new Vector3(0, 1, 0) : direction.normalize();
    const up = Math.abs(axis.y) > 0.9 ? new Vector3(1, 0, 0) : Vector3.Up();
    const sideAxis = Vector3.Cross(axis, up).normalize();
    const otherAxis = Vector3.Cross(axis, sideAxis).normalize();
    const t = index / (points.length - 1);
    const color = shade(t);
    const ring = [];
    for (let side = 0; side < sides; side += 1) {
      const angle = (side / sides) * Math.PI * 2;
      const point = points[index]
        .add(sideAxis.scale(Math.cos(angle) * radii[index]))
        .add(otherAxis.scale(Math.sin(angle) * radii[index]));
      ring.push(pushVertex(buffer, point, axis, color, side / sides, t));
    }
    rings.push(ring);
  }
  for (let index = 0; index < rings.length - 1; index += 1) {
    for (let side = 0; side < sides; side += 1) {
      const a = rings[index][side];
      const b = rings[index][(side + 1) % sides];
      const c = rings[index + 1][(side + 1) % sides];
      const d = rings[index + 1][side];
      buffer.indices.push(a, b, c, a, c, d);
    }
  }
  const tip = rings[rings.length - 1];
  const center = pushVertex(
    buffer,
    points[points.length - 1],
    new Vector3(0, 1, 0),
    shade(1),
    0.5,
    1,
  );
  for (let side = 0; side < sides; side += 1) {
    buffer.indices.push(tip[side], tip[(side + 1) % sides], center);
  }
}

function fillClump(buffer, recipe) {
  const rng = mulberry32(recipe.seed || 1);
  const count = Math.max(2, Math.round(recipe.parts || 4));
  const spread = recipe.spread === undefined ? 0.35 : recipe.spread;
  for (let part = 0; part < count; part += 1) {
    const piece = createBuffer();
    const sub = partRecipe(recipe, rng);
    if (sub.shape === 'fan') fillFan(piece, sub);
    else if (sub.shape === 'brain') fillBrain(piece, sub);
    else fillBranches(piece, sub);
    const angle = rng() * Math.PI * 2;
    const reach = spread * (0.25 + rng() * 0.75);
    appendPiece(buffer, piece, {
      x: Math.cos(angle) * reach,
      z: Math.sin(angle) * reach,
      y: 0,
      yaw: rng() * Math.PI * 2,
      scale: 0.45 + rng() * 0.35,
    });
  }
}

function partRecipe(recipe, rng) {
  const shapes = Array.isArray(recipe.shapes) && recipe.shapes.length
    ? recipe.shapes
    : ['fan', 'branch', 'brain'];
  const shape = shapes[Math.floor(rng() * shapes.length) % shapes.length];
  const base = recipe.size ? recipe.size[0] : 0.5;
  const size = base * (0.4 + rng() * 0.35);
  return {
    shape,
    seed: 1 + Math.floor(rng() * 100000),
    size: [size, size * (0.65 + rng() * 0.45), size * (0.65 + rng() * 0.45)],
    branches: (shape === 'fan' ? 7 : 5) + Math.floor(rng() * 5),
    radius: (recipe.radius || 0.03) * (0.7 + rng() * 0.7),
    spread: 0.9 + rng() * 0.5,
    lean: 0.4 + rng() * 0.4,
    ribs: 7 + Math.floor(rng() * 4),
    ridge: 0.08,
    baseTint: recipe.baseTint,
    tipTint: recipe.tipTint,
  };
}

function appendPiece(buffer, piece, place) {
  const cos = Math.cos(place.yaw);
  const sin = Math.sin(place.yaw);
  const lift = place.y || 0;
  const offset = buffer.positions.length / 3;
  for (let index = 0; index < piece.positions.length; index += 3) {
    const px = piece.positions[index] * place.scale;
    const py = piece.positions[index + 1] * place.scale;
    const pz = piece.positions[index + 2] * place.scale;
    buffer.positions.push(px * cos - pz * sin + place.x, py + lift, px * sin + pz * cos + place.z);
  }
  for (const value of piece.colors) buffer.colors.push(value);
  for (const value of piece.uvs) buffer.uvs.push(value);
  for (const value of piece.indices) buffer.indices.push(value + offset);
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

function coralMaterial(scene, key) {
  let byKey = materials.get(scene);
  if (!byKey) {
    byKey = new Map();
    materials.set(scene, byKey);
  }
  const existing = byKey.get(key);
  if (existing) return existing;
  const material = new StandardMaterial(`coralMat_${key}`, scene);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0.12, 0.12, 0.12);
  material.ambientColor = new Color3(0.16, 0.15, 0.15);
  material.backFaceCulling = false;
  byKey.set(key, material);
  return material;
}