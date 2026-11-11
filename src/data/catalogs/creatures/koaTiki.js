// Koa'tiki — dvounohý dravý ještěr s dlouhým ocasem a otevíratelnou čelistí.
// Model nemá animace ani čitelné názvy kostí, pohyb se odvozuje z tvaru kostry.
import { Quaternion, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS,
  findBone, axisEntry, partEntries, swingEntry, turnEntry, approach,
  legEntry as legEntryShared, calibrateHinge, applyHinge, strideRateFor,
} from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}koa_tiki/koa_tiki.glb`;
const BONES = {
  root: 'Bone_001',
  neck: ['Bone_013', 'Bone_012', 'Bone_011'],
  neckTop: 'Bone_010',
  skull: 'Bone_008',
  jaw: 'Bone_009',
  tail: ['Bone_006', 'Bone_005', 'Bone_004'],
};
const NECK_SHARE = [0.45, 0.3, 0.25];
const TAIL_SHARE = [0.5, 0.3, 0.2];
const LEGS = [
  { id: 'L', root: 'Bone_023', joint: 'Bone_022', tip: 'Bone_020', phase: 0 },
  { id: 'R', root: 'Bone_018', joint: 'Bone_017', tip: 'Bone_015', phase: Math.PI },
];
const SWING = 0.3;
const STRIDE_SLACK = 0.8;
const LIFT = 0.24;
const IDLE_SWAY = 0.05;
const IDLE_SPEED = 1;
const IDLE_BOB = 0.006;
const BOB = 0.012;
const KNEE_BEND = 0.5;
const KNEE_SWING = 0.25;
const TAIL_WALK = 1.4;
const TAIL_IDLE = 0.7;
const TAIL_SPEED = 1.8;
const TAIL_STRIKE = 0.6;
const NECK_PECK = 2.6;
const HEAD_PECK = -2.5;
const TAIL_PECK = 0.8;
const CROUCH_THIGH = 0.5;
const CROUCH_KNEE = 1;
const CROUCH_DROP = 0.18;
const SPEED_CROUCH = 4;
const SPEED_FOLLOW = 6;
const SPEED_BLEND = 3;
const NECK_LOOK = -0.18;
const LOOK_YAW = 0.45;
const SPEED_IDLE = 12;
const PECK_LOWER = 1;
const PECK_RAISE = 0.9;
const PECK_JABS = 3;
const PECK_JAB_TIME = 0.45;
const PECK_DEPTH = 0.85;
const PECK_SECONDS = PECK_LOWER + PECK_JABS * PECK_JAB_TIME + PECK_RAISE;
const IDLE_PHASES = [
  { kind: 'rest', seconds: 2 },
  { kind: 'look', seconds: 3.2 },
  { kind: 'peck' },
  { kind: 'look', seconds: 3.6 },
  { kind: 'rest', seconds: 2.4 },
  { kind: 'peck' },
  { kind: 'look', seconds: 2.8 },
  { kind: 'rest', seconds: 2.6 },
];

function phaseSeconds(phase) {
  return phase.kind === 'peck' ? PECK_SECONDS : phase.seconds;
}

const IDLE_TOTAL = IDLE_PHASES.reduce((sum, phase) => sum + phaseSeconds(phase), 0);

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function peckLevel(time) {
  if (time < PECK_LOWER) return PECK_DEPTH * smoothStep(time / PECK_LOWER);
  const afterLower = time - PECK_LOWER;
  const jabs = PECK_JABS * PECK_JAB_TIME;
  if (afterLower < jabs) {
    const wave = Math.abs(Math.sin((afterLower / PECK_JAB_TIME) * Math.PI));
    return PECK_DEPTH + (1 - PECK_DEPTH) * wave;
  }
  return PECK_DEPTH * (1 - smoothStep((afterLower - jabs) / PECK_RAISE));
}

function idleTargets(clock) {
  let left = clock % IDLE_TOTAL;
  for (const phase of IDLE_PHASES) {
    const duration = phaseSeconds(phase);
    if (left > duration) {
      left -= duration;
      continue;
    }
    const part = duration > 0 ? left / duration : 0;
    if (phase.kind === 'peck') {
      const level = peckLevel(left);
      return {
        neck: NECK_PECK * level,
        head: HEAD_PECK * level,
        yaw: 0,
        crouch: Math.min(1, level / PECK_DEPTH),
        tail: 1,
      };
    }
    if (phase.kind === 'look') {
      return { neck: NECK_LOOK, head: 0, yaw: Math.sin(part * Math.PI * 2) * LOOK_YAW, crouch: 0, tail: 0 };
    }
    return { neck: 0, head: 0, yaw: 0, crouch: 0, tail: 0 };
  }
  return { neck: 0, head: 0, yaw: 0, crouch: 0, tail: 0 };
}
const BODY_DEAD = 0.22;
const NECK_HIT = -0.25;
const HIT_SECONDS = 0.3;
const NECK_ALERT = -0.25;
const NECK_WINDUP = -0.55;
const NECK_DEAD = 0.35;
const NECK_STRIKE = 0.8;
const HEAD_SHARE = 0.55;
const HEAD_STRIKE = -0.3;
const JAW_IDLE = 0.02;
const JAW_ALERT = 0.12;
const JAW_WIDE = 0.55;
const JAW_SNAP = -0.1;
const STRIKE_SECONDS = 0.5;
const SPEED_BODY = 8;
const SPEED_NECK = 10;
const SPEED_JAW = 14;
const SPEED_TAIL = 4;
const MOUTH = { radiusX: 0.075, radiusY: 0.04, radiusZ: 0.15, y: 1.33, z: 0.84 };
const JAW_PROBE = new Vector3(0, 1.34, 1.02);

function reparent(bone, parentBone) {
  const node = bone && typeof bone.getTransformNode === 'function' ? bone.getTransformNode() : null;
  const parentNode = parentBone && typeof parentBone.getTransformNode === 'function' ? parentBone.getTransformNode() : null;
  if (!node || !parentNode || typeof bone.setParent !== 'function') return false;
  node.computeWorldMatrix(true);
  parentNode.computeWorldMatrix(true);
  const world = node.getWorldMatrix().clone();
  bone.setParent(parentBone);
  parentNode.computeWorldMatrix(true);
  const local = world.multiply(Matrix.Invert(parentNode.getWorldMatrix()));
  const scaling = new Vector3();
  const rotation = new Quaternion();
  const position = new Vector3();
  local.decompose(scaling, rotation, position);
  node.position.copyFrom(position);
  node.rotationQuaternion = rotation;
  node.scaling.copyFrom(scaling);
  node.computeWorldMatrix(true);
  return true;
}

function addMouth(mesh, skullBone) {
  const scene = mesh.getScene ? mesh.getScene() : null;
  const node = skullBone.getTransformNode ? skullBone.getTransformNode() : null;
  if (!scene || !node) return null;
  mesh.computeWorldMatrix(true);
  node.computeWorldMatrix(true);
  const target = Vector3.TransformCoordinates(new Vector3(0, MOUTH.y, MOUTH.z), mesh.getWorldMatrix());
  const local = Vector3.TransformCoordinates(target, Matrix.Invert(node.getWorldMatrix()));
  const mouth = CreateSphere('koa_tiki_mouth', { diameter: 1, segments: 8 }, scene);
  mouth.scaling.set(MOUTH.radiusX * 2, MOUTH.radiusY * 2, MOUTH.radiusZ * 2);
  mouth.position.copyFrom(local);
  mouth.parent = node;
  mouth.isPickable = false;
  mouth.receiveShadows = false;
  const material = new StandardMaterial('koa_tiki_mouth_mat', scene);
  material.diffuseColor = new Color3(0.18, 0.04, 0.05);
  material.emissiveColor = new Color3(0.1, 0.02, 0.02);
  material.specularColor = new Color3(0.06, 0.04, 0.04);
  material.backFaceCulling = false;
  mouth.material = material;
  return mouth;
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const skull = findBone(bones, BONES.skull);
  const jaw = findBone(bones, BONES.jaw);
  const neckTop = findBone(bones, BONES.neckTop);
  if (skull && neckTop) reparent(skull, neckTop);
  if (jaw && skull) reparent(jaw, skull);

  const legOptions = { swing: SWING, swingAxis: SIDE_AXIS, liftAxis: SIDE_AXIS, calibrate: true };
  const legs = LEGS.map((spec) => legEntryShared(mesh, bones, spec, legOptions)).filter(Boolean);
  if (!legs.length) return null;
  const lengths = legs.map((leg) => leg.length).filter((length) => length > 0);
  const averageLength = lengths.length ? lengths.reduce((sum, length) => sum + length, 0) / lengths.length : 1;
  for (const leg of legs) {
    const factor = leg.length > 0 ? averageLength / leg.length : 1;
    leg.liftScale = (leg.liftScale || 1) * Math.max(0.55, Math.min(1.65, factor));
  }
  const strideRate = strideRateFor(legs);

  const body = partEntries(bones, [{ bone: BONES.root, share: 1 }], { pitch: SIDE_AXIS });
  const neck = partEntries(
    bones,
    BONES.neck.map((bone, index) => ({ bone, share: NECK_SHARE[index] })),
    { pitch: SIDE_AXIS, yaw: UP_AXIS },
  );
  const tail = partEntries(
    bones,
    BONES.tail.map((bone, index) => ({ bone, share: TAIL_SHARE[index] })),
    { sway: UP_AXIS, lift: SIDE_AXIS },
  );
  const head = skull ? axisEntry(skull, { pitch: SIDE_AXIS }) : null;
  const jawEntry = jaw ? axisEntry(jaw, { open: SIDE_AXIS }) : null;
  const jawHinge = jawEntry ? calibrateHinge(mesh, jawEntry, JAW_PROBE) : null;
  const mouth = skull ? addMouth(mesh, skull) : null;
  if (mouth) mouth.setEnabled(false);
  const jawNote = jawHinge
    ? `, čelist (${jawHinge.mode}/${jawHinge.sign > 0 ? '+' : '-'}, dolů o ${jawHinge.drop.toFixed(3)})`
    : ', bez čelisti';
  console.info(`[koa-tiki] nohy: ${legs.map((leg) => `${leg.id}${leg.liftSign < 0 ? '~' : ''}`).join(', ')}; krok ${strideRate.toFixed(2)}; ocas: ${tail.length}; krk: ${neck.length}; ${head ? 'lebka' : 'bez lebky'}${jawNote}${mouth ? ', tlama' : ''}`);

  return {
    legs,
    body,
    neck,
    tail,
    head,
    jawEntry,
    jawHinge,
    mouth,
    mouthBase: mouth ? mouth.scaling.clone() : null,
    time: 0,
    walkPhase: 0,
    speedSmooth: 0,
    stepBlend: 0,
    pitch: 0,
    neckPitch: 0,
    jaw: JAW_IDLE,
    strike: 0,
    hitTime: 0,
    tailPhase: 0,
    tailAmount: TAIL_IDLE,
    strideRate,
    idleClock: 0,
    idleNeck: 0,
    idleHead: 0,
    idleYaw: 0,
    idleCrouch: 0,
    idleTail: 0,
    lastMode: null,
  };
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const turning = Boolean(info && info.turning);
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  rig.time += seconds;
  const travelled = Number.isFinite(info && info.moved) ? Math.max(0, info.moved) : 0;
  const realSpeed = seconds > 0 ? travelled / seconds : 0;
  rig.speedSmooth = approach(rig.speedSmooth, realSpeed, seconds, SPEED_FOLLOW);
  const cadence = rig.speedSmooth * (rig.strideRate || 4) * STRIDE_SLACK;
  rig.walkPhase += cadence * seconds;
  rig.stepBlend = approach(rig.stepBlend, moving ? 1 : 0, seconds, SPEED_BLEND);
  if (mode !== rig.lastMode) {
    if (rig.lastMode === 'windup') rig.strike = 1;
    rig.lastMode = mode;
  }
  rig.strike = Math.max(0, rig.strike - seconds / STRIKE_SECONDS);
  if (info && info.hit) rig.hitTime = HIT_SECONDS;
  rig.hitTime = Math.max(0, rig.hitTime - seconds);

  const dead = mode === 'dead';
  let pitchTarget = 0;
  let neckTarget = 0;
  let jawTarget = JAW_IDLE;
  if (dead) {
    pitchTarget = BODY_DEAD;
    neckTarget = NECK_DEAD;
    jawTarget = 0;
  } else if (mode === 'windup') {
    neckTarget = NECK_WINDUP;
    jawTarget = JAW_WIDE;
  } else if (mode === 'alert') {
    neckTarget = NECK_ALERT;
    jawTarget = JAW_ALERT;
  }

  rig.pitch = approach(rig.pitch, pitchTarget, seconds, SPEED_BODY);
  rig.neckPitch = approach(rig.neckPitch, neckTarget, seconds, SPEED_NECK);
  rig.jaw = approach(rig.jaw, jawTarget, seconds, SPEED_JAW);
  rig.tailAmount = approach(rig.tailAmount, moving ? TAIL_WALK : TAIL_IDLE, seconds, SPEED_TAIL);
  rig.tailPhase += TAIL_SPEED * seconds;

  const idleOk = !dead && !moving && !turning && mode !== 'windup' && mode !== 'alert'
    && mode !== 'recover' && mode !== 'chase';
  let idleNeckTarget = 0;
  let idleHeadTarget = 0;
  let idleYawTarget = 0;
  let idleCrouchTarget = 0;
  let idleTailTarget = 0;
  if (idleOk) {
    rig.idleClock += seconds;
    const targets = idleTargets(rig.idleClock);
    idleNeckTarget = targets.neck;
    idleHeadTarget = targets.head;
    idleYawTarget = targets.yaw;
    idleCrouchTarget = targets.crouch;
    idleTailTarget = targets.tail;
  }
  rig.idleNeck = approach(rig.idleNeck, idleNeckTarget, seconds, SPEED_IDLE);
  rig.idleHead = approach(rig.idleHead, idleHeadTarget, seconds, SPEED_IDLE);
  rig.idleYaw = approach(rig.idleYaw, idleYawTarget, seconds, SPEED_IDLE);
  rig.idleCrouch = approach(rig.idleCrouch, idleCrouchTarget, seconds, SPEED_CROUCH);
  rig.idleTail = approach(rig.idleTail, idleTailTarget, seconds, SPEED_CROUCH);

  const strike = rig.strike;
  const hit = rig.hitTime / HIT_SECONDS;
  const neck = rig.neckPitch * (1 - strike) + NECK_STRIKE * strike + NECK_HIT * hit + rig.idleNeck * (1 - strike);
  const neckYaw = Math.sin(rig.tailPhase * 0.6) * 0.05 + rig.idleYaw;
  const jaw = rig.jaw + JAW_SNAP * strike;
  for (const entry of rig.body) turnEntry(entry, { pitch: rig.pitch * entry.share });
  for (const entry of rig.neck) {
    turnEntry(entry, {
      pitch: neck * entry.share,
      yaw: neckYaw * entry.share,
    });
  }
  if (rig.head) {
    turnEntry(rig.head, {
      pitch: neck * HEAD_SHARE + HEAD_STRIKE * strike + rig.idleHead * (1 - strike),
    });
  }
  if (rig.jawEntry) applyHinge(rig.jawEntry, rig.jawHinge, jaw);
  if (rig.mouth && rig.mouthBase) {
    const shown = Math.min(1, Math.max(0, jaw) / JAW_WIDE);
    rig.mouth.setEnabled(shown > 0.06);
    rig.mouth.scaling.set(
      rig.mouthBase.x,
      rig.mouthBase.y * (0.4 + 0.6 * shown),
      rig.mouthBase.z,
    );
  }
  const tailSway = rig.tailAmount * (moving ? 0.5 : 0.65);
  const tailLift = rig.tailAmount * (moving ? 0.6 : 0.45);
  const tailLiftPhase = moving ? rig.tailPhase * 2 : rig.tailPhase;
  for (const entry of rig.tail) {
    turnEntry(entry, {
      sway: Math.sin(rig.tailPhase) * tailSway * entry.share,
      lift: Math.sin(tailLiftPhase + 1.1) * tailLift * entry.share
        - TAIL_STRIKE * strike * entry.share
        + TAIL_PECK * (rig.idleTail || 0) * entry.share,
    });
  }

  const crouch = rig.idleCrouch || 0;
  const stepBlend = rig.stepBlend;
  for (const leg of rig.legs) {
    const walkPhase = rig.walkPhase + leg.phase;
    let angle = 0;
    let lift = 0;
    if (!dead) {
      const walkAngle = Math.sin(walkPhase) * leg.amplitude;
      const idleAngle = Math.sin(rig.time * IDLE_SPEED + leg.phase) * IDLE_SWAY;
      const walkLift = smoothStep(Math.cos(walkPhase)) * LIFT * (leg.liftScale || 1) * (leg.liftSign || 1);
      angle = idleAngle + (walkAngle - idleAngle) * stepBlend;
      lift = walkLift * stepBlend;
    }
    swingEntry(leg, angle + CROUCH_THIGH * crouch, lift);
    if (leg.joint) {
      swingEntry(leg.joint, angle * KNEE_SWING - lift * KNEE_BEND - CROUCH_KNEE * crouch, 0);
    }
  }

  if (dead) return { bob: 0 };
  const walkBob = Math.sin(rig.walkPhase * 2) * BOB;
  const idleBob = Math.sin(rig.time * IDLE_SPEED) * IDLE_BOB;
  const bob = idleBob + (walkBob - idleBob) * stepBlend;
  return { bob: bob - CROUCH_DROP * crouch };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  return `${rig.legs.length} nohy, ${rig.tail.length} ocas, ${rig.neck.length} krk${rig.jawEntry ? ', čelist' : ''}`;
}

export const koaTikiRig = { build, pose, summary };

export const KOA_TIKI = {
  label: "Koa'tiki",
  model: MODEL,
  rig: koaTikiRig,
  length: 1.9,
  scale: 0.8,
  yawOffset: Math.PI,
  walkSpeed: 1.4,
  chaseBoost: 1.6,
  turnRate: 4.5,
  aggroRange: 6,
  chargeRange: 3.5,
  alertSeconds: [1.2, 2.2],
  biteRange: 1.3,
  biteWindup: 0.35,
  biteCooldown: 1.4,
  biteRecover: 0.5,
  confusedSeconds: 1.2,
  roamRadius: 2,
  entersCaves: true,
  respawnDays: 6,
  idleSeconds: [16, 30],
  defaultTier: 'adult',
  deathRoll: 1.3,
  deathSeconds: 0.6,
  loot: { meat: 2 },
  tiers: {
    young: {
      label: 'Mladý',
      scale: 0.72,
      tint: [1, 0.94, 0.84],
      health: 28,
      bite: 5,
      attack: 11,
      defense: 7,
      speed: 1.15,
      aggroRange: 5,
    },
    adult: {
      label: 'Dospělý',
      scale: 1,
      tint: [1, 1, 1],
      health: 50,
      bite: 8,
      attack: 16,
      defense: 11,
      speed: 1,
      aggroRange: 6,
    },
    elder: {
      label: 'Starý',
      scale: 1.2,
      tint: [0.92, 0.78, 0.7],
      health: 72,
      bite: 12,
      attack: 22,
      defense: 15,
      speed: 0.85,
      aggroRange: 6.5,
    },
  },
};

