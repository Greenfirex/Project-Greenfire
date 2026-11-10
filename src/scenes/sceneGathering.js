// Část herní scény: sběr, kácení a těžba — načasování úderu, výnos a obnova sebraných věcí.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { PICKUP_SOUND } from '../systems/gathering/gatherSystem.js';

const IMPACT_DELAY = 0.28;

export default {
  updateGathering(dt) {
    const active = this.loaded && !this.editor.active && !this.dying;
    this.gatherSystem.setPlayer(active ? this.playerSystem : null);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(dt, this.playerSystem, active ? this.inputSystem.lastCell : null);
    if (active) this.holdStrikeReady();
    this.updateGatherImpact(dt);
    this.updateLootPickup(dt);
    this.hotbar.setPrompt(this.gatherPrompt());
  },

  gatherPrompt() {
    if (this.editor.active) return '';
    if (this.campfireSystem.pending) return 'Zapaluji táborák…';
    if (this.campfireSystem.nearest) return 'E — zapálit Táborák';
    if (this.lootSystem.nearest) {
      const def = this.lootSystem.nearest.def;
      return `E — ${def.lootVerb} ${def.displayName}`;
    }
    return '';
  },

  openLoot(box) {
    const yields = this.lootSystem.open(box);
    if (!yields) return false;
    this.syncLootHighlights();
    this.beginLootPickup(box.x, box.z, () => this.receiveLoot(yields, `Vybráno: ${box.def.displayName}`));
    return true;
  },

  beginLootPickup(x, z, onImpact) {
    if (this.lootPickup) this.finishLootPickup();
    this.playerSystem.faceTo(x, z);
    this.playerSystem.pickUp();
    this.lootPickup = { left: this.playerSystem.pickupImpactTime(), onImpact };
  },

  updateLootPickup(dt) {
    if (!this.lootPickup) return;
    this.lootPickup.left -= dt;
    if (this.lootPickup.left <= 0) this.finishLootPickup();
  },

  finishLootPickup() {
    const pickup = this.lootPickup;
    this.lootPickup = null;
    this.audioSystem.play(PICKUP_SOUND);
    pickup.onImpact();
  },

  receiveLoot(yields, note = null) {
    for (const { itemKey, amount } of yields) this.inventorySystem.add(itemKey, amount);
    this.inventoryWindow.update(this.inventorySystem);
    if (note) this.log.add(note, 'action');
    this.logGain(yields);
  },

  syncLootHighlights() {
    for (const box of this.lootSystem.boxes) {
      if (!this.lootSystem.opened.has(box.key)) continue;
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
    const swung = item ? this.gatherSystem.hitItem(item) : this.gatherSystem.beginHit();
    if (swung) this.playerStats.spendGather();
    return swung;
  },

  takenAnchor(cell) {
    for (const item of this.gatherSystem.entries) {
      if (item.left > 0) continue;
      if (item.entry.cx === cell.cx && item.entry.cz === cell.cz) return item.anchor;
    }
    return null;
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
      this.releaseGatherCell(this.takenAnchor(cell) || result.item.anchor, cell);
      if (result.item.def.byHand) this.harvestSystem.record(cell.cx, cell.cz, this.simSystem.time);
    }
    this.refreshGatherTargets();
    for (const { itemKey, amount } of yields) this.inventorySystem.add(itemKey, amount);
    this.inventoryWindow.update(this.inventorySystem);
    this.logGain(yields);
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
    this.gatherSystem.markTaken(cx, cz);
    if (record) this.fellingSystem.record(cx, cz, def, dir);
  },

  syncFelling() {
    for (const cell of this.fellingSystem.list()) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || found.def.tree !== cell.tree) {
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

  syncHarvest() {
    for (const cell of this.harvestSystem.list()) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || !found.def.byHand) {
        this.harvestSystem.drop(cell.cx, cell.cz);
        continue;
      }
      const anchor = found.anchor;
      if (anchor && !anchor.isDisposed()) anchor.setEnabled(false);
      this.decoHighlight.remove(cell.cx, cell.cz, anchor);
      this.decoSystem.releaseCell(cell.cx, cell.cz, anchor);
      this.gatherSystem.markTaken(cell.cx, cell.cz);
    }
  },

  updateHarvestRespawns() {
    const ripe = this.harvestSystem.ripe(this.simSystem.time);
    if (!ripe.length) return;
    let restored = 0;
    for (const cell of ripe) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || !found.def.byHand) {
        this.harvestSystem.drop(cell.cx, cell.cz);
        continue;
      }
      this.restoreHarvested(found, cell);
      this.harvestSystem.drop(cell.cx, cell.cz);
      restored += 1;
    }
    if (restored) this.refreshGatherTargets();
    if (restored === 1) this.log.add('Na místě vyrostla houba nebo mušle', 'info');
    else if (restored > 1) this.log.add(`Na místě vyrostlo ${restored} hub a mušlí`, 'info');
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
