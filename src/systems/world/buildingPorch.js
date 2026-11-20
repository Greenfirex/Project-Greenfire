// Část staveb: terasa před dveřmi — prkna kolmo ke stěně (shnilá, propadlá, chybějící), kůly,
// polorozpadlé zábradlí a vratké schody z kulatiny dolů na zem. Z každého úseku zábradlí zbude
// aspoň jedna tyč a zastaví postavu. Patří k BuildingSystem (sdílí jeho this).
import { roughLog, placeAlongX, placeAlongZ, placeUpright } from '../../utils/buildingGeometry.js';
import { createRng, seedFor } from '../../utils/rng.js';
import { smoothstep } from '../../utils/noise.js';

export default {
  buildPorch(plan, porch, floor) {
    const { depth } = plan;
    const z0 = depth / 2;
    const z1 = z0 + porch.depth;
    const cfg = { ...floor, ...porch.planks };
    const mossAt = (x, z) => 0.25 + 0.6 * smoothstep(z0, z1, z);
    this.plankField(plan, { x0: porch.from, x1: porch.to, z0, z1 }, false, cfg, mossAt, (x, z) => this.holeGrowth(plan, x, z));
    plan.walk.push({ x0: porch.from, x1: porch.to, z0, z1, y: 0 });

    const span = porch.to - porch.from;
    const over = floor.joist;
    for (let z = z0 + porch.depth / 2; z <= z1 + 1e-6; z += porch.depth / 2) this.joist(plan, floor, true, z, porch.from - over, porch.to + over);
    for (const x of [porch.from, porch.to]) this.joist(plan, floor, false, x, z0, z1 + over);
    for (let x = porch.from + floor.postInset; x <= porch.to - floor.postInset + 1e-6; x += span / Math.max(1, Math.round(span / floor.postSpacing))) {
      this.stilt(plan, floor, x, z1 - floor.postInset, this.joistTop(floor));
    }

    const steps = porch.steps;
    const gap = [steps.at - steps.width / 2, steps.at + steps.width / 2];
    const edge = z1 - porch.post;
    const posts = [porch.from + porch.post, gap[0] - porch.post * 0.5, gap[1] + porch.post * 0.5, porch.to - porch.post];
    for (const x of posts) this.porchPost(plan, porch, x, edge);
    const sideFrom = z0 + plan.walls.log * 0.6;
    this.porchPost(plan, porch, porch.from + porch.post, sideFrom);
    this.porchPost(plan, porch, porch.to - porch.post, sideFrom);

    for (let i = 0; i < posts.length - 1; i++) {
      if (posts[i] >= gap[0] - porch.post && posts[i + 1] <= gap[1] + porch.post) continue;
      this.railRun(plan, porch.rail, placeAlongX(edge), posts[i], posts[i + 1]);
    }
    for (const x of [porch.from + porch.post, porch.to - porch.post]) this.railRun(plan, porch.rail, placeAlongZ(x), sideFrom, edge);

    this.porchSteps(plan, porch, floor, z1);
  },

  porchPost(plan, porch, x, z) {
    const { rng } = plan;
    const foot = plan.groundAt(x, z) - porch.postSink;
    const log = roughLog(rng, plan.walls, foot, porch.rail.height + 0.12 + (rng() - 0.5) * 0.15, 0, porch.post * (0.9 + rng() * 0.2), 3);
    log.startLift = 0;
    log.endLift = (rng() - 0.5) * porch.lean;
    this.addLog(plan, log, placeUpright(x, z), this.logShade(plan), false, true);
  },

  railRun(plan, rail, place, from, to, base = 0) {
    let built = false;
    const lifts = [base + rail.height, base + rail.low];
    for (const [index, lift] of lifts.entries()) {
      const missing = plan.rng() < rail.missing;
      if (missing && (built || index < lifts.length - 1)) continue;
      const rng = missing ? createRng(seedFor(0, plan.key, Math.round(from * 100), Math.round(to * 100))) : plan.rng;
      built = true;
      const log = roughLog(rng, plan.walls, from, to, lift, rail.radius * (0.85 + rng() * 0.3), 3);
      if (rng() < rail.broken) {
        const dropped = rng() < 0.5;
        const fall = lift - rail.fallTo * rng();
        log.startLift = dropped ? fall : lift;
        log.endLift = dropped ? lift : fall;
        if (dropped) log.from += (to - from) * 0.15;
        else log.to -= (to - from) * 0.15;
      }
      this.addLog(plan, log, place, this.logShade({ rng, walls: plan.walls }));
    }
    if (built) this.addBlock(plan, place, from, to, base, base + rail.height, rail.radius);
  },

  porchSteps(plan, porch, floor, z1) {
    const { rng } = plan;
    const steps = porch.steps;
    const ground = plan.groundAt(steps.at, z1 + steps.run);
    if (ground > -0.08) return;
    const count = Math.max(1, Math.round(-ground / steps.rise));
    const x0 = steps.at - steps.width / 2;
    const x1 = steps.at + steps.width / 2;
    plan.keepClear.push({ x0: x0 - 0.2, x1: x1 + 0.2, z0: z1 - 0.1, z1: z1 + count * steps.run + 0.6 });
    for (let k = 1; k <= count; k++) {
      const y = (ground * k) / (count + 1);
      const z = z1 + (k - 0.5) * steps.run;
      plan.walk.push({ x0, x1, z0: z - steps.run / 2, z1: z + steps.run / 2, y });
      for (const lane of [-0.25, 0.25]) {
        if (rng() < steps.missing) continue;
        const radius = steps.log * (0.85 + rng() * 0.3);
        const log = roughLog(rng, plan.walls, x0 - 0.1, x1 + 0.1, y - radius, radius, 3);
        if (rng() < steps.broken) {
          if (rng() < 0.5) log.from += steps.width * (0.3 + rng() * 0.3);
          log.endLift -= steps.brokenDrop * rng();
        }
        this.addLog(plan, log, placeAlongX(z + lane * steps.run), this.logShade(plan));
      }
    }
    const run = count * steps.run + 0.2;
    for (const x of [x0, x1]) {
      const log = roughLog(rng, plan.walls, z1 - 0.1, z1 + run, 0, steps.log * 1.1, 3);
      log.startLift = -steps.log * 2.2;
      log.endLift = ground - 0.1;
      this.addLog(plan, log, placeAlongZ(x), this.logShade(plan));
    }
  },
};
