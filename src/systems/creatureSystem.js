// Tvorové ve světě — načte model, rozhoduje v pevném tiku a plynule ho hýbe.
// Nedrží žádný jiný systém; výšku terénu, průchodnost a hráče dostane od scény.
import '../utils/assetLoader.js';
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import '@babylonjs/core/Rendering/outlineRenderer';
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { createCreatureMarker, setMarkerIcon } from '../utils/creatureMarker.js';
import {
  CREATURE_TYPES,
  CREATURE_KEYS,
  getCreatureType,
  getCreatureTier,
  creatureLength,
  creatureScale,
  tierTint,
} from '../data/catalogs/creatures/index.js';
import { cellToWorldCoords } from '../utils/gridMath.js';

const TURN_SPEED = 3.4;
const RENDER_SMOOTHING = 0.001;
const SPOT_STEP = 0.5;
const SPOT_REACH = 12;
const ARRIVE = 0.12;
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
    this.meshes = [];
    this.containers = new Map();
    this.groundHeightAt = null;
    this.walkableAt = null;
    this.playerAt = null;
    this.onBite = null;
    this.onSound = null;
    this.onMeshReady = null;
    this.pendingState = null;
    this.hovered = null;
    this.hoverTime = 0;
  }

  async create(layout) {
    this.clear();
    const entries = this.entriesFor(layout);
    if (!entries.length) return this.creatures;
    for (const entry of entries) {
      const type = getCreatureType(entry.kind);
      if (!type) continue;
      const tierKey = entry.tier && type.tiers[entry.tier] ? entry.tier : type.defaultTier;
      const tier = getCreatureTier(type, tierKey);
      const container = await this.containerFor(type.model);
      if (!container) continue;
      const creature = this.spawn(type, tierKey, tier, entry, container);
      if (creature) this.creatures.push(creature);
    }
    if (this.pendingState) {
      const pending = this.pendingState;
      this.pendingState = null;
      this.apply(pending);
    }
    return this.creatures;
  }

  entriesFor(layout) {
    const authored = layout && Array.isArray(layout.creatures) ? layout.creatures : null;
    if (authored) return authored.filter((entry) => entry && getCreatureType(entry.kind));
    const spawn = layout && layout.spawn ? layout.spawn : { cx: 0, cz: 0 };
    const list = [];
    for (const key of CREATURE_KEYS) {
      const type = CREATURE_TYPES[key];
      if (!type || !type.defaultSpawn) continue;
      list.push({
        kind: key,
        tier: type.defaultTier,
        cx: spawn.cx + type.defaultSpawn.dx,
        cz: spawn.cz + type.defaultSpawn.dz,
      });
    }
    return list;
  }

  async containerFor(url) {
    if (this.containers.has(url)) return this.containers.get(url);
    let container = null;
    try {
      container = await LoadAssetContainerAsync(url, this.s);
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
    root.position.set(-centerX * scale, -bounds.min.y * scale, -centerZ * scale);

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
    const rig = type.rig ? type.rig.build(solid[0], skeleton) : null;

    const marker = createCreatureMarker(this.s);
    marker.parent = holder;
    const markHeight = (bounds.max.y - bounds.min.y) * scale + MARK_HEIGHT;
    marker.position.set(0, markHeight, 0);
    this.meshes.push(marker);

    const world = Number.isFinite(entry.cx) && Number.isFinite(entry.cz)
      ? cellToWorldCoords(entry.cx, entry.cz)
      : { x: Number(entry.x) || 0, z: Number(entry.z) || 0 };
    const spot = this.nearestSpot(world.x, world.z);
    const facing = Math.random() * Math.PI * 2;

    const boneSummary = type.rig ? type.rig.summary(rig) : 'bez kostry';
    console.info(`[creature] ${type.label} (${tier.label}) na ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)} — ${boneSummary}`);
    return {
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
      markTimer: 0,
      markerIcon: 'bang',
      engaged: false,
      outlineLevel: 0,
      x: spot.x,
      z: spot.z,
      facing,
      renderX: spot.x,
      renderZ: spot.z,
      renderFacing: facing,
      homeX: spot.x,
      homeZ: spot.z,
      targetX: spot.x,
      targetZ: spot.z,
      mode: 'idle',
      timer: randomBetween(type.idleSeconds[0], type.idleSeconds[1]),
      cooldown: 0,
      walking: false,
      health: tier.health,
    };
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

  nearestSpot(x, z) {
    if (this.canStand(x, z)) return { x, z };
    for (let ring = 1; ring <= SPOT_REACH / SPOT_STEP; ring += 1) {
      const radius = ring * SPOT_STEP;
      for (let step = 0; step < 8; step += 1) {
        const angle = (step / 8) * Math.PI * 2;
        const px = x + Math.cos(angle) * radius;
        const pz = z + Math.sin(angle) * radius;
        if (this.canStand(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const player = this.playerAt ? this.playerAt() : null;
    for (const creature of this.creatures) this.think(creature, dt, player);
  }

  think(creature, dt, player) {
    const type = creature.type;
    creature.walking = false;
    creature.cooldown = Math.max(0, creature.cooldown - dt);
    creature.timer -= dt;
    const gap = player ? Math.hypot(player.x - creature.x, player.z - creature.z) : Infinity;
    const aggro = Number.isFinite(creature.tier.aggroRange) ? creature.tier.aggroRange : type.aggroRange;
    const alertSeconds = Array.isArray(type.alertSeconds) ? type.alertSeconds : [2, 3];

    if (creature.mode === 'windup') {
      if (creature.timer <= 0) {
        creature.mode = 'recover';
        creature.timer = type.biteRecover;
        creature.cooldown = type.biteCooldown;
        this.playSound(creature, 'bite');
        if (this.onBite) this.onBite(creature);
      }
      return;
    }

    if (creature.mode === 'recover') {
      if (creature.timer <= 0) creature.mode = 'idle';
      return;
    }

    if (creature.mode === 'confused') {
      if (player && gap < aggro) {
        this.beginAlert(creature, alertSeconds);
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
      if (!player || gap > aggro) {
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
      if (gap <= type.chargeRange || creature.timer <= 0) {
        this.beginCharge(creature);
      }
      return;
    }

    if (player && gap < aggro) {
      if (creature.mode !== 'chase') {
        if (gap <= type.chargeRange) {
          this.beginCharge(creature);
        } else {
          this.beginAlert(creature, alertSeconds);
          return;
        }
      }
      if (gap <= type.biteRange && creature.cooldown <= 0) {
        creature.mode = 'windup';
        creature.timer = type.biteWindup;
        return;
      }
      creature.mode = 'chase';
    }

    if (creature.mode === 'chase') {
      if (!player || gap > aggro * 1.8) {
        creature.engaged = false;
        creature.mode = 'confused';
        creature.timer = creature.type.confusedSeconds || 1.4;
        return;
      }
      const standoff = type.biteRange * 0.85;
      if (gap <= standoff || gap < 0.001) return;
      const dirX = (player.x - creature.x) / gap;
      const dirZ = (player.z - creature.z) / gap;
      const speed = type.walkSpeed * creature.tier.speed;
      this.walkTo(creature, player.x - dirX * standoff, player.z - dirZ * standoff, speed, dt);
      return;
    }

    if (creature.mode === 'roam') {
      const speed = type.walkSpeed * creature.tier.speed * 0.6;
      const arrived = this.walkTo(creature, creature.targetX, creature.targetZ, speed, dt);
      if (arrived || creature.timer <= 0) {
        creature.mode = 'idle';
        creature.timer = randomBetween(type.idleSeconds[0], type.idleSeconds[1]);
      }
      return;
    }

    if (creature.timer <= 0) {
      const angle = Math.random() * Math.PI * 2;
      const reach = type.roamRadius * (0.4 + Math.random() * 0.6);
      creature.targetX = creature.homeX + Math.cos(angle) * reach;
      creature.targetZ = creature.homeZ + Math.sin(angle) * reach;
      creature.mode = 'roam';
      creature.timer = randomBetween(5, 9);
    }
  }

  beginAlert(creature, seconds) {
    creature.mode = 'alert';
    creature.timer = randomBetween(seconds[0], seconds[1]);
    this.playSound(creature, 'alert');
  }

  beginCharge(creature) {
    if (!creature.engaged) {
      creature.engaged = true;
      creature.markTimer = COMBAT_MARK_SECONDS;
      this.playSound(creature, 'charge');
    }
    creature.mode = 'chase';
  }

  playSound(creature, kind) {
    const key = creature && creature.type.sounds ? creature.type.sounds[kind] : null;
    if (!key || !this.onSound) return;
    this.onSound(key, creature);
  }

  walkTo(creature, targetX, targetZ, speed, dt) {
    const dx = targetX - creature.x;
    const dz = targetZ - creature.z;
    const distance = Math.hypot(dx, dz);
    if (distance < ARRIVE) return true;
    const dirX = dx / distance;
    const dirZ = dz / distance;
    const step = Math.min(distance, speed * dt);
    let moved = false;
    if (this.canStand(creature.x + dirX * step, creature.z + dirZ * step)) {
      creature.x += dirX * step;
      creature.z += dirZ * step;
      moved = true;
    } else if (this.canStand(creature.x + dirX * step, creature.z)) {
      creature.x += dirX * step;
      moved = true;
    } else if (this.canStand(creature.x, creature.z + dirZ * step)) {
      creature.z += dirZ * step;
      moved = true;
    }
    if (!moved) return false;
    creature.walking = true;
    creature.facing = turnToward(creature.facing, Math.atan2(dirX, dirZ), creature.type.turnRate * dt);
    return false;
  }

  update(dt) {
    if (!this.creatures.length) return;
    const seconds = Number.isFinite(dt) && dt > 0 ? Math.min(dt, 0.25) : 0;
    const blend = 1 - Math.pow(RENDER_SMOOTHING, seconds);
    this.hoverTime += seconds;
    for (const creature of this.creatures) {
      creature.renderX += (creature.x - creature.renderX) * blend;
      creature.renderZ += (creature.z - creature.renderZ) * blend;
      creature.renderFacing = turnToward(creature.renderFacing, creature.facing, TURN_SPEED * seconds);
      const ground = this.groundHeightAt
        ? this.groundHeightAt(creature.renderX, creature.renderZ)
        : 0;
      const pose = creature.type.rig
        ? creature.type.rig.pose(creature.rig, seconds, { mode: creature.mode, moving: creature.walking })
        : null;
      const bob = pose && Number.isFinite(pose.bob) ? pose.bob : 0;
      creature.holder.position.set(creature.renderX, ground + bob, creature.renderZ);
      creature.holder.rotation.y = creature.renderFacing + (creature.type.yawOffset || 0);
      const alert = creature.mode === 'alert';
      const combat = creature.mode === 'chase' || creature.mode === 'windup' || creature.mode === 'recover';
      const hovered = creature === this.hovered;
      const color = alert && !combat ? ALERT_COLOR : COMBAT_COLOR;
      const goal = alert || combat || hovered ? 1 : 0;
      const fade = OUTLINE_FADE * seconds;
      creature.outlineLevel += Math.max(-fade, Math.min(fade, goal - creature.outlineLevel));
      const widthScale = combat ? OUTLINE_COMBAT_SCALE : 1;
      const pulseSpeed = combat ? OUTLINE_COMBAT_SPEED : OUTLINE_ALERT_SPEED;
      this.applyOutline(creature, color, widthScale, pulseSpeed);
      this.updateMarker(creature, seconds);
    }
  }

  hoverAt(x, y) {
    if (!this.creatures.length || !Number.isFinite(x) || !Number.isFinite(y)) {
      this.hovered = null;
      return null;
    }
    const pick = this.s.pick(x, y, (mesh) => this.meshes.includes(mesh));
    const mesh = pick && pick.hit ? pick.pickedMesh : null;
    const creature = mesh ? this.creatures.find((item) => item.meshes.includes(mesh)) : null;
    this.hovered = creature || null;
    return creature || null;
  }

  clearHover() {
    this.hovered = null;
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
    creature.markTimer = Math.max(0, creature.markTimer - seconds);
    const doubt = creature.mode === 'confused';
    const alert = creature.mode === 'alert';
    const show = doubt || alert || creature.markTimer > 0;
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

  serialize() {
    return {
      list: this.creatures.map((creature) => ({
        kind: creature.kind,
        tier: creature.tierKey,
        x: creature.x,
        z: creature.z,
        facing: creature.facing,
        health: creature.health,
      })),
    };
  }

  defaultState() {
    return { list: [] };
  }

  apply(data) {
    const list = data && Array.isArray(data.list) ? data.list : [];
    if (!list.length) return;
    if (!this.creatures.length) {
      this.pendingState = data;
      return;
    }
    for (let index = 0; index < this.creatures.length; index += 1) {
      const saved = list[index];
      const creature = this.creatures[index];
      if (!saved || !creature || saved.kind !== creature.kind) continue;
      if (Number.isFinite(saved.x) && Number.isFinite(saved.z)) {
        const spot = this.nearestSpot(saved.x, saved.z);
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

  clear() {
    for (const creature of this.creatures) {
      if (creature.holder && !creature.holder.isDisposed()) creature.holder.dispose();
    }
    this.creatures = [];
    this.meshes = [];
    this.hovered = null;
  }
}
