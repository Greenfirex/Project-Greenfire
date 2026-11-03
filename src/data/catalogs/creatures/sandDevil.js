// PĂ­seÄŤnĂ˝ bÄ›s â€” krabovitĂ˝ tvor se Ĺˇesti nohami a dvÄ›ma kusadly.
// Model nemĂˇ pojmenovanĂ© kosti ani animace, tak se pohyb odvozuje z tvaru kostry.
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../assetPaths.js';

const MODEL = `${ASSET_DIRS.creatures}sand_devil/sand_devil.glb`;
const SIDE_AXIS = new Vector3(1, 0, 0);
const FORWARD_AXIS = new Vector3(0, 0, 1);
const SWING = 0.3;
const LIFT = 0.42;
const WALK_SPEED = 3.4;
const BOB = 0.025;
const MANDIBLE_OPEN = 0.3;
const LEG_SPECS = [
  { id: 'L1', root: 'Bone_039', joint: 'Bone_038', tip: 'Bone_035', phase: 0, lift: 0.55, swing: 0.55, footZ: 0.634154 },
  { id: 'L2', root: 'Bone_022', joint: 'Bone_021', tip: 'Bone_018', phase: Math.PI, lift: 1, swing: 1, footZ: 0.085792 },
  { id: 'L3', root: 'Bone_013', joint: 'Bone_012', tip: 'Bone_009', phase: 0, lift: 1, swing: 1, footZ: 0.155796 },
  { id: 'R1', root: 'Bone_034', joint: 'Bone_033', tip: 'Bone_030', phase: Math.PI, lift: 0.55, swing: 0.55, footZ: 0.260801 },
  { id: 'R2', root: 'Bone_027', joint: 'Bone_026', tip: 'Bone_023', phase: 0, lift: 1, swing: 1, footZ: 0.09746 },
  { id: 'R3', root: 'Bone_008', joint: 'Bone_007', tip: 'Bone_004', phase: Math.PI, lift: 1, swing: 1, footZ: 0.155796 },
];
const REST_FOOT_MIN = 0.085792;
const MANDIBLE_SPECS = [
  { root: 'Bone_049', tip: 'Bone_046' },
  { root: 'Bone_053', tip: 'Bone_050' },
];

function bindMatrix(bone) {
  try {
    if (typeof bone.getAbsoluteMatrix === 'function') return bone.getAbsoluteMatrix();
    if (typeof bone.getBindMatrix === 'function') return bone.getBindMatrix();
  } catch (error) {
    return null;
  }
  return null;
}

