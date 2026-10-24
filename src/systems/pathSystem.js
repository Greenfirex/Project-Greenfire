// Cesty — klade na políčka pásek hlíny, kamene nebo prken, který v zatáčkách plynule zatáčí.
// Šířka pásku se pozvolna vlní podle souřadnic, takže cesta vypadá jako vyšlapaná pěšinka, ne linka.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE, cellKey } from '../utils/gridMath.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { layerLiftAt } from '../data/maps/areaShape.js';

const PATH_LIFT = 0.01;
const HALF = CELL_SIZE / 2;
const HALF_WIDTH = CELL_SIZE / 4;
const UV_TILE = 1;

const STYLE_TEXTURES = {
  dirt: `${ASSET_DIRS.pathTextures}Ground071_1K-JPG_Color.jpg`,
  stone: `${ASSET_DIRS.pathTextures}PavingStones092_1K-JPG_Color.jpg`,
  wood: `${ASSET_DIRS.pathTextures}Planks004_1K-JPG_Color.jpg`,
};

function styleOf(entry) {
  return entry && entry.style ? entry.style : 'dirt';
}

export default class PathSystem {
  constructor(scene) {
    this.s = scene;
    this.meshes = [];
    this.materials = new Map();
    this.shapes = new Map();
  }

  clear() {
    for (const mesh of this.meshes) {
      if (mesh && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.meshes = [];
    this.shapes.clear();
    this.dropUnusedMaterials();
  }

  dropUnusedMaterials() {
    const used = new Set(this.meshes.map((mesh) => mesh.material).filter(Boolean));
    for (const [key, material] of this.materials) {
      if (used.has(material)) continue;
      material.dispose(false, true);
      this.materials.delete(key);
    }
  }

  groundHeightAt(world, cx, cz) {
    const lifted = layerLiftAt(world, cx, cz);
    if (lifted !== null) return lifted;
    return 0;
  }

  buildFromLayout(world) {
    this.clear();
    if (!world || !Array.isArray(world.path)) return;
    const cells = [];
    const pathKeys = new Set();
    for (const entry of world.path) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      pathKeys.add(cellKey(entry.cx, entry.cz));
    }
    for (const entry of world.path) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (this.shapes.has(key)) continue;
      const cell = {
        cx: entry.cx,
        cz: entry.cz,
        style: styleOf(entry),
        open: pathOpen(pathKeys, entry.cx, entry.cz),
        y: this.groundHeightAt(world, entry.cx, entry.cz),
      };
      cells.push(cell);
      this.shapes.set(key, cell);
    }
    if (!cells.length) return;
    const groups = new Map();
    for (const cell of cells) {
      let list = groups.get(cell.style);
      if (!list) {
        list = { positions: [], indices: [], uvs: [] };
        groups.set(cell.style, list);
      }
      this.addTile(cell, list);
    }
    for (const [style, list] of groups) {
      if (!list.positions.length) continue;
      this.addMesh(`path_${style}`, list, this.materialFor(style));
    }
  }

  addTile(cell, list) {
    const kind = pathKind(cell.open);
    if (kind === 'bend') {
      this.addBend(cell, list);
      return;
    }
    if (kind === 'cross') {
      this.addCross(cell, list);
      return;
    }
    const across = kind === 'horizontal';
    this.addStraight(cell, list, across);
  }

  addStraight(cell, list, across) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + PATH_LIFT;
    const start = list.positions.length / 3;
    let corners;
    if (across) {
      const wLeft = pathHalfWidth(x - HALF);
      const wRight = pathHalfWidth(x + HALF);
      corners = [[-HALF, -wLeft], [HALF, -wRight], [HALF, wRight], [-HALF, wLeft]];
    } else {
      const wNorth = pathHalfWidth(z - HALF);
      const wSouth = pathHalfWidth(z + HALF);
      corners = [[-wNorth, -HALF], [wNorth, -HALF], [wSouth, HALF], [-wSouth, HALF]];
    }
    for (const [dx, dz] of corners) {
      list.positions.push(x + dx, y, z + dz);
      list.uvs.push((x + dx) / UV_TILE, (z + dz) / UV_TILE);
    }
    list.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  addCross(cell, list) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + PATH_LIFT;
    const [east, north, west, south] = cell.open;

    if (east || west) {
      const wLeft = pathHalfWidth(x - HALF);
      const wRight = pathHalfWidth(x + HALF);
      let x0;
      let x1;
      let w0;
      let w1;
      if (east && west) { x0 = -HALF; x1 = HALF; w0 = wLeft; w1 = wRight; }
      else if (west) { x0 = -HALF; x1 = 0; w0 = wLeft; w1 = wLeft; }
      else { x0 = 0; x1 = HALF; w0 = wRight; w1 = wRight; }
      this.emitQuad(list, x, y, z, [x0, -w0], [x1, -w1], [x1, w1], [x0, w0]);
    }

