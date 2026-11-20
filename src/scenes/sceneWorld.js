// Část herní scény: stavba světa po částech, načtení mapy a přestavby po úpravě v editoru.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { whenModelsIdle, preloadModel, loadModel, releaseFrame } from '../utils/assetLoader.js';
import { decorationModelUrl } from '../utils/decoTemplate.js';
import { grassModelUrls } from '../data/catalogs/grass.js';
import { getMap } from '../data/catalogs/maps.js';
import { mapFileFromLayout, layoutFromMapFile, isMapFile, MAP_VERSION, quantizeMapFileHeights, defaultSpawn } from '../data/catalogs/mapFile.js';
import { describeWorld, stagePieces } from '../data/catalogs/worldStages.js';
import { PAINT_TERRAIN, PAINT_DECORATIONS, PAINT_CREATURES, PAINT_FISH, PAINT_CRABS, PAINT_ALL } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { fillLakes } from '../utils/lakeFill.js';
import { riverCells, riverFalls } from '../utils/riverPlan.js';
import { cellKey, worldToCellCoords } from '../utils/gridMath.js';
import { nestSpots } from '../utils/nestGuard.js';

const WORLD_BATCH = 30;
const WORLD_BATCH_BULK = 1500;
const STAGE_LEAD_FRAMES = 2;
const MODEL_LANES = 4;
const LOAD_RETRIES = 2;
const REBUILD_HEIGHTS = 'heights';
const RESEAT_DECORATIONS = 'reseat';
const REBUILD_LABELS = [
  { part: PAINT_TERRAIN, label: 'terén' },
  { part: REBUILD_HEIGHTS, label: 'výšky' },
  { part: PAINT_DECORATIONS, label: 'dekorace' },
  { part: RESEAT_DECORATIONS, label: 'dekorace' },
  { part: PAINT_CREATURES, label: 'tvory' },
  { part: PAINT_FISH, label: 'ryby' },
  { part: PAINT_CRABS, label: 'kraby' },
];

