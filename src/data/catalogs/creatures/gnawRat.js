// Hryzokrysa — přerostlá krysa z jeskyní a jejich okolí; všechna její data i rig na jednom místě.
// Chůze, běh, varování, útok, smrt a sednutí jsou hotové animace z modelu; čenichání, rozhlížení,
// švihání ocasem vsedě a ucuknutí po ráně se k nim přidávají v kódu přes pojmenované kosti.
import { Quaternion } from '@babylonjs/core/Maths/math.vector';
import { ASSET_DIRS } from '../assetPaths.js';
import {
  SIDE_AXIS, UP_AXIS, FORWARD_AXIS,
  findBone, axisEntry, partEntries, turnEntry, approach, worldScale, probeAxis,
} from '../../../utils/proceduralRig.js';
import { extractClips, restPose, blendPose } from '../../../utils/clipSampler.js';

const MODEL = `${ASSET_DIRS.creatures}gnaw_rat/gnaw_rat.glb`;
const CLIPS = {
  walk: 'dog_walk',
  run: 'dog_run',
  alert: 'wolf_alert',
  attack: 'leopard_skill2',
  dead: 'wolf_dead',
  sit: 'dog_beifumo',
};
const BONES = {
  spine: [{ bone: 'spine_02', share: 0.45 }, { bone: 'spine2', share: 0.35 }, { bone: 'spine_04', share: 0.2 }],
  neck: [{ bone: 'neck_01', share: 0.3 }, { bone: 'neck_02', share: 0.25 }, { bone: 'neck1', share: 0.25 }, { bone: 'neck2', share: 0.2 }],
  root: 'root',
  head: 'head',
  tail: ['tail_01', 'tail1', 'tail_03', 'tail2', 'tail_05', 'tail3', 'tail_07', 'tail4', 'tail_09', 'tail_10'],
};
const TAIL_SHARE = [0.5, 0.6, 0.8, 0.9, 1, 1, 1, 1, 0.9, 0.8];
const LEGS = [
  { id: 'fl', front: true, upper: 'frontUpr.L', mid: 'frontLwr.L', low: 'frontHorselink.L', paw: 'frontFoot.L', toe: 'frontToe.L' },
  { id: 'fr', front: true, upper: 'frontUpr.R', mid: 'frontLwr.R', low: 'frontHorselink.R', paw: 'frontFoot.R', toe: 'frontToe.R' },
  { id: 'bl', front: false, upper: 'rearLeg.L_01', mid: 'rearLwr.L', low: 'rearHorselink.L', paw: 'rearFoot.L', toe: 'rearToe.L' },
  { id: 'br', front: false, upper: 'rearLeg.R_01', mid: 'rearLwr.R', low: 'rearHorselink.R', paw: 'rearFoot.R', toe: 'rearToe.R' },
];
const PROBE_ANGLE = 0.1;
const WALK_CYCLE = 0.27;
const RUN_CYCLE = 0.47;
const RUN_FROM = 1.2;
const RUN_TO = 2;
const SPEED_FOLLOW = 8;
const LOCO_FOLLOW = 7;
const RUN_FOLLOW = 4;
const TURN_CYCLE = 1.4;
const TURN_SWING = 0.6;
const ATTACK_WINDUP = 0.4;
const ATTACK_RECOVER = 0.7;
const ATTACK_CLIP = { from: 0.6, strike: 1.3, to: 1.34 };
const ATTACK_LAND = 0.3;
const ATTACK_SETTLE = 0.7;
const ATTACK_TAIL = 0.5;
const ATTACK_FRONT = { upper: -0.8, mid: 0.6, low: -0.2 };
const ATTACK_COIL = 3;
const ATTACK_LEAP = { lift: 0.06, pitch: 0.35, rise: 0.2, fall: 0.3 };
const WALK_TAIL = 0.14;
const ALERT_TAIL = 0.2;
const CLIP_RAISE = { alert: 0.025, dead: 0.065 };
const CLIP_FADE = 0.6;
const DEAD_TAIL = 0.6;
const DEAD_TAIL_SECONDS = [0.4, 0.8];
const ATTACK_BLEND = 12;
const ALERT_BLEND = 6;
const DEAD_BLEND = 12;
const DIP = { spine: 0.35, upper: 0.03, mid: 1, low: -0.675 };
const STAND = { alert: 0.4, alertTime: 0 };
const SIT_CLIP = { dropShare: 0.6, hold: 2.4, holdIn: [1.5, 2], holdOut: [5.3, 5.8], tailIn: [1, 1.7], tailOut: [5.5, 6.1], hunch: 0.45, pauseAt: 3, pause: [3, 6] };
const SIT_LASH = { speed: 5, amount: 0.35, pulse: 0.9 };
const SIT_TAIL = [1.1, 0.35, -0.1, -0.15, -0.15, -0.15, -0.1, -0.05, 0, 0];
const SIT_FRONT = { upper: 0.6, mid: 0, low: -0.4, paw: 0 };
const NECK_REAR_CANCEL = 0.6;
const SNIFF = { rate: 7, twitch: 0.05, reach: 0.12, on: [0.4, 0.9], off: [0.25, 0.6], turn: 0.15, follow: 10 };
const TAIL_LAG = 0.45;
const TAIL_SPEED = 1.4;
const TAIL_SWAY = 0.05;
const TAIL_CLIP_SHARE = 0.4;
const CHANNELS = ['rear', 'dip', 'neck', 'head', 'yaw', 'sniff', 'tail'];
const MODE_POSE = {
  confused: { neck: 0.12, sniff: 1 },
};
const MODE_FOLLOW = 7;
const IDLE_FOLLOW = 6;
const IDLE_RELEASE = 6;
const REST_SECONDS = [1.2, 2.8];
const IDLE_CHANCES = [
  { kind: 'sit', upTo: 0.12 },
  { kind: 'sniff', upTo: 0.45 },
  { kind: 'look', upTo: 0.65 },
];
const NO_REPEAT = new Set(['sit', 'sniff']);
const HIT_RISE = 0.04;
const HIT_SECONDS = 0.4;
const HIT = { neck: 0.35, head: 0.2, rear: 0.12, tail: 0.3, yaw: 0.25 };

