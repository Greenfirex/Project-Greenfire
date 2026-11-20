// Část staveb: pirátské věci ve srubu a kolem — kotva se stočeným lanem, převrácená loďka na kozách, mapa pokladu
// přišpendlená dýkou, láhve od rumu (i rozbitá) a cínové hrnky, kormidelní kolo na stěně, dalekohled, kompas a lavička
// z kulatiny u táboráku a police na stěnách s láhvemi, mincemi, svíčkami a truhličkou. Vše je složené z válců a kvádrů
// v kódu. Patří k BuildingSystem (sdílí jeho this).
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, pushBox, pushLog, pushLogEnd, pushSheet, placeUpright } from '../../utils/buildingGeometry.js';
import { treasureMapTexture } from '../../utils/pirateCloth.js';

export const PIRATE_KINDS = new Set(['anchor', 'rope', 'boat', 'map', 'bottle', 'mug', 'wheel', 'spyglass', 'compass', 'bench', 'shelf', 'chest']);

function turn(place, [ox, oy, oz]) {
  const tilt = place.tilt || 0;
  const yaw = place.yaw || 0;
  const y1 = oy * Math.cos(tilt) - oz * Math.sin(tilt);
  const z1 = oy * Math.sin(tilt) + oz * Math.cos(tilt);
  return new Vector3(place.x + ox * Math.cos(yaw) + z1 * Math.sin(yaw), place.y + y1, place.z - ox * Math.sin(yaw) + z1 * Math.cos(yaw));
}

