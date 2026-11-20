// Část staveb: stěny z křivých klád překřížených v rozích, s hrubě vyřezanými otvory
// pro dveře a okna — přízemí po obvodu stavby a místnost v patře. Stěna zastaví postavu, projde se
// jen otvorem od podlahy (dveře), oknem ne. Klády nad pasem (`insideCut`) tvoří horní část stěny, kterou
// jde schovat, když je postava uvnitř. Patří k BuildingSystem (sdílí jeho this).
import { roughLog, placeAlongX, placeAlongZ } from '../../utils/buildingGeometry.js';

const MIN_PIECE = 0.25;
const PASSABLE_BOTTOM = 0.3;

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
    const halfW = plan.width / 2;
    const halfD = plan.depth / 2;
    const lowerTop = this.buildStorey(plan, walls, {
      x0: -halfW, x1: halfW, z0: -halfD, z1: halfD, base: 0, height: walls.height, sides: walls.sides, openings: walls.openings, brokenTop: false,
    });
    plan.lowerTop = lowerTop;
  },

  buildStorey(plan, walls, storey) {
    const { rng } = plan;
    const sides = new Set(storey.sides || []);
    const step = walls.log * walls.spacing;
    const rows = Math.max(1, Math.round(storey.height / step));
    const reach = (side) => (sides.has(side) ? walls.overhang : 0);
    const runs = [];
    for (const [side, at] of [['north', storey.z0], ['south', storey.z1]]) {
      if (sides.has(side)) runs.push({ side, alongX: true, at, outward: side === 'south' ? 1 : -1, from: storey.x0 - reach('west'), to: storey.x1 + reach('east'), inner: [storey.x0, storey.x1], first: 0.5, count: rows });
    }
    for (const [side, at] of [['west', storey.x0], ['east', storey.x1]]) {
      if (sides.has(side)) runs.push({ side, alongX: false, at, outward: side === 'east' ? 1 : -1, from: storey.z0 - reach('north'), to: storey.z1 + reach('south'), inner: [storey.z0, storey.z1], first: 0, count: rows + 1 });
    }

    let top = storey.base;
    for (const run of runs) {
      const place = run.alongX ? placeAlongX(run.at) : placeAlongZ(run.at);
      const openings = (storey.openings || []).filter((opening) => opening.side === run.side);
      const overFrom = run.from < run.inner[0] - 1e-6;
      const overTo = run.to > run.inner[1] + 1e-6;
      const wallTop = (run.first + run.count - 1) * step + walls.log / 2;
      top = Math.max(top, storey.base + wallTop);
      const doors = openings
        .filter((opening) => opening.bottom < PASSABLE_BOTTOM)
        .map((opening) => ({ from: opening.at - opening.width / 2, to: opening.at + opening.width / 2 }));
      for (const piece of cutPieces(run.from, run.to, doors)) {
        this.addBlock(plan, place, piece.from, piece.to, storey.base, storey.base + wallTop, walls.log / 2);
      }
      for (const opening of openings) {
        if (opening.kind === 'door') this.addDoor(plan, run, opening, storey);
      }
      const dirX = run.alongX ? 0 : run.outward;
      const dirZ = run.alongX ? run.outward : 0;
      const wallPart = (y) => (y > walls.insideCut ? this.useWallTop(plan, run) : this.usePart(plan, plan.layer));
      for (let along = run.inner[0] + walls.vineStep / 2; along < run.inner[1]; along += walls.vineStep) {
        const spot = along + (rng() - 0.5) * walls.vineStep * 0.6;
        const out = run.at + run.outward * (walls.log / 2 + walls.vineGap);
        const x = run.alongX ? spot : out;
        const z = run.alongX ? out : spot;
        if (rng() < walls.vineDrape) {
          const sign = rng() < 0.5 ? -1 : 1;
          const y = storey.base + 0.5 + rng() * (wallTop - 0.8);
          const shape = { kind: 'drape', alongX: run.alongX ? sign : 0, alongZ: run.alongX ? 0 : sign, span: 1.2 + rng() * 1.6 };
          wallPart(y - storey.base);
          this.addVineAnchor(plan, x, y, z, dirX, dirZ, wallTop, walls.vineChance, 'wall', shape);
          continue;
        }
        wallPart(wallTop);
        this.addVineAnchor(plan, x, storey.base + wallTop, z, dirX, dirZ, wallTop, walls.vineChance, 'wall');
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
        wallPart(y);
        for (const piece of cutPieces(from, to, gaps)) {
          let pieceTo = piece.to;
          if (storey.brokenTop && i === run.count - 1 && rng() < walls.brokenTop) pieceTo = piece.from + (piece.to - piece.from) * (0.45 + 0.3 * rng());
          this.addLog(plan, roughLog(rng, walls, piece.from, pieceTo, storey.base + y, radius, plan.width), place, base);
        }
      }
      this.usePart(plan, plan.layer);
    }
    return top;
  },
};