function smoothStep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function between([low, high]) {
  return low + Math.random() * (high - low);
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

function hitCurve(time) {
  if (!(time < HIT_RISE + HIT_SECONDS)) return 0;
  if (time < HIT_RISE) return smoothStep(time / HIT_RISE);
  const u = (time - HIT_RISE) / HIT_SECONDS;
  return (1 - u) * (1 - u) * Math.cos(u * Math.PI * 1.5);
}

function session(kind) {
  const keys = {};
  for (const channel of CHANNELS) keys[channel] = [[0, 0]];
  let time = 0;
  const put = (seconds, values = {}) => {
    time += seconds;
    for (const channel of CHANNELS) {
      const last = keys[channel][keys[channel].length - 1][1];
      keys[channel].push([time, Number.isFinite(values[channel]) ? values[channel] : last]);
    }
  };
  const rest = Object.fromEntries(CHANNELS.map((channel) => [channel, 0]));
  return { put, rest, done: () => ({ kind, time: 0, duration: time, keys }) };
}

function sitAction(rig) {
  const clip = rig.clips.sit;
  if (!clip) return restAction();
  const pause = between(SIT_CLIP.pause);
  const { put, done } = session('sit');
  let side = Math.random() < 0.5 ? -1 : 1;
  put(SIT_CLIP.holdIn[1]);
  put(0.4, { sniff: 1, head: 0.25 });
  const looks = Math.max(2, Math.round((SIT_CLIP.pauseAt - SIT_CLIP.holdIn[1] + pause) / 1.2));
  for (let look = 0; look < looks; look += 1) {
    put(between([0.8, 1.4]), { yaw: between([0.2, 0.5]) * side, head: between([0.1, 0.45]) });
    side = -side;
  }
  put(0.5, { sniff: 0, yaw: 0, head: 0 });
  return { ...done(), clip, pause, duration: clip.duration + pause };
}

function clipTime(action) {
  const pause = action.pause || 0;
  if (action.time < SIT_CLIP.pauseAt) return action.time;
  return Math.max(SIT_CLIP.pauseAt, action.time - pause);
}

function sniffSession() {
  const { put, rest, done } = session('sniff');
  let side = Math.random() < 0.5 ? -1 : 1;
  put(0.4, { dip: 1, neck: -0.7, head: -0.15 });
  put(0.2, { sniff: 1 });
  const sweeps = Math.round(between([2, 4]));
  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    put(between([0.5, 0.9]), { yaw: between([0.15, 0.4]) * side, neck: -0.6 - Math.random() * 0.15 });
    side = -side;
  }
  put(0.35, { sniff: 0, yaw: 0, dip: 0.3, neck: -0.3, head: 0 });
  put(0.3, rest);
  return done();
}

