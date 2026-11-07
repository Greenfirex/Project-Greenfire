// Hejna ryb — roj se pomalu toulá po svém okolí a rybky se u toho drží pohromadě.
// Systém jen čte mapu a hýbe hotovými tvary; do terénu ani do hry nezasahuje.
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { fishTemplate } from '../../utils/fishFactory.js';
import { FISH_KEYS, FISH_SWIM_DEPTH, getFishType } from '../../data/catalogs/fish.js';
import { CELL_SIZE } from '../../utils/gridMath.js';
import { hash01 } from '../../utils/noise.js';

const BOB = 0.07;
const SURFACE_MARGIN = 0.18;
const FLEE_RANGE = 6;
const FLEE_TIME = 2.4;
const TURN_RATE = 2.2;
const DRIFT_SPEED = 0.9;
const FLEE_SPEED = 2.2;
const ORBIT_TANGENT = 1.7;
const MAX_STEP = 0.1;
const ROAM_MIN = 6;
const ROAM_MAX = 18;
const ROAM_FIRST_MIN = 2;
const ROAM_FIRST_SPREAD = 12;
const ROAM_NEXT_MIN = 6;
const ROAM_NEXT_SPREAD = 14;
const START_OUT_SHARE = 0.3;
const PATH_SAMPLES = 4;
const SCHOOL_REACH_MIN = 0.3;
const SCHOOL_REACH_SPREAD = 0.6;
const SCHOOL_TIMER_MIN = 3;
const SCHOOL_TIMER_MAX = 14;

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
    this.time = 0;
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
        const angle = (index / count) * Math.PI * 2 + hash01(centerX + index, centerZ - index) * 0.8;
        const reach = radius * (0.25 + 0.6 * hash01(centerX - index * 3, centerZ + index * 5));
        const speed = cruise * (0.75 + 0.5 * hash01(index * 7 + 1, index * 3 - 5));
        const scale = 0.75 + 0.4 * hash01(index * 17, index * 9);
        const startOut = hash01(index * 13 + 7, centerX - index * 2) < START_OUT_SHARE;
        const fishItem = {
          schoolIndex,
          x: centerX + Math.cos(angle) * reach,
          z: centerZ + Math.sin(angle) * reach,
          vx: -Math.sin(angle) * speed,
          vz: Math.cos(angle) * speed,
          yaw: Math.atan2(-Math.cos(angle), -Math.sin(angle)),
          speed,
          depth: type.depth * (0.7 + 0.6 * hash01(index * 11, index * 5 + 3)),
          phase: index * 1.7 + hash01(index, centerX) * 2,
          scale,
          margin: SURFACE_MARGIN + type.length * 0.19 * scale,
          floor: Math.max(0.05, type.length * 0.3),
          state: 'school',
          roamTimer: ROAM_FIRST_MIN + hash01(index * 5 + 3, centerX + index) * ROAM_FIRST_SPREAD,
          targetX: centerX,
          targetZ: centerZ,
        };
        group.fish.push(fishItem);
        group.schoolFish[schoolIndex].push(fishItem);
        if (startOut) this.startRoam(fishItem, group.schools[schoolIndex]);
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
    this.update(0);
    return this.schools.length ? this.schools[0].mesh : null;
  }

  depthAt(x, z) {
    if (!this.groundAt) return Infinity;
    const ground = this.groundAt(x, z);
    return Number.isFinite(ground) ? this.level - ground : Infinity;
  }

  pathSwims(fromX, fromZ, toX, toZ) {
    for (let step = 1; step <= PATH_SAMPLES; step += 1) {
      const t = step / PATH_SAMPLES;
      if (this.depthAt(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t) < FISH_SWIM_DEPTH) return false;
    }
    return true;
  }

  pickTarget(school) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const wander = school.wander + 1 + attempt;
      const angle = hash01(school.homeX + wander * 3.7, school.homeZ - wander * 1.9) * Math.PI * 2;
      const reach = school.radius * (SCHOOL_REACH_MIN + SCHOOL_REACH_SPREAD * hash01(school.homeZ + wander, school.homeX - wander));
      const targetX = school.homeX + Math.cos(angle) * reach;
      const targetZ = school.homeZ + Math.sin(angle) * reach;
      if (!this.pathSwims(school.homeX, school.homeZ, targetX, targetZ)) continue;
      school.wander = wander;
      school.targetX = targetX;
      school.targetZ = targetZ;
      const distance = Math.hypot(targetX - school.centerX, targetZ - school.centerZ);
      school.timer = Math.max(SCHOOL_TIMER_MIN, Math.min(SCHOOL_TIMER_MAX, 1.5 + distance / DRIFT_SPEED));
      return;
    }
    school.wander += 1;
    school.targetX = school.homeX;
    school.targetZ = school.homeZ;
    school.timer = SCHOOL_TIMER_MIN;
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
        const fleeX = school.homeX + (awayX / awayLength) * school.radius;
        const fleeZ = school.homeZ + (awayZ / awayLength) * school.radius;
        const dryFlee = !this.pathSwims(school.centerX, school.centerZ, fleeX, fleeZ);
        school.targetX = dryFlee ? school.homeX : fleeX;
        school.targetZ = dryFlee ? school.homeZ : fleeZ;
        school.timer = FLEE_TIME;
      }
    }
    const stepX = school.targetX - school.centerX;
    const stepZ = school.targetZ - school.centerZ;
    const length = Math.hypot(stepX, stepZ) || 1;
    const speed = school.alarm > 0 ? FLEE_SPEED : DRIFT_SPEED;
    school.centerX += (stepX / length) * speed * dt;
    school.centerZ += (stepZ / length) * speed * dt;
    if (this.depthAt(school.centerX, school.centerZ) < FISH_SWIM_DEPTH) {
      school.centerX += (school.homeX - school.centerX) * 0.25;
      school.centerZ += (school.homeZ - school.centerZ) * 0.25;
      school.targetX = school.homeX;
      school.targetZ = school.homeZ;
      school.timer = SCHOOL_TIMER_MIN;
    }
    if (school.alarm > 0) school.alarm -= dt;
  }

  startRoam(item, school) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const seed = item.phase + attempt * 7.3 + Math.floor(this.time * 0.37);
      const angle = hash01(seed, seed * 1.7) * Math.PI * 2;
      const reach = ROAM_MIN + hash01(seed * 2.1, seed * 0.7) * (ROAM_MAX - ROAM_MIN);
      const x = school.centerX + Math.cos(angle) * reach;
      const z = school.centerZ + Math.sin(angle) * reach;
      if (!this.pathSwims(school.centerX, school.centerZ, x, z)) continue;
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
    if (item.state === 'roam' && Number.isFinite(ground) && this.level - ground < FISH_SWIM_DEPTH) {
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
      item.roamTimer = ROAM_NEXT_MIN + hash01(item.phase * 3.1, item.phase * 1.7) * ROAM_NEXT_SPREAD;
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
      if (y < floor) y = floor;
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
