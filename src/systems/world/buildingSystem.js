// Stavby ve světě — z mapy a katalogu staveb postaví podlahu na kůlech, stěny z klád s otvory,
// patro s místností a pavlačí, střechu, terasu se schody a pirátské věci, a místa, kde stavbu
// porůstá tráva a liány. Stavba se skládá v neotočené poloze kolem svého středu
// a celá se pak otočí podle mapy. Zná výšku podlah, po kterých se chodí, a stěny se zábradlím,
// které postavu zastaví, a dveře, které jdou otevřít. Skládá se ve vrstvách (přízemí, patro, střecha); když je postava uvnitř,
// vrstvy nad ní plynule zmizí.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Material } from '@babylonjs/core/Materials/material';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CELL_SIZE, cellKey } from '../../utils/gridMath.js';
import { getBuilding, buildingSize } from '../../data/catalogs/buildings.js';
import { createRng, seedFor } from '../../utils/rng.js';
import { agePaint } from '../../utils/agePaint.js';
import { logEndTexture } from '../../utils/logEndTexture.js';
import { createBuffer, meshFromBuffer, pushLog, pushLogEnd, insideOutline } from '../../utils/buildingGeometry.js';
import buildingFloorParts from './buildingFloor.js';
import buildingWallsParts from './buildingWalls.js';
import buildingPorchParts from './buildingPorch.js';
import buildingUpperParts from './buildingUpper.js';
import buildingPropsParts from './buildingProps.js';
import buildingRoofParts from './buildingRoof.js';
import buildingGrowthParts from './buildingGrowth.js';
import buildingDoorsParts from './buildingDoors.js';
import buildingFurnitureParts from './buildingFurniture.js';
import buildingLampsParts from './buildingLamps.js';
import buildingPirateParts from './buildingPirate.js';

const GROUND_SAMPLE = 0.5;
const GROUND_INSET = 0.3;
const WALK_MARGIN = 0.05;
const STEP_UP = 0.7;
const BLOCK_FEET_CLEAR = 0.25;
const BLOCK_BODY_HEIGHT = 1.6;
const LAYERS = ['lower', 'upper', 'roof'];
const LAYER_FADE_SECONDS = 0.4;
const LOWER_FEET_BELOW_UPPER = 1;
const ROOM_FEET_BELOW_UPPER = 0.5;

export default class BuildingSystem {

  constructor(scene) {
    this.s = scene;
    this.meshes = [];
    this.roots = [];
    this.anchors = [];
    this.grass = [];
    this.decks = [];
    this.doors = [];
    this.stations = [];
    this.lamps = [];
    this.openDoors = new Set();
    this.litLamps = new Set();
    this.dayness = 1;
    this.onLightSource = null;
    this.hovered = null;
    this.doorShutLead = 0;
    this.onDoorShut = null;
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
    this.doors = [];
    this.stations = [];
    this.dropLamps();
    this.hovered = null;
    this.floorKeys.clear();
  }

  build(layout) {
    this.clear();
    for (const entry of (layout && layout.buildings) || []) this.buildOne(entry);
  }

