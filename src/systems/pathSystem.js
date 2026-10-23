// Cesty — prošlapaný pruh na trávě, který se v rozích plynule stáčí a jinde vlnitě rozšiřuje.
// Kreslí jen plošky (trávu podlahy, pruh cesty a obrubu), vše ostatní dostane z mapy.
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { CELL_SIZE, cellKey } from '../utils/gridMath.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';

const PATH_LIFT = 0.02;
const GRASS_LIFT = 0.004;
const EDGE_LIFT = 0.012;
const GRASS_TILE = 5.5;
const STYLE_TILE = 1;
const EDGE_HALF = 0.3;
const CELL_HALF = 0.5;
const STEP = 0.05;
const BITE = 14;
const TURN_RADIUS = 0.6;

const CORNERS = [
  { sx: -1, sz: -1, sides: ['west', 'north'], dirs: ['north', 'west'] },
  { sx: 1, sz: -1, sides: ['east', 'north'], dirs: ['north', 'east'] },
  { sx: 1, sz: 1, sides: ['east', 'south'], dirs: ['south', 'east'] },
  { sx: -1, sz: 1, sides: ['west', 'south'], dirs: ['south', 'west'] },
];

const PATHS_LAYER = ['path', 'manual'];
const GROUND_LAYER = ['floor', 'clearing', 'grass'];
const EDGE_LAYER = ['water'];
const SIDE_NAMES = ['north', 'south', 'west', 'east'];

const SIDES = {
  north: { axis: 'z', sign: -1 },
  south: { axis: 'z', sign: 1 },
  west: { axis: 'x', sign: -1 },
  east: { axis: 'x', sign: 1 },
};

const GRASS_TEXTURE = `${ASSET_DIRS.textures}Grass004_1K-JPG_Color.jpg`;
const GRASS_TINT = new Color3(1.44, 1.4, 1.28);

const STYLE_TEXTURES = {
  dirt: `${ASSET_DIRS.pathTextures}Ground071_1K-JPG_Color.jpg`,
  stone: `${ASSET_DIRS.pathTextures}PavingStones092_1K-JPG_Color.jpg`,
  wood: `${ASSET_DIRS.pathTextures}Planks004_1K-JPG_Color.jpg`,
};

function hash(x, z) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

function stepOf(cell, side) {
  const size = SIDES[side];
  return size.axis === 'x'
    ? { cx: cell.cx + size.sign, cz: cell.cz }
    : { cx: cell.cx, cz: cell.cz + size.sign };
}

function styleOf(entry) {
  return entry.style || 'dirt';
}

