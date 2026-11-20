// Část staveb: patro — věnec z klád na stěnách přízemí, pevná dvouvrstvá prkenná podlaha na trámech, místnost z klád
// na části patra (ustoupená dovnitř), zbytek otevřená pavlač se zábradlím a schůdky ven, a venkovní
// schody: z mezipodesty na kůlech vedou tři ramena — nahoru k plošině u dveří patra, dolů do rohu zápraží a dolů
// na zem. Schody a schůdky patří k vrstvě přízemí, aby nezmizely s patrem.
// Patří k BuildingSystem (sdílí jeho this).
import { roughLog, placeAlongX, placeAlongZ, placeUpright } from '../../utils/buildingGeometry.js';

export default {
  buildUpper(plan, upper, floor) {
    const { width, depth } = plan;
    const halfW = width / 2;
    const halfD = depth / 2;
    const top = plan.lowerTop + floor.joist * 2 + floor.thickness;
    plan.upperTop = top;
    this.useLayer(plan, 'upper');
    this.ringBeam(plan, plan.walls);
    const cfg = { ...floor, ...upper.planks };
    const joists = Math.max(1, Math.round(width / floor.joistSpacing));
    const under = top - floor.thickness;
    for (let i = 0; i <= joists; i++) this.joist(plan, floor, false, -halfW + (width * i) / joists, -halfD - upper.joistOut, halfD + upper.joistOut, under);
    this.plankField(plan, { x0: -halfW, x1: halfW, z0: -halfD, z1: halfD, y: under }, false, { ...cfg, ...upper.subfloor }, () => upper.moss);
    this.plankField(plan, { x0: -halfW, x1: halfW, z0: -halfD, z1: halfD, y: top }, true, cfg, () => upper.moss);
    plan.walk.push({ x0: -halfW, x1: halfW, z0: -halfD, z1: halfD, y: top });

    const [x0, x1, z0, z1] = upper.room;
    plan.upperRoom = { x0, x1, z0, z1, base: top, height: upper.height };
    this.buildStorey(plan, plan.walls, { x0, x1, z0, z1, base: top, height: upper.height, sides: upper.sides, openings: upper.openings, brokenTop: true });

    for (const edge of upper.rails) this.railedEdge(plan, upper.rail, edge, top);
    this.useLayer(plan, 'lower');
    if (upper.stairs) this.outerStairs(plan, upper.stairs, floor, top);
    if (upper.sideSteps) this.sideSteps(plan, upper.sideSteps, top);
  },

  sideSteps(plan, steps, top) {
    const { rng } = plan;
    const x0 = steps.x - steps.width / 2;
    const x1 = steps.x + steps.width / 2;
    const ground = plan.groundAt(steps.x, steps.edge + steps.dir * steps.reach);
    const count = Math.max(1, Math.round(Math.abs(top - ground) / steps.rise));
    const clearTo = steps.edge + steps.dir * (count * steps.run + steps.reach);
    plan.keepClear.push({ x0: x0 - 0.6, x1: x1 + 0.6, z0: Math.min(steps.edge, clearTo), z1: Math.max(steps.edge, clearTo) });
    for (let k = 1; k <= count; k++) {
      const y = top + ((ground - top) * k) / (count + 1);
      const near = steps.edge + steps.dir * (k - 1) * steps.run;
      const far = near + steps.dir * steps.run;
      plan.walk.push({ x0, x1, z0: Math.min(near, far), z1: Math.max(near, far), y });
      for (const lane of [0.3, 0.7]) {
        if (rng() < steps.missing) continue;
        const radius = steps.log * (0.85 + rng() * 0.3);
        this.addLog(plan, roughLog(rng, plan.walls, x0 - 0.08, x1 + 0.08, y - radius, radius, 3), placeAlongX(near + steps.dir * lane * steps.run), this.logShade(plan));
      }
    }
    const reach = count * steps.run + 0.2;
    for (const x of [x0, x1]) {
      const near = steps.edge - steps.dir * 0.05;
      const far = steps.edge + steps.dir * reach;
      const log = roughLog(rng, plan.walls, Math.min(near, far), Math.max(near, far), 0, steps.log * 1.15, 3);
      const nearLift = top - steps.log * 2.4;
      log.startLift = steps.dir < 0 ? ground - 0.05 : nearLift;
      log.endLift = steps.dir < 0 ? nearLift : ground - 0.05;
      this.addLog(plan, log, placeAlongZ(x), this.logShade(plan));
    }
  },

  ringBeam(plan, walls) {
    const { width, depth, rng } = plan;
    const halfW = width / 2;
    const halfD = depth / 2;
    const step = walls.log * walls.spacing;
    const rows = Math.max(1, Math.round(walls.height / step));
    const radius = walls.log / 2;
    const liftX = (rows - 0.5) * step + radius * 2 * walls.ringSeat;
    const liftZ = rows * step + radius * 2 * walls.ringSeat;
    for (const z of [-halfD, halfD]) {
      this.addLog(plan, roughLog(rng, walls, -halfW - walls.overhang, halfW + walls.overhang, liftX, radius, width), placeAlongX(z), this.logShade(plan));
    }
    for (const x of [-halfW, halfW]) {
      this.addLog(plan, roughLog(rng, walls, -halfD - walls.overhang, halfD + walls.overhang, liftZ, radius, width), placeAlongZ(x), this.logShade(plan));
    }
  },

  railPost(plan, rail, x, z, foot, head) {
    const { rng } = plan;
    const log = roughLog(rng, plan.walls, foot, head + (rng() - 0.5) * 0.12, 0, rail.post * (0.9 + rng() * 0.2), 3);
    log.startLift = 0;
    log.endLift = (rng() - 0.5) * rail.lean;
    this.addLog(plan, log, placeUpright(x, z), this.logShade(plan), false, true);
  },

  railedEdge(plan, rail, edge, base) {
    const span = edge.to - edge.from;
    const count = Math.max(1, Math.round(span / rail.spacing));
    const stops = Array.from({ length: count + 1 }, (_, i) => edge.from + (span * i) / count);
    for (const along of stops) {
      const [x, z] = edge.alongX ? [along, edge.at] : [edge.at, along];
      this.railPost(plan, rail, x, z, base - 0.15, base + rail.height + 0.12);
    }
    const place = edge.alongX ? placeAlongX(edge.at) : placeAlongZ(edge.at);
    for (let i = 0; i < stops.length - 1; i++) this.railRun(plan, rail, place, stops[i], stops[i + 1], base);
  },

  outerStairs(plan, stairs, floor, top) {
    const x0 = stairs.x - stairs.width / 2;
    const x1 = stairs.x + stairs.width / 2;
    const pad = stairs.platform;
    const deck = { x0: pad.x0, x1: pad.x1, z0: pad.z0, z1: pad.z1, y: pad.height };
    this.plankField(plan, deck, true, { ...floor, ...stairs.planks }, () => 0.4);
    plan.walk.push(deck);
    for (const x of [deck.x0 + 0.05, deck.x1 - 0.05]) this.joist(plan, floor, false, x, deck.z0 - 0.05, deck.z1 + 0.05, pad.height);
    for (const x of [deck.x0 + 0.08, deck.x1 - 0.08]) {
      for (const z of [deck.z0 + 0.08, deck.z1 - 0.08]) {
        this.railPost(plan, { post: stairs.log * 1.4, lean: 0.05 }, x, z, plan.groundAt(x, z) - stairs.postSink, pad.height - floor.joist * 2);
      }
    }

    this.stairFlight(plan, stairs, { alongX: false, start: pad.z0, end: stairs.top, across: [x0, x1], startY: pad.height, endY: top, rail: x0 - 0.05 });
    const groundGuess = plan.groundAt(stairs.x, pad.z1 + stairs.groundReach);
    const downCount = Math.max(1, Math.round((pad.height - groundGuess) / stairs.rise));
    const downEnd = pad.z1 + downCount * stairs.run;
    this.stairFlight(plan, stairs, { alongX: false, start: pad.z1, end: downEnd, across: [x0, x1], startY: pad.height, endY: plan.groundAt(stairs.x, downEnd) });
    const middle = (pad.z0 + pad.z1) / 2;
    const side = stairs.terrace;
    this.stairFlight(plan, stairs, { alongX: true, start: pad.x1, end: side.to, across: [middle - side.width / 2, middle + side.width / 2], startY: pad.height, endY: 0 });
    plan.keepClear.push({ x0: pad.x0 - 0.8, x1: side.to + 0.3, z0: stairs.landing - 0.3, z1: downEnd + 0.6 });

    const rail = stairs.rail;
    const railX = x0 - 0.05;
    const padRail = deck.x0 + 0.05;
    for (const z of [deck.z0 + 0.05, deck.z1 - 0.05]) this.railPost(plan, rail, padRail, z, pad.height - 0.15, pad.height + rail.height + 0.12);
    this.railRun(plan, rail, placeAlongZ(padRail), deck.z0 + 0.05, deck.z1 - 0.05, pad.height);

    const landing = { x0: x0 - 0.1, x1: stairs.wall, z0: stairs.landing, z1: stairs.top, y: top };
    this.plankField(plan, landing, true, { ...floor, ...stairs.planks }, () => 0.4);
    plan.walk.push(landing);
    for (const x of [landing.x0, x1]) this.joist(plan, floor, false, x, landing.z0 - 0.1, landing.z1 + 0.1, top);
    for (const z of [landing.z0 + 0.1, landing.z1 - 0.1]) {
      this.railPost(plan, { post: stairs.log * 1.4, lean: 0.05 }, landing.x0 + 0.05, z, plan.groundAt(landing.x0, z) - stairs.postSink, top - floor.joist * 2);
    }
    this.railPost(plan, rail, railX, landing.z0 + 0.05, top - 0.15, top + rail.height + 0.12);
    this.railRun(plan, rail, placeAlongZ(railX), landing.z0 + 0.05, stairs.top, top);
    this.railRun(plan, rail, placeAlongX(landing.z0 + 0.05), railX, stairs.wall, top);
  },

  stairFlight(plan, stairs, flight) {
    const { rng } = plan;
    const { alongX, start, end, startY, endY } = flight;
    const [a, b] = flight.across;
    const dir = Math.sign(end - start) || 1;
    const length = Math.abs(end - start);
    const count = Math.max(1, Math.round(Math.abs(endY - startY) / stairs.rise));
    const run = length / count;
    const heightAt = (along) => startY + ((endY - startY) * Math.abs(along - start)) / length;
    const tread = alongX ? placeAlongZ : placeAlongX;
    const beam = alongX ? placeAlongX : placeAlongZ;
    const spot = (along, across) => (alongX ? [along, across] : [across, along]);
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const liftAt = (along) => heightAt(along);
    for (let k = 1; k <= count; k++) {
      const near = start + dir * (k - 1) * run;
      const far = start + dir * k * run;
      const y = startY + ((endY - startY) * k) / (count + 1);
      const from = Math.min(near, far);
      const to = Math.max(near, far);
      plan.walk.push(alongX ? { x0: from, x1: to, z0: a, z1: b, y } : { x0: a, x1: b, z0: from, z1: to, y });
      for (const lane of [0.3, 0.7]) {
        if (rng() < stairs.missing) continue;
        const radius = stairs.log * (0.85 + rng() * 0.3);
        const log = roughLog(rng, plan.walls, a - 0.1, b + 0.1, y - radius, radius, 3);
        if (rng() < stairs.broken) {
          if (rng() < 0.5) log.from += (b - a) * (0.3 + rng() * 0.3);
          log.endLift -= stairs.brokenDrop * rng();
        }
        this.addLog(plan, log, tread(near + dir * lane * run), this.logShade(plan));
      }
    }
    for (const edge of [a, b]) {
      const log = roughLog(rng, plan.walls, low - 0.1, high + 0.1, 0, stairs.log * 1.2, 3);
      log.startLift = liftAt(low) - 0.2;
      log.endLift = liftAt(high) - 0.2;
      this.addLog(plan, log, beam(edge), this.logShade(plan));
      for (let along = start + dir * stairs.postStep; dir * (end - along) > 0; along += dir * stairs.postStep) {
        const [x, z] = spot(along, edge);
        const foot = plan.groundAt(x, z) - stairs.postSink;
        const head = heightAt(along) - 0.3;
        if (head - foot > 0.2) this.railPost(plan, { post: stairs.log * 1.3, lean: 0.06 }, x, z, foot, head);
      }
    }
    if (!Number.isFinite(flight.rail)) return;
    const rail = stairs.rail;
    for (let along = start; dir * (end - along) >= -1e-6; along += dir * rail.spacing) {
      const [x, z] = spot(along, flight.rail);
      this.railPost(plan, rail, x, z, heightAt(along) - 0.2, heightAt(along) + rail.height);
    }
    if (rng() >= rail.missing) {
      const hand = roughLog(rng, plan.walls, low, high, 0, rail.radius, 3);
      hand.startLift = liftAt(low) + rail.height;
      hand.endLift = liftAt(high) + rail.height;
      if (rng() < rail.broken) {
        hand.to -= length * 0.3;
        hand.endLift -= rail.fallTo * rng();
      }
      this.addLog(plan, hand, beam(flight.rail), this.logShade(plan));
    }
  },
};
