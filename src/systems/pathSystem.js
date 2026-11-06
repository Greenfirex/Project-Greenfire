// Cesty — klade na políčka pásek hlíny, kamene nebo prken, který v zatáčkách plynule zatáčí.
// Pásek se skládá z jemných kousků a každý sedí na skutečné výšce země, takže kopíruje kopce i příkopy.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE, cellKey } from '../utils/gridMath.js';
import { warnMissingWiring } from '../utils/missingWiring.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const PATH_LIFT = 0.025;
const STRAIGHT_ALONG = 4;
const STRAIGHT_ACROSS = 3;
const BEND_ALONG = 8;
const BEND_ACROSS = 3;
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
    this.groundHeightAt = null;
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

  cellGround(cx, cz) {
    if (!this.groundHeightAt) {
      warnMissingWiring('cesty: výška země');
      return 0;
    }
    return this.groundHeightAt(cx * CELL_SIZE, cz * CELL_SIZE);
  }

  groundAt(x, z) {
    if (!this.groundHeightAt) {
      warnMissingWiring('cesty: výška země');
      return PATH_LIFT;
    }
    return this.groundHeightAt(x, z) + PATH_LIFT;
  }

  buildFromLayout(world, heightAt) {
    this.clear();
    this.groundHeightAt = typeof heightAt === 'function' ? heightAt : null;
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
        y: this.cellGround(entry.cx, entry.cz),
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
    const grid = [];
    if (across) {
      for (let i = 0; i <= STRAIGHT_ALONG; i += 1) {
        const px = x - HALF + (CELL_SIZE * i) / STRAIGHT_ALONG;
        const w = pathHalfWidth(px);
        const row = [];
        for (let j = 0; j <= STRAIGHT_ACROSS; j += 1) {
          row.push([px, z - w + (2 * w * j) / STRAIGHT_ACROSS]);
        }
        grid.push(row);
      }
    } else {
      for (let i = 0; i <= STRAIGHT_ACROSS; i += 1) {
        const row = [];
        for (let j = 0; j <= STRAIGHT_ALONG; j += 1) {
          const pz = z - HALF + (CELL_SIZE * j) / STRAIGHT_ALONG;
          const w = pathHalfWidth(pz);
          row.push([x - w + (2 * w * i) / STRAIGHT_ACROSS, pz]);
        }
        grid.push(row);
      }
    }
    this.emitGrid(list, grid);
  }

  addCross(cell, list) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const [east, north, west, south] = cell.open;

    if (east || west) {
      let x0;
      let x1;
      if (east && west) { x0 = -HALF; x1 = HALF; }
      else if (west) { x0 = -HALF; x1 = 0; }
      else { x0 = 0; x1 = HALF; }
      this.emitArmX(list, x, z, x0, x1);
    }

    if (north || south) {
      let z0;
      let z1;
      if (north && south) { z0 = -HALF; z1 = HALF; }
      else if (north) { z0 = -HALF; z1 = 0; }
      else { z0 = 0; z1 = HALF; }
      this.emitArmZ(list, x, z, z0, z1);
    }
  }

  emitArmX(list, x, z, x0, x1) {
    const grid = [];
    for (let i = 0; i <= STRAIGHT_ALONG; i += 1) {
      const px = x + x0 + ((x1 - x0) * i) / STRAIGHT_ALONG;
      const w = pathHalfWidth(px);
      const row = [];
      for (let j = 0; j <= STRAIGHT_ACROSS; j += 1) {
        row.push([px, z - w + (2 * w * j) / STRAIGHT_ACROSS]);
      }
      grid.push(row);
    }
    this.emitGrid(list, grid);
  }

  emitArmZ(list, x, z, z0, z1) {
    const grid = [];
    for (let i = 0; i <= STRAIGHT_ACROSS; i += 1) {
      const row = [];
      for (let j = 0; j <= STRAIGHT_ALONG; j += 1) {
        const pz = z + z0 + ((z1 - z0) * j) / STRAIGHT_ALONG;
        const w = pathHalfWidth(pz);
        row.push([x - w + (2 * w * i) / STRAIGHT_ACROSS, pz]);
      }
      grid.push(row);
    }
    this.emitGrid(list, grid);
  }

  emitPoints(list, grid) {
    const base = list.positions.length / 3;
    for (const row of grid) {
      for (const [x, z] of row) {
        list.positions.push(x, this.groundAt(x, z), z);
        list.uvs.push(x / UV_TILE, z / UV_TILE);
      }
    }
    return base;
  }

  emitGrid(list, grid) {
    const base = this.emitPoints(list, grid);
    const across = grid[0].length;
    for (let i = 0; i < grid.length - 1; i += 1) {
      for (let j = 0; j < across - 1; j += 1) {
        const a = base + i * across + j;
        const b = a + across;
        const c = b + 1;
        const d = a + 1;
        list.indices.push(a, b, c, a, c, d);
      }
    }
  }

  emitBendGrid(list, grid) {
    const base = this.emitPoints(list, grid);
    const across = grid[0].length;
    for (let i = 0; i < grid.length - 1; i += 1) {
      for (let j = 0; j < across - 1; j += 1) {
        const a = base + i * across + j;
        const b = a + 1;
        const c = a + across;
        const d = c + 1;
        list.indices.push(a, b, c, b, d, c);
      }
    }
  }

  addBend(cell, list) {
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
    this.addCorner(x + cornerX, z + cornerZ, start, end, wIn, wOut, list);
  }

  addCorner(cx, cz, start, end, wIn, wOut, list) {
    const grid = [];
    for (let i = 0; i <= BEND_ALONG; i += 1) {
      const t = i / BEND_ALONG;
      const a = start + (end - start) * t;
      const w = wIn + (wOut - wIn) * t;
      const rOuter = HALF - w;
      const rInner = HALF + w;
      const ox = Math.cos(a);
      const oz = Math.sin(a);
      const row = [];
      for (let j = 0; j <= BEND_ACROSS; j += 1) {
        const r = rOuter + ((rInner - rOuter) * j) / BEND_ACROSS;
        row.push([cx + ox * r, cz + oz * r]);
      }
      grid.push(row);
    }
    this.emitBendGrid(list, grid);
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
