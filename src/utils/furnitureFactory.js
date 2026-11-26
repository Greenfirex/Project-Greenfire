// Šablona volně stojícího nábytku (stůl, židle, truhla, sud, bedna, kotva, lano, loďka, lavička) a drobností
// na něj, složených z prken, válců a kvádrů. Dřevo má pevné opotřebení (mech a špína dole), každý kus se staví jednou.
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Material } from '@babylonjs/core/Materials/material';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import {
  createBuffer, meshFromBuffer, pushBox, pushLog, pushLogEnd, pushSheet, placeAlongX, placeUpright,
  turnPoint, pushPiece, pushPlacedBox, pushCylinder, pushHoop, flatPaint,
} from './buildingGeometry.js';
import { agePaint } from './agePaint.js';
import { logEndTexture } from './logEndTexture.js';
import { plankMaterial } from './plankFactory.js';
import { pushBottle, pushMug, pushSpyglass, pushCompass, mapSheet, pushMapDagger } from './pirateTrinkets.js';
import { treasureMapTexture } from './pirateCloth.js';
import { createRng } from './rng.js';
import { LOG_TEXTURE, LOG_NORMAL } from '../data/catalogs/assetPaths.js';
import { FURNITURE_STYLES, FURNITURE_WEAR, LOG_END_COLORS } from '../data/catalogs/furniture.js';

const templates = new WeakMap();
const materialSets = new WeakMap();

function materialsFor(scene) {
  const cached = materialSets.get(scene);
  if (cached) return cached;
  const painted = new StandardMaterial('furniturePaintMat', scene);
  painted.specularColor = new Color3(0.04, 0.04, 0.04);
  const logs = new StandardMaterial('furnitureLogMat', scene);
  const color = new Texture(LOG_TEXTURE, scene);
  color.wrapU = Texture.WRAP_ADDRESSMODE;
  color.wrapV = Texture.WRAP_ADDRESSMODE;
  color.anisotropicFilteringLevel = 4;
  logs.diffuseTexture = color;
  const bump = new Texture(LOG_NORMAL, scene);
  bump.wrapU = Texture.WRAP_ADDRESSMODE;
  bump.wrapV = Texture.WRAP_ADDRESSMODE;
  bump.gammaSpace = false;
  logs.bumpTexture = bump;
  logs.specularColor = new Color3(0.03, 0.03, 0.03);
  const ends = new StandardMaterial('furnitureLogEndMat', scene);
  ends.diffuseTexture = logEndTexture(scene, 'furnitureLogEnd', LOG_END_COLORS);
  ends.specularColor = new Color3(0.02, 0.02, 0.02);
  const set = { planks: plankMaterial(scene), painted, logs, ends };
  materialSets.set(scene, set);
  return set;
}

function mapMaterial(scene, materials) {
  if (materials.map) return materials.map;
  const material = new StandardMaterial('furnitureMapMat', scene);
  material.diffuseTexture = treasureMapTexture(scene, 'furnitureMap', FURNITURE_STYLES.map.colors);
  material.diffuseTexture.hasAlpha = true;
  material.useAlphaFromDiffuseTexture = true;
  material.transparencyMode = Material.MATERIAL_ALPHATEST;
  material.alphaCutOff = 0.4;
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
  material.specularColor = new Color3(0.02, 0.02, 0.02);
  materials.map = material;
  return material;
}

function shaded(out, style) {
  const shade = 1 + (out.rng() - 0.5) * (style.shadeSpread || 0);
  const tint = style.tint.map((value) => value * shade);
  return (x, y, z, up) => out.paint(tint, x, y, z, up);
}

function addLog(out, log, place, tint, style, capFrom = true, capTo = true) {
  const paint = (x, y, z, up) => out.paint(tint, x, y, z, up, 0, style.weather);
  const rings = pushLog(out.logs, log, place, paint, style.logTile);
  if (capFrom) pushLogEnd(out.ends, rings[0], log.sides, out.rng() * Math.PI * 2, -1, place, paint);
  if (capTo) pushLogEnd(out.ends, rings[rings.length - 1], log.sides, out.rng() * Math.PI * 2, 1, place, paint);
}

function logShade(out, style) {
  const shade = 1 + (out.rng() - 0.5) * style.logShadeSpread;
  return style.logTint.map((value) => value * shade);
}

