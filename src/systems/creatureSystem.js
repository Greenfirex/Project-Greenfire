// Tvorové ve světě — načte model, rozhoduje v pevném tiku a plynule ho hýbe.
// Nedrží žádný jiný systém; výšku terénu, průchodnost a hráče dostane od scény.
import { loadContainer } from '../utils/assetLoader.js';
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Rendering/outlineRenderer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { createCreatureMarker, setMarkerIcon } from '../utils/creatureMarker.js';
import { rollStrike, CRIT_MULTIPLIER } from '../utils/combatRoll.js';
import {
  getCreatureType,
  getCreatureTier,
  creatureLength,
  creatureStat,
  creatureScale,
  tierTint,
} from '../data/catalogs/creatures/index.js';
import { cellToWorldCoords, worldToCell, CELL_SIZE } from '../utils/gridMath.js';
import { findCellPath } from '../utils/gridPath.js';

const TURN_SPEED = 7;
const EMERGE_TURN_SPEED = 18;
const TURN_STEP_GAP = 0.12;
const RENDER_SMOOTHING = 0.001;
const SPOT_STEP = 0.5;
const SPOT_REACH = 12;
const PATH_SAMPLE = 0.3;
const CHASE_STUCK_SECONDS = 1.2;
const HOME_PATIENCE = 12;
const ARRIVE = 0.12;
const PATH_REPLAN = 0.8;
const PATH_RETRY = 0.15;
const PATH_REACH = 0.35;
const PATH_NODE_LIMIT = 700;
const PATH_MARGIN = 16;
const PATH_LOOKAHEAD = 16;
const SMOOTH_SPAN = 8;
const CELL_KEY_OFFSET = 4096;
const CELL_KEY_SPAN = 8192;
const STUCK_ESCAPE_SECONDS = 0.8;
const CREATURE_WALL_MARGIN = 0.3;
const RISE_RATE = 2.2;
const FALL_RATE = 6;
const SLIDE_ANGLES = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI / 2, -Math.PI / 2];
const NEIGHBOURS_8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const OUTLINE_WIDTH = 0.038;
const OUTLINE_PULSE = 0.012;
const OUTLINE_FADE = 8;
const OUTLINE_ALERT_SPEED = 4.5;
const OUTLINE_COMBAT_SPEED = 8;
const OUTLINE_COMBAT_SCALE = 1.35;
const COMBAT_MARK_SECONDS = 1;
const MARK_HEIGHT = 0.22;
const MARK_BOB = 0.02;
const MARK_PULSE = 0.06;
const MARK_SPEED = 3;
const ALERT_COLOR = new Color3(1, 0.78, 0.25);
const COMBAT_COLOR = new Color3(0.92, 0.16, 0.12);
const RESPAWN_CLEAR = 1.5;
const CORPSE_LIFETIME = 200;
const CORPSE_FALL = 0.5;
const CORPSE_SINK = 2.4;
const CORPSE_LOOT_SINK_DELAY = 1.4;
const CORPSE_TILT = Math.PI / 2;
const CORPSE_GROUND_MARGIN = 0.02;
const CORPSE_GROUND_SAMPLE = 0.35;
const CORPSE_OUTLINE_COLOR = new Color3(0.95, 0.95, 0.92);
const CORPSE_OUTLINE_WIDTH = 0.03;
const CORPSE_OUTLINE_REACH = 5;

function slotKeyOf(kind, tierKey, cx, cz) {
  return `${kind}|${tierKey}|${cx}|${cz}`;
}

function turnToward(current, target, maxDelta) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

export default class CreatureSystem {

  constructor(scene) {
    this.s = scene;
    this.creatures = [];
    this.corpses = [];
    this.meshes = [];
    this.pickMeshes = [];
    this.pickOwner = new Map();
    this.slots = new Map();
    this.containers = new Map();
    this.groundHeightAt = null;
    this.walkableAt = null;
    this.wallRiseAt = null;
    this.pathCells = new Map();
    this.playerAt = null;
    this.defenseAt = null;
    this.onStep = null;
    this.onBite = null;
    this.onBiteMiss = null;
    this.onSound = null;
    this.onMeshReady = null;
    this.onMeshGone = null;
    this.onRosterChange = null;
    this.pendingState = null;
    this.hovered = null;
    this.hoveredCorpse = null;
    this.hoverTime = 0;
    this.now = 0;
    this.daySeconds = 0;
  }

  configure(daySeconds) {
    this.daySeconds = Number.isFinite(daySeconds) && daySeconds > 0 ? daySeconds : 0;
  }

  async create(layout) {
    const saved = this.stateByKey(this.pendingState);
    this.pendingState = null;
    const wanted = new Map();
    for (const entry of this.entriesFor(layout)) {
      const type = getCreatureType(entry.kind);
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      wanted.set(slotKeyOf(entry.kind, tierKey, entry.cx, entry.cz), { entry, type, tierKey });
    }
    for (const slot of [...this.slots.values()]) {
      if (!wanted.has(slot.key)) this.dropSlot(slot);
    }
    for (const [key, want] of wanted) {
      if (this.slots.has(key)) continue;
      await this.fillSlot(key, want, saved);
    }
    return this.creatures;
  }

  dropSlot(slot) {
    for (const corpse of [...this.corpses]) {
      if (corpse.creature && corpse.creature.slotKey === slot.key) this.disposeCorpse(corpse);
    }
    if (slot.creature) this.despawn(slot.creature);
    this.slots.delete(slot.key);
    if (this.onRosterChange) this.onRosterChange();
  }

  async fillSlot(key, want, saved) {
    const { entry, type, tierKey } = want;
    const tier = getCreatureTier(type, tierKey);
    const slot = {
      key,
      kind: entry.kind,
      tierKey,
      type,
      tier,
      entry: { ...entry, tier: tierKey },
      creature: null,
      deadAt: null,
    };
    this.slots.set(key, slot);
    const record = saved ? saved.get(key) : null;
    if (record) {
      slot.deadAt = record.alive === false
        ? (Number.isFinite(record.deadAt) ? record.deadAt : 0)
        : null;
    }
    if (Number.isFinite(slot.deadAt)) return;
    const container = await this.containerFor(type.model);
    if (!container) return;
    const creature = this.spawn(type, tierKey, tier, slot.entry, container);
    if (!creature) return;
    creature.slotKey = key;
    slot.creature = creature;
    this.creatures.push(creature);
    if (record) this.applyLive(creature, record);
  }