    if (north || south) {
      const wNorth = pathHalfWidth(z - HALF);
      const wSouth = pathHalfWidth(z + HALF);
      let z0;
      let z1;
      let wn0;
      let wn1;
      if (north && south) { z0 = -HALF; z1 = HALF; wn0 = wNorth; wn1 = wSouth; }
      else if (north) { z0 = -HALF; z1 = 0; wn0 = wNorth; wn1 = wNorth; }
      else { z0 = 0; z1 = HALF; wn0 = wSouth; wn1 = wSouth; }
      this.emitQuad(list, x, y, z, [-wn0, z0], [wn0, z0], [wn1, z1], [-wn1, z1]);
    }
  }

  emitQuad(list, x, y, z, c0, c1, c2, c3) {
    const start = list.positions.length / 3;
    for (const [dx, dz] of [c0, c1, c2, c3]) {
      list.positions.push(x + dx, y, z + dz);
      list.uvs.push((x + dx) / UV_TILE, (z + dz) / UV_TILE);
    }
    list.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }

  addBend(cell, list) {
    const y = cell.y + PATH_LIFT;
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const [east, north, west, south] = cell.open;
    let cornerX = 0;
    let cornerZ = 0;
    let start = 0;
    let end = 0;
    let wIn = HALF_WIDTH;
    let wOut = HALF_WIDTH;
    if (east && north) {
      cornerX = HALF; cornerZ = -HALF; start = Math.PI / 2; end = Math.PI;
      wIn = pathHalfWidth(x + HALF);
      wOut = pathHalfWidth(z - HALF);
    } else if (north && west) {
      cornerX = -HALF; cornerZ = -HALF; start = 0; end = Math.PI / 2;
      wIn = pathHalfWidth(z - HALF);
      wOut = pathHalfWidth(x - HALF);
    } else if (west && south) {
      cornerX = -HALF; cornerZ = HALF; start = -Math.PI / 2; end = 0;
      wIn = pathHalfWidth(x - HALF);
      wOut = pathHalfWidth(z + HALF);
    } else if (south && east) {
      cornerX = HALF; cornerZ = HALF; start = Math.PI; end = Math.PI * 1.5;
      wIn = pathHalfWidth(z + HALF);
      wOut = pathHalfWidth(x + HALF);
    }
    this.addCorner(x + cornerX, z + cornerZ, y, start, end, wIn, wOut, list);
  }

  addCorner(cx, cz, y, start, end, wIn, wOut, list) {
    const SEGMENTS = 6;
    const base = list.positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const t = i / SEGMENTS;
      const a = start + (end - start) * t;
      const w = wIn + (wOut - wIn) * t;
      const rOuter = HALF - w;
      const rInner = HALF + w;
      const ox = Math.cos(a);
      const oz = Math.sin(a);
      list.positions.push(cx + ox * rOuter, y, cz + oz * rOuter);
      list.positions.push(cx + ox * rInner, y, cz + oz * rInner);
      list.uvs.push((cx + ox * rOuter) / UV_TILE, (cz + oz * rOuter) / UV_TILE);
      list.uvs.push((cx + ox * rInner) / UV_TILE, (cz + oz * rInner) / UV_TILE);
    }
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = base + i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      list.indices.push(a, b, c, b, d, c);
    }
  }

  addMesh(name, list, material) {
    const mesh = new Mesh(name, this.s);
    const data = new VertexData();
    data.positions = list.positions;
    data.indices = list.indices;
    data.uvs = list.uvs;
    data.normals = [];
    VertexData.ComputeNormals(list.positions, list.indices, data.normals);
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    this.meshes.push(mesh);
    return mesh;
  }

  materialFor(key) {
    const cached = this.materials.get(key);
    if (cached) return cached;
    const material = new StandardMaterial(`path_${key}`, this.s);
    const texture = new Texture(STYLE_TEXTURES[key] || STYLE_TEXTURES.dirt, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    material.diffuseTexture = texture;
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    material.ambientColor = new Color3(0.12, 0.1, 0.08);
    this.materials.set(key, material);
    return material;
  }
}

function pathOpen(keys, cx, cz) {
  const dirs = [[1, 0], [0, -1], [-1, 0], [0, 1]];
  return dirs.map(([dx, dz]) => keys.has(cellKey(cx + dx, cz + dz)));
}

function pathHalfWidth(coord) {
  return HALF_WIDTH + 0.08 * Math.sin(coord * 0.9) + 0.04 * Math.sin(coord * 2.1 + 1.3);
}

function pathKind(open) {
  const count = open.filter(Boolean).length;
  const [east, north, west, south] = open;
  if (count === 2) {
    const straight = (east && west) || (north && south);
    if (straight) return (east && west) ? 'horizontal' : 'vertical';
    return 'bend';
  }
  if (count >= 3) return 'cross';
  return (north || south) ? 'vertical' : 'horizontal';
}
