// Část herní scény: sběr, kácení a těžba — načasování úderu, výnos a obnova sebraných věcí.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { PICKUP_SOUND } from '../systems/gathering/gatherSystem.js';
import { PLAYER_BASE } from '../data/catalogs/player.js';

const IMPACT_DELAY = 0.28;
const LOOT_LEAVE_MARGIN = 1.2;
const LOOT_LEAVE_DISTANCE = PLAYER_BASE.handReach.distance + LOOT_LEAVE_MARGIN;
const LOOT_STAND_GAP = 0.4;

export default {
  updateGathering(dt) {
    const active = this.loaded && !this.editor.active && !this.dying;
    this.gatherSystem.setPlayer(active ? this.playerSystem : null);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(dt, this.playerSystem, active ? this.inputSystem.lastCell : null);
    if (active) this.holdStrikeReady();
    this.updateGatherImpact(dt);
    this.updateLootPickup(dt);
    this.updateLootWindow();
    this.playerSystem.kneeling = Boolean(this.lootSource) && this.lootWindow.open;
    this.hotbar.setPrompt(this.gatherPrompt());
  },

  gatherPrompt() {
    if (this.editor.active) return '';
    if (this.campfireSystem.pending) return 'Zapaluji táborák…';
    return '';
  },

  openLoot(box) {
    if (this.lootSource && this.lootSource.ref === box) return true;
    if (this.lootSystem.isEmpty(box)) return false;
    const spot = this.lootSystem.standSpot(box, LOOT_STAND_GAP, this.playerSystem.root.position);
    if (!spot) return this.openBox(box);
    this.playerSystem.walkTo(spot.x, spot.z, () => this.openBox(box));
    return true;
  },

  approachLoot(x, z, distance, onArrive) {
    const from = this.playerSystem.root.position;
    const away = Math.hypot(from.x - x, from.z - z);
    if (away <= distance || away < 1e-3) {
      onArrive();
      return;
    }
    const share = distance / away;
    this.playerSystem.walkTo(x + (from.x - x) * share, z + (from.z - z) * share, onArrive);
  },

  openBox(box) {
    if (!this.lootSystem.open(box)) return false;
    const middle = box.center || box;
    this.beginLootPickup(middle.x, middle.z, () => {
      this.lootSystem.swing(box);
      this.showLoot({ kind: 'box', ref: box, x: box.x, z: box.z, title: box.def.displayName });
    }, this.lootSystem.reachPoint(box), 'chestOpen');
    return true;
  },

  lootContents(source) {
    if (source.kind === 'box') return this.lootSystem.contentsOf(source.ref);
    return this.creatureSystem.loot(source.ref) || [];
  },

  showLoot(source) {
    const root = this.playerSystem.root;
    const opensAt = root ? Math.hypot(root.position.x - source.x, root.position.z - source.z) : 0;
    this.lootSource = { ...source, leaveAt: Math.max(LOOT_LEAVE_DISTANCE, opensAt + LOOT_LEAVE_MARGIN) };
    this.lootWindow.show(source.title, this.lootContents(source));
  },

  takeLoot(itemKey) {
    const source = this.lootSource;
    if (!source) return;
    const taken = source.kind === 'box'
      ? this.lootSystem.take(source.ref, itemKey)
      : this.creatureSystem.takeLoot(source.ref, itemKey);
    if (taken) {
      this.audioSystem.play('rummage');
      this.receiveItems([taken]);
    }
    this.refreshLootWindow();
  },

  takeAllLoot() {
    const source = this.lootSource;
    if (!source) return;
    const taken = [];
    for (const { itemKey } of this.lootContents(source)) {
      const item = source.kind === 'box'
        ? this.lootSystem.take(source.ref, itemKey)
        : this.creatureSystem.takeLoot(source.ref, itemKey);
      if (item) taken.push(item);
    }
    if (taken.length) {
      this.audioSystem.play('rummage');
      this.receiveItems(taken);
    }
    this.refreshLootWindow();
  },

  refreshLootWindow() {
    const source = this.lootSource;
    if (!source) return;
    const items = this.lootContents(source);
    if (items.length) {
      this.lootWindow.update(items);
      return;
    }
    if (source.kind === 'box') this.syncLootHighlights();
    this.log.add(`Vybráno: ${source.title}`, 'action');
    this.closeLoot();
  },

  closeLoot() {
    const source = this.lootSource;
    this.lootSource = null;
    if (source && source.kind === 'box') {
      if (!this.lootSystem.isEmpty(source.ref)) this.audioSystem.play('chestClose');
      this.lootSystem.shut(source.ref);
    }
    if (this.lootWindow.open) this.lootWindow.close();
  },

  updateLootWindow() {
    const source = this.lootSource;
    if (!source) return;
    const root = this.playerSystem.root;
    const away = !root || Math.hypot(root.position.x - source.x, root.position.z - source.z) > source.leaveAt;
    if (away || this.dying || this.editor.active || !this.lootContents(source).length) this.closeLoot();
  },

  beginLootPickup(x, z, onImpact, reach = null, sound = PICKUP_SOUND) {
    if (this.lootPickup) this.finishLootPickup();
    this.sheathWeapon('instant');
    this.playerSystem.faceTo(x, z);
    this.playerSystem.pickUp();
    this.playerSystem.reachTarget = reach;
    this.lootPickup = { left: this.playerSystem.pickupImpactTime(), onImpact, sound };
  },

  updateLootPickup(dt) {
    if (!this.lootPickup) return;
    this.lootPickup.left -= dt;
    if (this.lootPickup.left <= 0) this.finishLootPickup();
  },

  finishLootPickup() {
    const pickup = this.lootPickup;
    this.lootPickup = null;
    this.audioSystem.play(pickup.sound);
    pickup.onImpact();
  },

  syncLootHighlights() {
    for (const box of this.lootSystem.boxes) {
      if (!this.lootSystem.isEmpty(box)) continue;
      this.decoHighlight.removeKey(this.decoHighlight.keyOf(box.cx, box.cz, box.level));
    }
  },

  updateGatherImpact(dt) {
    const pending = this.gatherSystem.pending;
    if (!pending) {
      this.impactTimer = 0;
      return;
    }
    this.impactTimer += dt;
    if (this.impactTimer < (pending.delay || IMPACT_DELAY)) return;
    this.impactTimer = 0;
    const impact = this.gatherSystem.resolvePending();
    if (impact) this.onGatherImpact(impact);
  },

  describeGatherTarget(target) {
    if (target.def.byHand) return `Levé tlačítko — sbírat ${target.def.displayName} (${target.left}/${target.total})`;
    const verb = target.def.kind === 'tree' ? 'kácet' : 'těžit';
    return `Levé tlačítko — ${verb} ${target.def.displayName} (${target.left}/${target.total})`;
  },

  strikeGather(item) {
    this.sheathWeapon('instant');
    const swung = item ? this.gatherSystem.hitItem(item) : this.gatherSystem.beginHit();
    if (swung) this.playerStats.spendGather();
    return swung;
  },

  holdStrikeReady() {
    if (!this.inputSystem.leftDown || this.editor.active) return false;
    if (this.campfireSystem.pending) return false;
    if (this.playerAttackSystem.target) return false;
    if (this.creatureSystem.hovered || this.creatureSystem.hoveredCorpse) return false;
    const gather = this.gatherSystem;
    if (!gather.target || gather.cooldown > 0 || gather.pending) return false;
    return this.strikeGather();
  },

  onGatherImpact(result) {
    this.audioSystem.play(result.sound);
    if (!result.exhausted) return;
    const isTree = result.item.def.kind === 'tree';
    const cell = { cx: result.item.entry.cx, cz: result.item.entry.cz };
    const yields = this.gatherSystem.takeYield(result.item, !isTree);
    if (!yields) return;
    if (isTree) {
      const root = this.playerSystem ? this.playerSystem.root : null;
      const fromX = root ? root.position.x : result.item.x + 1;
      const fromZ = root ? root.position.z : result.item.z;
      this.gatherSystem.beginFall(result.item, fromX, fromZ);
    } else {
      this.releaseGatherCell(result.item.anchor, cell);
      if (result.item.def.byHand) this.harvestSystem.record(cell.cx, cell.cz, result.item.entry.key, this.simSystem.time);
    }
    this.refreshGatherTargets();
    this.receiveItems(yields);
  },

  finishFelling(item) {
    const anchor = item ? item.anchor : null;
    if (!anchor || anchor.isDisposed()) return;
    const fall = item.fall || { dirX: 1, dirZ: 0 };
    this.applyFelling(item.entry.cx, item.entry.cz, anchor, item.def, fall, true);
    this.log.add(`Pokáceno: ${item.def.displayName}`, 'action');
    this.refreshGatherTargets();
  },

  applyFelling(cx, cz, anchor, def, dir, record) {
    if (!anchor || anchor.isDisposed() || !def) return;
    if (anchor.metadata && anchor.metadata.stump) return;
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (model && !model.isDisposed()) {
      for (const child of model.getChildMeshes()) this.removeShadowCaster(child);
      model.setEnabled(false);
    }
    const parts = [
      ...this.decoSystem.showStump(anchor, def),
      ...this.decoSystem.showLogs(anchor, def, dir.dirX, dir.dirZ),
    ];
    if (def.tree && def.tree.startsWith('palm')) {
      parts.push(...this.decoSystem.showFronds(anchor, def, dir.dirX, dir.dirZ));
    }
    for (const node of parts) {
      for (const child of node.getChildMeshes()) {
        child.isPickable = false;
        if (def.castsShadow) this.addShadowCaster(child);
      }
    }
    this.decoHighlight.remove(cx, cz, anchor);
    this.decoSystem.releaseCell(cx, cz, anchor);
    this.gatherSystem.markTaken(anchor);
    if (record) this.fellingSystem.record(cx, cz, def, dir);
  },

  syncFelling() {
    for (const cell of this.fellingSystem.list()) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz, (def) => def.tree === cell.tree);
      if (!found) {
        this.fellingSystem.drop(cell.cx, cell.cz);
        continue;
      }
      this.applyFelling(cell.cx, cell.cz, found.anchor, found.def, cell, false);
    }
  },

  releaseGatherCell(anchor, cell) {
    if (anchor && !anchor.isDisposed()) anchor.setEnabled(false);
    this.decoHighlight.remove(cell.cx, cell.cz, anchor);
    this.decoSystem.releaseCell(cell.cx, cell.cz, anchor);
    if (this.inputSystem.lastCell && this.inputSystem.lastCell.cx === cell.cx && this.inputSystem.lastCell.cz === cell.cz) {
      this.decoHighlight.setHover(null);
    }
  },

  refreshGatherTargets() {
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(0, this.playerSystem);
  },

  harvestedEntry(cell) {
    return this.decoSystem.entryAt(cell.cx, cell.cz, (def, entry) => def.byHand && entry && entry.key === cell.key);
  },

  syncHarvest() {
    for (const cell of this.harvestSystem.list()) {
      const found = this.harvestedEntry(cell);
      if (!found) {
        this.harvestSystem.drop(cell);
        continue;
      }
      const anchor = found.anchor;
      if (anchor && !anchor.isDisposed()) anchor.setEnabled(false);
      this.decoHighlight.remove(cell.cx, cell.cz, anchor);
      this.decoSystem.releaseCell(cell.cx, cell.cz, anchor);
      this.gatherSystem.markTaken(anchor);
    }
  },

  updateHarvestRespawns() {
    const ripe = this.harvestSystem.ripe(this.simSystem.time);
    if (!ripe.length) return;
    const names = [];
    for (const cell of ripe) {
      const found = this.harvestedEntry(cell);
      this.harvestSystem.drop(cell);
      if (!found) continue;
      this.restoreHarvested(found, cell);
      names.push(found.def.displayName);
    }
    if (!names.length) return;
    this.refreshGatherTargets();
    if (names.length === 1) this.log.add(`Znovu vyrostlo: ${names[0]}`, 'info');
    else this.log.add(`Znovu vyrostlo ${names.length} věcí na sběr`, 'info');
  },

  restoreHarvested(found, cell) {
    const anchor = found.anchor;
    if (!anchor || anchor.isDisposed()) return;
    anchor.setEnabled(true);
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (model && !model.isDisposed()) model.setEnabled(true);
    this.gatherSystem.ensureEntry(anchor);
    this.decoHighlight.add(found.entry, model, found.def);
  },
};
