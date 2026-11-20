// Část staveb: lucerny — po kliknutí se rozsvítí: sklíčka a plamínek září a lucerna hlásí teplý zdroj světla, který
// potřebuje stín (stěny srubu ho zastaví); skutečné světlo přidělí systém světel ohně. Patří k BuildingSystem (sdílí jeho this).
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { meshFromBuffer } from '../../utils/buildingGeometry.js';
import { createFlicker, stepFlicker } from '../../utils/flicker.js';

const FLICKER_SECONDS = 0.15;
const LAMP_FADE_SECONDS = 0.3;

export default {
  finishLamp(plan, station) {
    const lamp = station.lamp;
    const style = lamp.style;
    const name = `${plan.name}_lamp_${this.lamps.length}`;
    lamp.glassMat = new StandardMaterial(`${name}_glass`, this.s);
    lamp.glassMat.diffuseColor = Color3.FromArray(style.glass);
    lamp.glassMat.specularColor = new Color3(0.3, 0.3, 0.3);
    lamp.glassMat.alpha = style.glassAlpha;
    lamp.flameMat = new StandardMaterial(`${name}_flame`, this.s);
    lamp.flameMat.disableLighting = true;
    lamp.flameMat.diffuseColor = Color3.Black();
    lamp.flameMat.emissiveColor = Color3.Black();
    lamp.glassGlow = Color3.FromArray(style.glassGlow);
    lamp.flameGlow = Color3.FromArray(style.flameGlow);
    const own = [station.mesh];
    for (const [buffer, material, suffix] of [[lamp.glass, lamp.glassMat, 'glass'], [lamp.flame, lamp.flameMat, 'flame']]) {
      const mesh = meshFromBuffer(`${name}_${suffix}`, buffer, this.s);
      if (!mesh) continue;
      own.push(mesh);
      mesh.parent = plan.root;
      mesh.material = material;
      this.addPartMesh(plan, mesh, station.part, false);
      mesh.isPickable = false;
    }
    lamp.glass = null;
    lamp.flame = null;
    const at = Vector3.TransformCoordinates(lamp.lightAt, plan.world);
    lamp.source = { x: at.x, y: at.y, z: at.z, intensity: 0, color: Color3.FromArray(style.light.color), range: style.light.range, shadow: 'need', darkness: style.light.shadowDarkness, level: 0, refresh: 0, dirty: true, own };
    if (this.onLightSource) this.onLightSource(lamp.source, true);
    lamp.lit = this.litLamps.has(station.id);
    lamp.glow = lamp.lit ? 1 : 0;
    lamp.flicker = createFlicker(1 - style.light.flicker, 1, FLICKER_SECONDS);
    this.lamps.push(station);
  },

  toggleLamp(station) {
    const lamp = station && station.lamp;
    if (!lamp) return false;
    lamp.lit = !lamp.lit;
    lamp.source.dirty = true;
    if (lamp.lit) this.litLamps.add(station.id);
    else this.litLamps.delete(station.id);
    return lamp.lit;
  },

  stationHint(station) {
    if (!station.lamp) return station.use.hint;
    return station.lamp.lit ? station.use.offHint : station.use.onHint;
  },

  setDayness(value) {
    this.dayness = Math.max(0, Math.min(1, value));
  },

  updateLamps(dt) {
    const moving = this.doors.some((door) => door.open !== door.goal);
    for (const station of this.lamps) {
      const lamp = station.lamp;
      const style = lamp.style;
      if (moving) lamp.source.dirty = true;
      const target = lamp.lit ? 1 : 0;
      const step = Math.max(0, dt) / LAMP_FADE_SECONDS;
      lamp.glow = target > lamp.glow ? Math.min(target, lamp.glow + step) : Math.max(target, lamp.glow - step);
      const flicker = stepFlicker(lamp.flicker, dt);
      const night = 1 - this.dayness;
      const strength = style.light.day + (style.light.night - style.light.day) * night;
      lamp.source.intensity = strength * lamp.glow * flicker;
      lamp.flameGlow.scaleToRef(lamp.glow * flicker, lamp.flameMat.emissiveColor);
      lamp.glassGlow.scaleToRef(lamp.glow * (0.4 + 0.6 * night) * flicker, lamp.glassMat.emissiveColor);
    }
  },

  dropLamps() {
    for (const station of this.lamps) {
      if (this.onLightSource) this.onLightSource(station.lamp.source, false);
    }
    this.lamps = [];
  },

  applyLamps(list) {
    this.litLamps = new Set(list);
    for (const station of this.lamps) {
      station.lamp.lit = this.litLamps.has(station.id);
      station.lamp.glow = station.lamp.lit ? 1 : 0;
    }
  },
};
