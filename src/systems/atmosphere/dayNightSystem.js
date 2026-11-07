// Střídání dne a noci — posouvá slunce po obloze, ladí intenzity a barvu nebe.
// Jediné místo, které hýbe světly scény; bere si konfiguraci z mapy.
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getMap } from '../../data/catalogs/maps.js';

const DAYLIGHT_CURVE = 0.6;

function lerpRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export default class DayNightSystem {

  constructor(scene) {
    this.s = scene;
    this.config = null;
    this.light = null;
    this.sunLight = null;
    this.skyLight = null;
    this.time = 0;
    this.dayColor = null;
    this.sunDiffuse = null;
    this.fogColor = null;
  }

  create(map) {
    this.config = map.dayNight || null;
    this.light = map.light;
    this.dayColor = map.colors.sky;
    if (!this.config) return;
    this.time = this.config.startTime ?? 0;
  }

  attach(sunLight, skyLight) {
    this.sunLight = sunLight;
    this.skyLight = skyLight;
  }

  getTime() {
    return this.time;
  }

  setTime(value) {
    this.time = ((value % 1) + 1) % 1;
    this.applyLighting();
  }

  serialize() {
    return { time: this.time };
  }

  apply(data) {
    const start = this.config ? this.config.startTime : 0;
    const time = data && typeof data.time === 'number' && Number.isFinite(data.time) ? data.time : start;
    this.setTime(time);
  }

  registerState(key, provider) {
    this.saveKey = key;
    this.savedState = provider;
  }

  defaultState() {
    return { time: this.config ? this.config.startTime ?? 0 : 0 };
  }

  update(deltaSeconds) {
    if (!this.config) return;
    this.time = (this.time + deltaSeconds / this.config.dayLengthSeconds) % 1;
    this.applyLighting();
  }

  applyLighting() {
    const cfg = this.config;
    if (!cfg || !this.sunLight) return;

    const dayness = this.dayness(this.time);
    const angle = (this.time - 0.25) * Math.PI * 2;
    const x = Math.cos(angle) * cfg.sunDistance;
    const y = Math.sin(angle) * cfg.sunHeight;
    const z = cfg.sunDistance * 0.3;

    this.sunLight.direction = new Vector3(-x, -Math.abs(y) - 2, -z).normalize();
    this.sunLight.intensity = this.light.sunIntensity * dayness + cfg.moonIntensity * (1 - dayness);

    const moon = cfg.moonTint || [1, 1, 1];
    this.sunDiffuse = this.sunDiffuse || this.sunLight.diffuse.clone();
    const sun = this.sunDiffuse;
    let red = sun.r + (moon[0] - sun.r) * (1 - dayness);
    let green = sun.g + (moon[1] - sun.g) * (1 - dayness);
    let blue = sun.b + (moon[2] - sun.b) * (1 - dayness);
    const dusk = cfg.duskTint;
    if (dusk) {
      const low = 4 * dayness * (1 - dayness);
      const warmth = Math.pow(Math.max(0, low), 2) * 0.9;
      red += (dusk[0] - red) * warmth;
      green += (dusk[1] - green) * warmth;
      blue += (dusk[2] - blue) * warmth;
    }
    this.sunLight.diffuse.set(red, green, blue);

    if (this.skyLight) {
      const floor = cfg.nightLight ?? 0.35;
      this.skyLight.intensity = this.light.hemiIntensity * (floor + (1 - floor) * dayness);
    }

    const sky = this.skyColor(dayness);
    if (this.s.clearColor) this.s.clearColor.set(sky[0], sky[1], sky[2], 1);
    else this.s.clearColor = new Color4(sky[0], sky[1], sky[2], 1);
    if (this.fogColor) {
      const scale = 0.55 + 0.75 * dayness;
      this.fogColor.set(sky[0] * scale, sky[1] * scale, sky[2] * scale);
      this.s.fogColor = this.fogColor;
    }
  }

  dayness(time) {
    const cfg = this.config;
    if (time < cfg.dawnTime || time > cfg.duskTime) return 0;
    const span = cfg.duskTime - cfg.dawnTime;
    const t = (time - cfg.dawnTime) / span;
    return Math.pow(Math.sin(Math.PI * t), DAYLIGHT_CURVE);
  }

  skyColor(dayness) {
    const cfg = this.config;
    if (dayness < 0.5) {
      const t = dayness / 0.5;
      const base = this.time < 0.5 ? cfg.dawnColor : cfg.duskColor;
      return lerpRgb(cfg.nightColor, base, t);
    }
    const t = (dayness - 0.5) / 0.5;
    const base = this.time < 0.5 ? cfg.dawnColor : cfg.duskColor;
    return lerpRgb(base, this.dayColor, Math.min(1, t));
  }
}
