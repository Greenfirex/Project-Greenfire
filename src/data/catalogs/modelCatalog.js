// Seznam modelů nutných ke startu hry — postava, animace, nástroj, stroje a tvorové.
// Dekorace mapy se načítají on-demand při stavbě světa (viz loadStageModels).
import { ASSET_DIRS } from './assetPaths.js';
import { MACHINE_TYPES } from './machines.js';
import { TOOL_TYPES } from './items.js';
import { CREATURE_TYPES } from './creatures/index.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}castaway/`;

export const PLAYER_MODEL = `${CHARACTER_DIR}castaway.glb`;
export const PLAYER_ANIMS = [];
export const PLAYER_ASSET_URLS = [PLAYER_MODEL, ...PLAYER_ANIMS];

export const PLAYER_BASE_HEIGHT = 1.7;
export const PLAYER_MODEL_YAW = 0;
export const PLAYER_INTRO_YAW = Math.PI * 0.75;
export const PLAYER_HAND_BONES = [
  'RightHand',
  'mixamorig:RightHand',
  'handslot.r',
  'hand_r',
  'hand.r',
];

export const PLAYER_ANIM_NAMES = {
  idle: 'Idle_11',
  walk: 'Walking',
  run: 'Running',
  jump: null,
  chop: 'Right_Hand_Sword_Slash',
  mine: 'Heavy_Hammer_Swing',
  chopBare: 'Right_Hand_Sword_Slash',
  holdTool: 'Idle_11',
  ignite: 'Male_Bend_Over_Pick_Up',
  pickup: 'Male_Bend_Over_Pick_Up',
  getUp: 'Stand_Up1',
};

export const PLAYER_ANIM_SPEEDS = {
  chop: 1.35,
  mine: 1.1,
  chopBare: 1.35,
  ignite: 2.5,
  pickup: 3.0,
  getUp: 1,
};

export const PLAYER_ANIM_FALLBACKS = {
  chop: ['chop', 'mine', 'chopBare'],
  mine: ['mine', 'chop', 'chopBare'],
  chopBare: ['chopBare', 'chop', 'mine'],
  holdTool: ['holdTool', 'idle'],
  ignite: ['ignite', 'chopBare', 'chop', 'idle'],
  pickup: ['pickup', 'ignite', 'chopBare', 'idle'],
  getUp: ['getUp'],
};

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
