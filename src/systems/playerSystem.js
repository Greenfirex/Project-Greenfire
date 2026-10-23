// Hratelná postava — načtení modelu s vlastní texturou, animace z vedlejších souborů a pohyb po světě.
// Model i animace se stahují najednou; nástroj teprve ve chvíli, kdy ho hráč poprvé vezme do ruky.
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { worldToCellCoords, cellToWorldCoords } from '../utils/gridMath.js';
import { TOOL_TYPES } from '../data/catalogs/items.js';
import { toolModelUrl, PLAYER_MODEL, PLAYER_ANIMS } from '../data/catalogs/modelCatalog.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';
import TorchFire from '../effects/torchFire.js';

const ANIM_NAMES = {
  idle: 'Idle_A',
  walk: 'Walking_A',
  run: 'Running_A',
  jump: 'Jump_Full_Short',
  chop: 'Chopping',
  mine: 'Pickaxing',
  chopBare: 'Use_Item',
  holdTool: 'Holding_A',
  ignite: 'Interact',
};
const ANIM_BLEND = 0.25;
const STRIKE_SHARE = {
  chop: 0.55,
  mine: 0.3,
  chopBare: 0.55,
};
const STRIKE_HOLD = 0.12;
const STRIKE_FALLBACK = 0.5;
const IGNITE_SHARE = 0.55;
const IGNITE_HOLD = 0.35;
const IGNITE_FALLBACK = 0.75;
const STEP_DISTANCE = 1.5;
const HAND_BONE = 'handslot.r';
const TOOL_SCALE = 0.95;
const TOOL_POSITION = new Vector3(-0.12, 0.12, 0.04);
const TOOL_ROTATION = new Vector3(0, Math.PI, -0.45);
const PLAN_POSITION = new Vector3(0, -0.02, 0.14);
const PLAN_ROTATION = new Vector3(Math.PI / 2, 0, 0);
const BODY_RADIUS = 0.3;
const BODY_MARGIN = 0.08;
const SLIDE_LOOKAHEAD = 1.2;
const SLIDE_MIN = 0.12;
const MOVE_SPEED = 4.5;
const WALK_SPEED = 2.4;
const TURN_SPEED = 12;
const MODEL_HEIGHT = 1.75;
const MODEL_BASE_HEIGHT = 2.27;
const MODEL_YAW = 0;
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
    this.decoSystem = null;
    this.spawnCell = null;
    this.walkableCells = null;
    this.ready = false;
    this.toolTemplates = {};
    this.toolLoading = {};
    this.heldToolKey = null;
    this.loadStep = null;
    this.keysBound = false;
    this.toolNode = null;
    this.torchFire = null;
    this.handSlot = null;
    this.strikeTimer = 0;
    this.strikeAnim = 'chopBare';
    this.igniteTimer = 0;
    this.igniteImpactAt = 0;
    this.travelled = 0;
    this.homeX = 0;
    this.homeZ = 0;
    this.onStep = null;
    this.onProgress = null;
    this.progressTotal = 1 + PLAYER_ANIMS.length + 1;
  }

  async create() {
    this.beginStep();
    try {
      const loaded = await Promise.all([
        ImportMeshAsync(PLAYER_MODEL, this.s),
        ...PLAYER_ANIMS.map((url) => ImportMeshAsync(url, this.s)),
      ]);
      this.reportProgress(1);
      const result = loaded[0];
      const root = new TransformNode('playerRoot', this.s);
      for (const mesh of result.meshes) {
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
      this.root.position = new Vector3(start.x, 0, start.z);
      this.homeX = start.x;
      this.homeZ = start.z;

      this.loadAnimations(loaded.slice(1));
      this.reportProgress(3);
      await this.attachToolNode();
      this.play('idle');
      this.bindKeys();
      this.ready = true;
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
    const bone = skeleton.bones.find((b) => b.name === HAND_BONE);
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
    const plan = tool.mode === 'build';
    this.toolNode.scaling = new Vector3(TOOL_SCALE, TOOL_SCALE, TOOL_SCALE);
    this.toolNode.position = plan ? PLAN_POSITION.scale(TOOL_SCALE) : TOOL_POSITION.scale(TOOL_SCALE);
    this.toolNode.rotation = plan ? PLAN_ROTATION : TOOL_ROTATION;
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

  strike() {
    this.strikeAnim = this.heldToolKey === 'pickaxe' ? 'mine' : (TOOL_TYPES[this.heldToolKey] && TOOL_TYPES[this.heldToolKey].mode === 'gather' ? 'chop' : 'chopBare');
    const length = this.animLength(this.strikeAnim, STRIKE_FALLBACK);
    const share = STRIKE_SHARE[this.strikeAnim] || 0.6;
    this.strikeTimer = Math.max(0.15, length * share + STRIKE_HOLD);
    this.play(this.strikeAnim, true);
    return this.strikeTimer;
  }

  strikeImpactTime() {
    const share = STRIKE_SHARE[this.strikeAnim] || 0.6;
    const impact = this.strikeTimer * share;
    return impact > 0 ? impact : STRIKE_FALLBACK * share;
  }

  strikeDuration() {
    return this.strikeTimer;
  }

  igniteAt(x, z) {
    this.faceTo(x, z);
    this.strikeTimer = 0;
    const length = this.animLength('ignite', IGNITE_FALLBACK);
    this.igniteTimer = Math.max(0.35, length * IGNITE_SHARE + IGNITE_HOLD);
    this.igniteImpactAt = Math.max(0.15, this.igniteTimer * IGNITE_SHARE);
    this.play('ignite', true);
    return this.igniteTimer;
  }

  cancelIgnite() {
    if (this.igniteTimer <= 0) return false;
    this.igniteTimer = 0;
    this.igniteImpactAt = 0;
    this.play('idle');
    return true;
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

  loadAnimations(sources) {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const nodeByName = new Map();
    for (const bone of skeleton.bones) {
      const node = bone.getTransformNode();
      if (node) nodeByName.set(bone.name, node);
    }

    for (const result of sources || []) {
      for (const [key, name] of Object.entries(ANIM_NAMES)) {
        const source = result.animationGroups.find((g) => g.name === name);
        if (!source) continue;
        source.stop();
        const group = source.clone(`player_${key}`, (target) => nodeByName.get(target.name) || null);
        group.weight = 1;
        group.enableBlending = true;
        group.blendingSpeed = ANIM_BLEND;
        this.anims[key] = group;
      }
      for (const group of result.animationGroups) group.stop();
      for (const mesh of result.meshes) {
        if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
        mesh.setEnabled(false);
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

  keepGrounded() {
    const root = this.root;
    if (!root || root.isDisposed()) return;
    if (!Number.isFinite(root.position.x) || !Number.isFinite(root.position.z) || !Number.isFinite(root.position.y)) {
      root.position.set(this.homeX, 0, this.homeZ);
    }
    if (!root.isEnabled(false)) root.setEnabled(true);
    if (!this.mesh || this.mesh.isDisposed()) return;
    if (!this.mesh.isEnabled(false)) this.mesh.setEnabled(true);
  }

  endStrike() {
    this.strikeTimer = 0;
    this.play(this.idleAnim());
  }

  idleAnim() {
    return this.heldToolKey ? 'holdTool' : 'idle';
  }

  play(key, restart = false) {
    const group = this.anims[key];
    if (!group) return;
    if (this.currentKey === key) {
      if (restart) group.start(true, group.speedRatio, group.from, group.to);
      return;
    }
    if (this.current && this.current !== group) this.current.stop();
    for (const [otherKey, other] of Object.entries(this.anims)) {
      if (otherKey === key) continue;
      for (const animatable of other.animatables) {
        for (const runtime of animatable.getAnimations()) runtime.stop(false);
      }
    }
    group.start(true, group.speedRatio, group.from, group.to);
    this.current = group;
    this.currentKey = key;
  }

  ensurePlaying() {
    const group = this.current;
    if (!group || group.isStarted) return;
    group.restart();
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
  }

  setKey(evt, down) {
    const action = MOVE_KEYS[evt.code];
    if (!action) return;
    if (evt.target && evt.target.tagName === 'INPUT') return;
    evt.preventDefault();
    this.input[action] = down;
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
        this.root.position.set(this.homeX, 0, this.homeZ);
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
      this.root.position = new Vector3(nextX, 0, nextZ);
    }
    return !this.decoSystem.overlaps(this.root.position.x, this.root.position.z, BODY_RADIUS + BODY_MARGIN);
  }

  tryMove(x, z, dirX, dirZ, step) {
    if (!this.free(this.root.position.x, this.root.position.z)) this.pushOut();
    if (this.stepAllowed(x, z) && this.free(x, z)) {
      this.root.position = new Vector3(x, 0, z);
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
        this.root.position = new Vector3(ax, 0, az);
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
    return fromOk === toOk;
  }

  update(dt) {
    if (!this.ready || !this.root || this.root.isDisposed()) return;
    this.keepGrounded();
    this.ensurePlaying();
    if (this.strikeTimer > 0) {
      this.strikeTimer -= dt;
      this.play(this.strikeAnim);
      if (this.strikeTimer > 0) return;
      const done = this.anims[this.strikeAnim];
      if (done) done.pause();
      this.endStrike();
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
      this.play('idle');
      return;
    }

    move.normalize();
    const sprint = this.input.sprint;
    const step = (sprint ? MOVE_SPEED : WALK_SPEED) * dt;
    this.tryMove(this.root.position.x + move.x * step, this.root.position.z + move.z * step, move.x, move.z, step);
    this.updateSteps(sprint, step);
    this.updateHome();

    const target = Math.atan2(move.x, move.z);
    this.facing = turnToward(this.facing, target, TURN_SPEED * dt);
    this.root.rotation.y = this.facing + MODEL_YAW;
    this.play(sprint ? 'run' : 'walk');
  }

  updateSteps(sprint, step) {
    this.travelled += step;
    if (this.travelled < STEP_DISTANCE) return;
    this.travelled = 0;
    if (!this.onStep) return;
    const pos = this.root.position;
    this.onStep(pos.x, pos.z, sprint);
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
    let x = typeof d.x === 'number' ? d.x : SPAWN.x;
    let z = typeof d.z === 'number' ? d.z : SPAWN.z;
    const facing = typeof d.facing === 'number' ? d.facing : 0;
    if (!this.root) return;
    if (!this.standsOnMap(x, z)) {
      const spot = this.nearestWalkable(x, z);
      x = spot.x;
      z = spot.z;
    }
    this.root.position = new Vector3(x, 0, z);
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
