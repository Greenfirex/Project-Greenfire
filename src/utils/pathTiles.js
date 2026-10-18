// Výběr dlaždice cesty podle sousedů — z buněk cesty pozná, který dílek tam patří.
// Používá generátor map, editor (auto-cesty) i hra při načtení layoutu.
const ORTHO = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export const PATH_STYLES = {
  dirt: {
    label: 'Hlína',
    straight: 'ground_pathStraight',
    bend: 'ground_pathBend',
    cross: 'ground_pathCross',
    end: 'ground_pathEnd',
    split: 'ground_pathSplit',
  },
  stone: {
    label: 'Kámen',
    straight: 'path_stone',
    bend: 'path_stoneCorner',
    cross: null,
    end: 'path_stoneEnd',
    split: null,
    straightTurn: 1,
    endTurn: 3,
    bendTurn: 1,
  },
  wood: {
    label: 'Dřevo',
    straight: 'path_wood',
    bend: 'path_woodCorner',
    cross: null,
    end: 'path_woodEnd',
    split: null,
    straightTurn: 1,
  },
};

export const PATH_STYLE_KEYS = Object.keys(PATH_STYLES);

export function getPathStyle(styleKey) {
  return PATH_STYLES[styleKey] || PATH_STYLES.dirt;
}

export function pathKeyAt(cells, cx, cz, styleKey = 'dirt') {
  const style = getPathStyle(styleKey);
  const turn = style.straightTurn || 0;
  const endTurn = style.endTurn || 0;
  const bendTurn = style.bendTurn || 0;
  const ortho = ORTHO.map(([dx, dz]) => cells.has(`${cx + dx},${cz + dz}`));
  const count = ortho.filter(Boolean).length;

  if (count === 0) return { key: style.straight, rotation: turn };

  const open = ortho.map((has, i) => (has ? i : -1)).filter((i) => i >= 0);

  if (count === 4) {
    if (!style.cross) return { key: style.straight, rotation: turn };
    return { key: style.cross, rotation: 0 };
  }

  if (count === 3) {
    if (!style.split) return { key: style.straight, rotation: turn };
    const missing = ortho.indexOf(false);
    return { key: style.split, rotation: (((4 - missing) % 4) + 4) % 4 };
  }

  if (count === 2) {
    const [a, b] = open;
    if ((a + 2) % 4 === b) return { key: style.straight, rotation: ((a % 2 === 0 ? 0 : 1) + turn) % 4 };
    return { key: style.bend, rotation: (cornerRotation(a, b) + bendTurn) % 4 };
  }

  const only = open[0];
  return { key: style.end, rotation: ((((2 - only) % 4) + 4) % 4 + endTurn) % 4 };
}

function cornerRotation(a, b) {
  const pair = [a, b].sort().join('');
  if (pair === '01') return 1;
  if (pair === '03') return 2;
  if (pair === '12') return 0;
  return 3;
}
