// Část staveb: zabudovaný nábytek — lucerna na stole, ponk s nářadím, síťová houpací síť v patře a knihovna
// s přihrádkami a pár drobnostmi před tajným vchodem; knihovnu odsune skrytá páka. Ponk a knihovna jsou pro postavu
// i tvory překážka; kus s `use` je pracovní místo (zvýrazní se pod myší, klik ho použije). Patří k BuildingSystem (sdílí jeho this).
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createBuffer, meshFromBuffer, pushSheet, pushLog, roughLog, placeAlongX, placeUpright, pushPiece as piece } from '../../utils/buildingGeometry.js';
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
      if (item.kind === 'lantern') {
        this.furnitureLantern(plan, style, item, place, base, index);
        continue;
      }
      const shared = plan.planks;
      if (item.use) plan.planks = createBuffer();
      if (item.kind === 'workbench') {
        this.furnitureWorkbench(plan, style, place, paint, rng);
        this.furnitureBlock(plan, place, style.size, base, style.size[1]);
      } else if (item.kind === 'hammock') this.furnitureHammock(plan, style, item, base, rng);
      else if (item.kind === 'bookcase') this.furnitureBookcase(plan, style, item, base, paint, rng);
      if (item.use) {
        const middle = Vector3.TransformCoordinates(new Vector3(place.x, base, place.z), plan.world);
        plan.stationList.push({ id: `${plan.name}:${item.kind}:${index}`, use: item.use, buffer: plan.planks, part: plan.layer, mesh: null, x: middle.x, y: middle.y, z: middle.z });
        plan.planks = shared;
      }
    }
    this.useLayer(plan, 'lower');
  },

  finishStations(plan, materials) {
    for (const station of plan.stationList) {
      const mesh = meshFromBuffer(`${plan.name}_station_${this.stations.length}`, station.buffer, this.s);
      station.buffer = null;
      if (!mesh) continue;
      mesh.parent = plan.root;
      mesh.material = materials[station.material || 'planks'];
      this.addPartMesh(plan, mesh, station.part, true);
      mesh.isPickable = true;
      mesh.metadata.station = station;
      station.mesh = mesh;
      this.stations.push(station);
      if (station.lamp) this.finishLamp(plan, station);
    }
  },

  furnitureLantern(plan, style, item, place, base, index) {
    const frame = createBuffer();
    const glass = createBuffer();
    const flame = createBuffer();
    const metal = (x, y, z, up) => plan.paint(style.metal, x, y, z, up);
    const wax = (x, y, z, up) => plan.paint(style.candle, x, y, z, up);
    const plain = () => [1, 1, 1];
    const [w, h] = style.size;
    const half = w / 2;
    const post = w * 0.09;
    const foot = h * 0.06;
    const body = h * 0.5;
    const roof = foot + body;
    piece(frame, place, [0, foot / 2, 0], [w, foot, w], metal, 1);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      piece(frame, place, [x * (half - post / 2), foot + body / 2, z * (half - post / 2)], [post, body, post], metal, 1);
    }
    piece(frame, place, [0, roof + foot / 2, 0], [w * 1.1, foot, w * 1.1], metal, 1);
    piece(frame, place, [0, roof + foot * 1.8, 0], [w * 0.7, foot * 1.6, w * 0.7], metal, 1);
    piece(frame, place, [0, roof + foot * 3.1, 0], [w * 0.35, foot, w * 0.35], metal, 1);
    for (const x of [-1, 1]) piece(frame, place, [x * w * 0.2, h - foot * 1.2, 0], [post * 0.7, foot * 2.4, post * 0.7], metal, 1);
    piece(frame, place, [0, h, 0], [w * 0.48, post * 0.7, post * 0.7], metal, 1);
    piece(frame, place, [0, foot + body * 0.18, 0], [w * 0.2, body * 0.36, w * 0.2], wax, 1);
    for (const turn of [0, Math.PI / 2]) {
      for (const side of [-1, 1]) {
        piece(glass, { ...place, yaw: place.yaw + turn }, [0, foot + body / 2, side * (half - post / 2)], [w - post * 2, body, 0.004], plain, 1);
      }
    }
    piece(flame, place, [0, foot + body * 0.36 + body * 0.1, 0], [w * 0.12, body * 0.2, w * 0.12], plain, 1);
    const lightAt = new Vector3(place.x, place.y + foot + body * 0.5, place.z);
    const middle = Vector3.TransformCoordinates(new Vector3(place.x, base, place.z), plan.world);
    plan.stationList.push({
      id: `${plan.name}:lantern:${index}`,
      use: item.use,
      buffer: frame,
      material: 'paint',
      part: plan.layer,
      mesh: null,
      x: middle.x,
      y: middle.y,
      z: middle.z,
      lamp: { glass, flame, lightAt, style },
    });
  },

  stationAt(pointerX, pointerY, point) {
    return this.pickInteractive(this.stations, 'station', pointerX, pointerY, point);
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

  furnitureWorkbench(plan, style, place, paint, rng) {
    const [w, h, d] = style.size;
    piece(plan.planks, place, [0, h - style.top / 2, 0], [w, style.top, d], paint, style.tile, rng);
    const lx = w / 2 - style.inset;
    const lz = d / 2 - style.inset;
    for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
      piece(plan.planks, place, [x, (h - style.top) / 2, z], [style.leg, h - style.top, style.leg], paint, style.tile, rng);
    }
    piece(plan.planks, place, [0, style.shelf, 0], [w - style.inset * 2, style.top * 0.6, d - style.inset * 2], paint, style.tile, rng);
    for (const tool of style.tools) {
      piece(plan.planks, { ...place, yaw: place.yaw + tool.yaw }, [tool.at[0], h + tool.size[1] / 2, tool.at[1]], tool.size, paint, style.tile, rng);
    }
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
