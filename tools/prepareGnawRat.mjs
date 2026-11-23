// Připraví hryzokrysu z Meshy pro hru: kostra, tvar a animace zůstanou, textura se zmenší
// na 1024 px (WebP) a z animací zmizí stopy, které nic nemění (měřítko, posun kostí mimo kořen).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, resample, textureCompress } from '@gltf-transform/functions';

const SOURCE = '_sources/Meshy_AI_A_single_giant_cave_rat_monster_creature_20261122_animated_All_animation (1).glb';
const TARGET_DIR = 'public/assets/creatures/gnaw_rat';
const TEXTURE_SIZE = 1024;
const MOVING_BONE = 'root';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(SOURCE);
for (const animation of doc.getRoot().listAnimations()) {
  for (const channel of animation.listChannels()) {
    const path = channel.getTargetPath();
    const bone = channel.getTargetNode() ? channel.getTargetNode().getName() : '';
    if (path === 'scale' || (path === 'translation' && bone !== MOVING_BONE)) channel.dispose();
  }
}
await doc.transform(
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [TEXTURE_SIZE, TEXTURE_SIZE] }),
);

fs.mkdirSync(TARGET_DIR, { recursive: true });
const target = path.join(TARGET_DIR, 'gnaw_rat.glb');
await io.write(target, doc);
fs.writeFileSync(
  path.join(TARGET_DIR, 'CREDITS.txt'),
  `Model a animace Hryzokrysa — zdroj: Meshy AI (${path.basename(SOURCE)}), upraveno pro tento projekt.\n`
    + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n'
    + `Upraveno: textura zmenšená na ${TEXTURE_SIZE} px (WebP), z animací odebrané stopy beze změny.\n`,
);

const check = await io.read(target);
const root = check.getRoot();
const skins = root.listSkins().map((skin) => skin.listJoints().length);
const clips = root.listAnimations().map((animation) => animation.getName());
console.log(`hotovo: ${target} | kosti ${skins.join(', ')} | ${(fs.statSync(target).size / 1024).toFixed(0)} kB`);
console.log(`animace: ${clips.join(', ')}`);