function buildTable(out, style, place) {
  const paint = shaded(out, style);
  const { rng } = out;
  const [w, h, d] = style.size;
  const planks = Math.max(2, Math.round(d / style.plank));
  for (let k = 0; k < planks; k += 1) {
    const z = -d / 2 + (d / planks) * (k + 0.5);
    pushPiece(out.planks, place, [0, h - style.top / 2 + (rng() - 0.5) * 0.008, z], [w + (rng() - 0.5) * 0.04, style.top, d / planks - 0.008], paint, style.tile, rng);
  }
  const lx = w / 2 - style.inset;
  const lz = d / 2 - style.inset;
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
    pushPiece(out.planks, place, [x, (h - style.top) / 2, z], [style.leg, h - style.top, style.leg], paint, style.tile, rng);
  }
  for (const z of [-lz, lz]) pushPiece(out.planks, place, [0, style.rail, z], [w - style.inset * 2, style.leg * 0.7, style.leg * 0.5], paint, style.tile, rng);
}

function buildChair(out, style, place) {
  const paint = shaded(out, style);
  const { rng } = out;
  const [w, , d] = style.size;
  const seat = style.seat;
  pushPiece(out.planks, place, [0, seat, 0], [w, style.top, d], paint, style.tile, rng);
  const lx = w / 2 - style.leg / 2;
  const lz = d / 2 - style.leg / 2;
  for (const [x, z] of [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]) {
    pushPiece(out.planks, place, [x, seat / 2, z], [style.leg, seat, style.leg], paint, style.tile, rng);
  }
  const back = style.size[1] - seat;
  for (const x of [-lx, lx]) pushPiece(out.planks, place, [x, seat + back / 2, -lz], [style.leg, back, style.leg], paint, style.tile, rng);
  for (const share of style.slats) pushPiece(out.planks, place, [0, seat + back * share, -lz], [w - style.leg, style.slat, style.leg * 0.6], paint, style.tile, rng);
}

function buildChest(out, style, place) {
  const wood = (x, y, z, up) => out.paint(style.tint, x, y, z, up);
  const iron = flatPaint(style.iron);
  const [w, h, d] = style.size;
  const body = h - style.lid;
  pushPlacedBox(out.planks, place, [0, body / 2, 0], [w, body, d], wood, {}, 1.2);
  pushPlacedBox(out.planks, place, [0, body + style.lid / 2, 0], [w + 0.02, style.lid, d + 0.02], wood, {}, 1.2);
  for (const x of style.bands) pushPlacedBox(out.painted, place, [x * w, h / 2, 0], [0.035, h + 0.012, d + 0.03], iron);
  for (const z of [-d / 2, d / 2]) pushPlacedBox(out.painted, place, [0, 0.03, z], [w + 0.02, 0.05, 0.012], iron);
  pushPlacedBox(out.painted, place, [0, body - 0.02, d / 2 + 0.018], [0.07, 0.09, 0.02], iron);
  for (const x of [-w / 2 - 0.02, w / 2 + 0.02]) pushPlacedBox(out.painted, place, [x, body * 0.7, 0], [0.02, 0.025, 0.12], iron);
}

function buildBarrel(out, style, piece) {
  const { rng } = out;
  const { height, radius } = style;
  const paint = shaded(out, style);
  const hoopPaint = (x, y, z, up) => out.paint(style.hoopTint, x, y, z, up);
  const place = piece.lying ? placeAlongX(0) : placeUpright(0, 0);
  const from = piece.lying ? -height / 2 : 0;
  const lift = piece.lying ? radius * (1 + style.bulge) : 0;
  const shape = (start, end, r, bulge, staves) => ({
    from: start, to: end, radius: r, startLift: lift, endLift: lift, sag: 0, bow: 0, taper: 0,
    bulge, bulgeWaves: 1, bulgePhase: 0, segments: 8, sides: style.sides, shiftU: rng(), shiftV: rng(), staves,
  });
  const rings = pushLog(out.planks, shape(from, from + height, radius, style.bulge, style.staves / style.texturePlanks), place, paint, style.tile);
  pushLogEnd(out.planks, rings[0], style.sides, rng() * Math.PI * 2, -1, place, paint);
  pushLogEnd(out.planks, rings[rings.length - 1], style.sides, rng() * Math.PI * 2, 1, place, paint);
  for (const at of style.hoops) {
    const swell = radius * (1 + style.bulge * Math.sin(at * Math.PI)) + style.hoopOut;
    const middle = from + at * height;
    pushLog(out.planks, shape(middle - style.hoopWidth / 2, middle + style.hoopWidth / 2, swell, 0), place, hoopPaint, style.tile);
  }
}

