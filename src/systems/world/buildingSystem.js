// Stavby ve světě — z mapy a katalogu staveb postaví podlahu na kůlech, stěny z klád s otvory,
// patro s místností a pavlačí, střechu, terasu se schody a pirátské věci, a místa, kde stavbu
// porůstá tráva a liány. Stavba se skládá v neotočené poloze kolem svého středu
// a celá se pak otočí podle mapy. Zná výšku podlah, po kterých se chodí, a stěny se zábradlím,
// které postavu zastaví.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Material } from '@babylonjs/core/Materials/material';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE, cellKey } from '../../utils/gridMath.js';
import { getBuilding, buildingSize } from '../../data/catalogs/buildings.js';
import { createRng, seedFor } from '../../utils/rng.js';
import { valueNoise, smoothstep } from '../../utils/noise.js';
import { logEndTexture } from '../../utils/logEndTexture.js';
import { createBuffer, meshFromBuffer, pushLog, pushLogEnd } from '../../utils/buildingGeometry.js';
import buildingFloorParts from './buildingFloor.js';
import buildingWallsParts from './buildingWalls.js';
import buildingPorchParts from './buildingPorch.js';
import buildingUpperParts from './buildingUpper.js';
import buildingPropsParts from './buildingProps.js';
import buildingRoofParts from './buildingRoof.js';
import buildingGrowthParts from './buildingGrowth.js';

const GROUND_SAMPLE = 0.5;
const GROUND_INSET = 0.3;
const WALK_MARGIN = 0.05;
const STEP_UP = 0.7;
const BLOCK_FEET_CLEAR = 0.25;
const BLOCK_BODY_HEIGHT = 1.6;

export default class BuildingSystem {

  constructor(scene) {
    this.s = scene;
    this.meshes = [];
    this.roots = [];
    this.anchors = [];
    this.grass = [];
    this.decks = [];
    this.materials = new Map();
    this.floorKeys = new Map();
    this.groundHeightAt = null;
    this.onMesh = null;
  }

  clear() {
    for (const root of this.roots) root.dispose(false, false);
    this.roots = [];
    this.meshes = [];
    this.anchors = [];
    this.grass = [];
    this.decks = [];
    this.floorKeys.clear();
  }

  build(layout) {
    this.clear();
    for (const entry of (layout && layout.buildings) || []) this.buildOne(entry);
  }

  floorKeyAt(cx, cz) {
    return this.floorKeys.get(cellKey(cx, cz)) || null;
  }

  walkHeightAt(x, z, fromY = Infinity) {
    const reach = fromY + STEP_UP;
    let best = null;
    for (const deck of this.decks) {
      const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
      for (const rect of deck.rects) {
        if (p.x < rect.x0 - WALK_MARGIN || p.x > rect.x1 + WALK_MARGIN || p.z < rect.z0 - WALK_MARGIN || p.z > rect.z1 + WALK_MARGIN) continue;
        const y = deck.top + rect.y;
        if (y <= reach && (best === null || y > best)) best = y;
      }
    }
    return best;
  }

  wallGapAt(x, z, feetY) {
    let best = Infinity;
    for (const deck of this.decks) {
      const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
      const feet = feetY - deck.top;
      for (const block of deck.blocks) {
        if (feet + BLOCK_FEET_CLEAR >= block.top || feet + BLOCK_BODY_HEIGHT <= block.bottom) continue;
        const along = block.alongX ? p.x : p.z;
        const across = Math.abs((block.alongX ? p.z : p.x) - block.at);
        const past = Math.max(0, block.from - along, along - block.to);
        const gap = Math.hypot(past, Math.max(0, across - block.half));
        if (gap < best) best = gap;
      }
    }
    return best;
  }

  keepsClear(x, z, margin = 0) {
    for (const deck of this.decks) {
      const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
      for (const box of deck.clear) {
        if (p.x > box.x0 - margin && p.x < box.x1 + margin && p.z > box.z0 - margin && p.z < box.z1 + margin) return true;
      }
    }
    return false;
  }

  addBlock(plan, place, from, to, bottom, top, half) {
    const start = place(0, 0, 0);
    const alongX = place(1, 0, 0)[0] !== start[0];
    const at = alongX ? start[2] : start[0];
    plan.blocks.push({ alongX, at, from: Math.min(from, to), to: Math.max(from, to), bottom, top, half });
  }

  vineAnchors() {
    return this.anchors;
  }

  grassSpots() {
    return this.grass;
  }

  addGrassSpot(plan, x, y, z, species, size) {
    const point = Vector3.TransformCoordinates(new Vector3(x, y, z), plan.world);
    this.grass.push({ x: point.x, y: point.y, z: point.z, species, size });
  }

