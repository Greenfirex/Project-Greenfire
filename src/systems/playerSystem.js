// HratelnĂˇ postava â€” naÄŤtenĂ­ modelu s vlastnĂ­ texturou, animace z vedlejĹˇĂ­ch souborĹŻ a pohyb po svÄ›tÄ›.
// Model i animace se stahujĂ­ najednou; nĂˇstroj teprve ve chvĂ­li, kdy ho hrĂˇÄŤ poprvĂ© vezme do ruky.
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { worldToCellCoords, cellToWorldCoords } from '../utils/gridMath.js';
import { TOOL_TYPES } from '../data/catalogs/items.js';
import {
  toolModelUrl,
  PLAYER_MODEL,
  PLAYER_ANIMS,
  PLAYER_BASE_HEIGHT,
  PLAYER_MODEL_YAW,
  PLAYER_INTRO_YAW,
  PLAYER_HAND_BONES,
  PLAYER_FOOT_BONES,
  PLAYER_ANIM_NAMES,
  PLAYER_ANIM_SPEEDS,
  PLAYER_ANIM_FALLBACKS,
  PLAYER_ANIM_RANGES,
  PLAYER_ANIM_ROOTLESS,
  PLAYER_DEATH_OVERLAY_SHARE,
} from '../data/catalogs/modelCatalog.js';
import { loadModel, instantiateModel, loadImported } from '../utils/assetLoader.js';
import TorchFire from '../effects/torchFire.js';

