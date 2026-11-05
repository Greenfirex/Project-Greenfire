// Písečný běs — krabovitý tvor se šesti nohami, dvěma chapadly a kusadly.
// Model nemá pojmenované kosti ani animace, tak se pohyb odvozuje z tvaru kostry.
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS, FORWARD_AXIS,
  findBone, axisEntry, partEntries, swingEntry, turnEntry, approach,
  legEntry as legEntryShared,
} from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}sand_devil/sand_devil.glb`;
const SWING = 0.3;
const LIFT = 0.42;
const WALK_SPEED = 10;
const COMBAT_CADENCE = 1.2;
const TURN_STEP = 0.7;
const BOB = 0.025;
const IDLE_SWAY = 0.035;
const IDLE_SWAY_SPEED = 1.3;
const IDLE_BOB = 0.012;
const IDLE_SPEED = 1.5;
const KNEE_BEND = 0.9;
const KNEE_SWING = 0.22;
const KNEE_STRIKE = 0.8;
const TAIL_WALK = 0.14;
const TAIL_IDLE = 0.05;
const TAIL_SPEED = 2.1;
const FRONT_ALERT = 0.35;
const FRONT_REAR = 1;
const FRONT_LIFT = 0.4;
const FRONT_HOLD = 0.7;
const FRONT_SWING = -0.35;
const FRONT_STRIKE = 0.7;
const EMERGE_SCRATCH = 0.9;
const EMERGE_SCRATCH_SPEED = 26;
const EMERGE_LIFT = 0.35;
const BODY_ALERT = -0.08;
const BODY_REAR = -0.26;
const BODY_DEAD = 0.3;
const BODY_STRIKE = 0.7;
const JAW_IDLE = 0.04;
const JAW_ALERT = 0.18;
const JAW_DEAD = 0;
const JAW_WIDE = -0.42;
const JAW_SNAP = 0.55;
const JAW_SHARE = 0.55;
const TENTACLE_ALERT = 0.16;
const TENTACLE_REAR = 0.45;
const TENTACLE_STRIKE = -0.35;
const SPEED_BODY = 9;
const SPEED_JAW = 12;
const SPEED_LIFT = 12;
const SPEED_FRONT = 16;
const SPEED_TAIL = 4;
const STRIKE_SECONDS = 0.45;
const HIT_SECONDS = 0.3;
const HIT_REAR = -0.34;
const HIT_JAW = -0.22;
const REAR_BOB = 0.04;
const STRIKE_DIP = 0.07;
const LEG_SPECS = [
  { id: 'L1', root: 'Bone_039', joint: 'Bone_038', tip: 'Bone_035', phase: 0, lift: 1, swing: 1, footZ: 0.634154, front: true },
  { id: 'L2', root: 'Bone_022', joint: 'Bone_021', tip: 'Bone_018', phase: Math.PI, lift: 1, swing: 1, footZ: 0.085792 },
  { id: 'L3', root: 'Bone_013', joint: 'Bone_012', tip: 'Bone_009', phase: 0, lift: 1, swing: 1, footZ: 0.155796 },
  { id: 'R1', root: 'Bone_034', joint: 'Bone_033', tip: 'Bone_030', phase: Math.PI, lift: 1, swing: 1, footZ: 0.260801, front: true },
  { id: 'R2', root: 'Bone_027', joint: 'Bone_026', tip: 'Bone_023', phase: 0, lift: 1, swing: 1, footZ: 0.09746 },
  { id: 'R3', root: 'Bone_008', joint: 'Bone_007', tip: 'Bone_004', phase: Math.PI, lift: 1, swing: 1, footZ: 0.155796 },
];
const REST_FOOT_MIN = 0.085792;
const BODY_SPECS = [
  { bone: 'Bone_003', share: 0.3 },
  { bone: 'Bone_002', share: 0.3 },
  { bone: 'Bone_029', share: 0.25 },
  { bone: 'Bone_028', share: 0.15 },
];
const TENTACLE_SPECS = [
  { bone: 'Bone_049' },
  { bone: 'Bone_053' },
];
const JAW_SPECS = [
  { bone: 'Bone_042' },
  { bone: 'Bone_045' },
];
const TAIL_BONE = 'Bone_017';

function legEntry(mesh, bones, spec) {
  return legEntryShared(mesh, bones, spec, { swing: SWING, restFootMin: REST_FOOT_MIN });
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const legs = LEG_SPECS.map((spec) => legEntry(mesh, bones, spec)).filter(Boolean);
  if (!legs.length) return null;
  const lengths = legs.map((leg) => leg.length).filter((length) => length > 0);
  const averageLength = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 1;
  for (const leg of legs) {
    const factor = leg.length > 0 ? averageLength / leg.length : 1;
    leg.liftScale = (leg.liftScale || 1) * Math.max(0.55, Math.min(1.65, factor));
  }
  const body = partEntries(bones, BODY_SPECS, { pitch: SIDE_AXIS });
  const tentacles = partEntries(bones, TENTACLE_SPECS, { open: FORWARD_AXIS, pitch: SIDE_AXIS });
  const jaws = partEntries(bones, JAW_SPECS, { open: FORWARD_AXIS });
  const tailBone = findBone(bones, TAIL_BONE);
  const tail = tailBone ? axisEntry(tailBone, { sway: UP_AXIS }) : null;
  console.info(`[sand-devil] nohy: ${legs.map((leg) => `${leg.id}(${leg.length.toFixed(2)})`).join(', ')}; telo: ${body.length}, chapadla: ${tentacles.length}, kusadla: ${jaws.length}${tail ? ', ocas' : ''}`);
  return {
    legs,
    body,
    tentacles,
    jaws,
    tail,
    time: 0,
    walkPhase: 0,
    pitch: 0,
    jaw: JAW_IDLE,
    raise: 0,
    front: 0,
    strike: 0,
    hitTime: 0,
    tailPhase: 0,
    tailAmount: TAIL_IDLE,
    lastMode: null,
  };
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const turning = Boolean(info && info.turning);
  const engaged = Boolean(info && info.engaged);
  const buried = Boolean(info && info.buried);
  const emerge = Number.isFinite(info && info.emergeProgress) ? info.emergeProgress : 1;
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  rig.time += seconds;
  const cadence = engaged ? WALK_SPEED * COMBAT_CADENCE : WALK_SPEED;
  rig.walkPhase += cadence * seconds;
  if (mode !== rig.lastMode) {
    if (rig.lastMode === 'windup') rig.strike = 1;
    rig.lastMode = mode;
  }
  rig.strike = Math.max(0, rig.strike - seconds / STRIKE_SECONDS);
  if (info && info.hit) rig.hitTime = HIT_SECONDS;
  rig.hitTime = Math.max(0, rig.hitTime - seconds);

  const dead = mode === 'dead';
  const emerging = mode === 'emerging';
  const burying = mode === 'burying';
  const dig = emerging
    ? Math.sin(Math.PI * emerge)
    : burying ? Math.sin(Math.PI * (1 - emerge)) : 0;
  let pitchTarget = 0;
  let jawTarget = JAW_IDLE;
  let raiseTarget = 0;
  let frontTarget = 0;
  if (dead) {
    pitchTarget = BODY_DEAD;
    jawTarget = JAW_DEAD;
  } else if (mode === 'windup') {
    pitchTarget = BODY_REAR;
    jawTarget = JAW_WIDE;
    raiseTarget = TENTACLE_REAR;
    frontTarget = FRONT_REAR;
  } else if (mode === 'alert' || emerging) {
    pitchTarget = BODY_ALERT;
    jawTarget = JAW_ALERT;
    raiseTarget = TENTACLE_ALERT;
    frontTarget = FRONT_ALERT;
  }
  rig.pitch = approach(rig.pitch, pitchTarget, seconds, SPEED_BODY);
  rig.jaw = approach(rig.jaw, jawTarget, seconds, SPEED_JAW);
  rig.raise = approach(rig.raise, raiseTarget, seconds, SPEED_LIFT);
  rig.front = approach(rig.front, frontTarget, seconds, SPEED_FRONT);
  rig.tailAmount = approach(rig.tailAmount, moving ? TAIL_WALK : TAIL_IDLE, seconds, SPEED_TAIL);
  rig.tailPhase += TAIL_SPEED * seconds;

  const strike = rig.strike;
  const hit = rig.hitTime / HIT_SECONDS;
  const pitch = rig.pitch + BODY_STRIKE * strike + HIT_REAR * hit;
  const jaw = rig.jaw + JAW_SNAP * strike + HIT_JAW * hit;
  const raise = rig.raise + TENTACLE_STRIKE * strike;
  for (const entry of rig.body) turnEntry(entry, { pitch: pitch * entry.share });
  for (const entry of rig.tentacles) turnEntry(entry, { open: jaw, pitch: raise });
  for (const entry of rig.jaws) turnEntry(entry, { open: jaw * JAW_SHARE });
  if (rig.tail) turnEntry(rig.tail, { sway: Math.sin(rig.tailPhase) * rig.tailAmount });

  const stepping = moving || turning;
  for (const leg of rig.legs) {
    const restLift = Number.isFinite(leg.restLift) ? leg.restLift : 0;
    const walkPhase = rig.walkPhase + leg.phase;
    const stepScale = moving ? 1 : TURN_STEP;
    let angle = 0;
    let lift = restLift;
    if (dead) {
      angle = 0.18;
    } else if (emerging || burying) {
      angle = Math.sin(rig.time * EMERGE_SCRATCH_SPEED + leg.phase) * EMERGE_SCRATCH;
      lift = restLift + EMERGE_LIFT * dig;
    } else if (!buried) {
      angle = stepping
        ? Math.sin(walkPhase) * leg.amplitude * stepScale * emerge
        : Math.sin(rig.time * IDLE_SWAY_SPEED + leg.phase) * IDLE_SWAY;
      if (stepping) {
        lift += Math.max(0, Math.cos(walkPhase)) * LIFT * (leg.liftScale || 1) * stepScale * emerge;
      }
      if (leg.front) {
        angle += (FRONT_SWING * rig.front + FRONT_STRIKE * strike) * leg.side;
        lift += FRONT_LIFT * Math.max(rig.front, FRONT_HOLD * strike);
      }
    }
    swingEntry(leg, angle, lift);
    if (leg.joint) {
      const kneeLift = -(lift - restLift) * KNEE_BEND + (leg.front ? KNEE_STRIKE * strike : 0);
      swingEntry(leg.joint, angle * KNEE_SWING, kneeLift);
    }
  }

  if (dead || buried) return { bob: 0 };
  const bob = stepping
    ? Math.sin(rig.walkPhase * 2) * BOB
    : Math.sin(rig.time * IDLE_SPEED) * IDLE_BOB;
  return { bob: bob + REAR_BOB * rig.front - STRIKE_DIP * strike };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  return `${rig.legs.length} nohou, ${rig.body.length} telo, ${rig.tentacles.length} chapadla, ${rig.jaws.length} kusadla`;
}

export const sandDevilRig = { build, pose, summary };

export const SAND_DEVIL = {
  label: 'Písečný běs',
  model: MODEL,
  rig: sandDevilRig,
  sounds: {
    dig: 'devilDig',
    charge: 'devilGrowl',
    bite: 'devilBite',
    hit: 'devilHit',
    death: 'devilDeath',
  },
  length: 1.15,
  scale: 0.7,
  yawOffset: Math.PI,
  walkSpeed: 1.1,
  chaseBoost: 1.2,
  turnRate: 5.5,
  aggroRange: 4.5,
  chargeRange: 2.6,
  noWarning: true,
  biteRange: 1.1,
  biteWindup: 0.45,
  biteCooldown: 1.6,
  biteRecover: 0.65,
  confusedSeconds: 2,
  roamRadius: 5,
  maxStepHeight: 0.45,
  attackHeight: 0.8,
  footprint: {
    kind: 'sanddevil',
    scale: 1,
    stepDistance: 0.113,
    feet: [
      { side: 0.285, forward: 0.383 },
      { side: -0.377, forward: 0.002 },
      { side: 0.273, forward: -0.206 },
      { side: -0.238, forward: 0.348 },
      { side: 0.377, forward: 0.002 },
      { side: -0.288, forward: -0.156 },
    ],
    order: [0, 1, 2, 3, 4, 5],
  },
  respawnDays: 5,
  idleSeconds: [3, 7],
  defaultTier: 'adult',
  buried: true,
  emergeRange: 3,
  emergeSeconds: 0.5,
  emergeJump: 0.42,
  buriedDepth: 0.3,
  groundOffset: REST_FOOT_MIN,
  deathRoll: Math.PI,
  deathSeconds: 0.75,
  loot: { meat: 1 },
  tiers: {
    young: {
      label: 'Mladý',
      scale: 0.72,
      tint: [1, 0.96, 0.86],
      health: 25,
      bite: 4,
      attack: 10,
      defense: 7,
      speed: 1.15,
      aggroRange: 4,
    },
    adult: {
      label: 'Dospělý',
      scale: 1,
      tint: [1, 1, 1],
      health: 45,
      bite: 7,
      attack: 15,
      defense: 12,
      speed: 1,
      aggroRange: 4.5,
    },
    elder: {
      label: 'Starý',
      scale: 1.2,
      tint: [0.9, 0.86, 0.76],
      health: 65,
      bite: 10,
      attack: 20,
      defense: 16,
      speed: 0.8,
      aggroRange: 5,
    },
  },
};

