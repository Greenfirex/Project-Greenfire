// Fotoateliér tvorů: prázdná scéna jen s jedním tvorem a rovnou zemí, bez zbytku hry.
// Otevírá ho tools/capture.cjs v neviditelném prohlížeči; tvora hýbe stejnou animací jako hra
// a ke každému snímku změří, kde je nejnižší bod těla vůči zemi.
import '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Materials/PBR/pbrMaterial';
import '@babylonjs/core/Materials/Textures/texture';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { loadContainer } from '../../src/utils/assetLoader.js';
import {
  getCreatureType, getCreatureTier, creatureLength, creatureScale,
} from '../../src/data/catalogs/creatures/index.js';

const TICK = 1 / 120;
const FRONT_SHARE = 0.25;
const VIEWS = {
  side: { alpha: 0, beta: Math.PI / 2 },
  front: { alpha: Math.PI / 2, beta: Math.PI / 2 },
  diag: { alpha: Math.PI / 4, beta: Math.PI / 3 },
  top: { alpha: 0, beta: 0.01 },
};

const canvas = document.getElementById('stage');
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.55, 0.6, 0.65, 1);
const sky = new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
sky.intensity = 0.9;
sky.groundColor = new Color3(0.35, 0.33, 0.3);
const sun = new DirectionalLight('sun', new Vector3(-0.4, -1, 0.3), scene);
sun.intensity = 1.4;
const camera = new ArcRotateCamera('camera', 0, Math.PI / 2, 20, Vector3.Zero(), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.minZ = 0.1;
camera.maxZ = 100;
const ground = CreateGround('ground', { width: 8, height: 8 }, scene);
const groundMaterial = new StandardMaterial('groundMat', scene);
groundMaterial.diffuseColor = new Color3(0.24, 0.22, 0.18);
groundMaterial.specularColor = new Color3(0, 0, 0);
ground.material = groundMaterial;

function placeModel(type, tier, container) {
  const instance = container.instantiateModelsToScene((name) => name, false);
  const solid = [];
  for (const node of instance.rootNodes) {
    if (node.getChildMeshes) solid.push(...node.getChildMeshes().filter((mesh) => mesh.getTotalVertices() > 0));
  }
  const root = instance.rootNodes.find((node) => node.getChildMeshes().length) || instance.rootNodes[0];
  const bounds = root.getHierarchyBoundingVectors(true);
  const spanZ = Math.max(0.001, bounds.max.z - bounds.min.z);
  const scale = (creatureLength(type) / spanZ) * creatureScale(type, tier);
  const holder = new TransformNode('holder', scene);
  root.parent = holder;
  root.scaling.set(scale, scale, scale);
  const groundOffset = Number.isFinite(type.groundOffset) ? type.groundOffset : 0;
  root.position.set(
    -((bounds.min.x + bounds.max.x) / 2) * scale,
    -(bounds.min.y + groundOffset) * scale,
    -((bounds.min.z + bounds.max.z) / 2) * scale,
  );
  holder.rotation.y = type.yawOffset || 0;
  const skeleton = instance.skeletons && instance.skeletons[0] ? instance.skeletons[0] : null;
  const rig = type.rig ? type.rig.build(solid[0], skeleton) : null;
  return {
    holder,
    body: solid.reduce((best, mesh) => (mesh.getTotalVertices() > best.getTotalVertices() ? mesh : best)),
    rig,
    height: (bounds.max.y - bounds.min.y) * scale,
    length: spanZ * scale,
  };
}

function lowestPoints(mesh, frontFrom) {
  const data = mesh.getPositionData(true, true);
  if (!data) return { all: null, front: null };
  const world = mesh.getWorldMatrix();
  const point = new Vector3();
  let all = null;
  let front = null;
  for (let index = 0; index < data.length; index += 3) {
    Vector3.TransformCoordinatesFromFloatsToRef(data[index], data[index + 1], data[index + 2], world, point);
    if (!all || point.y < all.y) all = point.clone();
    if (point.z > frontFrom && (!front || point.y < front.y)) front = point.clone();
  }
  return { all, front };
}

function rounded(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function timeline(type, rig, options) {
  const scenario = options.scene;
  const idle = { mode: 'idle', moving: false, engaged: false };
  if (scenario === 'walk') {
    const speed = type.walkSpeed * 0.6;
    return { seconds: options.seconds || 1.2, info: () => ({ mode: 'roam', moving: true, moved: speed * TICK }) };
  }
  if (scenario === 'attack') {
    const windup = type.biteWindup || 0.35;
    const recover = type.biteRecover || 0.5;
    return {
      seconds: options.seconds || windup + recover,
      info: (time) => ({ mode: time < windup ? 'windup' : 'recover', moving: false, engaged: true }),
      after: (time) => {
        if (options.attack && time < TICK * 1.5 && rig && 'attack' in rig) rig.attack = options.attack;
      },
    };
  }
  if (scenario === 'hit') {
    return { seconds: options.seconds || 0.6, info: (time) => ({ ...idle, hit: time < TICK }) };
  }
  if (scenario === 'death') {
    return { seconds: options.seconds || 3, info: () => ({ mode: 'dead', moving: false }) };
  }
  return { seconds: options.seconds || 3, info: () => idle };
}

function waitForPeck(type, rig) {
  if (!rig || !rig.idleAction) return 'tvor nemá klidové akce';
  const idle = { mode: 'idle', moving: false, engaged: false };
  for (let guard = 0; guard < 120000; guard += 1) {
    if (rig.idleAction.kind === 'peck' && rig.idleAction.time < TICK) return null;
    type.rig.pose(rig, TICK, idle);
  }
  return 'tvor nezačal zobat';
}

function shotTimes(rig, options, seconds) {
  if (options.scene === 'peck') {
    const taps = rig.idleAction.taps || [];
    const first = taps.length ? taps[0] : 0.5;
    const last = taps.length ? taps[taps.length - 1] : rig.idleAction.duration;
    const around = taps.flatMap((tap) => [tap, tap + 0.04, tap + 0.08]);
    return [first - 0.3, first - 0.08, ...around, last + 0.2]
      .filter((time) => time >= 0)
      .sort((a, b) => a - b)
      .map((time) => ({ time, label: taps.includes(time) ? 'ťuk' : '' }));
  }
  const count = Math.max(1, options.frames || 8);
  return Array.from({ length: count }, (_, index) => ({ time: (seconds * index) / Math.max(1, count - 1), label: '' }));
}

function aimCamera(model, options) {
  const view = VIEWS[options.view] || VIEWS.side;
  camera.alpha = view.alpha;
  camera.beta = view.beta;
  camera.radius = 20;
  camera.target.set(0, model.height * 0.5, 0);
  const zoom = options.zoom || Math.max(model.length, model.height) * 1.5;
  const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
  camera.orthoTop = zoom / 2;
  camera.orthoBottom = -zoom / 2;
  camera.orthoLeft = (-zoom / 2) * aspect;
  camera.orthoRight = (zoom / 2) * aspect;
}

function groundLine() {
  const width = engine.getRenderWidth();
  const height = engine.getRenderHeight();
  const point = Vector3.Project(
    new Vector3(0, 0, 0),
    Matrix.Identity(),
    scene.getTransformMatrix(),
    camera.viewport.toGlobal(width, height),
  );
  return point.y / height;
}

async function run(options) {
  const type = getCreatureType(options.kind);
  if (!type) return { error: `neznámý tvor: ${options.kind}` };
  const tier = getCreatureTier(type, options.tier);
  const container = await loadContainer(scene, type.model);
  if (!container) return { error: `model se nenačetl: ${type.model}` };
  const model = placeModel(type, tier, container);
  const { rig } = model;
  if (!rig) return { error: 'tvor nemá rig' };
  aimCamera(model, options);
  await scene.whenReadyAsync();
  scene.render();
  if (options.scene === 'peck') {
    const problem = waitForPeck(type, rig);
    if (problem) return { error: problem };
  }
  const plan = timeline(type, rig, options);
  const shots = shotTimes(rig, options, plan.seconds);
  const frames = [];
  let clock = 0;
  const stepTo = (time) => {
    while (clock + TICK <= time + 1e-9) {
      const posed = type.rig.pose(rig, TICK, plan.info(clock));
      if (plan.after) plan.after(clock);
      clock += TICK;
      model.holder.position.y = posed && Number.isFinite(posed.bob) ? posed.bob : 0;
    }
  };
  for (const shot of shots) {
    if (options.scene === 'peck') {
      while (rig.idleAction.time + TICK <= shot.time + 1e-9) {
        const posed = type.rig.pose(rig, TICK, { mode: 'idle', moving: false, engaged: false });
        model.holder.position.y = posed && Number.isFinite(posed.bob) ? posed.bob : 0;
      }
    } else {
      stepTo(shot.time);
    }
    scene.render();
    const low = lowestPoints(model.body, model.length * FRONT_SHARE);
    frames.push({
      time: Number(shot.time.toFixed(2)),
      label: shot.label,
      lowest: rounded(low.all && low.all.y, 3),
      lowestAt: rounded(low.all && low.all.z, 2),
      front: rounded(low.front && low.front.y, 3),
      image: canvas.toDataURL('image/png'),
    });
  }
  return {
    creature: `${options.kind}-${options.tier || type.defaultTier}`,
    length: Number(model.length.toFixed(2)),
    height: Number(model.height.toFixed(2)),
    groundLine: options.view === 'side' || options.view === 'front' ? groundLine() : null,
    frames,
  };
}

window.stage = { ready: true, run };
