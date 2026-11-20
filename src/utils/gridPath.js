// Hledání cesty po mřížce buněk — A* s diagonálními kroky a omezeným počtem kroků.
// O mapě nic neví: průchodnost a cenu kroků dostane jako funkci zvenčí. Buňka může mít víc vrstev nad sebou
// (layer, např. přízemí a patro stavby); uzel si nese i vlastní data (y), která dostane zpět v cestě.

function keyOf(i, j, level = 0, layer = 0) {
  return (((i + 4096) * 8192 + (j + 4096)) * 64 + (level + 32)) * 4 + layer;
}

function nodeOf(node) {
  return { i: node.i, j: node.j, level: node.level || 0, layer: node.layer || 0, y: node.y };
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

function rebuild(cameFrom, nodes, startKey, endKey) {
  const path = [];
  let current = endKey;
  while (current !== undefined) {
    path.push(nodes.get(current));
    if (current === startKey) break;
    current = cameFrom.get(current);
  }
  return path.reverse();
}

export function findCellPath({ start, goal, neighbours, bounds, limit = 2500, partial = false }) {
  if (!start || !goal) return null;
  const first = nodeOf(start);
  const last = nodeOf(goal);
  const startKey = keyOf(first.i, first.j, first.level, first.layer);
  const goalKey = keyOf(last.i, last.j, last.level, last.layer);
  if (startKey === goalKey) return [first];
  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const nodes = new Map([[startKey, first]]);
  const heap = [{ ...first, g: 0, f: heuristic(first, last) }];
  let bestKey = startKey;
  let bestGap = heuristic(start, goal);
  let expanded = 0;
  while (heap.length) {
    const current = pop(heap);
    const currentKey = keyOf(current.i, current.j, current.level, current.layer);
    if (currentKey === goalKey) return rebuild(cameFrom, nodes, startKey, goalKey);
    const gap = heuristic(current, last);
    if (gap < bestGap) {
      bestGap = gap;
      bestKey = currentKey;
    }
    const known = gScore.get(currentKey);
    if (known !== undefined && current.g > known + 1e-6) continue;
    expanded += 1;
    if (expanded > limit) break;
    for (const next of neighbours(current) || []) {
      if (bounds && (next.i < bounds.minI || next.i > bounds.maxI || next.j < bounds.minJ || next.j > bounds.maxJ)) continue;
      const node = nodeOf({ ...next, level: Number.isFinite(next.level) ? next.level : current.level });
      const nextKey = keyOf(node.i, node.j, node.level, node.layer);
      const tentative = current.g + (Number.isFinite(next.cost) ? next.cost : 1);
      const existing = gScore.get(nextKey);
      if (existing !== undefined && tentative >= existing - 1e-6) continue;
      gScore.set(nextKey, tentative);
      cameFrom.set(nextKey, currentKey);
      nodes.set(nextKey, node);
      push(heap, { ...node, g: tentative, f: tentative + heuristic(node, last) });
    }
  }
  if (partial && bestKey !== startKey) return rebuild(cameFrom, nodes, startKey, bestKey);
  return null;
}
