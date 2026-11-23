// Hotové animace z modelu (Meshy) pro rigy tvorů: vytáhne z nich klíčové polohy kostí
// a umí je v libovolném čase přečíst a smíchat, aby je rig mohl skládat s pohybem z kódu.
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';

function keyTrack(animation) {
  const keys = animation.getKeys();
  if (!keys || !keys.length) return null;
  const fps = animation.framePerSecond || 60;
  return {
    times: keys.map((key) => key.frame / fps),
    values: keys.map((key) => key.value.clone()),
  };
}

export function extractClips(animationGroups, names) {
  const wanted = new Set(Object.values(names));
  const byName = {};
  for (const group of animationGroups || []) {
    group.stop();
    if (!wanted.has(group.name)) continue;
    const tracks = new Map();
    let duration = 0;
    for (const { animation, target } of group.targetedAnimations) {
      const property = animation.targetProperty;
      if (property !== 'rotationQuaternion' && property !== 'position') continue;
      const track = keyTrack(animation);
      if (!track) continue;
      duration = Math.max(duration, track.times[track.times.length - 1]);
      const entry = tracks.get(target) || {};
      entry[property === 'position' ? 'position' : 'rotation'] = track;
      tracks.set(target, entry);
    }
    byName[group.name] = { duration, tracks };
  }
  const clips = {};
  for (const [key, name] of Object.entries(names)) {
    if (byName[name]) clips[key] = byName[name];
  }
  return clips;
}

function keyIndex(times, time) {
  let low = 0;
  let high = times.length - 1;
  if (time <= times[0]) return 0;
  if (time >= times[high]) return high - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle] <= time) low = middle;
    else high = middle;
  }
  return low;
}

function sampleRotation(track, time, out) {
  if (track.times.length === 1) return out.copyFrom(track.values[0]);
  const index = keyIndex(track.times, time);
  const start = track.times[index];
  const span = track.times[index + 1] - start;
  const amount = span > 0 ? Math.min(1, Math.max(0, (time - start) / span)) : 0;
  return Quaternion.SlerpToRef(track.values[index], track.values[index + 1], amount, out);
}

function samplePosition(track, time, out) {
  if (track.times.length === 1) return out.copyFrom(track.values[0]);
  const index = keyIndex(track.times, time);
  const start = track.times[index];
  const span = track.times[index + 1] - start;
  const amount = span > 0 ? Math.min(1, Math.max(0, (time - start) / span)) : 0;
  return Vector3.LerpToRef(track.values[index], track.values[index + 1], amount, out);
}

export function restPose(nodes) {
  return new Map(nodes.map((node) => [node, {
    rotation: (node.rotationQuaternion || Quaternion.FromEulerVector(node.rotation)).clone(),
    position: node.position.clone(),
  }]));
}

const sampled = new Quaternion();
const sampledPosition = new Vector3();

export function blendPose(rest, out, layers) {
  for (const [node, base] of rest) {
    const pose = out.get(node);
    pose.rotation.copyFrom(base.rotation);
    pose.position.copyFrom(base.position);
  }
  for (const layer of layers) {
    if (!layer.clip || !(layer.weight > 0.001)) continue;
    const weight = Math.min(1, layer.weight);
    for (const [node, track] of layer.clip.tracks) {
      const pose = out.get(node);
      if (!pose || (layer.only && !layer.only.has(node))) continue;
      if (track.rotation) {
        sampleRotation(track.rotation, layer.time, sampled);
        Quaternion.SlerpToRef(pose.rotation, sampled, weight, pose.rotation);
      }
      if (track.position) {
        samplePosition(track.position, layer.time, sampledPosition);
        const base = rest.get(node).position;
        if (layer.inPlace) {
          sampledPosition.x = base.x;
          sampledPosition.z = base.z;
        }
        if (Number.isFinite(layer.dropShare) && sampledPosition.y < base.y) {
          sampledPosition.y = base.y + (sampledPosition.y - base.y) * layer.dropShare;
        }
        if (layer.raise) sampledPosition.y += layer.raise;
        Vector3.LerpToRef(pose.position, sampledPosition, weight, pose.position);
      }
    }
  }
  return out;
}
