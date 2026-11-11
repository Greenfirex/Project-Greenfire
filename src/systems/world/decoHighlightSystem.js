// Zvýraznění dekorace pod kurzorem — zlatý obrys kolem celého objektu.
// Drží si seznam meshů a jméno pro tooltip; samotné kreslení si řídí Babylon.
import '@babylonjs/core/Rendering/outlineRenderer';
import { cellKey } from '../../utils/gridMath.js';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { OUTLINE_GOLD, OUTLINE_PULSE, OUTLINE_PULSE_SPEED, OUTLINE_FADE_SPEED } from '../../utils/outlineStyle.js';

const OUTLINE_WIDTH = 0.035;
const MIN_RADIUS = 0.25;

export default class DecoHighlightSystem {

  constructor(scene) {
    this.s = scene;
    this.records = new Map();
    this.hovered = null;
    this.time = 0;
    this.visible = true;
    this.levelOf = null;
  }

  currentLevel() {
    return this.levelOf ? this.levelOf() : 0;
  }

  keyOf(cx, cz, level) {
    return `${level}|${cellKey(cx, cz)}`;
  }

  add(entry, node, def) {
    if (!node || !def) return;
    if (!def.gather && !def.loot) {
      if (def.blocks === false) return;
      if ((def.radius || 0) < MIN_RADIUS) return;
    }
    if (!node.getChildMeshes) return;
    const meshes = node.getChildMeshes().filter((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 0);
    if (node.getTotalVertices && node.getTotalVertices() > 0) meshes.unshift(node);
    if (!meshes.length) return;
    const key = this.keyOf(entry.cx, entry.cz, levelOfEntry(entry));
    const list = (this.records.get(key) || []).filter((record) => {
      if (record.node !== node) return true;
      this.drop(record);
      return false;
    });
    list.push({
      node,
      meshes,
      label: def.displayName || entry.key,
      level: 0,
    });
    this.records.set(key, list);
  }

  hasEntry(cx, cz) {
    return this.records.has(this.keyOf(cx, cz, this.currentLevel()));
  }

  recordAt(cx, cz, level, point = null) {
    const list = this.records.get(this.keyOf(cx, cz, level));
    if (!list) return null;
    if (!point || list.length === 1) return list[0];
    let best = null;
    let bestDistance = Infinity;
    for (const record of list) {
      const spot = record.node.getAbsolutePosition();
      const distance = (spot.x - point.x) ** 2 + (spot.z - point.z) ** 2;
      if (distance >= bestDistance) continue;
      best = record;
      bestDistance = distance;
    }
    return best;
  }

  labelAt(cx, cz, level = this.currentLevel(), point = null) {
    const record = this.recordAt(cx, cz, level, point);
    return record ? { label: record.label } : null;
  }

  spotAt(cx, cz, level, point = null) {
    const record = this.recordAt(cx, cz, level, point);
    return record ? record.node.getAbsolutePosition() : null;
  }

  setHover(cell) {
    this.hovered = cell ? this.recordAt(cell.cx, cell.cz, Number.isFinite(cell.level) ? cell.level : this.currentLevel(), cell.point) : null;
  }

  setVisible(visible) {
    this.visible = visible !== false;
    if (this.visible) return;
    this.hovered = null;
    for (const list of this.records.values()) {
      for (const record of list) this.applyLevel(record, 0);
    }
  }

  update(dt) {
    if (!this.records.size || !this.visible) return;
    this.time += dt;
    const step = OUTLINE_FADE_SPEED * dt;
    for (const list of this.records.values()) {
      for (const record of list) {
        const goal = record === this.hovered ? 1 : 0;
        const next = record.level + Math.max(-step, Math.min(step, goal - record.level));
        if (next === record.level) continue;
        record.level = next;
        this.applyLevel(record, next);
      }
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

  remove(cx, cz, anchor = null) {
    const level = anchor && anchor.metadata ? levelOfEntry(anchor.metadata.entry) : this.currentLevel();
    const key = this.keyOf(cx, cz, level);
    if (!anchor) {
      this.removeKey(key);
      return;
    }
    const list = this.records.get(key);
    if (!list) return;
    const kept = list.filter((record) => {
      if (record.node !== anchor && !record.node.isDescendantOf(anchor)) return true;
      this.drop(record);
      return false;
    });
    if (kept.length) this.records.set(key, kept);
    else this.records.delete(key);
  }

  removeKey(key) {
    const list = this.records.get(key);
    if (!list) return;
    for (const record of list) this.drop(record);
    this.records.delete(key);
  }

  drop(record) {
    this.applyLevel(record, 0);
    if (this.hovered === record) this.hovered = null;
  }

  clear() {
    for (const list of this.records.values()) {
      for (const record of list) this.applyLevel(record, 0);
    }
    this.records.clear();
    this.hovered = null;
  }
}