// Tvary skalního mostu — pochozí plocha, čela i klenba se počítají z jedné křivky,
// takže na sebe dosednou bez švu, a kraje mostu se schovají do břehů.
export const BRIDGE_BURIAL = 1.5;
export const BRIDGE_SINK = 0.035;
export const BRIDGE_RISE = 0.14;
export const BRIDGE_VAULT = 0.25;
export const BRIDGE_CLEARANCE = 2.0;
export const BRIDGE_END_INSET = 0.02;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function bridgeSpan(record) {
  const ax = Number(record && record.ax);
  const az = Number(record && record.az);
  const bx = Number(record && record.bx);
  const bz = Number(record && record.bz);
  if (![ax, az, bx, bz].every(Number.isFinite)) return null;
  const alongX = az === bz && ax !== bx;
  const alongZ = ax === bx && az !== bz;
  if (!alongX && !alongZ) return null;
  const from = alongX ? Math.min(ax, bx) : Math.min(az, bz);
  const to = alongX ? Math.max(ax, bx) : Math.max(az, bz);
  if (to - from < 2) return null;
  let width = Math.round(Number(record.width) || 3);
  if (width < 1) width = 1;
  if (width > 5) width = 5;
  if (width % 2 === 0) width += 1;
  const center = alongX ? az : ax;
  return {
    axis: alongX ? 'x' : 'z',
    from,
    to,
    center,
    width,
    vFrom: center - (width - 1) / 2,
    vTo: center + (width - 1) / 2,
  };
}

export function bridgeCells(record) {
  const span = bridgeSpan(record);
  if (!span) return [];
  const cells = [];
  for (let vCell = span.vFrom; vCell <= span.vTo; vCell += 1) {
    for (let bankCell = span.from; bankCell <= span.to; bankCell += 1) {
      cells.push(span.axis === 'x' ? [bankCell, vCell] : [vCell, bankCell]);
    }
  }
  return cells;
}

export function bridgeCellOf(span, bankCell, vCell) {
  return span.axis === 'x' ? [bankCell, vCell] : [vCell, bankCell];
}

function axisPoint(axis, u, v) {
  return axis === 'x' ? [u, v] : [v, u];
}

function groundLimit(plan, x, z, top) {
  if (!plan.groundAt) return Infinity;
  let sx = x;
  let sz = z;
  if (plan.axis === 'x') sz = Math.min(plan.v1 - 0.05, Math.max(plan.v0 + 0.05, z));
  else sx = Math.min(plan.v1 - 0.05, Math.max(plan.v0 + 0.05, x));
  const ground = plan.groundAt(sx, sz);
  if (ground <= plan.springing + 0.2) return Infinity;
  if (ground <= top - 0.8) return Infinity;
  return ground - 0.06;
}

export function sampleBank(samples, v) {
  return sampleValue(samples, v, 'y');
}

function sampleValue(samples, v, key) {
  if (!samples.length) return 0;
  if (v <= samples[0].v) return samples[0][key];
  const last = samples[samples.length - 1];
  if (v >= last.v) return last[key];
  for (let i = 1; i < samples.length; i += 1) {
    const b = samples[i];
    if (b.v < v) continue;
    const a = samples[i - 1];
    const span = b.v - a.v;
    if (span <= 1e-6) return b[key];
    return a[key] + (b[key] - a[key]) * ((v - a.v) / span);
  }
  return last[key];
}

export function archHeightAt(plan, t) {
  const clamped = clamp01(t);
  const bump = Math.pow(Math.sin(Math.PI * clamped), 0.8);
  return plan.springing + (plan.crown - plan.springing) * bump;
}

function deckAtT(plan, t, span, hA, hB) {
  const burial = Math.max(0.001, plan.burial);
  if (t <= 0) return hA - BRIDGE_SINK * Math.min(1, (-t * span) / burial);
  if (t >= 1) return hB - BRIDGE_SINK * Math.min(1, ((t - 1) * span) / burial);
  return hA + (hB - hA) * t + BRIDGE_RISE * Math.sin(Math.PI * t) ** 2;
}

export function deckHeightAt(plan, u, v) {
  const uA = sampleValue(plan.bankA, v, 'u');
  const uB = sampleValue(plan.bankB, v, 'u');
  const span = Math.max(1e-6, uB - uA);
  const t = (u - uA) / span;
  return deckAtT(plan, t, span, sampleBank(plan.bankA, v), sampleBank(plan.bankB, v));
}

