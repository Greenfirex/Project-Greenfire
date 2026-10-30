// Izometrická kamera — orthografická projekce s pevným úhlem a zoomem.
// Drží cílový bod pohledu a nabízí plynulé přepočty ortho rozsahu při zoomu.
import '@babylonjs/core/Cameras/arcRotateCamera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

const ISO_ALPHA = -Math.PI / 4;
const ISO_BETA = Math.PI / 3.4;
const ZOOM_MIN = 8;
export const ZOOM_MAX = 60;

export default class CameraSystem {

  constructor(scene) {
    this.s = scene;
    this.zoom = 18;
    this.maxZoom = ZOOM_MAX;
    this.target = new Vector3(0, 0, 0);
    this.camera = null;
  }

  create() {
    this.camera = new ArcRotateCamera(
      'isoCamera',
      ISO_ALPHA,
      ISO_BETA,
      this.zoom * 2.2,
      this.target,
      this.s
    );
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.lowerBetaLimit = 0.15;
    this.camera.upperBetaLimit = Math.PI / 2.2;
    this.camera.panningSensibility = 0;
    this.camera.detachControl();
    this.applyOrtho();
    return this.camera;
  }

  applyOrtho() {
    const engine = this.s.getEngine();
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const halfHeight = this.zoom / 2;
    const halfWidth = halfHeight * aspect;
    this.camera.orthoTop = halfHeight;
    this.camera.orthoBottom = -halfHeight;
    this.camera.orthoLeft = -halfWidth;
    this.camera.orthoRight = halfWidth;
  }

  setZoom(zoom) {
    this.zoom = Math.min(this.maxZoom, Math.max(ZOOM_MIN, zoom));
    this.camera.radius = this.zoom * 2.2;
    this.applyOrtho();
  }

  setMaxZoom(maxZoom) {
    const value = Number.isFinite(maxZoom) ? maxZoom : ZOOM_MAX;
    this.maxZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
    if (this.zoom > this.maxZoom) this.setZoom(this.maxZoom);
  }

  zoomBy(delta) {
    this.setZoom(this.zoom + delta);
  }

  rotateBy(alphaDelta) {
    this.camera.alpha += alphaDelta;
  }

  follow(x, z, y, dt) {
    if (!this.camera) return;
    const k = 1 - Math.pow(0.001, Math.min(0.25, Math.max(0, dt)));
    const goalY = Number.isFinite(y) ? y : 0;
    this.target.x += (x - this.target.x) * k;
    this.target.z += (z - this.target.z) * k;
    this.target.y += (goalY - this.target.y) * k;
    this.camera.setTarget(this.target);
  }

  snapTo(x, z, y = 0) {
    this.target.set(x, Number.isFinite(y) ? y : 0, z);
    if (this.camera) this.camera.setTarget(this.target);
  }

  onResize() {
    this.applyOrtho();
  }

  viewCenter() {
    return this.target;
  }

  viewHeight() {
    return this.zoom;
  }
}