function lookSession() {
  const { put, rest, done } = session('look');
  const side = Math.random() < 0.5 ? -1 : 1;
  put(0.35, { neck: 0.15, yaw: 0.5 * side });
  put(between([0.4, 0.9]), { sniff: 0.6 });
  put(0.45, { yaw: -0.45 * side, sniff: 0 });
  put(between([0.3, 0.7]));
  put(0.4, rest);
  return done();
}

function restAction(seconds = between(REST_SECONDS)) {
  return { kind: 'rest', time: 0, duration: seconds };
}

const SESSIONS = { sit: sitAction, sniff: sniffSession, look: lookSession };

function nextIdleAction(rig, last) {
  const roll = Math.random();
  const pick = IDLE_CHANCES.find((entry) => roll < entry.upTo);
  if (!pick || (pick.kind === last && NO_REPEAT.has(last))) return restAction();
  return SESSIONS[pick.kind](rig);
}

function legRig(bones, spec) {
  return {
    id: spec.id,
    front: spec.front,
    upper: axisEntry(findBone(bones, spec.upper), { swing: SIDE_AXIS }),
    mid: axisEntry(findBone(bones, spec.mid), { swing: SIDE_AXIS }),
    low: axisEntry(findBone(bones, spec.low), { swing: SIDE_AXIS }),
    paw: axisEntry(findBone(bones, spec.paw), { swing: SIDE_AXIS }),
  };
}

function forwardSign(mesh, bones) {
  const upper = findBone(bones, LEGS[0].upper);
  const toe = findBone(bones, LEGS[0].toe);
  const entry = upper ? axisEntry(upper, { swing: SIDE_AXIS }) : null;
  const probe = entry && toe ? probeAxis(mesh, upper, entry.keys.swing, toe, PROBE_ANGLE) : null;
  return probe && probe.z < 0 ? -1 : 1;
}

function build(mesh, skeleton, animationGroups) {
  if (!mesh || !skeleton || !Array.isArray(skeleton.bones)) return null;
  const bones = skeleton.bones;
  const scale = worldScale(mesh);
  const clips = extractClips(animationGroups, CLIPS);
  const missing = Object.keys(CLIPS).filter((key) => !clips[key]);
  if (missing.length) console.warn(`[gnaw_rat] v modelu chybí animace: ${missing.map((key) => CLIPS[key]).join(', ')}`);
  const axes = { pitch: SIDE_AXIS, yaw: UP_AXIS, roll: FORWARD_AXIS };
  const headBone = findBone(bones, BONES.head);
  const rootBone = findBone(bones, BONES.root);
  const legs = LEGS.map((spec) => legRig(bones, spec));
  const rig = {
    clips,
    scale,
    forward: forwardSign(mesh, bones),
    spine: partEntries(bones, BONES.spine, axes),
    neck: partEntries(bones, BONES.neck, axes),
    head: headBone ? axisEntry(headBone, axes) : null,
    root: rootBone ? axisEntry(rootBone, axes) : null,
    tail: partEntries(
      bones,
      BONES.tail.map((bone, index) => ({ bone, share: TAIL_SHARE[index] })),
      { sway: UP_AXIS, lift: SIDE_AXIS },
    ),
    legs,
    frontNodes: new Set(LEGS.filter((spec) => spec.front)
      .flatMap((spec) => [spec.upper, spec.mid, spec.low, spec.paw, spec.toe])
      .map((name) => findBone(bones, name)).filter(Boolean).map((bone) => bone.getTransformNode()).filter(Boolean)),
    walkCycle: WALK_CYCLE * scale,
    runCycle: RUN_CYCLE * scale,
    time: Math.random() * 10,
    phase: Math.random(),
    speed: 0,
    loco: 0,
    run: 0,
    tailPhase: Math.random() * Math.PI * 2,
    lastMode: null,
    attackTime: Infinity,
    attackWeight: 0,
    alertWeight: 0,
    alertTime: 0,
    deadWeight: 0,
    deadTime: 0,
    hitAge: Infinity,
    hitSide: 1,
    sniffGate: 0,
    sniffOn: false,
    sniffTimer: 0,
    sniffYaw: 0,
    sniffYawGoal: 0,
    idleAction: restAction(Math.random() * REST_SECONDS[1]),
    idle: Object.fromEntries(CHANNELS.map((channel) => [channel, 0])),
    stance: Object.fromEntries(CHANNELS.map((channel) => [channel, 0])),
  };
  const entries = [rig.root, ...rig.spine, ...rig.neck, rig.head, ...rig.tail,
    ...legs.flatMap((leg) => [leg.upper, leg.mid, leg.low, leg.paw])].filter(Boolean);
  rig.entryOf = new Map(entries.map((entry) => [entry.node, entry]));
  const nodes = bones.map((bone) => bone.getTransformNode()).filter(Boolean);
  rig.rest = restPose(nodes);
  rig.pose = restPose(nodes);
  for (const entry of entries) entry.base = rig.rest.get(entry.node).rotation.clone();
  return rig;
}