  woodMaterial(name, texturePath, normalPath) {
    if (this.materials.has(name)) return this.materials.get(name);
    const material = new StandardMaterial(name, this.s);
    const color = new Texture(texturePath, this.s);
    color.wrapU = Texture.WRAP_ADDRESSMODE;
    color.wrapV = Texture.WRAP_ADDRESSMODE;
    color.anisotropicFilteringLevel = 4;
    material.diffuseTexture = color;
    if (normalPath) {
      const bump = new Texture(normalPath, this.s);
      bump.wrapU = Texture.WRAP_ADDRESSMODE;
      bump.wrapV = Texture.WRAP_ADDRESSMODE;
      bump.gammaSpace = false;
      material.bumpTexture = bump;
    }
    material.specularColor = new Color3(0.03, 0.03, 0.03);
    this.materials.set(name, material);
    return material;
  }

  drawnMaterial(name, draw, cutout) {
    if (this.materials.has(name)) return this.materials.get(name);
    const material = new StandardMaterial(name, this.s);
    material.diffuseTexture = draw();
    material.specularColor = new Color3(0.02, 0.02, 0.02);
    if (cutout) {
      material.diffuseTexture.hasAlpha = true;
      material.useAlphaFromDiffuseTexture = true;
      material.transparencyMode = Material.MATERIAL_ALPHATEST;
      material.alphaCutOff = 0.4;
      material.backFaceCulling = false;
      material.twoSidedLighting = true;
    }
    this.materials.set(name, material);
    return material;
  }

  groundSpan(x0, x1, z0, z1) {
    let low = Infinity;
    let high = -Infinity;
    for (let x = x0 + GROUND_INSET; x <= x1 - GROUND_INSET + 1e-6; x += GROUND_SAMPLE) {
      for (let z = z0 + GROUND_INSET; z <= z1 - GROUND_INSET + 1e-6; z += GROUND_SAMPLE) {
        const y = this.groundHeightAt ? this.groundHeightAt(x, z) : 0;
        if (!Number.isFinite(y)) continue;
        low = Math.min(low, y);
        high = Math.max(high, y);
      }
    }
    return Number.isFinite(low) ? { low, high } : { low: 0, high: 0 };
  }

  agePaint(age, seed) {
    const offset = (seed % 1000) * 0.37;
    return (base, x, y, z, up, extra = 0, weather = 0) => {
      const patch = valueNoise(x * age.noiseScale + offset, z * age.noiseScale + y * age.noiseScale * 0.7);
      const low = 1 - smoothstep(0, age.mossHeight, y);
      const moss = Math.min(1, smoothstep(0.35, 0.8, patch) * (low * 0.8 + Math.max(0, up) * 0.45 + extra) * age.mossAmount);
      const grime = 1 - age.grime * (1 - smoothstep(-0.2, 0.7, y)) * (0.6 + 0.4 * patch);
      const along = x + z;
      const peel = smoothstep(0.5, 0.57, valueNoise(along * age.bleachScale + offset * 1.7, y * age.bleachScale * 2.4)) * age.bleachAmount * weather;
      const streak = 1 - age.streak * weather * smoothstep(0.5, 0.9, valueNoise(along * age.streakScale + offset * 2.3, y * 0.35)) * (0.4 + 0.6 * smoothstep(0, 2.5, y));
      return [0, 1, 2].map((i) => {
        const worn = base[i] * (1 - peel + peel * age.bleach[i]) * streak;
        return (worn * (1 - moss) + age.moss[i] * moss) * grime;
      });
    };
  }

  addVineAnchor(plan, x, y, z, dirX, dirZ, drop, chance, look = 'hang', shape = null) {
    const point = Vector3.TransformCoordinates(new Vector3(x, y, z), plan.world);
    const dir = Vector3.TransformNormal(new Vector3(dirX, 0, dirZ), plan.world);
    const anchor = { x: point.x, y: point.y, z: point.z, dirX: Math.round(dir.x), dirZ: Math.round(dir.z), drop, chance, look };
    if (shape) {
      const along = Vector3.TransformNormal(new Vector3(shape.alongX, 0, shape.alongZ), plan.world);
      Object.assign(anchor, { shape: shape.kind, alongX: along.x, alongZ: along.z, span: shape.span, out: shape.out || 0 });
    }
    this.anchors.push(anchor);
  }

  addLog(plan, log, place, base, capFrom = true, capTo = true) {
    const walls = plan.walls;
    const paint = (x, y, z, up) => plan.paint(base, x, y, z, up, 0, walls.weather);
    const rings = pushLog(plan.logs, log, place, paint, walls.tile);
    if (capFrom) pushLogEnd(plan.ends, rings[0], log.sides, plan.rng() * Math.PI * 2, -1, place, paint);
    if (capTo) pushLogEnd(plan.ends, rings[rings.length - 1], log.sides, plan.rng() * Math.PI * 2, 1, place, paint);
    return rings;
  }

