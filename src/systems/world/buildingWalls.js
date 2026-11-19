// Část staveb: stěny z křivých klád překřížených v rozích, s hrubě vyřezanými otvory
// pro dveře a okna. Patří k BuildingSystem (sdílí jeho this).
import { roughLog, placeAlongX, placeAlongZ } from '../../utils/buildingGeometry.js';

const MIN_PIECE = 0.25;

function cutPieces(from, to, gaps) {
  let pieces = [{ from, to }];
  for (const gap of gaps) {
    const next = [];
    for (const piece of pieces) {
      if (gap.to <= piece.from || gap.from >= piece.to) {
        next.push(piece);
        continue;
      }
      if (gap.from - piece.from > MIN_PIECE) next.push({ from: piece.from, to: gap.from });
      if (piece.to - gap.to > MIN_PIECE) next.push({ from: gap.to, to: piece.to });
    }
    pieces = next;
  }
  return pieces;
}

export default {
  buildWalls(plan, walls) {
    const { width, depth, rng } = plan;
    const halfW = width / 2;
    const halfD = depth / 2;
    const sides = new Set(walls.sides || []);
    const step = walls.log * walls.spacing;
    const rows = Math.max(1, Math.round(walls.height / step));
    const reach = (side) => (sides.has(side) ? walls.overhang : 0);
    const runs = [];
    for (const [side, at] of [['north', -halfD], ['south', halfD]]) {
      if (sides.has(side)) runs.push({ side, alongX: true, at, from: -halfW - reach('west'), to: halfW + reach('east'), inner: [-halfW, halfW], first: 0.5, count: rows });
    }
    for (const [side, at] of [['west', -halfW], ['east', halfW]]) {
      if (sides.has(side)) runs.push({ side, alongX: false, at, from: -halfD - reach('north'), to: halfD + reach('south'), inner: [-halfD, halfD], first: 0, count: rows + 1 });
    }

    for (const run of runs) {
      const place = run.alongX ? placeAlongX(run.at) : placeAlongZ(run.at);
      const openings = (walls.openings || []).filter((opening) => opening.side === run.side);
      const overFrom = run.from < run.inner[0] - 1e-6;
      const overTo = run.to > run.inner[1] + 1e-6;
      const outward = run.at > 0 ? 1 : -1;
      const wallTop = (run.first + run.count - 1) * step + walls.log / 2;
      for (let along = run.inner[0] + walls.vineStep / 2; along < run.inner[1]; along += walls.vineStep) {
        const spot = along + (rng() - 0.5) * walls.vineStep * 0.6;
        const out = run.at + outward * walls.log / 2;
        const x = run.alongX ? spot : out;
        const z = run.alongX ? out : spot;
        this.addVineAnchor(plan, x, wallTop, z, run.alongX ? 0 : outward, run.alongX ? outward : 0, wallTop);
      }
      for (let i = 0; i < run.count; i++) {
        const y = (run.first + i) * step;
        const gaps = openings
          .filter((opening) => y > opening.bottom && y < opening.top)
          .map((opening) => ({
            from: opening.at - opening.width / 2 + (rng() - 0.5) * walls.cutSpread,
            to: opening.at + opening.width / 2 + (rng() - 0.5) * walls.cutSpread,
          }));
        const from = run.from - (overFrom ? rng() * walls.endSpread : 0);
        const to = run.to + (overTo ? rng() * walls.endSpread : 0);
        const radius = (walls.log / 2) * (1 + (rng() - 0.5) * walls.logSpread);
        const base = this.logShade(plan);
        for (const piece of cutPieces(from, to, gaps)) {
          let pieceTo = piece.to;
          if (i === run.count - 1 && rng() < walls.brokenTop) pieceTo = piece.from + (piece.to - piece.from) * (0.45 + 0.3 * rng());
          this.addLog(plan, roughLog(rng, walls, piece.from, pieceTo, y, radius, width), place, base);
        }
      }
    }
  },

};
