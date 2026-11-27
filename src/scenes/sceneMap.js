// Část herní scény: kompas a mapa — kreslí ostrov shora, odkrývá místa, kudy hráč chodí, ohlašuje objevené jeskyně a stavby a hlídá křížky.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { getDecoration } from '../data/catalogs/decorations.js';
import { getBuilding, buildingCells, buildingCellKeys } from '../data/catalogs/buildings.js';
import { levelOfEntry } from '../data/maps/areaShape.js';
import { caveNameAt, caveNameIndex } from '../data/maps/caveNames.js';
import { worldToCellCoords, cellToWorld } from '../utils/gridMath.js';

const MAP_REVEAL_RADIUS = 8;
const MAP_DEBUG_SHOW_ALL = true;
const MAP_WATER_DEPTH = 0.05;
const MAP_MOUTH_REACH = 2.5;
const MAP_BUILDING_REACH = 2;
const MAP_FOUND_TITLE = 'Objeveno';
const MAP_CAVE_NAME = 'Jeskyně';
const MAP_SIDES = [[1, 1, 0], [2, -1, 0], [4, 0, 1], [8, 0, -1]];

export default {
  prepareMap() {
    const surface = new Map();
    let minCx = Infinity;
    let maxCx = -Infinity;
    let minCz = Infinity;
    let maxCz = -Infinity;
    for (const entry of (this.mapLayout && this.mapLayout.floor) || []) {
      if (!entry || levelOfEntry(entry) !== 0) continue;
      surface.set(`${entry.cx},${entry.cz}`, entry);
      minCx = Math.min(minCx, entry.cx);
      maxCx = Math.max(maxCx, entry.cx);
      minCz = Math.min(minCz, entry.cz);
      maxCz = Math.max(maxCz, entry.cz);
    }
    if (!surface.size) return false;
    this.exploration.setBounds(minCx, maxCx, minCz, maxCz);
    this.exploration.setRevealAll(MAP_DEBUG_SHOW_ALL);
    const width = maxCx - minCx + 1;
    const height = maxCz - minCz + 1;
    const kind = new Uint8Array(width * height);
    const lift = new Float32Array(width * height);
    const depth = new Float32Array(width * height);
    const hard = new Uint8Array(width * height);
    const palette = [null];
    const paletteIndex = new Map();
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const at = (maxCz - cz) * width + (cx - minCx);
        const cell = surface.get(`${cx},${cz}`);
        const water = this.waterDepthAt(cellToWorld(cx), cellToWorld(cz));
        lift[at] = cell ? cell.liftY || 0 : -Infinity;
        depth[at] = cell ? water : Infinity;
        if (cell) hard[at] = MAP_SIDES.reduce((mask, [bit, dx, dz]) => (this.terrainSystem.hardEdgeAt(cx, cz, dx, dz) ? mask | bit : mask), 0);
        if (!cell || water > MAP_WATER_DEPTH) continue;
        if (!paletteIndex.has(cell.key)) {
          const def = getDecoration(cell.key);
          paletteIndex.set(cell.key, palette.length);
          palette.push((def && def.surface && def.surface.mapColor) || null);
        }
        kind[at] = paletteIndex.get(cell.key);
      }
    }
    this.mapWindow.setTerrain({ width, height, kind, lift, depth, palette, hard }, this.exploration.bounds);
    this.mapFogVersion = -1;
    return true;
  },

  mapSites() {
    const layout = this.mapLayout || {};
    const buildings = [];
    for (const entry of layout.buildings || []) {
      const cells = buildingCells(entry);
      const def = getBuilding(entry.key);
      if (!cells.length || !def) continue;
      const xs = cells.map((cell) => cell[0]);
      const zs = cells.map((cell) => cell[1]);
      buildings.push({
        id: `building:${entry.key}@${entry.cx},${entry.cz}`,
        label: def.displayName,
        minCx: Math.min(...xs),
        maxCx: Math.max(...xs),
        minCz: Math.min(...zs),
        maxCz: Math.max(...zs),
      });
    }
    const indoors = buildingCellKeys(layout.buildings);
    const index = caveNameIndex(layout);
    const floorNames = layout.floorNames || {};
    const caveCells = new Set();
    for (const entry of layout.floor || []) {
      const level = entry ? levelOfEntry(entry) : 0;
      if (level !== 0) caveCells.add(`${level}|${entry.cx},${entry.cz}`);
    }
    const caveOf = (level, cx, cz) => {
      const named = caveNameAt(index, level, cx, cz);
      return named ? { name: named.name, id: `cave:${named.id}` } : { name: floorNames[level] || MAP_CAVE_NAME, id: `cave:${level}` };
    };
    const mouths = [];
    for (const link of this.navigation.connectorsOf() || []) {
      const ends = [link && link.from, link && link.to];
      const side = ends.find((end) => end && (end.level || 0) === 0);
      const below = ends.find((end) => end && (end.level || 0) !== 0);
      if (!side || !below) continue;
      const indoor = indoors.has(`${side.cx},${side.cz}`);
      const cave = caveOf(below.level, below.cx, below.cz);
      const near = mouths.find((mouth) => mouth.cave.id === cave.id && mouth.indoor === indoor && mouth.cells.some(([cx, cz]) => Math.abs(cx - side.cx) <= 1 && Math.abs(cz - side.cz) <= 1));
      if (near) near.cells.push([side.cx, side.cz]);
      else mouths.push({ level: below.level, indoor, cave, cells: [[side.cx, side.cz]] });
    }
    return { buildings, mouths, caveOf, caveCells };
  },

  mouthFound(mouth) {
    return mouth.cells.some(([cx, cz]) => this.exploration.discovered(`mouth:${cx},${cz}`));
  },

  mapMarkers() {
    const layout = this.mapLayout || {};
    const { buildings, mouths } = this.mapSites();
    const markers = [];
    for (const site of buildings) {
      if (!this.exploration.revealAll && !this.exploration.discovered(site.id)) continue;
      markers.push({
        kind: 'cabin',
        cx: (site.minCx + site.maxCx) / 2,
        cz: (site.minCz + site.maxCz) / 2,
        width: site.maxCx - site.minCx + 1,
        depth: site.maxCz - site.minCz + 1,
        label: site.label,
      });
    }
    for (const entry of layout.decorations || []) {
      if (!entry || entry.key !== 'campfire' || levelOfEntry(entry) !== 0) continue;
      if (this.exploration.isRevealed(entry.cx, entry.cz)) markers.push({ kind: 'campfire', cx: entry.cx, cz: entry.cz, label: 'Táborák' });
    }
    for (const mouth of mouths) {
      if (!this.exploration.revealAll && !this.mouthFound(mouth)) continue;
      const cx = mouth.cells.reduce((sum, cell) => sum + cell[0], 0) / mouth.cells.length;
      const cz = mouth.cells.reduce((sum, cell) => sum + cell[1], 0) / mouth.cells.length;
      markers.push({ kind: 'cave', cx, cz, label: `Vchod — ${mouth.cave.name}` });
    }
    return markers;
  },

  announceCave(cave) {
    if (this.exploration.discover(cave.id)) this.toasts.push(MAP_FOUND_TITLE, cave.name);
  },

  discoverMouth(mouth) {
    for (const [cx, cz] of mouth.cells) this.exploration.discover(`mouth:${cx},${cz}`);
    this.announceCave(mouth.cave);
  },

  discoverNear(cx, cz) {
    const { buildings, mouths } = this.mapSites();
    for (const site of buildings) {
      const dx = Math.max(site.minCx - cx, 0, cx - site.maxCx);
      const dz = Math.max(site.minCz - cz, 0, cz - site.maxCz);
      if (dx * dx + dz * dz > MAP_BUILDING_REACH * MAP_BUILDING_REACH) continue;
      if (this.exploration.discover(site.id)) this.toasts.push(MAP_FOUND_TITLE, site.label);
    }
    for (const mouth of mouths) {
      if (mouth.indoor || this.mouthFound(mouth)) continue;
      const close = mouth.cells.some(([mx, mz]) => (mx - cx) ** 2 + (mz - cz) ** 2 <= MAP_MOUTH_REACH * MAP_MOUTH_REACH);
      if (close) this.discoverMouth(mouth);
    }
  },

  discoverCave(level, cx, cz) {
    const { mouths, caveOf, caveCells } = this.mapSites();
    if (!caveCells.has(`${level}|${cx},${cz}`)) return;
    const cave = caveOf(level, cx, cz);
    for (const mouth of mouths) {
      if (mouth.indoor && mouth.cave.id === cave.id) this.discoverMouth(mouth);
    }
    this.announceCave(cave);
  },

  tickExploration() {
    const root = this.playerSystem.root;
    if (!this.loaded || this.editor.active || !root) return;
    const level = this.playerSystem.level || 0;
    const { cx, cz } = worldToCellCoords(root.position.x, root.position.z);
    const key = `${level}|${cx},${cz}`;
    if (key === this.mapRevealedAt) return;
    this.mapRevealedAt = key;
    if (level !== 0) {
      this.discoverCave(level, cx, cz);
      return;
    }
    this.exploration.reveal(cx, cz, MAP_REVEAL_RADIUS);
    this.discoverNear(cx, cz);
  },

  refreshMapWindow() {
    const ex = this.exploration;
    if (this.mapFogVersion !== ex.version) {
      this.mapFogVersion = ex.version;
      this.mapWindow.setFog(ex.shownMask(), ex.width, ex.height);
      this.mapWindow.setMarkers(this.mapMarkers());
      this.mapWindow.setPins(ex.pins);
    }
    const root = this.playerSystem.root;
    if (root) this.mapWindow.setPlayer(root.position.x / cellToWorld(1), root.position.z / cellToWorld(1), this.playerSystem.facing || 0);
  },

  updateMapHud() {
    const camera = this.camera;
    this.compassBar.setVisible(!this.editor.active);
    if (camera) this.compassBar.setHeading(Math.atan2(-Math.cos(camera.alpha), -Math.sin(camera.alpha)));
    if (this.mapWindow.open) this.refreshMapWindow();
  },

  toggleMapWindow() {
    if (this.mapWindow.open) {
      this.mapWindow.close();
      return;
    }
    this.prepareMap();
    this.mapRevealedAt = null;
    this.tickExploration();
    this.mapWindow.show();
    this.refreshMapWindow();
    const root = this.playerSystem.root;
    if (root) this.mapWindow.centerOn(root.position.x / cellToWorld(1), root.position.z / cellToWorld(1));
    this.audioSystem.play('windowOpen');
    this.mapButton.setActive(true);
  },

  clickMapPin(cx, cz, reach) {
    const changed = this.exploration.removePinNear(cx, cz, reach) || this.exploration.addPin(cx, cz);
    if (!changed) return;
    this.audioSystem.play('itemDrop');
    this.refreshMapWindow();
  },
};
