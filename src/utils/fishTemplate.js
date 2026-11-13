// Šablona ryby z modelu — model se načte jednou, hejno z něj kreslí jen kopie matic.
// Model je připravený hlavou k +X a dlouhý 1 m; měřítko podle druhu dopočítá FishSystem.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { loadModel } from './assetLoader.js';
import { fishModelUrl } from '../data/catalogs/fish.js';
import FishWigglePlugin from '../systems/materials/fishWigglePlugin.js';

const templates = new WeakMap();

export function fishTemplate(scene, kind) {
  let byKind = templates.get(scene);
  if (!byKind) {
    byKind = new Map();
    templates.set(scene, byKind);
  }
  const cached = byKind.get(kind);
  if (cached) return cached;
  const promise = loadModel(scene, fishModelUrl(kind)).then((root) => buildFish(kind, root));
  byKind.set(kind, promise);
  return promise;
}

function buildFish(kind, root) {
  if (!root) return null;
  const sources = root.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
  if (!sources.length) {
    console.error(`[fish] Model nemá žádnou geometrii: ${fishModelUrl(kind)}`);
    return null;
  }
  let mesh;
  if (sources.length === 1) {
    mesh = sources[0].clone(`fishBody_${kind}`, null, true);
  } else {
    const clones = sources.map((source, index) => source.clone(`fishPart_${kind}_${index}`, null, true));
    mesh = Mesh.MergeMeshes(clones, true, true, undefined, false, true);
  }
  if (!mesh) return null;
  mesh.parent = null;
  mesh.makeGeometryUnique();
  mesh.bakeCurrentTransformIntoVertices();
  mesh.refreshBoundingInfo();
  const box = mesh.getBoundingInfo().boundingBox;
  mesh.metadata = { ...(mesh.metadata || {}), modelLength: Math.max(0.001, box.maximum.x - box.minimum.x) };
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.setEnabled(false);
  const sourceMaterial = mesh.material;
  if (sourceMaterial) {
    const material = sourceMaterial.clone(`fishMat_${kind}`);
    if (material) {
      material.backFaceCulling = false;
      mesh.material = material;
      if (material.getClassName && material.getClassName() === 'PBRMaterial') {
        new FishWigglePlugin(material);
      }
    }
  }
  return mesh;
}
