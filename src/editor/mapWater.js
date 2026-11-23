// Část řízení editoru: hladina moře — zapnutí, krok nahoru a dolů.
// Patří k MapEditor (sdílí jeho this); jezera má mapLakes.js, řeky mapRivers.js.
import { HEIGHT_STEP } from '../data/maps/layoutStore.js';

export default {
  toggleWater() {
    const shown = this.mode.toggleWaterShown();
    if (shown && this.mode.getWaterLevel() === null) {
      this.setWater(-HEIGHT_STEP);
      return;
    }
    this.hud.setWater(this.mode.getWaterLevel(), this.mode.waterShown);
    this.s.refreshWaterVisibility();
  },

  stepWater(delta) {
    const current = this.mode.getWaterLevel();
    const base = current === null ? 0 : current;
    this.mode.setWaterShown(true);
    this.setWater(base + delta * HEIGHT_STEP);
  },

  setWater(level) {
    const snapped = Math.round((Number(level) || 0) / HEIGHT_STEP) * HEIGHT_STEP;
    const value = this.mode.setWaterLevel(snapped);
    this.mode.setWaterShown(true);
    this.hud.setWater(value, this.mode.waterShown);
    this.s.adoptEditorMap();
    this.s.renderWater();
    this.s.handleHover(this.s.hoverCell);
    this.markDirty();
  },
};
