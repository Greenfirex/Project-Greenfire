// Seznam modelů nutných ke startu hry — postava, animace, nástroj, stroje a tvorové.
// Dekorace mapy se načítají on-demand při stavbě světa (viz loadStageModels).
import { ASSET_DIRS } from './assetPaths.js';
import { MACHINE_TYPES } from './machines.js';
import { TOOL_TYPES } from './items.js';
import { CREATURE_TYPES } from './creatures/index.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}KayKit_Adventurers_2.0_FREE/`;

export const PLAYER_MODEL = `${CHARACTER_DIR}Characters/gltf/Ranger.glb`;
export const PLAYER_ANIMS = [
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_General.glb`,
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,
  `${CHARACTER_DIR}Animations/gltf/Rig_Medium/Rig_Medium_Tools.glb`,
];

export const TOOL_DIR = ASSET_DIRS.tools;

export const CREATURE_MODEL_URLS = Object.values(CREATURE_TYPES)
  .map((type) => (type ? type.model : null))
  .filter(Boolean);

export function toolModelUrl(tool) {
  return `${TOOL_DIR}${tool.model}.gltf`;
}

export function collectStartupUrls(heldTool = null) {
  const urls = new Set();
  for (const def of Object.values(MACHINE_TYPES)) {
    if (def.model) urls.add(def.model);
  }
  const tool = heldTool ? TOOL_TYPES[heldTool] : null;
  if (tool && tool.model) urls.add(toolModelUrl(tool));
  for (const url of CREATURE_MODEL_URLS) urls.add(url);
  urls.add(PLAYER_MODEL);
  for (const url of PLAYER_ANIMS) urls.add(url);
  return [...urls];
}