  entriesFor(layout) {
    const list = layout && Array.isArray(layout.creatures) ? layout.creatures : [];
    return list.filter((entry) => entry
      && getCreatureType(entry.kind)
      && Number.isFinite(entry.cx)
      && Number.isFinite(entry.cz));
  }

  stateByKey(data) {
    const map = new Map();
    const list = data && Array.isArray(data.list) ? data.list : [];
    for (const saved of list) {
      const key = this.savedKey(saved);
      if (key) map.set(key, saved);
    }
    return map;
  }

  savedKey(saved) {
    if (!saved || !Number.isFinite(saved.cx) || !Number.isFinite(saved.cz)) return null;
    const type = getCreatureType(saved.kind);
    if (!type) return null;
    const tierKey = saved.tier && type.tiers[saved.tier] ? saved.tier : type.defaultTier;
    return slotKeyOf(saved.kind, tierKey, saved.cx, saved.cz);
  }

  async containerFor(url) {
    if (this.containers.has(url)) return this.containers.get(url);
    let container = null;
    try {
      container = await loadContainer(this.s, url);
    } catch (error) {
      console.error(`[creature] Model se nenačetl: ${url} — ${error && error.message ? error.message : error}`);
      container = null;
    }
    this.containers.set(url, container);
    return container;
  }

  spawn(type, tierKey, tier, entry, container) {
    const instance = container.instantiateModelsToScene((name) => name, false);
    const children = [];
    for (const node of instance.rootNodes) {
      if (node.getChildMeshes) children.push(...node.getChildMeshes());
    }
    const solid = children.filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
    if (!solid.length) return null;
    const root = instance.rootNodes.find((node) => node.getChildMeshes().length) || instance.rootNodes[0];
    if (!root) return null;

    const bounds = root.getHierarchyBoundingVectors(true);
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const spanZ = Math.max(0.001, bounds.max.z - bounds.min.z);
    const scale = (creatureLength(type) / spanZ) * creatureScale(type, tier);
    const holder = new TransformNode(`creature_${type.label}_${this.creatures.length}`, this.s);
    root.parent = holder;
    root.scaling.set(scale, scale, scale);
    const groundOffset = Number.isFinite(type.groundOffset) ? type.groundOffset : 0;
    root.position.set(-centerX * scale, -(bounds.min.y + groundOffset) * scale, -centerZ * scale);

    const tint = tierTint(tier);
    const tinted = new Set();
    for (const mesh of solid) {
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      if (!tinted.has(mesh.material)) {
        tinted.add(mesh.material);
        this.tintMaterial(mesh, tint);
      }
      this.meshes.push(mesh);
      if (this.onMeshReady) this.onMeshReady(mesh);
    }

    const skeleton = instance.skeletons && instance.skeletons[0] ? instance.skeletons[0] : null;
    let rig = null;
    if (type.rig) {
      try {
        rig = type.rig.build(solid[0], skeleton);
      } catch (error) {
        console.warn(`[creature] Procedurální rig selhal pro ${type.label}: ${error && error.message ? error.message : error}`);
      }
    }

    const marker = createCreatureMarker(this.s);
    marker.parent = holder;
    const markHeight = (bounds.max.y - bounds.min.y) * scale + MARK_HEIGHT;
    marker.position.set(0, markHeight, 0);
    this.meshes.push(marker);

    const pickSize = Math.max(0.9, Math.min(2.4, creatureLength(type) * 1.4));
    const pickProxy = MeshBuilder.CreateSphere(`creaturePick_${type.label}_${this.creatures.length}`, {
      diameter: pickSize,
      segments: 8,
    }, this.s);
    pickProxy.isPickable = true;
    pickProxy.isVisible = true;
    pickProxy.visibility = 0;
    pickProxy.receiveShadows = false;
    pickProxy.metadata = { pickProxy: true };

    const world = Number.isFinite(entry.cx) && Number.isFinite(entry.cz)
      ? cellToWorldCoords(entry.cx, entry.cz)
      : { x: Number(entry.x) || 0, z: Number(entry.z) || 0 };
    const spot = this.nearestSpot(world.x, world.z, type);
    const facing = Math.random() * Math.PI * 2;

    const boneSummary = type.rig ? type.rig.summary(rig) : 'bez kostry';
    console.info(`[creature] ${type.label} (${tier.label}) na ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)} — ${boneSummary}`);
    const creature = {
      kind: entry.kind,
      type,
      tierKey,
      tier,
      holder,
      root,
      meshes: solid,
      rig,
      marker,
      markHeight,
      pickProxy,
      pickHeight: Math.max(0.35, (bounds.max.y - bounds.min.y) * scale * 0.5),
      markTimer: 0,
      markerIcon: 'bang',
      engaged: false,
      outlineLevel: 0,
      x: spot.x,
      z: spot.z,
      facing,
      renderX: spot.x,
      renderZ: spot.z,
      renderY: null,
      renderFacing: facing,
      homeX: spot.x,
      homeZ: spot.z,
      targetX: spot.x,
      targetZ: spot.z,
      mode: type.buried ? 'buried' : 'idle',
      buried: Boolean(type.buried),
      emergeProgress: type.buried ? 0 : 1,
      emergeSeconds: Number.isFinite(type.emergeSeconds) ? type.emergeSeconds : 1,
      buriedDepth: Number.isFinite(type.buriedDepth) ? type.buriedDepth : 0.85,
      timer: randomBetween(type.idleSeconds[0], type.idleSeconds[1]),
      cooldown: 0,
      walking: false,
      blockedTime: 0,
      stepTravelled: 0,
      stepIndex: 0,
      path: null,
      pathIndex: 0,
      pathClock: 0,
      poseX: spot.x,
      poseZ: spot.z,
      giveUpUntil: 0,
      health: tier.health,
      hitPulse: false,
    };
    this.placeHolder(creature);
    this.pickMeshes.push(pickProxy);
    this.pickOwner.set(pickProxy, creature);
    this.placePickProxy(creature);
    return creature;
  }

