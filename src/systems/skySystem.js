// Obloha kolem scény — bez textury, slunce se hýbe podle denní doby.
// Dává vodě skutečný odraz nebe a nahrazuje jednobarevné pozadí.
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { SkyMaterial } from '@babylonjs/materials/sky/skyMaterial';

const NIGHT_LUMINANCE = 0.14;
const DAY_LUMINANCE = 1.17;
const HORIZON_COLOR = new Color3(0.55, 0.7, 0.92);

export default class SkySystem {

  constructor(scene) {
    this.s = scene;
    this.skybox = null;
    this.material = null;
  }

  create() {
    if (this.skybox) return this.skybox;
    const material = new SkyMaterial('skyMat', this.s);
    material.backFaceCulling = false;
    material.fogEnabled = false;
    material.useSunPosition = true;
    material.turbidity = 8;
    material.rayleigh = 2;
    material.mieCoefficient = 0.012;
    material.mieDirectionalG = 0.85;
    material.luminance = 1;
    material.dithering = true;
    material.distance = 1000;
    const skybox = CreateBox('skyBox', { size: 1200 }, this.s);
    skybox.material = material;
    skybox.infiniteDistance = true;
    skybox.isPickable = false;
    this.skybox = skybox;
    this.material = material;
    return skybox;
  }

  setDayness(value, sunLight = null) {
    if (!this.material) return;
    const dayness = Math.max(0, Math.min(1, Number(value) || 0));
    this.material.luminance = NIGHT_LUMINANCE + (DAY_LUMINANCE - NIGHT_LUMINANCE) * dayness;
    if (sunLight && sunLight.position && sunLight.position.lengthSquared() > 0) {
      const direction = sunLight.position.clone().normalize();
      this.material.sunPosition = direction.scale(this.material.distance);
    }
  }

  tint() {
    const luminance = this.material ? this.material.luminance : DAY_LUMINANCE;
    const brightness = Math.max(0.12, Math.min(1, luminance / DAY_LUMINANCE));
    return new Color3(
      HORIZON_COLOR.r * brightness,
      HORIZON_COLOR.g * brightness,
      HORIZON_COLOR.b * brightness,
    );
  }
}
