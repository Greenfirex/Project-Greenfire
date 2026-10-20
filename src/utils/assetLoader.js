// Načítání a cache 3D modelů (Kenney GLB).
// Každý model se stáhne jednou, do scény se vkládá jeho klon. Selhání modelu
// i chybějící atlasová textura se hlásí do konzole s cestou k souboru.
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/geometry';
import '@babylonjs/core/Materials/Textures/texture';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from './gridMath.js';

registerBuiltInLoaders();

export function releaseFrame() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const MODEL_SCALE = CELL_SIZE;
const MODEL_TIMEOUT_MS = 15000;
const cache = new Map();
const reportedTextures = new Set();
const waiters = new Set();
let pending = 0;
let loadError = false;

Texture.OnTextureLoadErrorObservable.add((texture) => {
  const url = texture?.url ?? '(neznámá textura)';
  if (reportedTextures.has(url)) return;
  reportedTextures.add(url);
  console.error(
    `[asset] Textura se nenačetla: ${url} — model bude bez barvy. `
    + 'Zkontroluj, že atlas leží vedle GLB ve složce Textures/.',
  );
});

export function loadModel(scene, url) {
  if (!cache.has(url)) {
    pending += 1;
    const promise = ImportMeshAsync(url, scene, { meshNames: null }).then((result) => {
      const root = new TransformNode('tplModel', scene);
      const kids = result.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
      for (const mesh of kids) mesh.parent = root;
      if (!kids.length) {
        console.error(`[asset] Model neobsahuje žádnou geometrii: ${url}`);
      }
      root.setEnabled(false);
      console.info(`[asset] Načteno: ${url} (${kids.length} meshů)`);
      return root;
    }).catch((err) => {
      console.error(`[asset] Model se nenačetl: ${url} — ${err?.message ?? err}`);
      loadError = true;
      return null;
    }).then((root) => {
      pending -= 1;
      notifyWaiters();
      return root;
    });
    cache.set(url, promise);
  }
  return cache.get(url);
}

export async function preloadModels(scene, urls, onProgress) {
  const list = [...new Set(urls)];
  const missing = [];
  let done = 0;
  for (const url of list) {
    const root = await withTimeout(loadModel(scene, url), MODEL_TIMEOUT_MS);
    if (!root) {
      missing.push(url);
      console.warn(`[asset] Model se nepodařilo načíst do ${MODEL_TIMEOUT_MS / 1000} s: ${url}`);
    }
    done += 1;
    if (onProgress) onProgress(done, list.length, url, !root);
  }
  return { total: list.length, missing };
}

function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    Promise.resolve(promise).then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

export function whenModelsIdle() {
  if (pending === 0) return Promise.resolve();
  return new Promise((resolve) => {
    waiters.add(resolve);
  });
}

export function takeModelError() {
  const had = loadError;
  loadError = false;
  return had;
}
export function tellModelLoaded() {
  notifyWaiters();
}

function notifyWaiters() {
  if (pending > 0) return;
  for (const resolve of waiters) resolve();
  waiters.clear();
}

export function instantiateModel(scene, template, name) {
  if (!template) return null;
  const node = template.clone(name, null, false);
  node.setEnabled(true);
  node.scaling = node.scaling.scale(MODEL_SCALE);
  for (const child of node.getChildMeshes()) {
    child.setEnabled(true);
    child.isPickable = false;
    child.receiveShadows = true;
  }
  return node;
}

