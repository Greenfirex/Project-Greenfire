// Které buňky mapy existují a jakou vrstvu v nich najdeš — podlaha, cesta, nebo voda.
// Odsud se počítá hratelná země, mřížka, tráva i chození.

export function cellKey(cx, cz) {
  return `${cx},${cz}`;
}
export function layerCells(entries) {
  const cells = [];
  const seen = new Set();
  for (const entry of entries || []) {
    if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) continue;
    const key = cellKey(entry.cx, entry.cz);
    if (seen.has(key)) continue;
    seen.add(key);
    cells.push([entry.cx, entry.cz]);
  }
  return cells;
}
export function worldCells(world) {
  const layers = world || {};
  const cells = layerCells(layers.floor).concat(layerCells(layers.path), layerCells(layers.water), layerCells(layers.clearing));
  const seen = new Set();
  return cells.filter(([cx, cz]) => {
    const key = cellKey(cx, cz);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function groundCells(world) {
  return layerCells((world || {}).floor);
}
export function layerAt(world, cx, cz) {
  const layers = world || {};
  const hit = (entries) => (entries || []).some((entry) => entry.cx === cx && entry.cz === cz);
  if (hit(layers.floor)) return 'floor';
  if (hit(layers.path)) return 'path';
  if (hit(layers.water)) return 'water';
  if (hit(layers.clearing)) return 'clearing';
  return null;
}
export function hasLayerCell(world, cx, cz) {
  return layerAt(world, cx, cz) !== null;
}
export function dropDecorationCell(world, cx, cz) {
  if (!world) return false;
  const entries = world.decorations || [];
  const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
  if (kept.length === entries.length) return false;
  world.decorations = kept;
  return true;
}
export function floorCellAt(world, cx, cz) {
  if (!world) return null;
  const list = world.floor || [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (entry && entry.cx === cx && entry.cz === cz) return entry;
  }
  return null;
}
export function dropFloorCell(world, cx, cz) {
  if (!world) return false;
  const entries = world.floor || [];
  const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
  if (kept.length === entries.length) return false;
  world.floor = kept;
  return true;
}
export function dropLayerCell(world, cx, cz) {
  if (!world) return false;
  let dropped = false;
  for (const name of ['floor', 'path', 'water', 'clearing', 'manual']) {
    const entries = world[name] || [];
    const kept = entries.filter((entry) => !entry || entry.cx !== cx || entry.cz !== cz);
    if (kept.length !== entries.length) {
      world[name] = kept;
      dropped = true;
    }
  }
  return dropped;
}
export function dropAreaCells(world, cells) {
  if (!world || !cells || !cells.length) return 0;
  let dropped = 0;
  for (const [cx, cz] of cells) {
    if (dropLayerCell(world, cx, cz)) dropped += 1;
  }
  return dropped;
}
