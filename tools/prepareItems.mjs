// Připraví předměty z Meshy pro hru: natočí je, zmenší na skutečnou velikost v metrech, postaví na zem
// se středem v nule a zmenší texturu na 1024 px WebP. Nástroje do ruky (hold) staví vestoje jako ostatní
// zbraně: rukojeť dole na ose, délka 1.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, textureCompress, transformMesh } from '@gltf-transform/functions';

const TURNS = {
  side: [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  flat: [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
};
const HANDLE_SPAN = 0.3;

const ITEMS = {
  cooked_egg: {
    source: '_sources/Meshy_AI_Cracked_Speckled_Egg_20261126_texture.glb',
    turn: 'side',
    size: 0.17,
    roughness: 0.85,
    credit: 'Pečené vejce',
  },
  twine: {
    source: '_sources/Meshy_AI_Straw_Wreath_20261126_texture_opraveno.glb',
    size: 0.14,
    roughness: 0.9,
    credit: 'Provázek (textura dobarvená: prosvítající pozadí nahrazeno barvou slámy)',
  },
  rope: {
    source: '_sources/Meshy_AI_Coiled_Hemp_Rope_20261126_texture_opraveno.glb',
    size: 0.34,
    roughness: 0.9,
    credit: 'Lano (textura dobarvená: šedý konec nahrazen barvou lana)',
  },
  herb: {
    source: '_sources/Meshy_AI_Autumn_Leaf_Bouquet_20261126_texture.glb',
    turn: 'side',
    size: 0.26,
    roughness: 0.8,
    credit: 'Svazek léčivé byliny',
  },
  turtle_shell: {
    source: '_sources/Meshy_AI_Ancient_Tortoise_Shell_20261126_texture.glb',
    size: 0.4,
    roughness: 0.7,
    credit: 'Želví krunýř',
  },
  sharp_stone: {
    source: '_sources/Meshy_AI_Flint_Arrowhead_20261126_texture.glb',
    turn: 'flat',
    size: 0.1,
    roughness: 0.6,
    credit: 'Ostrý kámen (pazourek)',
  },
  stone_axe: {
    source: '_sources/Meshy_AI_Primitive_Stone_Axe_20261126_texture.glb',
    hold: true,
    roughness: 0.8,
    credit: 'Kamenná sekera',
  },
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sceneOf = (root) => root.getDefaultScene() || root.listScenes()[0];

function handleAxis(root, below) {
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

for (const [name, item] of Object.entries(ITEMS)) {
  const targetDir = path.join('public/assets/props', name);
  fs.mkdirSync(targetDir, { recursive: true });
  const doc = await io.read(item.source);
  const root = doc.getRoot();
  if (item.turn) for (const mesh of root.listMeshes()) transformMesh(mesh, TURNS[item.turn]);
  const bounds = getBounds(sceneOf(root));
  const height = bounds.max[1] - bounds.min[1];
  const span = Math.max(bounds.max[0] - bounds.min[0], bounds.max[2] - bounds.min[2]);
  const scale = item.hold ? 1 / height : item.size / span;
  const [cx, cz] = item.hold
    ? handleAxis(root, bounds.min[1] + height * HANDLE_SPAN)
    : [(bounds.min[0] + bounds.max[0]) * 0.5, (bounds.min[2] + bounds.max[2]) * 0.5];
  const fit = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -cx * scale, -bounds.min[1] * scale, -cz * scale, 1];
  for (const mesh of root.listMeshes()) transformMesh(mesh, fit);
  for (const material of root.listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(item.roughness).setMetallicRoughnessTexture(null).setNormalTexture(null);
  }
  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }),
  );
  const target = path.join(targetDir, `${name}.glb`);
  await io.write(target, doc);
  const check = getBounds(sceneOf((await io.read(target)).getRoot()));
  const size = check.max.map((value, index) => (value - check.min[index]).toFixed(3)).join(' × ');
  console.log(`hotovo: ${target} | ${size} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
  fs.writeFileSync(
    path.join(targetDir, 'CREDITS.txt'),
    `${item.credit} — zdroj: Meshy AI (${item.source}), upraveno pro tento projekt.\n`
      + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n',
  );
}
