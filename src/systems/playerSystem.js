// Hratelná postava — načtení modelu se skinem, animace a pohyb po světě.
// WASD/šipky posouvají postavu relativně ke kameře, kolize drží mimo dekorace a stroje.
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Animations/animatable';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { worldToCellCoords } from '../utils/gridMath.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const CHARACTER_DIR = ASSET_DIRS.characters;
const MODEL_URL = `${CHARACTER_DIR}characterMedium.glb`;
const SKIN_URL = `${CHARACTER_DIR}survivorMaleB.png`;
const ANIM_URLS = {
  idle: `${CHARACTER_DIR}idle.glb`,
  run: `${CHARACTER_DIR}run.glb`,
  jump: `${CHARACTER_DIR}jump.glb`,
};
const MOVE_SPEED = 4.5;
const TURN_SPEED = 12;
const MODEL_SCALE = 0.45;
const SPAWN = { x: 0, z: 0 };
const MOVE_KEYS = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export default class PlayerSystem {

  constructor(scene) {
    this.s = scene;
    this.root = null;
    this.mesh = null;
    this.anims = {};
    this.current = null;
    this.currentKey = null;
    this.input = { forward: false, back: false, left: false, right: false };
    this.facing = 0;
    this.blockedTest = null;
    this.ready = false;
  }

  async create() {
    const result = await ImportMeshAsync(MODEL_URL, this.s);
    const root = new TransformNode('playerRoot', this.s);
    for (const mesh of result.meshes) {
      if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
        this.mesh = mesh;
        mesh.parent = root;
        mesh.isPickable = false;
        mesh.receiveShadows = true;
      }
    }
    this.root = root;
    this.applySkin();
    root.scaling = new Vector3(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
    this.root.position = new Vector3(SPAWN.x, 0, SPAWN.z);

    await this.loadAnimations();
    this.play('idle');
    this.bindKeys();
    this.ready = true;
    return this.root;
  }

  applySkin() {
    const mat = this.mesh && this.mesh.material;
    if (!mat) return;
    const texture = new Texture(SKIN_URL, this.s);
    if ('albedoTexture' in mat) {
      mat.albedoTexture = texture;
      mat.albedoColor.set(1, 1, 1);
      if ('metallic' in mat) mat.metallic = 0;
      if ('roughness' in mat) mat.roughness = 0.9;
    } else {
      mat.diffuseTexture = texture;
    }
    this.mesh.useVertexColors = false;
  }

  async loadAnimations() {
    const skeleton = this.mesh && this.mesh.skeleton;
    if (!skeleton) return;
    const nodeByName = new Map();
    for (const bone of skeleton.bones) {
      const node = bone.getTransformNode();
      if (node) nodeByName.set(bone.name, node);
    }

    for (const [key, url] of Object.entries(ANIM_URLS)) {
      const result = await ImportMeshAsync(url, this.s);
      const source = result.animationGroups.find((g) => !g.name.includes('Targeting'));
      if (!source) continue;
      source.stop();
      const group = source.clone(`player_${key}`, (target) => nodeByName.get(target.name) || target);
      group.weight = 1;
      group.enableBlending = true;
      group.blendingSpeed = 0.08;
      const last = Math.max(...group.targetedAnimations.map((t) => t.animation.getKeys().at(-1).frame));
      group.from = 0;
      group.to = last;
      this.anims[key] = group;
      for (const mesh of result.meshes) {
        if (!mesh.getTotalVertices || mesh.getTotalVertices() === 0) continue;
        mesh.setEnabled(false);
      }
    }
  }

  play(key) {
    const group = this.anims[key];
    if (!group || this.currentKey === key) return;
    if (this.current) this.current.stop();
    this.current = group;
    this.currentKey = key;
    group.start(true, 1.0);
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
    const step = MOVE_SPEED * dt;
    const pos = this.root.position;
    const nextX = pos.x + move.x * step;
    const nextZ = pos.z + move.z * step;

    const { cx, cz } = worldToCellCoords(nextX, nextZ);
    if (this.canStand(cx, cz)) {
      this.root.position = new Vector3(nextX, 0, nextZ);
    }

    const target = Math.atan2(move.x, move.z);
    this.facing = turnToward(this.facing, target, TURN_SPEED * dt);
    this.root.rotation.y = this.facing;
    this.play('run');
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