  nearCell(x, z) {
    const cx = Math.round(x / CELL_SIZE);
    const cz = Math.round(z / CELL_SIZE);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (this.floorKeys.has(cellKey(cx + dx, cz + dz))) return true;
      }
    }
    return false;
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

  deckAt(x, z, storey = null) {
    let best = null;
    for (const deck of this.decks) {
      const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
      const upperFrom = Number.isFinite(deck.upperTop) ? deck.upperTop - ROOM_FEET_BELOW_UPPER : Infinity;
      for (const rect of deck.rects) {
        if (p.x < rect.x0 || p.x > rect.x1 || p.z < rect.z0 || p.z > rect.z1) continue;
        const level = rect.y >= upperFrom ? 'upper' : 'lower';
        if (storey === 'lower' && level === 'upper') continue;
        const y = deck.top + rect.y;
        if (!best || y > best.y) best = { y, storey: level, deck };
      }
    }
    return best;
  }

  deckOnRay(origin, direction, storey = null) {
    if (direction.y > -1e-4) return null;
    let best = null;
    for (const deck of this.decks) {
      const upperFrom = Number.isFinite(deck.upperTop) ? deck.upperTop - ROOM_FEET_BELOW_UPPER : Infinity;
      for (const rect of deck.rects) {
        const level = rect.y >= upperFrom ? 'upper' : 'lower';
        if (storey === 'lower' && level === 'upper') continue;
        const y = deck.top + rect.y;
        const t = (y - origin.y) / direction.y;
        if (t <= 0 || (best && t >= best.t)) continue;
        const x = origin.x + direction.x * t;
        const z = origin.z + direction.z * t;
        const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
        if (p.x < rect.x0 || p.x > rect.x1 || p.z < rect.z0 || p.z > rect.z1) continue;
        best = { t, x, y, z, storey: level };
      }
    }
    return best;
  }

  storeyShownAt(x, z, storey) {
    const found = this.deckAt(x, z);
    const part = found ? found.deck.parts[storey] : null;
    return !part || part.shown >= 0.5;
  }

  updateInside(dt, position, eye, storey = null) {
    const step = Math.max(0, dt) / LAYER_FADE_SECONDS;
    let flipped = false;
    for (const deck of this.decks) {
      const hide = this.partsToHide(deck, position, eye, storey);
      for (const [key, part] of Object.entries(deck.parts)) {
        const target = hide.has(key) ? 0 : 1;
        if (part.shown === target) continue;
        const wasShown = part.shown >= 0.5;
        part.shown = target > part.shown ? Math.min(1, part.shown + step) : Math.max(0, part.shown - step);
        for (const mesh of part.meshes) this.showMesh(mesh);
        if ((part.shown >= 0.5) !== wasShown) flipped = true;
      }
    }
    return flipped ? this.hiddenGroups() : null;
  }

  storeyInside(deck, position) {
    if (!position) return null;
    const p = Vector3.TransformCoordinates(new Vector3(position.x, 0, position.z), deck.inverse);
    const feet = position.y - deck.top;
    const upper = deck.upperTop;
    const room = deck.room;
    if (insideOutline(deck.outline, p.x, p.z) && (!Number.isFinite(upper) || feet < upper - LOWER_FEET_BELOW_UPPER)) return 'lower';
    if (room && feet > upper - ROOM_FEET_BELOW_UPPER && p.x > room.x0 && p.x < room.x1 && p.z > room.z0 && p.z < room.z1) return 'upper';
    return null;
  }

  shelterAt(position) {
    return this.decks.some((deck) => this.storeyInside(deck, position) !== null);
  }

  partsToHide(deck, position, eye, storey = null) {
    const hide = new Set();
    const inside = storey || this.storeyInside(deck, position);
    if (inside === 'lower') hide.add('upper');
    if (inside) hide.add('roof');
    if (!inside || !eye) return hide;
    const view = Vector3.TransformCoordinates(eye, deck.inverse);
    for (const [key, part] of Object.entries(deck.parts)) {
      if (part.layer !== inside || !part.side) continue;
      const out = ((part.alongX ? view.z : view.x) - part.at) * part.outward;
      if (out > 0) hide.add(key);
    }
    return hide;
  }

  hiddenGroups() {
    const groups = new Set();
    for (const deck of this.decks) {
      for (const [key, part] of Object.entries(deck.parts)) {
        const layer = part.layer ? deck.parts[part.layer] : null;
        if (part.shown < 0.5 || (layer && layer.shown < 0.5)) groups.add(`${deck.name}:${key}`);
      }
    }
    return groups;
  }

  showMesh(mesh) {
    const { fadeLate: late, parts } = mesh.metadata;
    const shown = Math.min(...parts.map((part) => part.shown));
    const visibility = late ? Math.min(1, shown * 2) : Math.max(0, shown * 2 - 1);
    mesh.visibility = visibility;
    mesh.setEnabled(visibility > 0.001);
  }

  useLayer(plan, name) {
    plan.layer = name;
    this.usePart(plan, name);
  }

  useWallTop(plan, run) {
    const key = `${plan.layer}|${run.side}@${run.at}`;
    if (!plan.parts[key]) {
      plan.parts[key] = { meshes: [], shown: 1, layer: plan.layer, side: run.side, alongX: run.alongX, at: run.at, outward: run.outward };
    }
    this.usePart(plan, key);
  }

  usePart(plan, key) {
    if (!plan.buffers[key]) plan.buffers[key] = { logs: createBuffer(), ends: createBuffer(), planks: createBuffer(), painted: createBuffer() };
    Object.assign(plan, plan.buffers[key]);
    plan.part = key;
  }

  wallGapAt(x, z, feetY) {
    let best = Infinity;
    for (const deck of this.decks) {
      const p = Vector3.TransformCoordinates(new Vector3(x, 0, z), deck.inverse);
      const feet = feetY - deck.top;
      for (const block of deck.blocks) {
        if (block.door && block.door.kind === 'hinge' && block.door.goal > 0) continue;
        if (feet + BLOCK_FEET_CLEAR >= block.top || feet + BLOCK_BODY_HEIGHT <= block.bottom) continue;
        const shift = block.door ? this.doorShift(block.door) : 0;
        const along = (block.alongX ? p.x : p.z) - shift;
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

  paintMaterial(name) {
    if (this.materials.has(name)) return this.materials.get(name);
    const material = new StandardMaterial(name, this.s);
    material.specularColor = new Color3(0.04, 0.04, 0.04);
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

  addVineAnchor(plan, x, y, z, dirX, dirZ, drop, chance, look = 'hang', shape = null) {
    const point = Vector3.TransformCoordinates(new Vector3(x, y, z), plan.world);
    const dir = Vector3.TransformNormal(new Vector3(dirX, 0, dirZ), plan.world);
    const anchor = { x: point.x, y: point.y, z: point.z, dirX: Math.round(dir.x), dirZ: Math.round(dir.z), drop, chance, look, group: `${plan.name}:${plan.part}` };
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
      paint: agePaint(def.age, seed),
      walls: def.walls,
      growth: def.growth || null,
      netColors: def.props ? def.props.netColors : null,
      porchDepth: def.porch ? def.porch.depth : 0,
      keepClear: [],
      buffers: {},
      parts: Object.fromEntries(LAYERS.map((layer) => [layer, { meshes: [], shown: 1, layer: null }])),
      sheets: [],
      walk: [],
      blocks: [],
      doorList: [],
      stationList: [],
    };
    plan.groundAt = (x, z) => {
      const point = Vector3.TransformCoordinates(new Vector3(x, 0, z), world);
      const y = this.groundHeightAt ? this.groundHeightAt(point.x, point.z) : top;
      return (Number.isFinite(y) ? y : top) - top;
    };

    this.useLayer(plan, 'lower');
    this.buildFloor(plan, def.floor);
    this.buildWalls(plan, def.walls);
    if (def.upper) this.buildUpper(plan, def.upper, def.floor);
    this.useLayer(plan, 'lower');
    if (def.porch) this.buildPorch(plan, def.porch, def.floor);
    if (def.roof) {
      this.useLayer(plan, 'roof');
      this.buildRoof(plan, def.roof);
      this.useLayer(plan, 'lower');
    }
    if (def.props) this.buildProps(plan, def.props);
    if (def.furniture) this.buildFurniture(plan, def.furniture);
    if (def.growth) this.overgrow(plan, def.growth);

    const plankMat = this.woodMaterial(`buildingPlankMat_${entry.key}`, def.floor.texture, null);
    const logMat = this.woodMaterial(`buildingLogMat_${entry.key}`, def.walls.texture, def.walls.normal);
    const endMat = this.drawnMaterial(`buildingLogEndMat_${entry.key}`, () => logEndTexture(this.s, `buildingLogEnd_${entry.key}`, def.walls.ends), false);
    const paintMat = this.paintMaterial(`buildingPaintMat_${entry.key}`);
    for (const [key, buffers] of Object.entries(plan.buffers)) {
      const suffix = key.replace('|', '_');
      this.addMesh(plan, `planks_${suffix}`, buffers.planks, plankMat, key, true);
      this.addMesh(plan, `logs_${suffix}`, buffers.logs, logMat, key);
      this.addMesh(plan, `logEnds_${suffix}`, buffers.ends, endMat, key);
      this.addMesh(plan, `painted_${suffix}`, buffers.painted, paintMat, key);
    }
    for (const sheet of plan.sheets) this.addMesh(plan, sheet.suffix, sheet.buffer, sheet.material, sheet.part || 'lower');
    this.finishDoors(plan, { planks: plankMat, paint: this.paintMaterial(`buildingPaintMat_${entry.key}`) });
    this.finishStations(plan, { planks: plankMat, paint: this.paintMaterial(`buildingPaintMat_${entry.key}`) });

    const deck = {
      name,
      inverse: world.clone().invert(),
      world,
      top,
      rects: plan.walk,
      blocks: plan.blocks,
      clear: plan.keepClear,
      parts: plan.parts,
      outline: plan.outline,
      upperTop: plan.upperTop,
      room: plan.upperRoom || null,
    };
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

  addMesh(plan, suffix, buffer, material, part = 'lower', late = false) {
    const mesh = meshFromBuffer(`${plan.name}_${suffix}`, buffer, this.s);
    if (!mesh) return null;
    mesh.parent = plan.root;
    mesh.material = material;
    mesh.isPickable = false;
    this.addPartMesh(plan, mesh, part, late);
    return mesh;
  }

  addPartMesh(plan, mesh, key, late = false) {
    const part = plan.parts[key];
    const parts = part.layer ? [part, plan.parts[part.layer]] : [part];
    mesh.receiveShadows = true;
    mesh.metadata = { building: true, fadeLate: late, parts };
    this.meshes.push(mesh);
    for (const owner of parts) owner.meshes.push(mesh);
    this.showMesh(mesh);
    if (this.onMesh) this.onMesh(mesh);
  }
}

Object.assign(BuildingSystem.prototype, buildingFloorParts, buildingWallsParts, buildingUpperParts, buildingRoofParts, buildingPorchParts, buildingPropsParts, buildingGrowthParts, buildingDoorsParts, buildingFurnitureParts, buildingLampsParts, buildingPirateParts);
