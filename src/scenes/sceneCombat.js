// Část herní scény: tvorové a souboj — útok, zásah, čísla poškození, ukazatele zdraví a smrt hráče.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { screenPointOf } from '../utils/screenPoint.js';
import { cellToWorldCoords } from '../utils/gridMath.js';
import { nestSpots } from '../utils/nestGuard.js';
import { Ray } from '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PLAYER_EYE_HEIGHT, PLAYER_BODY } from '../systems/player/playerSystem.js';
import { SIGHT_GROUND_LIFT, SIGHT_RISE_START, SIGHT_RISE_FULL, SIGHT_HIGHER_START, SIGHT_HIGHER_FULL, SIGHT_EDGE } from '../utils/revealGlsl.js';
import { smoothstep } from '../utils/noise.js';
import { formatMeters } from '../data/maps/layoutStore.js';
import { PLAYER_BASE } from '../data/catalogs/player.js';
import { CREATURE_TYPES, CREATURE_KEYS, creatureStat, creatureResistances } from '../data/catalogs/creatures/index.js';
import { DAMAGE_TYPES, DAMAGE_TYPE_KEYS } from '../data/catalogs/damage.js';
import { ITEM_TYPES } from '../data/catalogs/items.js';
import { ASSET_DIRS } from '../data/catalogs/assetPaths.js';
import { strikeChances, damageText } from '../utils/combatRoll.js';
import { angleGap } from '../utils/angles.js';
import AttackArc, { DANGER_COLOR } from '../effects/attackArc.js';

const PLAYER_FLOAT_HEIGHT = 2.55;
const PLAYER_BAR_HEIGHT = 2.3;
const CREATURE_BAR_LIFT = 0.4;
const BACK_HIT_DOT = -0.2;
const SIGHT_CLEARANCE = 0.3;
const CREATURE_GONE_FOG = 0.95;
const CREATURE_EYE_SHARE = 0.6;
const CORPSE_STAND = 0.9;
const CORPSE_REACH_LIFT = 0.2;
const AIM_ASSIST = 20 * Math.PI / 180;
const AIM_ASSIST_REACH = 0.4;
const GRUNT_CHANCE = { primary: 0.08, secondary: 0.6 };
const BITE_ARC_ALPHA = 0.1;
const FOCUS_LINGER = 3;

