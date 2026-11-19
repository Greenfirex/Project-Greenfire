// Připraví doškovou střechu srubu z Meshy: natáhne ji na rozměr střechy (hřeben podél X, vršek hřebene
// v nule, střed půdorysu v nule), ztmaví a ztlumí světlé došky do vlhké hnědé a zmenší textury na WebP.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, dedup, textureCompress, transformMesh } from '@gltf-transform/functions';
import { BUILDINGS } from '../src/data/catalogs/buildings.js';

const SOURCE = '_sources/Meshy_AI_Forgotten_Thatch_1119135156_texture.glb';
const TARGET_DIR = 'public/assets/props/cabin_roof';
const { length: LENGTH, width: WIDTH } = BUILDINGS.pirate_cabin.roof;
const COLOR = { brightness: 0.5, saturation: 0.75, hue: -4 };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SOURCE);
const root = doc.getRoot();
const bounds = getBounds(root.getDefaultScene() || root.listScenes()[0]);
const sx = LENGTH / (bounds.max[0] - bounds.min[0]);
const sz = WIDTH / (bounds.max[2] - bounds.min[2]);
const sy = sz;
const cx = (bounds.min[0] + bounds.max[0]) * 0.5;
const cz = (bounds.min[2] + bounds.max[2]) * 0.5;
const fit = [
  sx, 0, 0, 0,
  0, sy, 0, 0,
  0, 0, sz, 0,
  -cx * sx, -bounds.max[1] * sy, -cz * sz, 1,
];
for (const mesh of root.listMeshes()) transformMesh(mesh, fit);
for (const material of root.listMaterials()) {
  material.setMetallicFactor(0).setRoughnessFactor(0.95).setMetallicRoughnessTexture(null).setDoubleSided(true);
}

await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }),
);

for (const material of root.listMaterials()) {
  const texture = material.getBaseColorTexture();
  if (!texture) continue;
  const image = await sharp(Buffer.from(texture.getImage())).modulate(COLOR).webp({ quality: 85 }).toBuffer();
  texture.setImage(new Uint8Array(image));
}

fs.mkdirSync(TARGET_DIR, { recursive: true });
const target = path.join(TARGET_DIR, 'cabin_roof.glb');
await io.write(target, doc);
fs.writeFileSync(
  path.join(TARGET_DIR, 'CREDITS.txt'),
  `Došková střecha srubu — zdroj: Meshy AI (${SOURCE}), upraveno pro tento projekt.\n`
    + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n',
);

const check = await io.read(target);
const out = getBounds(check.getRoot().getDefaultScene() || check.getRoot().listScenes()[0]);
const size = out.max.map((value, index) => (value - out.min[index]).toFixed(2)).join(' × ');
console.log(`hotovo: ${target} | ${size} m | min ${out.min.map((v) => v.toFixed(2))} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
