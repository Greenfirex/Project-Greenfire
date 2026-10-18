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

const MODEL_SCALE = CELL_SIZE;
const cache = new Map();
const reportedTextures = new Set();

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
      return null;
    });
    cache.set(url, promise);
  }
  return cache.get(url);
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


