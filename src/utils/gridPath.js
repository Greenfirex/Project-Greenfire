// Hledání cesty po mřížce buněk — A* s diagonálními kroky a omezeným počtem kroků.
// O mapě nic neví: průchodnost a cenu kroků dostane jako funkci zvenčí.

function keyOf(i, j, level = 0) {
  return ((i + 4096) * 8192 + (j + 4096)) * 64 + (level + 32);
}

function keyCell(key) {
  const level = (key % 64) - 32;
  const flat = Math.floor(key / 64);
  const j = (flat % 8192) - 4096;
  return { i: Math.floor(flat / 8192) - 4096, j, level };
}

function heuristic(a, b) {
  const dx = Math.abs(a.i - b.i);
  const dy = Math.abs(a.j - b.j);
  return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

function push(heap, node) {
  heap.push(node);
  let index = heap.length - 1;
  while (index > 0) {
    const parent = (index - 1) >> 1;
    if (heap[parent].f <= heap[index].f) break;
    [heap[parent], heap[index]] = [heap[index], heap[parent]];
    index = parent;
  }
}

function pop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < heap.length && heap[left].f < heap[best].f) best = left;
      if (right < heap.length && heap[right].f < heap[best].f) best = right;
      if (best === index) break;
      [heap[best], heap[index]] = [heap[index], heap[best]];
      index = best;
    }
  }
  return top;
}

function rebuild(cameFrom, startKey, endKey) {
  const path = [];
  let current = endKey;
  while (current !== undefined) {
    path.push(keyCell(current));
    if (current === startKey) break;
    current = cameFrom.get(current);
  }
  return path.reverse();
}

export function findCellPath({ start, goal, neighbours, bounds, limit = 2500, partial = false }) {
  if (!start || !goal) return null;
  const startLevel = start.level || 0;
  const goalLevel = goal.level || 0;
  if (start.i === goal.i && start.j === goal.j && startLevel === goalLevel) return [{ i: start.i, j: start.j, level: startLevel }];
  const startKey = keyOf(start.i, start.j, startLevel);
  const goalKey = keyOf(goal.i, goal.j, goalLevel);
  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const heap = [{ i: start.i, j: start.j, level: startLevel, g: 0, f: heuristic(start, goal) }];
  let bestKey = startKey;
  let bestGap = heuristic(start, goal);
  let expanded = 0;
  while (heap.length) {
    const current = pop(heap);
    const currentKey = keyOf(current.i, current.j, current.level);
    if (currentKey === goalKey) return rebuild(cameFrom, startKey, goalKey);
    const gap = heuristic(current, goal);
    if (gap < bestGap) {
      bestGap = gap;
      bestKey = currentKey;
    }
    const known = gScore.get(currentKey);
    if (known !== undefined && current.g > known + 1e-6) continue;
    expanded += 1;
    if (expanded > limit) break;
    for (const next of neighbours(current.i, current.j, current.level) || []) {
      const nextLevel = Number.isFinite(next.level) ? next.level : current.level;
      if (bounds && (next.i < bounds.minI || next.i > bounds.maxI || next.j < bounds.minJ || next.j > bounds.maxJ)) continue;
      const nextKey = keyOf(next.i, next.j, nextLevel);
      const tentative = current.g + (Number.isFinite(next.cost) ? next.cost : 1);
      const existing = gScore.get(nextKey);
      if (existing !== undefined && tentative >= existing - 1e-6) continue;
      gScore.set(nextKey, tentative);
      cameFrom.set(nextKey, currentKey);
      push(heap, { i: next.i, j: next.j, level: nextLevel, g: tentative, f: tentative + heuristic(next, goal) });
    }
  }
  if (partial && bestKey !== startKey) return rebuild(cameFrom, startKey, bestKey);
  return null;
}
