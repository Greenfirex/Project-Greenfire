// Prozkoumaná místa mapy — které buňky už hráč viděl, která místa objevil (vchody, stavby, jeskyně) a kam si dal křížky.
// Drží jen data pro okno mapy a ukládání; nic nekreslí.
const PIN_LIMIT = 64;
const PIN_PRECISION = 100;

function pinCoord(value) {
  return Math.round(value * PIN_PRECISION) / PIN_PRECISION;
}

function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

function fromBase64(text) {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function validBounds(b) {
  return Boolean(b) && ['minCx', 'maxCx', 'minCz', 'maxCz'].every((k) => Number.isInteger(b[k])) && b.maxCx >= b.minCx && b.maxCz >= b.minCz;
}

export default class ExplorationSystem {

  constructor() {
    this.bounds = null;
    this.width = 0;
    this.height = 0;
    this.seen = new Uint8Array(0);
    this.pins = [];
    this.found = new Set();
    this.revealAll = false;
    this.version = 0;
  }

  setRevealAll(on) {
    const next = Boolean(on);
    if (next === this.revealAll) return;
    this.revealAll = next;
    this.version++;
  }

  shownMask() {
    return this.revealAll ? new Uint8Array(this.seen.length).fill(1) : this.seen;
  }

  discover(id) {
    if (!id || this.found.has(id)) return false;
    this.found.add(id);
    this.version++;
    return true;
  }

  discovered(id) {
    return this.found.has(id);
  }

  setBounds(minCx, maxCx, minCz, maxCz) {
    const next = { minCx, maxCx, minCz, maxCz };
    if (!validBounds(next)) return;
    const old = this.bounds;
    if (old && old.minCx === minCx && old.maxCx === maxCx && old.minCz === minCz && old.maxCz === maxCz) return;
    const width = maxCx - minCx + 1;
    const height = maxCz - minCz + 1;
    const seen = new Uint8Array(width * height);
    if (old) {
      for (let cz = Math.max(minCz, old.minCz); cz <= Math.min(maxCz, old.maxCz); cz++) {
        for (let cx = Math.max(minCx, old.minCx); cx <= Math.min(maxCx, old.maxCx); cx++) {
          if (this.seen[this.indexOf(cx, cz)] === 1) seen[(cz - minCz) * width + (cx - minCx)] = 1;
        }
      }
    }
    this.bounds = next;
    this.width = width;
    this.height = height;
    this.seen = seen;
    this.version++;
  }

  indexOf(cx, cz) {
    const b = this.bounds;
    if (!b || cx < b.minCx || cx > b.maxCx || cz < b.minCz || cz > b.maxCz) return -1;
    return (cz - b.minCz) * this.width + (cx - b.minCx);
  }

  isRevealed(cx, cz) {
    const index = this.indexOf(cx, cz);
    return index >= 0 && (this.revealAll || this.seen[index] === 1);
  }

  reveal(cx, cz, radius) {
    let added = false;
    const r = Math.max(0, Math.floor(radius));
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r + r) continue;
        const index = this.indexOf(cx + dx, cz + dz);
        if (index < 0 || this.seen[index]) continue;
        this.seen[index] = 1;
        added = true;
      }
    }
    if (added) this.version++;
    return added;
  }

  addPin(cx, cz) {
    if (!this.isRevealed(Math.round(cx), Math.round(cz)) || this.pins.length >= PIN_LIMIT) return false;
    this.pins.push({ cx: pinCoord(cx), cz: pinCoord(cz) });
    this.version++;
    return true;
  }

  removePinNear(cx, cz, reach) {
    let best = -1;
    let bestDist = reach * reach;
    this.pins.forEach((pin, i) => {
      const dist = (pin.cx - cx) ** 2 + (pin.cz - cz) ** 2;
      if (dist <= bestDist) {
        best = i;
        bestDist = dist;
      }
    });
    if (best < 0) return false;
    this.pins.splice(best, 1);
    this.version++;
    return true;
  }

  defaultState() {
    return { bounds: null, seen: '', pins: [], found: [] };
  }

  serialize() {
    return {
      bounds: this.bounds ? { ...this.bounds } : null,
      seen: this.bounds ? toBase64(this.seen) : '',
      pins: this.pins.map((pin) => ({ ...pin })),
      found: [...this.found],
    };
  }

  apply(data) {
    const keep = this.bounds;
    this.bounds = null;
    this.width = 0;
    this.height = 0;
    this.seen = new Uint8Array(0);
    this.pins = [];
    this.found = new Set((data && Array.isArray(data.found) ? data.found : []).filter((id) => typeof id === 'string' && id));
    const bounds = data && data.bounds;
    if (validBounds(bounds)) {
      const width = bounds.maxCx - bounds.minCx + 1;
      const height = bounds.maxCz - bounds.minCz + 1;
      let seen = null;
      try {
        seen = typeof data.seen === 'string' ? fromBase64(data.seen) : null;
      } catch {
        seen = null;
      }
      if (seen && seen.length === width * height) {
        this.bounds = { minCx: bounds.minCx, maxCx: bounds.maxCx, minCz: bounds.minCz, maxCz: bounds.maxCz };
        this.width = width;
        this.height = height;
        this.seen = seen;
      }
    }
    if (keep) this.setBounds(keep.minCx, keep.maxCx, keep.minCz, keep.maxCz);
    const pins = data && Array.isArray(data.pins) ? data.pins : [];
    for (const pin of pins) {
      if (this.pins.length >= PIN_LIMIT) break;
      if (pin && Number.isFinite(pin.cx) && Number.isFinite(pin.cz)) this.pins.push({ cx: pinCoord(pin.cx), cz: pinCoord(pin.cz) });
    }
    this.version++;
  }
}
