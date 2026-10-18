// Náhledy dílků do palety editoru — vyrenderuje model do malého obrázku.
// Náhled se počítá jednou a drží v paměti; hry se nedotýká.
import '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import '@babylonjs/core/Cameras/camera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import '@babylonjs/core/Cameras/arcRotateCamera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { getDecoration } from '../data/catalogs/decorations.js';
import { loadModel, instantiateModel } from '../utils/assetLoader.js';
import { tintTemplate } from '../utils/decoTint.js';

const SIZE = 96;
const VIEW = 1.35;
const ISO_ALPHA = -Math.PI / 4;
const ISO_BETA = Math.PI / 3.4;
const CAM_DIST = 8;

export default class TileThumbnails {

  constructor(scene, colors) {
    this.s = scene;
    this.colors = colors;
    this.cache = new Map();
    this.pending = new Map();
    this.camera = null;
    this.rtt = null;
  }

  get(key) {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key));
    if (this.pending.has(key)) return this.pending.get(key);
    const promise = this.render(key).finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  async render(key) {
    const def = getDecoration(key);
    if (!def || !def.model) return null;

    const template = await loadModel(this.s, def.model, (root) => tintTemplate(root, def, this.colors));
    if (!template) return null;

    const holder = instantiateModel(this.s, template, `thumb_${key}`);
    if (!holder) return null;
    holder.position = new Vector3(0, 0, 0);
    const sc = def.scale ?? 1;
    holder.scaling = holder.scaling.scale(sc);
    holder.setEnabled(true);
    for (const child of holder.getChildMeshes()) child.isVisible = true;

    const url = await this.capture(holder);
    holder.dispose(false, false);
    if (!url) return null;
    this.cache.set(key, url);
    return url;
  }

  capture(node) {
    this.ensureCamera();
    const rtt = this.ensureTarget();
    rtt.renderList = node.getChildMeshes(false);
    rtt.resetRefreshCounter();
    const engine = this.s.getEngine();
    const pixels = new Uint8Array(SIZE * SIZE * 4);
    rtt.onAfterRenderObservable.addOnce(() => {
      engine.readPixels(0, 0, SIZE, SIZE, true, false, pixels);
    });
    rtt.render();
    rtt.renderList = [];
    return this.readDataUrl(pixels);
  }

  readDataUrl(pixels) {
    if (!pixels) return null;
    let seen = false;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
        seen = true;
        break;
      }
    }
    if (!seen) return null;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(SIZE, SIZE);
    for (let y = 0; y < SIZE; y++) {
      const src = y * SIZE * 4;
      const dst = (SIZE - 1 - y) * SIZE * 4;
      for (let i = 0; i < SIZE * 4; i++) image.data[dst + i] = pixels[src + i];
    }
    ctx.putImageData(image, 0, 0);
    return canvas.toDataURL('image/png');
  }

  ensureCamera() {
    if (this.camera) return this.camera;
    const cam = new ArcRotateCamera('thumbCamera', ISO_ALPHA, ISO_BETA, CAM_DIST, Vector3.Zero(), this.s);
    cam.mode = Camera.ORTHOGRAPHIC_CAMERA;
    cam.orthoLeft = -VIEW;
    cam.orthoRight = VIEW;
    cam.orthoTop = VIEW;
    cam.orthoBottom = -VIEW;
    cam.minZ = 0.1;
    cam.maxZ = CAM_DIST * 4;
    cam.detachControl();
    this.camera = cam;
    return cam;
  }

  ensureTarget() {
    if (this.rtt) return this.rtt;
    const rtt = new RenderTargetTexture('thumbRtt', SIZE, this.s, false, true);
    rtt.activeCamera = this.camera;
    rtt.clearColor = new Color4(0.06, 0.08, 0.1, 1);
    rtt.refreshRate = -1;
    rtt.renderList = [];
    const index = this.s.customRenderTargets.indexOf(rtt);
    if (index !== -1) this.s.customRenderTargets.splice(index, 1);
    this.rtt = rtt;
    return rtt;
  }

  dispose() {
    if (this.rtt) this.rtt.dispose();
    if (this.camera) this.camera.dispose();
    this.rtt = null;
    this.camera = null;
    this.cache.clear();
    this.pending.clear();
  }
}
