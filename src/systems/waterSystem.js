// Vodní hladina — jedna poloprůhledná deska nad mapou v úrovni hladiny.
// Kde je terén výš, desku překryje; v pánvi se objeví voda.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE } from '../utils/gridMath.js';
import { getMap } from '../data/catalogs/maps.js';

const WATER_SINK = 0.02;

export default class WaterSystem {

  constructor(scene) {
    this.s = scene;
    this.mesh = null;
  }

  clear() {
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose(false, true);
    this.mesh = null;
  }

  create(cells, level) {
    this.clear();
    if (!Number.isFinite(level) || !cells || !cells.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const [cx, cz] of cells) {
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
      minZ = Math.min(minZ, cz);
      maxZ = Math.max(maxZ, cz);
    }
    if (!Number.isFinite(minX)) return null;
    const width = (maxX - minX) * CELL_SIZE + CELL_SIZE;
    const depth = (maxZ - minZ) * CELL_SIZE + CELL_SIZE;
    const mesh = MeshBuilder.CreateGround('waterSurface', { width, height: depth, subdivisions: 1 }, this.s);
    mesh.position.x = ((minX + maxX) / 2) * CELL_SIZE;
    mesh.position.z = ((minZ + maxZ) / 2) * CELL_SIZE;
    mesh.position.y = level - WATER_SINK;
    mesh.isPickable = false;
    mesh.material = this.material();
    this.mesh = mesh;
    return mesh;
  }

  material() {
    const map = getMap(this.s.mapKey);
    const rgb = (map && map.colors && map.colors.water) || [0.06, 0.16, 0.19];
    const color = new Color3(rgb[0], rgb[1], rgb[2]);
    const material = new StandardMaterial('waterSurfaceMat', this.s);
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.35);
    material.specularColor = new Color3(0.08, 0.09, 0.1);
    material.alpha = 0.6;
    material.backFaceCulling = false;
    return material;
  }
}