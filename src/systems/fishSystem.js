// Hejna ryb — roj se pomalu toulá po svém okolí a rybky se u toho drží pohromadě.
// Systém jen čte mapu a hýbe hotovými tvary; do terénu ani do hry nezasahuje.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fishTemplate } from '../utils/fishFactory.js';
import { FISH_KEYS, getFishType } from '../data/catalogs/fish.js';
import { CELL_SIZE } from '../utils/gridMath.js';

const BOB = 0.07;
const SURFACE_MARGIN = 0.18;
const FLEE_RANGE = 6;
const FLEE_TIME = 2.4;
const TURN_RATE = 2.2;
const DRIFT_SPEED = 0.5;
const FLEE_SPEED = 2.2;
const ORBIT_TANGENT = 1.7;
const MAX_STEP = 0.1;
const ROAM_MIN = 6;
const ROAM_MAX = 18;

function hash(x, z) {
  const value = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export default class FishSystem {

  constructor(scene) {
    this.s = scene;
    this.schools = [];
    this.level = null;
    this.water = null;
    this.groundAt = null;
    this.playerAt = null;
    this.time = 0;
    this.position = new Vector3();
    this.scaling = new Vector3(1, 1, 1);
    this.rotation = Quaternion.Identity();
    this.matrix = Matrix.Identity();
  }

  create(layout, level, water = null, groundAt = null, playerAt = null) {
    this.clear();
    const schools = (layout && layout.fish) || [];
    if (!schools.length || !Number.isFinite(level)) return null;
    this.level = level;
    this.water = water;
    this.groundAt = groundAt;
    this.playerAt = playerAt;
    const byKind = new Map();
    for (const school of schools) {
      if (!school || !Number.isFinite(school.cx) || !Number.isFinite(school.cz)) continue;
      const kind = FISH_KEYS.includes(school.kind) ? school.kind : 'fish_blue';
      const type = getFishType(kind);
      const count = Math.max(1, Math.min(32, school.count || type.count));
      const radius = Number.isFinite(school.radius) ? school.radius : type.radius;
      const centerX = school.cx * CELL_SIZE;
      const centerZ = school.cz * CELL_SIZE;
      const cruise = 1.6 * type.speed;
      const separation = Math.max(0.16, type.length * 1.3);
      const group = byKind.get(kind) || { fish: [], schools: [], schoolFish: [], separation };
      const schoolIndex = group.schools.length;
      group.schoolFish[schoolIndex] = [];
      group.schools.push({
        centerX,
        centerZ,
        homeX: centerX,
        homeZ: centerZ,
        targetX: centerX,
        targetZ: centerZ,
        radius,
        timer: 0,
        wander: 0,
        alarm: 0,
        mode: school.mode === 'orbit' ? 'orbit' : 'wander',
      });
      for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * Math.PI * 2 + hash(centerX + index, centerZ - index) * 0.8;
        const reach = radius * (0.25 + 0.6 * hash(centerX - index * 3, centerZ + index * 5));
        const speed = cruise * (0.75 + 0.5 * hash(index * 7 + 1, index * 3 - 5));
        const scale = 0.75 + 0.4 * hash(index * 17, index * 9);
        const fishItem = {
          schoolIndex,
          x: centerX + Math.cos(angle) * reach,
          z: centerZ + Math.sin(angle) * reach,
          vx: -Math.sin(angle) * speed,
          vz: Math.cos(angle) * speed,
          yaw: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
          speed,
          depth: type.depth * (0.7 + 0.6 * hash(index * 11, index * 5 + 3)),
          phase: index * 1.7 + hash(index, centerX) * 2,
          scale,
          margin: SURFACE_MARGIN + type.length * 0.19 * scale,
          floor: Math.max(0.05, type.length * 0.3),
          state: 'school',
          roamTimer: 25 + hash(index * 5 + 3, centerX + index) * 45,
          targetX: centerX,
          targetZ: centerZ,
        };
        group.fish.push(fishItem);
        group.schoolFish[schoolIndex].push(fishItem);
      }
      byKind.set(kind, group);
    }
    for (const [kind, group] of byKind) {
      const mesh = fishTemplate(this.s, kind);
      if (!mesh || !group.fish.length) continue;
      const matrices = new Float32Array(group.fish.length * 16);
      mesh.thinInstanceSetBuffer('matrix', matrices, 16, false);
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.isPickable = false;
      mesh.setEnabled(true);
      this.schools.push({
        mesh,
        matrices,
        fish: group.fish,
        schools: group.schools,
        schoolFish: group.schoolFish,
        separation: group.separation,
      });
    }
    this.time = 0;
    this.update(0);
    return this.schools.length ? this.schools[0].mesh : null;
  }

  pickTarget(school) {
    school.wander += 1;
    const angle = hash(school.homeX + school.wander * 3.7, school.homeZ - school.wander * 1.9) * Math.PI * 2;
    const reach = school.radius * (0.1 + 0.55 * hash(school.homeZ + school.wander, school.homeX - school.wander));
    school.targetX = school.homeX + Math.cos(angle) * reach;
    school.targetZ = school.homeZ + Math.sin(angle) * reach;
    school.timer = 3.5 + hash(school.wander * 1.3, school.homeX) * 4.5;
  }

  update(dt) {
    if (!this.schools.length) return;
    const step = Math.min(dt, MAX_STEP);
    this.time += step;
    const time = this.time;
    const player = this.playerAt ? this.playerAt() : null;
    for (const group of this.schools) {
      if (!group.mesh.isEnabled()) group.mesh.setEnabled(true);
      for (const school of group.schools) this.moveSchool(school, step, player);
      const fish = group.fish;
      for (let index = 0; index < fish.length; index += 1) {
        const item = fish[index];
        const ground = this.groundAt ? this.groundAt(item.x, item.z) : null;
        this.steerFish(item, group.schools[item.schoolIndex], group, step, time, player, ground);
        this.placeFish(group, item, index, time, ground);
      }
      group.mesh.thinInstanceBufferUpdated('matrix');
    }
  }

  moveSchool(school, dt, player) {
    if (school.mode === 'orbit') {
      school.targetX = school.homeX;
      school.targetZ = school.homeZ;
    } else {
      school.timer -= dt;
      const toTargetX = school.targetX - school.centerX;
      const toTargetZ = school.targetZ - school.centerZ;
      if (school.timer <= 0 || Math.hypot(toTargetX, toTargetZ) < 0.5) this.pickTarget(school);
    }
    if (player) {
      const gap = Math.hypot(player.x - school.centerX, player.z - school.centerZ);
      if (gap < FLEE_RANGE) {
        school.alarm = FLEE_TIME;
        const awayX = school.centerX - player.x;
        const awayZ = school.centerZ - player.z;
        const awayLength = Math.hypot(awayX, awayZ) || 1;
        school.targetX = school.homeX + (awayX / awayLength) * school.radius;
        school.targetZ = school.homeZ + (awayZ / awayLength) * school.radius;
        school.timer = FLEE_TIME;
      }
    }
    const stepX = school.targetX - school.centerX;
    const stepZ = school.targetZ - school.centerZ;
    const length = Math.hypot(stepX, stepZ) || 1;
    const speed = school.alarm > 0 ? FLEE_SPEED : DRIFT_SPEED;
    school.centerX += (stepX / length) * speed * dt;
    school.centerZ += (stepZ / length) * speed * dt;
    if (school.alarm > 0) school.alarm -= dt;
  }

  startRoam(item, school) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const seed = item.phase + attempt * 7.3 + Math.floor(this.time * 0.37);
      const angle = hash(seed, seed * 1.7) * Math.PI * 2;
      const reach = ROAM_MIN + hash(seed * 2.1, seed * 0.7) * (ROAM_MAX - ROAM_MIN);
      const x = school.centerX + Math.cos(angle) * reach;
      const z = school.centerZ + Math.sin(angle) * reach;
      if (this.groundAt && this.level - this.groundAt(x, z) < 0.5) continue;
      item.targetX = x;
      item.targetZ = z;
      item.state = 'roam';
      return true;
    }
    item.roamTimer = 12;
    return false;
  }

  steerFish(item, school, group, dt, time, player, ground) {
    if (item.state === 'school') {
      item.roamTimer -= dt;
      if (item.roamTimer <= 0) this.startRoam(item, school);
    }
    if (item.state === 'roam' && Number.isFinite(ground) && this.level - ground < 0.35) {
      item.state = 'back';
    }
    const headingX = item.state === 'roam' ? item.targetX : school.centerX;
    const headingZ = item.state === 'roam' ? item.targetZ : school.centerZ;
    let dirX = headingX - item.x;
    let dirZ = headingZ - item.z;
    const distance = Math.hypot(dirX, dirZ) || 1;
    dirX /= distance;
    dirZ /= distance;
    const stray = distance / Math.max(school.radius, 0.1);
    const pull = item.state === 'roam' ? 1.1 : 1 + Math.max(0, stray - 0.8) * 3;
    let steerX = dirX * pull;
    let steerZ = dirZ * pull;

    const wobble = Math.sin(time * 0.9 + item.phase) * 0.35;
    steerX += -dirZ * wobble;
    steerZ += dirX * wobble;
    if (school.mode === 'orbit' && item.state === 'school') {
      steerX += dirZ * ORBIT_TANGENT;
      steerZ += -dirX * ORBIT_TANGENT;
    }

    const mates = group.schoolFish[item.schoolIndex] || group.fish;
    for (let index = 0; index < mates.length; index += 1) {
      const other = mates[index];
      if (other === item) continue;
      const dx = item.x - other.x;
      const dz = item.z - other.z;
      const gap2 = dx * dx + dz * dz;
      if (gap2 > group.separation * group.separation || gap2 < 1e-6) continue;
      const gap = Math.sqrt(gap2);
      const push = (1 - gap / group.separation) * 1.8;
      steerX += (dx / gap) * push;
      steerZ += (dz / gap) * push;
    }

    let flee = 0;
    if (player) {
      const dx = item.x - player.x;
      const dz = item.z - player.z;
      const gap = Math.hypot(dx, dz);
      flee = Math.max(0, 1 - gap / FLEE_RANGE);
      if (flee > 0 && gap > 1e-3) {
        steerX += (dx / gap) * flee * 3;
        steerZ += (dz / gap) * flee * 3;
      }
    }

    const steerLength = Math.hypot(steerX, steerZ) || 1;
    const cruise = item.speed * (1 + flee * 1.6);
    const desiredX = (steerX / steerLength) * cruise;
    const desiredZ = (steerZ / steerLength) * cruise;
    const speedNow = Math.hypot(item.vx, item.vz);
    const alignment = speedNow > 1e-3
      ? Math.max(0, Math.min(1, (item.vx * desiredX + item.vz * desiredZ) / (speedNow * cruise)))
      : 1;
    const blend = Math.min(1, TURN_RATE * dt);
    const targetX = desiredX * (1 - 0.3 * (1 - alignment));
    const targetZ = desiredZ * (1 - 0.3 * (1 - alignment));
    item.vx += (targetX - item.vx) * blend;
    item.vz += (targetZ - item.vz) * blend;
    item.x += item.vx * dt;
    item.z += item.vz * dt;

    if (item.state === 'roam' && distance < 1.8) item.state = 'back';
    if (item.state === 'back' && distance < school.radius * 0.7) {
      item.state = 'school';
      item.roamTimer = 25 + hash(item.phase * 3.1, item.phase * 1.7) * 45;
    }

    const targetYaw = Math.atan2(-item.vz, item.vx);
    let turn = targetYaw - item.yaw;
    while (turn > Math.PI) turn -= Math.PI * 2;
    while (turn < -Math.PI) turn += Math.PI * 2;
    item.yaw += turn * Math.min(1, TURN_RATE * dt * 1.4);
  }

  placeFish(group, item, index, time, ground) {
    const bob = Math.sin(time * 1.6 + item.phase);
    let y = this.level - item.depth + bob * BOB;
    const surface = (this.water ? this.water.surfaceHeightAt(item.x, item.z, ground) : this.level) - item.margin;
    if (y > surface) y = surface;
    if (Number.isFinite(ground)) {
      const floor = ground + item.floor;
      if (y < floor) y = Math.min(floor, surface);
    }
    this.position.set(item.x, y, item.z);
    Quaternion.RotationYawPitchRollToRef(item.yaw, bob * 0.14, 0, this.rotation);
    this.scaling.set(item.scale, item.scale, item.scale);
    Matrix.ComposeToRef(this.scaling, this.rotation, this.position, this.matrix);
    this.matrix.copyToArray(group.matrices, index * 16);
  }

  show() {
    for (const group of this.schools) {
      if (!group.mesh || group.mesh.isDisposed()) continue;
      group.mesh.setEnabled(true);
      group.mesh.thinInstanceBufferUpdated('matrix');
    }
  }

  clear() {
    for (const group of this.schools) group.mesh.setEnabled(false);
    this.schools = [];
    this.level = null;
    this.water = null;
    this.groundAt = null;
    this.playerAt = null;
  }

  dispose() {
    this.clear();
  }
}