const ANIM_BLEND = 0.25;
const STRIKE_PLAY_SHARE = {
  punch: 1,
  kick: 1,
};
const STRIKE_IMPACT_SHARE = {
  chop: 0.55,
  mine: 0.45,
  punch: 0.4,
  kick: 0.55,
};
const STRIKE_HOLD = 0.12;
const STRIKE_FALLBACK = 0.5;
const IGNITE_SHARE = 0.55;
const IGNITE_HOLD = 0.35;
const IGNITE_FALLBACK = 0.75;
const PICKUP_SHARE = 0.55;
const PICKUP_HOLD = 0.12;
const PICKUP_FALLBACK = 0.75;
const FLINCH_FALLBACK = 0.5;
const DEATH_OVERLAY_FALLBACK = 0.8;
const STEP_DISTANCE = 1.5;
const TOOL_SCALE = 0.95;
const TOOL_POSITION = new Vector3(-0.12, 0.12, 0.04);
const TOOL_ROTATION = new Vector3(0, 0, -0.45);
const BODY_RADIUS = 0.3;
const BODY_MARGIN = 0.08;
const SLIDE_LOOKAHEAD = 1.2;
const SLIDE_MIN = 0.12;
const MOVE_SPEED = 4.5;
export const STEP_LIMIT = 0.45;
const WALK_SPEED = 2.4;
const TURN_SPEED = 12;
const LOOK_TURN_SPEED = 6;
const LOOK_DEAD_ZONE = 0.7;
const MODEL_HEIGHT = 2.31;
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
    this.speedScale = null;
    this.lookAt = null;
    this.inCombat = null;
    this.canSprint = null;
    this.sprinting = false;
    this.sprintSpent = false;
    this.decoSystem = null;
    this.groundHeightAt = null;
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
    this.loadStep = null;
    this.keysBound = false;
    this.toolNode = null;
    this.torchFire = null;
    this.handSlot = null;
    this.strikeTimer = 0;
    this.strikeAnim = 'punch';
    this.flinchTimer = 0;
    this.pickupKey = 'pickup';
    this.footBones = { left: null, right: null };
    this.stepSide = 1;
    this.footContact = { left: true, right: true };
    this.footLow = { left: Infinity, right: Infinity };
    this.footHigh = { left: -Infinity, right: -Infinity };
    this.footInitialized = false;
    this.footFallbackTimer = 0;
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
    this.beginStep();
    try {
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
      this.bindKeys();
      this.ready = true;
      if (hasSave) this.play(this.idleAnim());
      else this.lieDown();
      return this.root;
    } finally {
      this.endStep();
    }
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
    }).catch(() => {
      this.toolLoading[tool.model] = false;
    });
  }

  beginStep() {
    const loader = this.s.loader;
    this.loadStep = loader ? loader.attach(1) : null;
  }

  endStep() {
    const loader = this.s.loader;
    if (loader && this.loadStep) loader.detach(this.loadStep);
    this.loadStep = null;
  }

  async attachToolNode() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const bone = this.findHandBone(skeleton);
    const hand = bone && bone.getTransformNode();
    if (!hand) return;
    this.handSlot = new TransformNode('playerHandSlot', this.s);
    this.handSlot.parent = hand;
    this.handSlot.position = Vector3.Zero();
    this.handSlot.rotation = Vector3.Zero();
    this.handSlot.scaling = new Vector3(TOOL_SCALE, TOOL_SCALE, TOOL_SCALE);
    this.refreshToolNode();
  }

  refreshToolNode() {
    if (this.torchFire) {
      this.torchFire.detach();
      this.torchFire.dispose();
      this.torchFire = null;
      this.syncTorchGlow();
    }
    if (this.toolNode) {
      this.toolNode.setEnabled(false);
      this.toolNode.dispose(false, false);
      this.toolNode = null;
    }
    if (!this.handSlot) return;
    const tool = TOOL_TYPES[this.heldToolKey];
    if (!tool || !tool.model) return;
    const template = this.toolTemplates[tool.model];
    if (template === undefined) {
      this.prefetchTool(this.heldToolKey);
      return;
    }
    this.toolNode = instantiateModel(this.s, template, `playerHeld_${tool.model}`);
    if (!this.toolNode) return;
    this.toolNode.parent = this.handSlot;
    this.toolNode.scaling = new Vector3(TOOL_SCALE, TOOL_SCALE, TOOL_SCALE);
    this.toolNode.position = TOOL_POSITION.scale(TOOL_SCALE);
    this.toolNode.rotation = TOOL_ROTATION;
    if (tool.model !== 'torch') return;
    this.torchFire = new TorchFire(this.s);
    this.torchFire.attach(this.toolNode);
    this.syncTorchGlow();
  }

  setHeldTool(key) {
    if (this.heldToolKey === key) return;
    this.heldToolKey = key || null;
    this.refreshToolNode();
  }

  updateFire() {
    const fire = this.torchFire;
    if (!fire) return;
    const frame = this.s.getEngine().getDeltaTime() / 1000;
    fire.update(Number.isFinite(frame) && frame > 0 ? Math.min(frame, 0.1) : 0.016);
  }

  setTorchGlow(glow) {
    this.torchGlow = glow;
  }

  syncTorchGlow() {
    if (!this.torchGlow) return;
    if (this.torchFire) this.torchGlow.addSource(this.torchFire);
    else this.torchGlow.removeSource(this.torchFireSource);
    this.torchFireSource = this.torchFire;
  }

  animLength(key, fallback) {
    const group = this.anims[key];
    if (!group) return fallback;
    let length = 0;
    try {
      length = group.getLength(group.from, group.to) / (group.speedRatio || 1);
      if (!length) length = (group.to - group.from) / (group.targetedAnimations[0]?.animation.framePerSecond || 0);
    } catch {
      length = 0;
    }
    return Number.isFinite(length) && length > 0 ? length : fallback;
  }

  strike(animKey) {
    this.flinchTimer = 0;
    this.strikeAnim = animKey || this.strikeAnimationForTool();
    const length = this.animLength(this.strikeAnim, STRIKE_FALLBACK);
    const playShare = STRIKE_PLAY_SHARE[this.strikeAnim] || STRIKE_IMPACT_SHARE[this.strikeAnim] || 1;
    this.strikeTimer = Math.max(0.15, length * playShare + STRIKE_HOLD);
    this.play(this.strikeAnim, true);
    return this.strikeTimer;
  }

  strikeAnimationForTool() {
    if (this.heldToolKey === 'pickaxe') return 'mine';
    const tool = TOOL_TYPES[this.heldToolKey];
    return tool && tool.harvest ? 'chop' : 'punch';
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
    this.igniteTimer = Math.max(0.35, length * IGNITE_SHARE + IGNITE_HOLD);
    this.igniteImpactAt = Math.max(0.15, this.igniteTimer * IGNITE_SHARE);
    this.play('ignite', true);
    return this.igniteTimer;
  }

  pickUp() {
    this.strikeTimer = 0;
    this.flinchTimer = 0;
    this.pickupKey = 'pickup';
    const length = this.animLength('pickup', PICKUP_FALLBACK);
    this.pickupTimer = Math.max(0.18, length * PICKUP_SHARE + PICKUP_HOLD);
    this.pickupImpactAt = Math.max(0.12, this.pickupTimer * PICKUP_SHARE);
    this.play('pickup', true);
    return this.pickupTimer;
  }

  crouchPickUp() {
    if (!this.anims.crouchPickup) return 0;
    this.strikeTimer = 0;
    this.flinchTimer = 0;
    this.pickupKey = 'crouchPickup';
    const length = this.animLength('crouchPickup', PICKUP_FALLBACK);
    this.pickupTimer = Math.max(0.25, length + PICKUP_HOLD);
    this.pickupImpactAt = Math.max(0.15, this.pickupTimer * PICKUP_SHARE);
    this.play('crouchPickup', true, false);
    return this.pickupTimer;
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
    this.flinchTimer = Math.max(0.2, this.animLength('flinch', FLINCH_FALLBACK));
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
    this.root.rotation.y = this.facing;
  }

  lookAround(dt) {
    if (!this.lookAt || !this.root) return;
    const point = this.lookAt();
    if (!point) return;
    const dx = point.x - this.root.position.x;
    const dz = point.z - this.root.position.z;
    if (dx * dx + dz * dz < LOOK_DEAD_ZONE * LOOK_DEAD_ZONE) return;
    const target = Math.atan2(dx, dz);
    this.facing = turnToward(this.facing, target, LOOK_TURN_SPEED * dt);
    this.root.rotation.y = this.facing + MODEL_YAW;
  }

  cacheFootBones() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton || !Array.isArray(skeleton.bones)) return;
    for (const [side, names] of Object.entries(PLAYER_FOOT_BONES)) {
      const wanted = names.map((name) => String(name).toLowerCase());
      const bone = skeleton.bones.find((item) => {
        const name = String(item.name || '').toLowerCase();
        return wanted.includes(name) || wanted.some((candidate) => name.endsWith(':' + candidate));
      });
      this.footBones[side] = bone ? bone.getTransformNode() : null;
    }
  }

  footPosition(side) {
    const node = this.footBones[side];
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

    const embedded = modelResult && Array.isArray(modelResult.animationGroups)
      ? modelResult.animationGroups
      : [];
    const external = [];
    for (const result of sources || []) {
      if (result && Array.isArray(result.animationGroups)) external.push(...result.animationGroups);
    }
    const all = [...embedded, ...external];
    const embeddedSet = new Set(embedded);

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
        group = source.clone(`player_${key}`, (target) => nodeByName.get(target.name) || null);
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

  prepareAnimation(key, group) {
    if (!group) return;
    if (PLAYER_ANIM_ROOTLESS.includes(key)) this.removeRootMotion(group);
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

  removeRootMotion(group) {
    const list = group.targetedAnimations;
    if (!list) return;
    for (const item of list) {
      const target = item && item.target;
      const animation = item && item.animation;
      if (!target || !animation || animation.targetProperty !== 'position') continue;
      if (target.name !== 'Hips' && !String(target.name).endsWith(':Hips')) continue;
      const keys = animation.getKeys();
      if (!keys || !keys.length || !keys[0].value) continue;
      const base = keys[0].value;
      for (const key of keys) {
        if (!key.value) continue;
        key.value.x = base.x;
        key.value.z = base.z;
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

  groundY(x, z) {
    const height = this.groundHeightAt ? this.groundHeightAt(x, z) : 0;
    return Number.isFinite(height) ? height : 0;
  }

  positionAt(x, z) {
    return new Vector3(x, this.groundY(x, z), z);
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

  endStrike() {
    this.strikeTimer = 0;
    this.play(this.idleAnim());
  }

  idleAnim() {
    if (this.inCombat && this.inCombat() && this.anims.combatStance) return 'combatStance';
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
      this.facing = PLAYER_INTRO_YAW;
      if (this.root) this.root.rotation.y = this.facing + MODEL_YAW;
      group.stop();
      group.start(false, 0.001, group.from, group.to);
    } else {
      console.warn('[player] ChybĂ­ animace Stand_Up1 â€” postava zĹŻstane ve vĂ˝chozĂ­ pĂłze.');
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
    if (!group || group.isStarted) return;
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

  free(x, z) {
    const { cx, cz } = worldToCellCoords(x, z);
    if (this.blockedTest && this.blockedTest(cx, cz)) return false;
    if (this.walkable && !this.walkable(x, z)) return false;
    if (this.decoSystem && this.decoSystem.overlaps(x, z, BODY_RADIUS + BODY_MARGIN)) return false;
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
      const contact = this.decoSystem.nearestContact(x, z, BODY_RADIUS + BODY_MARGIN, 0);
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
    return !this.decoSystem.overlaps(this.root.position.x, this.root.position.z, BODY_RADIUS + BODY_MARGIN);
  }

  tryMove(x, z, dirX, dirZ, step) {
    if (!this.free(this.root.position.x, this.root.position.z)) this.pushOut();
    if (this.stepAllowed(x, z) && this.free(x, z)) {
      this.root.position = this.positionAt(x, z);
      return true;
    }
    const startX = this.root.position.x;
    const startZ = this.root.position.z;
    if (!this.decoSystem) return false;
    const contact = this.decoSystem.nearestContact(startX, startZ, BODY_RADIUS, SLIDE_LOOKAHEAD);
    if (!contact) return false;
    const dot = dirX * contact.nx + dirZ * contact.nz;
    if (dot >= 0) return false;
    const slideX = dirX - contact.nx * dot;
    const slideZ = dirZ - contact.nz * dot;
    const length = Math.sqrt(slideX * slideX + slideZ * slideZ);
    if (length < SLIDE_MIN) return false;
    const sx = slideX / length;
    const sz = slideZ / length;
    for (const scale of [1, 0.8, 0.6, 0.4]) {
      const ax = startX + sx * step * scale;
      const az = startZ + sz * step * scale;
      if (this.stepAllowed(ax, az) && this.free(ax, az)) {
        this.root.position = this.positionAt(ax, az);
        return true;
      }
    }
    return false;
  }

  stepAllowed(x, z) {
    if (!this.walkable) return true;
    const from = this.root.position;
    const fromOk = this.walkable(from.x, from.z);
    const toOk = this.walkable(x, z);
    if (fromOk !== toOk) return false;
    return Math.abs(this.groundY(x, z) - this.groundY(from.x, from.z)) <= STEP_LIMIT;
  }

  update(dt) {
    if (!this.ready || !this.root || this.root.isDisposed()) return;
    this.keepGrounded();
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
    if (this.strikeTimer > 0) {
      this.strikeTimer -= dt;
      this.play(this.strikeAnim);
      if (this.strikeTimer > 0) return;
      const done = this.anims[this.strikeAnim];
      if (done) done.pause();
      this.endStrike();
    }
    if (this.pickupTimer > 0) {
      this.pickupTimer -= dt;
      this.pickupImpactAt -= dt;
      if (this.pickupTimer > 0) {
        this.play(this.pickupKey);
        return;
      }
      const finished = this.anims[this.pickupKey];
      if (finished) finished.pause();
      this.pickupImpactAt = 0;
      this.pickupKey = 'pickup';
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

    const camera = this.s.activeCamera;
    const forward = this.cameraForward(camera);
    const right = new Vector3(forward.z, 0, -forward.x);

    const move = new Vector3(0, 0, 0);
    if (this.input.forward) move.addInPlace(forward);
    if (this.input.back) move.subtractInPlace(forward);
    if (this.input.right) move.addInPlace(right);
    if (this.input.left) move.subtractInPlace(right);

    if (move.lengthSquared() < 0.0001) {
      this.lookAround(dt);
      this.play(this.idleAnim());
      return;
    }

    move.normalize();
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
    this.root.rotation.y = this.facing + MODEL_YAW;
    this.play(sprint ? 'run' : 'walk');
    this.updateFootprints(dt, sprint);
  }

  updateFootprints(dt, sprint) {
    if (!this.onFootPlant) return;
    this.footFallbackTimer += Number.isFinite(dt) ? dt : 0;
    let emitted = false;
    for (const side of ['left', 'right']) {
      const foot = this.footPosition(side);
      if (!foot) continue;
      const ground = this.groundY(foot.x, foot.z);
      const height = foot.y - ground;
      if (height < this.footLow[side]) this.footLow[side] = height;
      if (height > this.footHigh[side]) this.footHigh[side] = height;
      const span = this.footHigh[side] - this.footLow[side];
      const threshold = this.footLow[side] + Math.max(0.04, span * 0.25);
      const planted = height <= threshold;
      if (!this.footInitialized) this.footContact[side] = planted;
      else if (this.footContact[side] && !planted && span > 0.04) {
        this.onFootPlant(foot.x, foot.z, this.facing, side, sprint);
        emitted = true;
        this.footFallbackTimer = 0;
      }
      this.footContact[side] = planted;
    }
    if (!emitted && this.footFallbackTimer > (sprint ? 0.45 : 0.75)) {
      this.stepSide = -this.stepSide;
      const side = this.stepSide > 0 ? 'left' : 'right';
      const foot = this.footPosition(side);
      this.onFootPlant(foot ? foot.x : this.root.position.x, foot ? foot.z : this.root.position.z, this.facing, side, sprint);
      this.footFallbackTimer = 0;
    }
    this.footInitialized = true;
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
    };
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }

  defaultState() {
    return { x: SPAWN.x, z: SPAWN.z, facing: 0 };
  }

  apply(data) {
    const d = data || {};
    this.dead = false;
    if (!this.root) {
      this.pendingState = d;
      return;
    }
    this.pendingState = null;
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
    this.facing = facing;
    this.root.rotation.y = facing;
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
