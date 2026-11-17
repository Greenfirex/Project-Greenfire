// Pohyb nohou a klepet kraba přímo na grafické kartě — každý krab posílá jen čtyři čísla:
// kde je v kroku, jak moc šlape, jak vysoko drží klepeta a vlastní posun, aby nemávali naráz.
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase';

const DEFINITIONS = `
  attribute vec4 crabPose;
`;

const LEGS_CODE = `
  float crabSide = positionUpdated.x < 0.0 ? -1.0 : 1.0;
  float crabAx = abs(positionUpdated.x);
  float crabZ = positionUpdated.z;
  float crabReach = clamp((crabAx - 0.2) / 0.3, 0.0, 1.0);
  float crabLegAngle = atan(crabZ + 0.03, max(crabAx, 0.001));
  float crabPhase = crabPose.x + crabLegAngle * 7.2 + crabSide * 1.5708;
  float crabStride = crabReach * crabPose.y;
  positionUpdated.y += max(0.0, sin(crabPhase)) * 0.07 * crabStride;
  positionUpdated.x -= cos(crabPhase) * 0.035 * crabStride;
  float crabClaw = smoothstep(0.11, 0.16, crabZ)
    * (1.0 - smoothstep(0.21, 0.25, crabAx))
    * (1.0 - smoothstep(0.13, 0.16, positionUpdated.y));
  float crabAngle = crabClaw * crabPose.z * (0.75 + 0.12 * sin(crabTime * 6.0 + crabPose.w));
  vec2 crabArm = vec2(crabZ - 0.12, positionUpdated.y - 0.07);
  float crabCos = cos(crabAngle);
  float crabSin = sin(crabAngle);
  positionUpdated.z = 0.12 + crabArm.x * crabCos - crabArm.y * crabSin;
  positionUpdated.y = 0.07 + crabArm.x * crabSin + crabArm.y * crabCos;
  positionUpdated.x += crabSide * crabClaw * crabPose.z * 0.03;
`;

export default class CrabLegsPlugin extends MaterialPluginBase {

  constructor(material) {
    super(material, 'CrabLegs', 210, {}, true, true);
  }

  getClassName() {
    return 'CrabLegsPlugin';
  }

  getAttributes(attributes) {
    attributes.push('crabPose');
  }

  getUniforms() {
    return {
      ubo: [
        { name: 'crabTime', size: 1, type: 'float' },
      ],
    };
  }

  bindForSubMesh(ubo) {
    ubo.updateFloat('crabTime', performance.now() / 1000);
  }

  getCustomCode(shaderType) {
    if (shaderType !== 'vertex') return null;
    return {
      CUSTOM_VERTEX_DEFINITIONS: DEFINITIONS,
      CUSTOM_VERTEX_UPDATE_POSITION: LEGS_CODE,
    };
  }
}
