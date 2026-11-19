// Připraví popínavky z Meshy pro stavby: plochou (listy jedním směrem, na stěny) a visící (listy do stran,
// z okapů a zábradlí). Každou postaví na výšku 1 m, spodek do nuly, střed půdorysu do nuly,
// listy k +Z, barvu přiladí k lianám na útesech (teplejší olivová, `tone` = násobek červené, zelené, modré)
// a zmenší textury na WebP. Ve hře se pak natahují podle délky.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, dedup, textureCompress, transformMesh } from '@gltf-transform/functions';

const TARGET_DIR = 'public/assets/nature/plants';
const VINES = [
  { source: '_sources/Meshy_AI_Midnight_Vine_1119141853_texture.glb', target: 'vine_wall.glb', tone: [1.05, 1, 0.2] },
  { source: '_sources/Meshy_AI_Heartleaf_Vine_1119141819_texture.glb', target: 'vine_hang.glb', tone: [0.92, 0.87, 0.16] },
];
const COLOR = { brightness: 1.2, saturation: 1.05 };

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const vine of VINES) {
  const doc = await io.read(vine.source);
  const root = doc.getRoot();
  const bounds = getBounds(root.getDefaultScene() || root.listScenes()[0]);
  const scale = 1 / (bounds.max[1] - bounds.min[1]);
  const cx = (bounds.min[0] + bounds.max[0]) * 0.5;
  const cz = (bounds.min[2] + bounds.max[2]) * 0.5;
  const fit = [
    scale, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, scale, 0,
    -cx * scale, -bounds.min[1] * scale, -cz * scale, 1,
  ];
  for (const mesh of root.listMeshes()) transformMesh(mesh, fit);
  for (const material of root.listMaterials()) {
    material.setMetallicFactor(0).setRoughnessFactor(0.7).setMetallicRoughnessTexture(null).setDoubleSided(true);
  }
  await doc.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [512, 512] }),
  );
  for (const material of root.listMaterials()) {
    const texture = material.getBaseColorTexture();
    if (!texture) continue;
    const image = await sharp(Buffer.from(texture.getImage())).modulate(COLOR).linear(vine.tone, [0, 0, 0]).webp({ quality: 85 }).toBuffer();
    texture.setImage(new Uint8Array(image));
  }
  const target = path.join(TARGET_DIR, vine.target);
  await io.write(target, doc);
  const out = getBounds(doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0]);
  const size = out.max.map((value, index) => (value - out.min[index]).toFixed(2)).join(' × ');
  console.log(`hotovo: ${target} | ${size} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
}
