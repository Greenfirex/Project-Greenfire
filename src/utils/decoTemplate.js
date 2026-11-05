// Překlad dekorace na šablonu — procedura z kódu, nebo model z disku.
// Model stromu se srovná na patu a na výšku z receptu, aby sedl na terén.
// Patou se myslí místo, kde se model dotýká země, takže prohnutá palma stojí na své buňce.
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
import ModelRimPlugin from '../systems/modelRimPlugin.js';

const treeModels = new WeakMap();
const fittedModels = new WeakSet();
const windMaterials = new WeakSet();
const rimMaterials = new WeakSet();
const tintedMaterials = new WeakSet();
const WIND_STRENGTH = 0.05;

function treeModelUrl(recipe) {
  return recipe && recipe.file ? `${ASSET_DIRS.plants}${recipe.file}` : null;
}

function fitModelBase(template) {
  if (!template || fittedModels.has(template)) return;
  fittedModels.add(template);
  const meshes = template.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
  if (!meshes.length) return;
  let bottom = Infinity;
  let top = -Infinity;
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    bottom = Math.min(bottom, box.minimumWorld.y);
    top = Math.max(top, box.maximumWorld.y);
  }
  if (!Number.isFinite(bottom) || !Number.isFinite(top)) return;
  const shift = Matrix.Compose(
    Vector3.One(),
    Quaternion.Identity(),
    new Vector3(0, -bottom, 0),
  );
  for (const mesh of meshes) {
    mesh.makeGeometryUnique();
    mesh.bakeCurrentTransformIntoVertices();
    mesh.bakeTransformIntoVertices(shift);
  }
  template.metadata = { ...(template.metadata || {}), modelHeight: Math.max(0.001, top - bottom) };
}

function addModelSaturation(template, amount) {
  if (!Number.isFinite(amount) || amount === 1) return;
  for (const mesh of template.getChildMeshes()) {
    const material = mesh.material;
    if (!material || tintedMaterials.has(material)) continue;
    tintedMaterials.add(material);
    new ModelSaturationPlugin(material, amount);
  }
}

function addModelRim(template, amount, power) {
  for (const mesh of template.getChildMeshes()) {
    const material = mesh.material;
    if (!material || rimMaterials.has(material)) continue;
    if (material.getClassName && material.getClassName() !== 'PBRMaterial') continue;
    rimMaterials.add(material);
    new ModelRimPlugin(material, { amount, power });
  }
}

function addModelWind(template, strength) {
  const height = (template.metadata && template.metadata.modelHeight) || 2;
  for (const mesh of template.getChildMeshes()) {
    const material = mesh.material;
    if (!material || windMaterials.has(material)) continue;
    windMaterials.add(material);
    new TreeWindPlugin(material, { height, strength });
  }
}

function contactPoint(meshes, bottom, height) {
  const band = bottom + Math.max(0.05, height * 0.02);
  let sumX = 0;
  let sumZ = 0;
  let count = 0;
  for (const mesh of meshes) {
    const data = mesh.getVerticesData('position');
    if (!data) continue;
    const world = mesh.getWorldMatrix();
    for (let i = 0; i < data.length; i += 3) {
      const point = Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), world);
      if (point.y > band) continue;
      sumX += point.x;
      sumZ += point.z;
      count += 1;
    }
  }
  if (!count) return { x: 0, z: 0 };
  return { x: sumX / count, z: sumZ / count };
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
    const contact = contactPoint(meshes, bottom, height);
    const fit = Matrix.Compose(
      new Vector3(scale, scale, scale),
      Quaternion.Identity(),
      new Vector3(-contact.x * scale, -bottom * scale, -contact.z * scale),
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
  return resolveModel(scene, def.model).then((template) => {
    if (!template) return null;
    fitModelBase(template);
    if (def.modelSaturation) addModelSaturation(template, def.modelSaturation);
    if (def.modelRim) addModelRim(template, def.modelRim, def.modelRimPower);
    if (def.wind) addModelWind(template, def.wind);
    return template;
  });
}
