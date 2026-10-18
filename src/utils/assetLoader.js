// Načítání a cache 3D modelů (Kenney GLB).
// Každý model se stáhne jednou, do scény se vkládá jeho klon.
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/abstractMesh';
import '@babylonjs/core/Meshes/geometry';
import { registerBuiltInLoaders } from '@babylonjs/loaders/dynamic';
import { ImportMeshAsync } from '@babylonjs/core/Loading/sceneLoader';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CELL_SIZE } from './gridMath.js';

registerBuiltInLoaders();

const MODEL_SCALE = CELL_SIZE;
const cache = new Map();

export function loadModel(scene, url, onTemplate) {
  if (!cache.has(url)) {
    const promise = ImportMeshAsync(url, scene, { meshNames: null }).then((result) => {
      const root = new TransformNode('tplModel', scene);
      const kids = result.meshes.filter((m) => m.getTotalVertices && m.getTotalVertices() > 0);
      for (const mesh of kids) mesh.parent = root;
      if (onTemplate) onTemplate(root);
      root.setEnabled(false);
      return root;
    }).catch((err) => {
      console.warn('Model se nenacetl:', url, err?.message ?? err);
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
