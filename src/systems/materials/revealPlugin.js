// Rentgen v materiálech — přidá běžným materiálům mizení a ztmavení z revealGlsl.js.
// Terén nad podlahou patra zmizí stejně ve hře i v editoru, venku zůstane jen osvětlené okolí vchodu; modely mizí, pokud nepatří hráči nebo tvorům v jeho patře.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';
import { REVEAL_UNIFORMS, REVEAL_UNIFORM_NAMES, REVEAL_SAMPLER, revealBlock } from '../../utils/revealGlsl.js';

const REVEAL_RULES = { above: 'REVEAL_ABOVE', hide: 'REVEAL_HIDE', keep: 'REVEAL_KEEP', inside: 'REVEAL_INSIDE', restore: 'REVEAL_RESTORE', column: 'REVEAL_COLUMN', floorGlow: 'REVEAL_FLOOR_GLOW', far: 'REVEAL_FAR' };
const REVEAL_CODE_STANDARD = revealBlock('color', 'vPositionW', REVEAL_RULES, 'baseColor');
const REVEAL_CODE_PBR = revealBlock('finalColor', 'vPositionW', REVEAL_RULES);
const KEEP_UNIFORM = 'revealKeep';
const DEFAULT_DEFINES = { REVEAL_ABOVE: '0.0', REVEAL_HIDE: '0.0', REVEAL_KEEP: '1.0', REVEAL_INSIDE: '0.0', REVEAL_RESTORE: '0.0', REVEAL_COLUMN: '0.0', REVEAL_FLOOR_GLOW: '0.0', REVEAL_FAR: '0.0' };
const DEFINE_FALLBACKS = Object.entries(DEFAULT_DEFINES).map(([name, value]) => `#ifndef ${name}\n#define ${name} ${value}\n#endif`).join('\n');
const KIND_DEFINES = {
  cave: { above: '1.0', hide: '0.0', keep: '1.0', inside: '1.0', restore: '0.0', far: '1.0' },
  caveFloor: { above: '1.0', hide: '0.0', keep: '1.0', inside: '1.0', restore: '0.0', floorGlow: '1.0', far: '1.0' },
  ceiling: { above: '1.0', hide: '1.0', keep: '1.0', inside: '0.0', restore: '0.0' },
  terrain: { above: '0.0', hide: KEEP_UNIFORM, keep: '0.0', inside: '0.0', restore: '0.0', column: '1.0' },
  backdrop: { above: '0.0', hide: '0.0', keep: '1.0', inside: '0.0', restore: '0.0' },
  frame: { above: '0.0', hide: '0.0', keep: '0.55', inside: '0.0', restore: '0.0' },
  overlay: { above: '1.0', hide: '0.0', keep: '1.0', inside: '0.0', restore: '0.0' },
  model: { above: '1.0', hide: `(1.0 - ${KEEP_UNIFORM})`, keep: KEEP_UNIFORM, inside: '0.0', restore: '1.0' },
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
    defines.REVEAL_FLOOR_GLOW = kind.floorGlow || '0.0';
    defines.REVEAL_FAR = kind.far || '0.0';
    defines.REVEAL_SET = this._material.pluginManager._plugins.map((plugin) => plugin.name).join('_');
  }

  getSamplers(samplers) {
    samplers.push(REVEAL_SAMPLER);
  }

  getUniforms() {
    return { externalUniforms: [...REVEAL_UNIFORM_NAMES, KEEP_UNIFORM] };
  }

  hardBindForSubMesh(ubo, scene, engine, subMesh) {
    const effect = subMesh.effect;
    if (!effect) return;
    const { center, amount, cut, sightFade, floor, kept, map, mapMin, light } = this.state;
    effect.setVector3('revealCenter', center);
    effect.setFloat4('revealParams', amount, cut, sightFade, floor);
    effect.setTexture(REVEAL_SAMPLER, map);
    effect.setVector4('revealMapMin', mapMin);
    effect.setVector3('revealLight', light);
    effect.setFloat(KEEP_UNIFORM, kept.has(subMesh.getMesh()) ? 1 : 0);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'fragment') return null;
    const code = this._material.getClassName() === 'StandardMaterial' ? REVEAL_CODE_STANDARD : REVEAL_CODE_PBR;
    return { CUSTOM_FRAGMENT_DEFINITIONS: `${DEFINE_FALLBACKS}\n${REVEAL_UNIFORMS}\nuniform float ${KEEP_UNIFORM};`, CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: code };
  }
}
