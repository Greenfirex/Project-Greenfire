// Skládá ohniště z geometrie v kódu — kruh kamenů a přes sebe položená polena.
// Šablona se staví jednou a do světa se vkládá jejím klonem.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { rockTemplate } from './rockFactory.js';
import { treeLogTemplate } from './treeFactory.js';

const templates = new WeakMap();
const STONE_COUNT = 9;
const STONE_RING = 0.5;
const STONE_SCALES = [0.26, 0.3, 0.34];
const LOG_ANGLES = [0, Math.PI / 3, (Math.PI * 2) / 3];
const LOG_SCALE = 0.42;
const LOG_LIFT = 0.035;

export function campfireTemplate(scene, style) {
  let cached = templates.get(scene);
  if (!cached) {
    cached = new Map();
    templates.set(scene, cached);
  }
  const key = style || 'pine_a';
  const existing = cached.get(key);
  if (existing && !existing.isDisposed()) return existing;
  const built = buildCampfire(scene, key);
  if (built) cached.set(key, built);
  return built;
}

function buildCampfire(scene, key) {
  const stone = rockTemplate(scene, 'boulder_small');
  const log = treeLogTemplate(scene, key);
  if (!stone || !log) return null;
  const root = new TransformNode(`tplCampfire_${key}`, scene);
  for (let index = 0; index < STONE_COUNT; index += 1) {
    const node = stone.clone(`campfireStone_${index}`, root, false);
    if (!node) continue;
    node.setEnabled(true);
    const angle = (index / STONE_COUNT) * Math.PI * 2;
    const scale = STONE_SCALES[index % STONE_SCALES.length];
    node.position = new Vector3(Math.cos(angle) * STONE_RING, 0, Math.sin(angle) * STONE_RING);
    node.rotation.y = angle * 1.7;
    node.scaling = new Vector3(scale, scale * 0.85, scale);
  }
  for (let index = 0; index < LOG_ANGLES.length; index += 1) {
    const node = log.clone(`campfireLog_${index}`, root, false);
    if (!node) continue;
    node.setEnabled(true);
    node.position = new Vector3(0, index * LOG_LIFT, 0);
    node.rotation.y = LOG_ANGLES[index];
    node.scaling = new Vector3(LOG_SCALE, LOG_SCALE, LOG_SCALE);
  }
  root.setEnabled(false);
  return root;
}
