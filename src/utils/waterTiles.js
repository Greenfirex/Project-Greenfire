// Výběr vodní dlaždice podle sousedů — z buněk vody pozná, který dílek tam patří.
// Úzký tok skládá z end/straight/bend/split, široká plocha z plné hladiny uvnitř a břehových dílků po obvodu.
// Rotace vychází z naměřené geometrie Kenney river dílků.
const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const BEND_ROTATION = { '01': 1, '03': 2, '12': 0, '23': 3 };
const SPLIT_ROTATION = [0, 3, 2, 1];
const END_ROTATION = [2, 1, 0, 3];
const LAKE_SIDE_ROTATION = [0, 3, 2, 1];
const LAKE_CORNER_ROTATION = { NW: 0, NE: 3, SE: 2, SW: 1 };

export const WATER_TILES = {
  straight: 'river_straight',
  bend: 'river_bend',
  cross: 'river_cross',
  end: 'river_end',
  split: 'river_split',
  tile: 'river_tile',
  fill: 'river_open',
  lakeSide: 'river_side',
  lakeCorner: 'river_corner',
  lakeCornerBank: 'river_corner_bank',
  lakeOpen: 'river_side_open',
};

export function waterPlan(cells) {
  const depth = depthMap(cells);
  const plan = new Map();
  for (const [id, level] of depth) {
    const [cx, cz] = id.split(',').map(Number);
    const lake = level >= 1 || nearLake(depth, cx, cz);
    plan.set(id, lake ? lakeTile(cells, cx, cz) : riverTile(cells, cx, cz));
  }
  return plan;
}

function nearLake(depth, cx, cz) {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dz) && (depth.get(`${cx + dx},${cz + dz}`) || 0) >= 1) return true;
    }
  }
  return false;
}

function riverTile(cells, cx, cz) {
  const tile = WATER_TILES;
  const ortho = ORTHO.map(([dx, dz]) => cells.has(`${cx + dx},${cz + dz}`));
  const count = ortho.filter(Boolean).length;

  if (count === 0) return { key: tile.tile, rotation: 0 };

  const open = ortho.map((has, i) => (has ? i : -1)).filter((i) => i >= 0);

  if (count === 4) return { key: tile.cross, rotation: 0 };

  if (count === 3) {
    const missing = ortho.indexOf(false);
    return { key: tile.split, rotation: SPLIT_ROTATION[missing] };
  }

  if (count === 2) {
    const [a, b] = open;
    if ((a + 2) % 4 === b) return { key: tile.straight, rotation: a % 2 === 0 ? 0 : 1 };
    return { key: tile.bend, rotation: BEND_ROTATION[[a, b].sort().join('')] };
  }

  return { key: tile.end, rotation: END_ROTATION[open[0]] };
}

function lakeTile(cells, cx, cz) {

  const dry = ORTHO.map(([dx, dz], i) => (cells.has(`${cx + dx},${cz + dz}`) ? -1 : i)).filter((i) => i >= 0);
  if (dry.length === 0) {
    const flow = riverFlowAt(cells, cx, cz);
    if (flow < 0) return { key: WATER_TILES.fill, rotation: 0 };
    return { key: WATER_TILES.lakeOpen, rotation: (LAKE_SIDE_ROTATION[flow] + 2) % 4 };
  }
  if (dry.length === 1) {
    const rot = LAKE_SIDE_ROTATION[dry[0]];
    const flow = riverFlowAt(cells, cx, cz);
    if (flow >= 0 && flow !== dry[0]) return { key: WATER_TILES.lakeCornerBank, rotation: rot };
    return { key: WATER_TILES.lakeSide, rotation: rot };
  }
  if (dry.length === 2) {
    const [a, b] = dry;
    const opposite = (a + 2) % 4 === b;
    if (opposite) return { key: WATER_TILES.lakeOpen, rotation: (LAKE_SIDE_ROTATION[a] + 2) % 4 };
  }
  return { key: WATER_TILES.lakeCorner, rotation: LAKE_CORNER_ROTATION[cornerName(dry)] };
}

function riverFlowAt(cells, cx, cz) {
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = ORTHO[i];
    if (!cells.has(`${cx + dx},${cz + dz}`)) continue;
    if (isChannel(cells, cx + dx, cz + dz)) return i;
  }
  return -1;
}

function isChannel(cells, x, z) {
  const dry = [];
  for (let j = 0; j < 4; j++) {
    const [ox, oz] = ORTHO[j];
    if (!cells.has(`${x + ox},${z + oz}`)) dry.push(j);
  }
  return dry.length === 2 && (dry[0] + 2) % 4 === dry[1];
}

function cornerName(dry) {
  const north = dry.includes(0);
  const east = dry.includes(1);
  const south = dry.includes(2);
  const west = dry.includes(3);
  if (north && west) return 'NW';
  if (north && east) return 'NE';
  if (south && east) return 'SE';
  return 'SW';
}

function depthMap(cells) {
  const inWater = (cx, cz) => cells.has(`${cx},${cz}`);
  const out = new Map();
  for (const id of cells) {
    const [cx, cz] = id.split(',').map(Number);
    let level = 0;
    while (level < 16 && squareFilled(inWater, cx, cz, level + 1)) level++;
    out.set(id, level);
  }
  return out;
}

function squareFilled(inWater, cx, cz, radius) {
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (!inWater(cx + dx, cz + dz)) return false;
    }
  }
  return true;
}