function nearGroundY(ground, cx, cz) {
  let best = null;
  let bestDistance = Infinity;
  for (let ring = 1; ring <= 6 && best === null; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dz = -ring; dz <= ring; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const candidate = ground.get(cellKey(cx + dx, cz + dz));
        if (!candidate || !Number.isFinite(candidate.y)) continue;
        const distance = dx * dx + dz * dz;
        if (distance < bestDistance) {
          best = candidate.y;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}

function bodyOf(world) {
  if (!world) return null;
  if (world.path || world.manual) return world;
  if (Array.isArray(world)) return { path: world };
  return null;
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
      if (mesh && typeof mesh.isDisposed === 'function' && !mesh.isDisposed()) mesh.dispose(false, false);
    }
    this.meshes = [];
    this.materials.clear();
    this.shapes.clear();
  }

  buildPaths(world, manualEntries) {
    this.clear();
    const body = bodyOf(world);
    if (!body) return;
    const manual = manualEntries || [];
    const cells = this.collectCells(body, manual);
    if (!cells.size) return;
    const floor = this.collectLayer(body, ['floor']);
    const ground = this.collectGround(body, manual);
    const water = this.collectLayer(body, EDGE_LAYER);
    const skins = this.skinsOf(cells, ground, water);
    for (const [key, cell] of cells) {
      cell.y = this.groundYAt(ground, cell);
      cell.skin = !floor.has(key);
      this.shapes.set(key, this.shapeOf(cell, key, skins));
    }
    for (const [key, cell] of cells) {
      const shape = this.shapes.get(key);
      for (const name of SIDE_NAMES) {
        const step = stepOf(cell, name);
        const neighbour = this.shapes.get(cellKey(step.cx, step.cz));
        shape.edges[name].width = neighbour ? neighbour.width : shape.width;
        shape.edges[name].shared = Boolean(neighbour);
      }
    }
    this.buildTiles(cells);
    this.buildSurface(cells);
    this.buildEdge(cells, ground, water);
  }


  buildFromLayout(layout) {
    this.buildPaths(layout);
  }

  collectCells(body, manual) {
    const cells = new Map();
    const add = (entry, isManual) => {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) return;
      const key = cellKey(entry.cx, entry.cz);
      const known = cells.get(key);
      if (known && known.manual && !isManual) return;
      cells.set(key, {
        cx: entry.cx,
        cz: entry.cz,
        style: styleOf(entry),
        y: 0,
        manual: Boolean(isManual || (known && known.manual)),
      });
    };
    for (const name of PATHS_LAYER) for (const entry of body[name] || []) add(entry, false);
    for (const entry of manual) add(entry, true);
    return cells;
  }

  collectLayer(body, names) {
    const out = new Map();
    for (const name of names) {
      for (const entry of body[name] || []) {
        if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
        const key = cellKey(entry.cx, entry.cz);
        if (!out.has(key)) out.set(key, { cx: entry.cx, cz: entry.cz, y: entry.liftY || 0 });
      }
    }
    return out;
  }

  collectGround(body, manual) {
    const out = this.collectLayer(body, GROUND_LAYER);
    for (const entry of manual) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
      const key = cellKey(entry.cx, entry.cz);
      if (!out.has(key)) out.set(key, { cx: entry.cx, cz: entry.cz, y: entry.liftY || 0 });
    }
    return out;
  }

  skinsOf(cells, ground, water) {
    const skins = new Map();
    for (const [key, cell] of cells) {
      const list = [];
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (!dx && !dz) continue;
          const x = cell.cx + dx;
          const z = cell.cz + dz;
          const skin = { north: dz < 0, south: dz > 0, west: dx < 0, east: dx > 0 };
          const neighbourGround = ground.get(cellKey(x, z));
          if (neighbourGround) {
            if (neighbourGround.y) continue;
            const neighbourPath = cells.get(cellKey(x, z));
            if (neighbourPath) neighbourPath.y = 0;
          } else if (water.has(cellKey(x, z))) {
            skin.edge = true;
          }
          list.push(skin);
        }
      }
      skins.set(key, list);
    }
    return skins;
  }

  groundYAt(ground, cell) {
    const known = ground.get(cellKey(cell.cx, cell.cz));
    if (known && Number.isFinite(known.y) && known.y) return known.y;
    const near = nearGroundY(ground, cell.cx, cell.cz);
    return Number.isFinite(near) ? near : 0;
  }

  shapeOf(cell, key, skins) {
    const seed = cell.cx * 131 + cell.cz * 71;
    const width = clamp(0.6 + 0.16 * hash(cell.cx, cell.cz + 31), 0.52, 0.76);
    const edges = {};
    for (const name of SIDE_NAMES) {
      const shift = clamp(0.2 * hash(cell.cx * 17 + SIDES[name].sign, cell.cz * 19 + 7) - 0.1, -0.13, 0.13);
      edges[name] = { shift, width };
    }
    const body = { north: true, south: true, west: true, east: true };
    const corners = {};
    for (const corner of CORNERS) {
      const same = (a, b) => skins.get(key).some((skin) => !skin[a] || !skin[b]);
      if (!same(corner.sides[0], corner.sides[1])) continue;
      const reach = clamp(
        TURN_RADIUS * (0.85 + 0.3 * hash(seed + corner.sx * 3, seed + corner.sz * 5)),
        TURN_RADIUS * 0.7,
        TURN_RADIUS,
      );
      corners[corner.dirs.join('')] = { reach };
    }
    return { width, edges, body, corners };
  }

  buildTiles(cells) {
    const grass = { positions: [], indices: [], uvs: [] };
    for (const cell of cells.values()) {
      if (cell.skin) continue;
      this.flatTile(cell, grass, cell.y + GRASS_LIFT);
    }
    if (grass.positions.length) this.addMesh('pathGrass', grass, this.materialFor('grass'));
  }

  flatTile(cell, list, y) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const start = list.positions.length / 3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + sx;
      const pz = z + sz;
      list.positions.push(px, y, pz);
      list.uvs.push(px / GRASS_TILE, pz / GRASS_TILE);
    }
    list.indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }

  buildSurface(cells) {
    const groups = new Map();
    for (const [key, cell] of cells) {
      const shape = this.shapes.get(key);
      if (!shape) continue;
      let list = groups.get(cell.style);
      if (!list) {
        list = { positions: [], indices: [], uvs: [] };
        groups.set(cell.style, list);
      }
      this.paintOutline(shape, cell, list, PATH_LIFT);
    }
    for (const [style, list] of groups) {
      if (!list.positions.length) continue;
      this.addMesh(`path_${style}`, list, this.materialFor(style));
    }
  }

  buildEdge(cells, ground, water) {
    const ink = { positions: [], indices: [], uvs: [] };
    for (const [key, cell] of cells) {
      if (!ground.get(key)) continue;
      this.boxTile(cell, EDGE_HALF, EDGE_LIFT, ink);
      for (const name of SIDE_NAMES) {
        const step = stepOf(cell, name);
        if (water.has(cellKey(step.cx, step.cz))) this.stretchTile(cell, name, ink, EDGE_LIFT + 0.002);
      }
    }
    if (!ink.positions.length) return;
    this.addMesh('pathEdge', ink, this.materialFor('stone'));
  }

  boxTile(cell, half, lift, list) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + lift;
    const start = list.positions.length / 3;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const px = x + sx * half;
      const pz = z + sz * half;
      list.positions.push(px, y, pz);
      list.uvs.push(px / STYLE_TILE, pz / STYLE_TILE);
    }
    list.indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }

  stretchTile(cell, side, list, lift) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + lift;
    const inner = CELL_SIZE / 2 - EDGE_HALF;
    const corners = {
      north: [[-1, -1], [1, -1], [1, -inner], [-1, -inner]],
      south: [[-1, inner], [1, inner], [1, 1], [-1, 1]],
      west: [[-1, -1], [-inner, -1], [-inner, 1], [-1, 1]],
      east: [[inner, -1], [1, -1], [1, 1], [inner, 1]],
    }[side];
    const start = list.positions.length / 3;
    for (const [sx, sz] of corners) {
      const px = x + (sx * CELL_SIZE) / 2;
      const pz = z + (sz * CELL_SIZE) / 2;
      list.positions.push(px, y, pz);
      list.uvs.push(px / STYLE_TILE, pz / STYLE_TILE);
    }
    list.indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
  }

  paintOutline(shape, cell, list, lift) {
    const x = cell.cx * CELL_SIZE;
    const z = cell.cz * CELL_SIZE;
    const y = cell.y + lift;
    const mask = this.maskOf(shape);
    for (let row = 0; row < BITE; row += 1) {
      for (let col = 0; col < BITE; col += 1) {
        if (!mask[row * BITE + col]) continue;
        const x0 = col / BITE - 0.5;
        const z0 = row / BITE - 0.5;
        const size = 1 / BITE;
        const start = list.positions.length / 3;
        for (const [dx, dz] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
          const px = x + (x0 + dx * size) * CELL_SIZE;
          const pz = z + (z0 + dz * size) * CELL_SIZE;
          list.positions.push(px, y, pz);
          list.uvs.push(px / STYLE_TILE, pz / STYLE_TILE);
        }
        list.indices.push(start, start + 2, start + 1, start, start + 3, start + 2);
      }
    }
  }

  maskOf(shape) {
    if (shape.mask) return shape.mask;
    const mask = new Uint8Array(BITE * BITE);
    for (let row = 0; row < BITE; row += 1) {
      for (let col = 0; col < BITE; col += 1) {
        const px = (col + 0.5) / BITE - 0.5;
        const pz = (row + 0.5) / BITE - 0.5;
        if (this.inside(shape, px, pz)) mask[row * BITE + col] = 1;
      }
    }
    shape.mask = mask;
    return mask;
  }

  inside(shape, px, pz) {
    const half = shape.width;
    const inBody = Math.abs(px) <= half && Math.abs(pz) <= half;
    if (inBody) return !this.inCorner(shape, px, pz);
    const ax = Math.abs(px);
    const az = Math.abs(pz);
    if (ax <= half && az <= half) return false;
    if (ax > half && az > half) return this.onCorner(shape, px, pz);
    const side = az > ax ? (pz > 0 ? 'south' : 'north') : (px > 0 ? 'east' : 'west');
    return this.onEdge(shape, side, px, pz);
  }

  onEdge(shape, side, px, pz) {
    const axis = SIDES[side].axis;
    const sign = SIDES[side].sign;
    const out = sign * (axis === 'x' ? px : pz);
    const along = axis === 'x' ? pz : px;
    if (out < shape.width) return true;
    if (out > CELL_HALF + STEP) return false;
    const edge = shape.edges[side];
    if (edge.shared) return true;
    return Math.abs(along - edge.shift) <= shape.width;
  }

  inCorner(shape, px, pz) {
    for (const key of Object.keys(shape.corners)) {
      const corner = CORNERS.find((item) => item.dirs.join('') === key);
      if (!corner) continue;
      const dx = px - corner.sx * shape.width;
      const dz = pz - corner.sz * shape.width;
      if (Math.hypot(dx, dz) > shape.corners[key].reach) continue;
      return true;
    }
    return false;
  }

  onCorner(shape, px, pz) {
    for (const key of Object.keys(shape.corners)) {
      const corner = CORNERS.find((item) => item.dirs.join('') === key);
      if (!corner) continue;
      const dx = px - corner.sx * CELL_HALF;
      const dz = pz - corner.sz * CELL_HALF;
      if (Math.hypot(dx, dz) <= shape.corners[key].reach) return true;
    }
    return false;
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
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.material = material;
    this.meshes.push(mesh);
    return mesh;
  }

  materialFor(key) {
    let mat = this.materials.get(key);
    if (mat && typeof mat.isDisposed === 'function' && !mat.isDisposed()) return mat;
    mat = new StandardMaterial(`path_${key}`, this.s);
    const url = key === 'grass' ? GRASS_TEXTURE : (STYLE_TEXTURES[key] || STYLE_TEXTURES.dirt);
    const texture = new Texture(url, this.s);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    mat.diffuseTexture = texture;
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    mat.ambientColor = new Color3(0.08, 0.1, 0.08);
    mat.diffuseColor = key === 'grass' ? GRASS_TINT.clone() : new Color3(1, 1, 1);
    this.materials.set(key, mat);
    return mat;
  }
}
