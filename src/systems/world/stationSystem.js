// Pracovní místa z dekorací — ponk (otevře výrobu) a lucerny (klik je rozsvítí). Drží, kde stojí, zvýrazní kus pod myší
// a lucernám řídí záři, blikání a teplé světlo se stínem (přidělí ho systém světel ohně). Které lucerny svítí, se ukládá.
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { levelOfEntry } from '../../data/maps/areaShape.js';
import { FURNITURE_STYLES } from '../../data/catalogs/furniture.js';
import { lanternLightLift } from '../../utils/furnitureFactory.js';
import { createFlicker, stepFlicker } from '../../utils/flicker.js';
import {
  OUTLINE_GOLD, OUTLINE_PULSE, OUTLINE_PULSE_SPEED, USE_OUTLINE, USE_PICK_RADIUS, USE_PICK_HEIGHT, USE_REACH, USE_REACH_HEIGHT,
} from '../../utils/outlineStyle.js';

const FLICKER_SECONDS = 0.15;
const LAMP_FADE_SECONDS = 0.3;

function stationId(entry) {
  return [entry.cx, entry.cz, levelOfEntry(entry), entry.deck || '', entry.offsetX || 0, entry.offsetZ || 0].join('|');
}

export default class StationSystem {

  constructor(scene) {
    this.s = scene;
    this.stations = [];
    this.litIds = new Set();
    this.hovered = null;
    this.dayness = 1;
    this.time = 0;
    this.onLightSource = null;
    this.roomOf = null;
  }

  add(anchor, node, def, entry) {
    if (!def || !def.use) return;
    const id = stationId(entry);
    const old = this.stations.find((station) => station.id === id);
    if (old) this.drop(old);
    const station = { id, use: def.use, anchor, meshes: [], outline: [], lamp: null, x: 0, y: 0, z: 0, level: levelOfEntry(entry) };
    for (const mesh of node.getChildMeshes()) {
      mesh.isPickable = true;
      mesh.metadata = { ...(mesh.metadata || {}), station };
      station.meshes.push(mesh);
      if (!mesh.name.endsWith('_glass') && !mesh.name.endsWith('_flame')) station.outline.push(mesh);
    }
    if (def.use.kind === 'lamp') this.addLamp(station, node);
    this.place(station);
    this.stations.push(station);
  }

  addLamp(station, node) {
    const style = FURNITURE_STYLES.lantern;
    const lamp = { style, glow: 0, lit: this.litIds.has(station.id), materials: [], lift: lanternLightLift(style) * (node.scaling.y || 1) };
    for (const mesh of station.meshes) {
      const part = mesh.name.endsWith('_glass') ? 'glass' : mesh.name.endsWith('_flame') ? 'flame' : null;
      if (!part || !mesh.material) continue;
      mesh.material = mesh.material.clone(`${mesh.material.name}_${station.id}`);
      lamp.materials.push(mesh.material);
      lamp[part] = mesh.material;
    }
    lamp.glassGlow = Color3.FromArray(style.glassGlow);
    lamp.flameGlow = Color3.FromArray(style.flameGlow);
    lamp.glow = lamp.lit ? 1 : 0;
    lamp.flicker = createFlicker(1 - style.light.flicker, 1, FLICKER_SECONDS);
    lamp.source = {
      x: 0, y: 0, z: 0, intensity: 0, color: Color3.FromArray(style.light.color), range: style.light.range,
      shadow: 'need', level: station.level, refresh: 0, dirty: true, own: station.meshes,
    };
    station.lamp = lamp;
    if (this.onLightSource) this.onLightSource(lamp.source, true);
  }

  place(station) {
    const at = station.anchor.position;
    if (station.x === at.x && station.y === at.y && station.z === at.z) return;
    station.x = at.x;
    station.y = at.y;
    station.z = at.z;
    if (!station.lamp) return;
    station.lamp.source.x = at.x;
    station.lamp.source.y = at.y + station.lamp.lift;
    station.lamp.source.z = at.z;
    station.lamp.source.dirty = true;
  }

