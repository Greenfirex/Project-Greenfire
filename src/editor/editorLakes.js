// Část editoru: jezera — klik do prohlubně ji naplní po okraj, další kliky hladinu zvedají nebo snižují.
// Patří k MapEditor (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { HEIGHT_STEP, formatMeters } from '../data/maps/layoutStore.js';
import { fillLake, brimLevel } from '../utils/lakeFill.js';
import { cellKey } from '../utils/gridMath.js';

function cellWord(count) {
  if (count === 1) return 'buňka';
  return count < 5 ? 'buňky' : 'buněk';
}

export default {
  lakeGround() {
    const terrain = this.s.terrainSystem;
    const cells = new Set(terrain.groundCells.map(([cx, cz]) => cellKey(cx, cz)));
    return { cells, heightAtCell: (cx, cz) => terrain.heightAtCell(cx, cz), blocked: this.s.riverCellKeys(cells) };
  },

  waterBodyHitAt(cell, kind) {
    return this.s.waterBodies().list.find((body) => (
      body.kind === kind && body.cells.some(({ cx, cz }) => cx === cell.cx && cz === cell.cz)
    )) || null;
  },

  lakeHitAt(cell) {
    return this.waterBodyHitAt(cell, 'lake');
  },

  pickLake(cell, action) {
    const hit = this.lakeHitAt(cell);
    if (action === 'add' && !hit) {
      this.addLake(cell);
      return;
    }
    if (!hit) {
      this.hud.setReadout('Tady žádné jezero není — klikni do prohlubně bez Mazat');
      return;
    }
    if (action === 'remove') {
      this.storeLakes(this.mode.lakeList().filter((_, index) => index !== hit.index));
      this.hud.setReadout('Jezero smazáno');
      return;
    }
    this.moveLakeLevel(hit, action === 'lower' ? -HEIGHT_STEP : HEIGHT_STEP);
  },

  addLake(cell) {
    const { cells, heightAtCell, blocked } = this.lakeGround();
    const level = brimLevel(cell.cx, cell.cz, cells, heightAtCell, blocked);
    if (level === null) {
      this.hud.setReadout('Tady voda nezůstane — prohlubeň nemá okraj a voda by vytekla z mapy');
      return;
    }
    const fill = fillLake(cell.cx, cell.cz, level, cells, heightAtCell, blocked);
    if (!fill.lowest) {
      this.hud.setReadout('Tady teče řeka — jezero udělej do prohlubně vedle ní');
      return;
    }
    const lake = { cx: fill.lowest.cx, cz: fill.lowest.cz, level };
    this.storeLakes([...this.lakesOutside(fill.cells), lake]);
    this.hud.setReadout(`Jezero: hladina ${formatMeters(level)} · ${fill.cells.length} ${cellWord(fill.cells.length)}`);
  },

  moveLakeLevel(hit, delta) {
    const { cells, heightAtCell, blocked } = this.lakeGround();
    const stored = this.mode.lakeList()[hit.index];
    const level = Math.round((stored.level + delta) / HEIGHT_STEP) * HEIGHT_STEP;
    const lowest = hit.cells.reduce((best, { cx, cz }) => {
      const height = heightAtCell(cx, cz);
      return !best || height < best.height ? { cx, cz, height } : best;
    }, null);
    const fill = fillLake(lowest.cx, lowest.cz, level, cells, heightAtCell, blocked);
    if (fill.overflow) {
      this.hud.setReadout(`Výš to nejde — voda by přetekla přes okraj (hladina zůstává ${formatMeters(stored.level)})`);
      return;
    }
    const others = this.mode.lakeList().filter((_, index) => index !== hit.index);
    if (!fill.cells.length) {
      this.storeLakes(others);
      this.hud.setReadout('Jezero vyschlo a zmizelo');
      return;
    }
    const lake = { cx: fill.lowest.cx, cz: fill.lowest.cz, level };
    this.storeLakes([...this.lakesOutside(fill.cells, others), lake]);
    this.hud.setReadout(`Jezero: hladina ${formatMeters(level)} · ${fill.cells.length} ${cellWord(fill.cells.length)}`);
  },

  lakesOutside(cells, list = this.mode.lakeList()) {
    const taken = new Set(cells.map(([cx, cz]) => cellKey(cx, cz)));
    return list.filter((lake) => !taken.has(cellKey(lake.cx, lake.cz)));
  },

  storeLakes(lakes) {
    this.mode.setLakes(lakes);
    this.mode.setWaterShown(true);
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.s.adoptEditorMap();
    this.s.refreshWaterBodies();
    this.s.handleHover(this.s.hoverCell);
    this.refreshUndoButton();
    this.markDirty();
  },
};
