// Houpání stromů ve větru — posouvá vrcholy podle výšky, u země nic, ve špičkách nejvíc.
// Každý strom má jinou fázi podle svého místa, takže se koruny nehýbou ve stejném rytmu.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const WIND_CODE = `
  float windWeight = pow(clamp(positionUpdated.y / max(windHeight, 0.001), 0.0, 1.0), 1.6);
  float windPhase = worldPos.x * 0.35 + worldPos.z * 0.27;
  float windA = sin(windTime * 1.4 + windPhase) * 0.7 + sin(windTime * 2.9 + windPhase * 1.7) * 0.3;
  float windB = cos(windTime * 1.15 + windPhase * 1.3) * 0.6 + cos(windTime * 2.5 + windPhase * 0.8) * 0.25;
  worldPos.x += windA * windStrength * windWeight;
  worldPos.z += windB * windStrength * windWeight;
`;

export default class TreeWindPlugin extends MaterialPluginBase {

  constructor(material, options = {}) {
    super(material, 'TreeWind', 200, {}, true, true);
    this.strength = Number.isFinite(options.strength) ? options.strength : 0.06;
    this.height = Number.isFinite(options.height) ? options.height : 4;
  }

  getClassName() {
    return 'TreeWindPlugin';
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'windTime', size: 1, type: 'float' },
        { name: 'windStrength', size: 1, type: 'float' },
        { name: 'windHeight', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('windTime', performance.now() / 1000);
    ubo.updateFloat('windStrength', this.strength);
    ubo.updateFloat('windHeight', this.height);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_UPDATE_WORLDPOS: WIND_CODE,
    };
  }
}
