// Část staveb: pirátské věci na stavbě — roztrhaná vlajka s lebkou na nakloněné tyči a staré rybářské
// sítě na stěnách (přízemí i místnost v patře). Patří k BuildingSystem (sdílí jeho this).
import { createBuffer, pushSheet, roughLog, placeUpright } from '../../utils/buildingGeometry.js';
import { pirateFlagTexture, fishingNetTexture } from '../../utils/pirateCloth.js';

export default {
  buildProps(plan, props) {
    if (props.flag) this.buildFlag(plan, props.flag);
    for (const net of props.nets || []) {
      this.useLayer(plan, net.on === 'upper' ? 'upper' : 'lower');
      this.buildNet(plan, net, props.netColors);
    }
    this.useLayer(plan, 'lower');
  },

  buildFlag(plan, flag) {
    const { rng } = plan;
    const [x, z] = flag.at;
    const foot = plan.groundAt(x, z) - 0.3;
    const pole = roughLog(rng, plan.walls, foot, flag.height, 0, flag.radius, 4);
    pole.startLift = 0;
    pole.endLift = flag.lean;
    pole.taper = 0.3;
    this.addLog(plan, pole, placeUpright(x, z), this.logShade(plan), false, true);

    const topX = x - flag.lean;
    const topY = flag.height - 0.12;
    const [w, h] = flag.size;
    const buffer = createBuffer();
    const paint = (px, py, pz, up) => plan.paint([1, 1, 1], px, py, pz, up);
    pushSheet(buffer, 10, 6, (u, v) => [
      topX + flag.dir * u * w,
      topY - v * h - flag.droop * u * u - 0.06 * Math.sin(u * Math.PI * 1.5) * v,
      z + Math.sin(u * Math.PI * 2.3 + v * 0.8) * flag.wave * u,
    ], paint);
    plan.sheets.push({
      suffix: 'flag',
      buffer,
      material: this.drawnMaterial(`buildingFlagMat_${plan.key}`, () => pirateFlagTexture(this.s, `buildingFlag_${plan.key}`, flag.colors), true),
    });
  },

  buildNet(plan, net, colors) {
    const wall = Number.isFinite(net.wall) ? net.wall : plan.depth / 2;
    const out = wall + plan.walls.log / 2 + 0.05;
    const base = net.on === 'upper' ? plan.upperTop || 0 : 0;
    const buffer = createBuffer();
    const paint = (px, py, pz, up) => plan.paint([1, 1, 1], px, py, pz, up);
    pushSheet(buffer, 12, 10, (u, v) => {
      const hang = net.sag * 4 * u * (1 - u);
      return [
        net.at - net.width / 2 + u * net.width + Math.sin(v * 2.1 + u * 5) * 0.04,
        base + net.top - hang * (1 - v * 0.5) - v * net.height * (1 - 0.18 * Math.sin(u * Math.PI)),
        out + Math.sin(v * Math.PI) * net.bulge * (0.5 + 0.5 * Math.sin(u * 7)),
      ];
    }, paint);
    plan.sheets.push({
      suffix: 'net',
      buffer,
      material: this.drawnMaterial(`buildingNetMat_${plan.key}`, () => fishingNetTexture(this.s, `buildingNet_${plan.key}`, colors), true),
      part: plan.layer,
    });
  },
};
