// Část řízení editoru: popisky pod myší — co je v buňce, jak je vysoko a co se tam chystá.
// Patří k MapEditor (sdílí jeho this); popisky pod zemí má mapFloors.js.
import { formatMeters } from '../data/maps/layoutStore.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { BRUSHES } from '../data/catalogs/brushes.js';
import { formatLevel } from './heightRamp.js';

function entryLabel(entry) {
  if (!entry) return null;
  const def = getDecoration(entry.key);
  return def && def.displayName ? def.displayName : entry.key;
}

function brushLabel(key) {
  const brush = BRUSHES[key];
  return brush ? brush.label : key;
}

function respawnLabel(days) {
  if (!Number.isFinite(days)) return 'čeká na obnovu';
  const whole = Math.max(0, Math.ceil(days));
  if (whole <= 0) return 'obnoví se každou chvíli';
  if (whole === 1) return 'obnoví se za 1 den';
  if (whole <= 4) return `obnoví se za ${whole} dny`;
  return `obnoví se za ${whole} dní`;
}

export default {
  clearHoverReadout() {
    this.hud.setCursorValue(null);
    this.s.gridSystem.clearBrush();
    this.s.gridSystem.clearHoverCell();
    this.s.gridSystem.clearCreatureRadius();
    this.hud.setReadout('–');
    this.s.tooltipPanel.hide();
  },

  showAreaHoverReadout(cell) {
    this.hud.setCursorValue(null);
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const state = this.mode.areaTool === 'erase' ? 'mažu' : 'maluju';
    const zone = info.layerEntry ? `povrch: ${entryLabel(info.layerEntry)}` : 'bez povrchu';
    this.s.tooltipPanel.show(`Plocha — ${state}`, `${cell.cx}, ${cell.cz} · ${zone}`);
  },

  showCellHoverReadout(cell) {
    const info = this.mode.describeAt(cell.cx, cell.cz);
    const parts = [];
    const surface = entryLabel(info.layerEntry);
    if (surface) parts.push(surface);
    for (const item of info.decorations || []) parts.push(item.name);
    const beast = info.creature;
    if (beast) parts.push(beast.tier ? `${beast.type.label} (${beast.tier.label})` : beast.type.label);
    const water = this.s.waterBodyAtCell(cell.cx, cell.cz);
    if (water) parts.push(`${water.kind === 'river' ? 'Řeka' : 'Jezero'} ${formatMeters(water.level)}`);
    const lift = Math.round((Number(info.liftY) || 0) * 100) / 100;
    this.hud.setCursorValue(this.mode.mode === 'height' ? formatMeters(lift) : null);
    const staged = this.mode.mode === 'height' ? this.mode.heightLevelAt(cell.cx, cell.cz) : null;
    const goal = this.mode.mode === 'height' ? this.mode.heightLevel : null;
    const joined = this.mode.joinMetersAt(cell.cx, cell.cz);
    let target = '';
    if (staged !== null) target = ` → ${formatLevel(staged)}`;
    else if (goal !== null) target = ` → ${formatLevel(goal)}`;
    else if (joined !== null) target = ` → ${formatMeters(joined)}`;
    let draft = '';
    if (this.mode.draft) {
      const count = this.mode.clusterCountAt(this.mode.draft.brushKey);
      const amount = count.max > 1 ? (count.min === count.max ? ` ×${count.min}` : ` ×${count.min}–${count.max}`) : '';
      draft = ` · kreslím: ${brushLabel(this.mode.draft.brushKey)}${amount}`;
    }
    const range = beast ? this.mode.creatureRangeInfo(beast.type, beast.tier) : null;
    const roam = !range || range.radius <= 0
      ? ''
      : range.radiusKind === 'notice'
        ? ` · všimne si do ${formatMeters(range.radius)}`
        : ` · toulá se do ${formatMeters(range.radius)}`;
    const runtime = beast && this.s.creatureStatusAt
      ? this.s.creatureStatusAt(cell.cx, cell.cz, beast.entry.kind, beast.tierKey)
      : null;
    const status = runtime
      ? (runtime.alive ? ' · živý' : runtime.waiting ? ` · mrtvý, ${respawnLabel(runtime.remainingDays)}` : '')
      : '';
    const title = parts.length ? parts.join(' · ') : 'Prázdno';
    this.s.tooltipPanel.show(title, `${cell.cx}, ${cell.cz} · výška ${formatMeters(lift)}${target}${draft}${roam}${status}`);
  },
};