  placeHolder(creature, bob = 0, seconds = 0) {
    if (!creature || !creature.holder) return;
    const ground = this.groundHeightAt ? this.groundHeightAt(creature.renderX, creature.renderZ) : 0;
    const fall = Number.isFinite(creature.renderY) ? creature.renderY : ground;
    const rate = seconds > 0 ? (ground > fall ? RISE_RATE : FALL_RATE) * seconds : Infinity;
    creature.renderY = rate === Infinity ? ground : fall + Math.max(-rate, Math.min(rate, ground - fall));
    const bury = creature.buried
      ? (1 - Math.max(0, Math.min(1, creature.emergeProgress))) * creature.buriedDepth
      : 0;
    const jump = creature.mode === 'emerging' && creature.type.emergeJump
      ? Math.sin(Math.max(0, Math.min(1, creature.emergeProgress)) * Math.PI) * creature.type.emergeJump
      : 0;
    creature.holder.position.set(creature.renderX, creature.renderY + bob - bury + jump, creature.renderZ);
    creature.holder.rotation.y = creature.renderFacing + (creature.type.yawOffset || 0);
    this.placePickProxy(creature);
  }

  placePickProxy(creature) {
    const proxy = creature && creature.pickProxy;
    if (!proxy || proxy.isDisposed()) return;
    const holder = creature.holder;
    const baseY = holder && !holder.isDisposed() ? holder.position.y : this.groundAt(creature.renderX, creature.renderZ);
    proxy.position.set(creature.renderX, baseY + creature.pickHeight, creature.renderZ);
  }

  tintMaterial(mesh, tint) {
    const material = mesh.material;
    if (!material || !material.clone) return;
    const clone = material.clone(`${material.name}_tier`);
    if (clone.albedoColor !== undefined) clone.albedoColor = new Color3(tint.r, tint.g, tint.b);
    else if (clone.diffuseColor !== undefined) clone.diffuseColor = new Color3(tint.r, tint.g, tint.b);
    mesh.material = clone;
  }

  canStand(x, z) {
    if (!this.walkableAt) return true;
    return this.walkableAt(x, z);
  }

  groundAt(x, z) {
    const height = this.groundHeightAt ? this.groundHeightAt(x, z) : 0;
    return Number.isFinite(height) ? height : 0;
  }

  stepLimit(type) {
    const limit = Number(type && type.maxStepHeight);
    return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
  }

  attackHeight(type) {
    const limit = Number(type && type.attackHeight);
    return Number.isFinite(limit) && limit >= 0 ? limit : Infinity;
  }

  noticeHeight(type) {
    const limit = Number(type && type.noticeHeight);
    return Number.isFinite(limit) && limit >= 0 ? limit : Infinity;
  }

  heightGap(creature, player) {
    if (!player || !Number.isFinite(player.y)) return 0;
    return Math.abs(player.y - this.groundAt(creature.x, creature.z));
  }

  inBiteRange(creature, player) {
    if (!player) return false;
    const gap = Math.hypot(player.x - creature.x, player.z - creature.z);
    if (gap > creature.type.biteRange) return false;
    return this.heightGap(creature, player) <= this.attackHeight(creature.type);
  }

  canStep(creature, x, z, relaxed = false) {
    if (!relaxed && !this.canStand(x, z)) return false;
    const limit = this.stepLimit(creature.type);
    if (Number.isFinite(limit)) {
      if (Math.abs(this.groundAt(x, z) - this.groundAt(creature.x, creature.z)) > limit) return false;
      if (!relaxed && this.wallRiseAt && this.wallRiseAt(x, z, CREATURE_WALL_MARGIN) > limit) return false;
    }
    return true;
  }

