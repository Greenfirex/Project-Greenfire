// Připraví kraba z Meshy pro hru: vycentruje ho, postaví nohama na nulu,
// sjednotí na šířku 1 m (klepeta k +Z), zmenší textury na 512 px a ztlumí barvu do písku.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, textureCompress, transformMesh } from '@gltf-transform/functions';

const SOURCE = '_sources/crab.glb';
const TARGET_DIR = 'public/assets/nature/crab';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SOURCE);
const root = doc.getRoot();
const bounds = getBounds(root.getDefaultScene() || root.listScenes()[0]);
const scale = 1 / (bounds.max[0] - bounds.min[0]);
const centerX = (bounds.min[0] + bounds.max[0]) * 0.5;
const centerZ = (bounds.min[2] + bounds.max[2]) * 0.5;
const fit = [
  scale, 0, 0, 0,
  0, scale, 0, 0,
  0, 0, scale, 0,
  -centerX * scale, -bounds.min[1] * scale, -centerZ * scale, 1,
];
for (const mesh of root.listMeshes()) transformMesh(mesh, fit);
for (const material of root.listMaterials()) {
  material.setMetallicFactor(0).setRoughnessFactor(0.6).setMetallicRoughnessTexture(null);
}

await doc.transform(
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [512, 512] }),
);

for (const material of root.listMaterials()) {
  const texture = material.getBaseColorTexture();
  if (!texture) continue;
  const image = await sharp(Buffer.from(texture.getImage()))
    .modulate({ saturation: 0.75, brightness: 0.92, hue: 6 })
    .webp({ quality: 85 })
    .toBuffer();
  texture.setImage(new Uint8Array(image));
}

fs.mkdirSync(TARGET_DIR, { recursive: true });
const target = path.join(TARGET_DIR, 'crab.glb');
await io.write(target, doc);
fs.writeFileSync(
  path.join(TARGET_DIR, 'CREDITS.txt'),
  'Model kraba — zdroj: Meshy AI (_sources/crab.glb), upraveno pro tento projekt.\n'
    + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n',
);

const check = await io.read(target);
const out = getBounds(check.getRoot().getDefaultScene() || check.getRoot().listScenes()[0]);
const size = out.max.map((value, index) => (value - out.min[index]).toFixed(3)).join(' × ');
console.log(`hotovo: ${target} | ${size} | min ${out.min.map((v) => v.toFixed(3))} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