  drop(station) {
    if (station.lamp) {
      if (this.onLightSource) this.onLightSource(station.lamp.source, false);
      for (const material of station.lamp.materials) material.dispose();
    }
    if (this.hovered === station) this.hovered = null;
    this.stations = this.stations.filter((other) => other !== station);
  }

  sync() {
    for (const station of this.stations.slice()) {
      if (station.anchor.isDisposed()) this.drop(station);
    }
  }

  at(pointerX, pointerY, point, level) {
    const list = this.stations.filter((station) => station.level === level);
    if (!list.length) return null;
    const hit = this.s.pick(pointerX, pointerY, (mesh) => Boolean(mesh.metadata && mesh.metadata.station) && mesh.isEnabled());
    if (hit && hit.hit && hit.pickedMesh && list.includes(hit.pickedMesh.metadata.station)) return hit.pickedMesh.metadata.station;
    if (!point) return null;
    let best = null;
    let bestGap = USE_PICK_RADIUS;
    for (const station of list) {
      if (!station.anchor.isEnabled() || Math.abs(point.y - station.y) > USE_PICK_HEIGHT) continue;
      const gap = Math.hypot(point.x - station.x, point.z - station.z);
      if (gap > bestGap) continue;
      best = station;
      bestGap = gap;
    }
    return best;
  }

  inReach(station, position) {
    return Boolean(station && position)
      && Math.hypot(position.x - station.x, position.z - station.z) <= USE_REACH
      && Math.abs(position.y - station.y) <= USE_REACH_HEIGHT
      && (!this.roomOf || this.roomOf(station) === this.roomOf(position));
  }

  hint(station) {
    if (!station.lamp) return station.use.hint;
    return station.lamp.lit ? station.use.offHint : station.use.onHint;
  }

  toggleLamp(station) {
    const lamp = station && station.lamp;
    if (!lamp) return false;
    lamp.lit = !lamp.lit;
    lamp.source.dirty = true;
    if (lamp.lit) this.litIds.add(station.id);
    else this.litIds.delete(station.id);
    return lamp.lit;
  }

  setHover(station) {
    this.hovered = station || null;
  }

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
  }

  update(dt, shadowsMoved = false) {
    this.time += dt;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * OUTLINE_PULSE_SPEED);
    for (const station of this.stations) {
      if (station.anchor.isDisposed()) continue;
      this.place(station);
      const lit = station === this.hovered;
      for (const mesh of station.outline) {
        mesh.renderOutline = lit;
        if (!lit) continue;
        mesh.outlineColor = OUTLINE_GOLD;
        mesh.outlineWidth = USE_OUTLINE + OUTLINE_PULSE * pulse;
      }
      if (station.lamp) this.updateLamp(station, dt, shadowsMoved);
    }
  }

  updateLamp(station, dt, shadowsMoved) {
    const lamp = station.lamp;
    const light = lamp.style.light;
    if (shadowsMoved) lamp.source.dirty = true;
    const target = lamp.lit ? 1 : 0;
    const step = Math.max(0, dt) / LAMP_FADE_SECONDS;
    lamp.glow = target > lamp.glow ? Math.min(target, lamp.glow + step) : Math.max(target, lamp.glow - step);
    const flicker = stepFlicker(lamp.flicker, dt);
    const night = station.level < 0 ? 1 : 1 - this.dayness;
    lamp.source.intensity = (light.day + (light.night - light.day) * night) * lamp.glow * flicker;
    if (lamp.flame) lamp.flameGlow.scaleToRef(lamp.glow * flicker, lamp.flame.emissiveColor);
    if (lamp.glass) lamp.glassGlow.scaleToRef(lamp.glow * (0.4 + 0.6 * night) * flicker, lamp.glass.emissiveColor);
  }

  serialize() {
    return { lit: [...this.litIds] };
  }

  defaultState() {
    return { lit: [] };
  }

  apply(data) {
    const list = data && Array.isArray(data.lit) ? data.lit.filter((id) => typeof id === 'string') : [];
    this.litIds = new Set(list);
    for (const station of this.stations) {
      if (!station.lamp) continue;
      station.lamp.lit = this.litIds.has(station.id);
      station.lamp.glow = station.lamp.lit ? 1 : 0;
      station.lamp.source.dirty = true;
    }
  }
}
