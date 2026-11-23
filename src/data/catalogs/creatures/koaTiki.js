// Koa'tiki — dvounohý dravý ještěr s dlouhým ocasem a otevíratelnou čelistí.
// Model nemá animace ani čitelné názvy kostí, pohyb se odvozuje z tvaru kostry.
import { Quaternion, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS, FORWARD_AXIS,
  findBone, axisEntry, partEntries, turnEntry, approach, bindPosition, worldScale,
  probeAxis, stepSwing, stepLift, calibrateHinge, applyHinge,
} from '../../../utils/proceduralRig.js';

const MODEL = `${ASSET_DIRS.creatures}koa_tiki/koa_tiki.glb`;
const BONES = {
  root: 'Bone_001',
  neck: ['Bone_013', 'Bone_012', 'Bone_011'],
  neckTop: 'Bone_010',
  skull: 'Bone_008',
  jaw: 'Bone_009',
  tail: ['Bone_007', 'Bone_006', 'Bone_005', 'Bone_004'],
};
const NECK_SHARE = [0.45, 0.3, 0.25];
const TAIL_SHARE = [0.3, 0.35, 0.25, 0.1];
const TAIL_LAG = 0.6;
const LEGS = [
  { id: 'L', hip: 'Bone_023', knee: 'Bone_022', hock: 'Bone_021', foot: 'Bone_019', toe: 'Bone_045', offset: 0 },
  { id: 'R', hip: 'Bone_018', knee: 'Bone_017', hock: 'Bone_016', foot: 'Bone_014', toe: 'Bone_033', offset: 0.5 },
];
const PROBE_ANGLE = 0.1;
const STANCE_SHARE = 0.6;
const STRIDE_REACH = 1.4;
const HOCK_FOLLOW = 0.5;
const SPEED_FOLLOW = 6;
const TURN_CYCLE = 1.2;
const TURN_SWING = 0.5;
const HIP_LIFT = 0.25;
const KNEE_LIFT = 0.7;
const HOCK_RELEASE = 0.5;
const TOE_CURL = 0.5;
const BODY_ROLL = 0.05;
const BODY_YAW = 0.06;
const NECK_STEADY = 0.8;
const IDLE_ROLL = 0.03;
const IDLE_ROLL_SPEED = 0.7;
const IDLE_SPEED = 1;
const IDLE_BOB = 0.006;
const BOB = 0.012;
const TAIL_WALK = 0.6;
const TAIL_IDLE = 0.7;
const TAIL_SPEED = 1.8;
const CROUCH_THIGH = 0.5;
const CROUCH_KNEE = 1;
const CROUCH_DROP = 0.12;
const SPEED_BLEND = 4;
const NECK_LOOK = -0.18;
const LOOK_YAW = 0.45;
const SPEED_IDLE = 12;
const SPEED_IDLE_FOLLOW = 30;
const IDLE_CHANNELS = ['neck', 'head', 'yaw', 'crouch', 'tail', 'lean', 'tilt', 'jaw', 'rake', 'shift'];
const REST_SECONDS = [1.5, 3];
const LOOK_SECONDS = [2.6, 3.6];
const PECK_CHANCE = 0.4;
const LOOK_CHANCE = 0.6;
const SCRATCH_CHANCE = 0.5;
const PECK_JABS = [1, 3];
const PECK_PAUSE = [0.2, 0.55];
const PECK_TILT = 0.22;
const PECK_LOOK = { neck: 0.5, head: -0.4, crouch: 0.15, lean: 0.04, tail: 0.2 };
const PECK_HOVER = { neck: 1.95, head: -1.9, crouch: 0.65, lean: 0.08, tail: 0.65 };
const PECK_HIT = { neck: 2.4, head: -2.35, crouch: 0.66, lean: 0.1, tail: 0.7 };
const PECK_GULP = { neck: -0.2, head: 0.35, crouch: 0.1, lean: 0, tail: 0.1, tilt: 0 };
const PECK_JAW_OPEN = 0.18;
const PECK_SWALLOW = 0.12;
const RAKE_HIP = 0.35;
const RAKE_KNEE = 0.9;
const RAKE_TOE = 0.4;
const RAKE_SHIFT = 0.04;

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function between([low, high]) {
  return low + Math.random() * (high - low);
}

