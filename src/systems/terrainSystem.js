// Terén krajiny — neviditelná podlaha pro klikání a linky mřížky.
// Vlastní vzhled půdy kreslí dekorace z dlaždic; tenhle systém drží jen pick cíl.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';
import { getMap } from '../data/catalogs/maps.js';

function color3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

export default class TerrainSystem {

  constructor(scene) {
    this.s = scene;
    this.ground = null;
    this.gridLines = null;
  }

  create(mapKey) {
    const map = getMap(mapKey);
    if (!map) return null;

    const size = (map.groundSize - 1) * CELL_SIZE;
    this.ground = MeshBuilder.CreateGround('gridGround', { width: size, height: size }, this.s);
    this.ground.position = new Vector3(0, 0, 0);
    this.ground.isPickable = true;
    this.ground.isVisible = false;

    const groundMat = new StandardMaterial('terrainGroundMat', this.s);
    groundMat.diffuseColor = color3(map.colors.ground);
    groundMat.specularColor = new Color3(0.02, 0.02, 0.02);
    groundMat.alpha = 0;
    this.ground.material = groundMat;

    this.gridLines = this.createGridLines(map);
    return this.ground;
  }

  createGridLines(map) {
    const limit = Math.floor(map.groundSize / 2) - 1;
    const half = limit * CELL_SIZE + CELL_SIZE / 2;
    const points = [];
    const spacing = CELL_SIZE;

    for (let x = -half; x <= half + 0.001; x += spacing) {
      points.push([new Vector3(x, 0.02, -half), new Vector3(x, 0.02, half)]);
    }
    for (let z = -half; z <= half + 0.001; z += spacing) {
      points.push([new Vector3(-half, 0.02, z), new Vector3(half, 0.02, z)]);
    }

    const lines = MeshBuilder.CreateLineSystem('terrainGridLines', { lines: points }, this.s);
    lines.color = color3(map.colors.gridLine);
    lines.alpha = 0.22;
    lines.isPickable = false;
    return lines;
  }

  toggleGrid() {
    if (!this.gridLines) return false;
    this.gridLines.setEnabled(!this.gridLines.isEnabled());
    return this.gridLines.isEnabled();
  }
}