function idleGoals(action) {
  const goals = Object.fromEntries(CHANNELS.map((channel) => [channel, 0]));
  if (!action || !action.keys) return goals;
  for (const channel of CHANNELS) goals[channel] = track(action.keys[channel], action.time);
  return goals;
}

function updateIdle(rig, seconds, idleOk, leaving) {
  if (idleOk) {
    rig.idleAction.time += seconds;
    if (rig.idleAction.time >= rig.idleAction.duration) {
      rig.idleAction = leaving ? restAction() : nextIdleAction(rig, rig.idleAction.kind);
    }
  } else if (rig.idleAction.kind !== 'rest' || rig.idleAction.time > 0) {
    rig.idleAction = restAction();
  }
  const goals = idleOk ? idleGoals(rig.idleAction) : null;
  for (const channel of CHANNELS) {
    rig.idle[channel] = approach(rig.idle[channel], goals ? goals[channel] : 0, seconds, idleOk ? IDLE_FOLLOW : IDLE_RELEASE);
  }
}

function attackClipTime(time) {
  if (time < 0) return ATTACK_CLIP.from + Math.pow(1 + time / ATTACK_WINDUP, ATTACK_COIL) * (ATTACK_CLIP.strike - ATTACK_CLIP.from);
  const land = ATTACK_RECOVER * ATTACK_LAND;
  return Math.min(ATTACK_CLIP.to, ATTACK_CLIP.strike + (time / land) * (ATTACK_CLIP.to - ATTACK_CLIP.strike));
}

function attackLeap(time) {
  if (time < 0) return smoothStep((time + ATTACK_LEAP.rise) / ATTACK_LEAP.rise);
  return 1 - smoothStep(time / ATTACK_LEAP.fall);
}

function attackSettle(time) {
  return time > 0 ? 1 - smoothStep(time / (ATTACK_RECOVER * ATTACK_SETTLE)) : 1;
}

function clipFade(action) {
  if (!action || !action.clip) return 0;
  const left = action.duration - action.time;
  return smoothStep(Math.min(action.time, left) / CLIP_FADE);
}

function window(time, [inFrom, inTo], [outFrom, outTo]) {
  return smoothStep((time - inFrom) / (inTo - inFrom)) * (1 - smoothStep((time - outFrom) / (outTo - outFrom)));
}

function updateSniff(rig, seconds, sniff) {
  rig.sniffTimer -= seconds;
  if (rig.sniffTimer <= 0) {
    rig.sniffOn = !rig.sniffOn;
    rig.sniffTimer = between(rig.sniffOn ? SNIFF.on : SNIFF.off);
    if (!rig.sniffOn) rig.sniffYawGoal = (Math.random() * 2 - 1) * SNIFF.turn;
  }
  const goal = sniff > 0.01 && rig.sniffOn ? 1 : 0;
  rig.sniffGate = approach(rig.sniffGate, goal, seconds, SNIFF.follow);
  rig.sniffYaw = approach(rig.sniffYaw, sniff > 0.01 ? rig.sniffYawGoal : 0, seconds, SNIFF.follow * 0.4);
}

