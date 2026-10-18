// Procedurální vodní hladina — kit Kenney skutečnou plochu vody nemá, jen 10cm proužky.
// Vyrábí rovinný quad na buňku, který decoSystem skládá stejně jako modely.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Materials/standardMaterial';
import '@babylonjs/core/Meshes/mesh';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';

const WATER_Y = -0.02;
const WATER_ALPHA = 0.88;

export function createWaterPlane(scene, name, color, size = CELL_SIZE) {
  const mesh = CreateGround(name, { width: size, height: size }, scene);
  mesh.position = new Vector3(0, WATER_Y, 0);
  mesh.isPickable = false;
  mesh.receiveShadows = true;

  const mat = new StandardMaterial(`${name}_mat`, scene);
  mat.diffuseColor = new Color3(color[0], color[1], color[2]);
  mat.specularColor = new Color3(0.55, 0.62, 0.66);
  mat.specularPower = 96;
  mat.ambientColor = new Color3(color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
  mat.alpha = WATER_ALPHA;
  mat.backFaceCulling = false;
  mesh.material = mat;

  return mesh;
}
