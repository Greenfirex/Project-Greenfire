// Část řízení editoru: ovládání — klávesy a co udělá kliknutí, tažení a pravé tlačítko v kterém režimu.
// Patří k MapEditor (sdílí jeho this).
import { HEIGHT_PRESETS, formatMeters } from '../data/maps/layoutStore.js';
import { NO_BRUSH_HINT, cellCount } from './editorSettings.js';
import { BRUSHES, brushForDecoration } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { HUD_TABS, tabBrushes } from './hudTabs.js';
import { worldToCellCoords } from '../utils/gridMath.js';

export default {
  handleKey(evt, typing) {
    if (evt.key === 'F2') {
      evt.preventDefault();
      this.s.toggleEditorMode();
      return;
    }
    if ((evt.ctrlKey || evt.metaKey) && evt.code === 'KeyS') {
      evt.preventDefault();
      this.saveMap();
      return;
    }
    if (typing && evt.key !== 'Escape') return;
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (evt.key === 'p' || evt.key === 'P') {
      evt.preventDefault();
      this.s.togglePause();
      return;
    }
    if (evt.key === 'Escape') {
      if (this.mode.selectsArea && this.mode.hasAreaSelection) {
        this.clearAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.mode.mode === 'height' && this.mode.heightDraftCount) {
        this.cancelHeightDraft();
        evt.preventDefault();
        return;
      }
      if (this.mode.freeCarry) {
        this.mode.cancelCarry();
        this.hud.setReadout('Přenášení zrušeno — věc zůstala na místě');
        this.s.handleHover(this.s.hoverCell);
        evt.preventDefault();
        return;
      }
      if (this.mode.draftStarted || this.riverStroke || this.mode.freeDraftOpen) {
        this.clearBrushDraft();
        evt.preventDefault();
        return;
      }
      if (this.mode.hasDraft) {
        this.cancelBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.key === 'Enter') {
      if (this.mode.selectsArea && this.mode.hasAreaSelection) {
        this.applyAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.mode.mode === 'height' && this.mode.heightDraftCount) {
        this.applyHeightSelection();
        evt.preventDefault();
        return;
      }
      if (this.mode.hasDraft || this.mode.freeDraftOpen) {
        this.applyBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.shiftKey && /^Digit[1-9]$/.test(evt.code)) {
      this.selectTabAt(Number(evt.code.slice(5)) - 1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'x' || evt.key === 'X') {
      this.setEraseMode(!this.erasing);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'n' || evt.key === 'N') {
      if (!evt.repeat) this.s.skipTime();
      evt.preventDefault();
      return;
    }
    if (evt.key === 'b' || evt.key === 'B') {
      this.stepBuildingView();
      evt.preventDefault();
      return;
    }
    if (evt.key === 'z' || evt.key === 'Z') {
      this.undo();
      evt.preventDefault();
      return;
    }
    if (evt.key === 'h' || evt.key === 'H') {
      this.mode.setMode(this.mapMode === 'height' ? 'zone' : 'height');
      evt.preventDefault();
      return;
    }
    if (evt.key === 'q' || evt.key === 'Q') {
      if (this.mode.undergroundFloor) this.stepFloorHeight(-1);
      else this.mode.stepHeightLevel(-1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'e' || evt.key === 'E') {
      if (this.mode.undergroundFloor) this.stepFloorHeight(1);
      else this.mode.stepHeightLevel(1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'r' || evt.key === 'R') {
      if (this.mode.turnCarry(evt.shiftKey ? -1 : 1)) {
        this.s.handleHover(this.s.hoverCell);
        evt.preventDefault();
        return;
      }
      if (this.mode.rotateDeco(evt.shiftKey ? -1 : 1)) {
        this.refreshBrushOptions();
        this.s.handleHover(this.s.hoverCell);
        evt.preventDefault();
        return;
      }
    }
    if (/^[1-9]$/.test(evt.key)) {
      this.mode.setHeightLevel(HEIGHT_PRESETS[Number(evt.key) - 1]);
      evt.preventDefault();
      return;
    }
    if (/^F\d+$/.test(evt.key)) return;
    evt.preventDefault();
  },

  paintCell(cx, cz) {
    return this.mode.paint(cx, cz);
  },

  startPaint(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'floors') {
      if (this.mode.undergroundFloor) this.mode.beginFloorDrag(cell.cx, cell.cz);
      else this.startCave(cell);
    } else if (this.mode.mode === 'area') this.mode.beginAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') {
      this.mode.beginHeightStroke();
      this.mode.paint(cell.cx, cell.cz);
    } else if (this.mode.freeCarry) this.placeFreeAt(cell);
    else if (this.mode.isMoveBrush) this.pickUpFreeAt(cell);
    else if (cell.shift) {
      this.hud.onBrush('move');
      this.pickUpFreeAt(cell);
    }
    else if (!this.mode.hasBrush) {
      if (!this.pickBrushFrom(cell)) this.hud.setReadout(NO_BRUSH_HINT);
    } else if (this.mode.placesFree) this.placeFreeAt(cell);
    else if (this.mode.isJoinBrush) this.pickJoinCell(cell);
    else if (this.mode.isBridgeBrush && this.mode.draftMode !== 'remove') this.pickBridgeCell(cell);
    else if (this.mode.isLakeBrush) this.pickLake(cell, this.mode.draftMode === 'remove' ? 'remove' : 'add');
    else if (this.mode.isRiverBrush) this.startRiver(cell);
    else if (!this.mode.isCreatureSettingsBrush && !this.mode.canDraftCell(cell.cx, cell.cz)) this.hud.setReadout('Mimo hrací plochu — přepni na Plochu');
    else this.mode.beginDraftDrag(cell.cx, cell.cz);
  },

  pickBrushFrom(cell) {
    const entry = this.mode.freeTargetAt(this.s.editorPlaceSpot(cell)) || this.mode.decorationAt(cell.cx, cell.cz, cell.point);
    return this.openBrushFor(entry);
  },

  openBrushFor(entry) {
    const match = entry ? brushForDecoration(entry.key) : null;
    if (!match) return false;
    const tab = HUD_TABS.find((item) => tabBrushes(item).includes(match.brushKey));
    if (tab) this.hud.setTab(tab.key);
    this.hud.onBrush(match.brushKey);
    if (match.style) this.mode.setStyle(match.style);
    if (this.mode.setTileKey(entry.key)) {
      this.brushPanel.setSpecies(entry.key);
      this.brushPanel.setOptions(this.mode.brushOptionValues(match.brushKey));
    }
    const def = getDecoration(entry.key);
    this.hud.setReadout(`Štětec ${BRUSHES[match.brushKey].label}: ${def && def.displayName ? def.displayName : entry.key}`);
    return true;
  },

  placeFreeAt(cell) {
    const spot = this.s.editorPlaceSpot(cell);
    if (!spot) return;
    const { cx, cz } = worldToCellCoords(spot.x, spot.z);
    if (!this.mode.canDraftCell(cx, cz)) {
      this.hud.setReadout('Mimo hrací plochu — přepni na Plochu');
      return;
    }
    const carrying = Boolean(this.mode.freeCarry);
    const erasing = this.mode.erasing && !carrying;
    const entry = erasing ? this.mode.markFree(spot) : this.mode.addFree(spot);
    if (!entry) {
      this.hud.setReadout(erasing ? 'Pod myší není nic ke smazání' : 'Sem nejde nic položit');
      return;
    }
    const def = getDecoration(entry.key);
    const name = def && def.displayName ? def.displayName : entry.key;
    const where = entry.deck === 'upper' ? ' — patro stavby' : entry.deck === 'lower' ? ' — přízemí stavby' : '';
    const verb = carrying ? 'Přeneseno do návrhu' : erasing ? 'Do návrhu ke smazání' : 'Do návrhu';
    this.hud.setReadout(`${verb}: ${name}${where} · Enter zapíše`);
  },

  pickUpFreeAt(cell) {
    const entry = this.mode.pickUpFree(this.s.editorPlaceSpot(cell));
    if (!entry) {
      this.hud.setReadout('Pod myší není nic k přesunutí');
      return;
    }
    const def = getDecoration(entry.key);
    const name = def && def.displayName ? def.displayName : entry.key;
    this.hud.setReadout(`Neseš: ${name} · klik položí · R natočí · Esc nebo pravé tlačítko vrátí zpět`);
  },

  unmarkFreeAt(cell) {
    if (this.mode.cancelCarry()) {
      this.hud.setReadout('Přenášení zrušeno — věc zůstala na místě');
      return;
    }
    const entry = this.mode.unmarkFree(this.s.editorPlaceSpot(cell));
    this.hud.setReadout(entry ? 'Odebráno z návrhu' : 'Tady v návrhu nic není');
  },

  showFreeDraft() {
    const draft = this.mode.freeDraft;
    if (this.mode.isMoveBrush) {
      const nameOf = (entry) => {
        const def = getDecoration(entry.key);
        return def && def.displayName ? def.displayName : entry.key;
      };
      const carry = this.mode.freeCarry;
      this.brushPanel.setMoveList(this.mode.freeMoves().map(nameOf), carry ? nameOf(carry.base) : null);
    } else {
      this.brushPanel.setFreeCount(draft.filter((item) => !item.remove).length, draft.filter((item) => item.remove).length);
    }
    this.s.showFreeDraft(draft);
  },

  pickJoinCell(cell) {
    if (this.mode.draftMode === 'remove') {
      this.hud.setReadout('Spojnice se v režimu Mazat nepoužívá — vypni Mazat');
      return;
    }
    const state = this.mode.pickJoinCell(cell.cx, cell.cz);
    if (state === 'invalid') {
      this.hud.setReadout('Spojnice: klikni na buňku, která v mapě existuje');
      return;
    }
    if (state === 'top') {
      this.hud.setReadout('Vrchol označen — klikni na spodek');
      return;
    }
    const info = this.mode.joinInfo;
    if (!info) return;
    const limit = Number(this.s.walkStepLimit);
    const steep = Number.isFinite(limit) && info.maxStep > limit;
    const note = steep ? ' — hráč to nevyleze' : '';
    this.hud.setReadout(`Spojnice: ${cellCount(info.count)} · krok ${formatMeters(info.maxStep)}${note}`);
  },

  pickBridgeCell(cell) {
    const state = this.mode.pickBridgeCell(cell.cx, cell.cz);
    if (state === 'invalid') {
      this.hud.setReadout('Most: klikni na buňku, která v mapě existuje');
      return;
    }
    if (state === 'top') {
      this.hud.setReadout('Břeh označen — klikni na protější břeh');
      return;
    }
    if (state === 'bad') {
      this.hud.setReadout('Most nejde postavit — břehy musí ležet proti sobě a mezi nimi musí být propast');
      return;
    }
    const info = this.mode.bridgeInfo;
    if (!info) return;
    this.hud.setReadout(`Most: ${cellCount(info.span + 1)} · převýšení ${formatMeters(info.drop)}`);
  },

  movePaint(cell) {
    const from = this.lastPaintCell || cell;
    if (this.mode.mode === 'floors') this.mode.moveFloorDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'area') this.mode.moveAreaDrag(cell.cx, cell.cz);
    else if (this.mode.mode === 'height') this.mode.paintRun(from, cell);
    else if (this.mode.isRiverBrush) this.extendRiver(cell);
    else if (!this.mode.isJoinBrush && !this.mode.isLakeBrush && (!this.mode.isBridgeBrush || this.mode.draftMode === 'remove')) this.mode.moveDraftDrag(cell.cx, cell.cz);
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
  },

  endPaint() {
    if (this.riverDrawing) this.endRiverStroke();
    this.lastPaintCell = null;
  },

  rightClickCell(cell) {
    this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
    if (this.mode.mode === 'zone' && this.mode.isJoinBrush) {
      this.mode.cancelJoin();
      this.hud.setReadout('Spojnice zrušena — klikni znovu na vrchol');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isBridgeBrush) {
      this.mode.cancelBridge();
      this.hud.setReadout('Most zrušen — klikni znovu na břeh');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isLakeBrush) {
      this.pickLake(cell, 'lower');
      return;
    }
    if (this.mode.mode === 'zone' && this.mode.isRiverBrush) {
      this.removeRiverAt(cell);
      return;
    }
    if (this.mode.selectsArea) {
      this.mode.removeAreaCells([[cell.cx, cell.cz]]);
      return;
    }
    if (this.mode.mode === 'height') {
      this.mode.unmarkHeightCell(cell.cx, cell.cz);
      return;
    }
    if (this.mode.freePlacing) {
      this.unmarkFreeAt(cell);
      this.s.handleHover(cell);
      return;
    }
    if (!this.mode.canEditCell(cell.cx, cell.cz)) return;
    if (!this.mode.hasBrush) {
      this.hud.setReadout(NO_BRUSH_HINT);
      return;
    }
    this.mode.undraftCell(cell.cx, cell.cz);
  },
};