function peckSession() {
  const keys = {};
  for (const channel of IDLE_CHANNELS) keys[channel] = [[0, 0]];
  let time = 0;
  const put = (seconds, values = {}) => {
    time += seconds;
    for (const channel of IDLE_CHANNELS) {
      const last = keys[channel][keys[channel].length - 1][1];
      keys[channel].push([time, Number.isFinite(values[channel]) ? values[channel] : last]);
    }
  };
  const side = Math.random() < 0.5 ? -1 : 1;
  const foot = Math.random() < 0.5 ? 0 : 1;
  if (Math.random() < SCRATCH_CHANCE) {
    put(0.4, { ...PECK_LOOK, shift: 1 });
    for (let rake = 0; rake < 2; rake += 1) {
      put(0.18, { rake: 1 });
      put(0.22, { rake: -1 });
      put(0.12, { rake: 0 });
    }
    put(0.3, { shift: 0, tilt: PECK_TILT * side });
  }
  put(0.5, { ...PECK_HOVER, tilt: PECK_TILT * side });
  const jabs = Math.round(between(PECK_JABS));
  const taps = [];
  for (let jab = 0; jab < jabs; jab += 1) {
    put(between(PECK_PAUSE), { tilt: PECK_TILT * (jab % 2 ? -side : side) });
    put(0.05, { jaw: PECK_JAW_OPEN, neck: PECK_HOVER.neck - 0.1 });
    put(0.08, PECK_HIT);
    put(0.05, { jaw: 0 });
    taps.push(time);
    put(0.12, PECK_HOVER);
  }
  put(0.35, { neck: 0.8, head: -0.6, crouch: 0.3, lean: 0.04, tail: 0.3, tilt: 0 });
  put(0.15, PECK_GULP);
  for (let gulp = 0; gulp < 2; gulp += 1) {
    put(0.1, { jaw: PECK_SWALLOW });
    put(0.1, { jaw: 0 });
  }
  put(0.25);
  const rest = {};
  for (const channel of IDLE_CHANNELS) rest[channel] = 0;
  put(0.45, rest);
  return { kind: 'peck', time: 0, duration: time, keys, foot, taps };
}

function restAction(seconds = between(REST_SECONDS)) {
  return { kind: 'rest', time: 0, duration: seconds };
}

function nextIdleAction(last) {
  const roll = Math.random();
  if (last !== 'peck' && roll < PECK_CHANCE) return peckSession();
  if (roll < LOOK_CHANCE) {
    return { kind: 'look', time: 0, duration: between(LOOK_SECONDS), side: Math.random() < 0.5 ? -1 : 1 };
  }
  return restAction();
}

function idleTargets(action) {
  const targets = {};
  for (const channel of IDLE_CHANNELS) targets[channel] = 0;
  if (!action) return targets;
  if (action.kind === 'peck') {
    for (const channel of IDLE_CHANNELS) targets[channel] = track(action.keys[channel], action.time);
  } else if (action.kind === 'look') {
    const part = action.time / action.duration;
    targets.neck = NECK_LOOK * Math.sin(part * Math.PI);
    targets.yaw = Math.sin(part * Math.PI * 2) * LOOK_YAW * action.side;
  }
  return targets;
}

function track(keys, time) {
  if (!keys) return 0;
  if (time <= keys[0][0]) return keys[0][1];
  for (let index = 1; index < keys.length; index += 1) {
    const [end, value] = keys[index];
    if (time > end) continue;
    const [start, from] = keys[index - 1];
    return from + (value - from) * smoothStep((time - start) / (end - start));
  }
  return keys[keys.length - 1][1];
}

function jumpLift(time) {
  const [start, end] = JUMP_AIR;
  if (time <= start || time >= end) return 0;
  const u = (time - start) / (end - start);
  return 4 * u * (1 - u);
}

