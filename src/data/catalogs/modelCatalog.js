// Seznam všech modelů ve hře, odvozený přímo z katalogů — nic se tu neopisuje ručně.
// Nový strom, ruda, nástroj nebo stroj v katalogu se do načítání zapojí sám.
import { ASSET_DIRS } from './assetPaths.js';
import { DECORATION_TYPES } from './decorations.js';
import { MACHINE_TYPES } from './machines.js';
import { TOOL_TYPES } from './items.js';
import { BRUSHES } from './brushes.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}KayKit_Adventurers_2.0_FREE/`;

export const PLAYER_MODEL = `${CHARACTER_DIR}Characters/gltf/Ranger.glb`;
export const PLAYER_ANIMS = [
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_General.glb`,
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_Tools.glb`,
];

export const TOOL_DIR = ASSET_DIRS.tools;

export function toolModelUrl(tool) {
  return `${TOOL_DIR}${tool.model}.gltf`;
}

export function collectModelUrls() {
  const urls = new Set();
  for (const def of Object.values(DECORATION_TYPES)) {
    if (def.model) urls.add(def.model);
  }
  for (const def of Object.values(MACHINE_TYPES)) {
    if (def.model) urls.add(def.model);
  }
  for (const tool of Object.values(TOOL_TYPES)) {
    if (tool.model) urls.add(toolModelUrl(tool));
  }
  for (const brush of Object.values(BRUSHES)) {
    for (const key of brush.pool || []) {
      const def = DECORATION_TYPES[key];
      if (def && def.model) urls.add(def.model);
    }
  }
  urls.add(PLAYER_MODEL);
  for (const url of PLAYER_ANIMS) urls.add(url);
  return [...urls];
}
