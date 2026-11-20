// Tvorové ve světě — načte model, rozhoduje v pevném tiku a plynule ho hýbe.
// Nedrží žádný jiný systém; výšku terénu, průchodnost, zdi staveb a hráče dostane od scény.
import { loadContainer } from '../../utils/assetLoader.js';
import { guardedNest } from '../../utils/nestGuard.js';
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Rendering/outlineRenderer';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { createCreatureMarker, setMarkerIcon } from '../../utils/creatureMarker.js';
import { rollQuality, rollDamage, CRIT_MULTIPLIER, GRAZE_MULTIPLIER } from '../../utils/combatRoll.js';
import { angleGap } from '../../utils/angles.js';
import {
  getCreatureType,
  getCreatureTier,
  creatureLength,
  creatureStat,
  creatureScale,
  tierTint,
} from '../../data/catalogs/creatures/index.js';
import { cellToWorldCoords, worldToCell, CELL_SIZE } from '../../utils/gridMath.js';
import { warnMissingWiring } from '../../utils/missingWiring.js';
import { findCellPath } from '../../utils/gridPath.js';
import { OUTLINE_GOLD, OUTLINE_CALM, OUTLINE_PULSE, OUTLINE_PULSE_SPEED, OUTLINE_FADE_SPEED } from '../../utils/outlineStyle.js';

const TURN_SPEED = 7;
const EMERGE_TURN_SPEED = 18;
const TURN_STEP_GAP = 0.12;
const RENDER_SMOOTHING = 0.001;
const SPOT_STEP = 0.5;
const SPOT_REACH = 12;
const PATH_SAMPLE = 0.3;
const CHASE_STUCK_SECONDS = 1.2;
const HOME_PATIENCE = 12;
const ATTACK_HEIGHT = 1;
const PLAYER_BODY = 0.3;
const LUNGE_SECONDS = 0.15;
const SIGHT_HOLD = 0.2;
const CHASE_RANGE = 1.8;
const SEARCH_PATIENCE = 8;
const SEARCH_SHARE = 0.5;
const ARRIVE = 0.12;
const PATH_REPLAN = 0.8;
const PATH_RETRY = 0.15;
const PATH_REACH = 0.35;
const PATH_NODE_LIMIT = 700;
const PATH_MARGIN = 16;
const ROUTE_CHECK_SECONDS = 0.5;
const ROUTE_AGGRO_SHARE = 2.5;
const ROUTE_GOAL_RINGS = 1;
const PATH_GOAL_RINGS = 6;
const PATH_LOOKAHEAD = 16;
const SMOOTH_SPAN = 8;
const CELL_KEY_OFFSET = 4096;
const CELL_KEY_SPAN = 8192;
const STUCK_ESCAPE_SECONDS = 0.8;
const CREATURE_WALL_MARGIN = 0.3;
const BUILDING_WALL_CLEAR = 0.3;
const BUILDING_WALL_HIT = 0.02;
const WALL_CHECK_STEP = 0.2;
const LAYER_SPLIT = 1;
const GIVE_UP_SECONDS = 3;
const WALLED_GIVE_UP_SECONDS = 12;
const RISE_RATE = 2.2;
const FALL_RATE = 6;
const SLIDE_ANGLES = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, Math.PI / 2, -Math.PI / 2];
const NEIGHBOURS_8 = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const OUTLINE_WIDTH = 0.038;
const OUTLINE_COMBAT_SPEED = 8;
const OUTLINE_COMBAT_SCALE = 1.35;
const COMBAT_MARK_SECONDS = 1;
const MARK_HEIGHT = 0.22;
const MARK_BOB = 0.02;
const MARK_PULSE = 0.06;
const MARK_SPEED = 3;
const COMBAT_COLOR = new Color3(0.92, 0.16, 0.12);
const ATTACK_MODES = ['chase', 'windup', 'recover'];
const HOSTILE_MODES = ['alert', ...ATTACK_MODES];
const FIGHT_MODES = ['windup', 'recover'];
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

