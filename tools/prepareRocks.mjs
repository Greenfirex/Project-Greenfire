// Připraví kameny ze sad z Meshy: v Blenderu je rozřeže a poskládá (bl_rocks.py),
// potom zmenší textury, nastaví nekovový materiál a uloží do public/assets/nature/rocks.
// Každá sada má jednu společnou texturu pro všechny své kameny, takže ji hra načte jen jednou.
// Kameny, které dřív stavěl recept, dostanou rozměry z rock_recipes.json (uložené recepty).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds, prune, dedup, textureCompress } from '@gltf-transform/functions';

const BLENDER = 'C:/Users/lukyl/Downloads/blender-5.2.3-windows-x64/blender.exe';
const ROOT = path.resolve('.').replace(/\\/g, '/');
const RAW_DIR = `${ROOT}/tools/_temp/rocks_raw`;
const TARGET_DIR = 'public/assets/nature/rocks';
const RECIPES = JSON.parse(fs.readFileSync('tools/rock_recipes.json', 'utf8'));

function hash(text) {
  let h = 2166136261;
  for (const char of text) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

function fromRecipe(key, set, tris) {
  const recipe = RECIPES[key];
  const parts = recipe.parts || [{ size: recipe.size, offset: [0, 0, 0] }];
  const used = { flat: 0, block: 0, tall: 0 };
  return {
    key,
    parts: parts.map((part, index) => {
      const [sx, sy, sz] = part.size;
      const box = [sx * 2, sy * 1.5, sz * 2];
      const shape = box[1] < Math.max(box[0], box[2]) * 0.45 ? 'flat' : box[1] > Math.max(box[0], box[2]) * 0.9 ? 'tall' : 'block';
      const pool = set.pieces[shape];
      const start = Math.floor(hash(key) * pool.length);
      const piece = pool[(start + used[shape]) % pool.length];
      used[shape] += 1;
      const yaw = set.spin === false ? 0 : Math.round(hash(`${key}${index}`) * 4) * 90;
      return { piece, box, offset: part.offset, yaw, tris: Math.round(Math.min(tris, Math.max(100, tris * Math.max(box[0], box[2]) / 1.6))) };
    }),
  };
}

const LIGHT = {
  name: 'rocks_light',
  source: '_sources/Meshy_AI_Stone_Study_Collectio_1117122151_texture.glb',
  tint: [0.8, 0.8, 0.8],
  pieces: { flat: [1], block: [0, 2, 4, 5, 6, 7], tall: [3] },
};
LIGHT.rocks = [
  { key: 'rock_small', parts: [{ piece: 7, width: 0.8, tris: 500 }] },
  { key: 'rock_small_flat', parts: [{ piece: 1, width: 1.0, tris: 500 }] },
  { key: 'rock_large', parts: [{ piece: 0, width: 1.6, tris: 900 }] },
  { key: 'rock_large_c', parts: [{ piece: 2, width: 1.45, tris: 900 }] },
  { key: 'rock_tall', parts: [{ piece: 3, height: 1.2, tris: 800 }] },
  {
    key: 'rock_jagged',
    parts: [
      { piece: 4, width: 0.9, tris: 800, offset: [0.12, 0, 0] },
      { piece: 6, width: 0.5, tris: 250, offset: [-0.48, 0, 0.24], yaw: 70 },
      { piece: 7, width: 0.4, tris: 200, offset: [0.44, 0, -0.4], yaw: 200 },
    ],
  },
  {
    key: 'rock_pair',
    parts: [
      { piece: 5, width: 0.8, tris: 600, offset: [-0.3, 0, -0.06] },
      { piece: 6, width: 0.6, tris: 450, offset: [0.34, 0, 0.12], yaw: 140 },
    ],
  },
  {
    key: 'rock_pebbles',
    parts: [
      { piece: 5, width: 0.34, tris: 120, offset: [-0.34, 0, -0.22], yaw: 20 },
      { piece: 6, width: 0.26, tris: 120, offset: [0.05, 0, -0.34], yaw: 110 },
      { piece: 7, width: 0.32, tris: 120, offset: [0.36, 0, -0.1], yaw: 230 },
      { piece: 5, width: 0.28, tris: 120, offset: [-0.12, 0, 0.3], yaw: 300 },
      { piece: 6, width: 0.24, tris: 120, offset: [0.3, 0, 0.28], yaw: 45 },
    ],
  },
  ...['cliff_slab', 'cliff_pile', 'cliff_spire', 'cliff_scatter', 'cliff_mass_a', 'cliff_mass_b'].map((key) => fromRecipe(key, LIGHT, 500)),
];

const DARK = {
  name: 'rocks_dark',
  source: '_sources/Meshy_AI_Stone_Shapes_Study_1117174101_texture.glb',
  tint: [0.81, 0.52, 0.47],
  pieces: { flat: [1, 2, 6, 8], block: [0, 3, 4, 5, 9], tall: [7] },
};
DARK.rocks = [
  ...['cliff_stone_wide', 'cliff_stone_tall', 'cliff_stone_slab', 'cliff_stone_wide_b', 'cliff_stone_tall_b', 'cliff_stone_block', 'cliff_stone_ledge', 'cliff_stone_stack']
    .map((key) => fromRecipe(key, { ...DARK, spin: false }, 300)),
  ...['boulder_small', 'boulder_large', 'boulder_large_c', 'boulder_tall'].map((key) => fromRecipe(key, DARK, 400)),
  ...['cliff_dark_pile', 'cliff_dark_slab', 'cliff_dark_mass', 'cliff_dark_spire'].map((key) => fromRecipe(key, DARK, 500)),
];

const SETS = [LIGHT, DARK];
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
fs.mkdirSync(TARGET_DIR, { recursive: true });
for (const name of fs.readdirSync(TARGET_DIR)) {
  if (/\.(glb|gltf|bin|webp)$/.test(name)) fs.rmSync(path.join(TARGET_DIR, name));
}
for (const set of SETS) {
  fs.rmSync(RAW_DIR, { recursive: true, force: true });
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const run = spawnSync(BLENDER, [
    '--background', '--factory-startup', '--python', 'tools/bl_rocks.py', '--',
    JSON.stringify({ src: `${ROOT}/${set.source}`, outDir: RAW_DIR, rocks: set.rocks }),
  ], { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  console.log(`${run.stdout}\n${run.stderr}`.split('\n').filter((line) => /^ROCK|Error/.test(line)).join('\n'));
  for (const rock of set.rocks) {
    const raw = path.join(RAW_DIR, `${rock.key}.glb`);
    if (!fs.existsSync(raw)) {
      console.error(`chybí ${raw}`);
      continue;
    }
    const doc = await io.read(raw);
    for (const material of doc.getRoot().listMaterials()) {
      material.setBaseColorFactor([...set.tint, 1]).setMetallicFactor(0).setRoughnessFactor(0.9).setMetallicRoughnessTexture(null).setDoubleSided(false);
    }
    await doc.transform(
      dedup(),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 85, resize: [1024, 1024] }),
    );
    for (const material of doc.getRoot().listMaterials()) {
      material.setName(set.name);
      const color = material.getBaseColorTexture();
      const normal = material.getNormalTexture();
      if (color) color.setURI(`${set.name}_color.webp`);
      if (normal) normal.setURI(`${set.name}_normal.webp`);
    }
    for (const buffer of doc.getRoot().listBuffers()) buffer.setURI(`${rock.key}.bin`);
    const target = path.join(TARGET_DIR, `${rock.key}.gltf`);
    await io.write(target, doc);
    const out = getBounds(doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0]);
    const size = out.max.map((value, index) => (value - out.min[index]).toFixed(2)).join(' × ');
    console.log(`hotovo: ${rock.key} | ${size} m | ${(fs.statSync(path.join(TARGET_DIR, `${rock.key}.bin`)).size / 1024).toFixed(0)} kB`);
  }
}
for (const name of fs.readdirSync(TARGET_DIR).filter((file) => file.endsWith('.webp'))) {
  console.log(`textura: ${name} | ${(fs.statSync(path.join(TARGET_DIR, name)).size / 1024).toFixed(0)} kB`);
}
fs.writeFileSync(
  path.join(TARGET_DIR, 'CREDITS.txt'),
  `Kameny — zdroj: Meshy AI (${SETS.map((set) => path.basename(set.source)).join(', ')}), rozřezáno a upraveno pro tento projekt.\n`
    + 'Licence: podle licence účtu Meshy, na kterém byl model vytvořen.\n',
);
