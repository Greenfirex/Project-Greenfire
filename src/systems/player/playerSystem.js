// Hratelná postava — načtení modelu s vlastní texturou, animace z vedlejších souborů a pohyb po světě.
// Model i animace se stahují najednou; nástroj teprve ve chvíli, kdy ho hráč poprvé vezme do ruky.
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector';
import { worldToCellCoords, cellToWorldCoords } from '../../utils/gridMath.js';
import { warnMissingWiring } from '../../utils/missingWiring.js';
import { TOOL_TYPES } from '../../data/catalogs/items.js';
import { PLAYER_BASE } from '../../data/catalogs/player.js';
import {
  toolModelUrl,
  PLAYER_MODEL,
  PLAYER_ANIMS,
  PLAYER_BASE_HEIGHT,
  PLAYER_MODEL_YAW,
  PLAYER_INTRO_YAW,
  PLAYER_HAND_BONES,
  PLAYER_UPPER_ARM_BONES,
  PLAYER_FOREARM_BONES,
  PLAYER_LEFT_UPPER_ARM_BONES,
  PLAYER_LEFT_FOREARM_BONES,
  PLAYER_LEFT_HAND_BONES,
  PLAYER_SPINE_BONES,
  PLAYER_LOWER_SPINE_BONES,
  PLAYER_LEFT_THIGH_BONES,
  PLAYER_RIGHT_THIGH_BONES,
  PLAYER_FINGER_BONES,
  PLAYER_FIST_BONES,
  PLAYER_THUMB_BONES,
  PLAYER_GRIP_LINE_BONES,
  PLAYER_ANIM_SWING_ALONG,
  PLAYER_ANIM_SNAP,
  PLAYER_LEFT_FINGER_BONES,
  PLAYER_LEFT_FIST_BONES,
  PLAYER_LEFT_THUMB_BONES,
  PLAYER_HEAD_BONES,
  PLAYER_HEAD_TOP,
  PLAYER_HEAD_FRONT,
  PLAYER_FOOT_BONES,
  PLAYER_TOE_BONES,
  PLAYER_ANIM_NAMES,
  PLAYER_ANIM_SPEEDS,
  PLAYER_ANIM_FALLBACKS,
  PLAYER_ANIM_RANGES,
  PLAYER_ANIM_ROOTLESS,
  PLAYER_ROLL_HEADING,
  PLAYER_DEATH_OVERLAY_SHARE,
} from '../../data/catalogs/modelCatalog.js';
import { loadModel, instantiateModel, loadImported } from '../../utils/assetLoader.js';
import TorchFire from '../../effects/torchFire.js';

const ANIM_BLEND = 0.1;
const STRIKE_PLAY_SHARE = {
  chop: 0.74,
  mine: 0.41,
  punch: 1,
  kick: 1,
  heavyKick: 1,
  slash: 1,
  double1: 1,
  slam: 1,
};
const STRIKE_IMPACT_SHARE = {
  chop: 0.35,
  mine: 0.45,
  punch: 0.4,
  kick: 0.3,
  heavyKick: 0.3,
  slash: 0.73,
  double1: 0.58,
  slam: 0.53,
};
const STRIKE_HOLD = 0.12;
const WRIST_BLEND = 0.15;
const SWING_HOLD_FADE = 0.1;
const SWING_TURN_LIMIT = 1.2;
const IDLE_ARM_IN = 0.12;
const IDLE_ELBOW = 0.3;
const IDLE_FADE = 0.35;
const REACH_BEND = 0.4;
const REACH_LID_BEND = -0.15;
const REACH_AHEAD = 0.3;
const REACH_LIFT = 0.08;
const REACH_FADE = 0.3;
const REACH_SPREAD = 0.7;
const LOOT_LEAN = 0.4;
const LOOT_LEAN_CLEAR = 0.05;
const RUMMAGE_FADE = 0.4;
const RUMMAGE_REACH = [0.14, 0.1, 0.1];
const RUMMAGE_PACE = [4.3, 6.1, 3.7];
const AUTO_WALK_DONE = 0.06;
const AUTO_WALK_LIMIT = 2;
const AUTO_WALK_STUCK = 0.2;
const AUTO_WALK_PROGRESS = 0.01;
const LOOK_PAUSE = [4, 9];
const LOOK_HOLD = [1.2, 2.4];
const LOOK_YAW = 0.55;
const LOOK_SPEED = 1.6;
const STRIKE_FALLBACK = 0.5;
const IGNITE_SHARE = 0.55;
const IGNITE_PLAY = 0.22;
const IGNITE_HOLD = 0.35;
const IGNITE_FALLBACK = 0.75;
const PICKUP_SHARE = 1;
const RISE_BLEND = 0.035;
const PICKUP_HOLD = 0.12;
const PICKUP_FALLBACK = 0.75;
const FLINCH_FALLBACK = 0.5;
const FLINCH_PLAY = 0.5;
const DEATH_OVERLAY_FALLBACK = 0.8;
const STEP_DISTANCE = 1.5;
const FOOT_SIDES = ['left', 'right'];
const FOOT_LAND_DISTANCE = 0.04;
const FOOT_SHIFT_MAX = 0.35;
const FOOT_FALLBACK = { walk: 1.25, sprint: 1.0 };
const FOOT_SIDE_OFFSET = 0.1;
const START_LYING = false;
const TOOL_SCALE = 0.95;
const TOOL_POSITION = new Vector3(-0.12, 0.12, 0.04);
const TOOL_ROTATION = new Vector3(0, 0, -0.45);
const HIP_SWAP_TIME = 0.6;
const HIP_SWAP_SHARE = 0.45;
const HIP_REACH_HOLD = 1.5;
const HIP_ELBOW_OUT = 0.6;
const HIP_REACH_PASSES = 3;
const LEFT_CURL_SIGN = 1;
const RIGHT_CURL_SIGN = -1;
const POCKET_TIME = 0.5;
const POCKET_SHARE = 0.45;
const GUARD_FADE = 0.25;
const STANCE_UPRIGHT = -0.13;
const STANCE_FADE = 0.3;
const BODY_RADIUS = 0.3;
const BODY_MARGIN = 0.08;
const BODY_SAMPLES = 8;
const SLIDE_LOOKAHEAD = 1.2;
const SLIDE_MIN = 0.12;
const WALL_SLIDE_ANGLES = [0.35, -0.35, 0.7, -0.7, 1.05, -1.05, Math.PI / 2, -Math.PI / 2];
const MOVE_SPEED = 4.5;
export const STEP_LIMIT = 0.55;
const WALK_SPEED = 2.4;
const TURN_SPEED = 12;
const BODY_TURN_SPEED = 14;
const DODGE_TURN_SPEED = 30;
const MODEL_HEIGHT = 2.0;
export const PLAYER_EYE_HEIGHT = MODEL_HEIGHT * 0.92;
const MODEL_BASE_HEIGHT = PLAYER_BASE_HEIGHT;
const MODEL_YAW = PLAYER_MODEL_YAW;
const SPAWN = { x: 0, z: 0 };
const MOVE_KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

function refreshChain(node) {
  const chain = [];
  for (let item = node; item; item = item.parent) chain.unshift(item);
  for (const item of chain) item.computeWorldMatrix(true);
}

function between([low, high]) {
  return low + Math.random() * (high - low);
}

function isHips(name) {
  return name === 'Hips' || String(name).endsWith(':Hips');
}

function restRotation(bone) {
  const rotation = Quaternion.Identity();
  bone.getRestPose().decompose(undefined, rotation);
  return rotation;
}

export default class PlayerSystem {

  constructor(scene) {
    this.s = scene;
    this.root = null;
    this.mesh = null;
    this.anims = {};
    this.current = null;
    this.currentKey = null;
    this.input = { forward: false, back: false, left: false, right: false, sprint: false };
    this.facing = 0;
    this.blockedTest = null;
    this.walkable = null;
    this.stepLevel = null;
    this.passageAt = null;
    this.level = 0;
    this.speedScale = null;
    this.bodyFacing = 0;
    this.inCombat = null;
    this.canSprint = null;
    this.sprinting = false;
    this.sprintSpent = false;
    this.decoSystem = null;
    this.groundHeightAt = null;
    this.wallRiseAt = null;
    this.cliffOverlapAt = null;
    this.moveBlocked = null;
    this.spawnCell = null;
    this.walkableCells = null;
    this.ready = false;
    this.lying = false;
    this.waking = false;
    this.wakeTimer = 0;
    this.dead = false;
    this.onIntroChange = null;
    this.toolTemplates = {};
    this.toolLoading = {};
    this.heldToolKey = null;
    this.weaponDrawn = false;
    this.sheathedKey = null;
    this.sheathFrame = null;
    this.sheathSlot = null;
    this.sheathNode = null;
    this.toolNodeKey = null;
    this.hipSwap = null;
    this.offHandKey = null;
    this.offNode = null;
    this.offNodeKey = null;
    this.leftArm = null;
    this.leftSlot = null;
    this.leftSwap = null;
    this.pocketWeight = 0;
    this.keysBound = false;
    this.toolNode = null;
    this.torchFire = null;
    this.handSlot = null;
    this.headSlot = null;
    this.headTop = 0;
    this.worn = {};
    this.wornNode = null;
    this.toolSwapLeft = 0;
    this.armNodes = null;
    this.boneTurns = new Map();
    this.wristLock = 0;
    this.nextBlend = 0;
    this.kneeling = false;
    this.reachTarget = null;
    this.rummage = 0;
    this.rummageTime = 0;
    this.autoWalk = null;
    this.idleRelax = 0;
    this.guardBlend = 0;
    this.guardWrist = null;
    this.strikeTotal = 0;
    this.swingHold = 0;
    this.stanceBlend = 0;
    this.hipWeight = 0;
    this.reach = 0;
    this.idleNodes = null;
    this.glance = { wait: between(LOOK_PAUSE), hold: 0, target: 0, yaw: 0 };
    this.strikeTimer = 0;
    this.strikeAnim = 'punch';
    this.flinchTimer = 0;
    this.dodgeTimer = 0;
    this.dodgeWait = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
    this.dodgeSpeed = 0;
    this.pickupKey = 'pickup';
    this.footBones = { left: null, right: null };
    this.toeBones = { left: null, right: null };
    this.stepSide = 1;
    this.footTravel = { left: 0, right: 0 };
    this.footPressed = { left: false, right: false };
    this.footLast = { left: null, right: null };
    this.footSpot = { left: null, right: null };
    this.footStance = { left: 0, right: 0 };
    this.footIdle = { left: 0, right: 0 };
    this.footInitialized = false;
    this.footSprint = null;
    this.onFootPlant = null;
    this.igniteTimer = 0;
    this.igniteImpactAt = 0;
    this.pickupTimer = 0;
    this.pickupImpactAt = 0;
    this.travelled = 0;
    this.homeX = 0;
    this.homeZ = 0;
    this.pendingState = null;
    this.onStep = null;
    this.onProgress = null;
    this.progressTotal = 1 + PLAYER_ANIMS.length + 1;
  }

