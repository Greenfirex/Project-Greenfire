// Vlnění ocasu ryby — ohne zadní část modelu podle času a místa, aby se hejno nehýbalo stejně.
// Funguje i pro thin instances, takže nestojí nic navíc za každou rybu.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const WIGGLE_CODE = `
  float fishTail = clamp(-positionUpdated.x * 2.0, 0.0, 1.0);
  fishTail *= fishTail;
  float fishPhase = worldPos.x * 1.7 + worldPos.z * 1.3;
  float fishSway = sin(fishTime * FISH_SPEED + fishPhase) * FISH_AMPLITUDE * fishTail;
  worldPos.xyz += (finalWorld * vec4(0.0, 0.0, fishSway, 0.0)).xyz;
`;

export default class FishWigglePlugin extends MaterialPluginBase {

  constructor(material, options = {}) {
    super(material, 'FishWiggle', 210, { FISH_SPEED: '6.000', FISH_AMPLITUDE: '0.080' }, true, true);
    this.speed = Number.isFinite(options.speed) ? options.speed : 6;
    this.amplitude = Number.isFinite(options.amplitude) ? options.amplitude : 0.08;
  }

  getClassName() {
    return 'FishWigglePlugin';
  }

  prepareDefines(defines) {
    defines.FISH_SPEED = this.speed.toFixed(3);
    defines.FISH_AMPLITUDE = this.amplitude.toFixed(3);
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'fishTime', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('fishTime', performance.now() / 1000);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: WIGGLE_CODE,
    };
  }
}