function hitCurve(time) {
  if (!(time < HIT_RISE + HIT_SECONDS)) return 0;
  if (time < HIT_RISE) return smoothStep(time / HIT_RISE);
  const u = (time - HIT_RISE) / HIT_SECONDS;
  return (1 - u) * (1 - u) * Math.cos(u * Math.PI * 1.5);
}

function pickAttack(rig) {
  let kind = Math.random() < JUMP_CHANCE ? 'jump' : 'peck';
  if (kind === rig.attack && rig.attackRepeat >= 1) kind = kind === 'jump' ? 'peck' : 'jump';
  rig.attackRepeat = kind === rig.attack ? rig.attackRepeat + 1 : 0;
  rig.attack = kind;
}
const ATTACK_WINDUP = 0.35;
const ATTACK_RECOVER = 0.5;
const ATTACK_BLEND = 12;
const JUMP_CHANCE = 0.5;
const JUMP_HEIGHT = 0.25;
const JUMP_AIR = [-0.14, 0.28];
const AIR_HOCK = 0.3;
const RAKE_GAP = 0.12;
const SCRATCH_HIP = 0.6;
const SCRATCH_KNEE = 0.6;
const SCRATCH_TOE = 0.6;
const SCRATCH_ROLL = 0.06;
const ATTACK_START = -ATTACK_WINDUP;
const ATTACKS = {
  peck: {
    neck: [[ATTACK_START, 0], [-0.06, -0.6], [0, -0.55], [0.06, 0.95], [0.18, 0.9], [0.5, 0]],
    head: [[ATTACK_START, 0], [-0.06, 0.15], [0, 0.15], [0.06, -0.35], [0.18, -0.32], [0.5, 0]],
    jaw: [[ATTACK_START, 0], [-0.1, 0.53], [0.02, 0.53], [0.06, -0.12], [0.18, -0.1], [0.4, 0]],
    lean: [[ATTACK_START, 0], [-0.06, -0.08], [0.06, 0.14], [0.18, 0.13], [0.5, 0]],
    crouch: [[ATTACK_START, 0], [-0.06, 0.25], [0.06, 0.4], [0.18, 0.38], [0.5, 0]],
    tail: [[ATTACK_START, 0], [-0.06, -0.3], [0.06, 0.5], [0.5, 0]],
  },
  jump: {
    neck: [[ATTACK_START, 0], [-0.2, 0.15], [-0.06, -0.35], [0.04, -0.5], [0.25, -0.1], [0.32, 0.25], [0.5, 0]],
    head: [[ATTACK_START, 0], [-0.06, -0.15], [0.1, -0.2], [0.32, 0.1], [0.5, 0]],
    jaw: [[ATTACK_START, 0], [-0.1, 0.4], [0.1, 0.45], [0.3, 0]],
    lean: [[ATTACK_START, 0], [-0.2, 0.12], [-0.06, -0.1], [0.04, -0.3], [0.2, -0.1], [0.32, 0.12], [0.5, 0]],
    crouch: [[ATTACK_START, 0], [-0.2, 0.9], [-0.14, 0], [0.25, 0], [0.32, 0.7], [0.5, 0]],
    hip: [[-0.2, 0], [-0.06, 0.5], [0.22, 0.5], [0.28, 0]],
    knee: [[-0.2, 0], [-0.06, 1], [-0.02, 0.6], [0.22, 0.6], [0.28, 0]],
    toe: [[-0.2, 0], [-0.06, -0.4], [0.22, -0.3], [0.28, 0]],
    rake: [[-0.1, 0], [-0.03, 1], [0.05, -0.6], [0.1, 0]],
    tail: [[ATTACK_START, 0], [-0.2, -0.35], [-0.08, 0.45], [0.04, -0.35], [0.2, 0.15], [0.32, 0.45], [0.5, 0]],
  },
};
const STRIKES = {
  peck: { sound: 'beak', times: [0] },
  jump: { sound: 'claws', times: [0, RAKE_GAP] },
};
const TAIL_ATTACK_LAG = 0.05;
const HIT_RISE = 0.05;
const HIT_SECONDS = 0.45;
const HIT_NECK = -0.35;
const HIT_HEAD = -0.2;
const HIT_LEAN = -0.12;
const HIT_CROUCH = 0.3;
const HIT_TAIL = 0.35;
const HIT_JAW = 0.3;
const HIT_TWIST = 0.15;
const BODY_DEAD = 0.22;
const DEATH_CURL_SECONDS = 0.7;
const DEATH_THROW = [[0, 0], [0.12, 1], [0.45, 0]];
const DEATH_NECK_THROW = -0.45;
const DEATH_NECK = 0.7;
const DEATH_HEAD_THROW = -0.3;
const DEATH_HEAD = 0.3;
const DEATH_JAW_THROW = 0.4;
const DEATH_JAW = 0.15;
const DEATH_HIP = 0.5;
const DEATH_KNEE = 1.1;
const DEATH_TOE = 0.8;
const DEATH_TAIL = -0.25;
const DEATH_FADE = 3;
const DEATH_KICK = 0.5;
const DEATH_KICK_SPEED = 9;
const DEATH_FLICK = 0.15;
const DEATH_FLICK_SPEED = 14;
const NECK_ALERT = -0.25;
const HEAD_SHARE = 0.55;
const JAW_IDLE = 0.02;
const JAW_ALERT = 0.12;
const JAW_WIDE = 0.55;
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