  async create() {
    const loaded = await Promise.all([
      loadImported(this.s, PLAYER_MODEL),
      ...PLAYER_ANIMS.map((url) => loadImported(this.s, url)),
    ]);
    this.reportProgress(1);
    const result = loaded[0];
    if (!result) return null;
    const hasSave = Boolean(this.pendingState);
    const root = new TransformNode('playerRoot', this.s);
    for (const mesh of result.meshes || []) {
      if (mesh.setEnabled) mesh.setEnabled(true);
      if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
        if (!this.mesh) this.mesh = mesh;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      }
    }
    if (!this.mesh) return null;
    this.rig = this.mesh.parent;
    if (this.rig) this.rig.parent = root;
    this.rigHome = this.rig ? this.rig.position.clone() : null;
    this.root = root;
    const scale = MODEL_HEIGHT / MODEL_BASE_HEIGHT;
    root.scaling = new Vector3(scale, scale, scale);
    root.rotation.y = MODEL_YAW;
    const start = this.spawnCell ? cellToWorldCoords(this.spawnCell.cx, this.spawnCell.cz) : SPAWN;
    this.root.position = this.positionAt(start.x, start.z);
    this.homeX = start.x;
    this.homeZ = start.z;
    if (this.pendingState) {
      const pending = this.pendingState;
      this.pendingState = null;
      this.apply(pending);
      this.homeX = this.root.position.x;
      this.homeZ = this.root.position.z;
    }

