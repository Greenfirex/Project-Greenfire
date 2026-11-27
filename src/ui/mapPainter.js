// Malíř mapy — z mřížky ostrova (povrch, výška, voda po buňkách) nakreslí obrázek jako ruční mapu:
// oblé a lehce roztřesené hranice, inkoustové pobřeží s vlnkami do moře a útesy (hrany, které terén nevyhlazuje) jako čára se stínem pod ní.
export const PAINT_SCALE = 10;

const WARP = 0.32;
const WARP_FREQ = 0.38;
const SHADE_LOW = 0.9;
const SHADE_SPAN = 0.14;
const SHALLOW = [130, 186, 214];
const DEEP = [62, 120, 178];
const DEEP_AT = 1.5;
const FALLBACK = [140, 136, 110];
const LAND_SATURATION = 0.55;
const LAND_SEPIA = 0.3;
const INK = [70, 46, 28];
const COAST_WIDTH = 0.2 * PAINT_SCALE;
const COAST_INK = 0.85;
const RIPPLES = [[0.75 * PAINT_SCALE, 0.38], [1.5 * PAINT_SCALE, 0.26], [2.4 * PAINT_SCALE, 0.15]];
const RIPPLE_HALF = 0.07 * PAINT_SCALE;
const CLIFF_LINE_PX = Math.round(0.22 * PAINT_SCALE);
const CLIFF_INK = 0.82;
const CLIFF_SHADOW_PX = Math.round(0.6 * PAINT_SCALE);
const CLIFF_SHADOW = 0.22;
const BORDER_INK = 0.18;
const SIDES = [[1, 1, 0], [2, -1, 0], [4, 0, -1], [8, 0, 1]];
const DIAGONAL = Math.SQRT2;

function hash(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * sx;
  const bottom = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * sx;
  return top + (bottom - top) * sy;
}

function muted(color) {
  const [r0, g0, b0] = color || FALLBACK;
  const grey = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
  const r = grey + (r0 - grey) * LAND_SATURATION;
  const g = grey + (g0 - grey) * LAND_SATURATION;
  const b = grey + (b0 - grey) * LAND_SATURATION;
  const sepia = [0.393 * r + 0.769 * g + 0.189 * b, 0.349 * r + 0.686 * g + 0.168 * b, 0.272 * r + 0.534 * g + 0.131 * b];
  return [r, g, b].map((value, i) => Math.min(255, value * (1 - LAND_SEPIA) + sepia[i] * LAND_SEPIA));
}

function filledLift(grid) {
  let low = Infinity;
  let high = -Infinity;
  for (const value of grid.lift) {
    if (!Number.isFinite(value)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }
  if (!Number.isFinite(low)) low = high = 0;
  const lift = Float32Array.from(grid.lift, (value) => (Number.isFinite(value) ? value : low - 1));
  return { lift, low, span: Math.max(0.001, high - low) };
}

function waterDistance(land, width, height) {
  const dist = new Float32Array(width * height);
  for (let i = 0; i < dist.length; i++) dist[i] = land[i] ? 0 : Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!dist[i]) continue;
      let best = dist[i];
      if (x > 0) best = Math.min(best, dist[i - 1] + 1);
      if (y > 0) {
        best = Math.min(best, dist[i - width] + 1);
        if (x > 0) best = Math.min(best, dist[i - width - 1] + DIAGONAL);
        if (x < width - 1) best = Math.min(best, dist[i - width + 1] + DIAGONAL);
      }
      dist[i] = best;
    }
  }
  for (let y = height - 1; y >= 0; y--) {
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (!dist[i]) continue;
      let best = dist[i];
      if (x < width - 1) best = Math.min(best, dist[i + 1] + 1);
      if (y < height - 1) {
        best = Math.min(best, dist[i + width] + 1);
        if (x < width - 1) best = Math.min(best, dist[i + width + 1] + DIAGONAL);
        if (x > 0) best = Math.min(best, dist[i + width - 1] + DIAGONAL);
      }
      dist[i] = best;
    }
  }
  return dist;
}

