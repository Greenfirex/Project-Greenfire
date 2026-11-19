// Část staveb: podlaha na kůlech — jednotlivá prkna s mezerami, některá chybí nebo jsou ulomená,
// ležící na trámech z kulatiny, a pod nimi křivé kůly do země. Patří k BuildingSystem (sdílí jeho this).
import { pushBox, roughLog, placeAlongX, placeAlongZ, placeUpright } from '../../utils/buildingGeometry.js';
import { smoothstep } from '../../utils/noise.js';

const FLOOR_PAINT_HEIGHT = 0.6;
const EDGE_MOSS = 0.55;
const EDGE_REACH = 1.1;

export default {
  plankField(plan, rect, alongX, cfg, mossAt) {
    const { rng, paint } = plan;
    const tile = cfg.tile;
    const [a0, a1] = alongX ? [rect.x0, rect.x1] : [rect.z0, rect.z1];
    const [b0, b1] = alongX ? [rect.z0, rect.z1] : [rect.x0, rect.x1];
    const rows = Math.max(1, Math.round((b1 - b0) / cfg.plank));
    const pitch = (b1 - b0) / rows;
    for (let r = 0; r < rows; r++) {
      const b = b0 + pitch * (r + 0.5);
      let a = a0;
      let length = cfg.pieceMin * 0.4 + rng() * (cfg.pieceMax - cfg.pieceMin * 0.4);
      while (a < a1 - 1e-6) {
        if (a1 - (a + length) < cfg.pieceMin * 0.4) length = a1 - a;
        length = Math.min(length, a1 - a);
        const start = a;
        a += length;
        const pieceLength = length;
        length = cfg.pieceMin + rng() * (cfg.pieceMax - cfg.pieceMin);
        if (rng() < cfg.missing) continue;
        let size = pieceLength;
        let from = start;
        if (rng() < cfg.broken) {
          size = pieceLength * (0.4 + 0.35 * rng());
          if (rng() < 0.5) from = start + pieceLength - size;
        }
        const shade = 1 + (rng() - 0.5) * cfg.shadeSpread;
        const base = cfg.tint.map((value) => value * shade);
        const plankPaint = (px, py, pz, up) => paint(base, px, FLOOR_PAINT_HEIGHT, pz, up, mossAt(px, pz));
        const slot = Math.floor(rng() * cfg.texturePlanks);
        const shiftV = rng();
        const uvMap = (u, v, spanU, spanV) => {
          const along = spanU >= spanV ? u : v;
          const across = spanU >= spanV ? v / spanV : u / spanU;
          return [(slot + 0.08 + 0.84 * across) / cfg.texturePlanks, along / tile + shiftV];
        };
        const middle = from + size / 2;
        const sink = rng() < cfg.rotten ? cfg.rotSag * rng() : 0;
        const lift = (rect.y || 0) - cfg.thickness / 2 + (rng() - 0.5) * 2 * cfg.warp - sink;
        pushBox(plan.planks, {
          center: alongX ? [middle, lift, b] : [b, lift, middle],
          size: alongX ? [size - cfg.gap, cfg.thickness, pitch - cfg.gap] : [pitch - cfg.gap, cfg.thickness, size - cfg.gap],
          tiltX: (rng() - 0.5) * cfg.tilt * (alongX ? 1 : 0.3) + (alongX ? 0 : sink * 0.6),
          tiltZ: (rng() - 0.5) * cfg.tilt * (alongX ? 0.3 : 1) + (alongX ? sink * 0.6 : 0),
          uvMap,
        }, plankPaint, tile);
      }
    }
  },

  joist(plan, floor, alongX, at, from, to, base = 0) {
    const { rng } = plan;
    const radius = floor.joist * (0.85 + rng() * 0.3);
    const log = roughLog(rng, plan.walls, from, to, base - floor.thickness - radius, radius, 4);
    this.addLog(plan, log, alongX ? placeAlongX(at) : placeAlongZ(at), this.logShade(plan));
  },

  joistTop(floor) {
    return -floor.thickness - floor.joist * 2;
  },

  stilt(plan, floor, x, z, topY) {
    const { rng } = plan;
    const foot = plan.groundAt(x, z) - floor.postSink;
    if (topY - foot < 0.05) return;
    const radius = (floor.post / 2) * (1 + (rng() - 0.5) * 0.3);
    const log = roughLog(rng, plan.walls, foot, topY, 0, radius, 3);
    log.startLift = (rng() - 0.5) * floor.postLean;
    log.endLift = 0;
    this.addLog(plan, log, placeUpright(x, z), this.logShade(plan), false, true);
  },

  buildFloor(plan, floor) {
    const { width, depth } = plan;
    const halfW = width / 2;
    const halfD = depth / 2;

    const edgeMoss = (x, z) => (1 - smoothstep(0, EDGE_REACH, Math.min(halfW - Math.abs(x), halfD - Math.abs(z)))) * EDGE_MOSS;
    this.plankField(plan, { x0: -halfW, x1: halfW, z0: -halfD, z1: halfD }, true, floor, edgeMoss);

    const over = floor.joist;
    for (const z of [-halfD, halfD]) this.joist(plan, floor, true, z, -halfW - over, halfW + over);
    for (let x = -halfW; x <= halfW + 1e-6; x += width / Math.max(1, Math.round(width / floor.joistSpacing))) {
      this.joist(plan, floor, false, x, -halfD - over, halfD + over);
    }

    const postTop = this.joistTop(floor);
    const stops = (span) => {
      const count = Math.max(1, Math.round(span / floor.postSpacing));
      return Array.from({ length: count + 1 }, (_, i) => -span / 2 + (span * i) / count);
    };
    for (const x of stops(width - floor.postInset * 2)) {
      for (const z of [-halfD + floor.postInset, halfD - floor.postInset]) this.stilt(plan, floor, x, z, postTop);
    }
    for (const z of stops(depth - floor.postInset * 2).slice(1, -1)) {
      for (const x of [-halfW + floor.postInset, halfW - floor.postInset]) this.stilt(plan, floor, x, z, postTop);
    }

    plan.walk.push({ x0: -halfW, x1: halfW, z0: -halfD, z1: halfD, y: 0 });
  },
};
