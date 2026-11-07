// Zvýraznění dekorace pod kurzorem — zlatý obrys kolem celého objektu.
// Drží si seznam meshů a jméno pro tooltip; samotné kreslení si řídí Babylon.
import '@babylonjs/core/Rendering/outlineRenderer';
import { cellKey } from '../../utils/gridMath.js';
import { OUTLINE_GOLD, OUTLINE_PULSE, OUTLINE_PULSE_SPEED, OUTLINE_FADE_SPEED } from '../../utils/outlineStyle.js';

const OUTLINE_WIDTH = 0.035;
const MIN_RADIUS = 0.25;

export default class DecoHighlightSystem {

  constructor(scene) {
    this.s = scene;
    this.records = new Map();
    this.hoverKey = null;
    this.time = 0;
    this.visible = true;
  }

  add(entry, node, def) {
    if (!node || !def) return;
    if (!def.gather) {
      if (def.blocks === false) return;
      if ((def.radius || 0) < MIN_RADIUS) return;
    }
    if (!node.getChildMeshes) return;
    const meshes = node.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
    if (node.getTotalVertices && node.getTotalVertices() > 0) meshes.unshift(node);
    if (!meshes.length) return;
    const key = cellKey(entry.cx, entry.cz);
    this.remove(entry.cx, entry.cz);
    this.records.set(key, {
      meshes,
      label: def.displayName || entry.key,
      level: 0,
    });
  }

  hasEntry(cx, cz) {
    return this.records.has(cellKey(cx, cz));
  }

  labelAt(cx, cz) {
    const record = this.records.get(cellKey(cx, cz));
    return record ? { label: record.label } : null;
  }

  setHover(cell) {
    this.hoverKey = cell ? cellKey(cell.cx, cell.cz) : null;
  }

  setVisible(visible) {
    this.visible = visible !== false;
    if (this.visible) return;
    this.hoverKey = null;
    for (const record of this.records.values()) this.applyLevel(record, 0);
  }

  update(dt) {
    if (!this.records.size || !this.visible) return;
    this.time += dt;
    const step = OUTLINE_FADE_SPEED * dt;
    for (const [key, record] of this.records) {
      const goal = key === this.hoverKey ? 1 : 0;
      const next = record.level + Math.max(-step, Math.min(step, goal - record.level));
      if (next === record.level) continue;
      record.level = next;
      this.applyLevel(record, next);
    }
  }

  applyLevel(record, level) {
    const on = level > 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * OUTLINE_PULSE_SPEED);
    for (const mesh of record.meshes) {
      mesh.renderOutline = on;
      if (!on) continue;
      mesh.outlineColor = OUTLINE_GOLD;
      mesh.outlineWidth = OUTLINE_WIDTH + OUTLINE_PULSE * pulse * level;
    }
  }

  remove(cx, cz) {
    const key = cellKey(cx, cz);
    const record = this.records.get(key);
    if (!record) return;
    this.applyLevel(record, 0);
    this.records.delete(key);
    if (this.hoverKey === key) this.hoverKey = null;
  }

  clear() {
    for (const record of this.records.values()) this.applyLevel(record, 0);
    this.records.clear();
    this.hoverKey = null;
  }
}