// Část staveb: stěny z křivých klád překřížených v rozích, s hrubě vyřezanými otvory pro dveře a okna — přízemí
// podle obrysu (seznam rohů, jinak obdélník) a místnost v patře. Na vystupujícím rohu klády přečnívají, na vnitřním
// jen dosednou; kde obrys vynechá roh, nesou věnec patra kůly (`posts`). Stěna zastaví postavu, projde se
// jen otvorem od podlahy (dveře), oknem ne. Klády nad pasem (`insideCut`) tvoří horní část stěny, kterou
// jde schovat, když je postava uvnitř. Patří k BuildingSystem (sdílí jeho this).
import { roughLog, placeAlongX, placeAlongZ, insideOutline, rectOutline } from '../../utils/buildingGeometry.js';

const MIN_PIECE = 0.25;
const PASSABLE_BOTTOM = 0.3;
const SIDE_ORDER = ['north', 'south', 'west', 'east'];
const PROBE = 0.01;

function outlineEdges(outline) {
  const edges = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const alongX = Math.abs(a[1] - b[1]) < 1e-6;
    const at = alongX ? a[1] : a[0];
    const lo = Math.min(alongX ? a[0] : a[1], alongX ? b[0] : b[1]);
    const hi = Math.max(alongX ? a[0] : a[1], alongX ? b[0] : b[1]);
    const mid = (lo + hi) / 2;
    const inward = alongX ? insideOutline(outline, mid, at + PROBE) : insideOutline(outline, at + PROBE, mid);
    const outward = inward ? -1 : 1;
    const side = alongX ? (outward > 0 ? 'south' : 'north') : (outward > 0 ? 'east' : 'west');
    edges.push({ side, alongX, at, outward, lo, hi });
  }
  return edges;
}

function cornerOut(outline, edge, end) {
  const along = end === 'lo' ? edge.lo - PROBE : edge.hi + PROBE;
  const across = edge.at - edge.outward * PROBE;
  return !(edge.alongX ? insideOutline(outline, along, across) : insideOutline(outline, across, along));
}

function neighbourSide(edges, edge, end) {
  const point = end === 'lo' ? edge.lo : edge.hi;
  const other = edges.find((item) => item !== edge && item.alongX !== edge.alongX
    && Math.abs(item.at - point) < 1e-6 && edge.at >= item.lo - 1e-6 && edge.at <= item.hi + 1e-6);
  return other ? other.side : null;
}

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
    plan.outline = walls.outline || rectOutline(-halfW, -halfD, halfW, halfD);
    const lowerTop = this.buildStorey(plan, walls, {
      outline: plan.outline, base: 0, height: walls.height, sides: walls.sides, openings: walls.openings, brokenTop: false,
    });
    plan.lowerTop = lowerTop;
    if (walls.posts) this.cornerPosts(plan, walls.posts, lowerTop);
  },

  cornerPosts(plan, posts, top) {
    for (const [x, z] of posts.at) {
      this.railPost(plan, { post: posts.radius, lean: posts.lean }, x, z, plan.groundAt(x, z) - posts.sink, top + posts.above);
      plan.blocks.push({ alongX: true, at: z, from: x - posts.radius, to: x + posts.radius, bottom: plan.groundAt(x, z), top, half: posts.radius });
    }
  },

  buildStorey(plan, walls, storey) {
    const { rng } = plan;
    const sides = new Set(storey.sides || []);
    const step = walls.log * walls.spacing;
    const rows = Math.max(1, Math.round(storey.height / step));
    const outline = storey.outline || rectOutline(storey.x0, storey.z0, storey.x1, storey.z1);
    const edges = outlineEdges(outline);
    const ends = (edge, end) => {
      if (!cornerOut(outline, edge, end)) return { reach: walls.log / 2, over: false };
      const over = sides.has(neighbourSide(edges, edge, end));
      return { reach: over ? walls.overhang : 0, over };
    };
    const runs = edges
      .filter((edge) => sides.has(edge.side))
      .sort((a, b) => (a.alongX === b.alongX ? 0 : a.alongX ? -1 : 1) || SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side) || a.lo - b.lo)
      .map((edge) => {
        const lo = ends(edge, 'lo');
        const hi = ends(edge, 'hi');
        return {
          ...edge,
          from: edge.lo - lo.reach,
          to: edge.hi + hi.reach,
          inner: [edge.lo, edge.hi],
          overFrom: lo.over,
          overTo: hi.over,
          first: edge.alongX ? 0.5 : 0,
          count: edge.alongX ? rows : rows + 1,
        };
      });

    let top = storey.base;
    for (const run of runs) {
      const place = run.alongX ? placeAlongX(run.at) : placeAlongZ(run.at);
      const openings = (storey.openings || []).filter((opening) => opening.side === run.side && opening.at > run.inner[0] && opening.at < run.inner[1]);
      const { overFrom, overTo } = run;
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
