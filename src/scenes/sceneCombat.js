// Část herní scény: tvorové a souboj — útok, zásah, čísla poškození, ukazatele zdraví a smrt hráče.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { screenPointOf } from '../utils/screenPoint.js';
import { cellToWorldCoords } from '../utils/gridMath.js';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER_EYE_HEIGHT } from '../systems/player/playerSystem.js';
import { SIGHT_GROUND_LIFT, SIGHT_RISE_START, SIGHT_RISE_FULL, SIGHT_HIGHER_START, SIGHT_HIGHER_FULL, SIGHT_EDGE } from '../utils/revealGlsl.js';
import { smoothstep } from '../utils/noise.js';
import { formatMeters } from '../data/maps/layoutStore.js';
import { CREATURE_TYPES, CREATURE_KEYS } from '../data/catalogs/creatures/index.js';

const PLAYER_FLOAT_HEIGHT = 2.2;
const CREATURE_BAR_LIFT = 0.4;
const BACK_HIT_DOT = -0.2;
const SIGHT_CLEARANCE = 0.3;
const CREATURE_GONE_FOG = 0.95;
const CREATURE_EYE_SHARE = 0.6;
const CORPSE_STAND = 0.9;
const CORPSE_REACH_LIFT = 0.2;

export default {
  async setupCreatures() {
    const system = this.creatureSystem;
    system.groundHeightAt = (x, z, level) => this.terrainSystem.walkHeightAt(x, z, level);
    system.walkableAt = (x, z, level) => this.isWalkableAt(x, z, level);
    system.wallRiseAt = (x, z, radius, level) => this.terrainSystem.riseNear(x, z, radius, level);
    system.levelAcross = (fromX, fromZ, level, toX, toZ) => this.navigation.stepLevel(fromX, fromZ, level, toX, toZ);
    system.playerLevel = () => this.playerSystem.level;
    system.floorsLinked = (x, z, levelA, levelB) => this.navigation.floorsLinkedNear(x, z, levelA, levelB);
    system.playerAt = () => (this.editor.active || !this.playerSystem.root ? null : this.playerSystem.root.position);
    system.walkStepLimit = this.walkStepLimit;
    system.seesPlayer = (creature) => this.creatureSeesPlayer(creature);
    system.defenseAt = () => this.playerStats.defense;
    system.onMeshReady = (mesh) => this.addShadowCaster(mesh);
    system.onMeshGone = (mesh) => this.removeShadowCaster(mesh);
    system.onRosterChange = () => {
      this.refreshShadowCasters();
      this.refreshReflectionExclusions();
    };
    system.onSound = (key, creature) => this.playCreatureSound(key, creature);
    system.onBite = (creature, damage, crit, damageType) => this.onCreatureBite(creature, damage, crit, damageType);
    system.onBiteMiss = (creature) => this.onCreatureBiteMiss(creature);
    await system.create(this.mapLayout);
    this.creatureLayoutKey = this.creatureLayoutSignature();
    this.refreshReflectionExclusions();
  },

  creatureLayoutSignature() {
    const layout = this.mapLayout || {};
    return JSON.stringify(Array.isArray(layout.creatures) ? layout.creatures : null);
  },

  async refreshCreatures() {
    const key = this.creatureLayoutSignature();
    if (key === this.creatureLayoutKey) return;
    this.creatureLayoutKey = key;
    await this.setupCreatures();
    this.refreshShadowCasters();
    if (this.editor.active) this.editor.refreshCreatureMarks();
  },

  creatureStatusAt(cx, cz, kind, tierKey, level = 0) {
    return this.creatureSystem.statusAt(cx, cz, kind, tierKey, level);
  },

  playCreatureSound(key, creature) {
    if (!key || !creature) return;
    const ear = this.listener();
    this.audioSystem.play(key, { distance: Math.hypot(creature.renderX - ear.x, creature.renderZ - ear.z) });
  },

  playerLookPoint() {
    if (!this.options.lookAtPointer) return null;
    if (this.editor.active) return null;
    const root = this.playerSystem.root;
    if (!root || !this.inputSystem.pointerInside()) return null;
    const camera = this.cameraSystem.camera;
    if (!camera) return null;
    const ray = this.s.createPickingRay(this.s.pointerX, this.s.pointerY, null, camera);
    if (!ray) return null;
    const dy = ray.direction.y;
    if (!Number.isFinite(dy) || Math.abs(dy) < 0.0001) return null;
    const t = (root.position.y - ray.origin.y) / dy;
    if (!Number.isFinite(t) || t <= 0) return null;
    return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
  },

  swingCreature(creature) {
    const swung = this.playerAttackSystem.swing(creature, this.playerSystem);
    if (swung) {
      this.playerStats.spendAttack();
      this.audioSystem.play('grunt');
    }
    return swung;
  },

  assistCreatureAtPointer() {
    const root = this.playerSystem.root;
    if (!root || !this.inputSystem.pointerInside()) return null;
    let best = null;
    let bestDistance = 32;
    const reach = this.playerAttackSystem.reach + 0.35;
    for (const creature of this.creatureSystem.creatures) {
      if (!creature || creature.dead || (creature.level || 0) !== this.creatureSystem.pointerLevel()) continue;
      const worldDistance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
      if (worldDistance > reach) continue;
      const holderY = creature.holder && !creature.holder.isDisposed()
        ? creature.holder.position.y
        : root.position.y;
      const point = this.screenPointOf(creature.renderX, holderY + creature.markHeight * 0.5, creature.renderZ);
      if (!point) continue;
      const distance = Math.hypot(point.x - this.s.pointerX, point.y - this.s.pointerY);
      if (distance > bestDistance) continue;
      best = creature;
      bestDistance = distance;
    }
    return best;
  },

  showCreaturePanel(creature) {
    if (!creature) return;
    this.creaturePanel.show(this.creaturePanelView(creature));
  },

  creaturePanelView(creature) {
    const type = creature.type || {};
    const tier = creature.tier || {};
    const kind = creature.kind;
    const total = Number.isFinite(tier.health) ? Math.round(tier.health) : 0;
    const left = Number.isFinite(creature.health) ? Math.max(0, Math.round(creature.health)) : 0;
    return {
      title: type.label || 'Tvor',
      subtitle: tier.label || '',
      left,
      total,
      rows: this.creatureStatRows(kind, type, tier, `${left} / ${total}`),
      hint: `Zabito: ${this.bestiary.killsOf(kind)} · Esc nebo × zavře`,
    };
  },

  creatureStatRows(kind, type, tier, healthText) {
    const sight = Number.isFinite(tier.aggroRange) ? tier.aggroRange : type.aggroRange;
    const speed = (Number(type.walkSpeed) || 0) * (Number.isFinite(tier.speed) ? tier.speed : 1);
    const row = (stat, label, value) => (this.bestiary.unlocked(kind, stat)
      ? { label, value }
      : { label, value: '???', locked: true });
    return [
      row('health', 'Životy', healthText),
      row('attack', 'Útok', String(tier.attack ?? '—')),
      row('defense', 'Obrana', String(tier.defense ?? '—')),
      row('sight', 'Dohled', formatMeters(sight)),
      row('speed', 'Rychlost', `${String(Math.round(speed * 10) / 10).replace('.', ',')} m/s`),
    ];
  },

  creatureName(creature) {
    const label = creature && creature.type ? creature.type.label : 'Tvor';
    const tier = creature && creature.tier ? creature.tier.label : '';
    if (!tier) return label;
    return `${tier} ${label.charAt(0).toLocaleLowerCase('cs')}${label.slice(1)}`;
  },

  recordKill(creature) {
    const entry = this.bestiary.record(creature.kind);
    const name = this.creatureName(creature);
    if (entry.first) this.log.add(`${name} — nový zápis v bestiáři`, 'gain');
    else if (entry.unlocked.length) this.log.add(`${name} — doplněný zápis v bestiáři`, 'gain');
    if (this.bestiaryWindow.open) this.refreshBestiaryWindow();
  },

  bestiaryEntries() {
    return CREATURE_KEYS.map((kind) => {
      const type = CREATURE_TYPES[kind];
      const kills = this.bestiary.killsOf(kind);
      if (!kills) return { key: kind, known: false };
      const tiers = Object.values(type.tiers || {}).map((tier) => ({
        label: tier.label || '',
        rows: this.creatureStatRows(kind, type, tier, String(tier.health ?? '—')),
      }));
      return { key: kind, known: true, title: type.label, kills, tiers };
    });
  },

  refreshBestiaryWindow() {
    this.bestiaryWindow.update(this.bestiaryEntries());
  },

  toggleBestiaryWindow() {
    if (this.bestiaryWindow.open) {
      this.bestiaryWindow.close();
      return;
    }
    this.refreshBestiaryWindow();
    this.bestiaryWindow.show();
    this.audioSystem.play('windowOpen');
    this.bestiaryButton.setActive(true);
  },

  pinCreatureAtPointer() {
    const creature = this.creatureSystem.hoverAt(this.s.pointerX, this.s.pointerY) || this.assistCreatureAtPointer();
    if (creature) {
      this.pinnedCreature = creature;
      this.creatureSystem.selected = creature;
      this.showCreaturePanel(creature);
      return;
    }
    if (this.pinnedCreature) this.unpinCreature();
  },

  unpinCreature() {
    this.pinnedCreature = null;
    this.creatureSystem.selected = null;
    this.creaturePanel.hide();
  },

  refreshPinnedCreature() {
    const creature = this.pinnedCreature;
    if (!creature) return;
    if (creature.dead || this.editor.active || !this.creatureSystem.creatures.includes(creature)) {
      this.unpinCreature();
      return;
    }
    this.showCreaturePanel(creature);
  },

  lootCorpse(corpse) {
    if (!corpse) return false;
    if (this.lootSource && this.lootSource.ref === corpse) return true;
    if (!this.creatureSystem.loot(corpse)) return false;
    this.creatureTooltipOn = false;
    this.tooltipPanel.hide();
    this.decoHighlight.setHover(null);
    const title = corpse.type ? corpse.type.label : 'Tvor';
    const ground = corpse.holder && !corpse.holder.isDisposed() ? corpse.holder.getAbsolutePosition().y : this.playerSystem.root.position.y;
    const reach = new Vector3(corpse.x, ground + CORPSE_REACH_LIFT, corpse.z);
    this.approachLoot(corpse.x, corpse.z, CORPSE_STAND, () => {
      if (this.lootSource && this.lootSource.ref === corpse) return;
      this.beginLootPickup(corpse.x, corpse.z, () => {
        this.showLoot({ kind: 'corpse', ref: corpse, x: corpse.x, z: corpse.z, title });
      }, reach);
    });
    return true;
  },

  updatePlayerAttack(dt) {
    const active = this.loaded && !this.editor.active && !this.dying;
    this.playerAttackSystem.update(active ? dt : 0);
    if (!active || !this.inputSystem.leftDown) return;
    const target = this.playerAttackSystem.target;
    if (!target || !this.creatureSystem.creatures.includes(target)) {
      this.playerAttackSystem.target = null;
      return;
    }
    if (this.creatureSystem.hovered !== target && this.assistCreatureAtPointer() !== target) {
      this.playerAttackSystem.target = null;
      return;
    }
    this.swingCreature(target);
  },

  damageCreature(creature, amount, crit) {
    if (!creature) return false;
    const killed = this.creatureSystem.damage(creature, amount, this.simSystem.time);
    this.audioSystem.play(this.playerAttackSystem.hitSound);
    const label = creature.type ? creature.type.label : 'Tvor';
    this.showFloatingDamage(creature, amount, crit);
    if (killed) {
      this.recordKill(creature);
      this.log.add(`Porazil jsi: ${label}`, 'warn');
      return true;
    }
    const left = Math.max(0, Math.round(creature.health));
    const total = creature.tier && Number.isFinite(creature.tier.health) ? Math.round(creature.tier.health) : null;
    const suffix = total === null ? '' : ` (${left} / ${total})`;
    const critText = crit ? ' kriticky' : '';
    this.log.add(`${label} — ${Math.round(amount)} poškození${critText}${suffix}`, 'action');
    return false;
  },

  missCreature(creature) {
    if (!creature) return;
    this.audioSystem.play('miss');
    const label = creature.type ? creature.type.label : 'Tvor';
    this.log.add(`Minul jsi: ${label}`, 'action');
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ, creature.level || 0);
    this.spawnFloatingText('Minul', creature.renderX, ground + creature.markHeight, creature.renderZ, 'miss');
  },

  showFloatingDamage(creature, amount, crit) {
    if (!creature) return;
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ, creature.level || 0);
    const kind = crit ? 'crit' : null;
    this.spawnFloatingNumber(amount, creature.renderX, ground + creature.markHeight, creature.renderZ, kind);
  },

  showFloatingOverPlayer(amount, crit) {
    const root = this.playerSystem.root;
    if (!root) return;
    const y = root.position.y + PLAYER_FLOAT_HEIGHT;
    this.spawnFloatingNumber(amount, root.position.x, y, root.position.z, crit ? 'crit' : 'hurt');
  },

  spawnFloatingNumber(amount, x, y, z, kind) {
    if (!Number.isFinite(amount)) return;
    this.spawnFloatingText(Math.round(amount), x, y, z, kind);
  },

  spawnFloatingText(text, x, y, z, kind) {
    if (!this.options.floatingNumbers) return;
    const point = this.screenPointOf(x, y, z);
    if (!point) return;
    this.floatingNumbers.spawn(point, text, kind);
  },

  screenPointOf(x, y, z) {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;
    return screenPointOf(this.s, this.cameraSystem.camera, canvas.getBoundingClientRect(), x, y, z);
  },

  refreshCreatureSight() {
    const system = this.creatureSystem;
    const root = this.playerSystem.root;
    const sight = this.sightSystem.view();
    const watching = Boolean(root) && !this.editor.active && sight.active;
    const eye = watching ? new Vector3(root.position.x, root.position.y + PLAYER_EYE_HEIGHT, root.position.z) : null;
    const meshes = new Set();
    for (const creature of system.creatures) {
      for (const mesh of creature.meshes) meshes.add(mesh);
      if (!watching || system.inFight(creature)) {
        system.setSeen(creature, true);
        continue;
      }
      const seen = sight.hide >= 0.5
        ? this.seesCreature(eye, creature, sight.range)
        : this.creatureFogAt(eye, root.position.y, creature, sight) < CREATURE_GONE_FOG;
      system.setSeen(creature, seen);
    }
    this.revealSystem.setCreatureMeshes(meshes);
  },

  creatureFogAt(eye, feetY, creature, sight) {
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ, creature.level || 0);
    const distance = Math.hypot(creature.renderX - eye.x, ground + SIGHT_GROUND_LIFT - eye.y, creature.renderZ - eye.z);
    const far = smoothstep(sight.range * SIGHT_EDGE, sight.range, distance);
    const rise = smoothstep(SIGHT_RISE_START, SIGHT_RISE_FULL, ground - eye.y);
    const higher = smoothstep(SIGHT_HIGHER_START, SIGHT_HIGHER_FULL, ground - feetY);
    const blocked = higher > 0 && !this.seesCreature(eye, creature, Infinity) ? higher : 0;
    return Math.max(far, rise, blocked);
  },

  creatureSeesPlayer(creature) {
    const root = this.playerSystem.root;
    if (!root || !creature) return false;
    const ground = this.terrainSystem.walkHeightAt(creature.x, creature.z, creature.level || 0);
    const eye = new Vector3(creature.x, ground + (creature.markHeight || 0) * CREATURE_EYE_SHARE, creature.z);
    const target = root.position.y + PLAYER_EYE_HEIGHT - SIGHT_GROUND_LIFT;
    return this.seesSpot(eye, root.position.x, target, root.position.z, Infinity);
  },

  seesCreature(eye, creature, range) {
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ, creature.level || 0);
    return this.seesSpot(eye, creature.renderX, ground, creature.renderZ, range);
  },

  seesSpot(eye, x, groundY, z, range) {
    const toward = new Vector3(x, groundY + SIGHT_GROUND_LIFT, z).subtractInPlace(eye);
    const length = toward.length();
    if (length > range) return false;
    if (length <= SIGHT_CLEARANCE) return true;
    const ray = new Ray(eye, toward.scaleInPlace(1 / length), length - SIGHT_CLEARANCE);
    const hit = this.s.pickWithRay(ray, (mesh) => mesh.isEnabled() && Boolean(mesh.metadata && mesh.metadata.volume), true);
    return !(hit && hit.hit);
  },

  refreshCreatureHealthBars() {
    if (!this.loaded || this.paused || this.editor.active) {
      this.creatureHealthBar.update([]);
      return;
    }
    const canvas = this.engine.getRenderingCanvas();
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) {
      this.creatureHealthBar.update([]);
      return;
    }
    const items = [];
    for (const { creature, ratio } of this.creatureSystem.healthBarTargets()) {
      const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ, creature.level || 0);
      const point = screenPointOf(this.s, this.cameraSystem.camera, rect, creature.renderX, ground + creature.markHeight + CREATURE_BAR_LIFT, creature.renderZ);
      if (!point) continue;
      if (point.x < 0 || point.y < 0 || point.x > rect.width || point.y > rect.height) continue;
      items.push({ key: creature.slotKey, x: point.x, y: point.y, ratio });
    }
    this.creatureHealthBar.update(items);
  },

  hurtPlayer(amount, crit = false, fromBehind = false, damageType = null) {
    if (!this.loaded || this.paused || this.dying) return 0;
    const dealt = this.playerStats.hurt(amount, damageType);
    if (!dealt) return 0;
    this.audioSystem.play(crit ? 'hurtCrit' : 'hurt');
    if (this.playerStats.health > 0) this.audioSystem.play('playerHurt');
    if (this.options.cameraShake) this.cameraSystem.shake(0.28, 0.32);
    if (this.options.damageFlash) this.vitalsBar.flash();
    if (this.playerStats.health <= 0) this.onPlayerDeath(fromBehind);
    else this.playerSystem.flinch();
    return dealt;
  },

  isBehindPlayer(creature) {
    const root = this.playerSystem.root;
    if (!root || !creature) return false;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance < 0.001) return false;
    const facing = this.playerSystem.facing;
    const dot = (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance;
    return dot < BACK_HIT_DOT;
  },

  onCreatureBite(creature, damage, crit, damageType) {
    const who = creature && creature.type ? creature.type.label : 'Útok';
    const critText = crit ? ' kriticky' : '';
    const behind = this.isBehindPlayer(creature);
    const dealt = this.hurtPlayer(damage, crit, behind, damageType);
    if (!dealt) return;
    const blocked = Math.max(0, Math.round(damage - dealt));
    const blockedText = blocked > 0 ? ` (odoláno ${blocked})` : '';
    this.log.add(`${who} — ${Math.round(dealt)} poškození${critText}${blockedText}`, 'warn');
    this.showFloatingOverPlayer(dealt, crit);
  },

  onCreatureBiteMiss(creature) {
    const who = creature && creature.type ? creature.type.label : 'Útok';
    this.audioSystem.play('miss');
    this.log.add(`${who} — útok minul`, 'info');
    this.showFloatingTextOverPlayer('Minul', 'miss');
  },

  showFloatingTextOverPlayer(text, kind) {
    const root = this.playerSystem.root;
    if (!root) return;
    this.spawnFloatingText(text, root.position.x, root.position.y + PLAYER_FLOAT_HEIGHT, root.position.z, kind);
  },

  onPlayerDeath(fromBehind) {
    if (this.dying) return;
    this.dying = true;
    this.deathShown = false;
    this.audioSystem.play('playerDeath');
    this.deathTimer = this.playerSystem.die(Boolean(fromBehind));
    this.playerSystem.releaseKeys();
    this.closeOpenWindows();
    this.hoverHint.hide();
    this.simSystem.setHalted(true);
  },

  updateDeath(dt) {
    if (!this.dying || this.deathShown) return;
    this.deathTimer -= dt;
    if (this.deathTimer > 0) return;
    this.deathShown = true;
    this.log.add('Zemřel jsi', 'warn');
    this.deathScreen.show();
  },

  respawnPlayer() {
    if (!this.dying) return;
    this.dying = false;
    this.deathShown = false;
    this.deathTimer = 0;
    this.deathScreen.hide();
    const spawn = this.mapLayout && this.mapLayout.spawn ? this.mapLayout.spawn : null;
    const spot = spawn ? cellToWorldCoords(spawn.cx, spawn.cz) : null;
    this.playerStats.resurrect();
    this.playerSystem.revive(spot ? spot.x : null, spot ? spot.z : null);
    this.audioSystem.play('wakeUp');
    this.simSystem.setHalted(false);
    this.simSystem.resetAccumulator();
    this.log.add('Probral ses na pláži', 'warn');
  },
};
