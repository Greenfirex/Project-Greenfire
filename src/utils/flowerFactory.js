// Květina složená ze stonku, dvou lístků a květu z pěti plátků.
// Šablona se staví jednou pro každou barvu a do světa se vkládá jejím klonem.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createBuffer, buildMesh, pushVertex } from './meshBuilder.js';
import { getFlowerType } from '../data/catalogs/flowers.js';

const templates = new WeakMap();
const STEM_SIDES = 4;

export function flowerTemplate(scene, key) {
  let byKey = templates.get(scene);
  if (!byKey) {
    byKey = new Map();
    templates.set(scene, byKey);
  }
  const cached = byKey.get(key);
  if (cached && !cached.isDisposed()) return cached;
  const type = getFlowerType(key);
  const built = buildFlower(scene, key, type);
  byKey.set(key, built);
  return built;
}

function buildFlower(scene, key, type) {
  const buffer = createBuffer();
  const stem = new Color3(type.stemTint[0], type.stemTint[1], type.stemTint[2]);
  const petal = new Color3(type.petalTint[0], type.petalTint[1], type.petalTint[2]);
  const center = new Color3(type.centerTint[0], type.centerTint[1], type.centerTint[2]);
  addStem(buffer, type, stem);
  addLeaf(buffer, type, stem, 0.35, 0.9);
  addLeaf(buffer, type, stem, 0.55, -0.9);
  addBlossom(buffer, type, petal, center);
  const root = new TransformNode(`tplFlower_${key}`, scene);
  const mesh = buildMesh(scene, `flower_${key}`, buffer, flowerMaterial(scene, key));
  mesh.parent = root;
  root.setEnabled(false);
  return root;
}

function addStem(buffer, type, color) {
  const height = type.height;
  const radius = type.size * 0.16;
  const rings = [0, 0.5, 1];
  const grid = [];
  for (const step of rings) {
    const lean = step * type.size * 0.12;
    const center = new Vector3(lean, height * step, 0);
    const row = [];
    for (let side = 0; side < STEM_SIDES; side += 1) {
      const angle = (side / STEM_SIDES) * Math.PI * 2;
      const normal = new Vector3(Math.cos(angle), 0, Math.sin(angle));
      const point = center.add(normal.scale(radius * (step > 0.9 ? 0.7 : 1)));
      row.push(pushVertex(buffer, point, normal, color, side / STEM_SIDES, step));
    }
    grid.push(row);
  }
  for (let index = 0; index < grid.length - 1; index += 1) {
    for (let side = 0; side < STEM_SIDES; side += 1) {
      const a = grid[index][side];
      const b = grid[index][(side + 1) % STEM_SIDES];
      const c = grid[index + 1][(side + 1) % STEM_SIDES];
      const d = grid[index + 1][side];
      buffer.indices.push(a, b, c, a, c, d);
    }
  }
}

function addLeaf(buffer, type, color, at, side) {
  const base = new Vector3(type.size * 0.02, type.height * at, 0);
  const tip = new Vector3(side * type.size * 0.9, type.height * (at + 0.12), side * type.size * 0.25);
  const across = new Vector3(0, 0, type.size * 0.3 * side);
  const normal = new Vector3(0, 1, 0);
  const a = pushVertex(buffer, base, normal, color, 0, 0);
  const b = pushVertex(buffer, tip.clone().add(across), normal, color, 1, 0.5);
  const c = pushVertex(buffer, tip.clone().subtract(across), normal, color, 1, 1);
  buffer.indices.push(a, b, c);
}

function addBlossom(buffer, type, petal, center) {
  const top = new Vector3(type.size * 0.12, type.height, 0);
  const normal = new Vector3(0, 1, 0);
  const petals = Math.max(4, type.petals || 5);
  for (let index = 0; index < petals; index += 1) {
    const angle = (index / petals) * Math.PI * 2;
    const out = new Vector3(Math.cos(angle), 0, Math.sin(angle));
    const side = new Vector3(-out.z, 0, out.x);
    const base = top.clone().add(out.scale(type.size * 0.16));
    const tip = top.clone().add(out.scale(type.size * 1.65));
    tip.y += type.size * 0.22;
    const half = side.scale(type.size * 0.85);
    const a = pushVertex(buffer, base.clone().subtract(half), normal, petal, 0, 0);
    const b = pushVertex(buffer, base.clone().add(half), normal, petal, 1, 0);
    const c = pushVertex(buffer, tip.clone().add(side.scale(type.size * 0.4)), normal, petal, 1, 1);
    const d = pushVertex(buffer, tip.clone().subtract(side.scale(type.size * 0.4)), normal, petal, 0, 1);
    buffer.indices.push(a, b, c, a, c, d);
  }
  const core = pushVertex(buffer, top.clone().add(new Vector3(0, type.size * 0.22, 0)), normal, center, 0.5, 0.5);
  for (let index = 0; index < petals; index += 1) {
    const angle = (index / petals) * Math.PI * 2;
    const next = angle + (Math.PI * 2) / petals;
    const a = pushVertex(buffer, top.clone().add(new Vector3(Math.cos(angle), 0.12, Math.sin(angle)).scale(type.size * 0.42)), normal, center, 0, 0);
    const b = pushVertex(buffer, top.clone().add(new Vector3(Math.cos(next), 0.12, Math.sin(next)).scale(type.size * 0.42)), normal, center, 1, 0);
    buffer.indices.push(a, b, core);
  }
  if (type.stamen) addStamen(buffer, type, center);
}

function addStamen(buffer, type, color) {
  const start = new Vector3(type.size * 0.12, type.height + type.size * 0.2, 0);
  const end = new Vector3(type.size * 0.5, type.height + type.size * 0.2 + type.stamen, 0);
  const normal = new Vector3(0, 1, 0);
  const half = type.size * 0.07;
  const a = pushVertex(buffer, start.clone().subtract(new Vector3(0, half, 0)), normal, color, 0, 0);
  const b = pushVertex(buffer, start.clone().add(new Vector3(0, half, 0)), normal, color, 1, 0);
  const c = pushVertex(buffer, end.clone().add(new Vector3(0, half, 0)), normal, color, 1, 1);
  const d = pushVertex(buffer, end.clone().subtract(new Vector3(0, half, 0)), normal, color, 0, 1);
  buffer.indices.push(a, b, c, a, c, d);
}

function flowerMaterial(scene, key) {
  const material = new StandardMaterial(`flowerMat_${key}`, scene);
  material.diffuseColor = new Color3(1, 1, 1);
  material.specularColor = new Color3(0.1, 0.1, 0.1);
  material.ambientColor = new Color3(0.18, 0.18, 0.16);
  material.backFaceCulling = false;
  return material;
}