function gridIndices(indices, start, rows, stride) {
  for (let j = 0; j < rows - 1; j += 1) {
    for (let i = 0; i < stride - 1; i += 1) {
      const a = start + j * stride + i;
      indices.push(a, a + stride, a + 1, a + 1, a + stride, a + stride + 1);
    }
  }
}

function columnUAt(column, y, axis) {
  if (!column || !column.length) return null;
  const uOf = (entry) => (axis === 'x' ? entry.x : entry.z);
  if (y <= column[0].y) return uOf(column[0]);
  const last = column[column.length - 1];
  if (y >= last.y) return uOf(last);
  for (let i = 1; i < column.length; i += 1) {
    const b = column[i];
    if (b.y < y) continue;
    const a = column[i - 1];
    const span = b.y - a.y;
    if (span <= 1e-6) return uOf(b);
    return uOf(a) + (uOf(b) - uOf(a)) * ((y - a.y) / span);
  }
  return uOf(last);
}

function columnVAt(column, y, axis) {
  if (!column || !column.length) return null;
  const vOf = (entry) => (axis === 'x' ? entry.z : entry.x);
  if (y <= column[0].y) return vOf(column[0]);
  const last = column[column.length - 1];
  if (y >= last.y) return vOf(last);
  for (let i = 1; i < column.length; i += 1) {
    const b = column[i];
    if (b.y < y) continue;
    const a = column[i - 1];
    const span = b.y - a.y;
    if (span <= 1e-6) return vOf(b);
    return vOf(a) + (vOf(b) - vOf(a)) * ((y - a.y) / span);
  }
  return vOf(last);
}

