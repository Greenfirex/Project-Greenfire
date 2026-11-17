// Krabi na pláži — pobíhají bokem po suchu, občas zvednou klepeta, před hráčem utečou
// a na písku se zahrabou. Jsou jen pro ozdobu: systém čte mapu a hýbe hotovými tvary.
// Kraba pod myší kreslí zvlášť, aby kolem něj šel udělat obrys.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Rendering/outlineRenderer';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { OUTLINE_CALM, OUTLINE_PULSE, OUTLINE_PULSE_SPEED } from '../../utils/outlineStyle.js';
import { crabTemplate } from '../../utils/crabTemplate.js';
import { CRAB } from '../../data/catalogs/crabs.js';
import { cellToWorld, worldToCell } from '../../utils/gridMath.js';
import { hash01 } from '../../utils/noise.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';

const MODEL_HEIGHT = 0.25;
const MAX_STEP = 0.1;
const HOME_RADIUS = 3;
const WALK_SPEED = 0.45;
const FLEE_SPEED = 1.7;
const TURN_RATE = 4;
const TURN_BEFORE_MOVE = 0.6;
const STRIDE_PER_WIDTH = 8;
const TURN_STRIDE = 2.5;
const DIG_STRIDE = 16;
const DRY_MARGIN = 0.08;
const MAX_CLIMB = 0.3;
const PATH_SAMPLES = 4;
const SCARE_RANGE = 3.2;
const CLEAR_RANGE = 6;
const FLEE_DISTANCE = 2.2;
const FLEE_TIME = 1.4;
const BURY_TIME = 0.6;
const EMERGE_TIME = 0.8;
const HIDE_MIN = 3;
const HIDE_SPREAD = 5;
const IDLE_MIN = 1;
const IDLE_SPREAD = 4;
const WAVE_SHARE = 0.35;
const WALK_MIN = 0.4;
const WALK_SPREAD = 1.4;
const ACTIVE_RANGE = 45;
const TILT_REACH = 0.4;
const BURST_SCALE = 0.25;
const BURST_SECONDS = 0.4;
const FLEE_ANGLES = [0, 0.6, -0.6, 1.2, -1.2];
const POSE_STRIDE = 4;
const OUTLINE_WIDTH = 0.035;
const HOVER_MIN_PIXELS = 14;
const UP = new Vector3(0, 1, 0);

