// Společné pomocníky pro procedurální rigy tvorů — hledání kostí, osy kloubů,
// rest pozice a otáčení. Funguje pro jakýkoli model bez pojmenovaných kostí.
import { Quaternion, Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';

export const SIDE_AXIS = new Vector3(1, 0, 0);
export const UP_AXIS = new Vector3(0, 1, 0);
export const FORWARD_AXIS = new Vector3(0, 0, 1);

export function findBone(bones, name) {
  return bones.find((bone) => {
    const boneName = String(bone.name || '');
    return boneName === name || boneName.endsWith(`:${name}`);
  }) || null;
}

export function nodeOf(bone) {
  return bone && typeof bone.getTransformNode === 'function' ? bone.getTransformNode() : null;
}

export function bindMatrix(bone) {
  try {
    if (typeof bone.getAbsoluteMatrix === 'function') return bone.getAbsoluteMatrix();
    if (typeof bone.getBindMatrix === 'function') return bone.getBindMatrix();
  } catch (error) {
    return null;
  }
  return null;
}

export function bindPosition(bone) {
  const matrix = bindMatrix(bone);
  if (matrix && matrix.m) return new Vector3(matrix.m[12], matrix.m[13], matrix.m[14]);
  return bone.getAbsolutePosition().clone();
}

export function worldScale(mesh) {
  const chain = [];
  for (let node = mesh; node; node = node.parent) chain.unshift(node);
  for (const node of chain) node.computeWorldMatrix(true);
  const scale = Vector3.TransformNormal(FORWARD_AXIS, mesh.getWorldMatrix()).length();
  return Number.isFinite(scale) && scale > 1e-6 ? scale : 1;
}

export function restPosition(bone, mesh) {
  try {
    if (typeof bone.getAbsolutePosition === 'function') return bone.getAbsolutePosition(mesh).clone();
  } catch (error) {
    return null;
  }
  return null;
}

export function axisInParent(bone, source) {
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

export function axisEntry(bone, axes) {
  const node = nodeOf(bone);
  if (!node) return null;
  const base = node.rotationQuaternion
    ? node.rotationQuaternion.clone()
    : Quaternion.FromEulerVector(node.rotation);
  const keys = {};
  for (const key of Object.keys(axes)) keys[key] = axisInParent(bone, axes[key]);
  return { bone, node, base, keys };
}

export function entryOf(bone, axis = SIDE_AXIS) {
  const entry = axisEntry(bone, { swing: axis });
  if (!entry) return null;
  entry.axis = entry.keys.swing;
  return entry;
}

export function partEntries(bones, specs, axes) {
  const list = [];
  for (const spec of specs) {
    const bone = findBone(bones, spec.bone);
    if (!bone) continue;
    const entry = axisEntry(bone, axes);
    if (!entry) continue;
    entry.share = Number.isFinite(spec.share) ? spec.share : 1;
    list.push(entry);
  }
  return list;
}

export function legEntry(mesh, bones, spec, options = {}) {
  const rootBone = findBone(bones, spec.root);
  const tipBone = findBone(bones, spec.tip);
  const jointBone = findBone(bones, spec.joint);
  if (!rootBone || !tipBone) return null;
  const entry = entryOf(rootBone, options.swingAxis || UP_AXIS);
  if (!entry) return null;
  const swing = Number.isFinite(options.swing) ? options.swing : 0.3;
  const restFootMin = Number.isFinite(options.restFootMin) ? options.restFootMin : 0;
  entry.id = spec.id;
  entry.front = Boolean(spec.front);
  entry.phase = spec.phase;
  entry.amplitude = swing * (Number.isFinite(spec.swing) ? spec.swing : 1);
  entry.liftScale = spec.lift;
  const rise = Math.max(0, (Number.isFinite(spec.footZ) ? spec.footZ : restFootMin) - restFootMin);
  const legLength = Math.max(0.001, entry.length || 1);
  entry.restLift = -Math.asin(Math.min(0.8, rise / legLength));
  const root = restPosition(rootBone, mesh);
  const tip = restPosition(tipBone, mesh);
  entry.side = root && root.x < 0 ? -1 : 1;
  entry.length = root && tip ? Vector3.Distance(root, tip) : 0;
  if (root && tip) {
    const direction = tip.subtract(root);
    direction.y = 0;
    const worldLift = direction.lengthSquared() > 1e-6
      ? new Vector3(-direction.z, 0, direction.x).normalize()
      : SIDE_AXIS.clone();
    entry.liftAxis = axisInParent(rootBone, options.liftAxis || worldLift);
    if (jointBone) entry.joint = entryOf(jointBone, SIDE_AXIS);
    if (entry.joint) entry.joint.liftAxis = axisInParent(jointBone, options.liftAxis || worldLift);
  } else if (jointBone) {
    entry.joint = entryOf(jointBone, SIDE_AXIS);
  }
  if (options.calibrate && rootBone && tipBone) {
    const pick = pickSwingAxis(mesh, rootBone, tipBone, entry.amplitude);
    if (pick && pick.stride > 0.03) {
      entry.axis = pick.axis;
      entry.liftAxis = pick.axis;
      entry.stride = pick.stride;
    }
    entry.liftSign = probeAxisSign(mesh, rootBone, entry.liftAxis, tipBone, 0.25);
    if (jointBone) {
      const jointPick = pickSwingAxis(mesh, jointBone, tipBone, 0.4);
      if (jointPick) entry.joint.axis = jointPick.axis;
    }
  }
  return entry;
}

function tipMove(mesh, bone, tipBone, axis, angle) {
  const node = nodeOf(bone);
  const tip = nodeOf(tipBone);
  if (!node || !tip || !axis) return null;
  const base = node.rotationQuaternion
    ? node.rotationQuaternion.clone()
    : Quaternion.FromEulerVector(node.rotation);
  const place = (delta) => {
    node.rotationQuaternion = delta.multiply(base);
    node.computeWorldMatrix(true);
    tip.computeWorldMatrix(true);
    return tip.getAbsolutePosition().clone();
  };
  const front = place(Quaternion.RotationAxis(axis, angle));
  const back = place(Quaternion.RotationAxis(axis, -angle));
  node.rotationQuaternion = base;
  node.computeWorldMatrix(true);
  tip.computeWorldMatrix(true);
  const delta = modelDelta(mesh, back, front);
  return { forward: Math.abs(delta.z), lateral: Math.abs(delta.x) };
}

function pickSwingAxis(mesh, bone, tipBone, angle) {
  const candidates = [SIDE_AXIS, FORWARD_AXIS, UP_AXIS]
    .map((source) => axisInParent(bone, source))
    .filter(Boolean);
  let best = null;
  for (const axis of candidates) {
    const move = tipMove(mesh, bone, tipBone, axis, angle);
    if (!move) continue;
    const score = move.forward - 0.6 * move.lateral;
    if (!best || score > best.score) best = { axis, score, stride: move.forward };
  }
  return best;
}

export function strideRateFor(legs) {
  const strides = legs.map((leg) => leg.stride).filter((value) => Number.isFinite(value) && value > 0.03);
  if (!strides.length) return 4;
  const average = strides.reduce((sum, value) => sum + value, 0) / strides.length;
  return Math.min(14, Math.max(1.5, Math.PI / average));
}

function modelDelta(mesh, before, after) {
  const inverse = Matrix.Invert(mesh.getWorldMatrix());
  return Vector3.TransformNormal(after.subtract(before), inverse);
}

function probeAxis(mesh, bone, axis, probeBone, angle, mode = 'parent') {
  const node = nodeOf(bone);
  const probeNode = nodeOf(probeBone);
  if (!node || !probeNode || !axis) return null;
  const base = node.rotationQuaternion
    ? node.rotationQuaternion.clone()
    : Quaternion.FromEulerVector(node.rotation);
  mesh.computeWorldMatrix(true);
  node.computeWorldMatrix(true);
  probeNode.computeWorldMatrix(true);
  const before = probeNode.getAbsolutePosition().clone();
  const delta = Quaternion.RotationAxis(axis, angle);
  node.rotationQuaternion = mode === 'parent' ? delta.multiply(base) : base.multiply(delta);
  node.computeWorldMatrix(true);
  probeNode.computeWorldMatrix(true);
  const after = probeNode.getAbsolutePosition().clone();
  node.rotationQuaternion = base;
  node.computeWorldMatrix(true);
  probeNode.computeWorldMatrix(true);
  return modelDelta(mesh, before, after);
}

export function probeAxisSign(mesh, bone, axis, probeBone, angle) {
  const delta = probeAxis(mesh, bone, axis, probeBone, angle);
  if (!delta) return 1;
  return delta.y > 0 ? 1 : -1;
}

export function calibrateHinge(mesh, entry, probe) {
  if (!entry || !entry.node || !entry.base) return null;
  const node = entry.node;
  mesh.computeWorldMatrix(true);
  if (mesh.skeleton && typeof mesh.skeleton.prepare === 'function') mesh.skeleton.prepare();
  node.computeWorldMatrix(true);
  const inverseNode = Matrix.Invert(node.getWorldMatrix());
  const restWorld = Vector3.TransformCoordinates(probe, mesh.getWorldMatrix());
  const probeLocal = Vector3.TransformCoordinates(probe, inverseNode);
  const localX = Vector3.TransformNormal(SIDE_AXIS, inverseNode).normalize();
  const localZ = Vector3.TransformNormal(FORWARD_AXIS, inverseNode).normalize();
  const candidates = [
    { axis: entry.keys && entry.keys.open ? entry.keys.open : entry.axis, mode: 'parent' },
    { axis: localX, mode: 'local' },
    { axis: localZ, mode: 'local' },
  ];
  let best = null;
  for (const candidate of candidates) {
    if (!candidate.axis) continue;
    for (const sign of [1, -1]) {
      node.rotationQuaternion = candidate.mode === 'parent'
        ? Quaternion.RotationAxis(candidate.axis, 0.3 * sign).multiply(entry.base)
        : entry.base.multiply(Quaternion.RotationAxis(candidate.axis, 0.3 * sign));
      node.computeWorldMatrix(true);
      const moved = Vector3.TransformCoordinates(probeLocal, node.getWorldMatrix());
      const drop = restWorld.y - moved.y;
      if (!best || drop > best.drop) best = { axis: candidate.axis, mode: candidate.mode, sign, drop };
    }
  }
  node.rotationQuaternion = entry.base;
  node.computeWorldMatrix(true);
  return best;
}

export function applyHinge(entry, hinge, angle) {
  if (!entry || !entry.node || !entry.base || !hinge) return;
  const delta = Quaternion.RotationAxis(hinge.axis, angle * hinge.sign);
  entry.node.rotationQuaternion = hinge.mode === 'parent'
    ? delta.multiply(entry.base)
    : entry.base.multiply(delta);
}

export function swingEntry(entry, angle, lift = 0) {
  if (!entry || !entry.node || !entry.base) return;
  let base = entry.base;
  if (lift && entry.liftAxis) {
    base = Quaternion.RotationAxis(entry.liftAxis, lift).multiply(base);
  }
  const delta = Quaternion.RotationAxis(entry.axis, angle);
  entry.node.rotationQuaternion = delta.multiply(base);
}

export function turnEntry(entry, angles) {
  if (!entry || !entry.node || !entry.base) return;
  let rotation = entry.base;
  for (const key of Object.keys(angles)) {
    const angle = angles[key];
    const axis = entry.keys ? entry.keys[key] : null;
    if (!axis || !angle) continue;
    rotation = Quaternion.RotationAxis(axis, angle).multiply(rotation);
  }
  entry.node.rotationQuaternion = rotation;
}

export function approach(current, target, seconds, speed) {
  const step = Math.min(1, seconds * speed);
  return current + (target - current) * step;
}
