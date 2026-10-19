// Střídání dne a noci — posouvá slunce po obloze, ladí intenzity a barvu nebe.
// Jediné místo, které hýbe světly scény; bere si konfiguraci z mapy.
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { getMap } from '../data/catalogs/maps.js';

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
    this.apply();
  }

  update(deltaSeconds) {
    if (!this.config) return;
    this.time = (this.time + deltaSeconds / this.config.dayLengthSeconds) % 1;
    this.apply();
  }

  apply() {
    const cfg = this.config;
    if (!cfg || !this.sunLight) return;

    const dayness = this.dayness(this.time);
    const angle = (this.time - 0.25) * Math.PI * 2;
    const x = Math.cos(angle) * cfg.sunDistance;
    const y = Math.sin(angle) * cfg.sunHeight;
    const z = cfg.sunDistance * 0.3;

    this.sunLight.position = new Vector3(x, y, z);
    this.sunLight.direction = new Vector3(-x, -Math.abs(y) - 2, -z).normalize();
    this.sunLight.intensity = this.light.sunIntensity * dayness + cfg.moonIntensity * (1 - dayness);

    const moon = cfg.moonTint || [1, 1, 1];
    this.sunDiffuse = this.sunDiffuse || this.sunLight.diffuse.clone();
    const sun = this.sunDiffuse;
    this.sunLight.diffuse.set(
      sun.r + (moon[0] - sun.r) * (1 - dayness),
      sun.g + (moon[1] - sun.g) * (1 - dayness),
      sun.b + (moon[2] - sun.b) * (1 - dayness)
    );

    if (this.skyLight) {
      const floor = cfg.nightLight ?? 0.35;
      this.skyLight.intensity = this.light.hemiIntensity * (floor + (1 - floor) * dayness);
    }

    const sky = this.skyColor(dayness);
    this.s.clearColor = new Color4(sky[0], sky[1], sky[2], 1);
  }

  dayness(time) {
    const cfg = this.config;
    if (time < cfg.dawnTime || time > cfg.duskTime) return 0;
    const span = cfg.duskTime - cfg.dawnTime;
    const t = (time - cfg.dawnTime) / span;
    return Math.sin(Math.PI * t);
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