  logShade(plan) {
    const shade = 1 + (plan.rng() - 0.5) * plan.walls.shadeSpread;
    return plan.walls.tint.map((value) => value * shade);
  }

  buildOne(entry) {
    const def = getBuilding(entry && entry.key);
    const size = buildingSize(entry);
    if (!def || !size || !def.floor || !def.walls) return;
    const half = CELL_SIZE / 2;
    const x0 = entry.cx * CELL_SIZE - half;
    const z0 = entry.cz * CELL_SIZE - half;
    const worldWidth = size.width * CELL_SIZE;
    const worldDepth = size.depth * CELL_SIZE;
    const ground = this.groundSpan(x0, x0 + worldWidth, z0, z0 + worldDepth);
    const top = ground.high + def.floor.lift;
    const name = `building_${entry.key}_${entry.cx}_${entry.cz}`;

    const root = new TransformNode(name, this.s);
    root.rotation.y = ((((entry.rotation || 0) % 4) + 4) % 4) * (Math.PI / 2);
    const shift = def.shift || [0, 0];
    const turned = Vector3.TransformNormal(new Vector3(shift[0], 0, shift[1]), root.computeWorldMatrix(true));
    root.position.set(x0 + worldWidth / 2 + turned.x, top, z0 + worldDepth / 2 + turned.z);
    this.roots.push(root);
    const world = root.computeWorldMatrix(true);

    const seed = seedFor(0, entry.key, entry.cx, entry.cz);
    const plan = {
      key: entry.key,
      name,
      root,
      world,
      top,
      width: def.width * CELL_SIZE,
      depth: def.depth * CELL_SIZE,
      rng: createRng(seed),
      paint: this.agePaint(def.age, seed),
      walls: def.walls,
      growth: def.growth || null,
      porchDepth: def.porch ? def.porch.depth : 0,
      keepClear: [],
      logs: createBuffer(),
      ends: createBuffer(),
      planks: createBuffer(),
      sheets: [],
      walk: [],
      blocks: [],
    };
    plan.groundAt = (x, z) => {
      const point = Vector3.TransformCoordinates(new Vector3(x, 0, z), world);
      const y = this.groundHeightAt ? this.groundHeightAt(point.x, point.z) : top;
      return (Number.isFinite(y) ? y : top) - top;
    };

    this.buildFloor(plan, def.floor);
    this.buildWalls(plan, def.walls);
    if (def.upper) this.buildUpper(plan, def.upper, def.floor);
    if (def.porch) this.buildPorch(plan, def.porch, def.floor);
    if (def.roof) this.buildRoof(plan, def.roof);
    if (def.props) this.buildProps(plan, def.props);
    if (def.growth) this.overgrow(plan, def.growth);

    this.addMesh(plan, 'planks', plan.planks, this.woodMaterial(`buildingPlankMat_${entry.key}`, def.floor.texture, null));
    this.addMesh(plan, 'logs', plan.logs, this.woodMaterial(`buildingLogMat_${entry.key}`, def.walls.texture, def.walls.normal));
    this.addMesh(plan, 'logEnds', plan.ends, this.drawnMaterial(`buildingLogEndMat_${entry.key}`, () => logEndTexture(this.s, `buildingLogEnd_${entry.key}`, def.walls.ends), false));
    for (const sheet of plan.sheets) this.addMesh(plan, sheet.suffix, sheet.buffer, sheet.material);

    const deck = { inverse: world.clone().invert(), world, top, rects: plan.walk, blocks: plan.blocks, clear: plan.keepClear };
    this.decks.push(deck);
    this.markFloorCells(deck, def.floor.stepKey);
  }

  markFloorCells(deck, stepKey) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const rect of deck.rects) {
      for (const [x, z] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
        const point = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.world);
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
      }
    }
    for (let cx = Math.round(minX / CELL_SIZE); cx <= Math.round(maxX / CELL_SIZE); cx++) {
      for (let cz = Math.round(minZ / CELL_SIZE); cz <= Math.round(maxZ / CELL_SIZE); cz++) {
        if (this.walkHeightAt(cx * CELL_SIZE, cz * CELL_SIZE) !== null) this.floorKeys.set(cellKey(cx, cz), stepKey);
      }
    }
  }

  addMesh(plan, suffix, buffer, material) {
    const mesh = meshFromBuffer(`${plan.name}_${suffix}`, buffer, this.s);
    if (!mesh) return null;
    mesh.parent = plan.root;
    mesh.material = material;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.metadata = { building: true };
    this.meshes.push(mesh);
    if (this.onMesh) this.onMesh(mesh);
    return mesh;
  }
}

Object.assign(BuildingSystem.prototype, buildingFloorParts, buildingWallsParts, buildingUpperParts, buildingRoofParts, buildingPorchParts, buildingPropsParts, buildingGrowthParts);
