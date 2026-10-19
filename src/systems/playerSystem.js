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

    const speedRatio = 1 / this.s.getAnimationRatio();
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
        group.speedRatio = speedRatio;
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
    this.clearPose(group);
    group.start(true, group.speedRatio, group.from, group.to);
    this.current = group;
    this.currentKey = key;
  }

  clearPose(keep) {
    for (const group of Object.values(this.anims)) {
      if (group === keep) continue;
      if (group.isStarted) group.stop();
      for (const animatable of group.animatables) {
        for (const runtime of animatable.getAnimations()) runtime.stop(false);
      }
    }
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

  canStand(x, z) {
    if (this.blockedTest && this.blockedTest(x, z)) return false;
    return true;
  }

  update(dt) {
    if (!this.ready || !this.root) return;

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
    const speed = sprint ? MOVE_SPEED : WALK_SPEED;
    const step = speed * dt;
    const pos = this.root.position;
    const nextX = pos.x + move.x * step;
    const nextZ = pos.z + move.z * step;

    const { cx, cz } = worldToCellCoords(nextX, nextZ);
    if (this.canStand(cx, cz)) {
      this.root.position = new Vector3(nextX, 0, nextZ);
    }

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
