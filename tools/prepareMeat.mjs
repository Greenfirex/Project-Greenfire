// Připraví syrové a pečené maso z Meshy pro hru: stlačí kus na tloušťku steaku (kost nechá), otočí ho kostí dolů
// (osa Y míří od kosti k masu, jak ho postava drží u pusy), sjednotí na délku 1 se středem v nule a osou Y středem kosti
// a zmenší texturu na 1024 px WebP. Oba zdroje mají stejný tvar, liší se jen texturou.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, textureCompress, transformMesh } from '@gltf-transform/functions';

const SOURCES = {
  meat_raw: '_sources/Meshy_AI_Pomegranate_Half_20261124_texture (1).glb',
  meat_cooked: '_sources/Meshy_AI_Pomegranate_Half_20261124_texture.glb',
};
const TARGET_DIR = 'public/assets/props/meat';
const THICKNESS = 0.65;
const BONE_FROM = -0.40;
const BONE_BLEND = 0.10;
const SLICE = 0.04;
const BONE_SPAN = 0.12;

function flatten(prim) {
  const pos = prim.getAttribute('POSITION');
  const nor = prim.getAttribute('NORMAL');
  const v = [];
  const top = new Map();
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v);
    const bin = Math.floor(v[2] / SLICE);
    top.set(bin, Math.max(top.get(bin) ?? -Infinity, v[1]));
  }
  const smooth = new Map([...top.keys()].map((bin) => {
    const near = [bin - 1, bin, bin + 1].filter((key) => top.has(key)).map((key) => top.get(key));
    return [bin, near.reduce((sum, value) => sum + value, 0) / near.length];
  }));
  const topAt = (z) => {
    const f = z / SLICE - 0.5;
    const bin = Math.floor(f);
    const a = smooth.get(bin) ?? smooth.get(bin + 1);
    const b = smooth.get(bin + 1) ?? a;
    return a + (b - a) * (f - bin);
  };
  const squashAt = (z) => 1 + (THICKNESS - 1) * Math.min(1, Math.max(0, (z - BONE_FROM) / BONE_BLEND));
  const n = [];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, v);
    const k = squashAt(v[2]);
    const t = topAt(v[2]);
    const slope = (topAt(v[2] + 0.01) - topAt(v[2] - 0.01)) / 0.02;
    pos.setElement(i, [v[0], t - (t - v[1]) * k, v[2]]);
    if (!nor) continue;
    nor.getElement(i, n);
    const m = [n[0], n[1] / k, n[2] - ((slope * (1 - k)) / k) * n[1]];
    const length = Math.hypot(...m) || 1;
    nor.setElement(i, m.map((value) => value / length));
  }
}

function boneAxis(root, below) {
  let x = 0;
  let z = 0;
  let count = 0;
  const v = [];
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION');
    for (let i = 0; i < pos.getCount(); i++) {
      pos.getElement(i, v);
      if (v[1] > below) continue;
      x += v[0];
      z += v[2];
      count++;
    }
  }
  return count ? [x / count, z / count] : [0, 0];
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(TARGET_DIR, { recursive: true });

for (const [name, source] of Object.entries(SOURCES)) {
  const doc = await io.read(source);
  const root = doc.getRoot();
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) flatten(prim);
  const upright = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];
  for (const mesh of root.listMeshes()) transformMesh(mesh, upright);
  const bounds = getBounds(root.getDefaultScene() || root.listScenes()[0]);
  const scale = 1 / (bounds.max[1] - bounds.min[1]);
  const [cx, cz] = boneAxis(root, bounds.min[1] + (bounds.max[1] - bounds.min[1]) * BONE_SPAN);
  const fit = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -cx * scale, -(bounds.min[1] + bounds.max[1]) * 0.5 * scale, -cz * scale, 1];
  for (const mesh of root.listMeshes()) transformMesh(mesh, fit);
  for (const material of root.listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(0.6).setMetallicRoughnessTexture(null);
  }
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }),
  );
  const target = path.join(TARGET_DIR, `${name}.glb`);
  await io.write(target, doc);
  const check = getBounds((await io.read(target)).getRoot().listScenes()[0]);
  const size = check.max.map((value, index) => (value - check.min[index]).toFixed(3)).join(' × ');
  console.log(`hotovo: ${target} | ${size} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
}

fs.writeFileSync(
  path.join(TARGET_DIR, 'CREDITS.txt'),
  'Syrové a pečené maso — zdroj: Meshy AI (_sources/Meshy_AI_Pomegranate_Half_20261124_texture*.glb), upraveno pro tento projekt.\n'
    + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n',
);
