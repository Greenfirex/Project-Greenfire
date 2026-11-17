// Seznam modelů nutných ke startu hry — postava, animace, nástroj a tvorové.
// Dekorace mapy se načítají on-demand při stavbě světa (viz loadStageModels).
import { ASSET_DIRS } from './assetPaths.js';
import { TOOL_TYPES } from './items.js';
import { CREATURE_TYPES } from './creatures/index.js';
import { FISH_MODEL_URLS } from './fish.js';
import { grassStartupUrls } from './grass.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}castaway/`;

export const PLAYER_MODEL = `${CHARACTER_DIR}castaway.glb`;
export const PLAYER_ANIMS = [`${CHARACTER_DIR}castaway_combat.glb`, `${CHARACTER_DIR}castaway_double.glb`];
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

export const PLAYER_UPPER_ARM_BONES = ['RightArm', 'mixamorig:RightArm'];
export const PLAYER_FOREARM_BONES = ['RightForeArm', 'mixamorig:RightForeArm'];
export const PLAYER_LEFT_UPPER_ARM_BONES = ['LeftArm', 'mixamorig:LeftArm'];
export const PLAYER_LEFT_FOREARM_BONES = ['LeftForeArm', 'mixamorig:LeftForeArm'];
export const PLAYER_LEFT_HAND_BONES = ['LeftHand', 'mixamorig:LeftHand'];
export const PLAYER_SPINE_BONES = ['Spine01', 'Spine02', 'mixamorig:Spine1', 'mixamorig:Spine2'];
export const PLAYER_LOWER_SPINE_BONES = ['Spine', 'mixamorig:Spine'];
export const PLAYER_LEFT_THIGH_BONES = ['LeftUpLeg', 'mixamorig:LeftUpLeg'];
export const PLAYER_RIGHT_THIGH_BONES = ['RightUpLeg', 'mixamorig:RightUpLeg'];
export const PLAYER_FINGER_BONES = [
  'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
  'RightHandMiddle1', 'RightHandMiddle2', 'RightHandMiddle3',
  'RightHandRing1', 'RightHandRing2', 'RightHandRing3',
  'RightHandPinky1', 'RightHandPinky2', 'RightHandPinky3',
];
export const PLAYER_FIST_BONES = ['RightHandMiddle1', 'RightHandMiddle3', 'RightHandIndex1', 'RightHandRing1'];
export const PLAYER_THUMB_BONES = ['RightHandThumb2'];
export const PLAYER_GRIP_LINE_BONES = { front: 'RightHandIndex1', back: 'RightHandPinky1' };
export const PLAYER_LEFT_FINGER_BONES = PLAYER_FINGER_BONES.map((name) => name.replace('Right', 'Left'));
export const PLAYER_LEFT_FIST_BONES = PLAYER_FIST_BONES.map((name) => name.replace('Right', 'Left'));
export const PLAYER_LEFT_THUMB_BONES = PLAYER_THUMB_BONES.map((name) => name.replace('Right', 'Left'));
export const PLAYER_HEAD_BONES = ['Head', 'mixamorig:Head'];
export const PLAYER_HEAD_TOP = ['head_end', 'HeadTop_End', 'mixamorig:HeadTop_End'];
export const PLAYER_HEAD_FRONT = ['headfront'];

export const PLAYER_ANIM_LIBRARY = {
  walking: 'Walking',
  running: 'Running',
  attack: 'Attack',
  boxingPunch: 'Boxing_Guard_Prep_Straight_Punch',
  collectObject: 'Collect_Object',
  combatStance: 'Combat_Stance',
  facePunch: 'Face_Punch_Reaction',
  hammerSwing: 'Heavy_Hammer_Swing',
  idle11: 'Idle_11',
  leftSlash: 'Left_Slash',
  swordSlash: 'Right_Hand_Sword_Slash',
  tripleCombo: 'Triple_Combo_Attack',
  thrustSlash: 'Thrust_Slash',
  axeSpin: 'Axe_Spin_Attack',
  doubleCombo: 'Double_Combo_Attack',
  shotInBack: 'Shot_in_the_Back_and_Fall',
  kick: 'Boxing_Guard_Right_Straight_Kick',
  rollDodge: 'Roll_Dodge_2',
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
  triple3: PLAYER_ANIM_LIBRARY.tripleCombo,
  smash: PLAYER_ANIM_LIBRARY.attack,
  slash: PLAYER_ANIM_LIBRARY.swordSlash,
  double1: PLAYER_ANIM_LIBRARY.doubleCombo,
  thrust: PLAYER_ANIM_LIBRARY.thrustSlash,
  spin: PLAYER_ANIM_LIBRARY.axeSpin,
  roll: PLAYER_ANIM_LIBRARY.rollDodge,
  heavyKick: PLAYER_ANIM_LIBRARY.kick,
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
  walk: 1.15,
  run: 1.15,
  chop: 1.35,
  mine: 1.1,
  punch: 1.8,
  kick: 1.4,
  triple3: 0.95,
  smash: 1.0,
  slash: 0.7,
  double1: 1.25,
  thrust: 1,
  spin: 1.2,
  heavyKick: 0.9,
  ignite: 2.5,
  pickup: 2.0,
  getUp: 1,
  flinch: 2,
};

