// Evidence sebraných věcí (houby, mušle, kokosy) — buňka, druh věci a herní čas sebrání.
// Do světa nic nestaví; scéna podle ní sebrané kusy schová a po pár dnech vrátí.
const RESPAWN_DAYS = 3;

export default class HarvestSystem {

  constructor(scene) {
    this.s = scene;
    this.entries = new Map();
    this.respawnSeconds = Infinity;
  }

  configure(daySeconds) {
    this.respawnSeconds = Number.isFinite(daySeconds) && daySeconds > 0 ? RESPAWN_DAYS * daySeconds : Infinity;
  }

  keyOf(cx, cz, key) {
    return `${cx},${cz},${key}`;
  }

  record(cx, cz, key, time) {
    if (!Number.isFinite(cx) || !Number.isFinite(cz) || typeof key !== 'string') return;
    this.entries.set(this.keyOf(cx, cz, key), {
      cx,
      cz,
      key,
      taken: Number.isFinite(time) ? time : 0,
    });
  }

  has(cx, cz, key) {
    return this.entries.has(this.keyOf(cx, cz, key));
  }

  list() {
    return Array.from(this.entries.values());
  }

  drop(cell) {
    this.entries.delete(this.keyOf(cell.cx, cell.cz, cell.key));
  }

  ripe(time) {
    const now = Number.isFinite(time) ? time : 0;
    return this.list().filter((cell) => now - cell.taken >= this.respawnSeconds);
  }

  serialize() {
    return { cells: this.list() };
  }

  apply(data) {
    this.entries.clear();
    const cells = data && Array.isArray(data.cells) ? data.cells : [];
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.cx) || !Number.isFinite(cell.cz)) continue;
      this.record(cell.cx, cell.cz, cell.key, cell.taken);
    }
  }

  defaultState() {
    return { cells: [] };
  }
}
