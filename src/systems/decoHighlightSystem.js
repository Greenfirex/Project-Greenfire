// Zvýraznění dekorace pod kurzorem — světelný obrouček na zemi pod stromy, rudou i dalšími objekty.
// Drží jen kroužky; o postavené dekorace se stará decoSystem, tady se jen hlásí, kam kroužek patří.
import '@babylonjs/core/Meshes/Builders/discBuilder';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { cellKey, cellToWorldCoords } from '../utils/gridMath.js';

const FADE_SPEED = 6;
const SEGMENTS = 28;
const BAND_WIDTH = 0.12;
const RING_LIFT = 0.02;

function toColor3(rgb) {
  return new Color3(rgb[0], rgb[1], rgb[2]);
}

export default class DecoHighlightSystem {

  constructor(scene) {
    this.s = scene;
    this.records = new Map();
    this.surfaceAt = () => 0;
    this.hoverCell = null;
    this.time = 0;
    this.visible = true;
  }

  create(surfaceAt) {
    this.surfaceAt = surfaceAt || (() => 0);
  }

  add(entry, node, def) {
    const cfg = def && def.highlight;
    if (!cfg) return;
    const key = cellKey(entry.cx, entry.cz);
    const existing = this.records.get(key);
    if (existing) this.disposeRecord(existing);
    const ring = this.createRing(`hl_${entry.key}_${entry.cx}_${entry.cz}`, cfg);
    const record = {
      ring,
      ringMaterial: ring.material,
      color: toColor3(cfg.ringColor),
      cfg,
      cx: entry.cx,
      cz: entry.cz,
      offsetX: entry.offsetX || 0,
      offsetZ: entry.offsetZ || 0,
      liftY: entry.liftY || 0,
      level: 0,
    };
    this.records.set(key, record);
  }

  createRing(name, cfg) {
    const outer = (cfg.ringSize || (cfg.radius || 0.9) * 2) / 2;
    const inner = Math.max(outer * 0.35, outer - BAND_WIDTH);
    const disc = MeshBuilder.CreateDisc(name, {
      radius: outer,
      tessellation: SEGMENTS,
      arc: inner / outer,
    }, this.s);
    const mat = new StandardMaterial(`${name}_mat`, this.s);
    mat.diffuseColor = new Color3(0, 0, 0);
    mat.specularColor = new Color3(0, 0, 0);
    mat.emissiveColor = new Color3(0, 0, 0);
    mat.alpha = 0;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    disc.material = mat;
    disc.rotation.x = Math.PI / 2;
    disc.isPickable = false;
    disc.setEnabled(false);
    return disc;
  }

  hasEntry(cx, cz) {
    return this.records.has(cellKey(cx, cz));
  }

  setHover(cell) {
    this.hoverCell = cell ? cellKey(cell.cx, cell.cz) : null;
  }

  setVisible(visible) {
    this.visible = visible !== false;
    if (!this.visible) {
      this.hoverCell = null;
      for (const record of this.records.values()) record.ring.setEnabled(false);
    }
  }

  update(dt) {
    if (!this.records.size || !this.visible) return;
    this.time += dt;
    const step = FADE_SPEED * dt;
    for (const [key, record] of this.records) {
      const hovered = key === this.hoverCell;
      const goal = hovered ? 1 : 0;
      record.level += Math.max(-step, Math.min(step, goal - record.level));
      if (record.level <= 0 && !hovered) {
        record.ring.setEnabled(false);
        continue;
      }
      record.ring.setEnabled(true);
      const pulse = 0.5 + 0.5 * Math.sin(this.time * (record.cfg.pulse || 1.6));
      const { x, z } = cellToWorldCoords(record.cx, record.cz);
      const y = this.surfaceAt(record.cx, record.cz) + record.liftY + (record.cfg.lift || RING_LIFT);
      record.ring.position = new Vector3(x + record.offsetX, y, z + record.offsetZ);
      const scale = 1 + record.level * 0.15;
      record.ring.scaling = new Vector3(scale, scale, scale);
      record.ring.rotation.y = this.time * (record.cfg.spin || 0.9);
      const alpha = record.level * (0.45 + pulse * 0.25);
      record.ringMaterial.emissiveColor = record.color.scale(alpha * 2);
      record.ringMaterial.alpha = alpha;
    }
  }

  clear() {
    for (const record of this.records.values()) this.disposeRecord(record);
    this.records.clear();
    this.hoverCell = null;
  }

  disposeRecord(record) {
    if (record.ringMaterial) record.ringMaterial.dispose();
    record.ring.dispose();
  }
}
