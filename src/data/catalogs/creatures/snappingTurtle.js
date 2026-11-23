// Želva kajmanka — všechna její data i rig na jednom místě.
// Kosti modelu z Meshy nemají jména, takže části těla určuje tvar těla, ne názvy kostí.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS,
  bindPosition, worldScale, axisInParent, entryOf, swingEntry, approach, stepSwing, stepLift,
} from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}snapping_turtle/snapping_turtle.glb`;
const LEG_SIDE = 0.32;
const LEG_HEIGHT = 0.8;
const CENTER_WIDTH = 0.35;
const HEAD_Z = 0.5;
const HEAD_HEIGHT = 0.5;
const TAIL_Z = -0.45;
const LEG_PHASES = { fl: 0, bl: 0.25, fr: 0.5, br: 0.75 };
const STRIDE_LENGTH = 0.3;
const STANCE_SHARE = 0.75;
const TURN_CYCLE = 0.55;
const MAX_STEP_ANGLE = 0.75;
const ROOT_LIFT = 0.28;
const KNEE_LIFT = 0.45;
const BOB = 0.012;
const HEAD_NOD = 0.04;
const HEAD_CALM = 0;
const HEAD_BACK = -0.6;
const HEAD_BITE = 0.3;
const HEAD_SPEED = 12;
const HEAD_PULL_BACK = 0.45;
const HEAD_PULL_BITE = -0.3;
const HEAD_PULL_SPEED = 14;
const ALERT_HEAD = -0.35;
const TAIL_SWING_WALK = 0.07;
const TAIL_SWING_IDLE = 0.025;
const TAIL_SPEED = 1.6;
const TAIL_LAG = 0.6;
const DEAD_LEG = 0.4;
const TURN_SWING = 0.6;
const HIT_SECONDS = 0.3;
const HIT_HEAD = -0.45;
const HIT_PULL = 0.3;
const HIT_LEG = 0.25;
const BACK_AXIS = new Vector3(0, 0, -1);

function liftSign(axis, reach) {
  return Math.sign(Vector3.Cross(axis, reach).y) || 1;
}

function headEntry(bone) {
  const entry = entryOf(bone, SIDE_AXIS);
  if (!entry) return null;
  entry.basePos = entry.node.position.clone();
  entry.backAxis = axisInParent(bone, BACK_AXIS);
  return entry;
}

function pullEntry(entry, distance) {
  if (!entry || !entry.basePos) return;
  entry.node.position.copyFrom(entry.basePos);
  if (distance) entry.node.position.addInPlace(entry.backAxis.scale(distance));
}

function legRoot(list) {
  const inLeg = new Set(list.map((item) => item.bone));
  const roots = list.filter((item) => !inLeg.has(item.bone.getParent()));
  return (roots.length ? roots : list).reduce((best, item) => (Math.abs(item.x) < Math.abs(best.x) ? item : best));
}

function legEntry(key, list, sweep) {
  const root = legRoot(list);
  const jointItem = list.find((item) => item.bone.getParent() === root.bone) || null;
  const foot = list.reduce((best, item) => (item.y < best.y ? item : best));
  const entry = entryOf(root.bone, SIDE_AXIS);
  if (!entry) return null;
  const reach = foot.point.subtract(root.point);
  const flat = new Vector3(reach.x, 0, reach.z);
  const worldLift = flat.lengthSquared() > 1e-6 ? new Vector3(-flat.z, 0, flat.x).normalize() : SIDE_AXIS.clone();
  entry.liftAxis = axisInParent(root.bone, worldLift);
  entry.liftSign = liftSign(worldLift, reach);
  const joint = jointItem ? entryOf(jointItem.bone, SIDE_AXIS) : null;
  if (joint) {
    joint.liftAxis = axisInParent(jointItem.bone, worldLift);
    joint.liftSign = liftSign(worldLift, foot.point.subtract(jointItem.point));
  }
  const height = Math.max(1e-4, Math.abs(reach.y));
  return {
    key,
    entry,
    joint,
    side: root.x < 0 ? -1 : 1,
    forward: reach.y < 0 ? -1 : 1,
    offset: LEG_PHASES[key],
    amplitude: Math.asin(Math.min(MAX_STEP_ANGLE, sweep / (2 * height))),
  };
}

function tailChain(skeleton, tail) {
  if (!tail.length) return [];
  const tip = tail.reduce((best, item) => (item.z < best.z ? item : best)).bone;
  const childCount = (parent) => skeleton.bones.filter((bone) => bone.getParent() === parent).length;
  const chain = [tip];
  for (let parent = tip.getParent(); parent && childCount(parent) === 1; parent = parent.getParent()) {
    chain.unshift(parent);
  }
  return chain.map((bone) => entryOf(bone, UP_AXIS)).filter(Boolean);
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !skeleton.bones || !skeleton.bones.length) return null;
  const box = mesh.getBoundingInfo().boundingBox;
  const min = box.minimum;
  const max = box.maximum;
  const centerX = (min.x + max.x) / 2;
  const centerZ = (min.z + max.z) / 2;
  const halfWidth = Math.max(0.001, (max.x - min.x) / 2);
  const halfLength = Math.max(0.001, (max.z - min.z) / 2);
  const height = Math.max(0.001, max.y - min.y);
  const legs = { fl: [], fr: [], bl: [], br: [] };
  const head = [];
  const tail = [];

  for (const bone of skeleton.bones) {
    const point = bindPosition(bone);
    const nx = (point.x - centerX) / halfWidth;
    const ny = (point.y - min.y) / height;
    const nz = (point.z - centerZ) / halfLength;
    const item = { bone, point, x: point.x, y: point.y, z: point.z };
    if (Math.abs(nx) > LEG_SIDE && ny < LEG_HEIGHT) {
      legs[`${nz > 0 ? 'f' : 'b'}${nx > 0 ? 'r' : 'l'}`].push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz > HEAD_Z && ny > HEAD_HEIGHT) {
      head.push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz < TAIL_Z) {
      tail.push(item);
    }
  }

  const sweep = (STRIDE_LENGTH * STANCE_SHARE) / worldScale(mesh);
  const legEntries = Object.keys(legs)
    .filter((key) => legs[key].length)
    .map((key) => legEntry(key, legs[key], sweep))
    .filter(Boolean);
  const headItem = head.length ? head.reduce((best, item) => (item.z < best.z ? item : best)) : null;
  return {
    legs: legEntries,
    head: headItem ? headEntry(headItem.bone) : null,
    tail: tailChain(skeleton, tail),
    phase: Math.random(),
    tailPhase: Math.random() * Math.PI * 2,
    swing: 0,
    tailSwing: 0,
    headPitch: HEAD_CALM,
    headPull: HEAD_CALM,
    hitTime: 0,
    mode: null,
  };
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  if (mode === 'dead') {
    rig.mode = 'dead';
    rig.hitTime = 0;
    rig.headPitch = approach(rig.headPitch, HEAD_CALM, seconds, HEAD_SPEED);
    rig.headPull = approach(rig.headPull, HEAD_CALM, seconds, HEAD_PULL_SPEED);
    for (const leg of rig.legs) {
      swingEntry(leg.entry, leg.side * DEAD_LEG);
      if (leg.joint) swingEntry(leg.joint, 0);
    }
    swingEntry(rig.head, rig.headPitch);
    pullEntry(rig.head, rig.headPull);
    for (const segment of rig.tail) swingEntry(segment, 0);
    return { bob: 0 };
  }
  if (rig.mode === 'windup' && mode === 'recover') {
    rig.headPitch = HEAD_BITE;
    rig.headPull = HEAD_PULL_BITE;
  }
  rig.mode = mode;
  let headTarget = HEAD_CALM;
  let pullTarget = HEAD_CALM;
  if (mode === 'windup') {
    headTarget = HEAD_BACK;
    pullTarget = HEAD_PULL_BACK;
  } else if (mode === 'alert') {
    headTarget = ALERT_HEAD;
  }
  if (info && info.hit) rig.hitTime = HIT_SECONDS;
  rig.hitTime = Math.max(0, rig.hitTime - seconds);
  const hit = rig.hitTime / HIT_SECONDS;
  const stepping = moving || Boolean(info && info.turning);
  headTarget += HIT_HEAD * hit;
  pullTarget += HIT_PULL * hit;
  rig.headPitch = approach(rig.headPitch, headTarget, seconds, HEAD_SPEED);
  rig.headPull = approach(rig.headPull, pullTarget, seconds, HEAD_PULL_SPEED);
  const travelled = moving && info && Number.isFinite(info.moved) ? info.moved : 0;
  const turnPhase = !moving && stepping ? TURN_CYCLE * seconds : 0;
  rig.phase = (rig.phase + travelled / STRIDE_LENGTH + turnPhase) % 1;
  rig.swing = approach(rig.swing, stepping ? (moving ? 1 : TURN_SWING) : 0, seconds, 6);
  rig.tailPhase += TAIL_SPEED * seconds;
  rig.tailSwing = approach(rig.tailSwing, stepping ? TAIL_SWING_WALK : TAIL_SWING_IDLE, seconds, 4);
  for (const leg of rig.legs) {
    const legPhase = (rig.phase + leg.offset) % 1;
    const swing = stepSwing(legPhase, STANCE_SHARE) * leg.amplitude * leg.forward * rig.swing;
    const lift = stepLift(legPhase, STANCE_SHARE) * rig.swing;
    swingEntry(leg.entry, swing + HIT_LEG * hit * leg.side, lift * ROOT_LIFT * leg.entry.liftSign);
    if (leg.joint) swingEntry(leg.joint, 0, lift * KNEE_LIFT * leg.joint.liftSign);
  }
  const rhythm = Math.sin(rig.phase * Math.PI * 8);
  swingEntry(rig.head, rig.headPitch + rhythm * HEAD_NOD * rig.swing);
  pullEntry(rig.head, rig.headPull);
  rig.tail.forEach((segment, index) => {
    swingEntry(segment, Math.sin(rig.tailPhase - index * TAIL_LAG) * rig.tailSwing);
  });
  return { bob: stepping ? rhythm * BOB * rig.swing : 0 };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  const legs = rig.legs.map((leg) => `${leg.key}${leg.joint ? '+' : ''}`).join(' ');
  return `${legs || 'bez nohou'}${rig.head ? ', hlava' : ''}${rig.tail.length ? `, ocas ${rig.tail.length}` : ''}`;
}

export const snappingTurtleRig = { build, pose, summary };

export const SNAPPING_TURTLE = {
  label: 'Kajmanka dravá',
  model: MODEL,
  rig: snappingTurtleRig,
  sounds: {
    alert: 'turtleAlert',
    charge: 'turtleCharge',
    bite: 'turtleBite',
    hit: 'turtleHit',
    death: 'turtleDeath',
    idle: 'turtleIdle',
  },
  idleCallSeconds: [12, 30],
  length: 1.1,
  yawOffset: Math.PI,
  walkSpeed: 0.35,
  chaseBoost: 1.2,
  turnRate: 2.4,
  aggroRange: 6,
  chargeRange: 2,
  damageType: 'piercing',
  resistances: {},
  regenPerSecond: 0.2,
  biteRange: 1.15,
  biteArc: 60,
  biteLunge: 0.5,
  biteWindup: 0.45,
  biteCooldown: 2,
  biteRecover: 0.9,
  confusedSeconds: 1.4,
  roamRadius: 6,
  footprint: {
    kind: 'turtle',
    scale: 0.33,
    stepDistance: STRIDE_LENGTH / 4,
    feet: [
      { side: 0.2 },
      { side: -0.157 },
      { side: 0.204 },
      { side: -0.178 },
    ],
    order: [1, 3, 0, 2],
  },
  respawnDays: 3,
  idleSeconds: [2.5, 6],
  defaultTier: 'adult',
  loot: { meat: 1, turtle_shell: 1 },
  tiers: {
    young: {
      label: 'Mladá',
      scale: 0.75,
      tint: [1, 1, 0.96],
      health: 30,
      bite: [3, 5],
      attack: 9,
      defense: 5,
      armor: 2,
      speed: 1.25,
      aggroRange: 5,
    },
    adult: {
      label: 'Dospělá',
      scale: 1,
      tint: [1, 1, 1],
      health: 60,
      bite: [6, 10],
      attack: 18,
      defense: 10,
      armor: 3,
      speed: 1,
      aggroRange: 6,
    },
    elder: {
      label: 'Stará',
      scale: 1.25,
      tint: [0.84, 0.9, 0.76],
      health: 100,
      bite: [11, 17],
      attack: 24,
      defense: 12,
      armor: 4,
      speed: 0.75,
      aggroRange: 8,
    },
  },
};
