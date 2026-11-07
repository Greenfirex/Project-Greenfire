// Náhled hmoty pro vývoj — každý pevný pruh jako uzavřený blok se švem, jako naskládané kostky.
// Za přepínačem `?solid`; hra ho nepoužívá, slouží jen k pohledu na data pruhů.
import { CELL_SIZE } from '../../utils/gridMath.js';
import { buildColumnRuns } from '../../utils/terrainRuns.js';

const GAP = 0.05;

function cellShade(cx, cz) {
  return 0.84 + ((Math.abs(cx * 31 + cz * 17) % 7) / 7) * 0.26;
}

export function buildRunBlocks(layout, options = {}) {
  const cellSize = Number.isFinite(options.cellSize) ? options.cellSize : CELL_SIZE;
  const tile = Number.isFinite(options.tile) ? options.tile : 3;
  const runs = buildColumnRuns(layout || {});
  const half = cellSize / 2;
  const positions = [];
  const indices = [];
  const uvs = [];
  const colors = [];

  const quad = (points, quadUvs, size) => {
    const start = positions.length / 3;
    for (const point of points) positions.push(point[0], point[1], point[2]);
    for (const value of quadUvs) uvs.push(value);
    for (let i = 0; i < 4; i += 1) colors.push(size, size, size, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  for (const [id, list] of runs) {
    if (!list.length) continue;
    const [cx, cz] = id.split(',').map(Number);
    const size = cellShade(cx, cz);
    const x0 = cx * cellSize - half + GAP;
    const x1 = cx * cellSize + half - GAP;
    const z0 = cz * cellSize - half + GAP;
    const z1 = cz * cellSize + half - GAP;
    const ux0 = (cx * cellSize - half) / tile;
    const ux1 = (cx * cellSize + half) / tile;
    const uz0 = (cz * cellSize - half) / tile;
    const uz1 = (cz * cellSize + half) / tile;
    for (const [start, end] of list) {
      const y0 = start + GAP;
      const y1 = end - GAP;
      if (y1 - y0 <= 0) continue;
      const uy0 = y0 / tile;
      const uy1 = y1 / tile;
      quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [uz0, uy0, uz0, uy1, uz1, uy1, uz1, uy0], size);
      quad([[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]], [uz1, uy0, uz1, uy1, uz0, uy1, uz0, uy0], size);
      quad([[x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [x0, y0, z1]], [ux1, uy0, ux1, uy1, ux0, uy1, ux0, uy0], size);
      quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [ux0, uy0, ux0, uy1, ux1, uy1, ux1, uy0], size);
      quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [ux0, uz0, ux0, uz1, ux1, uz1, ux1, uz0], size);
      quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [ux0, uz0, ux1, uz0, ux1, uz1, ux0, uz1], size);
    }
  }

  if (!positions.length) return null;
  return { positions, indices, uvs, colors };
}
