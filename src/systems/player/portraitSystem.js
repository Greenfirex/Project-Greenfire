// Živá postava v okně postavy — dvojník hráče v klidové póze, kterého vidí jen kamera okna, zkopírovaný do rámečku.
// Dvojník sdílí model i textury s hráčem; kreslí se jen při otevřeném okně a hlavní kamera ho nevidí.
import '@babylonjs/core/Cameras/targetCamera';
import { TargetCamera } from '@babylonjs/core/Cameras/targetCamera';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { Viewport } from '@babylonjs/core/Maths/math.viewport';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';

const PORTRAIT_LAYER = 0x10000000;
const SUPERSAMPLE = 2;
const MIN_SCALE = 0.5;
const FOV = 0.42;
const FRAME_HEIGHT = 2.45;
const LOOK_HEIGHT = 1.08;
const TRANSPARENT = new Color4(0, 0, 0, 0);

export default class PortraitSystem {

  constructor(scene) {
    this.s = scene;
    this.camera = null;
    this.main = null;
    this.canvas = null;
    this.context = null;
    this.region = { x: 0, y: 0, w: 0, h: 0 };
    this.look = new Vector3(0, 0, 0);
    this.candidates = { data: [], length: 0 };
    this.baseCandidates = null;
    this.drawing = false;
    this.double = null;
  }

  create() {
    const camera = new TargetCamera('portraitCamera', new Vector3(0, 0, 0), this.s, false);
    camera.fov = FOV;
    camera.minZ = 0.1;
    camera.maxZ = 40;
    camera.layerMask = PORTRAIT_LAYER;
    camera.viewport = new Viewport(0, 0, 0, 0);
    this.s.onBeforeCameraRenderObservable.add((cam) => {
      if (cam === camera) this.clearRegion();
    });
    this.s.onAfterRenderCameraObservable.add((cam) => {
      if (cam === camera) this.copyRegion();
    });
    this.camera = camera;
  }

  show(canvas) {
    if (!canvas) return;
    if (!this.camera) this.create();
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.main = this.s.activeCamera;
  }

  hide() {
    this.setDrawing(false);
    this.canvas = null;
    this.context = null;
  }

  update(root, idle, skip) {
    if (!this.canvas) return;
    if (root && idle) this.ensureDouble(root, idle, skip);
    const ready = Boolean(this.double && this.main && this.measure());
    this.setDrawing(ready);
    if (!ready) return;
    const p = root.position;
    const body = this.double.root;
    body.position.copyFrom(p);
    body.rotation.y = 0;
    const distance = (FRAME_HEIGHT / 2) / Math.tan(FOV / 2);
    this.camera.position.set(p.x, p.y + LOOK_HEIGHT, p.z + distance);
    this.camera.setTarget(this.look.set(p.x, p.y + LOOK_HEIGHT, p.z));
  }

  ensureDouble(root, idle, skip) {
    const signature = root.getChildMeshes(false).length;
    const current = this.double;
    if (current && current.source === root && current.signature === signature && current.idle === idle) return;
    this.disposeDouble();
    const nodes = new Map();
    const body = root.instantiateHierarchy(null, { doNotInstantiate: true }, (source, copy) => nodes.set(source, copy));
    if (!body) return;
    if (skip && nodes.has(skip)) nodes.get(skip).dispose(false, false);
    const skeletons = new Map();
    const meshes = body.getChildMeshes(false);
    for (const mesh of meshes) {
      mesh.layerMask = PORTRAIT_LAYER;
      mesh.isPickable = false;
      mesh.receiveShadows = false;
      mesh.alwaysSelectAsActiveMesh = true;
      const skeleton = mesh.skeleton;
      if (!skeleton) continue;
      if (!skeletons.has(skeleton)) skeletons.set(skeleton, this.copySkeleton(skeleton, nodes));
      mesh.skeleton = skeletons.get(skeleton);
    }
    const group = new AnimationGroup('portraitIdle', this.s);
    for (const { animation, target } of idle.targetedAnimations) {
      const copy = nodes.get(target);
      if (copy) group.addTargetedAnimation(animation, copy);
    }
    this.candidates.data = meshes;
    this.candidates.length = meshes.length;
    this.double = { root: body, source: root, signature, idle, group, skeletons: [...skeletons.values()] };
    body.setEnabled(this.drawing);
    if (this.drawing) this.startIdle();
  }