export default {
  buildWorld() {
    const stages = describeWorld(this.mapFile || {});
    if (stages.length) return this.buildWorldStages();
    return this.buildWorldAtOnce();
  },

  async buildWorldAtOnce() {
    this.loader.openStage('Stavím svět');
    this.loader.stageTotal(this.decoSystem.blocksPlaced());
    await this.decoSystem.settle();
    this.decoSystem.finishStages();
    this.gatherSystem.syncFromDeco();
    this.loader.stageProgress(this.decoSystem.blocksPlaced());
    this.loader.endStage();
    this.loader.endWorld();
  },

  async waitForWorld() {
    for (let i = 0; i < 3000; i += 1) {
      if (this.loader.allDone) break;
      await whenModelsIdle();
      await releaseFrame();
    }
    this.loader.finish();
  },

  refreshTerrain() {
    this.floatingNumbers.clear();
    this.bodyCache = null;
    this.terrainSystem.clear();
    this.terrainSystem.create(this.mapKey, this.mapFile);
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.navigation.resetArea();
    this.creatureSystem.clearPathCache();
    this.refreshShadowCasters();
    this.renderWater();
  },

  setupTerrain() {
    this.bodyCache = null;
    const ground = this.terrainSystem.create(this.mapKey, this.mapFile);
    if (ground && ground.length) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.navigation.resetArea();
    this.creatureSystem.clearPathCache();
    this.renderWater();
  },

  wireDecoReady() {
    this.gatherSystem.clear();
    this.decoSystem.onDecoReady = (anchor, node, def, entry) => this.onDecoPlaced(anchor, node, def, entry);
  },

  onDecoPlaced(anchor, node, def, entry) {
    const underWater = this.underWaterLevel(anchor.position);
    for (const child of node.getChildMeshes()) {
      child.isPickable = false;
      if (def.castsShadow && !underWater) this.addShadowCaster(child);
    }
    this.decoHighlight.add(entry, node, def);
    this.gatherSystem.ensureEntry(anchor);
    this.campfireSystem.add(entry, def, anchor.position.y);
    this.lootSystem.add(entry, def, node, anchor.position);
    if (def.loot) this.syncLootHighlights();
  },

  underWaterLevel(position) {
    const { cx, cz } = worldToCellCoords(position.x, position.z);
    const level = this.waterLevelAtCell(cx, cz);
    return level !== null && position.y < level;
  },

  waterBodies() {
    const terrain = this.terrainSystem;
    if (!terrain.field || !terrain.groundCells) return { list: [], cells: new Map(), falls: [] };
    if (!this.bodyCache) {
      const layout = this.mapLayout || {};
      const present = new Set(terrain.groundCells.map(([cx, cz]) => cellKey(cx, cz)));
      const riverKeys = this.riverCellKeys(present);
      const lakes = fillLakes(layout.lakes, present, (cx, cz) => terrain.heightAtCell(cx, cz), riverKeys);
      const list = lakes.list.map((lake) => ({
        kind: 'lake',
        index: lake.index,
        cells: lake.cells.map(([cx, cz]) => ({ cx, cz, level: lake.level })),
      }));
      const cells = new Map();
      for (const body of list) for (const cell of body.cells) cells.set(cellKey(cell.cx, cell.cz), { kind: body.kind, level: cell.level });
      for (const [index, river] of (layout.rivers || []).entries()) {
        const own = riverCells(river, present).filter((cell) => !cells.has(cellKey(cell.cx, cell.cz)));
        if (!own.length) continue;
        for (const cell of own) cells.set(cellKey(cell.cx, cell.cz), { kind: 'river', level: cell.level });
        list.push({ kind: 'river', index, cells: own });
      }
      const falls = (layout.rivers || []).flatMap((river) => riverFalls(river));
      this.bodyCache = { list, cells, falls };
    }
    return this.bodyCache;
  },

  waterfallFaces() {
    const faces = new Set();
    for (const fall of this.waterBodies().falls) {
      const half = Math.floor((fall.width - 1) / 2);
      for (let step = -half; step <= half; step += 1) {
        faces.add(`${fall.cx - fall.dz * step},${fall.cz + fall.dx * step}|${fall.dx},${fall.dz}`);
      }
    }
    return faces;
  },

  riverCellKeys(present) {
    const keys = new Set();
    for (const river of (this.mapLayout && this.mapLayout.rivers) || []) {
      for (const cell of riverCells(river, present)) keys.add(cellKey(cell.cx, cell.cz));
    }
    return keys;
  },

  refreshWaterBodies() {
    this.bodyCache = null;
    this.renderHeights();
  },

  waterBodyAtCell(cx, cz) {
    return this.waterBodies().cells.get(cellKey(cx, cz)) || null;
  },

  waterLevelAtCell(cx, cz) {
    const body = this.waterBodyAtCell(cx, cz);
    if (body) return body.level;
    const sea = this.mapLayout ? this.mapLayout.waterLevel : null;
    return Number.isFinite(sea) ? sea : null;
  },

  async buildWorldStages() {
    const layout = this.mapFile || {};
    const stages = describeWorld(layout);
    if (!stages.length) {
      this.decoSystem.finishStages();
      this.loader.endWorld();
      return;
    }
    let models = null;
    for (const stage of stages) {
      const entries = stagePieces(layout, stage);
      if (!entries.length) continue;
      const blocks = this.stageBlocks(entries);
      if (blocks <= 0) continue;
      this.loader.openStage(stage.label);
      this.loader.stageTotal(blocks);
      await this.announceStage();
      models = await this.loadStageModels(entries, models);
      await this.placeStage(stage, entries);
      this.loader.endStage();
    }
    this.decoSystem.finishStages();
    this.loader.endWorld();
  },

  async announceStage() {
    for (let i = 0; i < STAGE_LEAD_FRAMES; i += 1) await releaseFrame();
  },

  async loadStageModels(entries, cache) {
    const known = cache || new Map();
    const missing = [];
    for (const entry of entries) {
      if (known.has(entry.key) || !this.decoSystem.hasModel(entry.key)) continue;
      known.set(entry.key, null);
      if (!decorationModelUrl(getDecoration(entry.key))) continue;
      missing.push(entry.key);
    }
    if (!missing.length) return known;
    let done = 0;
    const total = missing.length;
    this.loader.note(`Připravuji 0 z ${total} modelů`);
    const queue = missing.map((key) => ({ key, left: LOAD_RETRIES }));
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        const root = await preloadModel(this.s, decorationModelUrl(getDecoration(item.key)));
        if (root) {
          known.set(item.key, root);
          done += 1;
        } else if (item.left > 1) {
          item.left -= 1;
          queue.push(item);
        } else {
          done += 1;
        }
        this.loader.note(`Připravuji ${done} z ${total} modelů`);
        await releaseFrame();
      }
    };
    const lanes = [];
    for (let i = 0; i < MODEL_LANES && i < total; i += 1) lanes.push(worker());
    await Promise.all(lanes);
    await releaseFrame();
    return known;
  },

  stageBlocks(entries) {
    let total = 0;
    for (const entry of entries) total += this.decoSystem.blockCount(entry);
    return total;
  },

  sectionFor(kind) {
    if (kind === 'path') return 'path';
    if (kind === 'floor' || kind === 'ground') return kind;
    return 'deco';
  },

  stageHasModels(entries) {
    for (const entry of entries) {
      if (this.decoSystem.hasModel(entry.key)) return true;
    }
    return false;
  },

  async placeStage(stage, entries) {
    const section = this.sectionFor(stage.kind);
    const batch = this.stageHasModels(entries) ? WORLD_BATCH : WORLD_BATCH_BULK;
    let cleared = 0;
    let blocks = 0;
    for (const entry of entries) {
      blocks += this.decoSystem.blockCount(entry);
      this.decoSystem.placePiece(entry, section);
      cleared += 1;
      if (cleared >= batch) {
        await this.flushPlaced(blocks);
        cleared = 0;
        blocks = 0;
      }
    }
    if (cleared > 0) await this.flushPlaced(blocks);
  },

  async flushPlaced(blocks) {
    await this.decoSystem.settle();
    await releaseFrame();
    this.loader.stageProgress(blocks);
  },

  setupDecorations() {
    this.gatherSystem.syncFromDeco();
    this.campfireSystem.sync(this.mapFile.decorations || []);
    this.lootSystem.sync(this.mapFile.decorations || []);

    this.editor.connect();
  },

  renderMapLayout(parts) {
    const list = Array.isArray(parts) ? parts : PAINT_ALL;
    if (!this.rebuildParts) this.rebuildParts = new Set();
    for (const part of list) this.rebuildParts.add(part);
    this.rebuildPending = true;
    if (this.rebuildRunning) return;
    this.runMapRebuild();
  },

  async runMapRebuild() {
    if (this.rebuildRunning) return;
    this.rebuildRunning = true;
    try {
      while (this.rebuildPending) {
        this.rebuildPending = false;
        const parts = this.takeRebuildParts();
        if (parts.size) {
          this.showRebuildBusy(parts);
          await this.nextFrame();
        }
        await this.rebuildWorld(parts);
      }
    } catch (error) {
      console.error('[debug] rebuildDecorations ERROR:', error);
      this.reportRebuildError(error);
    } finally {
      this.rebuildRunning = false;
      this.hideRebuildBusy();
      if (this.rebuildPending) this.runMapRebuild();
    }
  },

  takeRebuildParts() {
    const parts = this.rebuildParts || new Set(PAINT_ALL);
    this.rebuildParts = null;
    return parts;
  },

  nextFrame() {
    if (document.hidden) return Promise.resolve();
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  },

  async rebuildWorld(parts) {
    this.adoptEditorMap();
    this.markMapDirty();
    const terrain = parts.has(PAINT_TERRAIN);
    const heightsOnly = !terrain && parts.has(REBUILD_HEIGHTS);
    if (terrain) {
      this.gatherSystem.clear();
      this.refreshTerrain();
      await this.terrainSystem.whenReady();
    }
    if (heightsOnly) {
      this.refreshTerrain();
      await this.terrainSystem.whenReady();
    }
    const decorations = parts.has(PAINT_DECORATIONS);
    const reseat = !decorations && (heightsOnly || parts.has(RESEAT_DECORATIONS));
    if (this.decorShaping && (decorations || reseat)) {
      this.decorStale = decorations || this.decorStale === 'full' ? 'full' : 'reseat';
    } else if (decorations) await this.rebuildDecorations();
    else if (reseat) this.reseatDecorations();
    if (parts.has(PAINT_CREATURES)) {
      await this.refreshCreatures();
      this.handleHover(this.hoverCell);
    }
    if (!terrain && parts.has(PAINT_FISH)) this.refreshFish();
    if (!terrain && parts.has(PAINT_CRABS)) this.refreshCrabs();
    if (!this.decorShaping && this.decorHidden) this.hideDecor(false);
  },

  setDecorShaping(on) {
    const next = on === true;
    if (next === Boolean(this.decorShaping)) return;
    this.decorShaping = next;
    if (next) {
      this.hideDecor(true);
      return;
    }
    const stale = this.decorStale;
    this.decorStale = null;
    if (stale) this.renderMapLayout([stale === 'full' ? PAINT_DECORATIONS : RESEAT_DECORATIONS]);
    else this.hideDecor(false);
  },

  hideDecor(hidden) {
    this.decorHidden = hidden;
    this.decoSystem.setHidden(hidden);
    this.floraSystem.setHidden(hidden);
  },

  showRebuildBusy(parts) {
    if (!this.editor.active) return;
    const labels = REBUILD_LABELS.filter((entry) => parts.has(entry.part)).map((entry) => entry.label);
    this.editor.hud.setBusy(labels.length ? `Přepočítávám: ${labels.join(' · ')}` : 'Přepočítávám mapu…');
  },

  hideRebuildBusy() {
    if (this.rebuildRunning) return;
    this.editor.hud.setBusy(null);
  },

  renderHeights() {
    this.renderMapLayout([REBUILD_HEIGHTS]);
  },

  buildBuildings() {
    this.buildingSystem.build(this.mapFile || {});
    this.cliffVineSystem.hideGroups(this.buildingSystem.hiddenGroups());
    this.fireLights.refreshCasters();
    this.refreshVines();
  },

  reseatDecorations() {
    const layout = this.mapFile || {};
    this.decoSystem.beginHeights(layout, getMap(this.mapKey).colors);
    this.buildBuildings();
    this.decoSystem.reseatHeights();
    this.floraSystem.reseatHeights();
    this.campfireSystem.reseatHeights((entry) => this.decoSystem.entryHeight(entry), layout.decorations);
    this.gatherSystem.syncFromDeco();
    this.syncFelling();
    this.refreshShadowCasters();
    this.handleHover(this.hoverCell);
    this.reportRebuild();
  },

  async rebuildDecorations() {
    const layout = this.mapFile || {};
    const stages = describeWorld(layout);
    let models = null;
    this.decoSystem.brokenCount = 0;
    this.decoHighlight.clear();
    this.decoSystem.beginStages(layout, getMap(this.mapKey).colors);
    this.decoSystem.buildPath();
    this.buildBuildings();
    for (const stage of stages) {
      const entries = stagePieces(layout, stage);
      if (!entries.length) continue;
      models = await this.loadStageModels(entries, models);
      await this.placeStage(stage, entries);
    }
    this.decoSystem.finishStages();
    this.finishRebuild();
    this.creatureSystem.setNests(nestSpots(this.mapLayout));
  },

  grassLook() {
    const map = getMap(this.mapKey);
    return {
      shade: this.terrainSystem.grassShade(map),
    };
  },

  async loadGrassModels() {
    if (!this.grassTemplates) this.grassTemplates = new Map();
    const list = [];
    for (const item of grassModelUrls()) {
      let template = this.grassTemplates.get(item.url);
      if (!template) {
        template = await loadModel(this.s, item.url);
        if (template) this.grassTemplates.set(item.url, template);
      }
      if (template) list.push({ species: item.species, template });
    }
    return list;
  },

  rebuildGrass() {
    return this.withBusy('Přepočítávám trávu…', async () => {
      this.grassModelList = await this.loadGrassModels();
      this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
      this.sowAnchoredGrass();
      this.floraSystem.updateView(this.viewCircle());
      this.refreshReflectionExclusions();
    });
  },

  async withBusy(text, work) {
    this.busyNotice.show(text);
    try {
      await this.nextFrame();
      await this.nextFrame();
      await work();
    } finally {
      this.busyNotice.hide();
    }
  },

  finishRebuild() {
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.sowAnchoredGrass();
    this.floraSystem.updateView(this.viewCircle());
    this.refreshReflectionExclusions();
    this.gatherSystem.syncFromDeco();
    this.syncFelling();
    this.syncHarvest();
    this.campfireSystem.sync((this.mapFile || {}).decorations || []);
    this.lootSystem.sync((this.mapFile || {}).decorations || []);
    this.refreshShadowCasters();
    this.handleHover(this.hoverCell);
    this.reportRebuild();
  },

  reportRebuildError(error) {
    const reason = error && error.message ? error.message : 'neznámá chyba';
    console.error('[mapa] Skládání světa selhalo:', error);
    this.editor.hud.setReadout(`Mapu se nepodařilo postavit — ${reason}`);
  },

  reportRebuild() {
    const broken = this.decoSystem.brokenCount || 0;
    const placed = this.decoSystem.placedCount();
    if (!this.editor.active) return;
    if (broken === 0) {
      this.editor.hud.setReadout(`Aplikováno — postaveno ${placed} objektů.`);
      return;
    }
    const label = broken === 1 ? '1 objekt se nepostavil' : `${broken} objektů se nepostavilo`;
    this.editor.hud.setReadout(`Aplikováno ${placed} objektů, ale ${label} — chybí model.`);
  },

  readMapFile() {
    return `/_map/${encodeURIComponent(this.mapKey)}`;
  },

  async loadMapFile() {
    try {
      const response = await fetch(this.readMapFile(), {
        method: 'POST',
        headers: { 'X-Map-Read': '1', 'Cache-Control': 'no-store' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const file = await response.json();
      if (!isMapFile(file)) throw new Error('neplatný tvar souboru');
      return file;
    } catch (error) {
      console.warn(`[mapa] Mapu ${this.mapKey} nejde přečíst ze souboru — ${error.message}`);
      return { version: MAP_VERSION, mapKey: this.mapKey, seed: getMap(this.mapKey).seed, spawn: defaultSpawn(), floor: [], path: [], decorations: [] };
    }
  },

  buildMapLayout(mapFile) {
    quantizeMapFileHeights(mapFile);
    this.mapFile = mapFile;
    this.mapLayout = layoutFromMapFile(mapFile, getMap(this.mapKey).seed);
    this.editor.useLayout(this.mapLayout);
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    return this.mapFile;
  },

  adoptEditorMap() {
    const layout = this.editor.getMap();
    if (!layout) return;
    this.mapLayout = layout;
    this.mapFile = mapFileFromLayout(this.mapKey, layout) || this.mapFile;
  },
};
