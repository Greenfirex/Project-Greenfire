// Část herní scény: stavba světa po částech, načtení mapy a přestavby po úpravě v editoru.
// Patří ke GameScene (sdílí její this); jen ji dělí, aby hlavní soubor zůstal přehledný.
import { whenModelsIdle, preloadModel, loadModel, releaseFrame } from '../utils/assetLoader.js';
import { decorationModelUrl } from '../utils/decoTemplate.js';
import { grassModelUrls } from '../data/catalogs/grass.js';
import { getMap } from '../data/catalogs/maps.js';
import { mapFileFromLayout, layoutFromMapFile, isMapFile, MAP_VERSION, quantizeMapFileHeights, defaultSpawn } from '../data/catalogs/mapFile.js';
import { describeWorld, stagePieces } from '../data/catalogs/worldStages.js';
import { PAINT_TERRAIN, PAINT_DECORATIONS, PAINT_CREATURES, PAINT_FISH, PAINT_ALL } from '../data/catalogs/brushes.js';
import { getDecoration } from '../data/catalogs/decorations.js';

const WORLD_BATCH = 4;
const WORLD_BATCH_BULK = 1500;
const STAGE_LEAD_FRAMES = 2;
const MODEL_LANES = 4;
const LOAD_RETRIES = 2;
const REBUILD_HEIGHTS = 'heights';
const REBUILD_LABELS = [
  { part: PAINT_TERRAIN, label: 'terén' },
  { part: REBUILD_HEIGHTS, label: 'výšky' },
  { part: PAINT_DECORATIONS, label: 'dekorace' },
  { part: PAINT_CREATURES, label: 'tvory' },
  { part: PAINT_FISH, label: 'ryby' },
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
    this.terrainSystem.clear();
    this.terrainSystem.create(this.mapKey, this.mapFile);
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.navigation.resetArea();
    this.creatureSystem.clearPathCache();
    this.refreshShadowCasters();
    this.renderWater();
    this.cliffVineSystem.create(this.terrainSystem.shelfAnchors);
  },

  setupTerrain() {
    const ground = this.terrainSystem.create(this.mapKey, this.mapFile);
    if (ground && ground.length) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.navigation.resetArea();
    this.creatureSystem.clearPathCache();
    this.renderWater();
    this.cliffVineSystem.create(this.terrainSystem.shelfAnchors);
  },

  wireDecoReady() {
    this.gatherSystem.clear();
    this.decoSystem.onDecoReady = (anchor, node, def, entry) => this.onDecoPlaced(anchor, node, def, entry);
  },

  onDecoPlaced(anchor, node, def, entry) {
    const underWater = this.underWaterLevel(anchor.position.y);
    for (const child of node.getChildMeshes()) {
      child.isPickable = false;
      if (def.castsShadow && !underWater) this.addShadowCaster(child);
    }
    this.decoHighlight.add(entry, node, def);
    this.gatherSystem.ensureEntry(anchor);
    this.campfireSystem.add(entry, def, anchor.position.y);
  },

  underWaterLevel(y) {
    const level = this.mapLayout ? this.mapLayout.waterLevel : null;
    return Number.isFinite(level) && y < level;
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
    if (parts.has(PAINT_DECORATIONS)) await this.rebuildDecorations();
    else if (heightsOnly) this.reseatDecorations();
    if (parts.has(PAINT_CREATURES)) {
      await this.refreshCreatures();
      this.handleHover(this.hoverCell);
    }
    if (!terrain && parts.has(PAINT_FISH)) this.refreshFish();
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

  reseatDecorations() {
    const layout = this.mapFile || {};
    this.decoSystem.beginHeights(layout, getMap(this.mapKey).colors);
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
    for (const stage of stages) {
      const entries = stagePieces(layout, stage);
      if (!entries.length) continue;
      models = await this.loadStageModels(entries, models);
      await this.placeStage(stage, entries);
    }
    this.decoSystem.finishStages();
    this.finishRebuild();
  },

  grassLook() {
    const map = getMap(this.mapKey);
    return {
      shade: this.terrainSystem.grassShade(map),
      groundPatch: this.options.groundBlend !== false,
    };
  },

  async loadGrassModels() {
    const detail = this.options.grassFern === 'detail';
    if (!this.grassTemplates) this.grassTemplates = new Map();
    const list = [];
    for (const item of grassModelUrls(detail)) {
      let template = this.grassTemplates.get(item.url);
      if (!template) {
        template = await loadModel(this.s, item.url);
        if (template) this.grassTemplates.set(item.url, template);
      }
      if (template) list.push({ species: item.species, template });
    }
    return list;
  },

  async rebuildGrass() {
    this.grassModelList = await this.loadGrassModels();
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.floraSystem.addShelfGrass(this.terrainSystem.shelfAnchors);
    this.floraSystem.updateView(this.viewCircle());
    this.refreshReflectionExclusions();
  },

  finishRebuild() {
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.floraSystem.addShelfGrass(this.terrainSystem.shelfAnchors);
    this.floraSystem.updateView(this.viewCircle());
    this.refreshReflectionExclusions();
    this.gatherSystem.syncFromDeco();
    this.syncFelling();
    this.syncHarvest();
    this.campfireSystem.sync((this.mapFile || {}).decorations || []);
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
