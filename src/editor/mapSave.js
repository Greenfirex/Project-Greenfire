// Část řízení editoru: neuložené změny a uložení mapy do souboru projektu (nebo stažení, když to nejde).
// Patří k MapEditor (sdílí jeho this).
import { mapFileFromLayout } from '../data/catalogs/mapFile.js';
import { ENTRY_LAYERS } from '../data/maps/areaShape.js';
import { cellCount } from './editorSettings.js';

function brokenEntries(layout) {
  let count = 0;
  for (const name of ENTRY_LAYERS) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}

export default {
  markDirty() {
    const saved = this.savedFingerprint;
    if (saved !== null && this.mode.fingerprint() === saved) {
      if (!this.mapDirty) return;
      this.mapDirty = false;
      this.hud.setReadout('Mapa je zpátky v uloženém stavu');
      return;
    }
    if (this.mapDirty) return;
    this.mapDirty = true;
    this.hud.setReadout('● Neuložené změny');
  },

  clearDirty() {
    this.mapDirty = false;
    this.savedFingerprint = this.mode.fingerprint();
    this.hud.setReadout('Uloženo ✓');
  },

  saveMap() {
    const layout = this.mode.getMap();
    const key = typeof this.s.mapKey === 'string' ? this.s.mapKey.toLowerCase() : '';
    const file = mapFileFromLayout(key, layout);
    if (!file) {
      this.hud.setReadout('Mapu nejde složit');
      return Promise.resolve(false);
    }
    if (!Number.isInteger(layout.spawn.cx) || !Number.isInteger(layout.spawn.cz)) {
      this.markDirty();
      this.hud.setReadout(`Mapa se neuložila — start hráče nemá platné souřadnice (${layout.spawn.cx}, ${layout.spawn.cz})`);
      return Promise.resolve(false);
    }
    const broken = brokenEntries(layout);
    if (broken) {
      this.markDirty();
      this.hud.setReadout(`Mapa se neuložila — ${cellCount(broken)} nemá platné souřadnice, takže by se v souboru rozsypala`);
      return Promise.resolve(false);
    }
    this.hud.setReadout('Ukládám do souboru…');
    return this.writeMapFile(file).then((result) => this.finishSave(file, result));
  },

  finishSave(file, result) {
    this.s.mapFile = file;
    if (result.ok) {
      this.clearDirty();
      this.hud.setReadout('Mapa zapsaná do souboru projektu ✓');
      return true;
    }
    this.downloadMapFile(file);
    this.markDirty();
    this.hud.setReadout(`Mapu se nepodařilo zapsat do souboru (${result.reason}) — soubor je stažený, polož ho do projektu`);
    return false;
  },

  async writeMapFile(file) {
    const url = `/_map/${encodeURIComponent(file.mapKey)}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
    } catch {
      return { ok: false, reason: `server neodpověděl (${url})` };
    }
    if (response.ok) return { ok: true };
    let reason = `HTTP ${response.status}`;
    try {
      const answer = await response.json();
      if (answer && answer.error) reason = `${reason} — ${answer.error}`;
    } catch {
      reason = `${reason} z ${url}`;
    }
    return { ok: false, reason };
  },

  downloadMapFile(file) {
    const name = `${file.mapKey}-map.json`;
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