export default {
  creatureGroundAt(x, z, level = 0, fromY = null) {
    const ground = this.terrainSystem.walkHeightAt(x, z, level);
    if ((level || 0) !== 0) return ground;
    const deck = this.buildingSystem.walkHeightAt(x, z, Number.isFinite(fromY) ? fromY : ground);
    return deck === null ? ground : Math.max(ground, deck);
  },

  async setupCreatures() {
    const system = this.creatureSystem;
    system.groundHeightAt = (x, z, level, fromY) => this.creatureGroundAt(x, z, level, fromY);
    system.wallGapAt = (x, z, level, y) => ((level || 0) === 0 ? this.buildingSystem.wallGapAt(x, z, Number.isFinite(y) ? y : this.creatureGroundAt(x, z, 0)) : Infinity);
    system.nearBuildingAt = (x, z) => this.buildingSystem.nearCell(x, z);
    system.walkableAt = (x, z, level) => this.isWalkableAt(x, z, level);
    system.bodyFree = (x, z, level, here, body, relaxed) => this.navigation.bodyFree(x, z, level, here, body, relaxed);
    system.objectInWay = (x, z, radius, level) => this.navigation.objectInWay(x, z, radius, level);
    system.objectsVersion = () => this.decoSystem.blockedVersion;
    system.playerRadius = PLAYER_BODY.radius;
    system.levelAcross = (fromX, fromZ, level, toX, toZ) => this.navigation.stepLevel(fromX, fromZ, level, toX, toZ);
    system.doorsBetween = (fromLevel, toLevel) => this.navigation.doorsBetween(fromLevel, toLevel);
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
    system.onBite = (creature, damage, crit, damageType, graze) => this.onCreatureBite(creature, damage, crit, damageType, graze);
    system.onBiteMiss = (creature, dodged) => this.onCreatureBiteMiss(creature, dodged);
    this.playerAttackSystem.onStruck = (struck) => this.focusCreature(struck[0]);
    system.setNests(nestSpots(this.mapLayout));
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

  pointerGroundPoint() {
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

  attackToward(creature = null, kind = 'primary') {
    if (kind === 'primary') this.attackHeld = true;
    const attack = this.playerAttackSystem;
    if (this.drawStrike || !attack.canSwing()) return false;
    const blow = attack.blow(kind);
    if (!this.playerStats.canSpend(blow.cost)) return false;
    const aim = this.aimPoint(creature, blow);
    if (!aim) return false;
    if (this.drawWeapon()) {
      this.playerSystem.faceTo(aim.x, aim.z);
      this.drawStrike = { creature, kind, left: this.playerSystem.toolSwapLeft };
      return true;
    }
    const swung = attack.swingAt(aim.x, aim.z, this.playerSystem, kind);
    if (swung) {
      if (this.attackArc) this.attackArc.pulse();
      this.playerStats.spendStamina(blow.cost);
      this.audioSystem.play('grunt', { chance: GRUNT_CHANCE[kind] });
    }
    return swung;
  },

  secondaryAttackToward() {
    return this.attackToward(null, 'secondary');
  },

  tryDodge() {
    if (!this.loaded || this.editor.active || this.dying || this.paused) return false;
    const player = this.playerSystem;
    const root = player.root;
    const dodge = PLAYER_BASE.dodge || {};
    if (!root || !player.canDodge() || this.playerAttackSystem.pending) return false;
    if (!this.playerStats.canSpend(dodge.cost)) return false;
    let direction = player.inputDirection();
    if (!direction) {
      const point = this.pointerGroundPoint();
      const away = point ? { x: root.position.x - point.x, z: root.position.z - point.z } : null;
      direction = away && Math.hypot(away.x, away.z) > 0.01
        ? away
        : { x: -Math.sin(player.facing), z: -Math.cos(player.facing) };
    }
    if (!player.dodge(direction.x, direction.z)) return false;
    this.drawStrike = null;
    this.playerStats.spendStamina(dodge.cost);
    this.playerStats.protect(dodge.immunity);
    this.audioSystem.play('dodgeRoll');
    return true;
  },

  attackCandidates() {
    const level = this.playerSystem.level || 0;
    return this.creatureSystem.creatures.filter((creature) => creature && !creature.dead && !creature.buried && (creature.level || 0) === level
      && this.playerAttackSystem.levelOk(creature, this.playerSystem));
  },

  pointedCreature(x, y) {
    return this.creatureSystem.hoverAt(x, y) || this.assistCreatureAtPointer();
  },

  aimPoint(creature, blow = this.playerAttackSystem.blow('primary')) {
    const root = this.playerSystem.root;
    if (!root) return null;
    if (creature) return { x: creature.x, z: creature.z };
    const point = this.pointerGroundPoint();
    if (!point) return null;
    const aim = Math.atan2(point.x - root.position.x, point.z - root.position.z);
    const attack = this.playerAttackSystem;
    let best = null;
    let bestTurn = AIM_ASSIST;
    for (const candidate of this.attackCandidates()) {
      const dx = candidate.x - root.position.x;
      const dz = candidate.z - root.position.z;
      if (Math.hypot(dx, dz) - attack.bodyRadius(candidate) > blow.reach + AIM_ASSIST_REACH) continue;
      const turn = Math.abs(angleGap(aim, Math.atan2(dx, dz)));
      if (turn > bestTurn) continue;
      best = candidate;
      bestTurn = turn;
    }
    return best ? { x: best.x, z: best.z } : point;
  },

  assistCreatureAtPointer() {
    const root = this.playerSystem.root;
    if (!root || !this.inputSystem.pointerInside()) return null;
    let best = null;
    let bestDistance = 32;
    const reach = this.playerAttackSystem.reach + 0.35;
    for (const creature of this.creatureSystem.creatures) {
      if (!creature || creature.dead || (creature.level || 0) !== this.creatureSystem.pointerLevel()) continue;
      if (!this.playerAttackSystem.levelOk(creature, this.playerSystem)) continue;
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
      ? { stat, label, value, stage: this.bestiary.needed(stat) }
      : { stat, label, value: '???', locked: true, stage: this.bestiary.needed(stat) });
    const damageType = DAMAGE_TYPES[type.damageType];
    const bite = tier.bite ?? type.bite;
    const biteText = bite === undefined ? '—' : `${damageText(bite)}${damageType ? ` ${damageType.short.toLocaleLowerCase('cs')}` : ''}`;
    const resistances = creatureResistances(type, tier);
    return [
      row('health', 'Životy', healthText),
      row('attack', 'Útok', String(tier.attack ?? '—')),
      row('defense', 'Obrana', String(tier.defense ?? '—')),
      row('damage', 'Poškození', biteText),
      row('armor', 'Zbroj', String(creatureStat(type, tier, 'armor'))),
      ...DAMAGE_TYPE_KEYS.map((key) => row('resistances', `Odolnost: ${DAMAGE_TYPES[key].short}`, `${Math.round(resistances[key])} %`)),
      row('sight', 'Dohled', formatMeters(sight)),
      row('speed', 'Rychlost', `${String(Math.round(speed * 10) / 10).replace('.', ',')} m/s`),
    ];
  },

  hitChanceText(creature) {
    if (!creature) return '';
    const defense = creatureStat(creature.type, creature.tier, 'defense');
    const { hit } = strikeChances(this.playerAttackSystem.attack, defense);
    const percent = (value) => `${Math.round(value * 100)} %`;
    return `Zásah ${percent(hit)}`;
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
    if (entry.first) this.log.combat(`${name} — nový zápis v bestiáři`, 'gain');
    else if (entry.unlocked.length) this.log.combat(`${name} — doplněný zápis v bestiáři`, 'gain');
    if (this.bestiaryWindow.open) this.refreshBestiaryWindow();
  },

  bestiaryEntries() {
    return CREATURE_KEYS.map((kind) => {
      const type = CREATURE_TYPES[kind];
      const kills = this.bestiary.killsOf(kind);
      if (!this.bestiary.known(kind)) return { key: kind, known: false };
      const lore = type.bestiary || {};
      const part = (stat, value) => ({
        value: this.bestiary.unlocked(kind, stat) ? value : null,
        stage: this.bestiary.needed(stat),
      });
      const loot = Object.entries(type.loot || {})
        .map(([key, count]) => `${(ITEM_TYPES[key] && ITEM_TYPES[key].displayName) || key}${count > 1 ? ` ×${count}` : ''}`)
        .join(', ');
      const tiers = Object.values(type.tiers || {}).map((tier) => {
        const resistances = creatureResistances(type, tier);
        return {
          label: tier.label || '',
          rows: this.creatureStatRows(kind, type, tier, String(tier.health ?? '—')).filter((row) => row.stat !== 'resistances'),
          resistances: part('resistances', DAMAGE_TYPE_KEYS
            .filter((key) => Math.round(resistances[key]) !== 0)
            .map((key) => ({ label: DAMAGE_TYPES[key].short, icon: DAMAGE_TYPES[key].icon, value: Math.round(resistances[key]) }))),
        };
      });
      return {
        key: kind,
        known: true,
        title: type.label,
        kills,
        portrait: part('portrait', `${ASSET_DIRS.bestiary}${kind}.png`),
        summary: part('summary', lore.summary || ''),
        habitat: part('habitat', lore.habitat || ''),
        loot: part('loot', loot || 'nic'),
        notes: part('notes', lore.notes || ''),
        tiers,
      };
    });
  },

  setBestiaryRevealAll(on) {
    this.bestiary.setRevealAll(on);
    this.refreshBestiaryWindow();
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
    const creature = this.pointedCreature(this.s.pointerX, this.s.pointerY);
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
    this.focusShown = false;
  },

  dismissCreaturePanel() {
    const shown = Boolean(this.pinnedCreature) || this.focusShown;
    if (this.focusShown) this.mutedFocus = this.combatFocus;
    this.unpinCreature();
    return shown;
  },

  focusCreature(creature) {
    if (!creature) return;
    this.combatFocus = creature;
    this.focusSeenAt = performance.now() / 1000;
  },

  creatureAlive(creature) {
    return Boolean(creature) && !creature.dead && !creature.buried && this.creatureSystem.creatures.includes(creature);
  },

  nearestAttacker() {
    const root = this.playerSystem.root;
    if (!root) return null;
    const level = this.playerSystem.level || 0;
    let best = null;
    let bestDistance = Infinity;
    for (const creature of this.creatureSystem.creatures) {
      if (!this.creatureAlive(creature) || (creature.level || 0) !== level) continue;
      if (creature.mode === 'alert' || !(creature.engaged || this.creatureSystem.isHostile(creature))) continue;
      const distance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
      if (distance >= bestDistance) continue;
      best = creature;
      bestDistance = distance;
    }
    return best;
  },

  refreshPinnedCreature() {
    const creature = this.pinnedCreature;
    if (!creature) {
      this.refreshCombatFocus();
      return;
    }
    if (creature.dead || this.editor.active || !this.creatureSystem.creatures.includes(creature)) {
      this.unpinCreature();
      return;
    }
    this.showCreaturePanel(creature);
  },

  refreshCombatFocus() {
    const now = performance.now() / 1000;
    let focus = this.creatureAlive(this.combatFocus) ? this.combatFocus : null;
    const fighting = focus && (focus.engaged || this.creatureSystem.isHostile(focus)) && focus.mode !== 'alert';
    if (!fighting) {
      const attacker = this.nearestAttacker();
      if (attacker) {
        focus = attacker;
        this.combatFocus = attacker;
      }
    }
    if (focus && (focus.engaged || this.creatureSystem.isHostile(focus)) && focus.mode !== 'alert') this.focusSeenAt = now;
    if (this.mutedFocus && this.mutedFocus !== focus) this.mutedFocus = null;
    const show = Boolean(focus) && !this.editor.active && !this.dying && focus !== this.mutedFocus
      && now - (this.focusSeenAt || 0) < FOCUS_LINGER;
    if (!show) {
      if (this.focusShown) this.creaturePanel.hide();
      this.focusShown = false;
      if (!focus || now - (this.focusSeenAt || 0) >= FOCUS_LINGER) this.combatFocus = null;
      return;
    }
    this.focusShown = true;
    this.showCreaturePanel(focus);
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
    if (active) {
      this.updateDrawStrike(dt);
    }
    this.updateAttackArc(dt, active);
    this.updateBiteArcs(dt, active);
    if (!active || !this.inputSystem.leftDown) {
      this.attackHeld = false;
      return;
    }
    if (this.attackHeld) this.attackToward(null);
  },

  updateAttackArc(dt, active) {
    if (!this.attackArc) this.attackArc = new AttackArc(this.s);
    const root = this.playerSystem.root;
    if (!active || !root || !this.playerSystem.weaponDrawn) {
      this.attackArc.update(dt, null);
      return;
    }
    const attack = this.playerAttackSystem;
    let facing = this.playerSystem.facing;
    const blow = attack.pending ? attack.pending.blow : attack.blow('primary');
    if (!attack.pending && this.playerSystem.strikeTimer <= 0) {
      const aim = this.aimPoint(null);
      if (aim) facing = Math.atan2(aim.x - root.position.x, aim.z - root.position.z);
    }
    const { x, y, z } = root.position;
    this.attackArc.update(dt, { x, y, z, facing, reach: blow.reach, arc: blow.arc });
  },

  attackArcMeshes() {
    const arcs = [this.attackArc, ...(this.biteArcs ? this.biteArcs.values() : [])].filter(Boolean);
    return arcs.flatMap((arc) => arc.meshes());
  },

  updateBiteArcs(dt, active) {
    if (!this.biteArcs) this.biteArcs = new Map();
    const level = this.playerSystem.level || 0;
    const shown = new Set();
    for (const creature of active ? this.creatureSystem.creatures : []) {
      if (!creature || creature.unseen || (creature.level || 0) !== level) continue;
      const view = this.creatureSystem.biteView(creature);
      if (!view) continue;
      let arc = this.biteArcs.get(creature);
      if (!arc) {
        arc = new AttackArc(this.s, DANGER_COLOR);
        this.biteArcs.set(creature, arc);
      }
      shown.add(creature);
      const y = this.creatureGroundAt(creature.x, creature.z, creature.level || 0, creature.y);
      arc.update(dt, { x: creature.x, y, z: creature.z, facing: view.facing, reach: view.reach, arc: view.arc, alpha: BITE_ARC_ALPHA, progress: view.progress });
    }
    for (const [creature, arc] of this.biteArcs) {
      if (shown.has(creature)) continue;
      arc.dispose();
      this.biteArcs.delete(creature);
    }
  },

  updateDrawStrike(dt) {
    const queued = this.drawStrike;
    if (!queued) return;
    queued.left -= dt;
    if (queued.left > 0) return;
    this.drawStrike = null;
    const creature = queued.creature;
    const alive = creature && !creature.dead && this.creatureSystem.creatures.includes(creature);
    this.attackToward(alive ? creature : null, queued.kind);
  },

  damageCreature(creature, amount, crit, graze = false, absorbed = 0, detail = null) {
    if (!creature) return false;
    const killed = this.creatureSystem.damage(creature, amount, this.simSystem.time);
    this.audioSystem.play(this.playerAttackSystem.hitSound);
    const label = creature.type ? creature.type.label : 'Tvor';
    this.showFloatingDamage(creature, amount, crit, graze, absorbed);
    if (killed) {
      const xp = creatureStat(creature.type, creature.tier, 'xp');
      const xpText = xp > 0 ? `, +${xp} zkušeností` : '';
      this.log.combat(`Porazil jsi: ${label} (poslední rána ${Math.round(amount)}${xpText})`, 'warn', this.damageDetailText(detail));
      this.recordKill(creature);
      this.gainXp(xp);
      return true;
    }
    const left = Math.max(0, Math.round(creature.health));
    const total = creature.tier && Number.isFinite(creature.tier.health) ? Math.round(creature.tier.health) : null;
    const suffix = total === null ? '' : ` (${left} / ${total})`;
    const critText = crit ? ' kriticky' : graze ? ' (škrábnutí)' : '';
    this.log.combat(`${label} — ${Math.round(amount)} poškození${critText}${this.absorbedText(absorbed)}${suffix}`, 'action', this.damageDetailText(detail));
    return false;
  },

  absorbedText(absorbed) {
    if (absorbed >= 1) return ` (odoláno ${Math.round(absorbed)})`;
    if (absorbed <= -1) return ` (slabina +${Math.round(-absorbed)})`;
    return '';
  },

  damageDetailText(detail) {
    if (!this.options.combatDetails || !detail) return null;
    const number = (value) => String(Math.round(value * 10) / 10).replace('.', ',');
    const steps = [];
    if (Number.isFinite(detail.roll)) {
      steps.push(`rána ${number(detail.roll)}`);
      if (detail.scale > 1) steps.push(`kritický ×${number(detail.scale)} = ${number(detail.roll * detail.scale)}`);
      if (detail.scale < 1) steps.push(`škrábnutí ×${number(detail.scale)} = ${number(detail.roll * detail.scale)}`);
      if (detail.share < 1) steps.push(`rozděleno mezi ${Math.round(1 / detail.share)} = ${number(detail.damage)}`);
    } else {
      steps.push(`rána tvora ${number(detail.damage)}`);
    }
    const type = DAMAGE_TYPES[detail.damageType];
    const typeName = type ? type.short.toLocaleLowerCase('cs') : 'bez typu';
    if (detail.resistance > 0) steps.push(`odolnost na ${typeName} −${detail.resistance} % = ${number(detail.afterResist)}`);
    else if (detail.resistance < 0) steps.push(`slabina na ${typeName} +${-detail.resistance} % = ${number(detail.afterResist)}`);
    else steps.push(`${typeName}, bez odolnosti`);
    if (detail.armor > 0) steps.push(`zbroj −${number(detail.armor)} = ${number(detail.afterResist - detail.armor)}`);
    steps.push(`zaokrouhleno ${detail.dealt}`);
    return steps.join(' · ');
  },

  missCreature(creature) {
    if (!creature) return;
    this.audioSystem.play('miss');
    const label = creature.type ? creature.type.label : 'Tvor';
    this.log.combat(`Minul jsi: ${label}`, 'action');
    const ground = this.creatureGroundAt(creature.renderX, creature.renderZ, creature.level || 0, creature.y);
    this.spawnFloatingText('Minul', creature.renderX, ground + creature.markHeight, creature.renderZ, 'miss');
  },

  showFloatingDamage(creature, amount, crit, graze = false, absorbed = 0) {
    if (!creature) return;
    const ground = this.creatureGroundAt(creature.renderX, creature.renderZ, creature.level || 0, creature.y);
    const kind = crit ? 'crit' : graze ? 'graze' : null;
    this.spawnFloatingNumber(amount, creature.renderX, ground + creature.markHeight, creature.renderZ, kind, absorbed);
  },

  showFloatingOverPlayer(amount, crit, absorbed = 0, graze = false) {
    const root = this.playerSystem.root;
    if (!root) return;
    const y = root.position.y + PLAYER_FLOAT_HEIGHT;
    const kind = crit ? 'crit' : graze ? 'graze' : 'hurt';
    this.spawnFloatingNumber(amount, root.position.x, y, root.position.z, kind, absorbed);
  },

  spawnFloatingNumber(amount, x, y, z, kind, absorbed = 0) {
    if (!Number.isFinite(amount)) return;
    const note = !Number.isFinite(absorbed) ? null
      : absorbed >= 1 ? `(−${Math.round(absorbed)})`
        : absorbed <= -1 ? `(+${Math.round(-absorbed)})` : null;
    this.spawnFloatingText(Math.round(amount), x, y, z, kind, note);
  },

  spawnFloatingText(text, x, y, z, kind, note = null) {
    if (!this.options.floatingNumbers) return;
    const point = this.screenPointOf(x, y, z);
    if (!point) return;
    this.floatingNumbers.spawn(point, text, kind, note);
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
    const meshes = new Set(system.bodies().flatMap((body) => body.meshes || []));
    for (const creature of system.creatures) {
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
    const ground = this.creatureGroundAt(creature.renderX, creature.renderZ, creature.level || 0, creature.y);
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
    const ground = this.creatureGroundAt(creature.x, creature.z, creature.level || 0, creature.y);
    const eye = new Vector3(creature.x, ground + (creature.markHeight || 0) * CREATURE_EYE_SHARE, creature.z);
    const target = root.position.y + PLAYER_EYE_HEIGHT - SIGHT_GROUND_LIFT;
    return this.seesSpot(eye, root.position.x, target, root.position.z, Infinity);
  },

  seesCreature(eye, creature, range) {
    const ground = this.creatureGroundAt(creature.renderX, creature.renderZ, creature.level || 0, creature.y);
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

  refreshPlayerOverheadBars() {
    const root = this.playerSystem.root;
    const wanted = this.options.playerBars === 'head' || this.options.playerBars === 'both';
    if (!wanted || !root || !this.loaded || this.paused || this.editor.active || this.dying) {
      this.playerOverheadBars.update(null);
      return;
    }
    const point = this.screenPointOf(root.position.x, root.position.y + PLAYER_BAR_HEIGHT, root.position.z);
    const stats = this.playerStats;
    this.playerOverheadBars.update(point ? {
      x: point.x,
      y: point.y,
      health: stats.maxHealth > 0 ? stats.health / stats.maxHealth : 0,
      stamina: stats.maxStamina > 0 ? stats.stamina / stats.maxStamina : 0,
    } : null);
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
      const ground = this.creatureGroundAt(creature.renderX, creature.renderZ, creature.level || 0, creature.y);
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
    if (this.options.cameraShake && crit) this.cameraSystem.shake(0.28, 0.32);
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

  onCreatureBite(creature, damage, crit, damageType, graze = false) {
    if (!this.creatureAlive(this.combatFocus)) this.focusCreature(creature);
    if (this.playerStats.immunity > 0) {
      this.onCreatureBiteMiss(creature, true);
      return;
    }
    const who = creature && creature.type ? creature.type.label : 'Útok';
    const critText = crit ? ' kriticky' : graze ? ' (škrábnutí)' : '';
    const behind = this.isBehindPlayer(creature);
    const dealt = this.hurtPlayer(damage, crit, behind, damageType);
    if (!dealt) return;
    const blocked = Math.round(damage) - dealt;
    this.log.combat(`${who} — ${Math.round(dealt)} poškození${critText}${this.absorbedText(blocked)}`, 'hurt',this.damageDetailText(this.playerStats.lastHit));
    this.showFloatingOverPlayer(dealt, crit, blocked, graze);
  },

  onCreatureBiteMiss(creature, dodged = false) {
    if (!this.creatureAlive(this.combatFocus)) this.focusCreature(creature);
    const who = creature && creature.type ? creature.type.label : 'Útok';
    this.audioSystem.play('miss');
    this.log.combat(dodged ? `${who} — uhnul jsi` : `${who} — útok minul`, 'info');
    this.showFloatingTextOverPlayer(dodged ? 'Uhnul' : 'Minul', 'miss');
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
    this.stopCrafting();
    this.closeOpenWindows();
    this.hoverHint.hide();
    this.simSystem.setHalted(true);
  },

  updateDeath(dt) {
    if (!this.dying || this.deathShown) return;
    this.deathTimer -= dt;
    if (this.deathTimer > 0) return;
    this.deathShown = true;
    this.log.combat('Zemřel jsi', 'warn');
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
    this.sheathWeapon('instant');
    this.playerSystem.revive(spot ? spot.x : null, spot ? spot.z : null);
    this.audioSystem.play('wakeUp');
    this.simSystem.setHalted(false);
    this.simSystem.resetAccumulator();
    this.log.combat('Probral ses na pláži', 'warn');
  },
};
