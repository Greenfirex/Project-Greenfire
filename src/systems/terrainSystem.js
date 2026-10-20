// Terén krajiny — podkladová plocha s texturou trávy a neviditelná vrstva pro klikání.
// Tuhle plochu pod stromy, cestami a trávou vidíš jen v místech, kde nic nestojí.
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE } from '../utils/gridMath.js';
import { getMap } from '../data/catalogs/maps.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const GRASS_TEXTURE = `${ASSET_DIRS.textures}Grass004_1K-JPG_Color.jpg`;
const GRASS_TILE = 5.5;
const PICK_LIFT = 0.002;

function color3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

export default class TerrainSystem {

  constructor(scene) {
    this.s = scene;
    this.ground = null;
    this.surface = null;
    this.surfaceMaterial = null;
    this.gridLines = null;
    this.mapKey = null;
  }

  create(mapKey) {
    const map = getMap(mapKey);
    if (!map) return null;

    this.mapKey = mapKey;
    const size = (map.groundSize - 1) * CELL_SIZE;
    this.createSurface(map, size);

    this.ground = MeshBuilder.CreateGround('gridGround', { width: size, height: size }, this.s);
    this.ground.position = new Vector3(0, PICK_LIFT, 0);
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

  createSurface(map, size) {
    if (this.surface && !this.surface.isDisposed()) this.surface.dispose(false, false);
    this.surface = MeshBuilder.CreateGround('terrainSurface', { width: size, height: size }, this.s);
    this.surface.isPickable = false;
    this.surface.receiveShadows = true;

    if (!this.surfaceMaterial) {
      this.surfaceMaterial = new StandardMaterial('terrainSurfaceMat', this.s);
      this.surfaceMaterial.diffuseTexture = new Texture(GRASS_TEXTURE, this.s);
      this.surfaceMaterial.diffuseTexture.uScale = size / GRASS_TILE;
      this.surfaceMaterial.diffuseTexture.vScale = size / GRASS_TILE;
      this.surfaceMaterial.specularColor = new Color3(0.02, 0.02, 0.02);
      this.surfaceMaterial.ambientColor = new Color3(0.08, 0.1, 0.08);
    }
    this.surfaceMaterial.diffuseColor = color3(this.tintOf(map));
    this.surface.material = this.surfaceMaterial;
  }

  tintOf(map) {
    const tone = map.colors.surfaceTint || [0.5, 0.62, 0.45];
    return [tone[0] * 2, tone[1] * 2, tone[2] * 2];
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