function slotKeyOf(kind, tierKey, cx, cz, level = 0) {
  return level ? `${kind}|${tierKey}|${cx}|${cz}|${level}` : `${kind}|${tierKey}|${cx}|${cz}`;
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
    this.wallGapAt = null;
    this.nearBuildingAt = null;
    this.wallRiseAt = null;
    this.pathCells = new Map();
    this.playerAt = null;
    this.defenseAt = null;
    this.onStep = null;
    this.onDig = null;
    this.onBite = null;
    this.onBiteMiss = null;
    this.onSound = null;
    this.onMeshReady = null;
    this.onMeshGone = null;
    this.onRosterChange = null;
    this.pendingState = null;
    this.hovered = null;
    this.selected = null;
    this.hoveredCorpse = null;
    this.hoverTime = 0;
    this.now = 0;
    this.daySeconds = 0;
    this.nests = [];
    this.nestsVersion = 0;
  }

  setNests(nests) {
    this.nests = Array.isArray(nests) ? nests : [];
    this.nestsVersion += 1;
  }

  guardOf(creature) {
    if (creature.guardVersion === this.nestsVersion) return creature.guard;
    creature.guard = guardedNest(this.nests, creature.kind, creature.homeX, creature.homeZ);
    creature.guardVersion = this.nestsVersion;
    return creature.guard;
  }

  provoked(creature, player) {
    return Boolean(player) && this.now < (creature.provokedUntil || 0);
  }

  provoke(cx, cz) {
    let count = 0;
    for (const creature of this.creatures) {
      if (!creature || creature.dead || creature.buried) continue;
      const nest = this.guardOf(creature);
      if (!nest || nest.cx !== cx || nest.cz !== cz) continue;
      creature.provokedUntil = this.now + nest.provokeSeconds;
      if (!ATTACK_MODES.includes(creature.mode)) this.beginCharge(creature);
      count += 1;
    }
    return count;
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
      wanted.set(slotKeyOf(entry.kind, tierKey, entry.cx, entry.cz, entry.level || 0), { entry, type, tierKey });
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
    return slotKeyOf(saved.kind, tierKey, saved.cx, saved.cz, saved.slotLevel || 0);
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
    const root = solid.length
      ? instance.rootNodes.find((node) => node.getChildMeshes().length) || instance.rootNodes[0]
      : null;
    if (!root) {
      instance.dispose();
      return null;
    }

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
    const tinted = new Map();
    for (const mesh of solid) {
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      const original = mesh.material;
      if (original && !tinted.has(original)) tinted.set(original, this.tintMaterial(original, tint));
      const clone = original ? tinted.get(original) : null;
      if (clone) mesh.material = clone;
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
    const spawnLevel = Number.isFinite(entry.level) ? entry.level : 0;
    const spot = this.nearestSpot(world.x, world.z, spawnLevel);
    const facing = Math.random() * Math.PI * 2;

    const boneSummary = type.rig ? type.rig.summary(rig) : 'bez kostry';
    console.info(`[creature] ${type.label} (${tier.label}) na ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)} — ${boneSummary}`);
    const creature = {
      kind: entry.kind,
      level: spawnLevel,
      homeLevel: spawnLevel,
      type,
      tierKey,
      tier,
      holder,
      root,
      instance,
      tintMaterials: [...tinted.values()].filter(Boolean),
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
    const ground = this.groundAt(creature.renderX, creature.renderZ, creature.level, creature.y);
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
    const baseY = holder && !holder.isDisposed() ? holder.position.y : this.groundAt(creature.renderX, creature.renderZ, creature.level, creature.y);
    proxy.position.set(creature.renderX, baseY + creature.pickHeight, creature.renderZ);
  }

  tintMaterial(material, tint) {
    if (!material || !material.clone) return null;
    const clone = material.clone(`${material.name}_tier`);
    if (clone.albedoColor !== undefined) clone.albedoColor = new Color3(tint.r, tint.g, tint.b);
    else if (clone.diffuseColor !== undefined) clone.diffuseColor = new Color3(tint.r, tint.g, tint.b);
    return clone;
  }

  canStand(x, z, level = 0) {
    if (!this.walkableAt) return true;
    return this.walkableAt(x, z, level);
  }

  groundAt(x, z, level = 0, fromY = null) {
    if (!this.groundHeightAt) {
      warnMissingWiring('tvorové: výška země');
      return 0;
    }
    const height = this.groundHeightAt(x, z, level, fromY);
    return Number.isFinite(height) ? height : 0;
  }

  stepLimit() {
    const limit = Number(this.walkStepLimit);
    return Number.isFinite(limit) && limit > 0 ? limit : Infinity;
  }

  footY(creature) {
    return Number.isFinite(creature.y) ? creature.y : this.groundAt(creature.x, creature.z, creature.level || 0);
  }

  layerOf(x, z, level, y) {
    return y - this.groundAt(x, z, level) > LAYER_SPLIT ? 1 : 0;
  }

  heightGap(creature, player) {
    if (!player || !Number.isFinite(player.y)) return 0;
    return Math.abs(player.y - this.footY(creature));
  }

  inBiteRange(creature, player) {
    if (!player) return false;
    const gap = Math.hypot(player.x - creature.x, player.z - creature.z);
    if (gap > creature.type.biteRange) return false;
    if (this.crossesWall(creature.x, creature.z, player.x, player.z, creature.level || 0, this.footY(creature))) return false;
    return this.heightGap(creature, player) <= ATTACK_HEIGHT;
  }

  canReachFloor(creature, level) {
    return Boolean(creature.type.entersCaves) || (creature.homeLevel < 0 && level < 0);
  }

  mayChangeFloor(creature, level) {
    return this.canReachFloor(creature, level) && (creature.mode === 'chase' || creature.level !== creature.homeLevel);
  }

  levelAfterStep(creature, x, z) {
    const level = Number.isFinite(creature.level) ? creature.level : 0;
    if (!this.levelAcross) return level;
    const across = this.levelAcross(creature.x, creature.z, level, x, z);
    return across !== level && this.mayChangeFloor(creature, across) ? across : level;
  }

  wallGap(x, z, level, y) {
    return this.wallGapAt ? this.wallGapAt(x, z, level, y) : Infinity;
  }

  wallInWay(creature, x, z, level, y) {
    const gap = this.wallGap(x, z, level, y);
    return gap < BUILDING_WALL_CLEAR && gap < this.wallGap(creature.x, creature.z, creature.level || 0, this.footY(creature));
  }

  crossesWall(fromX, fromZ, toX, toZ, level, y) {
    if (!this.wallGapAt) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / WALL_CHECK_STEP));
    for (let index = 1; index < steps; index += 1) {
      const t = index / steps;
      if (this.wallGap(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t, level, y) < BUILDING_WALL_HIT) return true;
    }
    return false;
  }

  lineNearBuilding(fromX, fromZ, toX, toZ) {
    if (!this.nearBuildingAt) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / CELL_SIZE));
    for (let index = 0; index <= steps; index += 1) {
      const t = index / steps;
      if (this.nearBuildingAt(fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t)) return true;
    }
    return false;
  }

  canStep(creature, x, z, relaxed = false) {
    const level = this.levelAfterStep(creature, x, z);
    const fromY = this.footY(creature);
    const y = this.groundAt(x, z, level, fromY);
    if (this.wallInWay(creature, x, z, level, y)) return false;
    if (!relaxed && !this.canStand(x, z, level)) return false;
    const limit = this.stepLimit();
    if (Number.isFinite(limit)) {
      if (Math.abs(y - fromY) > limit) return false;
      if (!relaxed && this.wallRiseAt && this.wallRiseAt(x, z, CREATURE_WALL_MARGIN, level) > limit) return false;
    }
    return true;
  }

  walkLine(fromX, fromZ, fromY, toX, toZ, level = 0, clear = BUILDING_WALL_CLEAR) {
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    let y = Number.isFinite(fromY) ? fromY : this.groundAt(fromX, fromZ, level);
    const distance = Math.hypot(dx, dz);
    if (distance < 1e-6) return y;
    const samples = Math.max(1, Math.ceil(distance / PATH_SAMPLE));
    const limit = this.stepLimit();
    for (let index = 1; index <= samples; index += 1) {
      const t = index / samples;
      const x = fromX + dx * t;
      const z = fromZ + dz * t;
      if (!this.canStand(x, z, level)) return null;
      const next = this.groundAt(x, z, level, y);
      if (Number.isFinite(limit) && Math.abs(next - y) > limit) return null;
      if (this.wallGap(x, z, level, next) < clear) return null;
      y = next;
    }
    return y;
  }

  pathClear(fromX, fromZ, toX, toZ, level = 0, fromY = null) {
    return this.walkLine(fromX, fromZ, fromY, toX, toZ, level) !== null;
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

  cellInfo(i, j, level = 0) {
    const key = ((i + CELL_KEY_OFFSET) * CELL_KEY_SPAN + (j + CELL_KEY_OFFSET)) * 64 + (level + 32);
    const cached = this.pathCells.get(key);
    if (cached) return cached;
    const ok = this.canStand(i * CELL_SIZE, j * CELL_SIZE, level);
    const entry = { ok, y: ok ? this.groundAt(i * CELL_SIZE, j * CELL_SIZE, level) : 0 };
    this.pathCells.set(key, entry);
    return entry;
  }

  edgeFits(fromY, toY, fromI, fromJ, toI, toJ, limit, level = 0) {
    if (Math.abs(toY - fromY) <= limit) return true;
    return this.pathClear(fromI * CELL_SIZE, fromJ * CELL_SIZE, toI * CELL_SIZE, toJ * CELL_SIZE, level);
  }

  reachY(fromX, fromZ, fromY, toX, toZ, level) {
    if (!this.lineNearBuilding(fromX, fromZ, toX, toZ)) return this.groundAt(toX, toZ, level);
    return this.walkLine(fromX, fromZ, fromY, toX, toZ, level, BUILDING_WALL_HIT);
  }

  buildPath(creature, targetX, targetZ, targetLevel = creature.level, targetY = null) {
    const cells = this.searchRoute(creature, targetX, targetZ, targetLevel, PATH_GOAL_RINGS, true, targetY);
    if (!cells) return null;
    return this.smoothCells(cells.slice(0, PATH_LOOKAHEAD), this.stepLimit());
  }

  canWalkUpTo(creature, player, level, aggro) {
    if (this.now < (creature.routeCheckAt || 0)) return Boolean(creature.routeOpen);
    creature.routeCheckAt = this.now + ROUTE_CHECK_SECONDS;
    const cells = this.searchRoute(creature, player.x, player.z, level, ROUTE_GOAL_RINGS, false, player.y);
    creature.routeOpen = Boolean(cells) && cells.length * CELL_SIZE <= aggro * ROUTE_AGGRO_SHARE;
    return creature.routeOpen;
  }

  walledOff(creature, player) {
    return Boolean(player) && this.crossesWall(creature.x, creature.z, player.x, player.z, creature.level || 0, this.footY(creature));
  }

  giveUpConfused(creature) {
    creature.giveUpUntil = this.now + (creature.type.confusedSeconds || 1.4) + WALLED_GIVE_UP_SECONDS;
    this.beginSearch(creature, false);
  }

  canGetTo(creature, player, level, heightGap, aggro) {
    if (!player) return false;
    if (heightGap <= ATTACK_HEIGHT && !this.walledOff(creature, player)) return true;
    return level === creature.level && this.canWalkUpTo(creature, player, level, aggro);
  }

  searchRoute(creature, targetX, targetZ, targetLevel, goalRings, partial, targetY = null) {
    const limit = this.stepLimit();
    const cellData = this.cellInfo.bind(this);
    const node = (i, j, level, y) => ({ i, j, level, y, layer: this.layerOf(i * CELL_SIZE, j * CELL_SIZE, level, y) });
    const reachable = (fromX, fromZ, fromY, level) => (i, j) => {
      if (!cellData(i, j, level).ok) return { ok: false };
      const y = this.reachY(fromX, fromZ, fromY, i * CELL_SIZE, j * CELL_SIZE, level);
      return { ok: y !== null, y };
    };
    const startTest = reachable(creature.x, creature.z, this.footY(creature), creature.level);
    const goalTest = reachable(targetX, targetZ, targetY, targetLevel);
    const startCell = this.standableCellNear(this.cellAt(creature.x, creature.z), 2, startTest);
    const goalCell = this.standableCellNear(this.cellAt(targetX, targetZ), goalRings, goalTest);
    if (!startCell || !goalCell) return null;
    const start = node(startCell.i, startCell.j, creature.level, startTest(startCell.i, startCell.j).y);
    const goal = node(goalCell.i, goalCell.j, targetLevel, goalTest(goalCell.i, goalCell.j).y);
    const edgeCache = new Map();
    const edgeY = (from, toI, toJ) => {
      const key = `${from.i},${from.j},${from.level},${from.layer}>${toI},${toJ}`;
      if (edgeCache.has(key)) return edgeCache.get(key);
      const level = from.level;
      const fromX = from.i * CELL_SIZE;
      const fromZ = from.j * CELL_SIZE;
      const toX = toI * CELL_SIZE;
      const toZ = toJ * CELL_SIZE;
      const here = cellData(from.i, from.j, level);
      const to = cellData(toI, toJ, level);
      let y = null;
      if (here.ok && to.ok) {
        if (this.lineNearBuilding(fromX, fromZ, toX, toZ)) y = this.walkLine(fromX, fromZ, from.y, toX, toZ, level, BUILDING_WALL_HIT);
        else if (!Number.isFinite(limit) || this.edgeFits(here.y, to.y, from.i, from.j, toI, toJ, limit, level)) y = to.y;
      }
      edgeCache.set(key, y);
      return y;
    };
    const neighbours = (current) => {
      const { i, j, level } = current;
      const out = [];
      for (const [di, dj] of NEIGHBOURS_8) {
        if (this.levelAcross && (di === 0 || dj === 0)) {
          const across = this.levelAcross(i * CELL_SIZE, j * CELL_SIZE, level, (i + di) * CELL_SIZE, (j + dj) * CELL_SIZE);
          if (across !== level && this.mayChangeFloor(creature, across)) {
            const cell = cellData(i + di, j + dj, across);
            if (cell.ok) out.push({ ...node(i + di, j + dj, across, cell.y), cost: 1 });
            continue;
          }
        }
        const y = edgeY(current, i + di, j + dj);
        if (y === null) continue;
        if (di !== 0 && dj !== 0 && (edgeY(current, i + di, j) === null || edgeY(current, i, j + dj) === null)) continue;
        out.push({ ...node(i + di, j + dj, level, y), cost: Math.hypot(di, dj) });
      }
      return out;
    };
    return findCellPath({
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
      partial,
    });
  }

  lineOpen(from, to, limit) {
    const level = from.level;
    const fromX = from.i * CELL_SIZE;
    const fromZ = from.j * CELL_SIZE;
    const toX = to.i * CELL_SIZE;
    const toZ = to.j * CELL_SIZE;
    if (this.lineNearBuilding(fromX, fromZ, toX, toZ)) {
      const y = this.walkLine(fromX, fromZ, from.y, toX, toZ, level, BUILDING_WALL_HIT);
      return y !== null && (!Number.isFinite(limit) || Math.abs(y - to.y) <= limit);
    }
    const steps = Math.max(Math.abs(to.i - from.i), Math.abs(to.j - from.j));
    if (steps <= 1) return true;
    let previous = this.cellInfo(from.i, from.j, level);
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const cell = this.cellInfo(
        Math.round(from.i + (to.i - from.i) * t),
        Math.round(from.j + (to.j - from.j) * t),
        level,
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
    const sameFloor = (from, to) => cells.slice(from, to + 1).every((cell) => cell.level === cells[from].level && cell.layer === cells[from].layer);
    while (index < cells.length - 1) {
      let far = Math.min(index + SMOOTH_SPAN, cells.length - 1);
      while (far > index + 1 && (!sameFloor(index, far) || !this.lineOpen(cells[index], cells[far], limit))) {
        far -= 1;
      }
      out.push(points[far]);
      index = far;
    }
    return out;
  }

  directReach(creature, targetX, targetZ, targetLevel, targetY) {
    if (targetLevel !== creature.level) return false;
    const y = this.walkLine(creature.x, creature.z, this.footY(creature), targetX, targetZ, creature.level);
    return y !== null && (!Number.isFinite(targetY) || Math.abs(y - targetY) <= ATTACK_HEIGHT);
  }

  moveTo(creature, targetX, targetZ, speed, dt, targetLevel = creature.level, targetY = null) {
    if (targetLevel === creature.level && Math.hypot(targetX - creature.x, targetZ - creature.z) <= ARRIVE) {
      creature.path = null;
      return true;
    }
    creature.pathClock = (creature.pathClock || 0) - dt;
    if (creature.pathClock <= 0) {
      creature.pathClock = PATH_REPLAN;
      creature.path = this.directReach(creature, targetX, targetZ, targetLevel, targetY)
        ? null
        : this.buildPath(creature, targetX, targetZ, targetLevel, targetY);
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

  nearestSpot(x, z, level = 0) {
    const limit = this.stepLimit();
    const referenceY = this.groundAt(x, z, level);
    const fits = (px, pz) => {
      if (!this.canStand(px, pz, level)) return false;
      if (Number.isFinite(limit) && Math.abs(this.groundAt(px, pz, level) - referenceY) > limit) return false;
      return this.pathClear(x, z, px, pz, level);
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
      if (this.pathClear(creature.homeX, creature.homeZ, x, z, creature.homeLevel)) return { x, z };
    }
    return { x: creature.homeX, z: creature.homeZ };
  }

  tick(dt, now) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    if (Number.isFinite(now)) this.now = now;
    const player = this.playerAt ? this.playerAt() : null;
    for (const creature of this.creatures) {
      this.think(creature, dt, player);
      this.regenerate(creature, dt);
    }
    this.respawnDue(this.now, player);
  }

  regenerate(creature, dt) {
    if (!creature || creature.dead || !(creature.health > 0)) return;
    const total = creature.tier && Number.isFinite(creature.tier.health) ? creature.tier.health : 0;
    if (creature.health >= total) return;
    const rate = Number.isFinite(creature.type.regenPerSecond) ? creature.type.regenPerSecond : 0;
    if (rate <= 0) return;
    creature.health = Math.min(total, creature.health + rate * dt);
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

  statusAt(cx, cz, kind, tierKey, level = 0) {
    const slot = this.slots.get(slotKeyOf(kind, tierKey, cx, cz, level));
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
    this.idleCall(creature, dt);
    const gap = player ? Math.hypot(player.x - creature.x, player.z - creature.z) : Infinity;
    const heightGap = this.heightGap(creature, player);
    const baseAggro = Number.isFinite(creature.tier.aggroRange) ? creature.tier.aggroRange : type.aggroRange;
    const aggro = this.provoked(creature, player) ? Math.max(baseAggro, gap + 1) : baseAggro;
    const alertSeconds = Array.isArray(type.alertSeconds) ? type.alertSeconds : [2, 3];
    const playerFloor = this.playerLevel ? this.playerLevel() : 0;
    const sameFloor = playerFloor === creature.level;
    const sees = sameFloor || (Boolean(player) && Boolean(this.floorsLinked) && this.canReachFloor(creature, playerFloor) && this.floorsLinked(creature.x, creature.z, creature.level, playerFloor));
    const inView = Boolean(player) && sees && gap < aggro * CHASE_RANGE && this.seesPlayerNow(creature);
    if (inView) {
      creature.lastSeenX = player.x;
      creature.lastSeenZ = player.z;
      creature.lastSeenLevel = playerFloor;
    }
    const gaveUp = this.now < (creature.giveUpUntil || 0)
      && !(sameFloor && this.canWalkUpTo(creature, player, playerFloor, aggro));
    const canAggro = inView && gap < aggro && !gaveUp;

    if (creature.mode === 'buried') {
      const emergeRange = Number.isFinite(type.emergeRange) ? type.emergeRange : aggro;
      if (inView && gap <= emergeRange && !gaveUp) {
        creature.mode = 'emerging';
        creature.timer = creature.emergeSeconds;
        if (gap > 0.001) creature.facing = Math.atan2(player.x - creature.x, player.z - creature.z);
        this.playSound(creature, 'dig');
        if (this.onDig) this.onDig(creature);
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
      if (creature.lungeLeft > 0 && creature.timer < Math.min(type.biteWindup, LUNGE_SECONDS)) this.lunge(creature, player, dt);
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
        this.beginAggro(creature, alertSeconds, this.canGetTo(creature, player, playerFloor, heightGap, aggro));
        return;
      }
      if (creature.searching) {
        const speed = type.walkSpeed * creature.tier.speed;
        const arrived = this.moveTo(creature, creature.searchX, creature.searchZ, speed, dt);
        const stuck = !arrived && !creature.walking && (creature.stuckTime || 0) > STUCK_ESCAPE_SECONDS;
        if (arrived || stuck || this.now > creature.searchUntil) {
          creature.searching = false;
          creature.timer = type.confusedSeconds || 1.4;
        }
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
      if ((gap <= type.chargeRange || creature.timer <= 0) && this.canGetTo(creature, player, playerFloor, heightGap, aggro)) {
        this.beginCharge(creature);
        return;
      }
      if (creature.timer <= 0) {
        if (this.walledOff(creature, player)) {
          this.giveUpConfused(creature);
          return;
        }
        creature.giveUpUntil = this.now + (type.confusedSeconds || 1.4) + GIVE_UP_SECONDS;
        creature.mode = 'roam';
        creature.targetX = creature.homeX;
        creature.targetZ = creature.homeZ;
        creature.timer = randomBetween(4, 8);
      }
      return;
    }

    if (canAggro) {
      const reachable = this.canGetTo(creature, player, playerFloor, heightGap, aggro);
      if (creature.mode !== 'chase') {
        if (gap <= type.chargeRange && reachable) {
          this.beginCharge(creature);
        } else if (!reachable && this.walledOff(creature, player)) {
          this.giveUpConfused(creature);
          return;
        } else {
          this.beginAggro(creature, alertSeconds, reachable);
          return;
        }
      }
      if (this.inBiteRange(creature, player) && creature.cooldown <= 0) {
        creature.mode = 'windup';
        creature.timer = type.biteWindup;
        creature.lungeLeft = Number.isFinite(type.biteLunge) && type.biteLunge > 0 ? type.biteLunge : 0;
        if (gap > 0.001) creature.facing = Math.atan2(player.x - creature.x, player.z - creature.z);
        return;
      }
      creature.mode = 'chase';
    }

    if (creature.mode === 'chase') {
      if (!inView || (sameFloor ? !this.canGetTo(creature, player, playerFloor, heightGap, aggro) : !this.canReachFloor(creature, playerFloor))) {
        if (inView && sameFloor && this.walledOff(creature, player)) this.giveUpConfused(creature);
        else this.beginSearch(creature, true);
        return;
      }
      const walled = this.crossesWall(creature.x, creature.z, player.x, player.z, creature.level || 0, this.footY(creature)) || heightGap > ATTACK_HEIGHT;
      const standoff = walled ? 0 : type.biteRange * 0.85;
      if ((sameFloor && !walled && gap <= standoff) || gap < 0.001) return;
      const dirX = (player.x - creature.x) / gap;
      const dirZ = (player.z - creature.z) / gap;
      const boost = Number.isFinite(type.chaseBoost) ? type.chaseBoost : 1;
      const speed = type.walkSpeed * creature.tier.speed * boost;
      const arrived = this.moveTo(creature, player.x - dirX * standoff, player.z - dirZ * standoff, speed, dt, playerFloor, player.y);
      const blocked = !arrived && !creature.walking;
      creature.blockedTime = blocked ? creature.blockedTime + dt : 0;
      if (creature.blockedTime > CHASE_STUCK_SECONDS) {
        creature.giveUpUntil = this.now + (type.confusedSeconds || 1.4) + GIVE_UP_SECONDS;
        this.beginSearch(creature, false);
      }
      return;
    }

    if (creature.mode === 'roam') {
      const speed = type.walkSpeed * creature.tier.speed * 0.6;
      const arrived = this.moveTo(creature, creature.targetX, creature.targetZ, speed, dt, creature.homeLevel);
      const headingHome = Math.abs(creature.targetX - creature.homeX) < 0.01
        && Math.abs(creature.targetZ - creature.homeZ) < 0.01;
      const gaveUp = creature.timer <= 0 && (!headingHome || creature.timer < -HOME_PATIENCE);
      if (arrived || gaveUp) {
        const nearHome = Math.hypot(creature.x - creature.homeX, creature.z - creature.homeZ) <= 0.6;
        if (type.buried && nearHome) {
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

  seesPlayerNow(creature) {
    if (!this.seesPlayer) return true;
    if (this.now < (creature.sightCheckAt || 0)) return Boolean(creature.seesPlayerCached);
    creature.sightCheckAt = this.now + SIGHT_HOLD;
    creature.seesPlayerCached = Boolean(this.seesPlayer(creature));
    return creature.seesPlayerCached;
  }

  beginSearch(creature, search) {
    creature.engaged = false;
    creature.mode = 'confused';
    creature.timer = creature.type.confusedSeconds || 1.4;
    creature.searching = Boolean(search)
      && Number.isFinite(creature.lastSeenX)
      && Number.isFinite(creature.lastSeenZ)
      && creature.lastSeenLevel === creature.level;
    if (creature.searching) {
      creature.searchX = creature.x + (creature.lastSeenX - creature.x) * SEARCH_SHARE;
      creature.searchZ = creature.z + (creature.lastSeenZ - creature.z) * SEARCH_SHARE;
    }
    creature.searchUntil = this.now + SEARCH_PATIENCE;
    creature.pathClock = 0;
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
    if (this.onDig) this.onDig(creature);
  }

  beginCharge(creature) {
    if (!creature.engaged) {
      creature.engaged = true;
      creature.markTimer = COMBAT_MARK_SECONDS;
      this.playSound(creature, 'charge');
    }
    creature.mode = 'chase';
  }

  biteReaches(creature, player) {
    if (!player || this.heightGap(creature, player) > ATTACK_HEIGHT) return false;
    if (this.crossesWall(creature.x, creature.z, player.x, player.z, creature.level || 0, this.footY(creature))) return false;
    const dx = player.x - creature.x;
    const dz = player.z - creature.z;
    const distance = Math.hypot(dx, dz);
    if (distance - PLAYER_BODY > creature.type.biteRange) return false;
    if (distance <= PLAYER_BODY) return true;
    const arc = (Number.isFinite(creature.type.biteArc) ? creature.type.biteArc : 90) * Math.PI / 180;
    const turn = Math.abs(angleGap(creature.facing, Math.atan2(dx, dz)));
    return turn <= arc / 2 + Math.asin(Math.min(1, PLAYER_BODY / distance));
  }

  lunge(creature, player, dt) {
    const type = creature.type;
    const nose = creatureLength(type) * creatureScale(type, creature.tier) / 2;
    if (player && Math.hypot(player.x - creature.x, player.z - creature.z) <= nose + PLAYER_BODY) {
      creature.lungeLeft = 0;
      return;
    }
    const startX = creature.x;
    const startZ = creature.z;
    const facing = creature.facing;
    const speed = type.biteLunge / Math.min(type.biteWindup, LUNGE_SECONDS);
    this.walkTo(creature, startX + Math.sin(facing) * creature.lungeLeft, startZ + Math.cos(facing) * creature.lungeLeft, speed, dt);
    creature.facing = facing;
    const moved = Math.hypot(creature.x - startX, creature.z - startZ);
    creature.lungeLeft = moved > 0.0001 ? Math.max(0, creature.lungeLeft - moved) : 0;
  }

  biteView(creature) {
    if (!creature || creature.mode !== 'windup' || creature.dead) return null;
    const windup = creature.type.biteWindup > 0 ? creature.type.biteWindup : 1;
    const arc = (Number.isFinite(creature.type.biteArc) ? creature.type.biteArc : 90) * Math.PI / 180;
    return { reach: creature.type.biteRange + PLAYER_BODY + (creature.lungeLeft || 0), arc, facing: creature.facing, progress: Math.max(0, Math.min(1, 1 - creature.timer / windup)) };
  }

  resolveBite(creature, player) {
    if (!player) return;
    if (!this.biteReaches(creature, player)) {
      if (this.onBiteMiss) this.onBiteMiss(creature, true);
      return;
    }
    const attack = creatureStat(creature.type, creature.tier, 'attack');
    const defense = this.defenseAt ? this.defenseAt() : 0;
    const quality = rollQuality(attack, defense);
    if (quality === 'miss') {
      if (this.onBiteMiss) this.onBiteMiss(creature, false);
      return;
    }
    const bite = creature.tier && creature.tier.bite !== undefined
      ? creature.tier.bite
      : creature.type.bite;
    const scale = quality === 'crit' ? CRIT_MULTIPLIER : quality === 'graze' ? GRAZE_MULTIPLIER : 1;
    const damage = rollDamage(bite) * scale;
    const damageType = (creature.tier && creature.tier.damageType) || creature.type.damageType || null;
    if (this.onBite) this.onBite(creature, damage, quality === 'crit', damageType, quality === 'graze');
  }

  idleCall(creature, dt) {
    const range = creature.type.idleCallSeconds;
    if (!Array.isArray(range) || (creature.mode !== 'idle' && creature.mode !== 'roam')) return;
    if (!Number.isFinite(creature.callTimer)) creature.callTimer = randomBetween(range[0], range[1]);
    creature.callTimer -= dt;
    if (creature.callTimer > 0) return;
    creature.callTimer = randomBetween(range[0], range[1]);
    this.playSound(creature, 'idle');
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
      const fromY = this.footY(creature);
      creature.level = this.levelAfterStep(creature, tryX, tryZ);
      creature.y = this.groundAt(tryX, tryZ, creature.level, fromY);
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
      if (pose && pose.sound) this.playSound(creature, pose.sound);
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
      const combat = rising || ATTACK_MODES.includes(creature.mode);
      const hovered = creature === this.hovered;
      const selected = creature === this.selected;
      const calm = !alert && !combat;
      const color = selected && calm ? OUTLINE_CALM : alert && !combat ? OUTLINE_GOLD : COMBAT_COLOR;
      const goal = hidden ? 0 : alert || combat || hovered || selected ? 1 : 0;
      const fade = OUTLINE_FADE_SPEED * seconds;
      creature.outlineLevel += Math.max(-fade, Math.min(fade, goal - creature.outlineLevel));
      const widthScale = combat ? OUTLINE_COMBAT_SCALE : 1;
      const pulseSpeed = combat ? OUTLINE_COMBAT_SPEED : OUTLINE_PULSE_SPEED;
      this.applyOutline(creature, color, widthScale, pulseSpeed);
      this.updateMarker(creature, seconds);
    }
    this.updateCorpses(seconds);
  }

  setSeen(creature, seen) {
    if (!creature || !creature.holder || creature.holder.isDisposed()) return;
    const unseen = !seen;
    if (Boolean(creature.unseen) === unseen) return;
    creature.unseen = unseen;
    creature.holder.setEnabled(seen);
    if (unseen && this.hovered === creature) this.hovered = null;
  }

  inFight(creature) {
    return Boolean(creature) && (Boolean(creature.engaged) || FIGHT_MODES.includes(creature.mode));
  }

  healthBarTargets() {
    const out = [];
    for (const creature of this.creatures) {
      if (!creature || !creature.slotKey || !Number.isFinite(creature.health) || creature.buried || creature.unseen) continue;
      const total = creature.tier && Number.isFinite(creature.tier.health) ? creature.tier.health : 0;
      if (total <= 0) continue;
      const ratio = creature.health / total;
      if (ratio >= 0.999 && !this.isHostile(creature) && this.hovered !== creature) continue;
      out.push({ creature, ratio });
    }
    return out;
  }

  isHostile(creature) {
    return Boolean(creature) && HOSTILE_MODES.includes(creature.mode);
  }

  isPlayerInCombat(player) {
    if (!player) return false;
    return this.creatures.some((creature) => {
      if (!creature || creature.dead || creature.buried) return false;
      if (!creature.engaged && !this.isHostile(creature)) return false;
      const bite = creature.type && Number.isFinite(creature.type.biteRange)
        ? creature.type.biteRange
        : 1.2;
      const gap = Math.hypot(player.x - creature.x, player.z - creature.z);
      return gap <= bite + 0.8;
    });
  }

  pickableMesh(mesh) {
    if (!this.pickMeshes.includes(mesh) && !this.meshes.includes(mesh)) return false;
    const level = this.pointerLevel ? this.pointerLevel() : null;
    if (level === null) return true;
    const owner = this.pickOwner.get(mesh) || this.creatures.find((item) => item.meshes.includes(mesh));
    return !owner || (owner.level || 0) === level;
  }

  hoverAt(x, y) {
    if (!this.creatures.length || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.hovered = null;
      this.hoveredCorpse = null;
      return null;
    }
    const pick = this.s.pick(x, y, (mesh) => this.pickableMesh(mesh));
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
    marker.material.emissiveColor = doubt || alert ? OUTLINE_GOLD : COMBAT_COLOR;
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
    if (this.selected === creature) this.selected = null;
    if (this.hoveredCorpse === creature) this.hoveredCorpse = null;
    const slot = creature.slotKey ? this.slots.get(creature.slotKey) : null;
    if (slot && slot.creature === creature) slot.creature = null;
    const holder = creature.holder;
    if (!holder || holder.isDisposed()) return;
    if (creature.unseen) {
      creature.unseen = false;
      holder.setEnabled(true);
    }
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
    const level = creature.level;
    const fromY = creature.y;
    return Math.max(
      this.groundAt(x, z, level, fromY),
      this.groundAt(x + reach, z, level, fromY),
      this.groundAt(x - reach, z, level, fromY),
      this.groundAt(x, z + reach, level, fromY),
      this.groundAt(x, z - reach, level, fromY),
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
    const pick = this.s.pick(x, y, (mesh) => this.pickableMesh(mesh));
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
    if (!entry.remaining) {
      const config = corpse.type && corpse.type.loot ? corpse.type.loot : {};
      entry.remaining = {};
      for (const [itemKey, amount] of Object.entries(config)) {
        if (Number.isFinite(amount) && amount > 0) entry.remaining[itemKey] = amount;
      }
    }
    const left = Object.entries(entry.remaining).map(([itemKey, amount]) => ({ itemKey, amount }));
    if (!left.length) return null;
    return left;
  }

  takeLoot(corpse, itemKey) {
    const entry = this.corpses.find((item) => item.creature === corpse);
    if (!entry || entry.looted || !entry.remaining || !entry.remaining[itemKey]) return null;
    const taken = { itemKey, amount: entry.remaining[itemKey] };
    delete entry.remaining[itemKey];
    if (!Object.keys(entry.remaining).length) {
      entry.looted = true;
      entry.sinkAt = Math.min(entry.sinkAt, entry.age + CORPSE_LOOT_SINK_DELAY);
      if (this.hoveredCorpse === corpse) this.hoveredCorpse = null;
      for (const mesh of corpse.meshes || []) mesh.renderOutline = false;
    }
    return taken;
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
    for (const material of creature.tintMaterials || []) material.dispose();
    if (creature.instance) {
      for (const group of creature.instance.animationGroups || []) group.dispose();
      for (const skeleton of creature.instance.skeletons || []) skeleton.dispose();
    }
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
        slotLevel: slot.entry.level || 0,
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
          level: Number.isFinite(creature.level) ? creature.level : 0,
          homeLevel: creature.homeLevel,
          y: Number.isFinite(creature.y) ? creature.y : null,
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

  savedFootY(x, z, level, y) {
    if (!Number.isFinite(y)) return null;
    const ground = this.groundAt(x, z, level, y);
    const limit = this.stepLimit();
    return Math.abs(ground - y) <= (Number.isFinite(limit) ? limit : ATTACK_HEIGHT) ? ground : null;
  }

  applyLive(creature, saved) {
    if (!creature || !saved) return;
    if (Number.isFinite(saved.level)) creature.level = saved.level;
    if (Number.isFinite(saved.homeLevel)) creature.homeLevel = saved.homeLevel;
    if (Number.isFinite(saved.x) && Number.isFinite(saved.z)) {
      const spot = this.nearestSpot(saved.x, saved.z, creature.level);
      creature.x = spot.x;
      creature.z = spot.z;
      creature.y = this.savedFootY(spot.x, spot.z, creature.level, saved.y);
      if (creature.level === creature.homeLevel) {
        creature.homeX = spot.x;
        creature.homeZ = spot.z;
      }
      creature.renderX = spot.x;
      creature.renderZ = spot.z;
      creature.renderY = null;
    }
    if (Number.isFinite(saved.facing)) {
      creature.facing = saved.facing;
      creature.renderFacing = saved.facing;
    }
    if (Number.isFinite(saved.health)) creature.health = saved.health;
  }
}