function applyPose(rig) {
  for (const [node, pose] of rig.pose) {
    const entry = rig.entryOf.get(node);
    if (entry) entry.base.copyFrom(pose.rotation);
    else if (node.rotationQuaternion) node.rotationQuaternion.copyFrom(pose.rotation);
    node.position.copyFrom(pose.position);
  }
}

function pose(rig, dt, info) {
  if (!rig) return { bob: 0 };
  const mode = info && info.mode ? info.mode : 'idle';
  const moving = Boolean(info && info.moving);
  const turning = Boolean(info && info.turning);
  const seconds = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const dead = mode === 'dead';
  rig.time += seconds;

  const travelled = moving && Number.isFinite(info && info.moved) ? Math.max(0, info.moved) : 0;
  rig.speed = approach(rig.speed, seconds > 0 ? travelled / seconds : 0, seconds, SPEED_FOLLOW);
  const stepping = !dead && (moving || turning);
  rig.loco = approach(rig.loco, stepping ? (moving ? 1 : TURN_SWING) : 0, seconds, LOCO_FOLLOW);
  const runGoal = Math.min(1, Math.max(0, (rig.speed - RUN_FROM) / (RUN_TO - RUN_FROM)));
  rig.run = approach(rig.run, runGoal, seconds, RUN_FOLLOW);
  const cycle = rig.walkCycle + (rig.runCycle - rig.walkCycle) * rig.run;
  const turnStep = !moving && stepping ? TURN_CYCLE * seconds : 0;
  rig.phase = (rig.phase + (rig.speed * seconds) / Math.max(0.01, cycle) + turnStep) % 1;

  if (mode !== rig.lastMode) {
    if (mode === 'windup') rig.attackTime = -ATTACK_WINDUP;
    rig.lastMode = mode;
  }
  rig.attackTime += seconds;
  const attacking = !dead && (mode === 'windup' || mode === 'recover');
  rig.attackWeight = approach(rig.attackWeight, attacking ? 1 : 0, seconds, ATTACK_BLEND);
  const attackWeight = rig.attackWeight * attackSettle(rig.attackTime);
  rig.alertWeight = approach(rig.alertWeight, !dead && mode === 'alert' ? 1 : 0, seconds, ALERT_BLEND);
  rig.alertTime = rig.alertWeight > 0.001 ? rig.alertTime + seconds : 0;
  rig.deadTime = dead ? rig.deadTime + seconds : 0;
  rig.deadWeight = approach(rig.deadWeight, dead ? 1 : 0, seconds, DEAD_BLEND);

  if (info && info.hit && !dead) {
    rig.hitAge = 0;
    rig.hitSide = Math.random() < 0.5 ? -1 : 1;
  }
  rig.hitAge += seconds;

  const idleOk = !dead && !moving && !turning && !attacking && mode !== 'alert' && !MODE_POSE[mode];
  updateIdle(rig, seconds, idleOk, Boolean(info && info.leaving));
  const modeGoal = dead ? null : MODE_POSE[mode];
  for (const channel of CHANNELS) {
    const goal = modeGoal && Number.isFinite(modeGoal[channel]) ? modeGoal[channel] : 0;
    rig.stance[channel] = approach(rig.stance[channel], goal, seconds, MODE_FOLLOW);
  }

  const { clips } = rig;
  const idleClip = rig.idleAction.clip ? rig.idleAction : null;
  const clipWeight = idleOk ? clipFade(idleClip) : 0;
  const leap = attacking ? attackLeap(rig.attackTime) : 0;
  const seated = Boolean(idleClip && idleClip.kind === 'sit');
  const sit = seated ? clipWeight * window(clipTime(idleClip), SIT_CLIP.holdIn, SIT_CLIP.holdOut) : 0;
  const sitTail = seated ? clipWeight * window(clipTime(idleClip), SIT_CLIP.tailIn, SIT_CLIP.tailOut) : 0;
  const tailShare = TAIL_CLIP_SHARE * (1 - Math.max(seated ? clipWeight : 0, attackWeight));
  const coil = attacking && rig.attackTime < 0 ? attackWeight * (1 - leap) : 0;
  const loop = (clip, time) => (clip ? time % clip.duration : 0);
  blendPose(rig.rest, rig.pose, [
    { clip: clips.alert, time: STAND.alertTime, weight: STAND.alert, inPlace: true, raise: CLIP_RAISE.alert },
    { clip: clips.walk, time: loop(clips.walk, rig.phase * (clips.walk ? clips.walk.duration : 0)), weight: rig.loco },
    { clip: clips.run, time: loop(clips.run, rig.phase * (clips.run ? clips.run.duration : 0)), weight: rig.loco * rig.run },
    { clip: idleClip && idleClip.clip, time: idleClip ? clipTime(idleClip) : 0, weight: clipWeight, inPlace: true, dropShare: seated ? SIT_CLIP.dropShare : undefined },
    { clip: clips.sit, time: SIT_CLIP.hold, weight: sit, inPlace: true, only: rig.frontNodes },
    { clip: clips.alert, time: loop(clips.alert, rig.alertTime), weight: rig.alertWeight, inPlace: true, raise: CLIP_RAISE.alert },
    { clip: clips.attack, time: attackClipTime(rig.attackTime), weight: attackWeight, inPlace: true, raise: ATTACK_LEAP.lift * leap },
    { clip: clips.dead, time: clips.dead ? Math.min(clips.dead.duration, rig.deadTime) : 0, weight: rig.deadWeight, inPlace: true, raise: CLIP_RAISE.dead },
  ]);
  for (const entry of rig.tail) {
    const posed = rig.pose.get(entry.node).rotation;
    Quaternion.SlerpToRef(rig.rest.get(entry.node).rotation, posed, tailShare, posed);
  }
  applyPose(rig);

  const hit = dead ? 0 : hitCurve(rig.hitAge);
  const mix = (channel) => rig.idle[channel] + rig.stance[channel];
  const rear = mix('rear') + HIT.rear * hit;
  const sniff = Math.min(1, mix('sniff'));
  const dip = Math.max(0, mix('dip'));
  const fwd = rig.forward;

  turnEntry(rig.root, { pitch: fwd * ATTACK_LEAP.pitch * leap * attackWeight });
  for (const entry of rig.spine) turnEntry(entry, { pitch: fwd * (rear - DIP.spine * dip - SIT_CLIP.hunch * sit) * entry.share });

  updateSniff(rig, seconds, sniff);
  const burst = sniff * rig.sniffGate;
  const sniffTwitch = Math.sin(rig.time * Math.PI * 2 * SNIFF.rate) * SNIFF.twitch * burst;
  const neckPitch = mix('neck') + HIT.neck * hit - rear * NECK_REAR_CANCEL + SNIFF.reach * burst;
  const neckYaw = mix('yaw') + HIT.yaw * hit * rig.hitSide + rig.sniffYaw * sniff;
  for (const entry of rig.neck) {
    turnEntry(entry, { pitch: fwd * neckPitch * entry.share, yaw: neckYaw * entry.share });
  }
  turnEntry(rig.head, { pitch: fwd * (mix('head') + HIT.head * hit + sniffTwitch) });

  rig.tailPhase += TAIL_SPEED * seconds;
  const own = Math.min(1, rig.loco + clipWeight + rig.alertWeight + attackWeight + rig.deadWeight);
  const tailLift = Math.max(0, mix('tail') + HIT.tail * hit) + ATTACK_TAIL * attackWeight + ALERT_TAIL * rig.alertWeight
    + DEAD_TAIL * rig.deadWeight * (1 - smoothStep((rig.deadTime - DEAD_TAIL_SECONDS[0]) / (DEAD_TAIL_SECONDS[1] - DEAD_TAIL_SECONDS[0])));
  rig.tail.forEach((entry, index) => {
    const lash = sitTail * SIT_LASH.amount * smoothStep(0.5 + Math.sin(rig.time * SIT_LASH.pulse));
    const sway = Math.sin(rig.tailPhase - index * TAIL_LAG) * TAIL_SWAY * (1 - own)
      + Math.sin(rig.phase * Math.PI * 2 - index * TAIL_LAG) * WALK_TAIL * rig.loco
      + Math.sin(rig.time * SIT_LASH.speed - index * TAIL_LAG) * lash;
    turnEntry(entry, {
      sway: sway * entry.share,
      lift: -fwd * ((index < 3 ? tailLift * entry.share : 0) + SIT_TAIL[index] * sitTail),
    });
  });

  rig.legs.forEach((leg) => {
    if (leg.front) {
      turnEntry(leg.upper, { swing: fwd * (DIP.upper * dip + SIT_FRONT.upper * sit + ATTACK_FRONT.upper * coil) });
      turnEntry(leg.mid, { swing: fwd * (DIP.mid * dip + SIT_FRONT.mid * sit + ATTACK_FRONT.mid * coil) });
      turnEntry(leg.low, { swing: fwd * (DIP.low * dip + SIT_FRONT.low * sit + ATTACK_FRONT.low * coil) });
      turnEntry(leg.paw, { swing: fwd * SIT_FRONT.paw * sit });
    } else {
      turnEntry(leg.upper, {});
      turnEntry(leg.mid, {});
      turnEntry(leg.low, {});
      turnEntry(leg.paw, {});
    }
  });

  return { bob: 0 };
}