export function paintMap(grid) {
  const { width: cols, height: rows, kind, depth, palette, hard } = grid;
  const { lift, low, span } = filledLift(grid);
  const width = cols * PAINT_SCALE;
  const height = rows * PAINT_SCALE;
  const size = width * height;
  const category = new Uint8Array(size);
  const cliffLine = new Uint8Array(size);
  const cliffShadow = new Float32Array(size);
  const shade = new Float32Array(size);
  const weights = new Float32Array(palette.length);
  const colors = palette.map(muted);
  const at = (col, row) => Math.min(rows - 1, Math.max(0, row)) * cols + Math.min(cols - 1, Math.max(0, col));
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const u0 = (px + 0.5) / PAINT_SCALE - 0.5;
      const v0 = (py + 0.5) / PAINT_SCALE - 0.5;
      const u = u0 + WARP * (noise(u0 * WARP_FREQ, v0 * WARP_FREQ) * 2 - 1);
      const v = v0 + WARP * (noise(u0 * WARP_FREQ + 71.3, v0 * WARP_FREQ + 19.7) * 2 - 1);
      const c0 = Math.floor(u);
      const r0 = Math.floor(v);
      const fu = u - c0;
      const fv = v - r0;
      weights.fill(0);
      let h = 0;
      let d = 0;
      for (let corner = 0; corner < 4; corner++) {
        const dc = corner & 1;
        const dr = corner >> 1;
        const cell = at(c0 + dc, r0 + dr);
        const weight = (dc ? fu : 1 - fu) * (dr ? fv : 1 - fv);
        weights[kind[cell]] += weight;
        h += lift[cell] * weight;
        d += Math.min(DEEP_AT, depth[cell]) * weight;
      }
      let best = 0;
      for (let k = 1; k < weights.length; k++) if (weights[k] > weights[best]) best = k;
      const i = py * width + px;
      category[i] = best;
      const col = Math.min(cols - 1, Math.max(0, Math.round(u)));
      const row = Math.min(rows - 1, Math.max(0, Math.round(v)));
      const home = row * cols + col;
      const mask = hard[home];
      if (mask) {
        const ou = u - col;
        const ov = v - row;
        for (const [bit, dc, dr] of SIDES) {
          if (!(mask & bit)) continue;
          const gap = (0.5 - (dc ? dc * ou : dr * ov)) * PAINT_SCALE;
          const other = at(col + dc, row + dr);
          if (lift[home] > lift[other]) {
            if (gap <= CLIFF_LINE_PX) cliffLine[i] = 1;
          } else if (gap < CLIFF_SHADOW_PX) {
            cliffShadow[i] = Math.max(cliffShadow[i], 1 - gap / CLIFF_SHADOW_PX);
          }
        }
      }
      shade[i] = best ? SHADE_LOW + SHADE_SPAN * ((h - low) / span) : d / DEEP_AT;
    }
  }
  const land = Uint8Array.from(category, (value) => (value ? 1 : 0));
  const dist = waterDistance(land, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const out = image.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const k = category[i];
      let r;
      let g;
      let b;
      let ink = 0;
      if (k) {
        const base = colors[k];
        const light = shade[i] * (1 - CLIFF_SHADOW * cliffShadow[i]);
        if (cliffLine[i]) ink = CLIFF_INK;
        for (let side = 0; side < 2; side++) {
          const next = side ? (y < height - 1 ? i + width : -1) : (x < width - 1 ? i + 1 : -1);
          if (next >= 0 && category[next] && category[next] !== k) ink = Math.max(ink, BORDER_INK);
        }
        r = base[0] * light;
        g = base[1] * light;
        b = base[2] * light;
      } else {
        const t = shade[i];
        r = SHALLOW[0] + (DEEP[0] - SHALLOW[0]) * t;
        g = SHALLOW[1] + (DEEP[1] - SHALLOW[1]) * t;
        b = SHALLOW[2] + (DEEP[2] - SHALLOW[2]) * t;
        const gap = dist[i];
        if (gap <= COAST_WIDTH) ink = COAST_INK;
        else {
          for (const [ring, strength] of RIPPLES) {
            if (Math.abs(gap - ring) < RIPPLE_HALF) ink = Math.max(ink, strength);
          }
        }
      }
      const o = i * 4;
      out[o] = r + (INK[0] - r) * ink;
      out[o + 1] = g + (INK[1] - g) * ink;
      out[o + 2] = b + (INK[2] - b) * ink;
      out[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
