// Hratelná postava — načtení modelu s vlastní texturou, animace z vedlejších souborů a pohyb po světě.
// WASD/šipky posouvají postavu relativně ke kameře, kolize drží mimo dekorace a stroje.
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { worldToCellCoords } from '../utils/gridMath.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const CHARACTER_DIR = `${ASSET_DIRS.characters}KayKit_Adventurers_2.0_FREE/`;
const MODEL_URL = `${CHARACTER_DIR}Characters/gltf/Ranger.glb`;
const ANIM_DIR = `${CHARACTER_DIR}Animations/gltf/Rig_Medium/`;
const ANIM_SOURCES = [`${ANIM_DIR}Rig_Medium_General.glb`, `${ANIM_DIR}Rig_Medium_MovementBasic.glb`];
const ANIM_NAMES = {
  idle: 'Idle_A',
  walk: 'Walking_A',
  run: 'Running_A',
  jump: 'Jump_Full_Short',
};
const ANIM_BLEND = 0.25;
const BODY_RADIUS = 0.3;
const SLIDE_LOOKAHEAD = 0.7;
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
    this.decoSystem = null;
    this.ready = false;
  }

  async create() {
    const result = await ImportMeshAsync(MODEL_URL, this.s);
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
    this.root.position = new Vector3(SPAWN.x, 0, SPAWN.z);

    await this.loadAnimations();
    this.play('idle');
    this.bindKeys();
    this.ready = true;
    return this.root;
  }

  async loadAnimations() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const nodeByName = new Map();
    for (const bone of skeleton.bones) {
      const node = bone.getTransformNode();
      if (node) nodeByName.set(bone.name, node);
    }

    for (const url of ANIM_SOURCES) {
      const result = await ImportMeshAsync(url, this.s);
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

  play(key) {
    const group = this.anims[key];
    if (!group || this.currentKey === key) return;
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
    window.addEventListener('keydown', (evt) => this.setKey(evt, true));
    window.addEventListener('keyup', (evt) => this.setKey(evt, false));
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
    if (this.decoSystem && this.decoSystem.overlaps(x, z, BODY_RADIUS)) return false;
    return true;
  }

  tryMove(x, z, dirX, dirZ, step) {
    if (this.free(x, z)) {
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
      if (this.free(ax, az)) {
        this.root.position = new Vector3(ax, 0, az);
        return true;
      }
    }
    if (!this.free(startX, startZ)) return false;
    for (const scale of [1, 0.8, 0.6, 0.4]) {
      const ax = startX + sx * step * scale;
      const az = startZ + sz * step * scale;
      const next = this.decoSystem.nearestContact(ax, az, BODY_RADIUS, 0);
      if (!next || next.gap >= contact.gap - 0.001) {
        this.root.position = new Vector3(ax, 0, az);
        return true;
      }
    }
    return false;
  }

  update(dt) {
    if (!this.ready || !this.root) return;
    this.ensurePlaying();

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

    const target = Math.atan2(move.x, move.z);
    this.facing = turnToward(this.facing, target, TURN_SPEED * dt);
    this.root.rotation.y = this.facing + MODEL_YAW;
    this.play(sprint ? 'run' : 'walk');
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
    if (!this.root) return { x: SPAWN.x, z: SPAWN.z, facing: 0 };
    return {
      x: this.root.position.x,
      z: this.root.position.z,
      facing: this.facing,
    };
  }

  apply(data) {
    const d = data || {};
    const x = typeof d.x === 'number' ? d.x : SPAWN.x;
    const z = typeof d.z === 'number' ? d.z : SPAWN.z;
    const facing = typeof d.facing === 'number' ? d.facing : 0;
    if (!this.root) return;
    this.root.position = new Vector3(x, 0, z);
    this.facing = facing;
    this.root.rotation.y = facing;
    if (this.onTeleport) this.onTeleport(x, z);
  }
}

function turnToward(current, target, maxDelta) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}
