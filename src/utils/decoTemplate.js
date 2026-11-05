// Překlad dekorace na šablonu — procedura z kódu, nebo model z disku.
// Model stromu se srovná na patu a na výšku z receptu, aby sedl na terén.
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { treeTemplate, treeLogTemplate, treeBranchTemplate } from './treeFactory.js';
import { rockTemplate } from './rockFactory.js';
import { shellTemplate } from './shellFactory.js';
import { coralTemplate } from './coralFactory.js';
import { flowerTemplate } from './flowerFactory.js';
import { bushTemplate } from './bushFactory.js';
import { campfireTemplate } from './campfireFactory.js';
import { resolveModel } from './assetLoader.js';
import { getTreeRecipe } from '../data/catalogs/trees.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import TreeWindPlugin from '../systems/treeWindPlugin.js';
import ModelSaturationPlugin from '../systems/modelSaturationPlugin.js';

const treeModels = new WeakMap();
const windMaterials = new WeakSet();
const tintedMaterials = new WeakSet();
const WIND_STRENGTH = 0.05;

function treeModelUrl(recipe) {
  return recipe && recipe.file ? `${ASSET_DIRS.plants}${recipe.file}` : null;
}

function proceduralTemplate(scene, def) {
  if (!def) return null;
  if (def.campfire) return campfireTemplate(scene, def.campfire);
  if (def.log) return treeLogTemplate(scene, def.log);
  if (def.branch) return treeBranchTemplate(scene, def.branch);
  if (def.driftwood) return treeLogTemplate(scene, def.driftwood);
  if (def.tree) return treeTemplate(scene, def.tree);
  if (def.rock) return rockTemplate(scene, def.rock);
  if (def.shell) return shellTemplate(scene, def.shell);
  if (def.coral) return coralTemplate(scene, def.coral);
  if (def.flower) return flowerTemplate(scene, def.flower);
  if (def.bush) return bushTemplate(scene, def.bush);
  return null;
}

export function decorationModelUrl(def) {
  if (!def) return null;
  if (def.model) return def.model;
  return def.tree ? treeModelUrl(getTreeRecipe(def.tree)) : null;
}

export function treeModelTemplate(scene, key) {
  const recipe = getTreeRecipe(key);
  const url = treeModelUrl(recipe);
  if (!url) return Promise.resolve(null);
  let byKey = treeModels.get(scene);
  if (!byKey) {
    byKey = new Map();
    treeModels.set(scene, byKey);
  }
  const cached = byKey.get(key);
  if (cached) {
    return cached.then((root) => {
      if (root && !root.isDisposed()) return root;
      byKey.delete(key);
      return treeModelTemplate(scene, key);
    });
  }
  const promise = resolveModel(scene, url).then((template) => {
    if (!template) return null;
    const root = template.clone(`tplTreeModel_${key}`, null, false);
    if (!root) return null;
    const meshes = root.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
    if (!meshes.length) return null;
    let bottom = Infinity;
    let top = -Infinity;
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      bottom = Math.min(bottom, box.minimumWorld.y);
      top = Math.max(top, box.maximumWorld.y);
    }
    const height = Math.max(0.001, top - bottom);
    const scale = recipe.height / height;
    const fit = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.Identity(),
      new Vector3(0, -bottom * scale, 0),
    );
    for (const mesh of meshes) {
      mesh.makeGeometryUnique();
      mesh.bakeCurrentTransformIntoVertices();
      mesh.bakeTransformIntoVertices(fit);
      mesh.isPickable = false;
      mesh.receiveShadows = true;
      const material = mesh.material;
      if (material) {
        if (recipe.modelSaturation && !tintedMaterials.has(material)) {
          tintedMaterials.add(material);
          new ModelSaturationPlugin(material, recipe.modelSaturation);
        }
        if (!windMaterials.has(material)) {
          windMaterials.add(material);
          new TreeWindPlugin(material, { height: recipe.height, strength: WIND_STRENGTH });
        }
      }
    }
    root.setEnabled(false);
    return root;
  });
  byKey.set(key, promise);
  return promise;
}

export function decorationTemplate(scene, def) {
  if (!def) return Promise.resolve(null);
  if (def.tree && decorationModelUrl(def)) {
    return treeModelTemplate(scene, def.tree).then((template) => template || proceduralTemplate(scene, def));
  }
  const quick = proceduralTemplate(scene, def);
  if (quick) return Promise.resolve(quick);
  if (!def.model) return Promise.resolve(null);
  return resolveModel(scene, def.model);
}
