// Evidence sebranných věcí (houby, mušle) — buňka a herní čas sehrání.
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

  keyOf(cx, cz) {
    return `${cx},${cz}`;
  }

  record(cx, cz, time) {
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;
    this.entries.set(this.keyOf(cx, cz), {
      cx,
      cz,
      taken: Number.isFinite(time) ? time : 0,
    });
  }

  has(cx, cz) {
    return this.entries.has(this.keyOf(cx, cz));
  }

  list() {
    return Array.from(this.entries.values());
  }

  drop(cx, cz) {
    this.entries.delete(this.keyOf(cx, cz));
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
      this.entries.set(this.keyOf(cell.cx, cell.cz), {
        cx: cell.cx,
        cz: cell.cz,
        taken: Number.isFinite(cell.taken) ? cell.taken : 0,
      });
    }
  }

  defaultState() {
    return { cells: [] };
  }
}
