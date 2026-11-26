// Světla a stíny světa — slunce s oblohou, mlha a seznam věcí, které vrhají stín.
// Jeskyně nemá vlastní světlo; slunce a obloha do ní pronikají vchodem (tlumí je rentgen v materiálech).
// Denní dobu neřídí (to dělá den a noc); co je kolem kamery, mu řekne scéna.
import '@babylonjs/core/Lights/hemisphericLight';
import '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';
import { bothSidesMaterial } from '../../utils/bothSidesMaterial.js';
import { newMaterialsOf } from '../../utils/newMaterials.js';

const SHADOW_FRUSTUM = 70;
const SHADOW_MIN_Z = 1;
const SHADOW_MAX_Z = 180;
const SHADOW_REACH_MARGIN = 20;
const SIMPLE_SHADOW_SIZE = 1024;
const DAYLIGHT_PRIORITY = 1;

function sameMeshes(first, second) {
  if (first.length !== second.length) return false;
  for (let i = 0; i < first.length; i += 1) if (first[i] !== second[i]) return false;
  return true;
}

function casterPlace(mesh) {
  if (!mesh.metadata || !mesh.metadata.shadowChunk) {
    const point = mesh.getAbsolutePosition();
    return { x: point.x, z: point.z, radius: 0 };
  }
  mesh.computeWorldMatrix();
  const sphere = mesh.getBoundingInfo().boundingSphere;
  return { x: sphere.centerWorld.x, z: sphere.centerWorld.z, radius: sphere.radiusWorld };
}

export default class LightingSystem {

  constructor(scene) {
    this.s = scene;
    this.sunLight = null;
    this.skyLight = null;
    this.shadowGenerator = null;
    this.casters = [];
    this.fullShadowSize = 0;
    this.simpleShadows = false;
    this.softShadows = false;
    this.newMaterials = newMaterialsOf(scene);
    scene.onBeforeActiveMeshesEvaluationObservable.add(() => this.fitNewMaterials());
    scene.onNewLightAddedObservable.add(() => this.fitMaterials(this.s.materials));
  }

  fitNewMaterials() {
    this.fitMaterials(this.newMaterials());
  }

  fitMaterials(materials) {
    const count = this.s.lights.length;
    for (const material of materials) {
      if ('maxSimultaneousLights' in material && material.maxSimultaneousLights < count) material.maxSimultaneousLights = count;
    }
  }

