// Část staveb: pirátské věci napevno ve srubu — kormidelní kolo na stěně a police na stěnách s láhvemi, hrnky,
// mincemi, svíčkami a truhličkou. Vše je složené z válců a kvádrů v kódu. Patří k BuildingSystem (sdílí jeho this).
import { turnPoint, pushCylinder, pushPlacedBox, pushHoop, flatPaint } from '../../utils/buildingGeometry.js';
import { pushBottle, pushMug } from '../../utils/pirateTrinkets.js';
import { FURNITURE_STYLES } from '../../data/catalogs/furniture.js';

export const PIRATE_KINDS = new Set(['wheel', 'shelf']);

export default {
  pirateProp(plan, style, item, place) {
    if (item.kind === 'wheel') this.pirateWheel(plan, style, place);
    else if (item.kind === 'shelf') this.pirateShelf(plan, style, item, place);
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

  pirateShelf(plan, style, item, place) {
    const wood = (x, y, z, up) => plan.paint(style.tint, x, y, z, up);
    const { depth, board } = style;
    const back = -depth / 2;
    pushPlacedBox(plan.planks, place, [0, 0, 0], [item.length, board, depth], wood, {}, 1.2);
    for (const x of [-item.length / 2 + 0.12, item.length / 2 - 0.12]) {
      pushPlacedBox(plan.planks, place, [x, -style.bracket / 2, back + 0.02], [0.03, style.bracket, 0.03], wood, {}, 1.2);
      pushPlacedBox(plan.planks, place, [x, -style.bracket * 0.42, back + depth * 0.38], [0.025, style.bracket * 1.05, 0.025], wood, { tiltX: 0.75 }, 1.2);
    }
    const colors = style.colors;
    for (const thing of item.items) {
      const spot = turnPoint(place, [thing.at, board / 2, 0.02]);
      const sub = { x: spot.x, y: spot.y, z: spot.z, yaw: (place.yaw || 0) + (thing.yaw || 0) };
      if (thing.kind === 'bottle') pushBottle(plan.painted, FURNITURE_STYLES.bottle, sub, thing.color);
      else if (thing.kind === 'mug') pushMug(plan.painted, FURNITURE_STYLES.mug, sub);
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