function wrapAngle(angle) {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

export default class CrabSystem {

  constructor(scene) {
    this.s = scene;
    this.crabs = [];
    this.mesh = null;
    this.matrices = null;
    this.poses = null;
    this.level = null;
    this.groundAt = null;
    this.isSandAt = null;
    this.playerAt = null;
    this.onBurst = null;
    this.onReady = null;
    this.hovered = null;
    this.outline = null;
    this.outlineShown = true;
    this.outlineMatrix = new Float32Array(16);
    this.outlinePose = new Float32Array(POSE_STRIDE);
    this.screen = new Vector3();
    this.probe = new Vector3();
    this.time = 0;
    this.generation = 0;
    this.position = new Vector3();
    this.scaling = new Vector3(1, 1, 1);
    this.normal = new Vector3();
    this.tilt = Quaternion.Identity();
    this.turn = Quaternion.Identity();
    this.rotation = Quaternion.Identity();
    this.matrix = Matrix.Identity();
  }

  create(layout, level, groundAt, isSandAt, playerAt) {
    this.clear();
    if (!layout || !groundAt) return;
    this.level = Number.isFinite(level) ? level : null;
    this.groundAt = groundAt;
    this.isSandAt = isSandAt;
    this.playerAt = playerAt;
    this.time = 0;
    const spots = [...this.brushSpots(layout), ...this.beachSpots(layout)].slice(0, CRAB.maxCount);
    this.crabs = spots
      .map((spot, index) => this.makeCrab(spot.x, spot.z, index))
      .filter(Boolean);
    if (!this.crabs.length) return;
    const generation = this.generation;
    crabTemplate(this.s).then((mesh) => {
      if (generation !== this.generation || !mesh || mesh.isDisposed()) return;
      this.attach(mesh);
    });
  }

  brushSpots(layout) {
    const spots = [];
    for (const entry of layout.crabs || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const count = Math.max(1, Math.min(8, Math.round(entry.count || CRAB.brushCount)));
      for (let index = 0; index < count; index += 1) spots.push(this.spotInCell(entry.cx, entry.cz, index));
    }
    return spots;
  }

  beachSpots(layout) {
    if (this.level === null) return [];
    const seed = Number.isFinite(layout.seed) ? layout.seed : 1;
    const spots = [];
    for (const entry of layout.floor || []) {
      if (!entry || entry.key !== CRAB.sandFloor || levelOfEntry(entry) !== 0) continue;
      if (hash01(entry.cx * 1.31 + seed, entry.cz * 0.77 - seed) >= CRAB.beachShare) continue;
      if (!this.isDry(this.groundAt(cellToWorld(entry.cx), cellToWorld(entry.cz)))) continue;
      if (!this.nearSea(entry.cx, entry.cz)) continue;
      spots.push(this.spotInCell(entry.cx, entry.cz, seed));
    }
    return spots;
  }

  spotInCell(cx, cz, salt) {
    const size = cellToWorld(1);
    return {
      x: cellToWorld(cx) + (hash01(cx * 3.1 + salt, cz * 1.7 - salt) - 0.5) * size * 0.8,
      z: cellToWorld(cz) + (hash01(cz * 2.3 - salt, cx * 4.1 + salt) - 0.5) * size * 0.8,
    };
  }

  nearSea(cx, cz) {
    const reach = CRAB.beachReach;
    for (let dz = -reach; dz <= reach; dz += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const ground = this.groundAt(cellToWorld(cx + dx), cellToWorld(cz + dz));
        if (Number.isFinite(ground) && ground < this.level) return true;
      }
    }
    return false;
  }

  isDry(ground) {
    return Number.isFinite(ground) && (this.level === null || ground >= this.level + DRY_MARGIN);
  }

  makeCrab(x, z, index) {
    const ground = this.groundAt(x, z);
    if (!this.isDry(ground)) return null;
    const seed = hash01(x * 0.73 + index, z * 1.19 - index) * 100;
    const crab = {
      x,
      z,
      homeX: x,
      homeZ: z,
      ground,
      yaw: hash01(seed, seed * 0.3) * Math.PI * 2,
      scale: CRAB.sizeMin + (CRAB.sizeMax - CRAB.sizeMin) * hash01(seed * 1.7, seed) ** 2,
      phase: 0,
      walk: 0,
      claw: 0,
      clawTarget: 0,
      seed,
      roll: 0,
      state: 'idle',
      timer: 0,
      targetX: x,
      targetZ: z,
      sink: 0,
      normalX: 0,
      normalZ: 0,
    };
    crab.timer = IDLE_MIN + this.random(crab) * IDLE_SPREAD;
    this.measureSlope(crab);
    return crab;
  }

  random(crab) {
    crab.roll += 1;
    return hash01(crab.seed * 7.13 + crab.roll * 1.37, crab.seed - crab.roll * 2.11);
  }

  attach(mesh) {
    this.mesh = mesh;
    this.matrices = new Float32Array(this.crabs.length * 16);
    this.poses = new Float32Array(this.crabs.length * POSE_STRIDE);
    mesh.thinInstanceSetBuffer('matrix', this.matrices, 16, false);
    mesh.thinInstanceSetBuffer('crabPose', this.poses, POSE_STRIDE, false);
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isPickable = false;
    for (let index = 0; index < this.crabs.length; index += 1) this.place(this.crabs[index], index);
    this.flush();
    mesh.setEnabled(true);
    this.makeOutline(mesh);
    if (this.onReady) this.onReady();
  }

  makeOutline(mesh) {
    if (this.outline && !this.outline.isDisposed() && this.outline.metadata === mesh) return;
    if (this.outline && !this.outline.isDisposed()) this.outline.dispose();
    const outline = new Mesh('crabOutline', this.s);
    mesh.geometry.applyToMesh(outline);
    outline.makeGeometryUnique();
    outline.material = mesh.material;
    outline.metadata = mesh;
    outline.thinInstanceSetBuffer('matrix', this.outlineMatrix, 16, false);
    outline.thinInstanceSetBuffer('crabPose', this.outlinePose, POSE_STRIDE, false);
    outline.alwaysSelectAsActiveMesh = true;
    outline.isPickable = false;
    outline.renderOutline = this.outlineShown;
    outline.outlineColor = OUTLINE_CALM;
    outline.outlineWidth = OUTLINE_WIDTH;
    outline.setEnabled(false);
    this.outline = outline;
  }

  setOutlineVisible(visible) {
    this.outlineShown = visible !== false;
    if (this.outline && !this.outline.isDisposed()) this.outline.renderOutline = this.outlineShown;
  }

  hoverAt(x, y) {
    const camera = this.s.activeCamera;
    if (!this.mesh || !camera || !Number.isFinite(x) || !Number.isFinite(y)) return this.setHovered(null);
    const engine = this.s.getEngine();
    const scaling = engine.getHardwareScalingLevel();
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const transform = this.s.getTransformMatrix();
    const pointerX = x / scaling;
    const pointerY = y / scaling;
    let best = null;
    let bestGap = Infinity;
    for (const crab of this.crabs) {
      if (crab.sink > 0.5) continue;
      const lift = MODEL_HEIGHT * crab.scale * 0.5;
      this.probe.set(crab.x, crab.ground + lift, crab.z);
      Vector3.ProjectToRef(this.probe, Matrix.IdentityReadOnly, transform, viewport, this.screen);
      if (this.screen.z < 0 || this.screen.z > 1) continue;
      const centerX = this.screen.x;
      const centerY = this.screen.y;
      this.probe.x += crab.scale * 0.5;
      Vector3.ProjectToRef(this.probe, Matrix.IdentityReadOnly, transform, viewport, this.screen);
      const reach = Math.max(HOVER_MIN_PIXELS / scaling, Math.hypot(this.screen.x - centerX, this.screen.y - centerY));
      const gap = Math.hypot(pointerX - centerX, pointerY - centerY);
      if (gap < reach && gap < bestGap) {
        best = crab;
        bestGap = gap;
      }
    }
    return this.setHovered(best);
  }

  clearHover() {
    this.setHovered(null);
  }

  setHovered(crab) {
    if (crab === this.hovered) return crab;
    const previous = this.hovered;
    this.hovered = crab;
    if (this.outline && !this.outline.isDisposed()) this.outline.setEnabled(Boolean(crab));
    for (const item of [previous, crab]) {
      const index = item ? this.crabs.indexOf(item) : -1;
      if (index >= 0) this.place(item, index);
    }
    if (this.mesh) this.flush();
    return crab;
  }

  flush() {
    this.mesh.thinInstanceBufferUpdated('matrix');
    this.mesh.thinInstanceBufferUpdated('crabPose');
    if (!this.hovered || !this.outline || this.outline.isDisposed()) return;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * OUTLINE_PULSE_SPEED);
    this.outline.outlineWidth = OUTLINE_WIDTH + OUTLINE_PULSE * pulse;
    this.outline.thinInstanceBufferUpdated('matrix');
    this.outline.thinInstanceBufferUpdated('crabPose');
  }

  update(dt) {
    if (!this.mesh || !this.crabs.length) return;
    const step = Math.min(dt, MAX_STEP);
    this.time += step;
    const player = this.playerAt ? this.playerAt() : null;
    let changed = false;
    for (let index = 0; index < this.crabs.length; index += 1) {
      const crab = this.crabs[index];
      const gap = player ? Math.hypot(player.x - crab.x, player.z - crab.z) : Infinity;
      if (player && gap > ACTIVE_RANGE) continue;
      this.think(crab, step, player, gap);
      this.place(crab, index);
      changed = true;
    }
    if (changed) this.flush();
  }

  think(crab, dt, player, gap) {
    let walkTarget = 0;
    switch (crab.state) {
      case 'idle':
        crab.timer -= dt;
        if (gap < SCARE_RANGE) this.startFlee(crab, player);
        else if (crab.timer <= 0) this.startWalk(crab);
        break;
      case 'walk': {
        if (gap < SCARE_RANGE) {
          this.startFlee(crab, player);
          break;
        }
        const result = this.moveToward(crab, WALK_SPEED, dt);
        walkTarget = 1;
        if (result !== 'moving') this.startIdle(crab);
        break;
      }
      case 'flee': {
        crab.timer -= dt;
        const result = this.moveToward(crab, FLEE_SPEED, dt);
        walkTarget = 1;
        if (result !== 'moving' || crab.timer <= 0) this.hideOrThreaten(crab);
        break;
      }
      case 'threat':
        crab.timer -= dt;
        if (player) this.turnToward(crab, Math.atan2(player.x - crab.x, player.z - crab.z), dt);
        if (gap > CLEAR_RANGE && crab.timer <= 0) this.startIdle(crab);
        break;
      case 'bury':
        crab.sink = Math.min(1, crab.sink + dt / BURY_TIME);
        crab.phase += dt * DIG_STRIDE;
        walkTarget = 1;
        if (crab.sink >= 1) {
          crab.state = 'buried';
          crab.timer = HIDE_MIN + this.random(crab) * HIDE_SPREAD;
        }
        break;
      case 'buried':
        crab.timer -= dt;
        if (crab.timer <= 0 && gap > CLEAR_RANGE) {
          crab.state = 'emerge';
          this.burst(crab);
        }
        break;
      case 'emerge':
        crab.sink = Math.max(0, crab.sink - dt / EMERGE_TIME);
        crab.phase += dt * DIG_STRIDE;
        walkTarget = 1;
        if (crab.sink <= 0) this.startIdle(crab);
        break;
      default:
        this.startIdle(crab);
    }
    crab.walk += (walkTarget - crab.walk) * Math.min(1, dt * 8);
    crab.claw += (crab.clawTarget - crab.claw) * Math.min(1, dt * 5);
    crab.phase %= Math.PI * 2;
  }

  startIdle(crab) {
    crab.state = 'idle';
    crab.timer = IDLE_MIN + this.random(crab) * IDLE_SPREAD;
    crab.clawTarget = this.random(crab) < WAVE_SHARE ? 0.8 : 0;
  }

  startWalk(crab) {
    const away = Math.hypot(crab.x - crab.homeX, crab.z - crab.homeZ);
    for (let attempt = 0; attempt < 6; attempt += 1) {
      let angle;
      if (away > HOME_RADIUS * 0.6 && attempt < 3) {
        angle = Math.atan2(crab.homeZ - crab.z, crab.homeX - crab.x) + (this.random(crab) - 0.5) * 0.8;
      } else {
        const side = this.random(crab) < 0.5 ? 0 : Math.PI;
        angle = -crab.yaw + side + (this.random(crab) - 0.5) * 1.2;
      }
      const reach = WALK_MIN + this.random(crab) * WALK_SPREAD;
      const x = crab.x + Math.cos(angle) * reach;
      const z = crab.z + Math.sin(angle) * reach;
      if (Math.hypot(x - crab.homeX, z - crab.homeZ) > HOME_RADIUS) continue;
      if (!this.pathOk(crab, x, z)) continue;
      crab.state = 'walk';
      crab.targetX = x;
      crab.targetZ = z;
      crab.clawTarget = 0.15;
      return;
    }
    this.startIdle(crab);
  }

  startFlee(crab, player) {
    const awayX = crab.x - player.x;
    const awayZ = crab.z - player.z;
    const base = Math.atan2(awayZ, awayX);
    for (const offset of FLEE_ANGLES) {
      const x = crab.x + Math.cos(base + offset) * FLEE_DISTANCE;
      const z = crab.z + Math.sin(base + offset) * FLEE_DISTANCE;
      if (!this.pathOk(crab, x, z)) continue;
      crab.state = 'flee';
      crab.timer = FLEE_TIME;
      crab.targetX = x;
      crab.targetZ = z;
      crab.clawTarget = 0.3;
      return;
    }
    this.hideOrThreaten(crab);
  }

  hideOrThreaten(crab) {
    if (this.isSandAt && this.isSandAt(worldToCell(crab.x), worldToCell(crab.z))) {
      crab.state = 'bury';
      crab.clawTarget = 0;
      this.burst(crab);
      return;
    }
    crab.state = 'threat';
    crab.timer = IDLE_MIN + this.random(crab) * IDLE_SPREAD;
    crab.clawTarget = 1;
  }

  burst(crab) {
    if (this.onBurst) this.onBurst(crab.x, crab.ground, crab.z, BURST_SCALE, BURST_SECONDS);
  }

  pathOk(crab, x, z) {
    let previous = crab.ground;
    for (let step = 1; step <= PATH_SAMPLES; step += 1) {
      const t = step / PATH_SAMPLES;
      const ground = this.groundAt(crab.x + (x - crab.x) * t, crab.z + (z - crab.z) * t);
      if (!this.isDry(ground) || Math.abs(ground - previous) > MAX_CLIMB) return false;
      previous = ground;
    }
    return true;
  }

  turnToward(crab, yaw, dt) {
    const turn = wrapAngle(yaw - crab.yaw);
    const applied = Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, turn));
    crab.yaw = wrapAngle(crab.yaw + applied);
    crab.phase += Math.abs(applied) * TURN_STRIDE;
    return turn - applied;
  }

  moveToward(crab, speed, dt) {
    const dx = crab.targetX - crab.x;
    const dz = crab.targetZ - crab.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.05) return 'arrived';
    const sideways = Math.atan2(-dz, dx);
    const flipped = wrapAngle(sideways + Math.PI);
    const desired = Math.abs(wrapAngle(sideways - crab.yaw)) <= Math.abs(wrapAngle(flipped - crab.yaw)) ? sideways : flipped;
    const left = this.turnToward(crab, desired, dt);
    if (Math.abs(left) > TURN_BEFORE_MOVE) return 'moving';
    const length = Math.min(distance, speed * dt);
    const x = crab.x + (dx / distance) * length;
    const z = crab.z + (dz / distance) * length;
    const ground = this.groundAt(x, z);
    if (!this.isDry(ground) || Math.abs(ground - crab.ground) > MAX_CLIMB) return 'blocked';
    const along = (dx * Math.cos(crab.yaw) - dz * Math.sin(crab.yaw)) >= 0 ? 1 : -1;
    crab.phase += along * (length / crab.scale) * STRIDE_PER_WIDTH;
    crab.x = x;
    crab.z = z;
    crab.ground = ground;
    this.measureSlope(crab);
    return 'moving';
  }

  measureSlope(crab) {
    const reach = TILT_REACH * crab.scale;
    const east = this.groundAt(crab.x + reach, crab.z);
    const west = this.groundAt(crab.x - reach, crab.z);
    const north = this.groundAt(crab.x, crab.z + reach);
    const south = this.groundAt(crab.x, crab.z - reach);
    const usable = [east, west, north, south].every(Number.isFinite);
    crab.normalX = usable ? -(east - west) / (reach * 2) : 0;
    crab.normalZ = usable ? -(north - south) / (reach * 2) : 0;
  }

  place(crab, index) {
    const hidden = crab.sink >= 1;
    const depth = crab.sink * (MODEL_HEIGHT * crab.scale + 0.02);
    const bob = crab.walk * 0.006 * (0.5 + 0.5 * Math.sin(crab.phase * 2));
    this.position.set(crab.x, crab.ground - depth + bob, crab.z);
    const digging = crab.state === 'bury' || crab.state === 'emerge';
    const wiggle = digging ? Math.sin(this.time * 30 + crab.seed) * 0.08 : 0;
    Quaternion.RotationYawPitchRollToRef(crab.yaw + wiggle, 0, 0, this.turn);
    this.normal.set(crab.normalX, 1, crab.normalZ).normalize();
    Quaternion.FromUnitVectorsToRef(UP, this.normal, this.tilt);
    this.tilt.multiplyToRef(this.turn, this.rotation);
    const scale = hidden ? 0 : crab.scale;
    this.scaling.set(scale, scale, scale);
    Matrix.ComposeToRef(this.scaling, this.rotation, this.position, this.matrix);
    const pose = index * POSE_STRIDE;
    this.poses[pose] = crab.phase;
    this.poses[pose + 1] = crab.walk;
    this.poses[pose + 2] = crab.claw;
    this.poses[pose + 3] = crab.seed;
    if (crab !== this.hovered) {
      this.matrix.copyToArray(this.matrices, index * 16);
      return;
    }
    this.matrix.copyToArray(this.outlineMatrix, 0);
    this.outlinePose.set(this.poses.subarray(pose, pose + POSE_STRIDE));
    Matrix.ScalingToRef(0, 0, 0, this.matrix);
    this.matrix.copyToArray(this.matrices, index * 16);
  }

  show() {
    if (!this.mesh || this.mesh.isDisposed() || !this.crabs.length) return;
    this.mesh.setEnabled(true);
    this.flush();
  }

  clear() {
    this.generation += 1;
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.setEnabled(false);
    if (this.outline && !this.outline.isDisposed()) this.outline.setEnabled(false);
    this.hovered = null;
    this.mesh = null;
    this.matrices = null;
    this.poses = null;
    this.crabs = [];
    this.level = null;
    this.groundAt = null;
    this.isSandAt = null;
    this.playerAt = null;
  }

  dispose() {
    this.clear();
    if (this.outline && !this.outline.isDisposed()) this.outline.dispose();
    this.outline = null;
  }
}