export const PLAYER_ANIM_RANGES = {
  punch: { start: 1.1, end: 2.7 },
  kick: { start: 0.36, end: 1.0 },
  heavyKick: { start: 0.36, end: 1.0 },
  triple3: { start: 1.85, end: 2.7 },
  smash: { start: 0.2, end: 2.5 },
  slash: { start: 0.0, end: 0.7 },
  double1: { start: 0.0, end: 1.02 },
  thrust: { start: 0.0, end: 1.0 },
  spin: { start: 0.1, end: 1.6 },
  roll: { start: 0.4, end: 1.8 },
  pickup: { start: 0, end: 1.05 },
  flinch: { start: 0.0, end: 1.0 },
};

export const PLAYER_ANIM_SWING_ALONG = {
  slash: { share: 0.8, from: 0.6, full: 0.72 },
  thrust: { share: 1, from: 0.7, full: 0.82 },
  smash: { share: 1, from: 0.43, full: 0.534, grab: 0.15, pitch: [165, -25], limit: 3 },
};

export const PLAYER_ANIM_SNAP = { slash: { at: 0.4, speed: 1.8 }, smash: { at: 1.15, speed: 2 } };

export const PLAYER_ANIM_ROOTLESS = ['punch', 'double1', 'triple3', 'smash', 'roll', 'spin'];

export const PLAYER_ANIM_PLANTED = { thrust: { hips: 0.5, legs: 0.5 } };

export const PLAYER_ROLL_HEADING = 0.79;

export const PLAYER_DEATH_OVERLAY_SHARE = {
  dieFall: 0.8,
  dieShot: 0.6,
};

export const PLAYER_ANIM_FALLBACKS = {
  chop: ['chop', 'mine', 'punch', 'kick'],
  mine: ['mine', 'chop', 'punch', 'kick'],
  punch: ['punch', 'kick', 'chop'],
  kick: ['kick', 'punch', 'chop'],
  triple3: ['triple3', 'chop'],
  smash: ['smash', 'mine', 'chop'],
  slash: ['slash', 'chop'],
  double1: ['double1', 'chop'],
  thrust: ['thrust', 'slash', 'chop'],
  spin: ['spin', 'smash', 'chop'],
  heavyKick: ['heavyKick', 'kick', 'punch'],
  holdTool: ['holdTool', 'idle'],
  ignite: ['ignite', 'pickup', 'punch', 'idle'],
  pickup: ['pickup', 'ignite', 'punch', 'idle'],
  getUp: ['getUp'],
  dieFall: ['dieFall', 'dieShot'],
  dieShot: ['dieShot', 'dieFall'],
};

export const CREATURE_MODEL_URLS = Object.values(CREATURE_TYPES)
  .map((type) => (type ? type.model : null))
  .filter(Boolean);

export function toolModelUrl(tool) {
  return tool.file;
}

export function collectStartupUrls(heldTool = null) {
  const urls = new Set();
  const tool = heldTool ? TOOL_TYPES[heldTool] : null;
  if (tool && tool.model) urls.add(toolModelUrl(tool));
  for (const url of CREATURE_MODEL_URLS) urls.add(url);
  for (const url of FISH_MODEL_URLS) urls.add(url);
  urls.add(PLAYER_MODEL);
  for (const url of PLAYER_ANIMS) urls.add(url);
  for (const url of grassStartupUrls()) urls.add(url);
  return [...urls];
}