function summary(rig) {
  if (!rig) return 'bez kostry';
  const clips = Object.keys(rig.clips).length;
  return `${rig.legs.length} nohy, páteř ${rig.spine.length}, krk ${rig.neck.length}, ocas ${rig.tail.length}, animací ${clips}/${Object.keys(CLIPS).length}`;
}

function busy(rig) {
  return Boolean(rig && rig.idleAction && rig.idleAction.kind !== 'rest');
}

export const gnawRatRig = { build, pose, busy, summary };

export const GNAW_RAT = {
  label: 'Hryzokrysa',
  model: MODEL,
  rig: gnawRatRig,
  sounds: {
    alert: 'ratAlert',
    charge: 'ratCharge',
    bite: 'ratBite',
    hit: 'ratHit',
    death: 'ratDeath',
    idle: 'ratIdle',
  },
  idleCallSeconds: [10, 24],
  length: 1.19,
  yawOffset: Math.PI,
  walkSpeed: 1,
  chaseBoost: 2.3,
  turnRate: 6,
  aggroRange: 6,
  chargeRange: 2,
  damageType: 'piercing',
  armor: 0,
  resistances: { piercing: 25, blunt: -25 },
  bestiary: {
    summary: 'Vychrtlá krysa velká jako pes, s řezáky, které prokousnou i kokosový ořech.',
    habitat: 'Jeskyně a stinné okraje lesa. Ráda se drží ve skupinách.',
    notes: 'Mrštné tělo se hrotem špatně trefuje, ale tupá rána jí snadno přerazí kosti. Když jedna varuje, ostatní bývají blízko.',
  },
  regenPerSecond: 0.2,
  biteRange: 0.81,
  biteArc: 80,
  biteLunge: 0.51,
  biteWindup: ATTACK_WINDUP,
  biteCooldown: 1.2,
  biteRecover: ATTACK_RECOVER,
  confusedSeconds: 1.6,
  roamRadius: 3,
  entersCaves: true,
  deathRoll: 0,
  footprint: {
    kind: 'gnaw_rat',
    scale: 0.85,
    stepDistance: 0.085,
    feet: [
      { side: -0.071, forward: 0.387 },
      { side: 0.068, forward: 0.387 },
      { side: -0.079, forward: 0.088 },
      { side: 0.073, forward: 0.088 },
    ],
    order: [0, 3, 1, 2],
  },
  respawnDays: 3,
  idleSeconds: [6, 14],
  defaultTier: 'adult',
  loot: { meat: 1 },
  tiers: {
    young: {
      label: 'Mladá',
      scale: 0.6,
      tint: [1, 0.96, 0.9],
      health: 12,
      bite: [2, 3],
      attack: 8,
      defense: 6,
      speed: 1.15,
      aggroRange: 4.5,
    },
    adult: {
      label: 'Dospělá',
      scale: 1,
      tint: [1, 1, 1],
      health: 24,
      bite: [3, 6],
      attack: 13,
      defense: 9,
      speed: 1,
      aggroRange: 6,
    },
    elder: {
      label: 'Stará',
      scale: 1.3,
      tint: [0.9, 0.88, 0.86],
      health: 45,
      bite: [6, 9],
      attack: 18,
      defense: 11,
      speed: 0.9,
      aggroRange: 6.5,
    },
  },
};