  copySkeleton(skeleton, nodes) {
    const copy = skeleton.clone(`${skeleton.name}_portrait`);
    skeleton.bones.forEach((bone, index) => {
      const node = bone.getTransformNode();
      const target = node ? nodes.get(node) : null;
      if (target) copy.bones[index].linkTransformNode(target);
    });
    return copy;
  }

  startIdle() {
    const { group, idle } = this.double;
    group.start(true, idle.speedRatio, idle.from, idle.to);
  }

  disposeDouble() {
    const current = this.double;
    if (!current) return;
    current.group.dispose();
    current.root.dispose(false, false);
    for (const skeleton of current.skeletons) skeleton.dispose();
    this.double = null;
    this.candidates.data = [];
    this.candidates.length = 0;
  }

  measure() {
    const engine = this.s.getEngine();
    const view = engine.getRenderingCanvas().getBoundingClientRect();
    const box = this.canvas.getBoundingClientRect();
    if (box.width < 2 || box.height < 2 || view.width < 2 || view.height < 2) return false;
    const width = engine.getRenderWidth();
    const height = engine.getRenderHeight();
    const toX = width / view.width;
    const toY = height / view.height;
    const x = Math.round((box.left - view.left) * toX);
    const y = Math.round((box.top - view.top) * toY);
    if (x < 0 || y < 0) return false;
    const scale = Math.min(SUPERSAMPLE, (width - x) / (box.width * toX), (height - y) / (box.height * toY));
    if (scale < MIN_SCALE) return false;
    const region = this.region;
    region.x = x;
    region.y = y;
    region.w = Math.max(1, Math.round(box.width * toX * scale));
    region.h = Math.max(1, Math.round(box.height * toY * scale));
    const viewport = this.camera.viewport;
    viewport.x = x / width;
    viewport.y = (height - y - region.h) / height;
    viewport.width = region.w / width;
    viewport.height = region.h / height;
    const ratio = window.devicePixelRatio || 1;
    const canvasWidth = Math.round(box.width * ratio);
    const canvasHeight = Math.round(box.height * ratio);
    if (this.canvas.width !== canvasWidth) this.canvas.width = canvasWidth;
    if (this.canvas.height !== canvasHeight) this.canvas.height = canvasHeight;
    return true;
  }

  setDrawing(on) {
    if (on === this.drawing) return;
    this.drawing = on;
    if (this.double) {
      this.double.root.setEnabled(on);
      if (on) this.startIdle();
      else this.double.group.stop();
    }
    if (on) {
      if (!this.baseCandidates) this.baseCandidates = this.s.getActiveMeshCandidates;
      const base = this.baseCandidates;
      this.s.getActiveMeshCandidates = () => (this.s.activeCamera === this.camera ? this.candidates : base());
      this.s.activeCameras = [this.main, this.camera];
      return;
    }
    this.s.activeCameras = [];
    if (this.baseCandidates) this.s.getActiveMeshCandidates = this.baseCandidates;
    if (this.main) this.s.activeCamera = this.main;
    if (this.context) this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  clearRegion() {
    const engine = this.s.getEngine();
    const { x, y, w, h } = this.region;
    engine.scissorClear(x, engine.getRenderHeight() - y - h, w, h, TRANSPARENT);
  }

  copyRegion() {
    if (this.main) this.s.activeCamera = this.main;
    const ctx = this.context;
    if (!ctx) return;
    const { x, y, w, h } = this.region;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.s.getEngine().getRenderingCanvas(), x, y, w, h, 0, 0, this.canvas.width, this.canvas.height);
  }
}
