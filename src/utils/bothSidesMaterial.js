// Pomocný materiál pro mapy stínů a dohledu — skálu nakreslí z obou stran, aby ji světlo zachytilo z každého směru.
// Ve hře se s ním nic nevykresluje; mapy ho dostanou místo běžného materiálu skály.
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

const materials = new WeakMap();

export function bothSidesMaterial(scene) {
  let material = materials.get(scene);
  if (!material) {
    material = new StandardMaterial('shadowBothSidesMat', scene);
    material.backFaceCulling = false;
    materials.set(scene, material);
  }
  return material;
}