function buildCrate(out, style, crate) {
  const { rng } = out;
  const [x, z] = crate.at || [0, 0];
  const size = style.size * (crate.scale || 1);
  const t = style.thickness;
  const y0 = crate.lift || 0;
  const yaw = crate.yaw || 0;
  const paint = shaded(out, style);
  const half = size / 2;
  const panels = [
    [[0, t / 2 - half, 0], [size, t, size]],
    [[half - t / 2, 0, 0], [t, size, size]],
    [[t / 2 - half, 0, 0], [t, size, size]],
    [[0, 0, half - t / 2], [size, size, t]],
    [[0, 0, t / 2 - half], [size, size, t]],
  ];
  if (!crate.open) panels.push([[0, half - t / 2, 0], [size, t, size]]);
  for (const [[ox, oy, oz], dims] of panels) {
    pushBox(out.planks, {
      center: [x + ox * Math.cos(yaw) + oz * Math.sin(yaw), y0 + half + oy, z - ox * Math.sin(yaw) + oz * Math.cos(yaw)],
      size: dims,
      yaw,
      shiftU: rng(),
      shiftV: rng(),
    }, paint, style.tile);
  }
  if (!crate.open) return;
  const reach = size * 0.95;
  pushBox(out.planks, {
    center: [x + reach * Math.cos(yaw + 0.4), y0 + t / 2 + 0.01, z - reach * Math.sin(yaw + 0.4)],
    size: [size, t, size],
    yaw: yaw + 0.7,
    tiltX: 0.05,
    shiftU: rng(),
  }, paint, style.tile);
}

function buildAnchor(out, style, place) {
  const iron = flatPaint(style.iron);
  const r = style.thick;
  const h = style.height;
  const w = style.width;
  pushCylinder(out.painted, place, [0, 0.1, 0], [0, h, 0], r, iron);
  pushHoop(out.painted, place, [0, h + style.ring, 0], style.ring, r * 0.6, 'xy', iron);
  pushCylinder(out.painted, place, [-w * 0.45, h - 0.14, 0], [w * 0.45, h - 0.14, 0], r * 0.8, iron);
  for (const sign of [-1, 1]) {
    pushCylinder(out.painted, place, [0, 0.1, 0], [sign * w * 0.3, 0.16, 0], r, iron);
    pushCylinder(out.painted, place, [sign * w * 0.3, 0.16, 0], [sign * w * 0.48, 0.42, 0], r * 0.9, iron);
    pushPlacedBox(out.painted, place, [sign * w * 0.5, 0.4, 0], [0.15, 0.17, 0.04], iron);
  }
  pushPlacedBox(out.painted, place, [0, 0.1, 0], [r * 3, r * 3, r * 3], iron);
}

function buildRope(out, style, place) {
  const rope = flatPaint(style.rope);
  style.loops.forEach(([radius, height]) => pushHoop(out.painted, place, [0, height, 0], radius, style.thick, 'xz', rope, 16));
  pushCylinder(out.painted, place, [style.loops[0][0], style.thick, 0], [style.loops[0][0] + 0.35, style.thick, 0.25], style.thick, rope, { caps: false, sides: 6 });
}

function buildBoat(out, style, place) {
  const [length, , beam] = style.size;
  const base = style.trestle;
  const paint = (x, y, z, up) => out.paint(style.tint, x, y, z, up);
  const hull = (flip) => (u, v) => {
    const t = flip ? 1 - v : v;
    const angle = -Math.PI / 2 + Math.PI * t;
    const width = (beam / 2) * Math.pow(Math.sin(Math.PI * u), 0.55);
    const keel = style.depth * Math.pow(Math.sin(Math.PI * u), 0.3);
    const p = turnPoint(place, [(u - 0.5) * length, base + keel * Math.cos(angle), width * Math.sin(angle)]);
    return [p.x, p.y, p.z];
  };
  for (const flip of [false, true]) pushSheet(out.planks, 20, 8, hull(flip), paint);
  pushPlacedBox(out.planks, place, [0, base + style.depth + 0.02, 0], [length * 0.92, 0.05, 0.07], paint, {}, 1.2);
  for (const u of [0.25, 0.75]) {
    const x = (u - 0.5) * length;
    pushPlacedBox(out.planks, place, [x, base - 0.04, 0], [0.09, 0.08, beam + 0.2], paint, {}, 1.2);
    for (const z of [-beam / 2, beam / 2]) {
      for (const lean of [-0.18, 0.18]) pushPlacedBox(out.planks, place, [x + lean * 0.5, (base - 0.08) / 2, z], [0.06, base - 0.06, 0.06], paint, { tiltZ: lean }, 1.2);
    }
  }
}

