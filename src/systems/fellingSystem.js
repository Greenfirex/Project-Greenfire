// Evidence pokácených stromů — pro každou buňku si pamatuje druh a směr pádu.
// Do světa nic nestaví; při stavbě světa podle ní scéna schová strom a postaví pařez s kládami.
export default class FellingSystem {

  constructor(scene) {
    this.s = scene;
    this.entries = new Map();
  }

  keyOf(cx, cz) {
    return `${cx},${cz}`;
  }

  record(cx, cz, def, dir) {
    if (!def || !def.tree) return;
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) return;
    this.entries.set(this.keyOf(cx, cz), {
      cx,
      cz,
      tree: def.tree,
      dirX: dir && Number.isFinite(dir.dirX) ? dir.dirX : 1,
      dirZ: dir && Number.isFinite(dir.dirZ) ? dir.dirZ : 0,
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

  clear() {
    this.entries.clear();
  }

  serialize() {
    return { cells: this.list() };
  }

  apply(data) {
    this.entries.clear();
    const cells = data && Array.isArray(data.cells) ? data.cells : [];
    for (const cell of cells) {
      if (!cell || !Number.isFinite(cell.cx) || !Number.isFinite(cell.cz)) continue;
      if (!cell.tree) continue;
      this.entries.set(this.keyOf(cell.cx, cell.cz), {
        cx: cell.cx,
        cz: cell.cz,
        tree: cell.tree,
        dirX: Number.isFinite(cell.dirX) ? cell.dirX : 1,
        dirZ: Number.isFinite(cell.dirZ) ? cell.dirZ : 0,
      });
    }
  }

  defaultState() {
    return { cells: [] };
  }
}
