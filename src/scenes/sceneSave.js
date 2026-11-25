// Část herní scény: ukládání a načítání — hlavní menu, okno s pozicemi, rychlé (F5/F9) a automatické uložení.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { AUTOSAVE_INTERVAL_S, SAVE_MANUAL_SLOTS, SAVE_SLOT_LABELS, SAVE_NAME_MAX } from '../data/catalogs/saveSchema.js';

const LOAD_SLOTS = ['quick', 'auto', ...SAVE_MANUAL_SLOTS];

function cleanName(value) {
  return String(value || '').trim().slice(0, SAVE_NAME_MAX);
}

export default {
  showMainMenu() {
    this.mainMenu.onContinue = () => {
      const newest = this.saveSystem.newest();
      if (newest) this.beginGame(newest.slot);
    };
    this.mainMenu.onNewGame = () => this.askNewGame();
    this.mainMenu.onLoad = () => this.openSaveSlots('load');
    this.mainMenu.onOptions = () => this.openMenuOptions();
    this.applyUiOptions();
    this.mainMenu.show(this.menuBackdrop);
    this.menuKeyHandler = (evt) => this.handleMenuKey(evt);
    window.addEventListener('keydown', this.menuKeyHandler);
    this.refreshMainMenu();
  },

  closeMainMenu() {
    if (this.menuKeyHandler) window.removeEventListener('keydown', this.menuKeyHandler);
    this.menuKeyHandler = null;
    this.saveSlots.close();
    this.optionsPanel.hide();
    this.mainMenu.dispose();
  },

  openMenuOptions() {
    this.optionsPanel.values = { ...this.options };
    this.optionsPanel.onChange = (values) => {
      this.storeOptions(values);
      this.applyUiOptions();
    };
    this.optionsPanel.onToggle = null;
    this.optionsPanel.onVolumeSet = null;
    this.optionsPanel.mount();
    this.optionsPanel.render();
    this.optionsPanel.show();
  },

  inMainMenu() {
    return Boolean(this.mainMenu.root);
  },

  refreshMainMenu() {
    if (!this.inMainMenu()) return;
    const newest = this.saveSystem.newest();
    this.mainMenu.setContinue(newest ? `${this.saveTitle(newest)} · ${this.formatSaveTime(newest.savedAt)}` : '');
  },

  handleMenuKey(evt) {
    if (!this.inMainMenu()) return;
    if (this.dialog.handleKey(evt)) {
      evt.preventDefault();
      return;
    }
    if (evt.key !== 'Escape') return;
    if (this.optionsPanel.isOpen) {
      evt.preventDefault();
      this.optionsPanel.hide();
      return;
    }
    if (this.saveSlots.open) {
      evt.preventDefault();
      this.saveSlots.close();
    }
  },

  askNewGame() {
    if (!this.saveSystem.newest()) {
      this.beginGame(null);
      return;
    }
    this.dialog.ask({
      title: 'Začít novou hru?',
      text: 'Uložené hry zůstanou. Jen automatické uložení se po pěti minutách nové hry přepíše.',
      confirmLabel: 'Nová hra',
      cancelLabel: 'Zpět',
      onConfirm: () => this.beginGame(null),
    });
  },

  askReturnToMenu() {
    this.dialog.ask({
      title: 'Odejít do hlavního menu?',
      text: 'Co jsi neuložil, se ztratí.',
      confirmLabel: 'Do menu',
      cancelLabel: 'Zůstat',
      onConfirm: () => window.location.reload(),
    });
  },

  wireSaveSlots() {
    this.saveSlots.onPick = (mode, slot) => (mode === 'save' ? this.askSaveToSlot(slot) : this.askLoadSlot(slot));
    this.saveSlots.onRename = (slot) => this.askRenameSlot(slot);
    this.saveSlots.onDelete = (slot) => this.askDeleteSlot(slot);
  },

  saveTitle(info) {
    return info.name || SAVE_SLOT_LABELS[info.slot] || info.slot;
  },

  formatSaveTime(at) {
    if (!at) return '';
    return new Date(at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  suggestedSaveName() {
    const date = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
    return cleanName(`Úroveň ${this.playerStats.level} · ${this.clockText} · ${date}`);
  },

  saveMeta(name = '') {
    return { name, level: this.playerStats.level, clock: this.clockText };
  },

  saveRows(mode) {
    const slots = mode === 'save' ? SAVE_MANUAL_SLOTS : LOAD_SLOTS;
    return slots.map((slot) => {
      const manual = SAVE_MANUAL_SLOTS.includes(slot);
      const label = manual ? SAVE_SLOT_LABELS[slot] : '';
      const info = this.saveSystem.summary(slot);
      if (!info) return { slot, label: label || SAVE_SLOT_LABELS[slot], empty: true, renamable: manual };
      const parts = [this.formatSaveTime(info.savedAt)];
      if (!info.name && info.level !== null) parts.push(`úroveň ${info.level}`);
      if (!info.name && info.clock) parts.push(`ve hře ${info.clock}`);
      return { slot, label, name: this.saveTitle(info), detail: parts.join(' · '), empty: false, renamable: manual };
    });
  },

  openSaveSlots(mode) {
    if (mode === 'save' && !this.canSaveNow()) return;
    if (this.loaded) this.playerSystem.releaseKeys();
    this.saveSlots.show(mode, this.saveRows(mode));
  },

  refreshSaveSlots() {
    if (this.saveSlots.open) this.saveSlots.render(this.saveRows(this.saveSlots.mode));
    this.refreshMainMenu();
  },

  canSaveNow() {
    if (!this.loaded) return false;
    if (this.dying) {
      this.dialog.tell({ title: 'Teď uložit nejde', text: 'Během umírání se hra uložit nedá.' });
      return false;
    }
    if (this.editor.active) {
      this.dialog.tell({ title: 'Teď uložit nejde', text: 'V editoru mapy se hra neukládá. Nejdřív editor zavři (F2).' });
      return false;
    }
    return true;
  },

  tellSaveFailed() {
    this.dialog.tell({
      title: 'Uložení selhalo',
      text: 'Prohlížeč nepovolil zápis do úložiště. Možná je plné — zkus smazat některou starou pozici.',
    });
  },

  askSaveToSlot(slot) {
    if (!this.canSaveNow()) return;
    const info = this.saveSystem.summary(slot);
    this.dialog.ask({
      title: info ? `Přepsat: ${SAVE_SLOT_LABELS[slot]}?` : `Uložit do: ${SAVE_SLOT_LABELS[slot]}`,
      text: info ? `Uložení „${this.saveTitle(info)}“ se nahradí současnou hrou.\nNázev:` : 'Název uložení:',
      input: { value: this.suggestedSaveName(), maxLength: SAVE_NAME_MAX, placeholder: 'Název uložení' },
      confirmLabel: info ? 'Přepsat' : 'Uložit',
      onConfirm: (value) => this.saveToSlot(slot, value),
    });
  },

  saveToSlot(slot, value) {
    const name = cleanName(value) || this.suggestedSaveName();
    const ok = this.saveSystem.save(slot, this.saveMeta(name));
    if (ok) this.autosaveTimer = 0;
    this.log.add(ok ? `Hra uložena: ${name}` : 'Uložení selhalo', ok ? 'info' : 'warn');
    if (!ok) this.tellSaveFailed();
    this.refreshSaveSlots();
  },

  askLoadSlot(slot) {
    const info = this.saveSystem.summary(slot);
    if (!info) return;
    if (this.inMainMenu()) {
      this.beginGame(slot);
      return;
    }
    if (this.loaded) this.playerSystem.releaseKeys();
    this.dialog.ask({
      title: 'Načíst uloženou hru?',
      text: `„${this.saveTitle(info)}“ (${this.formatSaveTime(info.savedAt)})\nCo jsi od posledního uložení udělal, se ztratí.`,
      confirmLabel: 'Načíst',
      cancelLabel: 'Zrušit',
      onConfirm: () => this.reloadFromSave(slot),
    });
  },

  askRenameSlot(slot) {
    const info = this.saveSystem.summary(slot);
    if (!info) return;
    this.dialog.ask({
      title: `Přejmenovat: ${SAVE_SLOT_LABELS[slot]}`,
      text: 'Nový název:',
      input: { value: this.saveTitle(info), maxLength: SAVE_NAME_MAX, placeholder: 'Název uložení' },
      confirmLabel: 'Přejmenovat',
      onConfirm: (value) => {
        const name = cleanName(value);
        if (!name) return;
        this.saveSystem.rename(slot, name);
        this.refreshSaveSlots();
      },
    });
  },

  askDeleteSlot(slot) {
    const info = this.saveSystem.summary(slot);
    if (!info) return;
    this.dialog.ask({
      title: 'Smazat uložení?',
      text: `„${this.saveTitle(info)}“ (${this.formatSaveTime(info.savedAt)}) zmizí natrvalo.`,
      confirmLabel: 'Smazat',
      cancelLabel: 'Nechat',
      onConfirm: () => {
        this.saveSystem.clear(slot);
        this.refreshSaveSlots();
      },
    });
  },

  doSave() {
    if (!this.canSaveNow()) return;
    const ok = this.saveSystem.save('quick', this.saveMeta());
    if (ok) this.autosaveTimer = 0;
    this.log.add(ok ? 'Rychle uloženo (načíst: F9)' : 'Uložení selhalo', ok ? 'info' : 'warn');
    if (!ok) this.tellSaveFailed();
    this.refreshSaveSlots();
  },

  requestLoad() {
    if (this.dialog.open) return;
    this.playerSystem.releaseKeys();
    if (!this.saveSystem.hasSave('quick')) {
      this.dialog.tell({
        title: 'Rychlé uložení chybí',
        text: 'Rychle uložíš klávesou F5. Ostatní uložení najdeš pod tlačítkem 📂 Načíst.',
      });
      return;
    }
    this.askLoadSlot('quick');
  },

  canAutosave() {
    if (!this.loaded || this.editor.active || this.dying || this.paused || this.dialog.open) return false;
    if (!this.playerSystem.root || this.playerSystem.lying) return false;
    return !this.playerSystem.inCombat();
  },

  updateAutosave(dt) {
    this.autosaveTimer += dt;
    if (this.autosaveTimer < AUTOSAVE_INTERVAL_S || !this.canAutosave()) return;
    this.autosaveTimer = 0;
    const ok = this.saveSystem.save('auto', this.saveMeta());
    this.log.add(ok ? 'Hra se sama uložila' : 'Automatické uložení selhalo', ok ? 'info' : 'warn');
    this.refreshSaveSlots();
  },

  loadSaveState(slot) {
    const info = this.saveSystem.summary(slot);
    const ok = Boolean(info) && this.saveSystem.load(slot);
    this.saveHintAfterLoad = ok
      ? { title: 'Načteno', text: `Hra je obnovená: „${this.saveTitle(info)}“.` }
      : { title: 'Načtení selhalo', text: 'Uloženou hru nešlo načíst — chybí, nebo je z jiné verze.' };
    this.log.add(ok ? 'Hra načtena' : 'Načtení selhalo', ok ? 'info' : 'warn');
    if (!ok) {
      console.warn('[save] Uloženou hru nešlo načíst — chybí, nebo má jinou verzi.');
      return;
    }
    console.info('[save] Obnoveno:', {
      pozice: slot,
      druhyPredmetu: Object.keys(this.inventorySystem.items || {}).length,
      sebrane: this.harvestSystem.list().length,
      cas: Math.round(this.simSystem.time),
    });
  },

  reloadFromSave(slot) {
    if (!this.saveSystem.hasSave(slot)) {
      this.dialog.tell({ title: 'Uložení chybí', text: 'Tahle pozice je prázdná.' });
      return;
    }
    if (!this.saveSystem.markLoadOnStart(slot)) {
      this.dialog.tell({ title: 'Načtení selhalo', text: 'Prohlížeč nepovolil připravit načtení uložené hry.' });
      return;
    }
    window.location.reload();
  },
};
