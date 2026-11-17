// Šablona kraba z modelu — model se načte jednou, všichni krabi z něj kreslí jen kopie.
// Model je připravený klepety k +Z, široký 1 m a postavený nohama na nulu.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { loadModel } from './assetLoader.js';
import { CRAB } from '../data/catalogs/crabs.js';
import CrabLegsPlugin from '../systems/materials/crabLegsPlugin.js';

const templates = new WeakMap();

export function crabTemplate(scene) {
  const cached = templates.get(scene);
  if (cached) return cached;
  const promise = loadModel(scene, CRAB.model).then(buildCrab);
  templates.set(scene, promise);
  return promise;
}

function buildCrab(root) {
  if (!root) return null;
  const sources = root.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
  if (!sources.length) {
    console.error(`[crab] Model nemá žádnou geometrii: ${CRAB.model}`);
    return null;
  }
  const mesh = sources.length === 1
    ? sources[0].clone('crabBody', null, true)
    : Mesh.MergeMeshes(sources.map((source, index) => source.clone(`crabPart_${index}`, null, true)), true, true, undefined, false, true);
  if (!mesh) return null;
  mesh.parent = null;
  mesh.makeGeometryUnique();
  mesh.bakeCurrentTransformIntoVertices();
  mesh.refreshBoundingInfo();
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.setEnabled(false);
  const material = mesh.material ? mesh.material.clone('crabMat') : null;
  if (material) {
    material.backFaceCulling = false;
    mesh.material = material;
    if (material.getClassName && material.getClassName() === 'PBRMaterial') new CrabLegsPlugin(material);
  }
  return mesh;
}
