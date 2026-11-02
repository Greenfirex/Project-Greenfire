// Želva kajmanka — všechna její data i rig na jednom místě.
// Kosti modelu z Meshy nemají jména, takže části těla určuje tvar těla, ne názvy kostí.
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../assetPaths.js';

const MODEL = `${ASSET_DIRS.creatures}snapping_turtle/snapping_turtle.glb`;
const LEG_SIDE = 0.32;
const LEG_HEIGHT = 0.8;
const CENTER_WIDTH = 0.35;
const HEAD_Z = 0.5;
const HEAD_HEIGHT = 0.5;
const TAIL_Z = -0.45;
const LEG_PHASES = { fl: 0, br: 0, fr: Math.PI, bl: Math.PI };
const WALK_CYCLE = 6;
const SWING = 0.32;
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
const SIDE_AXIS = new Vector3(1, 0, 0);
const BACK_AXIS = new Vector3(0, 0, -1);

function bindMatrix(bone) {
  try {
    if (typeof bone.getAbsoluteMatrix === 'function') return bone.getAbsoluteMatrix();
    if (typeof bone.getBindMatrix === 'function') return bone.getBindMatrix();
  } catch (error) {
    return null;
  }
  return null;
}

function restPosition(bone) {
  const matrix = bindMatrix(bone);
  if (matrix && matrix.m) return new Vector3(matrix.m[12], matrix.m[13], matrix.m[14]);
  return bone.getAbsolutePosition().clone();
}

function axisInParent(bone, source) {
  const parent = typeof bone.getParent === 'function' ? bone.getParent() : null;
  if (!parent) return source.clone();
  const matrix = bindMatrix(parent);
  if (!matrix) return source.clone();
  const inverse = matrix.clone();
  inverse.invert();
  const axis = Vector3.TransformNormal(source, inverse);
  if (axis.lengthSquared() < 1e-8) return source.clone();
  return axis.normalize();
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

function swingEntry(entry, angle) {
  if (!entry || !entry.target || !entry.base) return;
  if (!angle) {
    entry.target.rotationQuaternion = entry.base.clone();
    return;
  }
  const delta = Quaternion.RotationAxis(entry.axis, angle);
  entry.target.rotationQuaternion = delta.multiply(entry.base);
}

function pullEntry(entry, distance) {
  if (!entry || !entry.target || !entry.basePos) return;
  entry.target.position.copyFrom(entry.basePos);
  if (distance) entry.target.position.addInPlace(entry.backAxis.scale(distance));
}

function closestToBody(list) {
  return list.reduce((best, item) => (Math.abs(item.x) < Math.abs(best.x) ? item : best));
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
    const item = { bone, x: point.x, z: point.z, ny, nz };
    if (Math.abs(nx) > LEG_SIDE && ny < LEG_HEIGHT) {
      legs[`${nz > 0 ? 'f' : 'b'}${nx > 0 ? 'r' : 'l'}`].push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz > HEAD_Z && ny > HEAD_HEIGHT) {
      head.push(item);
    } else if (Math.abs(nx) < CENTER_WIDTH && nz < TAIL_Z) {
      tail.push(item);
    }
  }

  const legEntries = [];
  for (const key of Object.keys(legs)) {
    const list = legs[key];
    if (!list.length) continue;
    legEntries.push({ key, entry: animatedEntry(closestToBody(list).bone), offset: LEG_PHASES[key] });
  }

  const headItem = head.length ? headBase(head) : null;
  const tailItem = tail.length ? tailBase(tail) : null;
  return {
    legs: legEntries,
    head: headItem ? animatedEntry(headItem.bone) : null,
    tail: tailItem ? animatedEntry(tailItem.bone) : null,
    phase: Math.random() * Math.PI * 2,
    tailPhase: Math.random() * Math.PI * 2,
    swing: 0,
    tailSwing: 0,
    headPitch: HEAD_CALM,
    headPull: HEAD_CALM,
    mode: null,
  };
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
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
  rig.headPitch += (headTarget - rig.headPitch) * Math.min(1, seconds * HEAD_SPEED);
  rig.headPull += (pullTarget - rig.headPull) * Math.min(1, seconds * HEAD_PULL_SPEED);
  rig.phase += (moving ? WALK_CYCLE : 0) * seconds;
  rig.swing += ((moving ? SWING : 0) - rig.swing) * Math.min(1, seconds * 6);
  rig.tailPhase += TAIL_SPEED * seconds;
  rig.tailSwing += ((moving ? TAIL_SWING_WALK : TAIL_SWING_IDLE) - rig.tailSwing) * Math.min(1, seconds * 4);
  for (const leg of rig.legs) {
    swingEntry(leg.entry, Math.sin(rig.phase + leg.offset) * rig.swing);
  }
  swingEntry(rig.head, rig.headPitch);
  pullEntry(rig.head, rig.headPull);
  swingEntry(rig.tail, Math.sin(rig.tailPhase) * rig.tailSwing);
  return { bob: moving ? Math.sin(rig.phase * 2) * BOB : 0 };
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
  },
  length: 1.1,
  yawOffset: Math.PI,
  walkSpeed: 0.7,
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
  footprint: {
    kind: 'turtle',
    scale: 0.33,
    stepDistance: 0.65,
    feet: [
      { side: 0.24, forward: 0.16 },
      { side: -0.24, forward: 0.16 },
      { side: 0.24, forward: -0.16 },
      { side: -0.24, forward: -0.16 },
    ],
    pairs: [[0, 3], [1, 2]],
  },
  attackHeight: 0.45,
  respawnDays: 3,
  idleSeconds: [2.5, 6],
  defaultTier: 'adult',
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
