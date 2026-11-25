// Část herní scény: načtení uložené hry bez přestavby světa — vrátí svět do stavu z mapy a nanese na něj uložení.
// Když to nejde (editor, neuložená mapa, hra se ještě staví) nebo se něco pokazí, načte se jako dřív obnovením stránky.
export default {
  canLoadInPlace() {
    return this.loaded && !this.isLoading && !this.editor.active && !this.editor.mapDirty
      && Boolean(this.playerSystem.root) && this.playerSystem.ready;
  },

  async loadInPlace(slot) {
    if (this.reloadingSave) return;
    const info = this.saveSystem.summary(slot);
    if (!info) {
      this.dialog.tell({ title: 'Uložení chybí', text: 'Tahle pozice je prázdná.' });
      return;
    }
    if (!this.canLoadInPlace()) {
      this.reloadFromSave(slot);
      return;
    }
    this.reloadingSave = true;
    const started = performance.now();
    try {
      await this.withBusy('Načítám uloženou hru…', () => this.applySaveInPlace(slot));
    } catch (err) {
      console.error('[save] Načtení bez přestavby selhalo, hra se načte znovu celá.', err);
      this.reloadingSave = false;
      this.reloadFromSave(slot);
      return;
    }
    this.reloadingSave = false;
    this.autosaveTimer = 0;
    this.log.add(`Hra načtena: ${this.saveTitle(info)}`, 'info');
    console.info(`[save] Načteno bez přestavby světa za ${((performance.now() - started) / 1000).toFixed(2)} s`);
  },

  async applySaveInPlace(slot) {
    if (this.paused) this.setPaused(false);
    this.closeOpenWindows();
    this.saveSlots.close();
    this.simSystem.setHalted(true);
    this.resetSceneState();
    this.resetWorldState();
    if (!this.saveSystem.load(slot)) throw new Error(`Uložení „${slot}“ nejde přečíst.`);
    this.syncFelling();
    this.syncHarvest();
    this.syncLootHighlights();
    await this.creatureSystem.create(this.mapLayout);
    this.refreshReflectionExclusions();
    this.refreshShadowCasters();
    this.refreshHands('instant');
    this.playerSystem.play(this.playerSystem.idleAnim(), true);
    this.rescuePlayerFromWater();
    this.refreshGatherTargets();
    this.refreshClock();
    this.simSystem.setHalted(false);
    this.simSystem.resetAccumulator();
  },

  resetSceneState() {
    this.dying = false;
    this.deathShown = false;
    this.deathTimer = 0;
    this.deathScreen.hide();
    this.playerSystem.resetActions();
    this.playerSystem.reachTarget = null;
    this.playerAttackSystem.reset();
    this.attackHeld = false;
    this.lootPickup = null;
    this.unpinCreature();
    this.combatFocus = null;
    this.mutedFocus = null;
    this.impactTimer = 0;
    this.floatingNumbers.clear();
    this.toasts.clear();
    this.footprintSystem.clear();
    this.hoverHint.hide();
  },

  resetWorldState() {
    this.campfireSystem.extinguishAll();
    for (const item of this.gatherSystem.entries) this.restoreGatherItem(item);
    this.gatherSystem.restoreAll();
    this.decoSystem.refreshBlocked(this.decoSystem.layout || this.mapFile || {});
    this.creatureSystem.clearPathCache();
    for (const anchor of this.decoSystem.readyEntries()) {
      const meta = anchor.metadata;
      if (meta.def && meta.def.loot) this.decoHighlight.add(meta.entry, meta.model, meta.def);
    }
    this.creatureSystem.clearAll();
  },

  restoreGatherItem(item) {
    const anchor = item.anchor;
    if (!anchor || anchor.isDisposed()) return;
    const parts = this.decoSystem.felledParts(anchor);
    const taken = item.left <= 0 || parts.length > 0 || !anchor.isEnabled(false);
    if (!taken) return;
    for (const node of parts) {
      for (const child of node.getChildMeshes()) this.removeShadowCaster(child);
    }
    this.decoSystem.restoreFelled(anchor);
    anchor.setEnabled(true);
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (!model || model.isDisposed()) return;
    model.setEnabled(true);
    if (item.def.castsShadow && !this.underWaterLevel(anchor.position)) {
      for (const child of model.getChildMeshes()) this.addShadowCaster(child);
    }
    this.decoSystem.applyEntry(item.entry);
    this.decoHighlight.add(item.entry, model, item.def);
  },
};
