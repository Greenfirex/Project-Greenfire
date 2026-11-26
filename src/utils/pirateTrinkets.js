// Tvary pirátských drobností — láhev od rumu (i rozbitá), cínový hrnek, dalekohled, kompas a mapa s dýkou.
// Používají je dekorace i police a knihovna ve srubu, aby každá drobnost vypadala všude stejně.
import { createBuffer, pushSheet, turnPoint, pushCylinder, pushPlacedBox, pushHoop, flatPaint } from './buildingGeometry.js';

export function pushBottle(buffer, style, place, color, broken = false) {
  const glass = flatPaint(color || style.colors[0]);
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
}

export function pushMug(buffer, style, place) {
  const pewter = flatPaint(style.pewter);
  pushCylinder(buffer, place, [0, 0, 0], [0, style.height, 0], style.radius, pewter, { sides: 12, taper: -0.08 });
  pushPlacedBox(buffer, place, [style.radius + 0.018, style.height * 0.55, 0], [0.014, style.height * 0.6, 0.016], pewter);
  for (const y of [0.25, 0.85]) pushPlacedBox(buffer, place, [style.radius + 0.01, style.height * y, 0], [0.026, 0.012, 0.014], pewter);
}

export function pushSpyglass(buffer, style, place) {
  const brass = flatPaint(style.brass);
  const lift = style.tubes[0][1];
  let along = 0;
  for (const [length, radius] of style.tubes) {
    pushCylinder(buffer, place, [along, lift, 0], [along + length, lift, 0], radius, brass, { sides: 12 });
    along += length;
  }
  pushHoop(buffer, place, [0.004, lift, 0], style.tubes[0][1], 0.006, 'yz', brass, 10);
}

export function pushCompass(buffer, style, place) {
  const brass = flatPaint(style.brass);
  pushCylinder(buffer, place, [0, 0, 0], [0, style.height, 0], style.radius, brass, { sides: 14 });
  pushCylinder(buffer, place, [0, style.height, 0], [0, style.height + 0.002, 0], style.radius * 0.84, flatPaint(style.face), { sides: 14 });
  pushPlacedBox(buffer, place, [0, style.height + 0.004, 0], [0.006, 0.003, style.radius * 1.4], flatPaint(style.needle));
}

export function mapSheet(style, place) {
  const sheet = createBuffer();
  const [w, , d] = style.size;
  pushSheet(sheet, 8, 6, (u, v) => {
    const curl = style.curl * (Math.pow(Math.abs(u - 0.5) * 2, 4) + Math.pow(Math.abs(v - 0.5) * 2, 4));
    const p = turnPoint(place, [(u - 0.5) * w, curl + 0.002, (v - 0.5) * d]);
    return [p.x, p.y, p.z];
  }, flatPaint([1, 1, 1]));
  return sheet;
}

export function pushMapDagger(buffer, style, place) {
  const steel = flatPaint(style.steel);
  const grip = flatPaint(style.grip);
  const [dx, dz] = style.dagger;
  const tip = turnPoint(place, [dx, 0, dz]);
  const dagger = { ...place, x: tip.x, z: tip.z, tilt: style.daggerTilt };
  pushPlacedBox(buffer, dagger, [0, 0.03, 0], [0.025, 0.12, 0.006], steel);
  pushPlacedBox(buffer, dagger, [0, 0.1, 0], [0.08, 0.014, 0.018], steel);
  pushCylinder(buffer, dagger, [0, 0.105, 0], [0, 0.2, 0], 0.012, grip);
  pushCylinder(buffer, dagger, [0, 0.2, 0], [0, 0.215, 0], 0.017, steel);
}
