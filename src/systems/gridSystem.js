// Mřížka světa — podlaha, viditelné linky buněk a zvýraznění cílové buňky.
// Drží jediný overlay mesh pro hover, který se jen posouvá a zobrazuje/skrývá.
import '@babylonjs/core/Meshes/Builders/boxBuilder';
import '@babylonjs/core/Meshes/Builders/groundBuilder';
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';

const GRID_WIDTH = 28;
const GRID_DEPTH = 28;

export default class GridSystem {

  constructor(scene) {
    this.s = scene;
    this.ground = null;
    this.gridLines = null;
    this.highlight = null;
    this.highlightMaterial = null;
  }

  create() {
    const width = GRID_WIDTH * CELL_SIZE;
    const depth = GRID_DEPTH * CELL_SIZE;

    this.ground = MeshBuilder.CreateGround('gridGround', { width, height: depth }, this.s);
    this.ground.position = new Vector3(0, 0, 0);
    this.ground.isPickable = true;

    const groundMat = new StandardMaterial('gridGroundMat', this.s);
    groundMat.diffuseColor = new Color3(0.11, 0.14, 0.16);
    groundMat.specularColor = new Color3(0.05, 0.05, 0.05);
    this.ground.material = groundMat;

    this.gridLines = this.createGridLines(width, depth);

    this.highlight = MeshBuilder.CreateGround('cellHighlight', {
      width: CELL_SIZE * 0.96,
      height: CELL_SIZE * 0.96,
    }, this.s);
    this.highlightMaterial = new StandardMaterial('cellHighlightMat', this.s);
    this.highlightMaterial.diffuseColor = new Color3(0.35, 0.78, 0.67);
    this.highlightMaterial.emissiveColor = new Color3(0.22, 0.5, 0.42);
    this.highlightMaterial.alpha = 0.35;
    this.highlight.material = this.highlightMaterial;
    this.highlight.position = new Vector3(0, 0.02, 0);
    this.highlight.isPickable = false;
    this.highlight.setEnabled(false);

    return this.ground;
  }

  createGridLines(width, depth) {
    const halfW = width / 2;
    const halfD = depth / 2;
    const points = [];

    for (let x = -halfW; x <= halfW + 0.001; x += CELL_SIZE) {
      points.push([new Vector3(x, 0.01, -halfD), new Vector3(x, 0.01, halfD)]);
    }
    for (let z = -halfD; z <= halfD + 0.001; z += CELL_SIZE) {
      points.push([new Vector3(-halfW, 0.01, z), new Vector3(halfW, 0.01, z)]);
    }

    const lines = MeshBuilder.CreateLineSystem('gridLines', { lines: points }, this.s);
    lines.color = new Color3(0.28, 0.4, 0.38);
    lines.isPickable = false;
    lines.alpha = 0.55;
    return lines;
  }

  setHighlight(cx, cz) {
    this.highlight.position = new Vector3(cx * CELL_SIZE, 0.02, cz * CELL_SIZE);
    this.highlight.setEnabled(true);
  }

  hideHighlight() {
    this.highlight.setEnabled(false);
  }

  setHighlightValid(isValid) {
    if (isValid) {
      this.highlightMaterial.diffuseColor = new Color3(0.35, 0.78, 0.67);
      this.highlightMaterial.emissiveColor = new Color3(0.22, 0.5, 0.42);
    } else {
      this.highlightMaterial.diffuseColor = new Color3(0.8, 0.32, 0.28);
      this.highlightMaterial.emissiveColor = new Color3(0.5, 0.18, 0.15);
    }
  }
}
