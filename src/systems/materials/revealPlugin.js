// Rentgen v materiálech — přidá běžným materiálům mizení a ztmavení z revealGlsl.js.
// Terén nad podlahou patra zmizí stejně ve hře i v editoru, venku zůstane jen osvětlené okolí vchodu; modely mizí, pokud nepatří hráči nebo tvorům v jeho patře.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER, revealBlock, sightRiseByHeight, sightPointOf } from '../../utils/revealGlsl.js';

const REVEAL_RULES = { above: 'REVEAL_ABOVE', hide: 'REVEAL_HIDE', keep: 'REVEAL_KEEP', inside: 'REVEAL_INSIDE', restore: 'REVEAL_RESTORE', column: 'REVEAL_COLUMN', far: 'REVEAL_FAR', sight: 'REVEAL_SIGHT', sightHide: 'REVEAL_SIGHT_HIDE', rise: 'REVEAL_RISE', point: 'REVEAL_POINT', surface: 'REVEAL_SURFACE', cameraCut: 'REVEAL_CAMERA_CUT' };
const REVEAL_CODE_STANDARD = revealBlock('color', 'vPositionW', REVEAL_RULES, '(baseColor.rgb * vDiffuseColor.rgb)', 'normalW');
const REVEAL_CODE_PBR = revealBlock('finalColor', 'vPositionW', REVEAL_RULES);
const KEEP_UNIFORM = 'revealKeep';
const CREATURE_UNIFORM = 'revealCreature';
const CAMERA_SIDE = 'revealCaveAhead(vPositionW, vEyePosition.xyz)';
const BASE_VARYING = 'vRevealBase';
const NEAR_WALL = `revealRockBehind(${BASE_VARYING}, vEyePosition.xyz)`;
const RISE_BY_HEIGHT = sightRiseByHeight('vPositionW');
const POINT_BY_HEIGHT = sightPointOf('vPositionW');
const SUN_THROUGH_DOOR = `
float revealSunOpen = 1.0;
if (REVEAL_INSIDE > 0.5) {
  vec4 revealSunOwn;
  vec4 revealSunSample = revealSampleAt(vPositionW, revealSunOwn);
  revealSunOpen = revealDoorGlow(revealSunOwn, revealSunSample.y);
}
`;
const SUN_LIGHT_POINT = '!#define CUSTOM_LIGHT((\\d+))_COLOR';
const SUN_LIGHT_GATE = '#ifdef DIRLIGHT$1\ndiffuse$2.rgb *= revealSunOpen;\n#endif\n';
const DEFAULT_DEFINES = { REVEAL_ABOVE: '0.0', REVEAL_HIDE: '0.0', REVEAL_KEEP: '1.0', REVEAL_INSIDE: '0.0', REVEAL_RESTORE: '0.0', REVEAL_COLUMN: '0.0', REVEAL_FAR: '0.0', REVEAL_SIGHT: '1.0', REVEAL_SIGHT_HIDE: '0.0', REVEAL_RISE: '0.0',REVEAL_POINT: 'vPositionW', REVEAL_SURFACE: '1.0', REVEAL_CAMERA_CUT: '0.0' };
const DEFINE_FALLBACKS = Object.entries(DEFAULT_DEFINES).map(([name, value]) => `#ifndef ${name}\n#define ${name} ${value}\n#endif`).join('\n');
const KIND_DEFINES = {
  cave: { above: '1.0', hide: '0.0', keep: '1.0', inside: '1.0', restore: '0.0', far: '1.0', surface: '0.0' },
  caveRing: { above: '1.0', hide: '0.0', keep: '1.0', inside: '1.0', restore: '0.0', far: '1.0', surface: '0.0', sight: '0.0', cameraCut: CAMERA_SIDE },
  caveDress: { above: '1.0', hide: '0.0', keep: '1.0', inside: '1.0', restore: '0.0', far: '1.0', surface: '0.0', cameraCut: NEAR_WALL },
  ceiling: { above: '1.0', hide: '1.0', keep: '1.0', inside: '0.0', restore: '0.0', surface: '0.0' },
  terrain: { above: '0.0', hide: KEEP_UNIFORM, keep: '0.0', inside: '0.0', restore: '0.0', column: '1.0' },
  backdrop: { above: '0.0', hide: '0.0', keep: '1.0', inside: '0.0', restore: '0.0', sight: '0.0' },
  frame: { above: '0.0', hide: '0.0', keep: '0.55', inside: '0.0', restore: '0.0' },
  overlay: { above: '1.0', hide: '0.0', keep: '1.0', inside: '0.0', restore: '0.0', sight: '0.0' },
  model: { above: '1.0', hide: `(1.0 - ${KEEP_UNIFORM})`, keep: KEEP_UNIFORM, inside: '0.0', restore: '1.0', sightHide: `mix(${CREATURE_UNIFORM}, 1.0, revealSightDepth.w)`, rise: sightRiseByHeight(BASE_VARYING, '1.0'), point: sightPointOf(BASE_VARYING, '1.0') },
};

