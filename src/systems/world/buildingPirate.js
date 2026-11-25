// Část staveb: pirátské drobnosti ve srubu — mapa pokladu přišpendlená dýkou, láhve od rumu (i rozbitá) a cínové
// hrnky, kormidelní kolo na stěně, dalekohled, kompas a police na stěnách s láhvemi, mincemi, svíčkami a truhličkou.
// Vše je složené z válců a kvádrů v kódu. Patří k BuildingSystem (sdílí jeho this).
import { createBuffer, pushSheet, turnPoint, pushCylinder, pushPlacedBox, pushHoop, flatPaint } from '../../utils/buildingGeometry.js';
import { treasureMapTexture } from '../../utils/pirateCloth.js';

export const PIRATE_KINDS = new Set(['map', 'bottle', 'mug', 'wheel', 'spyglass', 'compass', 'shelf']);

export default {
  pirateProp(plan, style, item, place) {
    if (item.kind === 'map') this.pirateMap(plan, style, place);
    else if (item.kind === 'bottle') this.pirateBottle(plan.painted, style, place, item.color || style.colors[0], item.broken);
    else if (item.kind === 'mug') this.pirateMug(plan, style, place);
    else if (item.kind === 'wheel') this.pirateWheel(plan, style, place);
    else if (item.kind === 'spyglass') this.pirateSpyglass(plan, style, place);
    else if (item.kind === 'compass') this.pirateCompass(plan, style, place);
    else if (item.kind === 'shelf') this.pirateShelf(plan, style, item, place);
  },

  pirateMap(plan, style, place) {
    const sheet = createBuffer();
    const [w, , d] = style.size;
    pushSheet(sheet, 8, 6, (u, v) => {
      const curl = style.curl * (Math.pow(Math.abs(u - 0.5) * 2, 4) + Math.pow(Math.abs(v - 0.5) * 2, 4));
      const p = turnPoint(place, [(u - 0.5) * w, curl + 0.002, (v - 0.5) * d]);
      return [p.x, p.y, p.z];
    }, flatPaint([1, 1, 1]));
    plan.sheets.push({ suffix: 'map', buffer: sheet, material: this.drawnMaterial(`buildingMapMat_${plan.key}`, () => treasureMapTexture(this.s, `buildingMap_${plan.key}`, style.colors), true), part: plan.layer });
    const steel = flatPaint(style.steel);
    const grip = flatPaint(style.grip);
    const [dx, dz] = style.dagger;
    const tip = turnPoint(place, [dx, 0, dz]);
    const dagger = { ...place, x: tip.x, z: tip.z, tilt: style.daggerTilt };
    pushPlacedBox(plan.painted, dagger, [0, 0.03, 0], [0.025, 0.12, 0.006], steel);
    pushPlacedBox(plan.painted, dagger, [0, 0.1, 0], [0.08, 0.014, 0.018], steel);
    pushCylinder(plan.painted, dagger, [0, 0.105, 0], [0, 0.2, 0], 0.012, grip);
    pushCylinder(plan.painted, dagger, [0, 0.2, 0], [0, 0.215, 0], 0.017, steel);
  },

  pirateBottle(buffer, style, place, color, broken = false) {
    const glass = flatPaint(color);
    const cork = flatPaint(style.cork);
    const r = style.radius;
    const [body, shoulder, neck] = style.heights;
    if (broken) {
      const lying = { ...place, tilt: Math.PI / 2, y: place.y + r };
      pushCylinder(buffer, lying, [0, 0, 0], [0, body * 0.55, 0], r, glass, { caps: false, sides: 9 });
      pushCylinder(buffer, lying, [0, body * 0.55, 0], [0, body * 0.7, 0], r, glass, { taper: 0.6, sides: 9 });
      pushCylinder(buffer, lying, [0, body * 0.7, 0], [0, body * 0.7 + neck - shoulder, 0], r * 0.36, glass, { sides: 8 });
      for (const [x, z, s] of style.shards) pushPlacedBox(buffer, place, [x, 0.004, z], [s, 0.006, s * 0.7], glass, { yaw: x * 9 });
      return;
    }
    pushCylinder(buffer, place, [0, 0, 0], [0, body, 0], r, glass, { sides: 10 });
    pushCylinder(buffer, place, [0, body, 0], [0, shoulder, 0], r, glass, { taper: 0.62, sides: 10 });
    pushCylinder(buffer, place, [0, shoulder, 0], [0, neck, 0], r * 0.36, glass, { sides: 8 });
    pushCylinder(buffer, place, [0, neck, 0], [0, neck + 0.018, 0], r * 0.33, cork, { sides: 8 });
  },

  pirateMug(plan, style, place) {
    const pewter = flatPaint(style.pewter);
    pushCylinder(plan.painted, place, [0, 0, 0], [0, style.height, 0], style.radius, pewter, { sides: 12, taper: -0.08 });
    pushPlacedBox(plan.painted, place, [style.radius + 0.018, style.height * 0.55, 0], [0.014, style.height * 0.6, 0.016], pewter);
    for (const y of [0.25, 0.85]) pushPlacedBox(plan.painted, place, [style.radius + 0.01, style.height * y, 0], [0.026, 0.012, 0.014], pewter);
  },

  pirateWheel(plan, style, place) {
    const paint = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const r = style.radius;
    pushHoop(plan.planks, place, [0, 0, 0], r, style.rim, 'yz', paint, 18);
    for (let k = 0; k < style.spokes; k += 1) {
      const angle = (k / style.spokes) * Math.PI * 2;
      const dir = [0, Math.sin(angle), Math.cos(angle)];
      const at = (d) => [0, dir[1] * d, dir[2] * d];
      pushCylinder(plan.planks, place, at(0.05), at(r), style.spoke, paint, { sides: 7 });
      pushCylinder(plan.planks, place, at(r), at(r + style.handle), style.spoke * 1.4, paint, { sides: 7, taper: 0.3 });
    }
    pushCylinder(plan.planks, place, [-0.05, 0, 0], [0.05, 0, 0], style.hub, paint, { sides: 12 });
    pushCylinder(plan.planks, place, [0.05, 0, 0], [style.peg, 0, 0], style.spoke, paint, { sides: 7 });
  },

  pirateSpyglass(plan, style, place) {
    const brass = flatPaint(style.brass);
    const lift = style.tubes[0][1];
    let along = 0;
    for (const [length, radius] of style.tubes) {
      pushCylinder(plan.painted, place, [along, lift, 0], [along + length, lift, 0], radius, brass, { sides: 12 });
      along += length;
    }
    pushHoop(plan.painted, place, [0.004, lift, 0], style.tubes[0][1], 0.006, 'yz', brass, 10);
  },

  pirateCompass(plan, style, place) {
    const brass = flatPaint(style.brass);
    pushCylinder(plan.painted, place, [0, 0, 0], [0, style.height, 0], style.radius, brass, { sides: 14 });
    pushCylinder(plan.painted, place, [0, style.height, 0], [0, style.height + 0.002, 0], style.radius * 0.84, flatPaint(style.face), { sides: 14 });
    pushPlacedBox(plan.painted, place, [0, style.height + 0.004, 0], [0.006, 0.003, style.radius * 1.4], flatPaint(style.needle));
  },

  pirateShelf(plan, style, item, place) {
    const wood = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const { depth, board } = style;
    const back = -depth / 2;
    pushPlacedBox(plan.planks, place, [0, 0, 0], [item.length, board, depth], wood, {}, 1.2);
    for (const x of [-item.length / 2 + 0.12, item.length / 2 - 0.12]) {
      pushPlacedBox(plan.planks, place, [x, -style.bracket / 2, back + 0.02], [0.03, style.bracket, 0.03], wood, {}, 1.2);
      pushPlacedBox(plan.planks, place, [x, -style.bracket * 0.42, back + depth * 0.38], [0.025, style.bracket * 1.05, 0.025], wood, { tiltX: 0.75 }, 1.2);
    }
    const styles = plan.furnitureStyles;
    const colors = style.colors;
    for (const thing of item.items) {
      const spot = turnPoint(place, [thing.at, board / 2, 0.02]);
      const sub = { x: spot.x, y: spot.y, z: spot.z, yaw: (place.yaw || 0) + (thing.yaw || 0) };
      if (thing.kind === 'bottle') this.pirateBottle(plan.painted, styles.bottle, sub, thing.color || styles.bottle.colors[0]);
      else if (thing.kind === 'mug') this.pirateMug(plan, styles.mug, sub);
      else if (thing.kind === 'jar') {
        pushPlacedBox(plan.painted, sub, [0, 0.08, 0], [0.11, 0.16, 0.11], flatPaint(colors.jar));
        pushPlacedBox(plan.painted, sub, [0, 0.17, 0], [0.08, 0.025, 0.08], flatPaint(colors.lid));
      } else if (thing.kind === 'candle') {
        pushCylinder(plan.painted, sub, [0, 0, 0], [0, thing.height, 0], 0.02, flatPaint(colors.candle), { sides: 8, bulge: 0.08 });
        pushCylinder(plan.painted, sub, [0, thing.height, 0], [0, thing.height + 0.015, 0], 0.003, flatPaint(colors.wick), { sides: 4 });
      } else if (thing.kind === 'coins') {
        thing.stacks.forEach(([dx, dz, count]) => {
          for (let k = 0; k < count; k += 1) {
            const wobble = ((k * 37) % 7) * 0.0015;
            pushCylinder(plan.painted, sub, [dx + wobble, k * 0.006, dz - wobble], [dx + wobble, (k + 1) * 0.006, dz - wobble], 0.022, flatPaint(colors.gold), { sides: 10 });
          }
        });
      } else if (thing.kind === 'box') {
        const [w, h, d] = thing.size;
        pushPlacedBox(plan.planks, sub, [0, h / 2, 0], [w, h, d], wood, {}, 1.2);
        pushPlacedBox(plan.planks, sub, [0, h + 0.02, 0], [w + 0.01, 0.04, d + 0.01], wood, {}, 1.2);
        for (const x of [-w * 0.3, w * 0.3]) pushPlacedBox(plan.painted, sub, [x, h * 0.6, 0], [0.02, h * 1.25, d + 0.015], flatPaint(colors.iron));
        pushPlacedBox(plan.painted, sub, [0, h * 0.75, d / 2 + 0.006], [0.035, 0.045, 0.01], flatPaint(colors.iron));
      } else if (thing.kind === 'scroll') {
        pushCylinder(plan.painted, sub, [-thing.length / 2, 0.03, 0], [thing.length / 2, 0.03, 0], 0.03, flatPaint(colors.paper), { sides: 9 });
        pushCylinder(plan.painted, sub, [-0.02, 0.03, 0], [0.02, 0.03, 0], 0.033, flatPaint(colors.tie), { sides: 9 });
      }
    }
  },
};