export function buildBridge(plan) {
  const ideal = Math.max(1e-6, plan.u1 - plan.u0);
  const steps = Math.max(8, Math.round(ideal / 0.35));
  const rows = Math.min(plan.bankA.length, plan.bankB.length);
  const tile = plan.tile || 1;
  const rockTile = plan.wallTile || tile;
  const tint = plan.tint || [1, 1, 1];
  const columnsFor = (span) => {
    const list = [-plan.burial / span];
    for (let i = 0; i <= steps; i += 1) list.push(i / steps);
    list.push(1 + plan.burial / span);
    return list;
  };
  const rockColumnsFor = () => {
    const list = [];
    for (let i = 0; i <= steps; i += 1) list.push(i / steps);
    return list;
  };
  const stride = steps + 3;
  const rockStride = steps + 1;
  const deck = { positions: [], indices: [], uvs: [], colors: [] };
  for (let j = 0; j < rows; j += 1) {
    const a = plan.bankA[j];
    const b = plan.bankB[j];
    const span = Math.max(1e-6, b.u - a.u);
    const columns = columnsFor(span);
    for (let i = 0; i < columns.length; i += 1) {
      const t = columns[i];
      const u = a.u + span * t;
      const [x, z] = axisPoint(plan.axis, u, a.v);
      let y = deckAtT(plan, t, span, a.y, b.y);
      if (t < 0 || t > 1) y = Math.min(y, groundLimit(plan, x, z, y));
      deck.positions.push(x, y, z);
      deck.uvs.push(x / tile, z / tile);
      deck.colors.push(tint[0], tint[1], tint[2], 1);
    }
  }
  gridIndices(deck.indices, 0, rows, stride);

  const rock = { positions: [], indices: [], uvs: [], colors: [], moss: [] };
  const rockVertex = (x, y, z, u, v, t, mode) => {
    const color = plan.shade(x, y, z, clamp01(t));
    rock.positions.push(x, y, z);
    if (mode === 'fascia') rock.uvs.push(u / rockTile, y / rockTile);
    else rock.uvs.push(u / rockTile, v / rockTile);
    rock.colors.push(color.r, color.g, color.b, 1);
    rock.moss.push(color.moss);
  };
  const fascia = (side) => {
    const v = side === 0
      ? plan.bankA[0].v + BRIDGE_END_INSET
      : plan.bankA[rows - 1].v - BRIDGE_END_INSET;
    const uA = sampleValue(plan.bankA, v, 'u');
    const uB = sampleValue(plan.bankB, v, 'u');
    const hA = sampleBank(plan.bankA, v);
    const hB = sampleBank(plan.bankB, v);
    const span = Math.max(1e-6, uB - uA);
    const columns = rockColumnsFor();
    const colLow = plan.columnAt ? plan.columnAt('low', v) : null;
    const colHigh = plan.columnAt ? plan.columnAt('high', v) : null;
    const rowCount = 6;
    const start = rock.positions.length / 3;
    for (let k = 0; k <= rowCount; k += 1) {
      for (let i = 0; i < columns.length; i += 1) {
        const t = columns[i];
        const tc = clamp01(t);
        const bottom = archHeightAt(plan, t);
        const top = Math.max(deckAtT(plan, t, span, hA, hB), bottom + 0.05);
        const rowY = bottom + (top - bottom) * (k / rowCount);
        const lowEdge = columnUAt(colLow, rowY, plan.axis);
        const highEdge = columnUAt(colHigh, rowY, plan.axis);
        const low = lowEdge === null ? uA : lowEdge;
        const high = highEdge === null ? uB : highEdge;
        const u = low + (high - low) * tc;
        let vv = v;
        const lowV = columnVAt(colLow, rowY, plan.axis);
        const highV = columnVAt(colHigh, rowY, plan.axis);
        const wLow = 1 - smoothstep(0, 0.22, tc);
        const wHigh = 1 - smoothstep(0, 0.22, 1 - tc);
        if (lowV !== null) vv += (lowV - v) * wLow;
        if (highV !== null) vv += (highV - v) * wHigh;
        const [x, z] = axisPoint(plan.axis, u, vv);
        const y = bottom + (top - bottom) * (k / rowCount);
        rockVertex(x, y, z, u, v, (y - bottom) / Math.max(0.001, top - bottom), 'fascia');
      }
    }
    gridIndices(rock.indices, start, rowCount + 1, rockStride);
  };
  fascia(0);
  fascia(1);

  const soffitRows = 6;
  const vStart = plan.bankA[0].v + BRIDGE_END_INSET;
  const vEnd = plan.bankA[rows - 1].v - BRIDGE_END_INSET;
  const soffitStart = rock.positions.length / 3;
  for (let k = 0; k <= soffitRows; k += 1) {
    const vt = k / soffitRows;
    const v = vStart + (vEnd - vStart) * vt;
    const uA = sampleValue(plan.bankA, v, 'u');
    const uB = sampleValue(plan.bankB, v, 'u');
    const hA = sampleBank(plan.bankA, v);
    const hB = sampleBank(plan.bankB, v);
    const span = Math.max(1e-6, uB - uA);
    const columns = rockColumnsFor();
    const colLow = plan.columnAt ? plan.columnAt('low', v) : null;
    const colHigh = plan.columnAt ? plan.columnAt('high', v) : null;
    const vault = BRIDGE_VAULT * Math.sin(Math.PI * vt);
    for (let i = 0; i < columns.length; i += 1) {
      const t = columns[i];
      const tc = clamp01(t);
      const bottom = archHeightAt(plan, t);
      const y = bottom + vault;
      let u;
      let vv = v;
      const lowEdge = columnUAt(colLow, y, plan.axis);
      const highEdge = columnUAt(colHigh, y, plan.axis);
      const low = lowEdge === null ? uA : lowEdge;
      const high = highEdge === null ? uB : highEdge;
      u = low + (high - low) * tc;
      if (k === 0 || k === soffitRows) {
        const lowV = columnVAt(colLow, y, plan.axis);
        const highV = columnVAt(colHigh, y, plan.axis);
        const wLow = 1 - smoothstep(0, 0.22, tc);
        const wHigh = 1 - smoothstep(0, 0.22, 1 - tc);
        if (lowV !== null) vv += (lowV - v) * wLow;
        if (highV !== null) vv += (highV - v) * wHigh;
      }
      const [x, z] = axisPoint(plan.axis, u, vv);
      const top = deckAtT(plan, t, span, hA, hB);
      rockVertex(x, y, z, u, v, (y - bottom) / Math.max(0.001, top - bottom));
    }
  }
  gridIndices(rock.indices, soffitStart, soffitRows + 1, rockStride);
  return { deck, rock };
}
