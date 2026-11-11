// Dohled postavy — jak daleko postava dohlédne (z vyvýšeného místa dál) a kam v každém směru, než pohled zastaví skála.
// Drží jen tuto mapu a její čísla; kde jsou oči, jak vysoko je zem a která skála překáží, mu řekne scéna.
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import { bothSidesMaterial } from '../../utils/bothSidesMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

const MAP_RANGE = 24;
const UNDERGROUND_RANGE = 14;
const OUTDOOR_RANGE = 22;
const SIGHT_NEAR = 0.05;
const MAP_SIZES = { simple: 256, full: 512 };
const REDRAW_STEP = 0.01;
const BLOCKER_STEP = 2;
const NO_MESH_LAYER = 0x10000000;
const UNDERGROUND_FADE_SECONDS = 0.4;
const LOOKOUT_RADIUS = 12;
const LOOKOUT_SAMPLES = 12;
const LOOKOUT_STEP_SECONDS = 0.5;
const LOOKOUT_RANGE_PER_METER = 2;
const LOOKOUT_RANGE_MAX = 10;
const LOOKOUT_CHANGE_PER_SECOND = 6;

export default class SightSystem {

  constructor(scene) {
    this.s = scene;
    this.eye = new Vector3(0, 0, 0);
    this.drawnAt = null;
    this.blockersAt = null;
    this.blockers = [];
    this.active = false;
    this.mapping = false;
    this.underground = 0;
    this.range = OUTDOOR_RANGE;
    this.lookout = 0;
    this.lookoutGoal = 0;
    this.lookoutClock = LOOKOUT_STEP_SECONDS;
    this.groundHeightAt = null;
    this.light = new PointLight('sightEye', new Vector3(0, 0, 0), scene);
    this.light.intensity = 0;
    this.light.diffuse = Color3.Black();
    this.light.specular = Color3.Black();
    this.light.includeOnlyWithLayerMask = NO_MESH_LAYER;
    this.light.shadowMinZ = SIGHT_NEAR;
    this.light.shadowMaxZ = MAP_RANGE;
    this.light.shadowEnabled = false;
    this.generator = new ShadowGenerator(MAP_SIZES.full, this.light);
    this.generator.bias = 0;
    this.map = this.generator.getShadowMap();
    this.map.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.map.renderList = [];
    this.bothSides = bothSidesMaterial(scene);
  }

  setDetail(level) {
    const size = MAP_SIZES[level] || MAP_SIZES.full;
    if (this.generator.mapSize !== size) {
      this.generator.mapSize = size;
      this.map = this.generator.getShadowMap();
      this.map.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
      this.blockersAt = null;
    }
    this.drawnAt = null;
  }

  setBlockers(meshes) {
    this.blockers = (meshes || []).filter((mesh) => mesh && mesh.metadata && mesh.metadata.volume);
    this.blockersAt = null;
    this.drawnAt = null;
  }

  update(dt, eye, underground) {
    const step = Math.max(0, dt) / UNDERGROUND_FADE_SECONDS;
    const goal = underground ? 1 : 0;
    this.underground = goal > this.underground ? Math.min(goal, this.underground + step) : Math.max(goal, this.underground - step);
    this.active = Boolean(eye);
    this.lookoutClock += Math.max(0, dt);
    if (this.active && this.lookoutClock >= LOOKOUT_STEP_SECONDS) {
      this.lookoutClock = 0;
      this.lookoutGoal = this.lookoutAt(eye);
    }
    const change = LOOKOUT_CHANGE_PER_SECOND * Math.max(0, dt);
    this.lookout = this.lookoutGoal > this.lookout ? Math.min(this.lookoutGoal, this.lookout + change) : Math.max(this.lookoutGoal, this.lookout - change);
    const outdoor = OUTDOOR_RANGE + this.lookout;
    this.range = outdoor + (UNDERGROUND_RANGE - outdoor) * this.underground;
    const mapping = this.active;
    if (mapping !== this.mapping) {
      this.mapping = mapping;
      this.light.shadowEnabled = mapping;
      this.drawnAt = null;
    }
    if (!this.active) return;
    this.eye.set(eye.x, eye.y, eye.z);
    if (!mapping) return;
    if (!this.blockersAt || Vector3.Distance(this.blockersAt, this.eye) > BLOCKER_STEP) this.fitBlockers();
    if (this.drawnAt && Vector3.Distance(this.drawnAt, this.eye) <= REDRAW_STEP) return;
    this.drawnAt = this.eye.clone();
    this.light.position.copyFrom(this.eye);
    this.map.resetRefreshCounter();
  }

  lookoutAt(eye) {
    if (!this.groundHeightAt) return 0;
    const feet = this.groundHeightAt(eye.x, eye.z);
    if (!Number.isFinite(feet)) return 0;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < LOOKOUT_SAMPLES; i += 1) {
      const angle = (i / LOOKOUT_SAMPLES) * Math.PI * 2;
      const height = this.groundHeightAt(eye.x + Math.cos(angle) * LOOKOUT_RADIUS, eye.z + Math.sin(angle) * LOOKOUT_RADIUS);
      if (!Number.isFinite(height)) continue;
      sum += height;
      count += 1;
    }
    if (!count) return 0;
    const above = feet - sum / count;
    return Math.max(0, Math.min(LOOKOUT_RANGE_MAX, above * LOOKOUT_RANGE_PER_METER));
  }

  fitBlockers() {
    this.blockersAt = this.eye.clone();
    const near = [];
    for (const mesh of this.blockers) {
      if (mesh.isDisposed()) continue;
      mesh.computeWorldMatrix(true);
      const { centerWorld, radiusWorld } = mesh.getBoundingInfo().boundingSphere;
      if (Vector3.Distance(centerWorld, this.eye) <= MAP_RANGE + BLOCKER_STEP + radiusWorld) near.push(mesh);
    }
    for (const mesh of near) this.map.setMaterialForRendering(mesh, this.bothSides);
    this.map.renderList = near;
    this.drawnAt = null;
  }

  view() {
    return {
      active: this.active,
      map: this.map,
      eye: this.eye,
      hide: this.underground,
      near: SIGHT_NEAR,
      mapRange: MAP_RANGE,
      range: this.range,
      packed: this.map.textureType === 0,
    };
  }
}
