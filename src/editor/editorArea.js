// Část editoru: herní plocha — tažení obdélníku, výběr buněk a razítko podkladu a výšky.
// Patří k EditorMode (sdílí jeho this); jen ho dělí, aby hlavní soubor zůstal přehledný.
import { PAINT_ALL, PAINT_CREATURES, PAINT_FISH } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';
import { cellKey } from '../utils/gridMath.js';
import { dropLayerCell, dropDecorationCell, dropAreaCells } from '../data/maps/areaShape.js';
import { rectCells } from './editorSettings.js';

export default {
  beginAreaDrag(cx, cz) {
    if (!this.layout) return;
    this.areaBase = this.areaStroke ? new Map(this.areaStroke) : new Map();
    this.areaDrag = { mode: this.areaTool, fromX: cx, fromZ: cz, toX: cx, toZ: cz };
    this.refreshAreaDrag();
  },

  moveAreaDrag(cx, cz) {
    const drag = this.areaDrag;
    if (!drag) return;
    if (drag.toX === cx && drag.toZ === cz) return;
    drag.toX = cx;
    drag.toZ = cz;
    this.refreshAreaDrag();
  },

  refreshAreaDrag() {
    const drag = this.areaDrag;
    if (!drag) return;
    const stroke = this.areaBase ? new Map(this.areaBase) : new Map();
    for (const [x, z] of rectCells(drag.fromX, drag.fromZ, drag.toX, drag.toZ)) {
      stroke.set(cellKey(x, z), [x, z]);
    }
    this.areaStroke = stroke;
    this.setAreaSelection({ tool: drag.mode, cells: this.strokeCells() });
  },

  finishAreaDrag() {
    if (!this.areaDrag) return;
    this.areaDrag = null;
    this.areaBase = null;
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
  },

  strokeCells() {
    return [...(this.areaStroke || new Map()).values()];
  },

  addAreaCells(cells) {
    if (!this.areaStroke) this.areaStroke = new Map();
    for (const [cx, cz] of cells) this.areaStroke.set(cellKey(cx, cz), [cx, cz]);
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
  },

  removeAreaCells(cells) {
    if (!this.areaStroke || !cells || !cells.length) return false;
    let changed = false;
    for (const [cx, cz] of cells) {
      if (this.areaStroke.delete(cellKey(cx, cz))) changed = true;
    }
    if (!changed) return false;
    this.setAreaSelection({ tool: this.areaTool, cells: this.strokeCells() });
    return true;
  },

  setAreaTool(tool) {
    const next = tool === 'erase' ? 'erase' : 'paint';
    if (this.areaTool === next) return;
    this.areaTool = next;
    this.areaDrag = null;
    this.areaStroke = null;
    this.clearAreaSelection();
  },

  setAreaSurface(key) {
    const def = getDecoration(key);
    if (!def || !def.surface) return;
    this.areaSurface = key;
  },

  setAreaSelection(selection) {
    const cells = selection && selection.cells ? selection.cells : [];
    const drag = this.areaDrag;
    this.areaSelection = cells.length
      ? { tool: selection.tool, cells, drag: drag ? { fromX: drag.fromX, fromZ: drag.fromZ, toX: drag.toX, toZ: drag.toZ } : null }
      : null;
    if (this.onAreaSelectionChange) this.onAreaSelectionChange(this.getAreaSelection());
  },

  getAreaSelection() {
    return this.areaSelection;
  },

  clearAreaSelection() {
    this.areaStroke = null;
    this.areaBase = null;
    this.areaDrag = null;
    if (!this.areaSelection) return;
    this.areaSelection = null;
    if (this.onAreaSelectionChange) this.onAreaSelectionChange(null);
  },

  areaExists(cx, cz) {
    if (this.realCells && this.realCells.some(([ax, az]) => ax === cx && az === cz)) return true;
    return (this.layout.path || []).some((entry) => entry && entry.cx === cx && entry.cz === cz);
  },

  assignRealCells(cells) {
    this.realCells = cells && cells.length ? cells.map(([cx, cz]) => [cx, cz]) : null;
  },

  pendingAreaCells() {
    const selection = this.areaSelection;
    if (!selection || !selection.cells.length) return 0;
    if (selection.tool === 'erase') {
      return selection.cells.filter(([cx, cz]) => this.areaExists(cx, cz)).length;
    }
    return selection.cells.length;
  },

  pendingAreaExisting() {
    const selection = this.areaSelection;
    if (!selection || selection.tool === 'erase') return 0;
    return selection.cells.filter(([cx, cz]) => this.areaExists(cx, cz)).length;
  },

  applyAreaSelection() {
    const selection = this.areaSelection;
    if (!selection || !this.layout || !selection.cells.length) return 0;
    const erasing = selection.tool === 'erase';
    this.pushHistory();
    let count = 0;
    if (erasing) {
      count = dropAreaCells(this.layout, selection.cells);
      for (const [cx, cz] of selection.cells) {
        if (dropDecorationCell(this.layout, cx, cz)) count += 1;
        if (this.dropCreatureCell(cx, cz)) count += 1;
        if (this.dropFishCell(cx, cz)) count += 1;
      }
      this.dropOrphans();
    } else {
      const lift = this.heightLevel * HEIGHT_STEP;
      for (const [cx, cz] of selection.cells) {
        dropLayerCell(this.layout, cx, cz);
        dropDecorationCell(this.layout, cx, cz);
        const entry = { key: this.areaSurface, cx, cz, rotation: 0 };
        if (lift) entry.liftY = lift;
        this.layout.floor.push(entry);
        count += 1;
      }
    }
    if (!count) {
      this.history.pop();
      this.clearAreaSelection();
      return 0;
    }
    this.clearAreaSelection();
    this.scheduleRegenerate(erasing ? [...PAINT_ALL, PAINT_CREATURES, PAINT_FISH] : PAINT_ALL);
    return count;
  },
};
