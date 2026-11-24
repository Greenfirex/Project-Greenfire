// Písečný běs — krabovitý tvor se šesti nohami, dvěma chapadly a kusadly.
// Model nemá pojmenované kosti ani animace, tak se pohyb odvozuje z tvaru kostry.
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS, FORWARD_AXIS,
  findBone, axisEntry, partEntries, swingEntry, turnEntry, approach, bindPosition, worldScale,
  legEntry as legEntryShared,
} from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}sand_devil/sand_devil.glb`;
const STRIDE_LENGTH = 0.45;
const MAX_STEP_SIN = 0.7;
const LIFT = 0.42;
const TURN_CADENCE = 12;
const TURN_STEP = 0.7;
const SPEED_WALK = 8;
const BOB = 0.025;
const IDLE_SWAY = 0.035;
const IDLE_SWAY_SPEED = 1.3;
const IDLE_BOB = 0.012;
const IDLE_SPEED = 1.5;
const KNEE_BEND = 0.9;
const KNEE_SWING = 0.22;
const KNEE_STRIKE = 0.8;
const BODY_ROLL = 0.08;
const BODY_TWIST = 0.06;
const TAIL_WALK = 0.14;
const TAIL_IDLE = 0.05;
const TAIL_SPEED = 2.1;
const FRONT_ALERT = 0.35;
const FRONT_REAR = 1;
const FRONT_LIFT = 0.4;
const FRONT_HOLD = 0.7;
const FRONT_SWING = -0.35;
const FRONT_STRIKE = 0.7;
const ARM_CARRY = 0.3;
const ARM_DANGLE = 0.04;
const ARM_SWING = 0.1;
const ARM_ELBOW = 0.2;
const EMERGE_SCRATCH = 0.9;
const EMERGE_SCRATCH_SPEED = 26;
const EMERGE_LIFT = 0.35;
const BODY_ALERT = -0.08;
const BODY_REAR = -0.26;
const BODY_DEAD = 0.3;
const BODY_STRIKE = 0.7;
const CHASE_LEAN = 0.1;
const JAW_IDLE = 0.04;
const JAW_ALERT = 0.18;
const JAW_CHASE = 0.12;
const JAW_DEAD = 0;
const JAW_WIDE = -0.42;
const JAW_SNAP = 0.55;
const JAW_SHARE = 0.55;
const TENTACLE_ALERT = 0.16;
const TENTACLE_CHASE = 0.25;
const TENTACLE_REAR = 0.45;
const TENTACLE_STRIKE = -0.35;
const SPEED_BODY = 9;
const SPEED_JAW = 12;
const SPEED_LIFT = 12;
const SPEED_FRONT = 16;
const SPEED_TAIL = 4;
const STRIKE_RISE = 0.06;
const STRIKE_SECONDS = 0.45;
const HIT_SECONDS = 0.3;
const HIT_REAR = -0.34;
const HIT_JAW = -0.22;
const HIT_SPLAY = 0.3;
const REAR_BOB = 0.04;
const STRIKE_DIP = 0.07;
const LIFE_MODES = ['idle', 'confused'];
const LIFE_SPEED = 4;
const LOOK_YAW = 0.35;
const JAW_CLICK = 0.22;
const CLICKS = 4;
const TENTACLE_TWITCH = 0.3;
const TWITCHES = 3;
const TAP_LIFT = 0.4;
const TAPS = 3;
const IDLE_PHASES = [
  { kind: 'rest', seconds: 1.2 },
  { kind: 'look', seconds: 2.4 },
  { kind: 'click', seconds: 0.9 },
  { kind: 'twitch', seconds: 0.8 },
  { kind: 'rest', seconds: 1 },
  { kind: 'tap', seconds: 1.2 },
  { kind: 'look', seconds: 2 },
  { kind: 'click', seconds: 0.7 },
];
const IDLE_TOTAL = IDLE_PHASES.reduce((sum, phase) => sum + phase.seconds, 0);
const NO_LIFE = { yaw: 0, jaw: 0, tentacle: 0, tap: 0 };
const DEAD_ANGLE = 0.18;
const DEATH_CURL_SECONDS = 0.8;
const DEATH_LIFT = 0.45;
const DEATH_KNEE = 0.9;
const DEATH_FADE = 3;
const DEATH_TWITCH = 0.25;
const DEATH_TWITCH_SPEED = 22;
const DEATH_JAW = 0.2;
const DEATH_JAW_SPEED = 16;
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

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function strikeCurve(time) {
  if (!(time < STRIKE_RISE + STRIKE_SECONDS)) return 0;
  if (time < STRIKE_RISE) return smoothStep(time / STRIKE_RISE);
  const u = (time - STRIKE_RISE) / STRIKE_SECONDS;
  return (1 - u) * (1 - u) * Math.cos(u * Math.PI * 1.5);
}

function lifeTargets(clock) {
  let left = clock % IDLE_TOTAL;
  for (const phase of IDLE_PHASES) {
    if (left > phase.seconds) {
      left -= phase.seconds;
      continue;
    }
    const part = left / phase.seconds;
    const envelope = Math.sin(part * Math.PI);
    if (phase.kind === 'look') return { ...NO_LIFE, yaw: Math.sin(part * Math.PI * 2) * LOOK_YAW };
    if (phase.kind === 'click') return { ...NO_LIFE, jaw: Math.sin(part * Math.PI * 2 * CLICKS) * JAW_CLICK * envelope };
    if (phase.kind === 'twitch') return { ...NO_LIFE, tentacle: Math.sin(part * Math.PI * 2 * TWITCHES) * TENTACLE_TWITCH * envelope };
    if (phase.kind === 'tap') return { ...NO_LIFE, tap: Math.abs(Math.sin(part * Math.PI * TAPS)) * TAP_LIFT };
    return NO_LIFE;
  }
  return NO_LIFE;
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const legs = [];
  for (const spec of LEG_SPECS) {
    const leg = legEntryShared(mesh, bones, spec, { restFootMin: REST_FOOT_MIN });
    if (!leg) continue;
    const root = bindPosition(findBone(bones, spec.root));
    const tip = bindPosition(findBone(bones, spec.tip));
    leg.forward = root.x < 0 ? 1 : -1;
    leg.arm = Math.max(1e-4, Math.abs(tip.x - root.x));
    legs.push(leg);
  }
  if (!legs.length) return null;
  const sweep = (STRIDE_LENGTH / 2) / worldScale(mesh);
  for (const leg of legs) leg.amplitude = Math.asin(Math.min(MAX_STEP_SIN, sweep / (2 * leg.arm)));
  const lengths = legs.map((leg) => leg.length).filter((length) => length > 0);
  const averageLength = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 1;
  for (const leg of legs) {
    const factor = leg.length > 0 ? averageLength / leg.length : 1;
    leg.liftScale = (leg.liftScale || 1) * Math.max(0.55, Math.min(1.65, factor));
  }
  const fronts = legs.filter((leg) => leg.front);
  const tapLeg = fronts.length
    ? fronts.reduce((best, leg) => (Math.abs(leg.restLift || 0) < Math.abs(best.restLift || 0) ? leg : best))
    : null;
  const body = partEntries(bones, BODY_SPECS, { pitch: SIDE_AXIS, roll: FORWARD_AXIS, yaw: UP_AXIS });
  const tentacles = partEntries(bones, TENTACLE_SPECS, { open: FORWARD_AXIS, pitch: SIDE_AXIS });
  const jaws = partEntries(bones, JAW_SPECS, { open: FORWARD_AXIS });
  const tailBone = findBone(bones, TAIL_BONE);
  const tail = tailBone ? axisEntry(tailBone, { sway: UP_AXIS }) : null;
  console.info(`[sand-devil] nohy: ${legs.map((leg) => `${leg.id}(${leg.length.toFixed(2)}, krok ${leg.amplitude.toFixed(2)})`).join(', ')}; telo: ${body.length}, chapadla: ${tentacles.length}, kusadla: ${jaws.length}${tail ? ', ocas' : ''}`);
  const feet = LEG_SPECS.map((spec) => findBone(bones, spec.tip)).filter(Boolean)
    .map((bone) => bone.getTransformNode()).filter(Boolean);
  return {
    legs,
    feet,
    tapLeg,
    body,
    tentacles,
    jaws,
    tail,
    time: 0,
    walkPhase: 0,
    walk: 0,
    pitch: 0,
    jaw: JAW_IDLE,
    raise: 0,
    front: 0,
    strikeTime: Infinity,
    hitTime: 0,
    life: 0,
    lifeClock: Math.random() * IDLE_TOTAL,
    deadTime: 0,
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
  const moved = moving && Number.isFinite(info && info.moved) ? info.moved : 0;
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const dead = mode === 'dead';
  rig.time += seconds;
  rig.deadTime = dead ? rig.deadTime + seconds : 0;
  const stepping = !dead && (moving || turning);
  if (moving) rig.walkPhase += (moved / STRIDE_LENGTH) * Math.PI * 2;
  else if (stepping) rig.walkPhase += TURN_CADENCE * seconds;
  rig.walk = approach(rig.walk, stepping ? (moving ? 1 : TURN_STEP) : 0, seconds, SPEED_WALK);
  if (mode !== rig.lastMode) {
    if (rig.lastMode === 'windup') rig.strikeTime = 0;
    rig.lastMode = mode;
  }
  rig.strikeTime += seconds;
  if (info && info.hit) rig.hitTime = HIT_SECONDS;
  rig.hitTime = Math.max(0, rig.hitTime - seconds);
  const lively = LIFE_MODES.includes(mode) && !moving;
  rig.life = approach(rig.life, lively ? 1 : 0, seconds, LIFE_SPEED);
  if (lively) rig.lifeClock += seconds;
  const life = rig.life > 0.001 ? lifeTargets(rig.lifeClock) : NO_LIFE;

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
  } else if (engaged && moving) {
    pitchTarget = CHASE_LEAN;
    jawTarget = JAW_CHASE;
    raiseTarget = TENTACLE_CHASE;
  }
  rig.pitch = approach(rig.pitch, pitchTarget, seconds, SPEED_BODY);
  rig.jaw = approach(rig.jaw, jawTarget, seconds, SPEED_JAW);
  rig.raise = approach(rig.raise, raiseTarget, seconds, SPEED_LIFT);
  rig.front = approach(rig.front, frontTarget, seconds, SPEED_FRONT);
  rig.tailAmount = approach(rig.tailAmount, moving ? TAIL_WALK : TAIL_IDLE, seconds, SPEED_TAIL);
  rig.tailPhase += TAIL_SPEED * (1 + rig.walk) * seconds;

  const strike = strikeCurve(rig.strikeTime);
  const hit = rig.hitTime / HIT_SECONDS;
  const fade = dead ? Math.pow(Math.max(0, 1 - rig.deadTime / DEATH_FADE), 2) : 0;
  const pitch = rig.pitch + BODY_STRIKE * strike + HIT_REAR * hit;
  const jaw = rig.jaw + JAW_SNAP * strike + HIT_JAW * hit + life.jaw * rig.life
    + Math.sin(rig.deadTime * DEATH_JAW_SPEED) * DEATH_JAW * fade;
  const raise = rig.raise + TENTACLE_STRIKE * strike + life.tentacle * rig.life;
  const roll = Math.sin(rig.walkPhase) * BODY_ROLL * rig.walk;
  const yaw = Math.cos(rig.walkPhase) * BODY_TWIST * rig.walk + life.yaw * rig.life;
  for (const entry of rig.body) {
    turnEntry(entry, { pitch: pitch * entry.share, roll: roll * entry.share, yaw: yaw * entry.share });
  }
  for (const entry of rig.tentacles) turnEntry(entry, { open: jaw, pitch: raise });
  for (const entry of rig.jaws) turnEntry(entry, { open: jaw * JAW_SHARE });
  if (rig.tail) turnEntry(rig.tail, { sway: Math.sin(rig.tailPhase) * rig.tailAmount });

  rig.legs.forEach((leg, index) => {
    const restLift = Number.isFinite(leg.restLift) ? leg.restLift : 0;
    const walkPhase = rig.walkPhase + leg.phase;
    let angle = 0;
    let lift = restLift;
    let kneeSwing = 0;
    let knee = null;
    if (dead) {
      const curl = smoothStep(rig.deadTime / DEATH_CURL_SECONDS);
      const twitch = Math.sin(rig.deadTime * DEATH_TWITCH_SPEED + index * 1.7) * DEATH_TWITCH * fade;
      angle = DEAD_ANGLE + twitch;
      lift = restLift - DEATH_LIFT * curl + twitch;
      knee = -DEATH_KNEE * curl + twitch;
    } else if (emerging || burying) {
      angle = Math.sin(rig.time * EMERGE_SCRATCH_SPEED + leg.phase) * EMERGE_SCRATCH;
      lift = restLift + EMERGE_LIFT * dig;
      kneeSwing = angle * KNEE_SWING;
    } else if (!buried && leg.front) {
      const sway = Math.sin(rig.time * IDLE_SWAY_SPEED + leg.phase) * IDLE_SWAY;
      const swing = Math.sin(rig.walkPhase) * ARM_SWING * leg.forward * rig.walk;
      angle = (swing + sway * (1 - rig.walk)) * emerge
        + (FRONT_SWING * rig.front + FRONT_STRIKE * strike) * leg.side;
      const raised = FRONT_LIFT * Math.max(rig.front, FRONT_HOLD * strike) + HIT_SPLAY * hit;
      const carry = (ARM_CARRY + Math.sin(rig.walkPhase * 2) * ARM_DANGLE * rig.walk) * emerge;
      lift = restLift + raised + carry + (leg === rig.tapLeg ? life.tap * rig.life : 0);
      knee = -raised * KNEE_BEND + KNEE_STRIKE * strike + ARM_ELBOW * emerge;
      kneeSwing = -swing * KNEE_SWING;
    } else if (!buried) {
      const reach = Math.sin(walkPhase) * leg.amplitude;
      const sway = Math.sin(rig.time * IDLE_SWAY_SPEED + leg.phase) * IDLE_SWAY;
      angle = (reach * leg.forward * rig.walk + sway * (1 - rig.walk)) * emerge;
      lift += Math.max(0, Math.cos(walkPhase)) * LIFT * (leg.liftScale || 1) * rig.walk * emerge;
      lift += HIT_SPLAY * hit;
      kneeSwing = -reach * KNEE_SWING * rig.walk;
    }
    swingEntry(leg, angle, lift);
    if (leg.joint) {
      const kneeLift = knee !== null ? knee : -(lift - restLift) * KNEE_BEND;
      swingEntry(leg.joint, kneeSwing, kneeLift);
    }
  });

  if (dead || buried) return { bob: 0 };
  const bob = Math.sin(rig.walkPhase * 2) * BOB * rig.walk
    + Math.sin(rig.time * IDLE_SPEED) * IDLE_BOB * (1 - rig.walk);
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
  damageType: 'piercing',
  armor: 0,
  resistances: { blunt: 25, slashing: -25 },
  bestiary: {
    summary: 'Osminohý lovec zahrabaný v písku. Vidět je, až když útočí.',
    habitat: 'Písečné pláže a duny.',
    notes: 'Vyleze bez varování. Pružný krunýř pohltí tupé rány, ostří ale projde mezi jeho články.',
  },
  regenPerSecond: 0.27,
  biteRange: 1.1,
  biteArc: 80,
  biteLunge: 0.8,
  biteWindup: 0.4,
  biteCooldown: 1.6,
  biteRecover: 0.65,
  confusedSeconds: 2,
  footprint: {
    kind: 'sanddevil',
    scale: 1,
  },
  respawnDays: 5,
  idleSeconds: [3, 7],
  defaultTier: 'adult',
  buried: true,
  emergeRange: 3,
  emergeSeconds: 0.5,
  emergeJump: 0.42,
  buriedDepth: 0.27,
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
      xp: 12,
      bite: [3, 5],
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
      xp: 22,
      bite: [5, 9],
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
      xp: 34,
      bite: [8, 12],
      attack: 20,
      defense: 16,
      speed: 0.8,
      aggroRange: 5,
    },
  },
};