  create(light, camera) {
    this.fullShadowSize = light.shadowMapSize;
    const hemi = new HemisphericLight('skyLight', new Vector3(0.3, 1, 0.2), this.s);
    hemi.intensity = light.hemiIntensity;
    hemi.renderPriority = DAYLIGHT_PRIORITY;
    hemi.groundColor = new Color3(light.hemiGround[0], light.hemiGround[1], light.hemiGround[2]);

    const dir = new DirectionalLight('sunLight', new Vector3(light.sunDirection[0], light.sunDirection[1], light.sunDirection[2]), this.s);
    dir.position = new Vector3(light.sunPosition[0], light.sunPosition[1], light.sunPosition[2]);
    dir.intensity = light.sunIntensity;
    dir.renderPriority = DAYLIGHT_PRIORITY;
    if (light.sunColor) dir.diffuse = new Color3(light.sunColor[0], light.sunColor[1], light.sunColor[2]);
    dir.autoUpdateExtends = false;
    dir.shadowFrustumSize = SHADOW_FRUSTUM;
    dir.shadowMinZ = SHADOW_MIN_Z;
    dir.shadowMaxZ = SHADOW_MAX_Z;

    if (CascadedShadowGenerator.IsSupported) {
      const csm = new CascadedShadowGenerator(light.shadowMapSize, dir, true, camera);
      csm.numCascades = 2;
      csm.stabilizeCascades = true;
      csm.lambda = 0.8;
      csm.cascadeBlendPercentage = 0.1;
      csm.shadowMaxZ = SHADOW_MAX_Z;
      csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      this.shadowGenerator = csm;
    } else {
      this.shadowGenerator = new ShadowGenerator(light.shadowMapSize, dir);
      this.shadowGenerator.usePercentageCloserFiltering = true;
      this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    this.shadowGenerator.bias = 0.00005;
    this.shadowGenerator.normalBias = 0.002;
    this.shadowGenerator.getShadowMap().clearColor = new Color4(1, 1, 1, 1);
    this.keepRockWhole(this.shadowGenerator);
    this.sunLight = dir;
    this.skyLight = hemi;
    return { sun: dir, sky: hemi };
  }

  keepRockWhole(generator) {
    let rock = false;
    generator.onBeforeShadowMapRenderMeshObservable.add((mesh) => {
      rock = Boolean(mesh.metadata && mesh.metadata.volume);
    });
    generator.onBeforeShadowMapRenderObservable.add((effect) => {
      if (rock) effect.setFloat3('biasAndScaleSM', generator.bias, 0, generator.depthScale);
    });
  }

  createFog(fog) {
    if (!fog) return null;
    this.s.fogMode = Scene.FOGMODE_LINEAR;
    this.s.fogStart = fog.start;
    this.s.fogEnd = fog.end;
    this.s.fogColor = new Color3(fog.color[0], fog.color[1], fog.color[2]);
    return this.s.fogColor;
  }

  addCaster(mesh, shadows) {
    if (!mesh || this.casters.includes(mesh)) return;
    this.casters.push(mesh);
    if (shadows && this.shadowGenerator) this.shadowGenerator.addShadowCaster(mesh);
  }

  removeCaster(mesh) {
    const index = this.casters.indexOf(mesh);
    if (index < 0) return;
    this.casters.splice(index, 1);
    if (!this.shadowGenerator) return;
    const renderList = this.shadowGenerator.getShadowMap().renderList;
    const listIndex = renderList ? renderList.indexOf(mesh) : -1;
    if (listIndex >= 0) renderList.splice(listIndex, 1);
    this.shadowGenerator.removeShadowCaster(mesh);
  }

  syncSurfaces(surfaces, shadows) {
    this.casters = this.casters.filter((mesh) => mesh && !mesh.isDisposed());
    for (const surface of surfaces || []) {
      if (!surface) continue;
      surface.receiveShadows = true;
      if (surface.metadata && (surface.metadata.shadowAlways || surface.metadata.shadowChunk)) this.addCaster(surface, shadows);
    }
  }

  refreshDepth(camera, range, soft) {
    if (!this.shadowGenerator || !camera) return;
    if (this.shadowGenerator instanceof CascadedShadowGenerator) {
      const span = camera.maxZ - camera.minZ;
      this.shadowGenerator.shadowMaxZ = range.far;
      if (span > 0) {
        this.shadowGenerator.setMinMaxDistance(
          (range.near - camera.minZ) / span,
          (range.far - camera.minZ) / span,
        );
      }
    }
    this.softShadows = Boolean(soft);
    this.applyShadowFilter();
  }

  applyShadowFilter() {
    if (this.simpleShadows) this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_LOW;
    else this.shadowGenerator.filteringQuality = this.softShadows ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
  }

  setShadowDetail(level) {
    if (!this.shadowGenerator || level === 'off') return;
    const simple = level === 'simple';
    if (simple === this.simpleShadows) return;
    this.simpleShadows = simple;
    if (this.shadowGenerator instanceof CascadedShadowGenerator) this.shadowGenerator.numCascades = simple ? 1 : 2;
    this.shadowGenerator.mapSize = simple ? Math.min(SIMPLE_SHADOW_SIZE, this.fullShadowSize) : this.fullShadowSize;
    this.shadowGenerator.getShadowMap().clearColor = new Color4(1, 1, 1, 1);
    this.applyShadowFilter();
  }

  refreshReach(view, shadows, force = false) {
    if (!this.shadowGenerator) return;
    if (this.sunLight) this.sunLight.shadowEnabled = shadows;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (!shadows) {
      if (!force && shadowMap.renderList && !shadowMap.renderList.length) return;
      shadowMap.renderList = [];
      return;
    }
    const reach = view ? view.radius + SHADOW_REACH_MARGIN : Infinity;
    const centerX = view ? view.x : 0;
    const centerZ = view ? view.z : 0;
    const next = [];
    for (const mesh of this.casters) {
      if (!mesh || mesh.isDisposed() || !mesh.isEnabled()) continue;
      const always = mesh.metadata && mesh.metadata.shadowAlways;
      if (!always) {
        const place = casterPlace(mesh);
        if (Math.hypot(place.x - centerX, place.z - centerZ) > reach + place.radius) continue;
      }
      next.push(mesh);
    }
    if (!force && sameMeshes(next, shadowMap.renderList || [])) return;
    const bothSides = bothSidesMaterial(this.s);
    for (const mesh of next) {
      if (mesh.metadata && mesh.metadata.volume) shadowMap.setMaterialForRendering(mesh, bothSides);
    }
    shadowMap.renderList = next;
  }
}
