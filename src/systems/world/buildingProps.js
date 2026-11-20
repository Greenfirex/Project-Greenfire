// Část staveb: pirátské věci u stavby — roztrhaná vlajka s lebkou na nakloněné tyči, stará rybářská
// síť na stěně, sudy s obručemi (stojící i povalené) a bedny (i otevřená s víkem vedle).
// Zatím kreslené v kódu; později je mohou nahradit modely. Patří k BuildingSystem (sdílí jeho this).
import { createBuffer, pushSheet, pushLog, pushLogEnd, pushBox, roughLog, placeAlongX, placeAlongZ, placeUpright } from '../../utils/buildingGeometry.js';
import { pirateFlagTexture, fishingNetTexture } from '../../utils/pirateCloth.js';

export default {
  buildProps(plan, props) {
    if (props.flag) this.buildFlag(plan, props.flag);
    if (props.net) this.buildNet(plan, props.net);
    for (const item of (props.barrels && props.barrels.items) || []) {
      this.useLayer(plan, item.on === 'upper' ? 'upper' : 'lower');
      this.barrel(plan, props.barrels.style, item);
    }
    for (const item of (props.crates && props.crates.items) || []) {
      this.useLayer(plan, item.on === 'upper' ? 'upper' : 'lower');
      this.crate(plan, props.crates.style, item);
    }
    this.useLayer(plan, 'lower');
  },

  surfaceY(plan, item) {
    if (item.on === 'ground') return plan.groundAt(item.at[0], item.at[1]);
    if (item.on === 'upper') return plan.upperTop || 0;
    return 0;
  },

  barrel(plan, style, item) {
    const { rng } = plan;
    const [x, z] = item.at;
    const scale = item.scale || 1;
    const height = style.height * scale;
    const radius = style.radius * scale;
    const y0 = this.surfaceY(plan, item);
    const shade = 1 + (rng() - 0.5) * style.shadeSpread;
    const base = style.tint.map((value) => value * shade);
    const paint = (px, py, pz, up) => plan.paint(base, px, py, pz, up);
    const hoopPaint = (px, py, pz, up) => plan.paint(style.hoopTint, px, py, pz, up);
    let place;
    let from;
    let lift = 0;
    if (!item.lying) {
      place = placeUpright(x, z);
      from = y0;
    } else {
      place = item.lying === 'x' ? placeAlongX(z) : placeAlongZ(x);
      from = (item.lying === 'x' ? x : z) - height / 2;
      lift = y0 + radius * (1 + style.bulge);
    }
    const shape = (start, end, r, bulge, staves) => ({
      from: start, to: end, radius: r, startLift: lift, endLift: lift, sag: 0, bow: 0, taper: 0,
      bulge, bulgeWaves: 1, bulgePhase: 0, segments: 8, sides: style.sides, shiftU: rng(), shiftV: rng(), staves,
    });
    const rings = pushLog(plan.planks, shape(from, from + height, radius, style.bulge, style.staves / style.texturePlanks), place, paint, style.tile);
    pushLogEnd(plan.planks, rings[0], style.sides, rng() * Math.PI * 2, -1, place, paint);
    pushLogEnd(plan.planks, rings[rings.length - 1], style.sides, rng() * Math.PI * 2, 1, place, paint);
    for (const at of style.hoops) {
      const swell = radius * (1 + style.bulge * Math.sin(at * Math.PI)) + style.hoopOut;
      const middle = from + at * height;
      pushLog(plan.planks, shape(middle - style.hoopWidth / 2, middle + style.hoopWidth / 2, swell, 0), place, hoopPaint, style.tile);
    }
  },

  crate(plan, style, item) {
    const { rng } = plan;
    const [x, z] = item.at;
    const size = style.size * (item.scale || 1);
    const t = style.thickness;
    const y0 = this.surfaceY(plan, item);
    const yaw = item.yaw || 0;
    const shade = 1 + (rng() - 0.5) * style.shadeSpread;
    const base = style.tint.map((value) => value * shade);
    const paint = (px, py, pz, up) => plan.paint(base, px, py, pz, up);
    const half = size / 2;
    const panels = [
      [[0, t / 2 - half, 0], [size, t, size]],
      [[half - t / 2, 0, 0], [t, size, size]],
      [[t / 2 - half, 0, 0], [t, size, size]],
      [[0, 0, half - t / 2], [size, size, t]],
      [[0, 0, t / 2 - half], [size, size, t]],
    ];
    if (!item.open) panels.push([[0, half - t / 2, 0], [size, t, size]]);
    for (const [[ox, oy, oz], dims] of panels) {
      pushBox(plan.planks, {
        center: [x + ox * Math.cos(yaw) + oz * Math.sin(yaw), y0 + half + oy, z - ox * Math.sin(yaw) + oz * Math.cos(yaw)],
        size: dims,
        yaw,
        shiftU: rng(),
        shiftV: rng(),
      }, paint, style.tile);
    }
    if (item.open) {
      const out = size * 0.95;
      pushBox(plan.planks, {
        center: [x + out * Math.cos(yaw + 0.4), y0 + t / 2 + 0.01, z - out * Math.sin(yaw + 0.4)],
        size: [size, t, size],
        yaw: yaw + 0.7,
        tiltX: 0.05,
        shiftU: rng(),
      }, paint, style.tile);
    }
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

  buildNet(plan, net) {
    const halfD = plan.depth / 2;
    const out = halfD + plan.walls.log / 2 + 0.05;
    const buffer = createBuffer();
    const paint = (px, py, pz, up) => plan.paint([1, 1, 1], px, py, pz, up);
    pushSheet(buffer, 12, 10, (u, v) => {
      const hang = net.sag * 4 * u * (1 - u);
      return [
        net.at - net.width / 2 + u * net.width + Math.sin(v * 2.1 + u * 5) * 0.04,
        net.top - hang * (1 - v * 0.5) - v * net.height * (1 - 0.18 * Math.sin(u * Math.PI)),
        out + Math.sin(v * Math.PI) * net.bulge * (0.5 + 0.5 * Math.sin(u * 7)),
      ];
    }, paint);
    plan.sheets.push({
      suffix: 'net',
      buffer,
      material: this.drawnMaterial(`buildingNetMat_${plan.key}`, () => fishingNetTexture(this.s, `buildingNet_${plan.key}`, net.colors), true),
    });
  },
};
