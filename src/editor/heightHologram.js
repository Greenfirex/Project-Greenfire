// Průsvitná hmota změny výšky v editoru — zeleně co přibude, červeně co se odebere.
// Všechny označené buňky jsou jeden společný tvar; svítí i přes terén, aby byl vidět i výkop.
import '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CELL_SIZE } from '../utils/gridMath.js';

const RAISE = [0.45, 1, 0.65];
const LOWER = [1, 0.5, 0.4];
const TOP_ALPHA = 0.6;
const SIDE_ALPHA = 0.42;
const FLOOR_ALPHA = 0.7;
const GLOW = 0.25;
const MIN_CHANGE = 0.01;
const SIDES = [
  { dx: 1, dz: 0, a: [1, -1], b: [1, 1] },
  { dx: -1, dz: 0, a: [-1, 1], b: [-1, -1] },
  { dx: 0, dz: 1, a: [1, 1], b: [-1, 1] },
  { dx: 0, dz: -1, a: [-1, -1], b: [1, -1] },
];

export default class HeightHologram {

  constructor(scene) {
    this.s = scene;
    this.mesh = null;
    this.edges = null;
    this.material = new StandardMaterial('heightHologram', scene);
    this.material.disableLighting = true;
    this.material.diffuseColor = Color3.White();
    this.material.emissiveColor = new Color3(GLOW, GLOW, GLOW);
    this.material.specularColor = Color3.Black();
    this.material.alpha = 0.999;
    this.material.disableDepthWrite = true;
    this.material.backFaceCulling = false;
    this.material.fogEnabled = false;
  }

  show(cells) {
    this.clear();
    const list = (cells || []).filter((cell) => Math.abs(cell.to - cell.from) > MIN_CHANGE);
    if (!list.length) return;
    const byKey = new Map(list.map((cell) => [`${cell.cx},${cell.cz}`, cell]));
    const positions = [];
    const colors = [];
    const indices = [];
    const lines = [];
    const lineColors = [];
    const half = CELL_SIZE / 2;
    const addQuad = (corners, rgb, alpha) => {
      const start = positions.length / 3;
      for (const [x, y, z] of corners) {
        positions.push(x, y, z);
        colors.push(rgb[0], rgb[1], rgb[2], alpha);
      }
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    };
    for (const cell of list) {
      const raise = cell.to > cell.from;
      const rgb = raise ? RAISE : LOWER;
      const low = Math.min(cell.from, cell.to);
      const high = Math.max(cell.from, cell.to);
      const x = cell.cx * CELL_SIZE;
      const z = cell.cz * CELL_SIZE;
      const at = (sx, y, sz) => [x + sx * half, y, z + sz * half];
      addQuad([at(-1, high, -1), at(-1, high, 1), at(1, high, 1), at(1, high, -1)], rgb, TOP_ALPHA);
      if (!raise) addQuad([at(-1, low, -1), at(-1, low, 1), at(1, low, 1), at(1, low, -1)], rgb, FLOOR_ALPHA);
      for (const side of SIDES) {
        const near = byKey.get(`${cell.cx + side.dx},${cell.cz + side.dz}`);
        const sameWay = near && (near.to > near.from) === raise;
        const nearTop = near ? Math.max(near.from, near.to) : null;
        if (!sameWay || Math.abs(nearTop - high) > MIN_CHANGE) {
          lines.push([new Vector3(...at(side.a[0], high, side.a[1])), new Vector3(...at(side.b[0], high, side.b[1]))]);
          const edge = new Color4(rgb[0], rgb[1], rgb[2], 1);
          lineColors.push([edge, edge]);
        }
        const spans = sameWay
          ? [[low, Math.min(high, Math.min(near.from, near.to))], [Math.max(low, Math.max(near.from, near.to)), high]]
          : [[low, high]];
        for (const [bottom, top] of spans) {
          if (top - bottom <= MIN_CHANGE) continue;
          addQuad([
            at(side.a[0], bottom, side.a[1]),
            at(side.a[0], top, side.a[1]),
            at(side.b[0], top, side.b[1]),
            at(side.b[0], bottom, side.b[1]),
          ], rgb, SIDE_ALPHA);
        }
      }
    }
    const mesh = new Mesh('heightHologram', this.s);
    const data = new VertexData();
    data.positions = positions;
    data.colors = colors;
    data.indices = indices;
    data.applyToMesh(mesh);
    mesh.hasVertexAlpha = true;
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.renderingGroupId = 1;
    this.mesh = mesh;
    if (!lines.length) return;
    const edges = MeshBuilder.CreateLineSystem('heightHologramEdges', { lines, colors: lineColors }, this.s);
    edges.isPickable = false;
    edges.renderingGroupId = 1;
    this.edges = edges;
  }

  clear() {
    if (this.mesh && !this.mesh.isDisposed()) this.mesh.dispose(false, false);
    if (this.edges && !this.edges.isDisposed()) this.edges.dispose(false, false);
    this.mesh = null;
    this.edges = null;
  }
}