function buildBench(out, style, place) {
  const [length, height] = style.size;
  const seat = style.seat;
  for (const x of [-length * 0.32, length * 0.32]) {
    const foot = turnPoint(place, [x, 0, 0]);
    const stump = { from: foot.y - 0.1, to: foot.y + height - seat * 1.6, radius: style.stump, startLift: 0, endLift: 0, sag: 0, bow: 0, taper: 0.1, bulge: 0.05, bulgeWaves: 1, bulgePhase: 0, segments: 3, sides: 10, shiftU: x, shiftV: 0 };
    addLog(out, stump, placeUpright(foot.x, foot.z), logShade(out, style), style, false, true);
  }
  const log = { from: -length / 2, to: length / 2, radius: seat, startLift: place.y + height - seat, endLift: place.y + height - seat, sag: 0.02, bow: 0.02, taper: 0.12, bulge: 0.05, bulgeWaves: 2, bulgePhase: 0.3, segments: 6, sides: 10, shiftU: -length / 2, shiftV: 0 };
  const yaw = place.yaw || 0;
  const along = (a, lift, side) => [place.x + a * Math.cos(yaw) + side * Math.sin(yaw), lift, place.z - a * Math.sin(yaw) + side * Math.cos(yaw)];
  addLog(out, log, along, logShade(out, style), style);
}

function buildPiece(out, piece) {
  const style = FURNITURE_STYLES[piece.kind];
  const place = { x: 0, y: piece.lift || 0, z: 0, yaw: 0, tilt: piece.tilt || 0 };
  if (piece.kind === 'map') {
    out.sheet = mapSheet(style, place);
    pushMapDagger(out.painted, style, place);
  } else if (piece.kind === 'bottle') pushBottle(out.painted, style, place, piece.color, piece.broken);
  else if (piece.kind === 'mug') pushMug(out.painted, style, place);
  else if (piece.kind === 'spyglass') pushSpyglass(out.painted, style, place);
  else if (piece.kind === 'compass') pushCompass(out.painted, style, place);
  else if (piece.kind === 'table') buildTable(out, style, place);
  else if (piece.kind === 'chair') buildChair(out, style, place);
  else if (piece.kind === 'chest') buildChest(out, style, place);
  else if (piece.kind === 'barrel') buildBarrel(out, style, piece);
  else if (piece.kind === 'crate') for (const crate of piece.crates) buildCrate(out, style, crate);
  else if (piece.kind === 'anchor') buildAnchor(out, style, place);
  else if (piece.kind === 'rope') buildRope(out, style, place);
  else if (piece.kind === 'boat') buildBoat(out, style, place);
  else if (piece.kind === 'bench') buildBench(out, style, place);
}

export function furnitureTemplate(scene, piece) {
  let byPiece = templates.get(scene);
  if (!byPiece) {
    byPiece = new Map();
    templates.set(scene, byPiece);
  }
  const cached = byPiece.get(piece);
  if (cached && !cached.isDisposed()) return cached;
  const out = {
    planks: createBuffer(),
    painted: createBuffer(),
    logs: createBuffer(),
    ends: createBuffer(),
    sheet: null,
    rng: createRng(piece.seed),
    paint: agePaint(FURNITURE_WEAR, piece.seed),
  };
  buildPiece(out, piece);
  const materials = materialsFor(scene);
  const root = new TransformNode(`tplFurniture_${piece.kind}_${piece.seed}`, scene);
  for (const part of ['planks', 'painted', 'logs', 'ends', 'sheet']) {
    if (!out[part]) continue;
    const mesh = meshFromBuffer(`furniture_${piece.kind}_${piece.seed}_${part}`, out[part], scene);
    if (!mesh) continue;
    mesh.material = part === 'sheet' ? mapMaterial(scene, materials) : materials[part];
    mesh.parent = root;
  }
  root.setEnabled(false);
  byPiece.set(piece, root);
  return root;
}
