// Převody mezi světovými souřadnicemi a buňkami mřížky.
// Jediné místo, které zná velikost buňky — zbytek kódu se ptá tady.
export const CELL_SIZE = 2;

export function worldToCell(value) {
  return Math.round(value / CELL_SIZE);
}

export function cellToWorld(cell) {
  return cell * CELL_SIZE;
}

export function snapToCell(value) {
  return cellToWorld(worldToCell(value));
}

export function worldToCellCoords(x, z) {
  return { cx: worldToCell(x), cz: worldToCell(z) };
}

export function cellToWorldCoords(cx, cz) {
  return { x: cellToWorld(cx), z: cellToWorld(cz) };
}

export function cellKey(cx, cz) {
  return `${cx},${cz}`;
}