export default class RevealPlugin extends MaterialPluginBase {

  constructor(material, state, kind) {
    super(material, 'Reveal', 950, { ...DEFAULT_DEFINES, REVEAL_SET: 'none' }, true, false);
    this.doNotSerialize = true;
    this.registerForExtraEvents = true;
    this.state = state;
    this.kind = kind;
    this._enable(true);
  }

  getClassName() {
    return 'RevealPlugin';
  }

  prepareDefines(defines) {
    const kind = KIND_DEFINES[this.kind];
    defines.REVEAL_ABOVE = kind.above;
    defines.REVEAL_HIDE = kind.hide;
    defines.REVEAL_KEEP = kind.keep;
    defines.REVEAL_INSIDE = kind.inside;
    defines.REVEAL_RESTORE = kind.restore;
    defines.REVEAL_COLUMN = kind.column || '0.0';
    defines.REVEAL_FAR = kind.far || '0.0';
    defines.REVEAL_SIGHT = kind.sight || '1.0';
    defines.REVEAL_SIGHT_HIDE = kind.sightHide || '0.0';
    defines.REVEAL_RISE = kind.rise || RISE_BY_HEIGHT;
    defines.REVEAL_POINT = kind.point || POINT_BY_HEIGHT;
    defines.REVEAL_SURFACE = kind.surface || '1.0';
    defines.REVEAL_CAMERA_CUT = kind.cameraCut || '0.0';
    defines.REVEAL_SET = this._material.pluginManager._plugins.map((plugin) => plugin.name).join('_');
  }

  getSamplers(samplers) {
    samplers.push(REVEAL_SAMPLER, REVEAL_SIGHT_SAMPLER);
  }

  getUniforms() {
    return { externalUniforms: [...REVEAL_UNIFORM_NAMES, KEEP_UNIFORM, CREATURE_UNIFORM] };
  }

  hardBindForSubMesh(ubo, scene, engine, subMesh) {
    const effect = subMesh.effect;
    if (!effect) return;
    const { center, amount, cut, sightFade, floor, kept, map, mapMin, light, sightMap, sightEye, sightDepth, sightFog } = this.state;
    effect.setVector3('revealCenter', center);
    effect.setFloat4('revealParams', amount, cut, sightFade, floor);
    effect.setTexture(REVEAL_SAMPLER, map);
    effect.setVector4('revealMapMin', mapMin);
    effect.setVector3('revealLight', light);
    effect.setTexture(REVEAL_SIGHT_SAMPLER, sightMap);
    effect.setVector4('revealSightEye', sightEye);
    effect.setVector4('revealSightDepth', sightDepth);
    effect.setColor3('revealSightFog', sightFog);
    effect.setFloat(KEEP_UNIFORM, kept.has(subMesh.getMesh()) ? 1 : 0);
    effect.setFloat(CREATURE_UNIFORM, this.state.creatures.has(subMesh.getMesh()) ? 1 : 0);
  }

  getCustomCode(shaderType) {
    if (shaderType === 'vertex') {
      return {
        CUSTOM_VERTEX_DEFINITIONS: `varying vec3 ${BASE_VARYING};`,
        CUSTOM_VERTEX_MAIN_END: `#ifdef INSTANCES
${BASE_VARYING} = (finalWorld * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#else
${BASE_VARYING} = (world * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
#endif`,
      };
    }
    if (shaderType !== 'fragment') return null;
    const definitions = `${DEFINE_FALLBACKS}\n${REVEAL_UNIFORMS}\nuniform float ${KEEP_UNIFORM};
uniform float ${CREATURE_UNIFORM};
varying vec3 ${BASE_VARYING};`;
    if (this._material.getClassName() !== 'StandardMaterial') {
      return { CUSTOM_FRAGMENT_DEFINITIONS: definitions, CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: REVEAL_CODE_PBR };
    }
    return {
      CUSTOM_FRAGMENT_DEFINITIONS: definitions,
      CUSTOM_FRAGMENT_BEFORE_LIGHTS: SUN_THROUGH_DOOR,
      [SUN_LIGHT_POINT]: SUN_LIGHT_GATE,
      CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: REVEAL_CODE_STANDARD,
    };
  }
}