function cylinder(buffer, place, from, to, radius, paint, options = {}) {
  const a = turn(place, from);
  const b = turn(place, to);
  const axis = b.subtract(a);
  const length = axis.length();
  if (length < 1e-5) return;
  const dir = axis.scale(1 / length);
  const ref = Math.abs(dir.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const side = Vector3.Cross(dir, ref).normalize();
  const up = Vector3.Cross(side, dir).normalize();
  const at = (along, lift, across) => [
    a.x + dir.x * along + up.x * lift + side.x * across,
    a.y + dir.y * along + up.y * lift + side.y * across,
    a.z + dir.z * along + up.z * lift + side.z * across,
  ];
  const log = {
    from: 0, to: length, radius, startLift: 0, endLift: 0, sag: 0, bow: 0, taper: options.taper || 0,
    bulge: options.bulge || 0, bulgeWaves: 1, bulgePhase: 0, segments: options.segments || 2, sides: options.sides || 10, shiftU: 0, shiftV: 0,
  };
  const rings = pushLog(buffer, log, at, paint, options.tile || 1);
  if (options.caps === false) return;
  pushLogEnd(buffer, rings[0], log.sides, 0, -1, at, paint);
  pushLogEnd(buffer, rings[rings.length - 1], log.sides, 0, 1, at, paint);
}

function block(buffer, place, offset, size, paint, extra = {}, tile = 1) {
  const center = turn(place, offset);
  pushBox(buffer, {
    center: [center.x, center.y, center.z],
    size,
    yaw: (place.yaw || 0) + (extra.yaw || 0),
    tiltX: (place.tilt || 0) + (extra.tiltX || 0),
    tiltZ: extra.tiltZ || 0,
  }, paint, tile);
}

function ring(buffer, place, center, radius, thickness, plane, paint, count = 14) {
  const point = (k) => {
    const angle = (k / count) * Math.PI * 2;
    const u = Math.cos(angle) * radius;
    const v = Math.sin(angle) * radius;
    if (plane === 'xy') return [center[0] + u, center[1] + v, center[2]];
    if (plane === 'yz') return [center[0], center[1] + v, center[2] + u];
    return [center[0] + u, center[1], center[2] + v];
  };
  for (let k = 0; k < count; k += 1) cylinder(buffer, place, point(k), point(k + 1), thickness, paint, { caps: false, sides: 6 });
}

const plain = (color) => () => color;

export default {
  pirateProp(plan, style, item, place) {
    if (item.kind === 'anchor') this.pirateAnchor(plan, style, place);
    else if (item.kind === 'rope') this.pirateRope(plan, style, place);
    else if (item.kind === 'boat') this.pirateBoat(plan, style, place);
    else if (item.kind === 'map') this.pirateMap(plan, style, place);
    else if (item.kind === 'bottle') this.pirateBottle(plan.painted, style, place, item.color || style.colors[0], item.broken);
    else if (item.kind === 'mug') this.pirateMug(plan, style, place);
    else if (item.kind === 'wheel') this.pirateWheel(plan, style, place);
    else if (item.kind === 'spyglass') this.pirateSpyglass(plan, style, place);
    else if (item.kind === 'compass') this.pirateCompass(plan, style, place);
    else if (item.kind === 'bench') this.pirateBench(plan, style, place);
    else if (item.kind === 'shelf') this.pirateShelf(plan, style, item, place);
    else if (item.kind === 'chest') this.pirateChest(plan, style, place);
  },

  pirateAnchor(plan, style, place) {
    const iron = plain(style.iron);
    const r = style.thick;
    const h = style.height;
    const w = style.width;
    cylinder(plan.painted, place, [0, 0.1, 0], [0, h, 0], r, iron);
    ring(plan.painted, place, [0, h + style.ring, 0], style.ring, r * 0.6, 'xy', iron);
    cylinder(plan.painted, place, [-w * 0.45, h - 0.14, 0], [w * 0.45, h - 0.14, 0], r * 0.8, iron);
    for (const sign of [-1, 1]) {
      cylinder(plan.painted, place, [0, 0.1, 0], [sign * w * 0.3, 0.16, 0], r, iron);
      cylinder(plan.painted, place, [sign * w * 0.3, 0.16, 0], [sign * w * 0.48, 0.42, 0], r * 0.9, iron);
      block(plan.painted, place, [sign * w * 0.5, 0.4, 0], [0.15, 0.17, 0.04], iron, { tiltX: 0 });
    }
    block(plan.painted, place, [0, 0.1, 0], [r * 3, r * 3, r * 3], iron);
  },

  pirateRope(plan, style, place) {
    const rope = plain(style.rope);
    style.loops.forEach(([radius, height]) => ring(plan.painted, place, [0, height, 0], radius, style.thick, 'xz', rope, 16));
    cylinder(plan.painted, place, [style.loops[0][0], style.thick, 0], [style.loops[0][0] + 0.35, style.thick, 0.25], style.thick, rope, { caps: false, sides: 6 });
  },

  pirateBoat(plan, style, place) {
    const [length, , beam] = style.size;
    const base = style.trestle;
    const paint = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const hull = (flip) => (u, v) => {
      const t = flip ? 1 - v : v;
      const angle = -Math.PI / 2 + Math.PI * t;
      const width = (beam / 2) * Math.pow(Math.sin(Math.PI * u), 0.55);
      const keel = style.depth * Math.pow(Math.sin(Math.PI * u), 0.3);
      const p = turn(place, [(u - 0.5) * length, base + keel * Math.cos(angle), width * Math.sin(angle)]);
      return [p.x, p.y, p.z];
    };
    for (const flip of [false, true]) pushSheet(plan.planks, 20, 8, hull(flip), paint);
    block(plan.planks, place, [0, base + style.depth + 0.02, 0], [length * 0.92, 0.05, 0.07], paint, {}, 1.2);
    for (const u of [0.25, 0.75]) {
      const x = (u - 0.5) * length;
      block(plan.planks, place, [x, base - 0.04, 0], [0.09, 0.08, beam + 0.2], paint, {}, 1.2);
      for (const z of [-beam / 2, beam / 2]) {
        for (const lean of [-0.18, 0.18]) block(plan.planks, place, [x + lean * 0.5, (base - 0.08) / 2, z], [0.06, base - 0.06, 0.06], paint, { tiltZ: lean }, 1.2);
      }
    }
  },

  pirateMap(plan, style, place) {
    const sheet = createBuffer();
    const [w, , d] = style.size;
    pushSheet(sheet, 8, 6, (u, v) => {
      const curl = style.curl * (Math.pow(Math.abs(u - 0.5) * 2, 4) + Math.pow(Math.abs(v - 0.5) * 2, 4));
      const p = turn(place, [(u - 0.5) * w, curl + 0.002, (v - 0.5) * d]);
      return [p.x, p.y, p.z];
    }, plain([1, 1, 1]));
    plan.sheets.push({ suffix: 'map', buffer: sheet, material: this.drawnMaterial(`buildingMapMat_${plan.key}`, () => treasureMapTexture(this.s, `buildingMap_${plan.key}`, style.colors), true), part: plan.layer });
    const steel = plain(style.steel);
    const grip = plain(style.grip);
    const [dx, dz] = style.dagger;
    const dagger = { ...place, x: turn(place, [dx, 0, dz]).x, z: turn(place, [dx, 0, dz]).z, tilt: style.daggerTilt };
    block(plan.painted, dagger, [0, 0.03, 0], [0.025, 0.12, 0.006], steel);
    block(plan.painted, dagger, [0, 0.1, 0], [0.08, 0.014, 0.018], steel);
    cylinder(plan.painted, dagger, [0, 0.105, 0], [0, 0.2, 0], 0.012, grip);
    cylinder(plan.painted, dagger, [0, 0.2, 0], [0, 0.215, 0], 0.017, steel);
  },

  pirateBottle(buffer, style, place, color, broken = false) {
    const glass = plain(color);
    const cork = plain(style.cork);
    const r = style.radius;
    const [body, shoulder, neck] = style.heights;
    if (broken) {
      const lying = { ...place, tilt: Math.PI / 2, y: place.y + r };
      cylinder(buffer, lying, [0, 0, 0], [0, body * 0.55, 0], r, glass, { caps: false, sides: 9 });
      cylinder(buffer, lying, [0, body * 0.55, 0], [0, body * 0.7, 0], r, glass, { taper: 0.6, sides: 9 });
      cylinder(buffer, lying, [0, body * 0.7, 0], [0, body * 0.7 + neck - shoulder, 0], r * 0.36, glass, { sides: 8 });
      for (const [x, z, s] of style.shards) block(buffer, place, [x, 0.004, z], [s, 0.006, s * 0.7], glass, { yaw: x * 9 });
      return;
    }
    cylinder(buffer, place, [0, 0, 0], [0, body, 0], r, glass, { sides: 10 });
    cylinder(buffer, place, [0, body, 0], [0, shoulder, 0], r, glass, { taper: 0.62, sides: 10 });
    cylinder(buffer, place, [0, shoulder, 0], [0, neck, 0], r * 0.36, glass, { sides: 8 });
    cylinder(buffer, place, [0, neck, 0], [0, neck + 0.018, 0], r * 0.33, cork, { sides: 8 });
  },

  pirateMug(plan, style, place) {
    const pewter = plain(style.pewter);
    cylinder(plan.painted, place, [0, 0, 0], [0, style.height, 0], style.radius, pewter, { sides: 12, taper: -0.08 });
    block(plan.painted, place, [style.radius + 0.018, style.height * 0.55, 0], [0.014, style.height * 0.6, 0.016], pewter);
    for (const y of [0.25, 0.85]) block(plan.painted, place, [style.radius + 0.01, style.height * y, 0], [0.026, 0.012, 0.014], pewter);
  },

  pirateWheel(plan, style, place) {
    const paint = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const r = style.radius;
    ring(plan.planks, place, [0, 0, 0], r, style.rim, 'yz', paint, 18);
    for (let k = 0; k < style.spokes; k += 1) {
      const angle = (k / style.spokes) * Math.PI * 2;
      const dir = [0, Math.sin(angle), Math.cos(angle)];
      const at = (d) => [0, dir[1] * d, dir[2] * d];
      cylinder(plan.planks, place, at(0.05), at(r), style.spoke, paint, { sides: 7 });
      cylinder(plan.planks, place, at(r), at(r + style.handle), style.spoke * 1.4, paint, { sides: 7, taper: 0.3 });
    }
    cylinder(plan.planks, place, [-0.05, 0, 0], [0.05, 0, 0], style.hub, paint, { sides: 12 });
    cylinder(plan.planks, place, [0.05, 0, 0], [style.peg, 0, 0], style.spoke, paint, { sides: 7 });
  },

  pirateSpyglass(plan, style, place) {
    const brass = plain(style.brass);
    const lift = style.tubes[0][1];
    let along = 0;
    for (const [length, radius] of style.tubes) {
      cylinder(plan.painted, place, [along, lift, 0], [along + length, lift, 0], radius, brass, { sides: 12 });
      along += length;
    }
    ring(plan.painted, place, [0.004, lift, 0], style.tubes[0][1], 0.006, 'yz', brass, 10);
  },

  pirateCompass(plan, style, place) {
    const brass = plain(style.brass);
    cylinder(plan.painted, place, [0, 0, 0], [0, style.height, 0], style.radius, brass, { sides: 14 });
    cylinder(plan.painted, place, [0, style.height, 0], [0, style.height + 0.002, 0], style.radius * 0.84, plain(style.face), { sides: 14 });
    block(plan.painted, place, [0, style.height + 0.004, 0], [0.006, 0.003, style.radius * 1.4], plain(style.needle));
  },

  pirateShelf(plan, style, item, place) {
    const wood = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const { depth, board } = style;
    const back = -depth / 2;
    block(plan.planks, place, [0, 0, 0], [item.length, board, depth], wood, {}, 1.2);
    for (const x of [-item.length / 2 + 0.12, item.length / 2 - 0.12]) {
      block(plan.planks, place, [x, -style.bracket / 2, back + 0.02], [0.03, style.bracket, 0.03], wood, {}, 1.2);
      block(plan.planks, place, [x, -style.bracket * 0.42, back + depth * 0.38], [0.025, style.bracket * 1.05, 0.025], wood, { tiltX: 0.75 }, 1.2);
    }
    const styles = plan.furnitureStyles;
    const colors = style.colors;
    for (const thing of item.items) {
      const spot = turn(place, [thing.at, board / 2, 0.02]);
      const sub = { x: spot.x, y: spot.y, z: spot.z, yaw: (place.yaw || 0) + (thing.yaw || 0) };
      if (thing.kind === 'bottle') this.pirateBottle(plan.painted, styles.bottle, sub, thing.color || styles.bottle.colors[0]);
      else if (thing.kind === 'mug') this.pirateMug(plan, styles.mug, sub);
      else if (thing.kind === 'jar') {
        block(plan.painted, sub, [0, 0.08, 0], [0.11, 0.16, 0.11], plain(colors.jar));
        block(plan.painted, sub, [0, 0.17, 0], [0.08, 0.025, 0.08], plain(colors.lid));
      } else if (thing.kind === 'candle') {
        cylinder(plan.painted, sub, [0, 0, 0], [0, thing.height, 0], 0.02, plain(colors.candle), { sides: 8, bulge: 0.08 });
        cylinder(plan.painted, sub, [0, thing.height, 0], [0, thing.height + 0.015, 0], 0.003, plain(colors.wick), { sides: 4 });
      } else if (thing.kind === 'coins') {
        thing.stacks.forEach(([dx, dz, count]) => {
          for (let k = 0; k < count; k += 1) {
            const wobble = ((k * 37) % 7) * 0.0015;
            cylinder(plan.painted, sub, [dx + wobble, k * 0.006, dz - wobble], [dx + wobble, (k + 1) * 0.006, dz - wobble], 0.022, plain(colors.gold), { sides: 10 });
          }
        });
      } else if (thing.kind === 'box') {
        const [w, h, d] = thing.size;
        block(plan.planks, sub, [0, h / 2, 0], [w, h, d], wood, {}, 1.2);
        block(plan.planks, sub, [0, h + 0.02, 0], [w + 0.01, 0.04, d + 0.01], wood, {}, 1.2);
        for (const x of [-w * 0.3, w * 0.3]) block(plan.painted, sub, [x, h * 0.6, 0], [0.02, h * 1.25, d + 0.015], plain(colors.iron));
        block(plan.painted, sub, [0, h * 0.75, d / 2 + 0.006], [0.035, 0.045, 0.01], plain(colors.iron));
      } else if (thing.kind === 'scroll') {
        cylinder(plan.painted, sub, [-thing.length / 2, 0.03, 0], [thing.length / 2, 0.03, 0], 0.03, plain(colors.paper), { sides: 9 });
        cylinder(plan.painted, sub, [-0.02, 0.03, 0], [0.02, 0.03, 0], 0.033, plain(colors.tie), { sides: 9 });
      }
    }
  },

  pirateChest(plan, style, place) {
    const wood = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const iron = plain(style.iron);
    const [w, h, d] = style.size;
    const body = h - style.lid;
    block(plan.planks, place, [0, body / 2, 0], [w, body, d], wood, {}, 1.2);
    block(plan.planks, place, [0, body + style.lid / 2, 0], [w + 0.02, style.lid, d + 0.02], wood, {}, 1.2);
    for (const x of style.bands) block(plan.painted, place, [x * w, h / 2, 0], [0.035, h + 0.012, d + 0.03], iron);
    for (const z of [-d / 2, d / 2]) block(plan.painted, place, [0, 0.03, z], [w + 0.02, 0.05, 0.012], iron);
    block(plan.painted, place, [0, body - 0.02, d / 2 + 0.018], [0.07, 0.09, 0.02], iron);
    for (const x of [-w / 2 - 0.02, w / 2 + 0.02]) block(plan.painted, place, [x, body * 0.7, 0], [0.02, 0.025, 0.12], iron);
  },

  pirateBench(plan, style, place) {
    const [length, height] = style.size;
    const seat = style.seat;
    for (const x of [-length * 0.32, length * 0.32]) {
      const foot = turn(place, [x, 0, 0]);
      const stump = { from: foot.y - 0.1, to: foot.y + height - seat * 1.6, radius: style.stump, startLift: 0, endLift: 0, sag: 0, bow: 0, taper: 0.1, bulge: 0.05, bulgeWaves: 1, bulgePhase: 0, segments: 3, sides: 10, shiftU: x, shiftV: 0 };
      this.addLog(plan, stump, placeUpright(foot.x, foot.z), this.logShade(plan), false, true);
    }
    const start = turn(place, [-length / 2, 0, 0]);
    const end = turn(place, [length / 2, 0, 0]);
    const log = { from: -length / 2, to: length / 2, radius: seat, startLift: place.y + height - seat, endLift: place.y + height - seat, sag: 0.02, bow: 0.02, taper: 0.12, bulge: 0.05, bulgeWaves: 2, bulgePhase: 0.3, segments: 6, sides: 10, shiftU: start.x, shiftV: end.z };
    const yaw = place.yaw || 0;
    const along = (a, lift, side) => [place.x + a * Math.cos(yaw) + side * Math.sin(yaw), lift, place.z - a * Math.sin(yaw) + side * Math.cos(yaw)];
    this.addLog(plan, log, along, this.logShade(plan));
  },
};
