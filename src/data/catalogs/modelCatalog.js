// Seznam modelů nutných ke startu hry — postava, animace, nástroj a tvorové.
// Dekorace mapy se načítají on-demand při stavbě světa (viz loadStageModels).
import { ASSET_DIRS } from './assetPaths.js';
import { TOOL_TYPES } from './items.js';
import { CREATURE_TYPES } from './creatures/index.js';
import { grassStartupUrls } from './grass.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}castaway/`;

export const PLAYER_MODEL = `${CHARACTER_DIR}castaway.glb`;
export const PLAYER_ANIMS = [];
export const PLAYER_ASSET_URLS = [PLAYER_MODEL, ...PLAYER_ANIMS];

export const PLAYER_BASE_HEIGHT = 1.7;
export const PLAYER_MODEL_YAW = 0;
export const PLAYER_INTRO_YAW = Math.PI * 0.75;
export const PLAYER_FOOT_BONES = {
  left: ['LeftFoot', 'mixamorig:LeftFoot', 'foot_l', 'foot.l'],
  right: ['RightFoot', 'mixamorig:RightFoot', 'foot_r', 'foot.r'],
};

export const PLAYER_TOE_BONES = {
  left: ['LeftToeBase', 'mixamorig:LeftToeBase', 'toe_l', 'toe.l'],
  right: ['RightToeBase', 'mixamorig:RightToeBase', 'toe_r', 'toe.r'],
};

export const PLAYER_HAND_BONES = [
  'RightHand',
  'mixamorig:RightHand',
  'handslot.r',
  'hand_r',
  'hand.r',
];

export const PLAYER_HEAD_BONES = ['Head', 'mixamorig:Head'];
export const PLAYER_HEAD_TOP = ['head_end', 'HeadTop_End', 'mixamorig:HeadTop_End'];
export const PLAYER_HEAD_FRONT = ['headfront'];

export const PLAYER_ANIM_LIBRARY = {
  walking: 'Walking',
  running: 'Running',
  attack: 'Attack',
  boxingPunch: 'Boxing_Guard_Prep_Straight_Punch',
  chargedSlash: 'Charged_Slash',
  collectObject: 'Collect_Object',
  combatStance: 'Combat_Stance',
  facePunch: 'Face_Punch_Reaction',
  hammerSwing: 'Heavy_Hammer_Swing',
  idle11: 'Idle_11',
  leftSlash: 'Left_Slash',
  swordSlash: 'Right_Hand_Sword_Slash',
  shotInBack: 'Shot_in_the_Back_and_Fall',
  kick: 'Boxing_Guard_Right_Straight_Kick',
  standUp1: 'Stand_Up1',
  drink: 'Stand_and_Drink',
  dyingBackwards: 'dying_backwards',
};

export const PLAYER_ANIM_NAMES = {
  idle: PLAYER_ANIM_LIBRARY.idle11,
  walk: PLAYER_ANIM_LIBRARY.walking,
  run: PLAYER_ANIM_LIBRARY.running,
  jump: null,
  chop: PLAYER_ANIM_LIBRARY.swordSlash,
  mine: PLAYER_ANIM_LIBRARY.hammerSwing,
  punch: PLAYER_ANIM_LIBRARY.boxingPunch,
  kick: PLAYER_ANIM_LIBRARY.kick,
  holdTool: PLAYER_ANIM_LIBRARY.idle11,
  ignite: PLAYER_ANIM_LIBRARY.collectObject,
  pickup: PLAYER_ANIM_LIBRARY.collectObject,
  combatStance: PLAYER_ANIM_LIBRARY.combatStance,
  getUp: PLAYER_ANIM_LIBRARY.standUp1,
  flinch: PLAYER_ANIM_LIBRARY.facePunch,
  dieFall: PLAYER_ANIM_LIBRARY.dyingBackwards,
  dieShot: PLAYER_ANIM_LIBRARY.shotInBack,
};

export const PLAYER_ANIM_SPEEDS = {
  chop: 1.35,
  mine: 1.1,
  punch: 1.8,
  kick: 1.4,
  ignite: 2.5,
  pickup: 3.0,
  getUp: 1,
  flinch: 2,
};

export const PLAYER_ANIM_RANGES = {
  punch: { start: 1.1, end: 2.7 },
  flinch: { start: 0.0, end: 1.0 },
};

export const PLAYER_ANIM_ROOTLESS = ['punch'];

export const PLAYER_DEATH_OVERLAY_SHARE = {
  dieFall: 0.8,
  dieShot: 0.6,
};

export const PLAYER_ANIM_FALLBACKS = {
  chop: ['chop', 'mine', 'punch', 'kick'],
  mine: ['mine', 'chop', 'punch', 'kick'],
  punch: ['punch', 'kick', 'chop'],
  kick: ['kick', 'punch', 'chop'],
  holdTool: ['holdTool', 'idle'],
  ignite: ['ignite', 'pickup', 'punch', 'idle'],
  pickup: ['pickup', 'ignite', 'punch', 'idle'],
  getUp: ['getUp'],
  dieFall: ['dieFall', 'dieShot'],
  dieShot: ['dieShot', 'dieFall'],
};

export const TOOL_DIR = ASSET_DIRS.tools;

export const CREATURE_MODEL_URLS = Object.values(CREATURE_TYPES)
  .map((type) => (type ? type.model : null))
  .filter(Boolean);

export function toolModelUrl(tool) {
  return tool.file || `${TOOL_DIR}${tool.model}.gltf`;
}

export function collectStartupUrls(heldTool = null) {
  const urls = new Set();
  const tool = heldTool ? TOOL_TYPES[heldTool] : null;
  if (tool && tool.model) urls.add(toolModelUrl(tool));
  for (const url of CREATURE_MODEL_URLS) urls.add(url);
  urls.add(PLAYER_MODEL);
  for (const url of PLAYER_ANIMS) urls.add(url);
  for (const url of grassStartupUrls()) urls.add(url);
  return [...urls];
}