    this.loadAnimations(result, loaded.slice(1));
    this.cacheFootBones();
    this.reportProgress(this.progressTotal);
    await this.attachToolNode();
    this.attachHeadSlot();
    this.refreshWorn();
    this.bindKeys();
    this.ready = true;
    if (hasSave || !START_LYING) this.play(this.idleAnim());
    else this.lieDown();
    return this.root;
  }

  reportProgress(count) {
    if (this.onProgress) this.onProgress(count, this.progressTotal);
  }

  prefetchTool(key) {
    const tool = TOOL_TYPES[key];
    if (!tool || !tool.model || this.toolTemplates[tool.model] !== undefined) return;
    if (this.toolLoading && this.toolLoading[tool.model]) return;
    if (!this.toolLoading) this.toolLoading = {};
    this.toolLoading[tool.model] = true;
    loadModel(this.s, toolModelUrl(tool)).then((template) => {
      this.toolTemplates[tool.model] = template;
      this.toolLoading[tool.model] = false;
      if (this.heldToolKey === key) this.refreshToolNode();
      else if (this.offHandKey === key) this.refreshOffNode();
      if (this.sheathedKey === key) this.refreshSheathNode();
    }).catch(() => {
      this.toolLoading[tool.model] = false;
    });
  }

  async attachToolNode() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const bone = this.findHandBone(skeleton);
    const hand = bone && bone.getTransformNode();
    if (!hand) return;
    const boneNode = (names) => {
      const found = skeleton.bones.find((item) => names.includes(item.name));
      return found ? found.getTransformNode() : null;
    };
    this.armNodes = {
      upper: boneNode(PLAYER_UPPER_ARM_BONES),
      fore: boneNode(PLAYER_FOREARM_BONES),
      hand,
      handRest: restRotation(bone),
      fingers: PLAYER_FINGER_BONES.map((name) => boneNode([name])).filter(Boolean),
      fingerRest: new Map(skeleton.bones
        .filter((item) => PLAYER_FINGER_BONES.includes(item.name) && item.getTransformNode())
        .map((item) => [item.getTransformNode(), restRotation(item)])),
      curlSign: RIGHT_CURL_SIGN,
      fist: PLAYER_FIST_BONES.map((name) => boneNode([name])).filter(Boolean),
      thumb: boneNode(PLAYER_THUMB_BONES),
      gripFront: boneNode([PLAYER_GRIP_LINE_BONES.front]),
      gripBack: boneNode([PLAYER_GRIP_LINE_BONES.back]),
    };
    this.idleNodes = {
      leftUpper: boneNode(PLAYER_LEFT_UPPER_ARM_BONES),
      leftFore: boneNode(PLAYER_LEFT_FOREARM_BONES),
      leftHand: boneNode(PLAYER_LEFT_HAND_BONES),
      head: boneNode(PLAYER_HEAD_BONES),
      spine: PLAYER_SPINE_BONES.map((name) => boneNode([name])).filter(Boolean),
    };
    const fingerRest = (names) => new Map(skeleton.bones
      .filter((item) => names.includes(item.name) && item.getTransformNode())
      .map((item) => [item.getTransformNode(), restRotation(item)]));
    this.handSlot = this.makeHandSlot('playerHandSlot', hand);
    const leftHand = this.idleNodes.leftHand;
    if (leftHand) {
      this.leftArm = {
        upper: this.idleNodes.leftUpper,
        fore: this.idleNodes.leftFore,
        hand: leftHand,
        fingers: PLAYER_LEFT_FINGER_BONES.map((name) => boneNode([name])).filter(Boolean),
        fingerRest: fingerRest(PLAYER_LEFT_FINGER_BONES),
        fist: PLAYER_LEFT_FIST_BONES.map((name) => boneNode([name])).filter(Boolean),
        thumb: boneNode(PLAYER_LEFT_THUMB_BONES),
        curlSign: LEFT_CURL_SIGN,
      };
      this.leftSlot = this.makeHandSlot('playerLeftHandSlot', leftHand);
    }
    this.torchFireFor();
    this.refreshToolNode();
    this.measureHips(skeleton);
    this.refreshSheathNode();
  }

  makeHandSlot(name, hand) {
    const slot = new TransformNode(name, this.s);
    slot.parent = hand;
    slot.position = Vector3.Zero();
    slot.rotation = Vector3.Zero();
    slot.scaling = new Vector3(TOOL_SCALE, TOOL_SCALE, TOOL_SCALE);
    return slot;
  }

  setOffHandTool(key, instant = false) {
    const next = key || null;
    if (this.offHandKey === next) return;
    const stow = (TOOL_TYPES[next || this.offNodeKey] || {}).stow;
    this.offHandKey = next;
    if (instant || !stow || !this.ready || this.lying || this.dead || !this.leftArm || !this.sheathFrame) {
      this.leftSwap = null;
      this.refreshOffNode();
      return;
    }
    if (next) this.prefetchTool(next);
    if (this.leftSwap && !this.leftSwap.swapped) return;
    this.leftSwap = { time: 0, swapped: false, stow };
  }

  finishPocket() {
    const swap = this.leftSwap;
    if (!swap) return;
    this.leftSwap = null;
    if (!swap.swapped) this.refreshOffNode();
  }

  hipPoint(spot) {
    const { hips, middle, side, up, forward, width } = this.sheathFrame;
    refreshChain(hips);
    const local = middle
      .add(side.scale(width * (spot.side || 0)))
      .add(up.scale(width * (spot.lift || 0)))
      .add(forward.scale(width * (spot.ahead || 0)));
    return Vector3.TransformCoordinates(local, hips.getWorldMatrix());
  }

  dropToolNode() {
    if (this.torchFire) this.torchFire.detach();
    if (this.toolNode) {
      this.toolNode.setEnabled(false);
      this.toolNode.dispose(false, false);
      this.toolNode = null;
    }
    this.toolNodeKey = null;
  }

  refreshOffNode() {
    if (this.torchFire) this.torchFire.detach();
    if (this.offNode) {
      this.offNode.dispose(false, false);
      this.offNode = null;
    }
    this.offNodeKey = null;
    const tool = TOOL_TYPES[this.offHandKey];
    if (this.leftSlot && tool && tool.model) {
      const template = this.toolTemplates[tool.model];
      if (template === undefined) this.prefetchTool(this.offHandKey);
      else this.offNode = this.placeInSlot(template, tool, this.leftSlot, 'playerOffHand');
      if (this.offNode) this.offNodeKey = this.offHandKey;
    }
    this.refreshTorchFire();
  }

  placeInSlot(template, tool, slot, name) {
    const node = instantiateModel(this.s, template, `${name}_${tool.model}`);
    if (!node) return null;
    const grip = tool.grip || {};
    const scale = TOOL_SCALE * (grip.scale || 1);
    node.parent = slot;
    node.scaling = new Vector3(scale, scale, scale);
    node.position = (grip.position ? Vector3.FromArray(grip.position) : TOOL_POSITION).scale(TOOL_SCALE);
    node.rotation = grip.rotation ? Vector3.FromArray(grip.rotation) : TOOL_ROTATION;
    return node;
  }

  refreshTorchFire() {
    if (this.torchFire) this.torchFire.detach();
    const isTorch = (key) => Boolean(TOOL_TYPES[key]) && TOOL_TYPES[key].model === 'torch';
    if (this.offNode && isTorch(this.offNodeKey)) this.torchFireFor().attach(this.offNode);
    else if (this.toolNode && isTorch(this.toolNodeKey)) this.torchFireFor().attach(this.toolNode);
  }

  measureHips(skeleton) {
    const node = (names) => {
      const found = skeleton.bones.find((item) => names.includes(item.name));
      return found ? found.getTransformNode() : null;
    };
    const hipsBone = skeleton.bones.find((item) => isHips(item.name));
    const hips = hipsBone && hipsBone.getTransformNode();
    const left = node(PLAYER_LEFT_THIGH_BONES);
    const right = node(PLAYER_RIGHT_THIGH_BONES);
    const spine = node(PLAYER_LOWER_SPINE_BONES);
    if (!hips || !left || !right || !spine) return;
    refreshChain(left);
    refreshChain(right);
    refreshChain(spine);
    const toHips = hips.getWorldMatrix().clone().invert();
    const local = (item) => Vector3.TransformCoordinates(item.getAbsolutePosition(), toHips);
    const leftAt = local(left);
    const rightAt = local(right);
    const middle = leftAt.add(rightAt).scale(0.5);
    const across = leftAt.subtract(rightAt);
    const width = across.length();
    const side = across.normalize();
    const rise = local(spine).subtract(middle);
    const up = rise.subtract(side.scale(Vector3.Dot(rise, side))).normalize();
    const forward = Vector3.Cross(side, up).normalize();
    this.sheathFrame = { hips, middle, side, up, forward, width };
  }

  setSheathedTool(key) {
    const next = key || null;
    if (this.sheathedKey === next) return;
    this.sheathedKey = next;
    this.refreshSheathNode();
  }

  refreshSheathNode() {
    if (this.sheathSlot) {
      this.sheathSlot.dispose(false, false);
      this.sheathSlot = null;
      this.sheathNode = null;
    }
    const frame = this.sheathFrame;
    const tool = TOOL_TYPES[this.sheathedKey];
    if (!frame || !this.handSlot || !tool || !tool.model || !tool.sheath) return;
    const template = this.toolTemplates[tool.model];
    if (template === undefined) {
      this.prefetchTool(this.sheathedKey);
      return;
    }
    const sheath = tool.sheath;
    const { hips, middle, side, up, forward, width } = frame;
    const node = instantiateModel(this.s, template, `playerSheathed_${tool.model}`);
    if (!node) return;
    const slot = new TransformNode('playerSheathSlot', this.s);
    slot.parent = hips;
    slot.position = middle
      .add(side.scale(width * (sheath.side || 0)))
      .add(up.scale(width * (sheath.lift || 0)))
      .add(forward.scale(width * (sheath.ahead || 0)));
    const along = up.scale(-1)
      .add(forward.scale(-(sheath.back || 0)))
      .add(side.scale(sheath.out || 0))
      .normalize();
    slot.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), along, slot.rotationQuaternion);
    hips.computeWorldMatrix(true);
    this.handSlot.computeWorldMatrix(true);
    const handScale = Math.abs(this.handSlot.absoluteScaling.x) || 1;
    const hipsScale = Math.abs(hips.absoluteScaling.x) || 1;
    const grip = tool.grip || {};
    const scale = handScale * TOOL_SCALE * (grip.scale || 1) / hipsScale;
    node.parent = slot;
    node.scaling = new Vector3(scale, scale, scale);
    node.position = new Vector3(0, -(grip.hold || 0) * scale, 0);
    for (const mesh of node.getChildMeshes()) mesh.isPickable = false;
    this.sheathSlot = slot;
    this.sheathNode = node;
    this.showSheathed();
  }

  showSheathed() {
    if (this.sheathNode) this.sheathNode.setEnabled(this.toolNodeKey !== this.sheathedKey);
  }

  refreshToolNode() {
    this.dropToolNode();
    const tool = TOOL_TYPES[this.heldToolKey];
    if (this.handSlot && tool && tool.model) {
      const template = this.toolTemplates[tool.model];
      if (template === undefined) this.prefetchTool(this.heldToolKey);
      else this.toolNode = this.placeInSlot(template, tool, this.handSlot, 'playerHeld');
      if (this.toolNode) this.toolNodeKey = this.heldToolKey;
    }
    this.showSheathed();
    this.refreshOffNode();
  }

  torchFireFor() {
    if (!this.torchFire) this.torchFire = new TorchFire(this.s);
    return this.torchFire;
  }

  attachHeadSlot() {
    const skeleton = this.mesh && this.mesh.skeleton;
    const bone = skeleton ? skeleton.bones.find((item) => PLAYER_HEAD_BONES.includes(item.name)) : null;
    const head = bone && bone.getTransformNode();
    if (!head || !this.root) return;
    const nodes = this.root.getDescendants(false);
    const find = (names) => nodes.find((node) => names.includes(node.name)) || null;
    head.computeWorldMatrix(true);
    const toHead = head.getWorldMatrix().clone().invert();
    const local = (node, fallback) => {
      if (!node) return fallback;
      node.computeWorldMatrix(true);
      return Vector3.TransformCoordinates(node.getAbsolutePosition(), toHead);
    };
    const top = local(find(PLAYER_HEAD_TOP), new Vector3(0, 1, 0));
    const ahead = local(find(PLAYER_HEAD_FRONT), new Vector3(0, 0, 1));
    const up = top.normalizeToNew();
    const forward = ahead.subtract(up.scale(Vector3.Dot(ahead, up))).normalize();
    const right = Vector3.Cross(up, forward);
    this.headSlot = new TransformNode('playerHeadSlot', this.s);
    this.headSlot.parent = head;
    this.headSlot.position = Vector3.Zero();
    this.headSlot.rotationQuaternion = Quaternion.RotationQuaternionFromAxis(right, up, forward);
    this.headTop = top.length();
  }

  wear(slot, wear) {
    if (slot !== 'head') return;
    if (this.worn.head === wear) return;
    this.worn.head = wear || null;
    this.refreshWorn();
  }

  refreshWorn() {
    if (this.wornNode) {
      this.wornNode.dispose(false, false);
      this.wornNode = null;
    }
    const wear = this.worn.head;
    if (!this.headSlot || !wear) return;
    loadModel(this.s, wear.model).then((template) => {
      if (!template || this.worn.head !== wear || this.wornNode) return;
      const meshes = template.getChildMeshes();
      if (!meshes.length) return;
      const min = new Vector3(Infinity, Infinity, Infinity);
      const max = new Vector3(-Infinity, -Infinity, -Infinity);
      for (const mesh of meshes) {
        const box = mesh.getBoundingInfo().boundingBox;
        min.minimizeInPlace(box.minimum);
        max.maximizeInPlace(box.maximum);
      }
      const node = instantiateModel(this.s, template, 'playerWorn_head');
      if (!node) return;
      this.headSlot.computeWorldMatrix(true);
      const slotScale = Math.abs(this.headSlot.absoluteScaling.x) || 1;
      const scale = wear.width / (Math.max(max.x - min.x, 0.001) * slotScale);
      node.parent = this.headSlot;
      node.scaling = new Vector3(scale, scale, scale);
      node.rotation = new Vector3(0, wear.yaw || 0, 0);
      node.position = new Vector3(
        -(min.x + max.x) / 2 * scale,
        this.headTop * wear.seat - min.y * scale,
        -(min.z + max.z) / 2 * scale + (wear.forward || 0) / slotScale,
      );
      for (const mesh of node.getChildMeshes()) {
        mesh.receiveShadows = true;
        mesh.isPickable = false;
      }
      this.wornNode = node;
    });
  }

  setHeldTool(key, instant = false, fromHip = false) {
    if (this.heldToolKey === (key || null)) return;
    this.heldToolKey = key || null;
    this.finishHipSwap();
    if (fromHip && !instant && this.ready && !this.lying && !this.dead && this.sheathSlot && this.armNodes) {
      this.strikeTimer = 0;
      this.hipSwap = { time: 0 };
      this.toolSwapLeft = HIP_SWAP_TIME * HIP_SWAP_SHARE;
      return;
    }
    const moving = this.wantsMove();
    if (instant || !this.ready || this.lying || this.dead || moving || this.strikeTimer > 0) {
      this.toolSwapLeft = 0;
      this.refreshToolNode();
      return;
    }
    this.pickUp();
    this.toolSwapLeft = this.pickupImpactTime();
  }

  updateFire() {
    const frame = this.s.getEngine().getDeltaTime() / 1000;
    const dt = Number.isFinite(frame) && frame > 0 ? Math.min(frame, 0.1) : 0.016;
    if (this.toolSwapLeft > 0) {
      this.toolSwapLeft -= dt;
      if (this.toolSwapLeft <= 0) this.refreshToolNode();
    }
    this.restoreBones();
    this.relaxIdle(dt);
    this.reachDown(dt);
    this.standTaller(dt);
    this.holdGuard(dt);
    this.reachHip(dt);
    this.reachPocket(dt);
    this.holdInFist(dt);
    this.holdOffHand();
    if (this.torchFire) this.torchFire.update(dt);
  }

  holdInFist(dt) {
    const tool = TOOL_TYPES[this.heldToolKey];
    const grip = tool && tool.grip;
    if (!grip || !grip.fist || !this.toolNode || !this.handSlot || !this.armNodes) return;
    if (this.toolSwapLeft > 0 && !this.hipSwap) return;
    this.lockWrist((grip.wrist || 0) * (1 - this.guardBlend) * (1 - this.hipWeight), dt);
    this.holdSwingWrist(dt);
    this.alignSwing(grip);
    for (const node of [this.armNodes.upper, this.armNodes.fore, this.armNodes.hand, this.handSlot]) {
      if (node) node.computeWorldMatrix(true);
    }
    const fist = this.closeFist(grip.curl || 0);
    if (!fist) return;
    this.shiftToThumb(fist, this.armNodes, grip);
    const axis = this.gripAxis(grip);
    const wanted = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis, wanted);
    const world = Matrix.Identity();
    wanted.toRotationMatrix(world);
    const parent = Matrix.Identity();
    this.handSlot.absoluteRotationQuaternion.toRotationMatrix(parent);
    if (!this.toolNode.rotationQuaternion) this.toolNode.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromRotationMatrixToRef(world.multiply(Matrix.Invert(parent)), this.toolNode.rotationQuaternion);
    this.toolNode.computeWorldMatrix(true);
    const hold = Vector3.TransformNormal(new Vector3(0, grip.hold || 0, 0), this.toolNode.getWorldMatrix());
    this.toolNode.setAbsolutePosition(fist.subtract(hold));
  }

  alignSwing(grip) {
    const swing = this.strikeTimer > 0 ? PLAYER_ANIM_SWING_ALONG[this.strikeAnim] : null;
    if (!swing || !this.strikeTotal) return;
    const progress = 1 - this.strikeTimer / this.strikeTotal;
    const ramp = Math.max(0, Math.min(1, (progress - swing.from) / Math.max(0.01, swing.full - swing.from)));
    const along = swing.share * ramp * this.swingHold;
    if (!along) return;
    const { fore, hand } = this.armNodes;
    refreshChain(this.handSlot);
    const forearm = hand.getAbsolutePosition().subtract(fore.getAbsolutePosition()).normalize();
    const now = this.gripAxis(grip);
    const wanted = Vector3.Lerp(now, forearm, along);
    if (wanted.lengthSquared() < 1e-6) return;
    wanted.normalize();
    const axis = Vector3.Cross(now, wanted);
    if (axis.lengthSquared() < 1e-8) return;
    const angle = Math.min(SWING_TURN_LIMIT, Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(now, wanted)))));
    const parent = Matrix.Identity();
    hand.parent.absoluteRotationQuaternion.toRotationMatrix(parent);
    const local = Matrix.Identity();
    hand.rotationQuaternion.toRotationMatrix(local);
    const world = local.multiply(parent).multiply(Matrix.RotationAxis(axis.normalize(), angle));
    Quaternion.FromRotationMatrixToRef(world.multiply(Matrix.Invert(parent)), hand.rotationQuaternion);
  }

  holdSwingWrist(dt) {
    const step = dt / SWING_HOLD_FADE;
    this.swingHold = Math.max(0, Math.min(1, this.swingHold + (this.strikeTimer > 0 ? step : -step)));
    const { hand, handRest } = this.armNodes;
    const target = this.guardWrist || handRest;
    if (!this.swingHold || !target) return;
    if (!hand.rotationQuaternion) hand.rotationQuaternion = Quaternion.FromEulerVector(hand.rotation);
    Quaternion.SlerpToRef(hand.rotationQuaternion, target, this.swingHold, hand.rotationQuaternion);
  }

  restoreBones() {
    for (const [node, last] of this.boneTurns) {
      if (node.rotationQuaternion && node.rotationQuaternion.equalsWithEpsilon(last.turned, 1e-6)) {
        node.rotationQuaternion.copyFrom(last.base);
      }
    }
  }

  relaxIdle(dt) {
    if (!this.armNodes || !this.idleNodes || !this.root) return;
    const calm = (this.currentKey === 'idle' || this.currentKey === 'holdTool')
      && this.strikeTimer <= 0 && this.pickupTimer <= 0 && this.igniteTimer <= 0
      && !this.lying && !this.dead && this.toolSwapLeft <= 0;
    this.idleRelax = Math.max(0, Math.min(1, this.idleRelax + (calm ? dt : -dt) / IDLE_FADE));
    this.updateGlance(dt, calm);
    if (!this.idleRelax && !this.glance.yaw) return;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const right = new Vector3(forward.z, 0, -forward.x);
    const arms = [[this.armNodes.upper, this.armNodes.fore, 1]];
    if (!this.offNode) arms.push([this.idleNodes.leftUpper, this.idleNodes.leftFore, -1]);
    for (const [upper, fore, side] of arms) {
      this.turnBone(upper, forward, side * IDLE_ARM_IN * this.idleRelax);
      this.turnBone(fore, right, -IDLE_ELBOW * this.idleRelax);
    }
    this.turnBone(this.idleNodes.head, Vector3.Up(), this.glance.yaw);
  }

  reachDown(dt) {
    if (!this.armNodes || !this.idleNodes || !this.root) return;
    this.reach = Math.max(0, Math.min(1, this.reach + (this.pickupTimer > 0 ? dt : -dt) / REACH_FADE));
    this.leanToTarget();
    if (!this.reach) {
      if (this.pickupTimer <= 0) this.reachTarget = null;
      return;
    }
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const right = new Vector3(forward.z, 0, -forward.x);
    const rummaging = this.kneeling && this.reachTarget;
    this.rummage = Math.max(0, Math.min(1, this.rummage + (rummaging ? dt : -dt) / RUMMAGE_FADE));
    this.rummageTime += dt;
    const up = Vector3.Up();
    const bend = this.reachTarget ? REACH_LID_BEND : REACH_BEND;
    for (const node of this.idleNodes.spine) this.turnBone(node, right, bend * this.reach);
    const ground = this.root.position.y + REACH_LIFT;
    const arms = [
      [this.idleNodes.leftUpper, this.idleNodes.leftFore, this.idleNodes.leftHand],
      [this.armNodes.upper, this.armNodes.fore, this.armNodes.hand],
    ];
    arms.forEach(([upper, fore, hand], index) => {
      if (!upper || !fore || !hand) return;
      refreshChain(hand);
      const shoulder = upper.getAbsolutePosition();
      const target = this.reachTarget
        ? this.reachTarget.add(right.scale(Vector3.Dot(shoulder.subtract(this.root.position), right) * REACH_SPREAD))
        : new Vector3(shoulder.x + forward.x * REACH_AHEAD, ground, shoulder.z + forward.z * REACH_AHEAD);
      if (this.rummage) target.addInPlace(this.rummageOffset(index * Math.PI, [right, up, forward]));
      this.aimBone(upper, hand, target);
      refreshChain(hand);
      this.aimBone(fore, hand, target);
    });
  }

  reachHip(dt) {
    const swap = this.hipSwap;
    this.hipWeight = 0;
    if (!swap) return;
    swap.time += dt;
    const t = swap.time / HIP_SWAP_TIME;
    if (t >= 1 || !this.armNodes || !this.sheathSlot) {
      this.hipSwap = null;
      return;
    }
    const { upper, fore, hand } = this.armNodes;
    if (!upper || !fore || !hand) return;
    const weight = Math.min(1, Math.sin(Math.PI * t) * HIP_REACH_HOLD);
    this.hipWeight = weight;
    refreshChain(this.sheathSlot);
    const slot = this.sheathSlot.getAbsolutePosition().clone();
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const pole = forward.scale(-1).add(this.weaponSideOut(forward).scale(HIP_ELBOW_OUT));
    const tool = TOOL_TYPES[this.sheathedKey];
    const grip = (tool && tool.grip) || {};
    const hangs = Vector3.TransformNormal(Vector3.Up(), this.sheathSlot.getWorldMatrix()).normalize();
    this.reachPoint(this.armNodes, slot, pole, grip, hangs, weight);
  }

  reachPocket(dt) {
    const swap = this.leftSwap;
    this.pocketWeight = 0;
    if (!swap) return;
    swap.time += dt;
    const t = swap.time / POCKET_TIME;
    if (!swap.swapped && t >= POCKET_SHARE) {
      swap.swapped = true;
      this.refreshOffNode();
    }
    if (t >= 1 || !this.leftArm || !this.sheathFrame) {
      this.finishPocket();
      return;
    }
    const weight = Math.min(1, Math.sin(Math.PI * t) * HIP_REACH_HOLD);
    this.pocketWeight = weight;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const pole = forward.scale(-1).add(this.weaponSideOut(forward).scale(-HIP_ELBOW_OUT));
    const tool = TOOL_TYPES[this.offHandKey || this.offNodeKey];
    this.reachPoint(this.leftArm, this.hipPoint(swap.stow), pole, (tool && tool.grip) || {}, null, weight);
  }

  reachPoint(arm, point, pole, grip, along, weight) {
    const { upper, fore, hand } = arm;
    if (!upper || !fore || !hand) return;
    const bones = [upper, fore, hand];
    for (const bone of bones) {
      if (!bone.rotationQuaternion) bone.rotationQuaternion = Quaternion.FromEulerVector(bone.rotation);
    }
    const before = bones.map((bone) => bone.rotationQuaternion.clone());
    for (let pass = 0; pass < HIP_REACH_PASSES; pass += 1) {
      refreshChain(hand);
      const fist = this.closeFist(grip.curl || 0, arm) || this.fistCenter(arm);
      const target = point.subtract(fist.subtract(hand.getAbsolutePosition()));
      this.reachArm(upper, fore, hand, target, pole, 1);
      if (along && grip.fist) this.turnGrip(along, grip, 1);
    }
    bones.forEach((bone, index) => {
      Quaternion.SlerpToRef(before[index], bone.rotationQuaternion, weight, bone.rotationQuaternion);
      const turned = this.boneTurns.get(bone);
      if (turned) turned.turned = bone.rotationQuaternion.clone();
    });
    refreshChain(hand);
  }

  standTaller(dt) {
    const stance = this.currentKey === 'combatStance' && this.strikeTimer <= 0 && this.pickupTimer <= 0;
    this.stanceBlend = Math.max(0, Math.min(1, this.stanceBlend + (stance ? dt : -dt) / STANCE_FADE));
    if (!this.stanceBlend || !this.idleNodes) return;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const right = new Vector3(forward.z, 0, -forward.x);
    for (const node of this.idleNodes.spine) this.turnBone(node, right, STANCE_UPRIGHT * this.stanceBlend);
  }

  holdGuard(dt) {
    const tool = TOOL_TYPES[this.heldToolKey];
    const guard = tool && tool.guard;
    const ready = Boolean(guard) && this.weaponDrawn && this.currentKey === 'combatStance'
      && this.strikeTimer <= 0 && this.pickupTimer <= 0 && this.toolSwapLeft <= 0
      && this.toolNodeKey === this.heldToolKey;
    this.guardBlend = Math.max(0, Math.min(1, this.guardBlend + (ready ? dt : -dt) / GUARD_FADE));
    if (!this.guardBlend || !guard || !this.armNodes || !this.idleNodes) return;
    const weight = this.guardBlend;
    const forward = new Vector3(Math.sin(this.bodyFacing), 0, Math.cos(this.bodyFacing));
    const up = Vector3.Up();
    const { upper, fore, hand } = this.armNodes;
    const { leftUpper, leftFore, leftHand } = this.idleNodes;
    if (!upper || !fore || !hand || !leftUpper || !leftFore || !leftHand) return;
    refreshChain(hand);
    refreshChain(leftHand);
    const out = this.weaponSideOut(forward);
    const at = (origin, offset, side) => origin
      .add(out.scale(offset[0] * side))
      .add(up.scale(offset[1]))
      .add(forward.scale(offset[2]));
    const offHand = this.offNode && TOOL_TYPES[this.offNodeKey] ? TOOL_TYPES[this.offNodeKey].offHand : null;
    const arms = [
      [upper, fore, hand, guard.elbow, guard.hand, 1],
      [leftUpper, leftFore, leftHand, offHand ? offHand.elbow : guard.leftElbow, offHand ? offHand.hand : guard.leftHand, -1],
    ];
    for (const [top, middle, tip, elbow, palm, side] of arms) {
      if (!elbow || !palm) continue;
      const shoulder = top.getAbsolutePosition().clone();
      this.aimBone(top, middle, at(shoulder, elbow, side), weight);
      refreshChain(tip);
      this.aimBone(middle, tip, at(shoulder, palm, side), weight);
      refreshChain(tip);
    }
    if (guard.club) this.turnGrip(at(Vector3.Zero(), guard.club, 1).normalize(), tool.grip || {}, weight);
    if (weight >= 1 && hand.rotationQuaternion) this.guardWrist = hand.rotationQuaternion.clone();
  }

  gripAxis(grip) {
    const { gripFront, gripBack } = this.armNodes;
    refreshChain(gripFront);
    refreshChain(gripBack);
    const through = gripFront.getAbsolutePosition().subtract(gripBack.getAbsolutePosition()).normalize();
    const fingers = Vector3.TransformNormal(Vector3.Up(), this.handSlot.getWorldMatrix()).normalize();
    return through.add(fingers.scale(grip.tilt || 0)).normalize();
  }

  turnGrip(wanted, grip, weight) {
    if (!this.handSlot) return;
    refreshChain(this.handSlot);
    const now = this.gripAxis(grip);
    const axis = Vector3.Cross(now, wanted);
    if (axis.lengthSquared() < 1e-8) return;
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(now, wanted))));
    this.turnBone(this.armNodes.hand, axis.normalize(), angle * weight);
  }

  weaponSideOut(forward) {
    const across = this.armNodes.upper.getAbsolutePosition().subtract(this.idleNodes.leftUpper.getAbsolutePosition());
    across.y = 0;
    return across.subtract(forward.scale(Vector3.Dot(across, forward))).normalize();
  }

  reachArm(top, middle, tip, target, pole, weight) {
    refreshChain(tip);
    const shoulder = top.getAbsolutePosition().clone();
    const upperLength = Vector3.Distance(shoulder, middle.getAbsolutePosition());
    const foreLength = Vector3.Distance(middle.getAbsolutePosition(), tip.getAbsolutePosition());
    const toward = target.subtract(shoulder);
    const distance = Math.min(toward.length(), (upperLength + foreLength) * 0.999);
    if (distance < 1e-4) return;
    const along = toward.normalize();
    const reach = (upperLength * upperLength - foreLength * foreLength + distance * distance) / (2 * distance);
    const lift = Math.sqrt(Math.max(0, upperLength * upperLength - reach * reach));
    const bend = pole.subtract(along.scale(Vector3.Dot(pole, along)));
    if (bend.lengthSquared() < 1e-8) return;
    const elbow = shoulder.add(along.scale(reach)).add(bend.normalize().scale(lift));
    this.aimBone(top, middle, elbow, weight);
    refreshChain(tip);
    this.aimBone(middle, tip, target, weight);
    refreshChain(tip);
  }

  finishHipSwap() {
    if (!this.hipSwap) return;
    this.hipSwap = null;
    if (this.toolSwapLeft > 0) {
      this.toolSwapLeft = 0;
      this.refreshToolNode();
    }
  }

  leanToTarget() {
    if (!this.rig || !this.rigHome) return;
    let lean = 0;
    if (this.reach && this.reachTarget) {
      const away = Math.hypot(this.reachTarget.x - this.root.position.x, this.reachTarget.z - this.root.position.z);
      lean = Math.max(0, Math.min(LOOT_LEAN, away - LOOT_LEAN_CLEAR)) * this.reach;
    }
    this.rig.position.copyFrom(this.rigHome);
    this.rig.position.z += lean / (this.root.scaling.z || 1);
  }

  rummageOffset(phase, axes) {
    const offset = Vector3.Zero();
    axes.forEach((axis, index) => {
      const wave = Math.sin(this.rummageTime * RUMMAGE_PACE[index] + phase + index);
      offset.addInPlace(axis.scale(wave * RUMMAGE_REACH[index] * this.rummage));
    });
    return offset;
  }

  aimBone(node, tip, target, weight = this.reach) {
    const from = node.getAbsolutePosition();
    const now = tip.getAbsolutePosition().subtract(from).normalize();
    const goal = target.subtract(from).normalize();
    const axis = Vector3.Cross(now, goal);
    if (axis.lengthSquared() < 1e-8) return;
    const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(now, goal))));
    this.turnBone(node, axis.normalize(), angle * weight);
  }

  updateGlance(dt, calm) {
    const glance = this.glance;
    if (!calm) {
      glance.target = 0;
      glance.hold = 0;
    } else if (glance.hold > 0) {
      glance.hold -= dt;
      if (glance.hold <= 0) {
        glance.target = 0;
        glance.wait = between(LOOK_PAUSE);
      }
    } else {
      glance.wait -= dt;
      if (glance.wait <= 0) {
        glance.target = (Math.random() < 0.5 ? -1 : 1) * LOOK_YAW * (0.6 + Math.random() * 0.4);
        glance.hold = between(LOOK_HOLD);
      }
    }
    const step = LOOK_SPEED * dt;
    glance.yaw += Math.max(-step, Math.min(step, glance.target - glance.yaw));
  }

  lockWrist(strength, dt) {
    const { hand, handRest } = this.armNodes;
    if (!strength || !handRest) return;
    const busy = this.strikeTimer > 0 || this.pickupTimer > 0;
    const step = dt / WRIST_BLEND;
    this.wristLock = Math.max(0, Math.min(1, this.wristLock + (busy ? -step : step)));
    if (!this.wristLock) return;
    if (!hand.rotationQuaternion) hand.rotationQuaternion = Quaternion.FromEulerVector(hand.rotation);
    Quaternion.SlerpToRef(hand.rotationQuaternion, handRest, this.wristLock * strength, hand.rotationQuaternion);
  }

  holdOffHand() {
    const tool = TOOL_TYPES[this.offNodeKey];
    const grip = tool && tool.grip;
    if (!grip || !grip.upright || !this.offNode || !this.leftSlot || !this.leftArm) return;
    const lift = (1 - this.guardBlend) * (1 - this.pocketWeight);
    if (lift > 0 && this.strikeTimer <= 0 && this.pickupTimer <= 0) {
      const right = new Vector3(Math.cos(this.bodyFacing), 0, -Math.sin(this.bodyFacing));
      this.turnBone(this.leftArm.upper, right, (grip.raise || 0) * lift);
      this.turnBone(this.leftArm.fore, right, (grip.bend || 0) * lift);
    }
    this.placeUpright(this.offNode, this.leftSlot, this.leftArm, grip, -1);
  }

  placeUpright(node, slot, arm, grip, side) {
    for (const item of [arm && arm.upper, arm && arm.fore, arm && arm.hand, slot]) {
      if (item) item.computeWorldMatrix(true);
    }
    const forwardX = Math.sin(this.bodyFacing);
    const forwardZ = Math.cos(this.bodyFacing);
    const fist = this.closeFist(grip.curl || 0, arm);
    const lean = grip.lean || 0;
    const outward = (grip.outward || 0) * side;
    const up = new Vector3(forwardX * lean + forwardZ * outward, 1, forwardZ * lean - forwardX * outward).normalize();
    const wanted = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Up(), up, wanted);
    const turn = Quaternion.RotationAxis(Vector3.Up(), this.bodyFacing);
    const world = Matrix.Identity();
    wanted.multiply(turn).toRotationMatrix(world);
    const parent = Matrix.Identity();
    slot.absoluteRotationQuaternion.toRotationMatrix(parent);
    const local = world.multiply(Matrix.Invert(parent));
    if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.Identity();
    Quaternion.FromRotationMatrixToRef(local, node.rotationQuaternion);
    if (fist) {
      this.shiftToThumb(fist, arm, grip);
      node.setAbsolutePosition(fist.add(up.scale(grip.slide || 0)));
      return;
    }
    const fingers = Vector3.TransformNormal(Vector3.Up(), slot.getWorldMatrix()).normalize();
    node.setAbsolutePosition(slot.getAbsolutePosition().add(fingers.scale(grip.palm || 0)));
  }

  shiftToThumb(fist, arm, grip) {
    if (arm.thumb && grip.toThumb) fist.addInPlace(arm.thumb.getAbsolutePosition().subtract(fist).scale(grip.toThumb));
  }

  fistCenter(arm = this.armNodes) {
    const center = Vector3.Zero();
    if (!arm.fist.length) return arm.hand.getAbsolutePosition().clone();
    for (const node of arm.fist) {
      refreshChain(node);
      center.addInPlace(node.getAbsolutePosition());
    }
    return center.scaleInPlace(1 / arm.fist.length);
  }

  closeFist(curl, arm = this.armNodes) {
    if (!arm || !curl || !arm.fingers.length || !arm.fist.length) return null;
    const side = Vector3.TransformNormal(Vector3.Right(), arm.hand.getWorldMatrix()).normalize();
    for (const node of arm.fingers) {
      const rest = arm.fingerRest.get(node);
      if (rest) {
        if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.FromEulerVector(node.rotation);
        node.rotationQuaternion.copyFrom(rest);
      }
      this.turnBone(node, side, curl * (arm.curlSign || 1));
      node.computeWorldMatrix(true);
    }
    return this.fistCenter(arm);
  }

  turnBone(node, axis, angle) {
    if (!node || !angle || !node.parent) return;
    node.parent.computeWorldMatrix(true);
    if (!node.rotationQuaternion) node.rotationQuaternion = Quaternion.FromEulerVector(node.rotation);
    const last = this.boneTurns.get(node);
    const frame = this.s.getFrameId();
    const stacking = Boolean(last) && last.frame === frame;
    const untouched = Boolean(last) && node.rotationQuaternion.equalsWithEpsilon(last.turned, 1e-6);
    const from = !stacking && untouched ? last.base : node.rotationQuaternion.clone();
    const base = stacking ? last.base : from;
    const local = Matrix.Identity();
    from.toRotationMatrix(local);
    const parent = Matrix.Identity();
    node.parent.absoluteRotationQuaternion.toRotationMatrix(parent);
    const world = local.multiply(parent).multiply(Matrix.RotationAxis(axis, angle));
    Quaternion.FromRotationMatrixToRef(world.multiply(Matrix.Invert(parent)), node.rotationQuaternion);
    this.boneTurns.set(node, { base, frame, turned: node.rotationQuaternion.clone() });
  }

  animLength(key, fallback) {
    const group = this.anims[key];
    if (!group) return fallback;
    let length = 0;
    try {
      length = group.getLength(group.from, group.to);
      if (!length) length = (group.to - group.from) / (group.targetedAnimations[0]?.animation.framePerSecond || 0) / (group.speedRatio || 1);
    } catch {
      length = 0;
    }
    return Number.isFinite(length) && length > 0 ? length : fallback;
  }

  strike(animKey) {
    this.finishHipSwap();
    this.flinchTimer = 0;
    this.strikeAnim = animKey || this.strikeAnimationForTool();
    const group = this.anims[this.strikeAnim];
    const snap = PLAYER_ANIM_SNAP[this.strikeAnim];
    const base = Number(PLAYER_ANIM_SPEEDS[this.strikeAnim]) || 1;
    if (group && snap) group.speedRatio = base;
    let length = this.animLength(this.strikeAnim, STRIKE_FALLBACK);
    if (group && snap) length = Math.min(length * base, snap.at) / base + Math.max(0, length * base - snap.at) / snap.speed;
    const playShare = STRIKE_PLAY_SHARE[this.strikeAnim] || STRIKE_IMPACT_SHARE[this.strikeAnim] || 1;
    this.strikeTimer = Math.max(0.15, length * playShare + STRIKE_HOLD);
    this.strikeTotal = this.strikeTimer;
    this.play(this.strikeAnim, true, false);
    return this.strikeTimer;
  }

  applySnap() {
    const snap = PLAYER_ANIM_SNAP[this.strikeAnim];
    const group = this.anims[this.strikeAnim];
    if (!snap || !group) return;
    const base = Number(PLAYER_ANIM_SPEEDS[this.strikeAnim]) || 1;
    group.speedRatio = this.strikeTotal - this.strikeTimer >= snap.at / base ? snap.speed : base;
  }

  strikeAnimationForTool() {
    const tool = TOOL_TYPES[this.heldToolKey];
    if (!tool || !tool.harvest) return 'punch';
    return tool.harvest.kinds.includes('rock') ? 'mine' : 'chop';
  }

  strikeImpactTime() {
    const share = STRIKE_IMPACT_SHARE[this.strikeAnim] || 0.6;
    const impact = this.strikeTimer * share;
    return impact > 0 ? impact : STRIKE_FALLBACK * share;
  }

  strikeDuration() {
    return this.strikeTimer;
  }

  igniteAt(x, z) {
    this.faceTo(x, z);
    this.strikeTimer = 0;
    this.flinchTimer = 0;
    const length = this.animLength('ignite', IGNITE_FALLBACK);
    this.igniteTimer = Math.max(0.35, length * IGNITE_PLAY + IGNITE_HOLD);
    this.igniteImpactAt = Math.max(0.15, this.igniteTimer * IGNITE_SHARE);
    this.play('ignite', true);
    return this.igniteTimer;
  }

  pickUp() {
    this.finishHipSwap();
    this.finishPocket();
    this.strikeTimer = 0;
    this.flinchTimer = 0;
    this.pickupKey = 'pickup';
    const length = this.animLength('pickup', PICKUP_FALLBACK);
    this.pickupTimer = Math.max(0.18, length + PICKUP_HOLD);
    this.pickupImpactAt = Math.max(0.12, length * PICKUP_SHARE);
    this.play('pickup', true, false);
    return this.pickupTimer;
  }

  walkTo(x, z, onArrive) {
    this.autoWalk = { x, z, onArrive, left: AUTO_WALK_LIMIT, best: Infinity, stuck: 0 };
  }

  stepAutoWalk(dt) {
    const walk = this.autoWalk;
    if (this.wantsMove()) {
      this.autoWalk = null;
      return false;
    }
    const pos = this.root.position;
    const dx = walk.x - pos.x;
    const dz = walk.z - pos.z;
    const distance = Math.hypot(dx, dz);
    walk.left -= dt;
    if (distance < walk.best - AUTO_WALK_PROGRESS) {
      walk.best = distance;
      walk.stuck = 0;
    } else {
      walk.stuck += dt;
    }
    const step = Math.min(distance, WALK_SPEED * dt);
    const dirX = distance > 0 ? dx / distance : 0;
    const dirZ = distance > 0 ? dz / distance : 0;
    const arrived = distance < AUTO_WALK_DONE || walk.left <= 0 || walk.stuck > AUTO_WALK_STUCK
      || !this.tryMove(pos.x + dirX * step, pos.z + dirZ * step, dirX, dirZ, step);
    if (arrived) {
      this.autoWalk = null;
      if (walk.onArrive) walk.onArrive();
      return true;
    }
    this.updateSteps(false, step);
    this.updateHome();
    this.facing = turnToward(this.facing, Math.atan2(dirX, dirZ), TURN_SPEED * dt);
    this.play('walk');
    this.updateFootprints(dt, false);
    return true;
  }

  wantsMove() {
    const input = this.input;
    return input.forward || input.back || input.left || input.right;
  }

  pickupImpactTime() {
    return this.pickupImpactAt;
  }

  cancelIgnite() {
    if (this.igniteTimer <= 0) return false;
    this.igniteTimer = 0;
    this.igniteImpactAt = 0;
    this.play(this.idleAnim());
    return true;
  }

  flinch() {
    if (!this.ready || this.dead || this.lying) return 0;
    if (this.strikeTimer > 0 || this.pickupTimer > 0 || this.igniteTimer > 0) return 0;
    if (!this.anims.flinch) return 0;
    this.flinchTimer = Math.max(0.2, this.animLength('flinch', FLINCH_FALLBACK) * FLINCH_PLAY);
    this.play('flinch', true, false);
    return this.flinchTimer;
  }

  faceTo(x, z, maxDistance) {
    if (!this.root || this.root.isDisposed()) return;
    const dx = x - this.root.position.x;
    const dz = z - this.root.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < 0.0001) return;
    if (Number.isFinite(maxDistance) && distSq > maxDistance * maxDistance) return;
    this.facing = Math.atan2(dx, dz);
  }

  snapFacing(facing) {
    this.facing = facing;
    this.bodyFacing = facing;
    if (this.root) this.root.rotation.y = facing + MODEL_YAW;
  }

  turnBody(dt) {
    const speed = this.dodgeTimer > 0 ? DODGE_TURN_SPEED : BODY_TURN_SPEED;
    this.bodyFacing = turnToward(this.bodyFacing, this.facing, speed * dt);
    this.root.rotation.y = this.bodyFacing + MODEL_YAW;
  }

  cacheFootBones() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton || !Array.isArray(skeleton.bones)) return;
    this.cacheBoneSet(skeleton, PLAYER_FOOT_BONES, this.footBones);
    this.cacheBoneSet(skeleton, PLAYER_TOE_BONES, this.toeBones);
  }

  cacheBoneSet(skeleton, catalog, target) {
    for (const [side, names] of Object.entries(catalog)) {
      const wanted = names.map((name) => String(name).toLowerCase());
      const bone = skeleton.bones.find((item) => {
        const name = String(item.name || '').toLowerCase();
        return wanted.includes(name) || wanted.some((candidate) => name.endsWith(':' + candidate));
      });
      target[side] = bone ? bone.getTransformNode() : null;
    }
  }

  footPosition(side) {
    const node = this.footBones[side];
    if (!node || node.isDisposed()) return null;
    return node.getAbsolutePosition();
  }

  toePosition(side) {
    const node = this.toeBones[side];
    if (!node || node.isDisposed()) return null;
    return node.getAbsolutePosition();
  }

  findHandBone(skeleton) {
    if (!skeleton || !Array.isArray(skeleton.bones)) return null;
    const wanted = PLAYER_HAND_BONES.map((name) => String(name).toLowerCase());
    for (const bone of skeleton.bones) {
      const name = String(bone.name || '').toLowerCase();
      if (wanted.includes(name)) return bone;
      if (wanted.some((candidate) => name.endsWith(`:${candidate}`))) return bone;
    }
    return null;
  }

  loadAnimations(modelResult, sources) {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const nodeByName = new Map();
    for (const bone of skeleton.bones) {
      const node = bone.getTransformNode();
      if (node) nodeByName.set(bone.name, node);
    }
    const hips = skeleton.bones.find((bone) => isHips(bone.name));
    this.hipsRest = hips ? hips.getRestPose().getTranslation() : null;
    this.settledRoots = new WeakSet();

    const embedded = modelResult && Array.isArray(modelResult.animationGroups)
      ? modelResult.animationGroups
      : [];
    const external = [];
    for (const result of sources || []) {
      if (result && Array.isArray(result.animationGroups)) external.push(...result.animationGroups);
    }
    const all = [...embedded, ...external];
    const embeddedSet = new Set(embedded);
    const sameBones = this.sameBoneNodes(skeleton, sources);
    const ownNode = (target) => nodeByName.get(target.name) || sameBones.get(target) || null;

    const pick = (key) => {
      const name = PLAYER_ANIM_NAMES[key];
      if (name) {
        const direct = all.find((group) => group.name === name);
        if (direct) return direct;
      }
      for (const fallback of PLAYER_ANIM_FALLBACKS[key] || []) {
        const fallbackName = PLAYER_ANIM_NAMES[fallback];
        if (!fallbackName) continue;
        const group = all.find((item) => item.name === fallbackName);
        if (group) return group;
      }
      return null;
    };

    for (const key of Object.keys(PLAYER_ANIM_NAMES)) {
      const source = pick(key);
      if (!source) continue;
      let group = source;
      const alreadyUsed = Object.values(this.anims).includes(source);
      if (!embeddedSet.has(source) || alreadyUsed) {
        source.stop();
        group = source.clone(`player_${key}`, ownNode);
      } else {
        group.stop();
      }
      if (!group) continue;
      group.weight = 1;
      group.enableBlending = true;
      group.blendingSpeed = ANIM_BLEND;
      const speed = Number(PLAYER_ANIM_SPEEDS[key]);
      group.speedRatio = Number.isFinite(speed) && speed > 0 ? speed : 1;
      this.prepareAnimation(key, group);
      this.anims[key] = group;
    }

    for (const group of all) group.stop();
    for (const result of sources || []) {
      for (const mesh of result.meshes || []) {
        if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
        mesh.setEnabled(false);
      }
    }
  }

  sameBoneNodes(skeleton, sources) {
    const map = new Map();
    for (const result of sources || []) {
      for (const other of (result && result.skeletons) || []) {
        if (other.bones.length !== skeleton.bones.length) continue;
        other.bones.forEach((bone, index) => {
          const from = bone.getTransformNode();
          const to = skeleton.bones[index].getTransformNode();
          if (from && to) map.set(from, to);
        });
      }
    }
    return map;
  }

  prepareAnimation(key, group) {
    if (!group) return;
    this.settleRoot(group, PLAYER_ANIM_ROOTLESS.includes(key));
    const range = PLAYER_ANIM_RANGES[key];
    if (!range) return;
    const first = group.targetedAnimations && group.targetedAnimations[0];
    const fps = first && first.animation && first.animation.framePerSecond
      ? first.animation.framePerSecond
      : 30;
    const from = group.from;
    group.from = from + range.start * fps;
    group.to = from + range.end * fps;
  }

  settleRoot(group, flatten) {
    const list = group.targetedAnimations;
    if (!list || !this.hipsRest) return;
    for (const item of list) {
      const target = item && item.target;
      const animation = item && item.animation;
      if (!target || !animation || animation.targetProperty !== 'position' || !isHips(target.name)) continue;
      if (this.settledRoots.has(animation)) continue;
      this.settledRoots.add(animation);
      const keys = animation.getKeys();
      if (!keys || !keys.length || !keys[0].value) continue;
      const shiftX = this.hipsRest.x - keys[0].value.x;
      const shiftZ = this.hipsRest.z - keys[0].value.z;
      for (const key of keys) {
        if (!key.value) continue;
        key.value.x = flatten ? this.hipsRest.x : key.value.x + shiftX;
        key.value.z = flatten ? this.hipsRest.z : key.value.z + shiftZ;
      }
    }
  }

  updateHome() {
    if (!this.root || this.root.isDisposed()) return;
    const pos = this.root.position;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
    this.homeX = pos.x;
    this.homeZ = pos.z;
  }

  groundY(x, z, level = this.level) {
    if (!this.groundHeightAt) {
      warnMissingWiring('postava: výška země');
      return 0;
    }
    const height = this.groundHeightAt(x, z, level);
    return Number.isFinite(height) ? height : 0;
  }

  positionAt(x, z, level = this.level) {
    return new Vector3(x, this.groundY(x, z, level), z);
  }

  applyGroundHeight() {
    const root = this.root;
    if (!root || root.isDisposed()) return;
    root.position.y = this.groundY(root.position.x, root.position.z);
  }

  keepGrounded() {
    const root = this.root;
    if (!root || root.isDisposed()) return;
    if (!Number.isFinite(root.position.x) || !Number.isFinite(root.position.z) || !Number.isFinite(root.position.y)) {
      root.position = this.positionAt(this.homeX, this.homeZ);
    }
    if (!root.isEnabled(false)) root.setEnabled(true);
    this.applyGroundHeight();
    if (!this.mesh || this.mesh.isDisposed()) return;
    if (!this.mesh.isEnabled(false)) this.mesh.setEnabled(true);
  }

  canDodge() {
    if (!this.ready || !this.root || this.dead || this.lying) return false;
    if (this.dodgeTimer > 0 || this.dodgeWait > 0 || this.flinchTimer > 0) return false;
    return this.pickupTimer <= 0 && this.igniteTimer <= 0;
  }

  dodge(dirX, dirZ) {
    const length = Math.hypot(dirX, dirZ);
    if (!this.canDodge() || !(length > 0.0001)) return false;
    const data = PLAYER_BASE.dodge || {};
    const seconds = Number.isFinite(data.seconds) && data.seconds > 0 ? data.seconds : 0.3;
    this.finishHipSwap();
    if (this.strikeTimer > 0) this.endStrike();
    this.autoWalk = null;
    this.dodgeX = dirX / length;
    this.dodgeZ = dirZ / length;
    this.dodgeSpeed = (Number.isFinite(data.distance) ? data.distance : 0) / seconds;
    this.dodgeTimer = seconds;
    this.dodgeWait = Number.isFinite(data.cooldown) ? data.cooldown : 0;
    const roll = this.anims.roll;
    this.facing = Math.atan2(this.dodgeX, this.dodgeZ) - (roll ? PLAYER_ROLL_HEADING : 0);
    if (roll) {
      roll.speedRatio = 1;
      roll.speedRatio = Math.max(0.1, this.animLength('roll', seconds) / seconds);
      this.play('roll', true, false);
    }
    return true;
  }

  stepDodge(dt) {
    const step = this.dodgeSpeed * Math.min(dt, this.dodgeTimer);
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    if (step > 0) {
      const { x, z } = this.root.position;
      this.tryMove(x + this.dodgeX * step, z + this.dodgeZ * step, this.dodgeX, this.dodgeZ, step);
      this.updateHome();
    }
    this.play(this.anims.roll ? 'roll' : 'run');
  }

  inputDirection() {
    if (this.moveBlocked && this.moveBlocked()) return null;
    const forward = this.cameraForward(this.s.activeCamera);
    const right = new Vector3(forward.z, 0, -forward.x);
    const move = new Vector3(0, 0, 0);
    if (this.input.forward) move.addInPlace(forward);
    if (this.input.back) move.subtractInPlace(forward);
    if (this.input.right) move.addInPlace(right);
    if (this.input.left) move.subtractInPlace(right);
    if (move.lengthSquared() < 0.0001) return null;
    return move.normalize();
  }

  endStrike() {
    this.strikeTimer = 0;
    this.play(this.idleAnim());
  }

  idleAnim() {
    if ((this.weaponDrawn || (this.inCombat && this.inCombat())) && this.anims.combatStance) return 'combatStance';
    return this.heldToolKey ? 'holdTool' : 'idle';
  }

  play(key, restart = false, loop = true) {
    const group = this.anims[key];
    if (!group) return;
    if (this.currentKey === key) {
      if (restart) group.start(loop, group.speedRatio, group.from, group.to);
      return;
    }
    if (this.current && this.current !== group) this.current.stop();
    for (const [otherKey, other] of Object.entries(this.anims)) {
      if (otherKey === key || other === group) continue;
      other.stop();
    }
    group.blendingSpeed = this.nextBlend || ANIM_BLEND;
    this.nextBlend = 0;
    group.start(loop, group.speedRatio, group.from, group.to);
    this.current = group;
    this.currentKey = key;
  }

  lieDown() {
    this.lying = true;
    this.waking = false;
    this.wakeTimer = 0;
    this.releaseKeys();
    const group = this.anims.getUp;
    if (group) {
      this.current = group;
      this.currentKey = 'getUp';
      this.snapFacing(PLAYER_INTRO_YAW);
      group.stop();
      group.start(false, 0.001, group.from, group.to);
    } else {
      console.warn('[player] Chybí animace Stand_Up1 — postava zůstane ve výchozí póze.');
      this.play(this.idleAnim());
    }
    if (this.onIntroChange) this.onIntroChange(true);
  }

  wake() {
    if (!this.lying || this.waking) return false;
    this.waking = true;
    const group = this.anims.getUp;
    const speed = Number(PLAYER_ANIM_SPEEDS.getUp);
    if (group && Number.isFinite(speed) && speed > 0) group.speedRatio = speed;
    this.wakeTimer = Math.max(0.5, this.animLength('getUp', 8.3));
    if (this.onIntroChange) this.onIntroChange(false);
    this.play('getUp', true, false);
    return true;
  }

  die(fromBehind) {
    if (this.dead || !this.ready) return 0;
    this.dead = true;
    this.autoWalk = null;
    this.dodgeTimer = 0;
    this.lying = false;
    this.waking = false;
    this.wakeTimer = 0;
    this.strikeTimer = 0;
    this.pickupTimer = 0;
    this.igniteTimer = 0;
    this.flinchTimer = 0;
    this.releaseKeys();
    const wanted = fromBehind ? 'dieShot' : 'dieFall';
    const key = this.anims[wanted] ? wanted : (this.anims.dieFall ? 'dieFall' : (this.anims.dieShot ? 'dieShot' : null));
    if (!key) {
      this.play(this.idleAnim());
      return DEATH_OVERLAY_FALLBACK;
    }
    const group = this.anims[key];
    for (const other of Object.values(this.anims)) {
      if (other !== group) other.stop();
    }
    this.current = group;
    this.currentKey = key;
    group.stop();
    group.start(false, group.speedRatio, group.from, group.to);
    const length = this.animLength(key, DEATH_OVERLAY_FALLBACK);
    const share = Number(PLAYER_DEATH_OVERLAY_SHARE[key]);
    const ratio = Number.isFinite(share) && share > 0 ? share : 1;
    return Math.max(0.4, length * ratio);
  }

  revive(x, z) {
    this.dead = false;
    this.lying = false;
    this.waking = false;
    this.wakeTimer = 0;
    this.flinchTimer = 0;
    if (Number.isFinite(x) && Number.isFinite(z)) this.apply({ x, z, facing: 0 });
    this.play(this.idleAnim(), true);
    return true;
  }

  ensurePlaying() {
    const group = this.current;
    if (!group || group.isStarted || this.pickupTimer > 0 || this.strikeTimer > 0) return;
    group.restart();
  }

  get moveInput() {
    return this.input;
  }

  bindKeys() {
    if (this.keysBound) return;
    this.keysBound = true;
    window.addEventListener('keydown', (evt) => this.setKey(evt, true));
    window.addEventListener('keyup', (evt) => this.setKey(evt, false));
    window.addEventListener('blur', () => this.releaseKeys());
  }

  releaseKeys() {
    this.input.forward = false;
    this.input.back = false;
    this.input.left = false;
    this.input.right = false;
    this.input.sprint = false;
    this.sprinting = false;
    this.sprintSpent = false;
  }

  setKey(evt, down) {
    const action = MOVE_KEYS[evt.code];
    if (!action) return;
    if (evt.target && evt.target.tagName === 'INPUT') return;
    if (this.inputBlocked && this.inputBlocked()) return;
    evt.preventDefault();
    if (this.lying) {
      this.input[action] = down;
      if (down) this.wake();
      return;
    }
    this.input[action] = down;
    if (action === 'sprint') this.sprintSpent = false;
  }

  free(x, z, level = this.level) {
    const { cx, cz } = worldToCellCoords(x, z);
    if (this.blockedTest && this.blockedTest(cx, cz)) return false;
    if (this.walkable && !this.walkable(x, z, level)) return false;
    if (this.decoSystem && this.decoSystem.overlaps(x, z, BODY_RADIUS + BODY_MARGIN, level)) return false;
    const passage = this.passageAt ? this.passageAt(x, z, level) : false;
    if (!passage && this.cliffOverlapAt && this.root) {
      const overlap = this.cliffOverlapAt(x, z, level);
      if (overlap > 0) {
        const hereOverlap = this.cliffOverlapAt(this.root.position.x, this.root.position.z, this.level);
        if (overlap >= hereOverlap) return false;
      }
    }
    if (!passage && level !== 0 && this.walkable && this.root && !this.bodyFits(x, z, level)) {
      if (this.bodyFits(this.root.position.x, this.root.position.z, this.level)) return false;
    }
    if (!passage && this.wallRiseAt && this.root) {
      const rise = this.wallRiseAt(x, z, BODY_RADIUS + BODY_MARGIN, level);
      if (rise > STEP_LIMIT) {
        const here = this.wallRiseAt(this.root.position.x, this.root.position.z, BODY_RADIUS + BODY_MARGIN, this.level);
        if (rise >= here) return false;
      }
    }
    return true;
  }

  bodyFits(x, z, level) {
    for (let index = 0; index < BODY_SAMPLES; index += 1) {
      const angle = (index / BODY_SAMPLES) * Math.PI * 2;
      if (!this.walkable(x + Math.cos(angle) * BODY_RADIUS, z + Math.sin(angle) * BODY_RADIUS, level)) return false;
    }
    return true;
  }

  pushOut() {
    if (!this.decoSystem || !this.root) return false;
    for (let i = 0; i < 8; i++) {
      const x = this.root.position.x;
      const z = this.root.position.z;
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        this.root.position = this.positionAt(this.homeX, this.homeZ);
        return false;
      }
      if (this.blockedTest) {
        const { cx, cz } = worldToCellCoords(x, z);
        if (this.blockedTest(cx, cz)) return false;
      }
      const contact = this.decoSystem.nearestContact(x, z, BODY_RADIUS + BODY_MARGIN, 0, this.level);
      if (!contact) return i > 0;
      const nLen = Math.sqrt(contact.nx * contact.nx + contact.nz * contact.nz);
      if (!Number.isFinite(nLen) || nLen < 0.0001) return false;
      const nx = contact.nx / nLen;
      const nz = contact.nz / nLen;
      const push = Math.max(0.02, 0.02 - contact.gap);
      if (!Number.isFinite(push)) return false;
      const nextX = x + nx * push;
      const nextZ = z + nz * push;
      if (!Number.isFinite(nextX) || !Number.isFinite(nextZ)) return false;
      this.root.position = this.positionAt(nextX, nextZ);
    }
    return !this.decoSystem.overlaps(this.root.position.x, this.root.position.z, BODY_RADIUS + BODY_MARGIN, this.level);
  }

  levelAt(x, z) {
    if (!this.stepLevel || !this.root) return this.level;
    return this.stepLevel(this.root.position.x, this.root.position.z, this.level, x, z);
  }

  commit(ax, az) {
    const level = this.levelAt(ax, az);
    if (!this.stepAllowed(ax, az, level) || !this.free(ax, az, level)) return false;
    this.level = level;
    this.root.position = this.positionAt(ax, az, level);
    return true;
  }

  tryMove(x, z, dirX, dirZ, step) {
    if (!this.free(this.root.position.x, this.root.position.z, this.level)) this.pushOut();
    if (this.commit(x, z)) return true;
    const startX = this.root.position.x;
    const startZ = this.root.position.z;
    if (this.decoSystem) {
      const contact = this.decoSystem.nearestContact(startX, startZ, BODY_RADIUS, SLIDE_LOOKAHEAD, this.level);
      const dot = contact ? dirX * contact.nx + dirZ * contact.nz : 0;
      if (contact && dot < 0) {
        const slideX = dirX - contact.nx * dot;
        const slideZ = dirZ - contact.nz * dot;
        const length = Math.sqrt(slideX * slideX + slideZ * slideZ);
        if (length >= SLIDE_MIN) {
          const sx = slideX / length;
          const sz = slideZ / length;
          for (const scale of [1, 0.8, 0.6, 0.4]) {
            const ax = startX + sx * step * scale;
            const az = startZ + sz * step * scale;
            if (this.commit(ax, az)) return true;
          }
        }
      }
    }
    const heading = Math.atan2(dirX, dirZ);
    for (const offset of WALL_SLIDE_ANGLES) {
      const turn = heading + offset;
      const slideX = Math.sin(turn);
      const slideZ = Math.cos(turn);
      const ax = startX + slideX * step;
      const az = startZ + slideZ * step;
      if (this.commit(ax, az)) return true;
    }
    return false;
  }

  stepAllowed(x, z, level = this.level) {
    if (!this.walkable) return true;
    const from = this.root.position;
    const fromOk = this.walkable(from.x, from.z, this.level);
    const toOk = this.walkable(x, z, level);
    if (fromOk !== toOk) return false;
    return Math.abs(this.groundY(x, z, level) - this.groundY(from.x, from.z, this.level)) <= STEP_LIMIT;
  }

  update(dt) {
    if (!this.ready || !this.root || this.root.isDisposed()) return;
    this.keepGrounded();
    this.turnBody(dt);
    this.sprinting = false;
    if (this.dead) return;
    if (this.lying) {
      if (this.waking) {
        this.wakeTimer -= dt;
        if (this.wakeTimer <= 0) {
          this.lying = false;
          this.waking = false;
          this.wakeTimer = 0;
          this.play(this.idleAnim());
        }
      }
      return;
    }
    if (this.flinchTimer > 0) {
      this.flinchTimer = Math.max(0, this.flinchTimer - dt);
      this.play('flinch');
      if (this.flinchTimer > 0) return;
    }
    this.ensurePlaying();
    if (this.dodgeWait > 0 && this.dodgeTimer <= 0) this.dodgeWait = Math.max(0, this.dodgeWait - dt);
    if (this.dodgeTimer > 0) {
      this.stepDodge(dt);
      return;
    }
    if (this.strikeTimer > 0) {
      this.strikeTimer -= dt;
      this.applySnap();
      this.play(this.strikeAnim);
      if (this.strikeTimer > 0) return;
      const done = this.anims[this.strikeAnim];
      if (done) done.pause();
      this.endStrike();
    }
    if (this.pickupTimer > 0) {
      const stay = this.kneeling && !this.wantsMove();
      this.pickupTimer = stay ? Math.max(this.pickupTimer - dt, dt) : this.pickupTimer - dt;
      this.pickupImpactAt -= dt;
      if (this.pickupTimer > 0) {
        this.play(this.pickupKey);
        return;
      }
      const finished = this.anims[this.pickupKey];
      if (finished) finished.pause();
      this.pickupImpactAt = 0;
      this.pickupKey = 'pickup';
      this.nextBlend = RISE_BLEND;
    }
    if (this.igniteTimer > 0) {
      this.igniteTimer -= dt;
      this.igniteImpactAt -= dt;
      if (this.igniteTimer > 0) {
        this.play('ignite');
        return;
      }
      const finished = this.anims.ignite;
      if (finished) finished.pause();
      this.igniteImpactAt = 0;
    }

    if (this.autoWalk && this.stepAutoWalk(dt)) return;

    const move = this.inputDirection();
    if (!move) {
      this.footInitialized = false;
      this.play(this.idleAnim());
      return;
    }

    const allowed = !this.canSprint || this.canSprint();
    if (!allowed && this.input.sprint) this.sprintSpent = true;
    const sprint = this.input.sprint && allowed && !this.sprintSpent;
    this.sprinting = sprint;
    const scale = this.speedScale ? this.speedScale(this.root.position.x, this.root.position.z) : 1;
    const pace = Number.isFinite(scale) ? scale : 1;
    const step = (sprint ? MOVE_SPEED : WALK_SPEED) * pace * dt;
    this.tryMove(this.root.position.x + move.x * step, this.root.position.z + move.z * step, move.x, move.z, step);
    this.updateSteps(sprint, step);
    this.updateHome();

    const target = Math.atan2(move.x, move.z);
    this.facing = turnToward(this.facing, target, TURN_SPEED * dt);
    this.play(sprint ? 'run' : 'walk');
    this.updateFootprints(dt, sprint);
  }

  updateFootprints(dt, sprint) {
    if (!this.onFootPlant) return;
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    if (!this.footInitialized || this.footSprint !== sprint) {
      this.footSprint = sprint;
      this.footInitialized = true;
      this.resetFootTracking();
    }
    for (const side of FOOT_SIDES) {
      this.footIdle[side] += seconds;
      this.trackFootLanding(side, sprint);
    }
    const limit = sprint ? FOOT_FALLBACK.sprint : FOOT_FALLBACK.walk;
    for (const side of FOOT_SIDES) {
      if (this.footIdle[side] >= limit) this.plantFoot(side, sprint);
    }
  }

  trackFootLanding(side, sprint) {
    const toe = this.toePosition(side);
    if (!toe) return;
    const root = this.root.position;
    const reach = (toe.x - root.x) * Math.sin(this.facing) + (toe.z - root.z) * Math.cos(this.facing);
    const last = this.footLast[side];
    this.footLast[side] = reach;
    if (last === null) return;
    const delta = reach - last;
    const travel = this.footTravel[side];
    this.footTravel[side] = Math.sign(delta) === Math.sign(travel) ? travel + delta : delta;
    if (this.footTravel[side] > 0) {
      this.footPressed[side] = false;
      this.captureStance(side);
      return;
    }
    if (this.footTravel[side] <= -FOOT_LAND_DISTANCE && !this.footPressed[side]) {
      this.footPressed[side] = true;
      this.footSpot[side] = this.soleSpot(side);
      this.plantFoot(side, sprint);
    }
  }

  captureStance(side) {
    const start = this.footSpot[side];
    if (!start) return;
    this.footSpot[side] = null;
    const spot = this.soleSpot(side);
    if (!spot) return;
    this.footStance[side] = Math.hypot(spot.x - start.x, spot.z - start.z);
  }

  soleSpot(side) {
    const foot = this.footPosition(side);
    const toe = this.toePosition(side);
    if (foot && toe) return { x: (foot.x + toe.x) / 2, z: (foot.z + toe.z) / 2 };
    if (toe) return { x: toe.x, z: toe.z };
    if (foot) return { x: foot.x, z: foot.z };
    return null;
  }

  plantFoot(side, sprint) {
    this.footIdle[side] = 0;
    const spot = this.soleSpot(side);
    if (spot) {
      const shift = Math.min(FOOT_SHIFT_MAX, this.footStance[side] * 0.5);
      this.onFootPlant(spot.x + Math.sin(this.facing) * shift, spot.z + Math.cos(this.facing) * shift, this.facing, side, sprint);
      return;
    }
    const lateral = side === 'left' ? FOOT_SIDE_OFFSET : -FOOT_SIDE_OFFSET;
    const root = this.root.position;
    this.onFootPlant(root.x + Math.cos(this.facing) * lateral, root.z - Math.sin(this.facing) * lateral, this.facing, side, sprint);
  }

  resetFootTracking() {
    for (const side of FOOT_SIDES) {
      this.footTravel[side] = 0;
      this.footPressed[side] = false;
      this.footLast[side] = null;
      this.footSpot[side] = null;
      this.footIdle[side] = 0;
    }
  }

  updateSteps(sprint, step) {
    this.travelled += step;
    if (this.travelled < STEP_DISTANCE) return;
    this.travelled = 0;
    if (!this.onStep) return;
    const pos = this.root.position;
    this.stepSide = -this.stepSide;
    const side = this.stepSide > 0 ? 'left' : 'right';
    const foot = this.footPosition(side);
    this.onStep(pos.x, pos.z, sprint, this.facing, side, foot ? foot.x : null, foot ? foot.z : null);
  }

  cameraForward(camera) {
    if (!camera) return new Vector3(0, 0, 1);
    const target = camera.getTarget();
    const dir = target.subtract(camera.position);
    dir.y = 0;
    if (dir.lengthSquared() < 0.0001) return new Vector3(0, 0, 1);
    return dir.normalize();
  }

  serialize() {
    return {
      x: this.root ? this.root.position.x : SPAWN.x,
      z: this.root ? this.root.position.z : SPAWN.z,
      facing: this.facing,
      level: Number.isFinite(this.level) ? this.level : 0,
      weaponDrawn: this.weaponDrawn,
    };
  }

  defaultState() {
    return { x: SPAWN.x, z: SPAWN.z, facing: 0, level: 0, weaponDrawn: false };
  }

  apply(data) {
    const d = data || {};
    this.dead = false;
    this.weaponDrawn = d.weaponDrawn === true;
    if (!this.root) {
      this.pendingState = d;
      return;
    }
    this.pendingState = null;
    this.level = Number.isFinite(d.level) ? d.level : 0;
    let x = typeof d.x === 'number' ? d.x : SPAWN.x;
    let z = typeof d.z === 'number' ? d.z : SPAWN.z;
    const facing = typeof d.facing === 'number' ? d.facing : 0;
    if (!this.root) return;
    if (!this.standsOnMap(x, z)) {
      const spot = this.nearestWalkable(x, z);
      x = spot.x;
      z = spot.z;
    }
    this.root.position = this.positionAt(x, z);
    this.snapFacing(facing);
    if (this.onTeleport) this.onTeleport(x, z);
  }

  standsOnMap(x, z) {
    const cells = typeof this.walkableCells === 'function' ? this.walkableCells() : this.walkableCells;
    if (!cells || !cells.length) return true;
    const { cx, cz } = worldToCellCoords(x, z);
    return cells.some(([ax, az]) => ax === cx && az === cz);
  }

  nearestWalkable(x, z) {
    const cells = typeof this.walkableCells === 'function' ? this.walkableCells() : this.walkableCells;
    if (!cells || !cells.length) return SPAWN;
    const from = worldToCellCoords(x, z);
    let best = cells[0];
    let bestDist = Infinity;
    for (const [cx, cz] of cells) {
      const dist = Math.hypot(cx - from.cx, cz - from.cz);
      if (dist < bestDist) {
        bestDist = dist;
        best = [cx, cz];
      }
    }
    return cellToWorldCoords(best[0], best[1]);
  }
}

function turnToward(current, target, maxDelta) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}
