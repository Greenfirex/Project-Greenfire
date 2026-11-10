// Část herní scény: tvorové a souboj — útok, zásah, čísla poškození, ukazatele zdraví a smrt hráče.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { screenPointOf } from '../utils/screenPoint.js';
import { cellToWorldCoords } from '../utils/gridMath.js';

const PLAYER_FLOAT_HEIGHT = 2.2;
const CREATURE_SOUND_RANGE = 22;
const CREATURE_BAR_LIFT = 0.4;
const BACK_HIT_DOT = -0.2;

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
    system.defenseAt = () => this.playerStats.defense;
    system.onMeshReady = (mesh) => this.addShadowCaster(mesh);
    system.onMeshGone = (mesh) => this.removeShadowCaster(mesh);
    system.onRosterChange = () => {
      this.refreshShadowCasters();
      this.refreshReflectionExclusions();
    };
    system.onSound = (key, creature) => this.playCreatureSound(key, creature);
    system.onBite = (creature, damage, crit) => this.onCreatureBite(creature, damage, crit);
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
    const root = this.playerSystem.root;
    const center = root ? root.position : this.cameraSystem.viewCenter();
    const distance = Math.hypot(creature.renderX - center.x, creature.renderZ - center.z);
    const gain = Math.max(0, Math.min(1, 1 - distance / CREATURE_SOUND_RANGE));
    if (gain <= 0.02) return;
    this.audioSystem.play(key, { gain });
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
    if (swung) this.playerStats.spendAttack();
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

  lootCorpse(corpse) {
    if (!corpse) return false;
    const yields = this.creatureSystem.loot(corpse);
    if (!yields) return false;
    this.creatureTooltipOn = false;
    this.tooltipPanel.hide();
    this.decoHighlight.setHover(null);
    this.beginLootPickup(corpse.x, corpse.z, () => this.receiveLoot(yields));
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
    this.audioSystem.play('bare');
    const label = creature.type ? creature.type.label : 'Tvor';
    this.showFloatingDamage(creature, amount, crit);
    if (killed) {
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

  hurtPlayer(amount, label, crit = false, fromBehind = false) {
    if (!this.loaded || this.paused || this.dying) return false;
    if (!this.playerStats.hurt(amount)) return false;
    this.audioSystem.play(crit ? 'hurtCrit' : 'hurt');
    if (this.options.cameraShake) this.cameraSystem.shake(0.28, 0.32);
    if (this.options.damageFlash) this.vitalsBar.flash();
    if (label) this.log.add(label, 'warn');
    if (this.playerStats.health <= 0) this.onPlayerDeath(fromBehind);
    else this.playerSystem.flinch();
    return true;
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

  onCreatureBite(creature, damage, crit) {
    const who = creature && creature.type ? creature.type.label : 'Útok';
    const critText = crit ? ' kriticky' : '';
    const behind = this.isBehindPlayer(creature);
    const hurt = this.hurtPlayer(damage, `${who} — ${Math.round(damage)} poškození${critText}`, crit, behind);
    if (hurt) this.showFloatingOverPlayer(damage, crit);
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
    this.simSystem.setHalted(false);
    this.simSystem.resetAccumulator();
    this.log.add('Probral ses na pláži', 'warn');
  },
};