function signOf(value) {
  return value < 0 ? -1 : 1;
}

function legRig(mesh, bones, spec, scale) {
  const hipBone = findBone(bones, spec.hip);
  const kneeBone = findBone(bones, spec.knee);
  const hockBone = findBone(bones, spec.hock);
  const footBone = findBone(bones, spec.foot);
  const toeBone = findBone(bones, spec.toe);
  if (!hipBone || !kneeBone || !hockBone || !footBone) return null;
  const hip = axisEntry(hipBone, { swing: SIDE_AXIS, yaw: UP_AXIS, roll: FORWARD_AXIS });
  const knee = axisEntry(kneeBone, { bend: SIDE_AXIS });
  const hock = axisEntry(hockBone, { bend: SIDE_AXIS });
  const foot = toeBone ? axisEntry(footBone, { bend: SIDE_AXIS }) : null;
  if (!hip || !knee || !hock) return null;
  const reach = probeAxis(mesh, hipBone, hip.keys.swing, hockBone, PROBE_ANGLE);
  const full = probeAxis(mesh, hipBone, hip.keys.swing, footBone, PROBE_ANGLE);
  const fold = probeAxis(mesh, kneeBone, knee.keys.bend, footBone, PROBE_ANGLE);
  const curl = foot ? probeAxis(mesh, footBone, foot.keys.bend, toeBone, PROBE_ANGLE) : null;
  if (!reach) return null;
  const hockReach = (Math.abs(reach.z) / PROBE_ANGLE) * scale;
  const footReach = full ? (Math.abs(full.z) / PROBE_ANGLE) * scale : hockReach;
  return {
    id: spec.id,
    bone: hipBone,
    hip,
    knee,
    hock,
    foot,
    offset: spec.offset,
    side: signOf(bindPosition(hipBone).x),
    forward: signOf(reach.z),
    kneeUp: fold ? signOf(fold.y) : 1,
    toeUp: curl ? signOf(curl.y) : 1,
    reach: footReach,
    planted: hockReach * HOCK_FOLLOW + footReach * (1 - HOCK_FOLLOW),
    amplitude: 0,
  };
}

