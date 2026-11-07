// Želva kajmanka — všechna její data i rig na jednom místě.
// Kosti modelu z Meshy nemají jména, takže části těla určuje tvar těla, ne názvy kostí.
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../assetPaths.js';
import { bindMatrix, axisInParent } from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}snapping_turtle/snapping_turtle.glb`;
const LEG_SIDE = 0.32;
const LEG_HEIGHT = 0.8;
const CENTER_WIDTH = 0.35;
const HEAD_Z = 0.5;
const HEAD_HEIGHT = 0.5;
const TAIL_Z = -0.45;
const LEG_PHASES = { fl: 0, bl: 0.25, fr: 0.5, br: 0.75 };
const STRIDE_LENGTH = 0.64;
const STEP_BODY = 0.13;
const STANCE_SHARE = 0.5;
const TURN_CYCLE = 0.55;
const MAX_STEP_ANGLE = 0.85;
const BOB = 0.02;
const HEAD_CALM = 0;
const HEAD_BACK = -0.6;
const HEAD_BITE = 0.3;
const HEAD_SPEED = 12;
const HEAD_PULL_BACK = 0.45;
const HEAD_PULL_BITE = -0.3;
const HEAD_PULL_SPEED = 14;
const ALERT_HEAD = -0.35;
const TAIL_SWING_WALK = 0.14;
const TAIL_SWING_IDLE = 0.05;
const TAIL_SPEED = 1.6;
const DEAD_LEG = 0.4;
const TURN_SWING = 0.6;
const KNEE_LIFT = 0.45;
const HIT_SECONDS = 0.3;
const HIT_HEAD = -0.45;
const HIT_PULL = 0.3;
const HIT_LEG = 0.25;
const SIDE_AXIS = new Vector3(1, 0, 0);
const BACK_AXIS = new Vector3(0, 0, -1);

function restPosition(bone) {
  const matrix = bindMatrix(bone);
  if (matrix && matrix.m) return new Vector3(matrix.m[12], matrix.m[13], matrix.m[14]);
  return bone.getAbsolutePosition().clone();
}

function animatedEntry(bone) {
  const node = typeof bone.getTransformNode === 'function' ? bone.getTransformNode() : null;
  const target = node || bone;
  const base = target.rotationQuaternion
    ? target.rotationQuaternion.clone()
    : Quaternion.FromEulerVector(target.rotation);
  const basePos = target.position ? target.position.clone() : null;
  return {
    target,
    base,
    basePos,
    axis: axisInParent(bone, SIDE_AXIS),
    backAxis: axisInParent(bone, BACK_AXIS),
  };
}

function swingEntry(entry, angle, lift = 0) {
  if (!entry || !entry.target || !entry.base) return;
  let base = entry.base;
  if (lift && entry.liftAxis) {
    base = Quaternion.RotationAxis(entry.liftAxis, lift).multiply(base);
  }
  if (!angle) {
    entry.target.rotationQuaternion = base.clone();
    return;
  }
  const delta = Quaternion.RotationAxis(entry.axis, angle);
  entry.target.rotationQuaternion = delta.multiply(base);
}

function stepSwing(phase) {
  if (phase < STANCE_SHARE) return 1 - (2 * phase) / STANCE_SHARE;
  const s = (phase - STANCE_SHARE) / (1 - STANCE_SHARE);
  return -1 + 2 * s * s * (3 - 2 * s);
}

function stepLift(phase) {
  if (phase < STANCE_SHARE) return 0;
  return Math.sin(Math.PI * ((phase - STANCE_SHARE) / (1 - STANCE_SHARE)));
}

function pullEntry(entry, distance) {
  if (!entry || !entry.target || !entry.basePos) return;
  entry.target.position.copyFrom(entry.basePos);
  if (distance) entry.target.position.addInPlace(entry.backAxis.scale(distance));
}

function headBase(list) {
  return list.reduce((best, item) => (item.z < best.z ? item : best));
}

function tailBase(list) {
  return list.reduce((best, item) => (item.z > best.z ? item : best));
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
    const point = restPosition(bone);
    const nx = (point.x - centerX) / halfWidth;
    const ny = (point.y - min.y) / height;
    const nz = (point.z - centerZ) / halfLength;
    const item = { bone, x: point.x, y: point.y, z: point.z, ny, nz };
    if (Math.abs(nx) > LEG_SIDE && ny < LEG_HEIGHT) {
      legs[`${nz > 0 ? 'f' : 'b'}${nx > 0 ? 'r' : 'l'}`].push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz > HEAD_Z && ny > HEAD_HEIGHT) {
      head.push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz < TAIL_Z) {
      tail.push(item);
    }
  }

  const legEntries = [];
  const stepReach = STEP_BODY * Math.max(0.001, max.z - min.z);
  for (const key of Object.keys(legs)) {
    const list = [...legs[key]].sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
    if (!list.length) continue;
    const rootItem = list[0];
    const jointItem = list.length > 1 ? list[1] : null;
    const footItem = list[list.length - 1];
    const entry = animatedEntry(rootItem.bone);
    const direction = new Vector3(footItem.x - rootItem.x, 0, footItem.z - rootItem.z);
    const worldLift = direction.lengthSquared() > 1e-6
      ? new Vector3(-direction.z, 0, direction.x).normalize()
      : SIDE_AXIS.clone();
    entry.liftAxis = axisInParent(rootItem.bone, worldLift);
    const joint = jointItem ? animatedEntry(jointItem.bone) : null;
    if (joint) joint.liftAxis = axisInParent(jointItem.bone, worldLift);
    const reach = new Vector3(footItem.x - rootItem.x, footItem.y - rootItem.y, footItem.z - rootItem.z);
    const pitch = Vector3.Cross(SIDE_AXIS, reach);
    const foreAft = Math.abs(pitch.z);
    legEntries.push({
      key,
      entry,
      joint,
      side: rootItem.x < 0 ? -1 : 1,
      offset: LEG_PHASES[key],
      amplitude: Math.asin(Math.min(MAX_STEP_ANGLE, foreAft > 1e-4 ? stepReach / (2 * foreAft) : 0)),
    });
  }

  const headItem = head.length ? headBase(head) : null;
  const tailItem = tail.length ? tailBase(tail) : null;
  return {
    legs: legEntries,
    head: headItem ? animatedEntry(headItem.bone) : null,
    tail: tailItem ? animatedEntry(tailItem.bone) : null,
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
    rig.headPitch += (HEAD_CALM - rig.headPitch) * Math.min(1, seconds * HEAD_SPEED);
    rig.headPull += (HEAD_CALM - rig.headPull) * Math.min(1, seconds * HEAD_PULL_SPEED);
    rig.swing += (0 - rig.swing) * Math.min(1, seconds * 6);
    rig.tailSwing += (0 - rig.tailSwing) * Math.min(1, seconds * 4);
    for (const leg of rig.legs) {
      swingEntry(leg.entry, leg.side * DEAD_LEG);
      if (leg.joint) swingEntry(leg.joint, 0);
    }
    swingEntry(rig.head, rig.headPitch);
    pullEntry(rig.head, rig.headPull);
    swingEntry(rig.tail, 0);
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
  rig.headPitch += (headTarget - rig.headPitch) * Math.min(1, seconds * HEAD_SPEED);
  rig.headPull += (pullTarget - rig.headPull) * Math.min(1, seconds * HEAD_PULL_SPEED);
  const travelled = moving && info && Number.isFinite(info.moved) ? info.moved : 0;
  const turnPhase = !moving && stepping ? TURN_CYCLE * seconds : 0;
  rig.phase = (rig.phase + travelled / STRIDE_LENGTH + turnPhase) % 1;
  rig.swing += ((stepping ? (moving ? 1 : TURN_SWING) : 0) - rig.swing) * Math.min(1, seconds * 6);
  rig.tailPhase += TAIL_SPEED * seconds;
  rig.tailSwing += ((stepping ? TAIL_SWING_WALK : TAIL_SWING_IDLE) - rig.tailSwing) * Math.min(1, seconds * 4);
  for (const leg of rig.legs) {
    const legPhase = (rig.phase + leg.offset) % 1;
    const swing = stepSwing(legPhase) * leg.amplitude * rig.swing;
    swingEntry(leg.entry, swing + HIT_LEG * hit * leg.side);
    if (leg.joint) swingEntry(leg.joint, 0, stepLift(legPhase) * KNEE_LIFT * rig.swing);
  }
  swingEntry(rig.head, rig.headPitch);
  pullEntry(rig.head, rig.headPull);
  swingEntry(rig.tail, Math.sin(rig.tailPhase) * rig.tailSwing);
  return { bob: stepping ? Math.sin(rig.phase * Math.PI * 4) * BOB : 0 };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  const legs = rig.legs.map((leg) => leg.key).join('');
  return `${legs || 'bez nohou'}${rig.head ? ', hlava' : ''}${rig.tail ? ', ocas' : ''}`;
}

export const snappingTurtleRig = { build, pose, summary };

export const SNAPPING_TURTLE = {
  label: 'Kajmanka dravá',
  model: MODEL,
  rig: snappingTurtleRig,
  sounds: {
    alert: 'turtleHiss',
    charge: 'turtleGrowl',
    bite: 'turtleBite',
    hit: 'turtleGrowl',
    death: 'turtleHiss',
  },
  length: 1.1,
  yawOffset: Math.PI,
  walkSpeed: 0.35,
  chaseBoost: 1.2,
  turnRate: 2.4,
  aggroRange: 6,
  chargeRange: 3.5,
  alertSeconds: [5, 6],
  biteRange: 1.15,
  biteWindup: 0.5,
  biteCooldown: 2,
  biteRecover: 0.9,
  confusedSeconds: 1.4,
  roamRadius: 6,
  maxStepHeight: 0.45,
  noticeHeight: 2,
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
  attackHeight: 0.45,
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
      bite: 4,
      attack: 9,
      defense: 5,
      speed: 1.25,
      aggroRange: 5,
    },
    adult: {
      label: 'Dospělá',
      scale: 1,
      tint: [1, 1, 1],
      health: 60,
      bite: 8,
      attack: 18,
      defense: 10,
      speed: 1,
      aggroRange: 6,
    },
    elder: {
      label: 'Stará',
      scale: 1.25,
      tint: [0.84, 0.9, 0.76],
      health: 100,
      bite: 14,
      attack: 24,
      defense: 12,
      speed: 0.75,
      aggroRange: 8,
    },
  },
};