function restPosition(bone, mesh) {
  try {
    if (typeof bone.getAbsolutePosition === 'function') return bone.getAbsolutePosition(mesh).clone();
  } catch (error) {
    return null;
  }
  return null;
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

function nodeOf(bone) {
  return bone && typeof bone.getTransformNode === 'function' ? bone.getTransformNode() : null;
}

function entryOf(bone, axis = SIDE_AXIS) {
  const node = nodeOf(bone);
  if (!node) return null;
  const base = node.rotationQuaternion
    ? node.rotationQuaternion.clone()
    : Quaternion.FromEulerVector(node.rotation);
  return {
    bone,
    node,
    base,
    axis: axisInParent(bone, axis),
  };
}

function findBone(bones, name) {
  return bones.find((bone) => {
    const boneName = String(bone.name || '');
    return boneName === name || boneName.endsWith(`:${name}`);
  }) || null;
}

function legEntry(mesh, bones, spec) {
  const rootBone = findBone(bones, spec.root);
  const tipBone = findBone(bones, spec.tip);
  const jointBone = findBone(bones, spec.joint);
  if (!rootBone || !tipBone) return null;
  const entry = entryOf(rootBone, Vector3.Up());
  if (!entry) return null;
  entry.id = spec.id;
  entry.phase = spec.phase;
  entry.amplitude = SWING * (Number.isFinite(spec.swing) ? spec.swing : 1);
  entry.liftScale = spec.lift;
  if (jointBone) entry.joint = entryOf(jointBone, SIDE_AXIS);
  const rise = Math.max(0, spec.footZ - REST_FOOT_MIN);
  const legLength = Math.max(0.001, entry.length || 1);
  entry.restLift = -Math.asin(Math.min(0.8, rise / legLength));
  const root = restPosition(rootBone, mesh);
  const tip = restPosition(tipBone, mesh);
  entry.length = root && tip ? Vector3.Distance(root, tip) : 0;
  if (root && tip) {
    const direction = tip.subtract(root);
    direction.y = 0;
    if (direction.lengthSquared() > 1e-6) {
      direction.normalize();
      entry.liftAxis = axisInParent(rootBone, new Vector3(-direction.z, 0, direction.x));
    } else {
      entry.liftAxis = axisInParent(rootBone, SIDE_AXIS);
    }
  }
  return entry;
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const legs = LEG_SPECS.map((spec) => legEntry(mesh, bones, spec)).filter(Boolean);
  const mandibles = MANDIBLE_SPECS.map((spec, index) => {
    const rootBone = findBone(bones, spec.root);
    if (!rootBone) return null;
    const entry = entryOf(rootBone, FORWARD_AXIS);
    if (!entry) return null;
    entry.phase = index * Math.PI;
    return entry;
  }).filter(Boolean);
  if (!legs.length) return null;
  const lengths = legs.map((leg) => leg.length).filter((length) => length > 0);
  const averageLength = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 1;
  for (const leg of legs) {
    const factor = leg.length > 0 ? averageLength / leg.length : 1;
    leg.liftScale = (leg.liftScale || 1) * Math.max(0.55, Math.min(1.65, factor));
  }
  const center = legs.reduce((sum, leg) => sum.add(leg.node.position), Vector3.Zero()).scale(1 / legs.length);
  console.info(`[sand-devil] nohy: ${legs.map((leg) => `${leg.id}(${leg.length.toFixed(2)})`).join(', ')}; kusadla: ${mandibles.length}`);
  return { legs, mandibles, center, time: 0, mode: null };
}



function swingEntry(entry, angle, lift = 0) {
  if (!entry || !entry.node || !entry.base) return;
  let base = entry.base;
  if (lift && entry.liftAxis) {
    base = Quaternion.RotationAxis(entry.liftAxis, lift).multiply(base);
  }
  const delta = Quaternion.RotationAxis(entry.axis, angle);
  entry.node.rotationQuaternion = delta.multiply(base);
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const buried = Boolean(info && info.buried);
  const emerge = Number.isFinite(info && info.emergeProgress) ? info.emergeProgress : 1;
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  rig.time += seconds;
  if (mode === 'dead') {
    for (const leg of rig.legs) swingEntry(leg, 0.18);
    for (const mandible of rig.mandibles) swingEntry(mandible, 0);
    return { bob: 0 };
  }
  for (const leg of rig.legs) {
    const swing = Math.sin(rig.time * WALK_SPEED + leg.phase);
    const angle = buried
      ? 0
      : moving
        ? swing * leg.amplitude * emerge
        : Math.sin(rig.time * 1.3 + leg.phase) * 0.035;
    const restLift = Number.isFinite(leg.restLift) ? leg.restLift : 0;
    const lift = moving && !buried
      ? restLift + Math.max(0, Math.cos(rig.time * WALK_SPEED + leg.phase)) * LIFT * (leg.liftScale || 1) * emerge
      : restLift;
    swingEntry(leg, angle, lift);
    if (leg.joint) swingEntry(leg.joint, angle * 0.22, 0);
  }
  const open = mode === 'windup' ? -MANDIBLE_OPEN : mode === 'alert' ? MANDIBLE_OPEN * 0.55 : 0.04;
  for (const mandible of rig.mandibles) swingEntry(mandible, open);
  return { bob: moving && !buried ? Math.sin(rig.time * WALK_SPEED * 2) * BOB : 0 };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  return `${rig.legs.length} nohou, ${rig.mandibles.length} kusadla`;
}


export const sandDevilRig = { build, pose, summary };

export const SAND_DEVIL = {
  label: 'PĂ­seÄŤnĂ˝ bÄ›s',
  model: MODEL,
  rig: sandDevilRig,
  sounds: {
    alert: 'turtleHiss',
    charge: 'turtleGrowl',
    bite: 'turtleBite',
  },
  length: 2.3,
  scale: 0.7,
  yawOffset: Math.PI,
  walkSpeed: 0.58,
  turnRate: 2.8,
  aggroRange: 7,
  chargeRange: 4,
  alertSeconds: [3, 5],
  biteRange: 1.9,
  biteWindup: 0.8,
  biteCooldown: 2.6,
  biteRecover: 1.1,
  confusedSeconds: 2,
  roamRadius: 5,
  maxStepHeight: 0.45,
  attackHeight: 0.8,
  respawnDays: 5,
  idleSeconds: [3, 7],
  defaultTier: 'adult',
  buried: true,
  emergeRange: 4.5,
  emergeSeconds: 0.4,
  emergeJump: 0.42,
  buriedDepth: 0.62,
  groundOffset: REST_FOOT_MIN,
  loot: { meat: 1 },
  tiers: {
    young: {
      label: 'MladĂ˝',
      scale: 0.72,
      tint: [1, 0.96, 0.86],
      health: 45,
      bite: 7,
      attack: 14,
      defense: 7,
      speed: 1.15,
      aggroRange: 6,
    },
    adult: {
      label: 'DospÄ›lĂ˝',
      scale: 1,
      tint: [1, 1, 1],
      health: 90,
      bite: 13,
      attack: 24,
      defense: 12,
      speed: 1,
      aggroRange: 7,
    },
    elder: {
      label: 'StarĂ˝',
      scale: 1.2,
      tint: [0.9, 0.86, 0.76],
      health: 140,
      bite: 20,
      attack: 32,
      defense: 16,
      speed: 0.8,
      aggroRange: 8,
    },
  },
};

