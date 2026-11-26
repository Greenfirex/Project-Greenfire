// Část staveb: zabudovaný nábytek — síťová houpací síť v patře a knihovna s přihrádkami a pár drobnostmi před
// tajným vchodem; knihovnu odsune skrytá páka a je pro postavu i tvory překážka. Patří k BuildingSystem (sdílí jeho this).
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, pushSheet, pushLog, roughLog, placeAlongX, placeUpright, pushPiece as piece } from '../../utils/buildingGeometry.js';
import { fishingNetTexture } from '../../utils/pirateCloth.js';
import { PIRATE_KINDS } from './buildingPirate.js';
import { pushBottle } from '../../utils/pirateTrinkets.js';
import { FURNITURE_STYLES } from '../../data/catalogs/furniture.js';
import { createRng, seedFor } from '../../utils/rng.js';

export default {
  buildFurniture(plan, furniture) {
    for (const [index, item] of furniture.items.entries()) {
      const upper = item.on === 'upper';
      this.useLayer(plan, upper ? 'upper' : 'lower');
      const base = upper ? plan.upperTop || 0 : item.on === 'ground' ? plan.groundAt(item.at[0], item.at[1]) : 0;
      const rng = createRng(seedFor(0, `${plan.name}:furniture:${item.kind}`, index, 0));
      const style = furniture.styles[item.kind];
      const place = { x: item.at[0], y: base + (item.lift || 0), z: item.at[1], yaw: item.yaw || 0, tilt: item.tilt || 0 };
      if (PIRATE_KINDS.has(item.kind)) {
        this.pirateProp(plan, style, item, place);
        continue;
      }
      const shade = 1 + (rng() - 0.5) * style.shadeSpread;
      const tint = style.tint.map((value) => value * shade);
      const paint = (x, y, z, up) => plan.paint(tint, x, y, z, up);
      if (item.kind === 'hammock') this.furnitureHammock(plan, style, item, base, rng);
      else if (item.kind === 'bookcase') this.furnitureBookcase(plan, style, item, base, paint, rng);
    }
    this.useLayer(plan, 'lower');
  },

  furnitureBlock(plan, place, size, base, height, door = null) {
    const turned = Math.abs(Math.sin(place.yaw || 0)) > 0.7;
    const sx = turned ? size[2] : size[0];
    const sz = turned ? size[0] : size[2];
    const alongX = sx >= sz;
    const length = alongX ? sx : sz;
    plan.blocks.push({
      alongX,
      at: alongX ? place.z : place.x,
      from: (alongX ? place.x : place.z) - length / 2,
      to: (alongX ? place.x : place.z) + length / 2,
      bottom: base,
      top: base + height,
      half: (alongX ? sz : sx) / 2,
      door,
    });
  },

  furnitureHammock(plan, style, item, base, rng) {
    const [x0, x1] = item.span;
    const z = item.at[1];
    const hang = base + style.hang;
    const net = createBuffer();
    const white = (x, y, zz, up) => plan.paint([1, 1, 1], x, y, zz, up);
    const from = x0 + style.rope;
    const to = x1 - style.rope;
    pushSheet(net, 16, 6, (u, v) => {
      const width = style.width * Math.pow(Math.sin(Math.PI * u), 0.6) + 0.04;
      const across = (v - 0.5) * width;
      return [from + (to - from) * u, hang - style.sag * 4 * u * (1 - u) + style.curl * (across / style.width) ** 2, z + across];
    }, white);
    plan.sheets.push({ suffix: 'hammock', buffer: net, material: this.drawnMaterial(`buildingNetMat_${plan.key}`, () => fishingNetTexture(this.s, `buildingNet_${plan.key}`, plan.netColors), true), part: 'upper' });
    const ropeTint = style.ropeTint;
    for (const [end, anchor, top] of [[from, x0, item.anchorTop[0]], [to, x1, item.anchorTop[1]]]) {
      const rope = roughLog(rng, plan.walls, Math.min(end, anchor), Math.max(end, anchor), 0, style.ropeRadius, 3);
      rope.startLift = end < anchor ? hang : base + top;
      rope.endLift = end < anchor ? base + top : hang;
      this.addLog(plan, rope, placeAlongX(z), ropeTint, false, false);
    }
    if (item.post) {
      const post = roughLog(rng, plan.walls, base - 0.05, base + item.anchorTop[1] + 0.12, 0, style.post, 3);
      post.startLift = 0;
      post.endLift = 0;
      this.addLog(plan, post, placeUpright(x1, z), this.logShade(plan), false, true);
    }
    plan.blocks.push({ alongX: true, at: z, from, to, bottom: base + style.blockFrom, top: base + style.blockTo, half: style.width / 2 });
  },

  furnitureBookcase(plan, style, item, base, paint, rng) {
    const [w, h, d] = style.size;
    const t = style.board;
    const wood = createBuffer();
    const decor = createBuffer();
    const lever = createBuffer();
    const origin = { x: 0, y: 0, z: 0, yaw: 0, tilt: 0 };
    for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) piece(wood, origin, [x, h / 2, 0], [t, h, d], paint, style.tile, rng);
    for (let row = 0; row <= style.rows; row += 1) {
      const y = row === 0 ? style.plinth : style.plinth + ((h - style.plinth - t) / style.rows) * row;
      piece(wood, origin, [0, y + t / 2, 0], [w - t * 2, t, d - 0.01], paint, style.tile, rng);
    }
    piece(wood, origin, [0, style.plinth / 2, d / 2 - t], [w - t * 2, style.plinth, t], paint, style.tile, rng);
    const backs = Math.max(2, Math.round(w / 0.2));
    for (let k = 0; k < backs; k += 1) {
      piece(wood, origin, [-w / 2 + (w / backs) * (k + 0.5), h / 2, -d / 2 + 0.01], [w / backs - 0.01, h - 0.02, 0.02], paint, style.tile, rng);
    }
    const rowHeight = (h - style.plinth - t) / style.rows;
    const cellWidth = (w - t * 2) / style.cols;
    for (let col = 1; col < style.cols; col += 1) {
      piece(wood, origin, [-w / 2 + t + cellWidth * col, style.plinth + (h - style.plinth) / 2, 0], [t, h - style.plinth - t, d - 0.01], paint, style.tile, rng);
    }
    const colorOf = (color) => (x, y, z, up) => plan.paint(color, x, y, z, up);
    for (const thing of style.decor) {
      const left = -w / 2 + t + cellWidth * thing.cell[1] + 0.05;
      const floor = style.plinth + t + rowHeight * thing.cell[0];
      let x = left;
      if (thing.kind === 'books') {
        for (const [index, book] of thing.books.entries()) {
          const lean = index === thing.books.length - 1 && thing.lean ? thing.lean : 0;
          const [bw, bh] = book.size;
          piece(decor, { ...origin, tilt: 0 }, [x + bw / 2 + Math.abs(lean) * bh / 2, floor + bh / 2, 0.02], [bw, bh, d * 0.6], colorOf(book.color), 1);
          x += bw + 0.004;
        }
      } else if (thing.kind === 'jar') {
        piece(decor, origin, [left + thing.size[0] / 2 + thing.shift, floor + thing.size[1] / 2, 0.02], [thing.size[0], thing.size[1], thing.size[0]], colorOf(thing.color), 1);
        piece(decor, origin, [left + thing.size[0] / 2 + thing.shift, floor + thing.size[1] + 0.012, 0.02], [thing.size[0] * 0.7, 0.024, thing.size[0] * 0.7], colorOf(thing.lid), 1);
      } else if (thing.kind === 'bottle') {
        pushBottle(decor, FURNITURE_STYLES.bottle, { x: left + thing.shift, y: floor, z: 0.02, yaw: 0 }, thing.color);
      } else if (thing.kind === 'scroll') {
        const scroll = roughLog(rng, plan.walls, left + thing.shift, left + thing.shift + thing.length, floor + thing.radius, thing.radius, 3);
        pushLog(decor, scroll, placeAlongX(0.03), colorOf(thing.color), 1);
      }
    }
    const [lx, ly, lz] = style.lever.at;
    piece(lever, origin, [lx, ly, lz], style.lever.plate, colorOf(style.lever.color), 1);
    piece(lever, { ...origin, tilt: style.lever.angle }, [lx + style.lever.plate[0] / 2 + style.lever.handle[0] / 2, ly + style.lever.handle[1] * 0.35, lz], style.lever.handle, colorOf(style.lever.color), 1);

    const slider = new TransformNode(`${plan.name}_bookcase`, this.s);
    slider.parent = plan.root;
    const home = new Vector3(item.at[0], base, item.at[1]);
    slider.position.copyFrom(home);
    const middle = Vector3.TransformCoordinates(home, plan.world);
    const id = `${plan.name}:${plan.layer}:bookcase:${item.at.join(',')}`;
    const door = {
      id,
      kind: 'slide',
      node: slider,
      home,
      axis: new Vector3(1, 0, 0),
      slide: item.slide,
      style: style.motion,
      part: plan.layer,
      secret: true,
      pieces: [
        { buffer: wood, material: 'planks' },
        { buffer: decor, material: 'paint' },
        { buffer: lever, material: 'paint', handle: true },
      ],
      mesh: null,
      open: 0,
      goal: 0,
      x: middle.x,
      y: middle.y,
      z: middle.z,
    };
    plan.doorList.push(door);
    this.furnitureBlock(plan, { x: item.at[0], z: item.at[1], yaw: 0 }, style.size, base, h, door);
  },
};