function build(mesh, skeleton) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const skull = findBone(bones, BONES.skull);
  const jaw = findBone(bones, BONES.jaw);
  const neckTop = findBone(bones, BONES.neckTop);
  if (skull && neckTop) reparent(skull, neckTop);
  if (jaw && skull) reparent(jaw, skull);

  const scale = worldScale(mesh);
  const legs = LEGS.map((spec) => legRig(mesh, bones, spec, scale)).filter(Boolean);
  if (!legs.length) return null;
  const reaches = legs.map((leg) => leg.reach).filter((reach) => reach > 0.05);
  const reach = reaches.length ? reaches.reduce((sum, value) => sum + value, 0) / reaches.length : 0.7;
  const stride = STRIDE_REACH * reach;
  for (const leg of legs) {
    leg.amplitude = (stride * STANCE_SHARE) / (2 * (leg.planted > 0.05 ? leg.planted : reach));
  }

  const body = partEntries(bones, [{ bone: BONES.root, share: 1 }], { pitch: SIDE_AXIS, roll: FORWARD_AXIS, yaw: UP_AXIS });
  const rootBone = findBone(bones, BONES.root);
  const lean = body.length && neckTop ? probeAxis(mesh, rootBone, body[0].keys.roll, neckTop, PROBE_ANGLE) : null;
  const twist = body.length ? probeAxis(mesh, rootBone, body[0].keys.yaw, legs[0].bone, PROBE_ANGLE) : null;
  const nod = body.length && neckTop ? probeAxis(mesh, rootBone, body[0].keys.pitch, neckTop, PROBE_ANGLE) : null;
  const neck = partEntries(
    bones,
    BONES.neck.map((bone, index) => ({ bone, share: NECK_SHARE[index] })),
    { pitch: SIDE_AXIS, yaw: UP_AXIS, roll: FORWARD_AXIS },
  );
  const tail = partEntries(
    bones,
    BONES.tail.map((bone, index) => ({ bone, share: TAIL_SHARE[index] })),
    { sway: UP_AXIS, lift: SIDE_AXIS },
  );
  const head = skull ? axisEntry(skull, { pitch: SIDE_AXIS, roll: FORWARD_AXIS }) : null;
  const jawEntry = jaw ? axisEntry(jaw, { open: SIDE_AXIS }) : null;
  const jawHinge = jawEntry ? calibrateHinge(mesh, jawEntry, JAW_PROBE) : null;
  const mouth = skull ? addMouth(mesh, skull) : null;
  if (mouth) mouth.setEnabled(false);
  const jawNote = jawHinge
    ? `, čelist (${jawHinge.mode}/${jawHinge.sign > 0 ? '+' : '-'}, dolů o ${jawHinge.drop.toFixed(3)})`
    : ', bez čelisti';
  const signs = (leg) => `${leg.forward > 0 ? '+' : '-'}${leg.kneeUp > 0 ? '+' : '-'}${leg.toeUp > 0 ? '+' : '-'}`;
  console.info(`[koa-tiki] nohy: ${legs.map((leg) => `${leg.id}(${signs(leg)}, rozkmit ${leg.amplitude.toFixed(2)})`).join(', ')}; krok ${stride.toFixed(2)} m; ocas: ${tail.length}; krk: ${neck.length}; ${head ? 'lebka' : 'bez lebky'}${jawNote}${mouth ? ', tlama' : ''}`);

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
    stride,
    leanSign: lean ? signOf(lean.x) : 1,
    twistSign: twist ? signOf(twist.z) : 1,
    noseSign: nod ? -signOf(nod.y) : 1,
    time: 0,
    phase: 0,
    speed: 0,
    swing: 0,
    pitch: 0,
    neckPitch: 0,
    jaw: JAW_IDLE,
    attack: null,
    attackRepeat: 0,
    attackTime: Infinity,
    attackWeight: 0,
    hitAge: Infinity,
    hitSide: 1,
    deadTime: 0,
    tailPhase: 0,
    tailAmount: TAIL_IDLE,
    idleAction: restAction(Math.random() * REST_SECONDS[1]),
    rakeFoot: 0,
    idle: Object.fromEntries(IDLE_CHANNELS.map((channel) => [channel, 0])),
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
  const dead = mode === 'dead';
  const stepping = !dead && (moving || turning);
  const travelled = moving && Number.isFinite(info && info.moved) ? Math.max(0, info.moved) : 0;
  const turnStep = !moving && stepping ? TURN_CYCLE * seconds : 0;
  rig.speed = approach(rig.speed, seconds > 0 ? travelled / seconds : 0, seconds, SPEED_FOLLOW);
  rig.phase = (rig.phase + (rig.speed * seconds) / rig.stride + turnStep) % 1;
  rig.swing = approach(rig.swing, stepping ? (moving ? 1 : TURN_SWING) : 0, seconds, SPEED_BLEND);
  if (mode !== rig.lastMode) {
    if (mode === 'windup') {
      pickAttack(rig);
      rig.attackTime = -ATTACK_WINDUP;
    }
    rig.lastMode = mode;
  }
  const attackBefore = rig.attackTime;
  rig.attackTime += seconds;
  const attacking = !dead && (mode === 'windup' || mode === 'recover');
  const strikes = rig.attack ? STRIKES[rig.attack] : null;
  let sound = attacking && strikes && strikes.times.some((at) => at > attackBefore && at <= rig.attackTime)
    ? strikes.sound
    : null;
  rig.attackWeight = approach(rig.attackWeight, attacking ? 1 : 0, seconds, ATTACK_BLEND);
  const moves = rig.attack ? ATTACKS[rig.attack] : null;
  const attackTime = rig.attackTime;
  const attackWeight = moves ? rig.attackWeight : 0;
  const act = (key, delay = 0) => (moves ? track(moves[key], attackTime - delay) * attackWeight : 0);
  if (info && info.hit && !dead) {
    rig.hitAge = 0;
    rig.hitSide = Math.random() < 0.5 ? -1 : 1;
  }
  rig.hitAge += seconds;
  rig.deadTime = dead ? rig.deadTime + seconds : 0;

  let pitchTarget = 0;
  let neckTarget = 0;
  let jawTarget = JAW_IDLE;
  if (dead) {
    pitchTarget = BODY_DEAD;
    jawTarget = 0;
  } else if (mode === 'alert') {
    neckTarget = NECK_ALERT;
    jawTarget = JAW_ALERT;
  }

  rig.pitch = approach(rig.pitch, pitchTarget, seconds, SPEED_BODY);
  rig.neckPitch = approach(rig.neckPitch, neckTarget, seconds, SPEED_NECK);
  rig.jaw = approach(rig.jaw, jawTarget, seconds, SPEED_JAW);
  rig.tailAmount = approach(rig.tailAmount, dead ? 0 : moving ? TAIL_WALK : TAIL_IDLE, seconds, SPEED_TAIL);
  rig.tailPhase += TAIL_SPEED * seconds;

  const idleOk = !dead && !moving && !turning && mode !== 'windup' && mode !== 'alert'
    && mode !== 'recover' && mode !== 'chase';
  if (idleOk) {
    const before = rig.idleAction.time;
    rig.idleAction.time += seconds;
    const taps = rig.idleAction.taps;
    if (taps && taps.some((tap) => tap > before && tap <= rig.idleAction.time)) sound = 'peck';
    if (rig.idleAction.time >= rig.idleAction.duration) rig.idleAction = nextIdleAction(rig.idleAction.kind);
  } else if (rig.idleAction.kind !== 'rest' || rig.idleAction.time > 0) {
    rig.idleAction = restAction();
  }
  const idleGoal = idleOk ? idleTargets(rig.idleAction) : null;
  for (const channel of IDLE_CHANNELS) {
    const goal = idleGoal ? idleGoal[channel] : 0;
    rig.idle[channel] = approach(rig.idle[channel], goal, seconds, idleOk ? SPEED_IDLE_FOLLOW : SPEED_IDLE);
  }
  const idle = rig.idle;

  const hit = hitCurve(rig.hitAge);
  const curl = dead ? smoothStep(rig.deadTime / DEATH_CURL_SECONDS) : 0;
  const thrown = dead ? track(DEATH_THROW, rig.deadTime) : 0;
  const fade = dead ? Math.pow(Math.max(0, 1 - rig.deadTime / DEATH_FADE), 2) * curl : 0;
  const calm = 1 - attackWeight;
  const neck = rig.neckPitch + idle.neck * calm + act('neck') + HIT_NECK * hit
    + DEATH_NECK_THROW * thrown + DEATH_NECK * curl;
  const neckYaw = Math.sin(rig.tailPhase * 0.6) * 0.05 + idle.yaw + HIT_TWIST * hit * rig.hitSide;
  const jaw = rig.jaw + idle.jaw * calm + act('jaw') + HIT_JAW * hit + DEATH_JAW_THROW * thrown + DEATH_JAW * curl;
  const lean = (idle.lean * calm + act('lean') + HIT_LEAN * hit) * rig.noseSign;
  const swing = rig.swing;
  const lead = rig.legs[0];
  const leadAngle = (rig.phase + lead.offset) * Math.PI * 2;
  const weight = Math.cos(leadAngle - STANCE_SHARE * Math.PI);
  const idleRoll = dead ? 0 : Math.sin(rig.time * IDLE_ROLL_SPEED) * IDLE_ROLL * (1 - swing);
  const rakes = rig.legs.map((leg, index) => act('rake', index * RAKE_GAP));
  if (rig.idleAction.kind === 'peck') rig.rakeFoot = rig.idleAction.foot;
  const rakeLeg = rig.legs[rig.rakeFoot] || lead;
  const bodyRoll = (weight * BODY_ROLL * swing * lead.side + idleRoll
    - ((rakes[0] || 0) - (rakes[1] || 0)) * SCRATCH_ROLL * lead.side
    - idle.shift * calm * RAKE_SHIFT * rakeLeg.side) * rig.leanSign;
  const bodyYaw = Math.cos(leadAngle) * BODY_YAW * swing * rig.twistSign;
  for (const entry of rig.body) {
    turnEntry(entry, { pitch: (rig.pitch + lean) * entry.share, roll: bodyRoll * entry.share, yaw: bodyYaw * entry.share });
  }
  for (const entry of rig.neck) {
    turnEntry(entry, {
      pitch: neck * entry.share,
      yaw: (neckYaw - bodyYaw * NECK_STEADY) * entry.share,
      roll: -bodyRoll * NECK_STEADY * entry.share,
    });
  }
  if (rig.head) {
    turnEntry(rig.head, {
      pitch: neck * HEAD_SHARE + idle.head * calm + act('head') + HIT_HEAD * hit
        + DEATH_HEAD_THROW * thrown + DEATH_HEAD * curl,
      roll: idle.tilt * calm,
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
  const tailSway = rig.tailAmount * (0.65 - 0.15 * swing);
  const tailLift = rig.tailAmount * (0.45 + 0.15 * swing);
  rig.tail.forEach((entry, index) => {
    const lag = index * TAIL_LAG;
    const idleSway = Math.sin(rig.tailPhase - lag);
    const walkSway = -Math.cos(leadAngle - lag) * rig.twistSign;
    const idleLift = Math.sin(rig.tailPhase + 1.1 - lag);
    const walkLift = Math.sin(leadAngle + 1.1 - lag);
    const delay = index * TAIL_ATTACK_LAG;
    const flick = Math.sin(rig.deadTime * DEATH_FLICK_SPEED - index * 0.8) * DEATH_FLICK * fade;
    turnEntry(entry, {
      sway: (idleSway + (walkSway - idleSway) * swing) * tailSway * entry.share,
      lift: ((idleLift + (walkLift - idleLift) * swing) * tailLift
        + idle.tail * calm
        + act('tail', delay)
        + HIT_TAIL * hitCurve(rig.hitAge - delay)
        + DEATH_TAIL * curl + flick) * entry.share,
    });
  });

  const crouch = idle.crouch * calm + act('crouch') + HIT_CROUCH * hit;
  const attackHip = act('hip');
  const attackKnee = act('knee');
  const attackToe = act('toe');
  rig.legs.forEach((leg, index) => {
    const legPhase = (rig.phase + leg.offset) % 1;
    const lift = dead ? 0 : stepLift(legPhase, STANCE_SHARE) * swing;
    const step = dead ? 0 : stepSwing(legPhase, STANCE_SHARE) * leg.amplitude * swing;
    const kick = Math.pow(Math.max(0, Math.sin(rig.deadTime * DEATH_KICK_SPEED + index * 2.1)), 4) * DEATH_KICK * fade;
    const hipStep = leg.forward * (step + HIP_LIFT * lift);
    const kneeStep = leg.kneeUp * KNEE_LIFT * lift;
    const hipCrouch = leg.forward * CROUCH_THIGH * crouch;
    const kneeCrouch = leg.kneeUp * CROUCH_KNEE * crouch;
    const rake = rakes[index];
    const ground = leg === rakeLeg ? idle.rake * calm : 0;
    const hipAir = leg.forward * (attackHip + SCRATCH_HIP * rake + RAKE_HIP * ground + DEATH_HIP * curl + kick * 0.5);
    const kneeAir = leg.kneeUp * (attackKnee - SCRATCH_KNEE * rake + RAKE_KNEE * Math.max(0, ground)
      + DEATH_KNEE * curl - kick);
    const walkBend = hipStep + kneeStep;
    turnEntry(leg.hip, { swing: hipStep + hipCrouch + hipAir - lean, yaw: -bodyYaw, roll: -bodyRoll });
    turnEntry(leg.knee, { bend: kneeStep + kneeCrouch + kneeAir });
    turnEntry(leg.hock, {
      bend: -(hipCrouch + kneeCrouch) - walkBend * HOCK_FOLLOW * (1 - HOCK_RELEASE * lift) - (hipAir + kneeAir) * AIR_HOCK,
    });
    if (leg.foot) {
      turnEntry(leg.foot, {
        bend: -walkBend * (1 - HOCK_FOLLOW) * (1 - lift) - leg.toeUp * TOE_CURL * lift
          + leg.toeUp * (attackToe + SCRATCH_TOE * rake + RAKE_TOE * ground - DEATH_TOE * curl),
      });
    }
  });

  if (dead) return { bob: 0 };
  const walkBob = Math.cos((leadAngle - STANCE_SHARE * Math.PI) * 2) * BOB;
  const idleBob = Math.sin(rig.time * IDLE_SPEED) * IDLE_BOB;
  const bob = idleBob + (walkBob - idleBob) * swing;
  const jump = rig.attack === 'jump' ? jumpLift(attackTime) * JUMP_HEIGHT * rig.stride * attackWeight : 0;
  return { bob: bob - CROUCH_DROP * rig.stride * crouch + jump, sound };
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
  sounds: {
    alert: 'koaAlert',
    charge: 'koaGrowl',
    beak: 'koaBeak',
    claws: 'koaClaws',
    hit: 'koaHit',
    death: 'koaDeath',
    idle: 'koaChirp',
    peck: 'koaPeck',
  },
  length: 1.9,
  scale: 0.8,
  yawOffset: Math.PI,
  walkSpeed: 1.4,
  slopeTilt: 0,
  chaseBoost: 1.6,
  turnRate: 4.5,
  aggroRange: 6,
  chargeRange: 2,
  damageType: 'slashing',
  armor: 0,
  resistances: {},
  regenPerSecond: 0.33,
  biteRange: 1.3,
  biteArc: 100,
  biteLunge: 1,
  biteWindup: ATTACK_WINDUP,
  biteCooldown: 1.4,
  biteRecover: ATTACK_RECOVER,
  confusedSeconds: 1.2,
  roamRadius: 2,
  entersCaves: true,
  respawnDays: 6,
  idleSeconds: [16, 30],
  idleCallSeconds: [8, 20],
  defaultTier: 'adult',
  deathSeconds: 0.6,
  loot: { meat: 2 },
  tiers: {
    young: {
      label: 'Mladý',
      scale: 0.72,
      tint: [1, 0.94, 0.84],
      health: 28,
      bite: [4, 6],
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
      bite: [6, 10],
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
      bite: [9, 15],
      attack: 22,
      defense: 15,
      speed: 0.85,
      aggroRange: 6.5,
    },
  },
};