  pathClear(fromX, fromZ, toX, toZ, type) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-6) return true;
    const samples = Math.max(1, Math.ceil(distance / PATH_SAMPLE));
    const limit = this.stepLimit(type);
    let previousY = this.groundAt(fromX, fromZ);
    for (let index = 1; index <= samples; index += 1) {
      const t = index / samples;
      const x = fromX + dx * t;
      const z = fromZ + dz * t;
      if (!this.canStand(x, z)) return false;
      const y = this.groundAt(x, z);
      if (Number.isFinite(limit) && Math.abs(y - previousY) > limit) return false;
      previousY = y;
    }
    return true;
  }

  cellAt(x, z) {
    return { i: worldToCell(x), j: worldToCell(z) };
  }

  standableCellNear(cell, rings, cellData) {
    for (let ring = 0; ring <= rings; ring += 1) {
      for (let di = -ring; di <= ring; di += 1) {
        for (let dj = -ring; dj <= ring; dj += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
          if (!cellData(cell.i + di, cell.j + dj).ok) continue;
          return { i: cell.i + di, j: cell.j + dj };
        }
      }
    }
    return null;
  }

  clearPathCache() {
    this.pathCells.clear();
  }

  cellInfo(i, j) {
    const key = (i + CELL_KEY_OFFSET) * CELL_KEY_SPAN + (j + CELL_KEY_OFFSET);
    const cached = this.pathCells.get(key);
    if (cached) return cached;
    const ok = this.canStand(i * CELL_SIZE, j * CELL_SIZE);
    const entry = { ok, y: ok ? this.groundAt(i * CELL_SIZE, j * CELL_SIZE) : 0 };
    this.pathCells.set(key, entry);
    return entry;
  }

  edgeFits(fromY, toY, fromI, fromJ, toI, toJ, limit) {
    if (Math.abs(toY - fromY) <= limit) return true;
    const midX = ((fromI + toI) / 2) * CELL_SIZE;
    const midZ = ((fromJ + toJ) / 2) * CELL_SIZE;
    if (!this.canStand(midX, midZ)) return false;
    const midY = this.groundAt(midX, midZ);
    return Math.abs(midY - fromY) <= limit && Math.abs(toY - midY) <= limit;
  }

  buildPath(creature, targetX, targetZ) {
    const type = creature.type;
    const limit = this.stepLimit(type);
    const cellData = this.cellInfo.bind(this);
    const start = this.standableCellNear(this.cellAt(creature.x, creature.z), 2, cellData);
    const goal = this.standableCellNear(this.cellAt(targetX, targetZ), 6, cellData);
    if (!start || !goal) return null;
    const edgeCache = new Map();
    const edgeOpen = (fromI, fromJ, toI, toJ) => {
      const key = ((fromI + CELL_KEY_OFFSET) * CELL_KEY_SPAN + (fromJ + CELL_KEY_OFFSET)) * 9
        + (toI - fromI + 1) * 3 + (toJ - fromJ + 1);
      const cached = edgeCache.get(key);
      if (cached !== undefined) return cached;
      const from = cellData(fromI, fromJ);
      const to = cellData(toI, toJ);
      let open = from.ok && to.ok;
      if (open && Number.isFinite(limit)) {
        open = this.edgeFits(from.y, to.y, fromI, fromJ, toI, toJ, limit);
      }
      edgeCache.set(key, open);
      return open;
    };
    const neighbours = (i, j) => {
      const out = [];
      for (const [di, dj] of NEIGHBOURS_8) {
        if (!edgeOpen(i, j, i + di, j + dj)) continue;
        if (di !== 0 && dj !== 0 && (!edgeOpen(i, j, i + di, j) || !edgeOpen(i, j, i, j + dj))) continue;
        out.push({ i: i + di, j: j + dj, cost: Math.hypot(di, dj) });
      }
      return out;
    };
    const cells = findCellPath({
      start,
      goal,
      neighbours,
      bounds: {
        minI: Math.min(start.i, goal.i) - PATH_MARGIN,
        maxI: Math.max(start.i, goal.i) + PATH_MARGIN,
        minJ: Math.min(start.j, goal.j) - PATH_MARGIN,
        maxJ: Math.max(start.j, goal.j) + PATH_MARGIN,
      },
      limit: PATH_NODE_LIMIT,
      partial: true,
    });
    if (!cells) return null;
    return this.smoothCells(cells.slice(0, PATH_LOOKAHEAD), limit);
  }

  lineOpen(fromI, fromJ, toI, toJ, limit) {
    const steps = Math.max(Math.abs(toI - fromI), Math.abs(toJ - fromJ));
    if (steps <= 1) return true;
    let previous = this.cellInfo(fromI, fromJ);
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const cell = this.cellInfo(
        Math.round(fromI + (toI - fromI) * t),
        Math.round(fromJ + (toJ - fromJ) * t),
      );
      if (!cell.ok) return false;
      if (Number.isFinite(limit) && Math.abs(cell.y - previous.y) > limit) return false;
      previous = cell;
    }
    return true;
  }

  smoothCells(cells, limit) {
    const points = cells.map((cell) => ({ x: cell.i * CELL_SIZE, z: cell.j * CELL_SIZE }));
    if (cells.length <= 2) return points;
    const out = [points[0]];
    let index = 0;
    while (index < cells.length - 1) {
      let far = Math.min(index + SMOOTH_SPAN, cells.length - 1);
      while (far > index + 1 && !this.lineOpen(cells[index].i, cells[index].j, cells[far].i, cells[far].j, limit)) {
        far -= 1;
      }
      out.push(points[far]);
      index = far;
    }
    return out;
  }

  moveTo(creature, targetX, targetZ, speed, dt) {
    if (Math.hypot(targetX - creature.x, targetZ - creature.z) <= ARRIVE) {
      creature.path = null;
      return true;
    }
    creature.pathClock = (creature.pathClock || 0) - dt;
    if (creature.pathClock <= 0) {
      creature.pathClock = PATH_REPLAN;
      creature.path = this.pathClear(creature.x, creature.z, targetX, targetZ, creature.type)
        ? null
        : this.buildPath(creature, targetX, targetZ);
      creature.pathIndex = 1;
    }
    const path = creature.path;
    if (!path || path.length < 2) {
      this.walkTo(creature, targetX, targetZ, speed, dt);
    } else {
      while (creature.pathIndex < path.length - 1) {
        const point = path[creature.pathIndex];
        if (Math.hypot(point.x - creature.x, point.z - creature.z) > PATH_REACH) break;
        creature.pathIndex += 1;
      }
      const point = path[Math.min(creature.pathIndex, path.length - 1)];
      this.walkTo(creature, point.x, point.z, speed, dt);
    }
    if (!creature.walking) creature.pathClock = Math.min(creature.pathClock, PATH_RETRY);
    return false;
  }

  nearestSpot(x, z, type) {
    const limit = this.stepLimit(type);
    const referenceY = this.groundAt(x, z);
    const fits = (px, pz) => {
      if (!this.canStand(px, pz)) return false;
      if (Number.isFinite(limit) && Math.abs(this.groundAt(px, pz) - referenceY) > limit) return false;
      return this.pathClear(x, z, px, pz, type);
    };
    if (fits(x, z)) return { x, z };
    for (let ring = 1; ring <= SPOT_REACH / SPOT_STEP; ring += 1) {
      const radius = ring * SPOT_STEP;
      for (let step = 0; step < 8; step += 1) {
        const angle = (step / 8) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        if (fits(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  roamTarget(creature) {
    const type = creature.type;
    const radius = Number(type.roamRadius);
    if (!Number.isFinite(radius) || radius <= 0) return { x: creature.homeX, z: creature.homeZ };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const reach = radius * (0.4 + Math.random() * 0.6);
      const x = creature.homeX + Math.cos(angle) * reach;
      const z = creature.homeZ + Math.sin(angle) * reach;
      if (this.pathClear(creature.homeX, creature.homeZ, x, z, type)) return { x, z };
    }
    return { x: creature.homeX, z: creature.homeZ };
  }

  tick(dt, now) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (Number.isFinite(now)) this.now = now;
    const player = this.playerAt ? this.playerAt() : null;
    for (const creature of this.creatures) this.think(creature, dt, player);
    this.respawnDue(this.now, player);
  }

  respawnDue(now, player) {
    if (!(this.daySeconds > 0)) return;
    for (const slot of this.slots.values()) {
      if (slot.creature || !Number.isFinite(slot.deadAt)) continue;
      const days = Number(slot.type.respawnDays);
      if (!Number.isFinite(days) || days <= 0) continue;
      if (now - slot.deadAt < days * this.daySeconds) continue;
      if (this.playerOnSlot(player, slot)) continue;
      const container = this.containers.get(slot.type.model);
      if (!container) continue;
      const creature = this.spawn(slot.type, slot.tierKey, slot.tier, slot.entry, container);
      if (!creature) continue;
      creature.slotKey = slot.key;
      slot.creature = creature;
      slot.deadAt = null;
      this.creatures.push(creature);
      if (this.onRosterChange) this.onRosterChange();
    }
  }

  playerOnSlot(player, slot) {
    if (!player) return false;
    const world = cellToWorldCoords(slot.entry.cx, slot.entry.cz);
    return Math.hypot(player.x - world.x, player.z - world.z) < RESPAWN_CLEAR;
  }

  statusAt(cx, cz, kind, tierKey) {
    const slot = this.slots.get(slotKeyOf(kind, tierKey, cx, cz));
    if (!slot) return null;
    const days = Number(slot.type.respawnDays);
    const remainingDays = !slot.creature
      && Number.isFinite(slot.deadAt)
      && Number.isFinite(days)
      && days > 0
      && this.daySeconds > 0
      ? Math.max(0, (slot.deadAt + days * this.daySeconds - this.now) / this.daySeconds)
      : null;
    const live = slot.creature;
    return {
      alive: Boolean(live),
      waiting: Number.isFinite(slot.deadAt),
      remainingDays,
      x: live ? live.renderX : null,
      z: live ? live.renderZ : null,
    };
  }

  think(creature, dt, player) {
    const type = creature.type;
    creature.walking = false;
    creature.cooldown = Math.max(0, creature.cooldown - dt);
    creature.timer -= dt;
    const gap = player ? Math.hypot(player.x - creature.x, player.z - creature.z) : Infinity;
    const heightGap = this.heightGap(creature, player);
    const aggro = Number.isFinite(creature.tier.aggroRange) ? creature.tier.aggroRange : type.aggroRange;
    const alertSeconds = Array.isArray(type.alertSeconds) ? type.alertSeconds : [2, 3];
    const canAggro = Boolean(player)
      && gap < aggro
      && heightGap <= this.noticeHeight(type)
      && this.now >= (creature.giveUpUntil || 0);

    if (creature.mode === 'buried') {
      const emergeRange = Number.isFinite(type.emergeRange) ? type.emergeRange : aggro;
      if (player && gap <= emergeRange) {
        creature.mode = 'emerging';
        creature.timer = creature.emergeSeconds;
        if (gap > 0.001) creature.facing = Math.atan2(player.x - creature.x, player.z - creature.z);
        this.playSound(creature, 'dig');
      }
      return;
    }

    if (creature.mode === 'emerging') {
      if (player && gap > 0.001) {
        const look = Math.atan2(player.x - creature.x, player.z - creature.z);
        creature.facing = turnToward(creature.facing, look, type.turnRate * dt);
      }
      if (creature.timer <= 0) {
        creature.buried = false;
        creature.emergeProgress = 1;
        this.beginAggro(creature, alertSeconds);
      }
      return;
    }

    if (creature.mode === 'burying') {
      if (creature.timer <= 0) {
        creature.mode = 'buried';
        creature.emergeProgress = 0;
      }
      return;
    }

    if (creature.mode === 'windup') {
      if (creature.timer <= 0) {
        creature.mode = 'recover';
        creature.timer = type.biteRecover;
        creature.cooldown = type.biteCooldown;
        this.playSound(creature, 'bite');
        this.resolveBite(creature, player);
      }
      return;
    }

    if (creature.mode === 'recover') {
      if (creature.timer <= 0) creature.mode = 'idle';
      return;
    }

    if (creature.mode === 'confused') {
      if (canAggro) {
        this.beginAggro(creature, alertSeconds, heightGap <= this.attackHeight(type));
        return;
      }
      if (creature.timer <= 0) {
        creature.mode = 'roam';
        creature.targetX = creature.homeX;
        creature.targetZ = creature.homeZ;
        creature.timer = randomBetween(4, 8);
      }
      return;
    }

    if (creature.mode === 'alert') {
      if (!canAggro) {
        creature.mode = 'roam';
        creature.targetX = creature.homeX;
        creature.targetZ = creature.homeZ;
        creature.timer = randomBetween(4, 8);
        return;
      }
      if (gap > 0.001) {
        const look = Math.atan2(player.x - creature.x, player.z - creature.z);
        creature.facing = turnToward(creature.facing, look, type.turnRate * dt * 0.7);
      }
      if (heightGap <= this.attackHeight(type) && (gap <= type.chargeRange || creature.timer <= 0)) {
        this.beginCharge(creature);
        return;
      }
      if (creature.timer <= 0) {
        creature.giveUpUntil = this.now + (type.confusedSeconds || 1.4) + 3;
        creature.mode = 'roam';
        creature.targetX = creature.homeX;
        creature.targetZ = creature.homeZ;
        creature.timer = randomBetween(4, 8);
      }
      return;
    }

    if (canAggro) {
      const reachable = heightGap <= this.attackHeight(type);
      if (creature.mode !== 'chase') {
        if (gap <= type.chargeRange && reachable) {
          this.beginCharge(creature);
        } else {
          this.beginAggro(creature, alertSeconds, reachable);
          return;
        }
      }
      if (this.inBiteRange(creature, player) && creature.cooldown <= 0) {
        creature.mode = 'windup';
        creature.timer = type.biteWindup;
        return;
      }
      creature.mode = 'chase';
    }

    if (creature.mode === 'chase') {
      if (!player || gap > aggro * 1.8 || heightGap > this.attackHeight(type)) {
        creature.engaged = false;
        creature.mode = 'confused';
        creature.timer = creature.type.confusedSeconds || 1.4;
        return;
      }
      const standoff = type.biteRange * 0.85;
      if (gap <= standoff || gap < 0.001) return;
      const dirX = (player.x - creature.x) / gap;
      const dirZ = (player.z - creature.z) / gap;
      const boost = Number.isFinite(type.chaseBoost) ? type.chaseBoost : 1;
      const speed = type.walkSpeed * creature.tier.speed * boost;
      const arrived = this.moveTo(creature, player.x - dirX * standoff, player.z - dirZ * standoff, speed, dt);
      const blocked = !arrived && !creature.walking;
      creature.blockedTime = blocked ? creature.blockedTime + dt : 0;
      if (creature.blockedTime > CHASE_STUCK_SECONDS) {
        creature.engaged = false;
        creature.giveUpUntil = this.now + (type.confusedSeconds || 1.4) + 3;
        creature.mode = 'confused';
        creature.timer = type.confusedSeconds || 1.4;
      }
      return;
    }

    if (creature.mode === 'roam') {
      const speed = type.walkSpeed * creature.tier.speed * 0.6;
      const arrived = this.moveTo(creature, creature.targetX, creature.targetZ, speed, dt);
      const headingHome = Math.abs(creature.targetX - creature.homeX) < 0.01
        && Math.abs(creature.targetZ - creature.homeZ) < 0.01;
      const gaveUp = creature.timer <= 0 && (!headingHome || creature.timer < -HOME_PATIENCE);
      if (arrived || gaveUp) {
        const nearHome = Math.hypot(creature.x - creature.homeX, creature.z - creature.homeZ) <= 0.6;
        if (type.buried && nearHome && gap > aggro * 1.5) {
          this.beginBury(creature);
          return;
        }
        creature.mode = 'idle';
        creature.timer = randomBetween(type.idleSeconds[0], type.idleSeconds[1]);
      }
      return;
    }

    if (creature.timer <= 0) {
      const target = this.roamTarget(creature);
      creature.targetX = target.x;
      creature.targetZ = target.z;
      creature.mode = 'roam';
      creature.timer = randomBetween(5, 9);
    }
  }

  beginAlert(creature, seconds) {
    creature.mode = 'alert';
    creature.timer = randomBetween(seconds[0], seconds[1]);
    this.playSound(creature, 'alert');
  }

  beginAggro(creature, seconds, reachable = true) {
    if (creature.type.noWarning && reachable) {
      this.beginCharge(creature);
      return;
    }
    this.beginAlert(creature, seconds);
  }

  beginBury(creature) {
    creature.mode = 'burying';
    creature.timer = creature.emergeSeconds;
    creature.buried = true;
    creature.emergeProgress = 1;
    this.playSound(creature, 'dig');
  }

  beginCharge(creature) {
    if (!creature.engaged) {
      creature.engaged = true;
      creature.markTimer = COMBAT_MARK_SECONDS;
      this.playSound(creature, 'charge');
    }
    creature.mode = 'chase';
  }

  resolveBite(creature, player) {
    if (!player) return;
    const attack = creatureStat(creature.type, creature.tier, 'attack');
    const defense = this.defenseAt ? this.defenseAt() : 0;
    const strike = rollStrike(attack, defense);
    if (!strike.hit) {
      if (this.onBiteMiss) this.onBiteMiss(creature);
      return;
    }
    const bite = creatureStat(creature.type, creature.tier, 'bite');
    const damage = strike.crit ? bite * CRIT_MULTIPLIER : bite;
    if (this.onBite) this.onBite(creature, damage, strike.crit);
  }

  playSound(creature, kind) {
    const key = creature && creature.type.sounds ? creature.type.sounds[kind] : null;
    if (!key || !this.onSound) return;
    this.onSound(key, creature);
  }

  walkTo(creature, targetX, targetZ, speed, dt) {
    const startX = creature.x;
    const startZ = creature.z;
    const dx = targetX - creature.x;
    const dz = targetZ - creature.z;
    const distance = Math.hypot(dx, dz);
    if (distance < ARRIVE) return true;
    const dirX = dx / distance;
    const dirZ = dz / distance;
    const step = Math.min(distance, speed * dt);
    const heading = Math.atan2(dirX, dirZ);
    const relaxed = (creature.stuckTime || 0) > STUCK_ESCAPE_SECONDS;
    let moved = false;
    for (const offset of SLIDE_ANGLES) {
      const turn = heading + offset;
      const tryX = creature.x + Math.sin(turn) * step;
      const tryZ = creature.z + Math.cos(turn) * step;
      if (!this.canStep(creature, tryX, tryZ, relaxed)) continue;
      creature.x = tryX;
      creature.z = tryZ;
      moved = true;
      break;
    }
    if (!moved) {
      creature.stuckTime = (creature.stuckTime || 0) + dt;
      return false;
    }
    creature.stuckTime = 0;
    creature.walking = true;
    creature.facing = turnToward(creature.facing, Math.atan2(dirX, dirZ), creature.type.turnRate * dt);
    creature.stepTravelled += Math.hypot(creature.x - startX, creature.z - startZ);
    const stepDistance = creature.type.footprint && Number.isFinite(creature.type.footprint.stepDistance)
      ? creature.type.footprint.stepDistance
      : Math.max(0.6, creatureLength(creature.type) * 0.7);
    if (creature.stepTravelled >= stepDistance) {
      creature.stepTravelled = 0;
      creature.stepIndex += 1;
      if (this.onStep) this.onStep(creature, creature.stepIndex);
    }
    return false;
  }

  update(dt) {
    if (!this.creatures.length && !this.corpses.length) return;
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    const blend = 1 - Math.pow(RENDER_SMOOTHING, seconds);
    this.hoverTime += seconds;
    for (const creature of this.creatures) {
      creature.renderX += (creature.x - creature.renderX) * blend;
      creature.renderZ += (creature.z - creature.renderZ) * blend;
      const turnSpeed = creature.mode === 'emerging' ? EMERGE_TURN_SPEED : TURN_SPEED;
      creature.renderFacing = turnToward(creature.renderFacing, creature.facing, turnSpeed * seconds);
      let faceGap = creature.facing - creature.renderFacing;
      while (faceGap > Math.PI) faceGap -= Math.PI * 2;
      while (faceGap < -Math.PI) faceGap += Math.PI * 2;
      const turning = Math.abs(faceGap) > TURN_STEP_GAP;
      const moved = Math.hypot(creature.x - creature.poseX, creature.z - creature.poseZ);
      creature.poseX = creature.x;
      creature.poseZ = creature.z;
      const pose = creature.type.rig
        ? creature.type.rig.pose(creature.rig, seconds, {
          mode: creature.mode,
          moving: creature.walking,
          moved,
          buried: creature.buried,
          emergeProgress: creature.emergeProgress,
          turning,
          engaged: Boolean(creature.engaged),
          hit: Boolean(creature.hitPulse),
        })
        : null;
      creature.hitPulse = false;
      if (creature.mode === 'emerging' && creature.emergeSeconds > 0) {
        creature.emergeProgress = Math.min(1, creature.emergeProgress + seconds / creature.emergeSeconds);
      } else if (creature.mode === 'burying' && creature.emergeSeconds > 0) {
        creature.emergeProgress = Math.max(0, creature.emergeProgress - seconds / creature.emergeSeconds);
      }
      const bob = pose && Number.isFinite(pose.bob) ? pose.bob : 0;
      this.placeHolder(creature, bob, seconds);
      const rising = creature.mode === 'emerging';
      const hidden = creature.buried && !rising;
      const alert = creature.mode === 'alert';
      const combat = rising || creature.mode === 'chase' || creature.mode === 'windup' || creature.mode === 'recover';
      const hovered = creature === this.hovered;
      const color = alert && !combat ? ALERT_COLOR : COMBAT_COLOR;
      const goal = hidden ? 0 : alert || combat || hovered ? 1 : 0;
      const fade = OUTLINE_FADE * seconds;
      creature.outlineLevel += Math.max(-fade, Math.min(fade, goal - creature.outlineLevel));
      const widthScale = combat ? OUTLINE_COMBAT_SCALE : 1;
      const pulseSpeed = combat ? OUTLINE_COMBAT_SPEED : OUTLINE_ALERT_SPEED;
      this.applyOutline(creature, color, widthScale, pulseSpeed);
      this.updateMarker(creature, seconds);
    }
    this.updateCorpses(seconds);
  }

  isPlayerInCombat(player) {
    if (!player) return false;
    return this.creatures.some((creature) => {
      if (!creature || creature.dead || creature.buried) return false;
      if (!creature.engaged && creature.mode !== 'alert'
        && creature.mode !== 'chase'
        && creature.mode !== 'windup'
        && creature.mode !== 'recover') return false;
      const bite = creature.type && Number.isFinite(creature.type.biteRange)
        ? creature.type.biteRange
        : 1.2;
      const gap = Math.hypot(player.x - creature.x, player.z - creature.z);
      return gap <= bite + 0.8;
    });
  }

  hoverAt(x, y) {
    if (!this.creatures.length || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.hovered = null;
      this.hoveredCorpse = null;
      return null;
    }
    const pick = this.s.pick(x, y, (mesh) => this.pickMeshes.includes(mesh) || this.meshes.includes(mesh));
    const mesh = pick && pick.hit ? pick.pickedMesh : null;
    const owner = mesh ? this.pickOwner.get(mesh) : null;
    const creature = owner
      ? (this.creatures.includes(owner) && !owner.buried ? owner : null)
      : mesh ? this.creatures.find((item) => !item.buried && item.meshes.includes(mesh)) : null;
    this.hovered = creature || null;
    return creature || null;
  }

  clearHover() {
    this.hovered = null;
    this.hoveredCorpse = null;
  }

  applyOutline(creature, color, widthScale, pulseSpeed) {
    if (!creature || !creature.meshes) return;
    const level = creature.outlineLevel;
    const on = level > 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.hoverTime * pulseSpeed);
    for (const mesh of creature.meshes) {
      if (mesh === creature.marker) continue;
      mesh.renderOutline = on;
      if (!on) continue;
      mesh.outlineColor = color;
      mesh.outlineWidth = (OUTLINE_WIDTH + OUTLINE_PULSE * pulse * level) * widthScale;
    }
  }

  updateMarker(creature, seconds) {
    const marker = creature.marker;
    if (!marker) return;
    const rising = creature.mode === 'emerging';
    if (creature.buried && !rising) {
      marker.setEnabled(false);
      return;
    }
    creature.markTimer = Math.max(0, creature.markTimer - seconds);
    const doubt = creature.mode === 'confused';
    const alert = creature.mode === 'alert';
    const show = doubt || alert || rising || creature.markTimer > 0;
    marker.setEnabled(show);
    if (!show) return;
    const icon = doubt ? 'doubt' : 'bang';
    if (creature.markerIcon !== icon) {
      creature.markerIcon = icon;
      setMarkerIcon(marker, this.s, icon);
    }
    marker.material.emissiveColor = doubt || alert ? ALERT_COLOR : COMBAT_COLOR;
    const pulse = 1 + Math.sin(this.hoverTime * MARK_SPEED) * MARK_PULSE;
    marker.scaling.set(pulse, pulse, pulse);
    marker.position.y = creature.markHeight + Math.sin(this.hoverTime * MARK_SPEED * 0.7) * MARK_BOB;
  }

  damage(creature, amount, now) {
    if (!creature || creature.buried || !Number.isFinite(amount) || amount <= 0) return false;
    if (creature.health <= 0) return false;
    creature.health = Math.max(0, creature.health - amount);
    creature.hitPulse = true;
    this.playSound(creature, 'hit');
    if (creature.health > 0) {
      creature.giveUpUntil = 0;
      if (creature.mode !== 'windup') this.beginCharge(creature);
      return false;
    }
    return this.kill(creature, now);
  }

  kill(creature, now) {
    const slot = creature && creature.slotKey ? this.slots.get(creature.slotKey) : null;
    if (!slot || slot.creature !== creature) return false;
    creature.health = 0;
    this.playSound(creature, 'death');
    slot.deadAt = Number.isFinite(now) ? now : this.now;
    this.makeCorpse(creature);
    if (this.onRosterChange) this.onRosterChange();
    return true;
  }

  makeCorpse(creature) {
    if (!creature || creature.dead) return;
    creature.dead = true;
    creature.mode = 'dead';
    creature.walking = false;
    creature.health = 0;
    if (creature.marker) creature.marker.setEnabled(false);
    for (const mesh of creature.meshes || []) mesh.renderOutline = false;
    this.creatures = this.creatures.filter((item) => item !== creature);
    if (this.hovered === creature) this.hovered = null;
    if (this.hoveredCorpse === creature) this.hoveredCorpse = null;
    const slot = creature.slotKey ? this.slots.get(creature.slotKey) : null;
    if (slot && slot.creature === creature) slot.creature = null;
    const holder = creature.holder;
    if (!holder || holder.isDisposed()) return;
    this.corpses.push({
      creature,
      age: 0,
      sinkAt: CORPSE_LIFETIME,
      tilt: 0,
      looted: false,
    });
  }

  updateCorpses(seconds) {
    if (!this.corpses.length) return;
    const player = this.playerAt ? this.playerAt() : null;
    for (const entry of [...this.corpses]) {
      const creature = entry.creature;
      const holder = creature ? creature.holder : null;
      if (!holder || holder.isDisposed()) {
        this.corpses = this.corpses.filter((item) => item !== entry);
        continue;
      }
      entry.age += seconds;
      const fallSeconds = Number.isFinite(creature.type.deathSeconds) ? creature.type.deathSeconds : CORPSE_FALL;
      const roll = Number.isFinite(creature.type.deathRoll) ? creature.type.deathRoll : CORPSE_TILT;
      const backwards = Number.isFinite(creature.type.deathRoll);
      const fall = Math.min(1, entry.age / fallSeconds);
      const ease = fall * fall * (3 - 2 * fall);
      entry.tilt = roll * ease;
      if (backwards) holder.rotation.x = entry.tilt;
      else holder.rotation.z = entry.tilt;
      if (creature.type.rig) {
        creature.type.rig.pose(creature.rig, seconds, { mode: 'dead', moving: false });
      }
      holder.computeWorldMatrix(true);
      const bounds = holder.getHierarchyBoundingVectors(true);
      const ground = this.corpseGroundAt(creature);
      const offset = bounds ? bounds.min.y - holder.position.y : 0;
      const groundY = ground + CORPSE_GROUND_MARGIN - offset;
      const near = Boolean(player)
        && !entry.looted
        && entry.age < entry.sinkAt
        && Math.hypot(player.x - creature.x, player.z - creature.z) <= CORPSE_OUTLINE_REACH;
      for (const mesh of creature.meshes || []) {
        mesh.renderOutline = near;
        if (!near) continue;
        mesh.outlineColor = CORPSE_OUTLINE_COLOR;
        mesh.outlineWidth = CORPSE_OUTLINE_WIDTH;
      }
      if (entry.age < entry.sinkAt) {
        holder.position.y = groundY;
        this.placePickProxy(creature);
        continue;
      }
      const sink = Math.min(1, (entry.age - entry.sinkAt) / CORPSE_SINK);
      holder.position.y = groundY - 0.7 * sink;
      if (backwards) holder.rotation.x = roll;
      else holder.rotation.z = CORPSE_TILT * (1 + sink * 0.25);
      this.placePickProxy(creature);
      if (sink >= 1) this.disposeCorpse(entry);
    }
  }

  corpseGroundAt(creature) {
    const x = creature.renderX;
    const z = creature.renderZ;
    const reach = CORPSE_GROUND_SAMPLE;
    return Math.max(
      this.groundAt(x, z),
      this.groundAt(x + reach, z),
      this.groundAt(x - reach, z),
      this.groundAt(x, z + reach),
      this.groundAt(x, z - reach),
    );
  }

  disposeCorpse(entry) {
    if (!entry) return;
    this.corpses = this.corpses.filter((item) => item !== entry);
    const creature = entry.creature;
    if (this.hoveredCorpse === creature) this.hoveredCorpse = null;
    if (creature) this.despawn(creature);
    if (this.onRosterChange) this.onRosterChange();
  }

  corpseAt(x, y) {
    if (!this.corpses.length || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.hoveredCorpse = null;
      return null;
    }
    const pick = this.s.pick(x, y, (mesh) => this.pickMeshes.includes(mesh) || this.meshes.includes(mesh));
    const mesh = pick && pick.hit ? pick.pickedMesh : null;
    const owner = mesh ? this.pickOwner.get(mesh) : null;
    const entry = mesh
      ? this.corpses.find((item) => !item.looted && item.creature
        && (item.creature === owner || item.creature.meshes.includes(mesh)))
      : null;
    this.hoveredCorpse = entry ? entry.creature : null;
    return entry ? entry.creature : null;
  }

  loot(corpse) {
    if (!corpse || !corpse.dead) return null;
    const entry = this.corpses.find((item) => item.creature === corpse);
    if (!entry || entry.looted) return null;
    const config = corpse.type && corpse.type.loot ? corpse.type.loot : null;
    if (!config) return null;
    const yields = [];
    for (const [itemKey, amount] of Object.entries(config)) {
      if (typeof itemKey !== 'string' || !Number.isFinite(amount) || amount <= 0) continue;
      yields.push({ itemKey, amount });
    }
    if (!yields.length) return null;
    entry.looted = true;
    entry.sinkAt = Math.min(entry.sinkAt, entry.age + CORPSE_LOOT_SINK_DELAY);
    if (this.hoveredCorpse === corpse) this.hoveredCorpse = null;
    for (const mesh of corpse.meshes || []) mesh.renderOutline = false;
    return yields;
  }

  despawn(creature) {
    if (!creature) return;
    const gone = [...(creature.meshes || [])];
    if (creature.marker) gone.push(creature.marker);
    const proxy = creature.pickProxy;
    if (proxy) {
      this.pickMeshes = this.pickMeshes.filter((mesh) => mesh !== proxy);
      this.pickOwner.delete(proxy);
      if (!proxy.isDisposed()) proxy.dispose();
    }
    this.creatures = this.creatures.filter((item) => item !== creature);
    this.meshes = this.meshes.filter((mesh) => !gone.includes(mesh));
    if (this.hovered === creature) this.hovered = null;
    const slot = creature.slotKey ? this.slots.get(creature.slotKey) : null;
    if (slot && slot.creature === creature) slot.creature = null;
    if (creature.holder && !creature.holder.isDisposed()) creature.holder.dispose();
    if (this.onMeshGone) {
      for (const mesh of gone) this.onMeshGone(mesh);
    }
  }

  serialize() {
    const list = [];
    for (const slot of this.slots.values()) {
      const base = {
        kind: slot.kind,
        tier: slot.tierKey,
        cx: slot.entry.cx,
        cz: slot.entry.cz,
      };
      const creature = slot.creature;
      if (creature) {
        list.push({
          ...base,
          alive: true,
          x: creature.x,
          z: creature.z,
          facing: creature.facing,
          health: creature.health,
        });
      } else if (Number.isFinite(slot.deadAt)) {
        list.push({ ...base, alive: false, deadAt: slot.deadAt });
      } else {
        list.push({ ...base, alive: true });
      }
    }
    return { list };
  }

  defaultState() {
    return { list: [] };
  }

  apply(data) {
    const records = this.stateByKey(data);
    if (!this.slots.size) {
      this.pendingState = records.size ? data : null;
      return;
    }
    for (const [key, saved] of records) {
      const slot = this.slots.get(key);
      if (!slot) continue;
      if (saved.alive === false) {
        slot.deadAt = Number.isFinite(saved.deadAt) ? saved.deadAt : 0;
        if (slot.creature) this.despawn(slot.creature);
        continue;
      }
      slot.deadAt = null;
      if (slot.creature) this.applyLive(slot.creature, saved);
    }
  }

  applyLive(creature, saved) {
    if (!creature || !saved) return;
    if (Number.isFinite(saved.x) && Number.isFinite(saved.z)) {
      const spot = this.nearestSpot(saved.x, saved.z, creature.type);
      creature.x = spot.x;
      creature.z = spot.z;
      creature.homeX = spot.x;
      creature.homeZ = spot.z;
      creature.renderX = spot.x;
      creature.renderZ = spot.z;
    }
    if (Number.isFinite(saved.facing)) {
      creature.facing = saved.facing;
      creature.renderFacing = saved.facing;
    }
    if (Number.isFinite(saved.health)) creature.health = saved.health;
  }
}
