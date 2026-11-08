// Světla a stíny světa — slunce s oblohou, mlha, světlo jeskyně a seznam věcí, které vrhají stín.
// Denní dobu neřídí (to dělá den a noc); co je kolem kamery a které plochy jsou jeskyně, mu řekne scéna.
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

const SHADOW_FRUSTUM = 70;
const SHADOW_MIN_Z = 1;
const SHADOW_MAX_Z = 180;
const SHADOW_REACH_MARGIN = 20;

function sameMeshes(first, second) {
  if (first.length !== second.length) return false;
  for (let i = 0; i < first.length; i += 1) if (first[i] !== second[i]) return false;
  return true;
}

export default class LightingSystem {

  constructor(scene) {
    this.s = scene;
    this.sunLight = null;
    this.skyLight = null;
    this.caveLight = null;
    this.shadowGenerator = null;
    this.casters = [];
  }

  create(light, camera) {
    const hemi = new HemisphericLight('skyLight', new Vector3(0.3, 1, 0.2), this.s);
    hemi.intensity = light.hemiIntensity;
    hemi.groundColor = new Color3(light.hemiGround[0], light.hemiGround[1], light.hemiGround[2]);

    const dir = new DirectionalLight('sunLight', new Vector3(light.sunDirection[0], light.sunDirection[1], light.sunDirection[2]), this.s);
    dir.position = new Vector3(light.sunPosition[0], light.sunPosition[1], light.sunPosition[2]);
    dir.intensity = light.sunIntensity;
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
    this.sunLight = dir;
    this.skyLight = hemi;
    return { sun: dir, sky: hemi };
  }

  createFog(fog) {
    if (!fog) return null;
    this.s.fogMode = Scene.FOGMODE_LINEAR;
    this.s.fogStart = fog.start;
    this.s.fogEnd = fog.end;
    this.s.fogColor = new Color3(fog.color[0], fog.color[1], fog.color[2]);
    return this.s.fogColor;
  }

  setCaveMeshes(cave) {
    if (!this.sunLight) return;
    this.sunLight.excludedMeshes = cave;
    if (this.skyLight) this.skyLight.excludedMeshes = cave;
    if (!this.caveLight) {
      const light = new HemisphericLight('caveLight', new Vector3(0.45, 1, 0.3), this.s);
      light.groundColor = new Color3(0.02, 0.02, 0.03);
      light.diffuse = new Color3(0.2, 0.19, 0.17);
      light.specular = new Color3(0, 0, 0);
      light.intensity = 1;
      this.caveLight = light;
    }
    this.caveLight.includedOnlyMeshes = cave;
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
      surface.receiveShadows = !(surface.metadata && surface.metadata.level < 0);
      if (surface.metadata && surface.metadata.shadowAlways) this.addCaster(surface, shadows);
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
    this.shadowGenerator.filteringQuality = soft ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
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
        const point = mesh.getAbsolutePosition();
        if (Math.hypot(point.x - centerX, point.z - centerZ) > reach) continue;
      }
      next.push(mesh);
    }
    if (!force && sameMeshes(next, shadowMap.renderList || [])) return;
    shadowMap.renderList = next;
  }
}
