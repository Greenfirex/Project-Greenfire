// Herní scéna — orchestrátor. Drží stav světa, deleguje na systémy a řídí HUD.
// Systémy dostávají scénu v konstruktoru a přistupují k ní přes this.s.
import '@babylonjs/core/Lights/hemisphericLight';
import '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';

import CameraSystem from '../systems/cameraSystem.js';
import GridSystem from '../systems/gridSystem.js';
import TerrainSystem from '../systems/terrainSystem.js';
import DecoSystem from '../systems/decoSystem.js';
import FloraSystem from '../systems/floraSystem.js';
import DecoHighlightSystem from '../systems/decoHighlightSystem.js';
import CampfireSystem from '../systems/campfireSystem.js';
import GlowSystem from '../systems/glowSystem.js';
import DayNightSystem from '../systems/dayNightSystem.js';
import SimSystem from '../systems/simSystem.js';
import InputSystem from '../systems/inputSystem.js';
import PlayerSystem from '../systems/playerSystem.js';
import BuildSystem from '../systems/buildSystem.js';
import SaveSystem from '../systems/saveSystem.js';
import GatherSystem from '../systems/gatherSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import HeldItemSystem from '../systems/heldItemSystem.js';
import AudioSystem from '../systems/audioSystem.js';
import InventoryPanel from '../ui/inventoryPanel.js';
import Hud from '../ui/hud.js';
import Hotbar from '../ui/hotbar.js';
import EditorMode from '../systems/editorMode.js';
import EditorHud from '../ui/editorHud.js';
import BrushPanel from '../ui/brushPanel.js';
import AreaPanel from '../ui/areaPanel.js';
import EditorToggle from '../ui/editorToggle.js';
import PauseScreen from '../ui/pauseScreen.js';
import LoadingScreen from '../ui/loadingScreen.js';
import { whenModelsIdle, takeModelError, preloadModel, releaseFrame } from '../utils/assetLoader.js';
import { MACHINE_KEYS, DEFAULT_MACHINE, getMachine } from '../data/catalogs/machines.js';
import { HOTBAR_ITEMS } from '../data/catalogs/items.js';
import { worldToCellCoords, worldToCell } from '../utils/gridMath.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { SAVE_DEFAULTS, SAVE_VERSION, SAVE_STORAGE_KEY } from '../data/catalogs/saveSchema.js';
import { collectStartupUrls } from '../data/catalogs/modelCatalog.js';
import { mapFileFromLayout, layoutFromMapFile, isMapFile } from '../data/catalogs/mapFile.js';
import { worldCells, hasFloor } from '../data/maps/areaShape.js';
import { describeWorld, stagePieces } from '../data/catalogs/worldStages.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { OPTION_DEFAULTS, OPTIONS_STORAGE_KEY, QUALITY_SCALES } from '../data/catalogs/optionsSchema.js';
import OptionsPanel from '../ui/optionsPanel.js';

const AUTOTUNE_WINDOW_MS = 2000;
const AUTOTUNE_LOW_FPS = 45;
const AUTOTUNE_HIGH_FPS = 57;
const AUTOTUNE_MIN_SCALE = 0.7;
const AUTOTUNE_STEP = 0.1;
const WORLD_BATCH = 4;
const STAGE_LEAD_FRAMES = 2;
const MODEL_LANES = 4;
const LOAD_RETRIES = 2;
const BUILD_RANGE_CELLS = 2;
const WALK_CLEARANCE = 1.25;
const IMPACT_DELAY = 0.28;
const TIME_SKIP = { hours: 6 };


function surfaceStepSound(key) {
  const name = String(key || '').toLowerCase();
  if (/wood|plank|bridge|deck|board/.test(name)) return 'stepWood';
  if (/path|stone|rock|cobble|brick|tile|pavement|gravel/.test(name)) return 'stepStone';
  return 'stepGrass';
}

export default class GameScene {

  constructor(scene, engine, canvas) {
    this.s = scene;
    this.engine = engine;
    this.canvas = canvas;
    this.mapKey = DEFAULT_MAP;

    this.cameraSystem = new CameraSystem(scene);
    this.gridSystem = new GridSystem(scene);
    this.terrainSystem = new TerrainSystem(scene);
    this.decoSystem = new DecoSystem(scene);
    this.floraSystem = new FloraSystem(scene);
    this.campfireSystem = new CampfireSystem(scene);
    this.glowSystem = new GlowSystem(scene);
    this.decoHighlight = new DecoHighlightSystem(scene);
    this.dayNightSystem = new DayNightSystem(scene);
    this.simSystem = new SimSystem(scene);
    this.inputSystem = new InputSystem(scene, this);
    this.playerSystem = new PlayerSystem(scene);
    this.buildSystem = new BuildSystem(scene);
    this.gatherSystem = new GatherSystem(scene);
    this.gatherSystem.decoSystem = this.decoSystem;
    this.audioSystem = new AudioSystem(scene);
    this.inventorySystem = new InventorySystem();
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.hotbar = new Hotbar();
    this.inventoryPanel = new InventoryPanel();
    this.editorMode = new EditorMode();
    this.lastPaintCell = null;
    this.editorHud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.areaPanel = new AreaPanel();
    this.optionsPanel = new OptionsPanel();
    this.editorToggle = new EditorToggle();
    this.pauseScreen = new PauseScreen();
    this.paused = false;
    this.loader = new LoadingScreen();
    this.loader.onHiddenCallback = () => this.onLoadingHidden();
    this.isLoading = true;
    this.loaded = false;
    this.defaultMaxFPS = undefined;
    this.options = { ...OPTION_DEFAULTS };
    this.renderScale = 1;
    this.autoScale = 1;
    this.autoWindowStart = 0;
    this.autoWindowFrames = 0;
    this.shadowCasters = [];

    this.camera = null;
    this.shadowGenerator = null;
    this.currentMachine = DEFAULT_MACHINE;
    this.previewRotation = 0;
    this.heldItemSystem = new HeldItemSystem();
    this.heldItemSystem.onChange = () => this.onHeldItemChange();
    this.playerSystem.onStep = (x, z, sprint) => this.onPlayerStep(x, z, sprint);
    this.unlockAudio = () => {
      this.audioSystem.unlock();
      this.audioSystem.startAmbient();
    };
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio, { once: true });
    this.hoverCell = null;
    this.mapLayout = null;
    this.impactTimer = 0;
  }

  start() {
    const urls = collectStartupUrls(this.heldItemSystem.key || SAVE_DEFAULTS.heldItem.key);
    this.loader.plan(urls.length);
    this.startPreload(urls);
  }

  async startPreload(urls) {
    const result = await this.loader.runAssets(urls, (url) => preloadModel(this.s, url));
    this.loader.endAssets();
    if (result.failed) {
      console.warn(`[start] Nenačteno ${result.failed} modelů — hra pokračuje bez nich.`);
    }
    this.startWorld();
  }

  async startWorld() {
    this.audioSystem.load();
    this.refreshAmbient();
    this.campfireSystem.onIgniteStart = (item) => this.playerSystem.igniteAt(item.x, item.z);
    this.campfireSystem.onIgnite = () => this.audioSystem.play('ignite');
    this.setupGlow();
    this.setupLighting();
    this.camera = this.cameraSystem.create();
    this.loader.beginMap();
    const mapFile = await this.loadMapFile();
    this.loader.endMap();
    this.buildMapLayout(mapFile);
    this.setupTerrain();
    if (takeModelError()) console.warn('[start] Některé modely se nepodařilo načíst — hra pokračuje bez nich.');
    const stages = describeWorld(this.mapFile || {});
    this.loader.beginWorld(stages.length);
    this.wireDecoReady();
    this.decoHighlight.clear();
    this.decoHighlight.create((cx, cz) => this.decoSystem.surfaceAt(cx, cz));
    const map = getMap(this.mapKey);
    if (stages.length) this.decoSystem.beginStages(this.mapFile, map.colors);
    else this.decoSystem.create(this.mapFile, map.colors);
    this.decoSystem.buildPath();
    this.setupDecorations();
    this.gridSystem.create();
    this.setupSimulation();
    this.setupHud();
    this.setupOptions();
    this.setupInput();
    this.setupEditorToggle();
    this.registerHudEvents();
    this.heldItemSystem.apply(SAVE_DEFAULTS.heldItem);
    const restored = this.saveSystem.load();
    if (restored) this.heldItemSystem.set(this.heldItemSystem.key || SAVE_DEFAULTS.heldItem.key);

    this.buildSystem.onMachineReady = (record, node) => {
      const placeholder = record.mesh;
      if (placeholder) {
        const index = this.shadowCasters.indexOf(placeholder);
        if (index >= 0) this.shadowCasters.splice(index, 1);
      }
      for (const child of node.getChildMeshes()) this.addShadowCaster(child);
    };

    this.s.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      if (this.paused) {
        this.refreshClock();
        return;
      }
      this.simSystem.update(dt);
      this.decoHighlight.update(dt);
      if (this.isLoading) {
        this.audioSystem.update(dt);
        this.refreshClock();
        return;
      }
      this.followPointer();
      this.playerSystem.update(dt);
      this.glowSystem.retryPending();
      this.updateGathering(dt);
      const root = this.playerSystem.root;
      this.campfireSystem.update(dt, root);
      this.updateCampfireSound(root);
      if (root) this.cameraSystem.follow(root.position.x, root.position.z, dt);
      this.autoTune(dt);
      this.audioSystem.update(dt);
      this.playerSystem.updateFire();
      this.refreshClock();
    });

    this.engine.runRenderLoop(() => this.s.render());
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.inventoryPanel.update(this.inventorySystem);
    await this.prepareGame();
  }

  async prepareGame() {
    await this.buildWorld();
    this.setupShadowCasters();
    this.setupSave();
    this.loader.beginFloat('Budím postavu…');
    await this.setupPlayer();
    this.loader.floatProgress(1, 1, 'Seju trávu…');
    this.floraSystem.create(this.decoSystem, this.options.grass);
    this.loader.floatProgress(1, 1, 'Nastavuji stíny…');
    this.refreshShadowCasters();
    this.loader.endFloat();
    await this.waitForWorld();
    this.s.loaded = true;
  }

  async waitForWorld() {
    for (let i = 0; i < 3000; i += 1) {
      if (this.loader.allDone && this.loader.pending === 0) break;
      await whenModelsIdle();
      await releaseFrame();
    }
    if (this.loader.pending > 0) {
      console.warn(`[start] dokončení světa trvá příliš dlouho — zbývá ${this.loader.pending} kroků.`);
    }
    this.loader.finish();
  }

  buildWorld() {
    const stages = describeWorld(this.mapFile || {});
    if (stages.length) return this.buildWorldStages();
    return this.buildWorldAtOnce();
  }

  async buildWorldAtOnce() {
    this.loader.openStage('Stavím svět');
    this.loader.stageTotal(this.decoSystem.blocksPlaced());
    await this.decoSystem.settle();
    this.decoSystem.finishStages();
    this.gatherSystem.syncFromDeco();
    this.loader.stageProgress(this.decoSystem.blocksPlaced());
    this.loader.endStage();
    this.loader.endWorld();
  }
  onLoadingHidden() {
    if (!this.isLoading) return;
    this.isLoading = false;
    this.loaded = true;
    this.s.loaded = true;
    this.s.paused = false;
    this.optionsPanel.setButtonVisible(true);
    this.gatherSystem.syncFromDeco();
    this.gatherSystem.setPlayer(this.playerSystem);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(0, this.playerSystem);
    const kinds = {};
    for (const item of this.gatherSystem.entries) kinds[item.def.kind] = (kinds[item.def.kind] || 0) + 1;
    console.info(`[gather] připraveno ${this.gatherSystem.entries.length} sběratelných věcí: ${JSON.stringify(kinds)}`);
    this.playerSystem.bindKeys();
    this.simSystem.resetAccumulator();
    this.refreshAmbient();
    this.refreshClock();
    this.audioSystem.setMasterVolume(this.options.sfxVolume / 100);
    this.audioSystem.setAmbientVolume(this.options.ambientVolume / 100);
  }

  setupGlow() {
    this.glowSystem.create();
    this.campfireSystem.onFireAdded = (fire) => this.glowSystem.addSource(fire);
    this.campfireSystem.onFireRemoved = (fire) => this.glowSystem.removeSource(fire);
    this.playerSystem.setTorchGlow(this.glowSystem);
    this.playerSystem.syncTorchGlow();
    this.s.onAfterRenderObservable.addOnce(() => {
      for (const item of this.campfireSystem.fires) this.glowSystem.addSource(item.fire);
      this.playerSystem.syncTorchGlow();
    });
  }

  updateCampfireSound(root) {
    const burning = root ? this.campfireSystem.nearestBurning(root.position.x, root.position.z) : null;
    this.audioSystem.setFire(burning !== null, burning ? burning.distance : Infinity);
  }

  cancelCampfireIgnite() {
    if (!this.campfireSystem.cancel()) return;
    this.playerSystem.cancelIgnite();
  }

  followPointer() {
    if (!this.options.highlights) return;
    if (!this.inputSystem.takeMoved()) return;
    const inside = this.inputSystem.pointerInside();
    if (!inside) {
      this.decoHighlight.setHover(null);
      return;
    }
    const pointer = this.inputSystem.lastCell;
    if (pointer && this.decoHighlight.hasEntry(pointer.cx, pointer.cz)) {
      this.decoHighlight.setHover(pointer);
      return;
    }
    this.decoHighlight.setHover(this.inputSystem.cellAtPointer());
  }

  updateGathering(dt) {
    const active = this.loaded && !this.editorMode.active && !this.isBuilding();
    this.gatherSystem.setPlayer(active ? this.playerSystem : null);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(dt, this.playerSystem);
    if (active) this.holdStrikeReady();
    this.updateGatherImpact(dt);
    const target = active ? this.gatherSystem.target : null;
    this.hotbar.setPrompt(this.gatherPrompt(target));
  }

  gatherPrompt(target) {
    if (target) return this.describeGatherTarget(target);
    if (this.editorMode.active || this.isBuilding()) return '';
    if (this.campfireSystem.pending) return 'Zapaluji táborák…';
    if (this.campfireSystem.nearest) return 'E — zapálit Táborák';
    return '';
  }

  updateGatherImpact(dt) {
    const pending = this.gatherSystem.pending;
    if (!pending) {
      this.impactTimer = 0;
      return;
    }
    this.impactTimer += dt;
    if (this.impactTimer < (pending.delay || IMPACT_DELAY)) return;
    this.impactTimer = 0;
    const impact = this.gatherSystem.resolvePending();
    if (impact) this.onGatherImpact(impact);
  }

updateGatherTarget() {
    this.gatherSystem.setPlayer(this.playerSystem);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(0, this.playerSystem);
  }

  handleLeftDown() {
    if (!this.loaded || this.editorMode.active || this.isBuilding()) return;
    if (this.campfireSystem.pending) {
      this.cancelCampfireIgnite();
      return;
    }
    if (this.gatherSystem.target) {
      this.strikeGather();
      return;
    }
    this.updateGatherTarget();
    if (this.gatherSystem.target) {
      this.strikeGather();
      return;
    }
    const cell = this.inputSystem.lastCell;
    if (cell && this.campfireSystem.nearest && this.campfireSystem.has(cell.cx, cell.cz)) {
      this.campfireSystem.ignite(cell);
    }
  }

  describeGatherTarget(target) {
    const verb = target.def.kind === 'tree' ? 'kácet' : 'těžit';
    if (target.def.kind === 'ore') return `Levé tlačítko — ${verb} ${target.def.displayName} (${target.left} úderů)`;
    return `Levé tlačítko — ${verb} ${target.def.displayName} (${target.left}/${target.total})`;
  }

  strikeGather() {
    return this.gatherSystem.beginHit();
  }

  takenAnchor(cell) {
    for (const item of this.gatherSystem.entries) {
      if (item.left > 0) continue;
      if (item.entry.cx === cell.cx && item.entry.cz === cell.cz) return item.anchor;
    }
    return null;
  }

  holdStrikeReady() {
    if (!this.inputSystem.leftDown || this.isBuilding() || this.editorMode.active) return false;
    if (this.campfireSystem.pending) return false;
    const gather = this.gatherSystem;
    if (!gather.target || gather.cooldown > 0 || gather.pending) return false;
    return this.strikeGather();
  }

  onPlayerStep(x, z, sprint) {
    const key = this.decoSystem.surfaceKeyAt(worldToCell(x), worldToCell(z)) || '';
    this.audioSystem.play(surfaceStepSound(key), { gain: sprint ? 1.35 : 1 });
  }

  onGatherImpact(result) {
    this.audioSystem.play(result.sound);
    if (!result.exhausted) return;
    const cell = { cx: result.item.entry.cx, cz: result.item.entry.cz };
    const yields = this.gatherSystem.takeYield(result.item);
    if (!yields) return;
    if (result.item.def.kind === 'tree') this.audioSystem.play('fall');
    this.releaseGatherCell(this.takenAnchor(cell) || result.item.anchor, cell);
    this.refreshGatherTargets();
    for (const { itemKey, amount } of yields) this.inventorySystem.add(itemKey, amount);
    this.inventoryPanel.update(this.inventorySystem);
  }

  releaseGatherCell(anchor, cell) {
    if (anchor && !anchor.isDisposed()) anchor.setEnabled(false);
    this.decoHighlight.remove(cell.cx, cell.cz);
    this.decoSystem.releaseCell(cell.cx, cell.cz);
    if (this.inputSystem.lastCell && this.inputSystem.lastCell.cx === cell.cx && this.inputSystem.lastCell.cz === cell.cz) {
      this.decoHighlight.setHover(null);
    }
  }

  refreshGatherTargets() {
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(0, this.playerSystem);
  }

  async setupPlayer() {
    this.playerSystem.blockedTest = (cx, cz) => this.buildSystem.isOccupied(cx, cz);
    this.playerSystem.walkable = (x, z) => this.isWalkableAt(x, z);
    this.playerSystem.decoSystem = this.decoSystem;
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z);
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    this.playerSystem.setHeldTool(this.heldItemSystem.key);
    this.playerSystem.onProgress = (done) => this.loader.floatProgress(done);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.addShadowCaster(child);
    this.cameraSystem.snapTo(root.position.x, root.position.z);
  }

  refreshTerrain() {
    const reach = this.editorMode.active ? this.terrainSystem.reachCells() : null;
    this.terrainSystem.clear();
    this.terrainSystem.create(this.mapKey, this.mapFile, reach);
    this.editorMode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
  }

  setupTerrain() {
    const ground = this.terrainSystem.create(this.mapKey, this.mapFile);
    if (ground) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    this.editorMode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
  }

  wireDecoReady() {
    this.gatherSystem.clear();
    this.decoSystem.onDecoReady = (anchor, node, def, entry) => this.onDecoPlaced(anchor, node, def, entry);
  }

  onDecoPlaced(anchor, node, def, entry) {
    for (const child of node.getChildMeshes()) {
      child.isPickable = false;
      if (def.castsShadow) this.addShadowCaster(child);
    }
    this.decoHighlight.add(entry, node, def);
    this.gatherSystem.ensureEntry(anchor);
    this.campfireSystem.add(entry, def, anchor.position.y);
  }

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
  }

  async announceStage() {
    for (let i = 0; i < STAGE_LEAD_FRAMES; i += 1) await releaseFrame();
  }

  async loadStageModels(entries, cache) {
    const known = cache || new Map();
    const missing = [];
    for (const entry of entries) {
      if (known.has(entry.key) || !this.decoSystem.hasModel(entry.key)) continue;
      known.set(entry.key, null);
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
        const root = await preloadModel(this.s, getDecoration(item.key).model);
        done += 1;
        if (root) known.set(item.key, root);
        else if (item.left > 1) {
          item.left -= 1;
          queue.push(item);
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
  }

  stageBlocks(entries) {
    let total = 0;
    for (const entry of entries) total += this.decoSystem.blockCount(entry);
    return total;
  }

  sectionFor(kind) {
    if (kind === 'path') return 'path';
    if (kind === 'water') return 'water';
    return 'deco';
  }

  async placeStage(stage, entries) {
    const section = this.sectionFor(stage.kind);
    let cleared = 0;
    let blocks = 0;
    for (const entry of entries) {
      blocks += this.decoSystem.blockCount(entry);
      this.decoSystem.placePiece(entry, section);
      cleared += 1;
      if (cleared >= WORLD_BATCH) {
        await this.flushPlaced(blocks);
        cleared = 0;
        blocks = 0;
      }
    }
    if (cleared > 0) await this.flushPlaced(blocks);
  }

  async flushPlaced(blocks) {
    await this.decoSystem.settle();
    await releaseFrame();
    this.loader.stageProgress(blocks);
  }

  setupDecorations() {
    const map = getMap(this.mapKey);
    this.gatherSystem.syncFromDeco();
    this.campfireSystem.sync(this.mapFile.decorations || []);
    this.buildSystem.blockedTest = (cx, cz) => this.decoSystem.isBlocked(cx, cz);
    this.buildSystem.heightTest = (cx, cz) => this.decoSystem.topAt(cx, cz) > 0;
    this.buildSystem.rangeTest = (cx, cz) => this.withinBuildRange(cx, cz);
    this.gridSystem.onHologramReady = (machineKey) => {
      if (machineKey !== this.currentMachine) return;
      this.refreshHoverPreview();
    };

    this.editorMode.onRegenerate = () => this.renderMapLayout();
    this.editorMode.onAreaSelectionChange = (selection) => this.showAreaPreview(selection);
    this.editorMode.onChange = (active) => this.toggleEditorPanel(active);
    this.editorMode.onModeChange = (mode) => {
      this.editorHud.setMode(mode);
      this.syncEditorPanels(mode);
      this.showAreaPreview(this.editorMode.getAreaSelection());
      this.handleHover(this.hoverCell);
    };
    this.areaPanel.onTool = (tool) => {
      this.editorMode.setAreaTool(tool);
      this.areaPanel.setTool(this.editorMode.areaTool);
      this.handleHover(this.hoverCell);
    };
    this.areaPanel.onApply = () => this.applyAreaSelection();
    this.areaPanel.onClear = () => this.clearAreaSelection();
    this.areaPanel.onUndo = () => this.undoEdit();
    this.editorMode.onStyleChange = (brushKey, styleKey) => {
      this.brushPanel.setStyle(styleKey);
    };
    this.editorMode.onHeightChange = (level) => this.editorHud.setHeightLevel(level);
    this.editorMode.onDraftChange = (draft) => this.updateDraftView(draft);
    this.editorMode.onBrushChange = (key) => {
      this.editorHud.setBrush(key);
      this.openBrushPanel(key);
    };
    this.editorHud.onBrush = (key) => this.editorMode.setBrush(key);
    this.editorHud.onMode = (mode) => this.editorMode.setMode(mode);
    this.editorHud.onHeightLevel = (level) => this.editorMode.setHeightLevel(level);
    this.editorHud.onHeightStep = (delta) => this.editorMode.stepHeightLevel(delta);
    this.editorHud.onSmooth = () => this.editorMode.smoothHeights();
    this.editorHud.onClose = () => this.exitEditor();
    this.editorHud.onSaveMap = () => this.saveMapLayout();
    this.brushPanel.onApply = () => this.applyBrushDraft();
    this.brushPanel.onCancel = () => this.cancelBrushDraft();
    this.brushPanel.onStyle = (brushKey, styleKey) => this.editorMode.setStyle(styleKey);
    this.brushPanel.onErase = () => this.setEraseMode(!this.editorMode.erasing);
    this.brushPanel.onUndo = () => this.undoEdit();
  }

  setEraseMode(on) {
    this.editorMode.setDraftMode(on ? 'remove' : 'add');
    this.editorHud.erasing = this.editorMode.erasing;
    this.editorHud.refresh();
    this.brushPanel.setDraftMode(this.editorMode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  openBrushPanel(brushKey) {
    this.editorMode.beginDraft(brushKey);
    this.brushPanel.open(brushKey, 0, this.editorMode.pathStyle);
    this.brushPanel.setDraftMode(this.editorMode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  applyBrushDraft() {
    const removing = this.editorMode.draftMode === 'remove';
    const count = this.editorMode.applyDraft();
    if (count) this.editorHud.setReadout((removing ? 'Smazáno ' : 'Aplikováno ') + count + ' buněk');
    else this.editorHud.setReadout(removing ? 'Nic ke smazání' : 'Prázdná zóna');
    this.brushPanel.setDraftMode(this.editorMode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  cancelBrushDraft() {
    this.editorMode.cancelDraft();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  undoEdit() {
    if (!this.editorMode.undo()) {
      this.refreshUndoButton();
      this.handleHover(this.hoverCell);
      return false;
    }
    this.ensureDraft();
    this.refreshUndoButton();
    this.areaPanel.setCount(this.editorMode.pendingAreaCells());
    this.handleHover(this.hoverCell);
    return true;
  }

  ensureDraft() {
    if (this.editorMode.draft) return;
    if (!this.brushPanel.isOpen) return;
    const brushKey = this.editorMode.brushKey;
    if (!brushKey) return;
    this.editorMode.beginDraft(brushKey);
  }

  refreshUndoButton() {
    this.brushPanel.setUndoEnabled(this.editorMode.canUndo);
    this.areaPanel.setUndoEnabled(this.editorMode.canUndo);
  }

  undoEditor() {
    this.editorMode.undo();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.setEraseMode(false);
    this.refreshZoneOverlay();
  }

  updateDraftView(draft) {
    if (!draft) {
      this.brushPanel.setCount(0);
      this.refreshUndoButton();
      this.refreshZoneOverlay();
      return;
    }
    this.brushPanel.setDraftMode(draft.mode);
    this.brushPanel.setCount(draft.cells.size);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
  }

  refreshZoneOverlay() {
    if (!this.editorMode.active || !this.mapLayout || !this.editorMode.hasDraft) {
      this.gridSystem.clearZones();
      this.gridSystem.clearDraftCells();
      return;
    }
    const draft = this.editorMode.draft;
    const removing = draft.mode === 'remove';
    const surfaceAt = (cx, cz) => this.decoSystem.surfaceAt(cx, cz);
    const same = [];
    const other = [];

    const draftCells = [];
    for (const key of draft.cells) {
      const [cx, cz] = key.split(',').map(Number);
      draftCells.push([cx, cz]);
      if (removing) continue;
      if (this.editorMode.draftHasSame(cx, cz)) same.push([cx, cz]);
    }
    if (!removing) {
      for (const [cx, cz] of this.terrainSystem.realCells || []) {
        if (!this.editorMode.draftHasContent(cx, cz)) continue;
        if (this.editorMode.draftHasSame(cx, cz)) same.push([cx, cz]);
        else other.push([cx, cz]);
      }
    }

    this.gridSystem.showZones([
      {
        cells: other,
        color: new Color3(0.5, 0.55, 0.6),
        glow: new Color3(0.32, 0.36, 0.4),
        alpha: 0.28,
        lift: 0.015,
      },
      {
        cells: same,
        color: new Color3(0.3, 0.62, 0.36),
        glow: new Color3(0.2, 0.45, 0.26),
        alpha: 0.3,
        lift: 0.02,
      },
      {
        cells: draftCells,
        color: removing ? new Color3(1, 0.3, 0.25) : new Color3(0.15, 1, 0.85),
        glow: removing ? new Color3(0.95, 0.25, 0.2) : new Color3(0.2, 0.95, 0.8),
        alpha: 0.72,
        lift: 0.055,
      },
    ], surfaceAt);

    this.gridSystem.showDraftCells(draftCells, surfaceAt, draft.mode);
  }

  renderMapLayout() {
    console.log('[debug] renderMapLayout called');
    const exhausted = this.gatherSystem.exhaustedCells();
    this.gatherSystem.clear();
    this.adoptEditorMap();
    this.markMapDirty();
    this.refreshTerrain();
    this.terrainSystem.whenReady()
      .then(() => this.rebuildDecorations(exhausted))
      .catch((error) => {
        console.error('[debug] rebuildDecorations ERROR:', error);
        this.reportRebuildError(error);
      });
  }

  async rebuildDecorations(exhausted) {
    const layout = this.mapFile || {};
    const stages = describeWorld(layout);
    console.log('[debug] rebuildDecorations start — stages:', stages.map((s) => `${s.kind}:${s.keys.length}`).join(', '), '| path cells:', (layout.path || []).length, '| deco cells:', (layout.decorations || []).length);
    let models = null;
    this.decoSystem.brokenCount = 0;
    this.decoHighlight.clear();
    this.decoSystem.beginStages(layout, getMap(this.mapKey).colors);
    this.decoSystem.buildPath();
    for (const stage of stages) {
      const entries = stagePieces(layout, stage);
      if (!entries.length) continue;
      console.log('[debug] rebuild stage', stage.kind, 'entries:', entries.length);
      models = await this.loadStageModels(entries, models);
      await this.placeStage(stage, entries);
    }
    this.decoSystem.finishStages();
    console.log('[debug] rebuildDecorations done');
    this.finishRebuild(exhausted);
  }

  finishRebuild(exhausted) {
    this.floraSystem.create(this.decoSystem, this.options.grass);
    this.gatherSystem.syncFromDeco();
    this.campfireSystem.sync((this.mapFile || {}).decorations || []);
    this.restoreGatherEntries(exhausted);
    this.refreshShadowCasters();
    this.handleHover(this.hoverCell);
    this.reportRebuild();
  }

  reportRebuildError(error) {
    const reason = error && error.message ? error.message : 'neznámá chyba';
    console.error('[mapa] Skládání světa selhalo:', error);
    this.editorHud.setReadout(`Mapu se nepodařilo postavit — ${reason}`);
  }

  reportRebuild() {
    const broken = this.decoSystem.brokenCount || 0;
    const placed = this.decoSystem.placedCount();
    if (!this.editorMode.active) return;
    if (broken === 0) {
      this.editorHud.setReadout(`Aplikováno — postaveno ${placed} objektů.`);
      return;
    }
    const label = broken === 1 ? '1 objekt se nepostavil' : `${broken} objektů se nepostavilo`;
    this.editorHud.setReadout(`Aplikováno ${placed} objektů, ale ${label} — chybí model.`);
  }

  restoreGatherEntries(exhausted) {
    const cells = exhausted || [];
    for (const cell of cells) {
      const anchor = this.findDecoAnchor(cell.cx, cell.cz);
      if (anchor && !anchor.isDisposed()) this.decoSystem.releaseGather(anchor);
    }
  }

  findDecoAnchor(cx, cz) {
    const found = this.decoSystem.entryAt(cx, cz);
    return found ? found.anchor : null;
  }

  toggleEditorPanel(active) {
    if (!active && this.mapDirty) this.warnUnsavedMap();
    this.adoptEditorMap();
    this.terrainSystem.clear();
    if (active) {
      this.editorHud.show();
      this.editorHud.setMode(this.editorMode.mode);
      this.editorHud.setHeightLevel(this.editorMode.heightLevel);
    } else {
      this.editorHud.hide();
      this.gridSystem.clearBrush();
      this.brushPanel.close();
      this.areaPanel.hide();
    }
    this.refreshTerrain();
    this.syncEditorPanels(this.editorMode.mode);
    this.editorToggle.setActive(Boolean(active));
  }

  syncEditorPanels(mode) {
    if (!this.editorMode.active) {
      this.areaPanel.hide();
      return;
    }
    if (mode === 'area') {
      this.brushPanel.close();
      this.editorMode.cancelDraft();
      this.areaPanel.open(
        this.editorMode.areaTool,
        this.editorMode.pendingAreaCells(),
        this.editorMode.canUndo,
      );
      return;
    }
    this.areaPanel.hide();
  }

  exitEditor() {
    this.editorMode.cancelDraft();
    this.editorMode.clearAreaSelection();
    this.editorMode.active = false;
    this.brushPanel.close();
    this.areaPanel.hide();
    this.editorHud.clearBrushSelection();
    this.gridSystem.clearBrush();
    this.gridSystem.clearZones();
    this.gridSystem.clearDraftCells();
    this.toggleEditorPanel(false);
    this.editorToggle.setActive(false);
    this.releaseGameFromEditor();
  }

  readMapFile() {
    return `/_map/${encodeURIComponent(this.mapKey)}`;
  }

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
      this.hud.setSaveHint(`Mapu ${this.mapKey} nejde přečíst ze souboru — ${error.message}`);
      return { version: 3, mapKey: this.mapKey, seed: getMap(this.mapKey).seed, spawn: { cx: 0, cz: 0 }, floor: [], path: [], water: [], decorations: [] };
    }
  }

  buildMapLayout(mapFile) {
    this.mapFile = mapFile;
    this.mapLayout = layoutFromMapFile(mapFile, getMap(this.mapKey).seed);
    this.editorMode.useLayout(this.mapLayout);
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    return this.mapFile;
  }

  adoptEditorMap() {
    const layout = this.editorMode.getMap();
    if (!layout) return;
    this.mapLayout = layout;
    this.mapFile = mapFileFromLayout(this.mapKey, layout) || this.mapFile;
  }

  mapColor(mapKey, key) {
    const map = getMap(mapKey);
    if (!map || !map.colors[key]) return null;
    const c = map.colors[key];
    return new Color4(c[0], c[1], c[2], 1);
  }

  setupLighting() {
    const map = getMap(this.mapKey);
    const light = map.light;

    const hemi = new HemisphericLight('skyLight', new Vector3(0.3, 1, 0.2), this.s);
    hemi.intensity = light.hemiIntensity;
    hemi.groundColor = new Color3(light.hemiGround[0], light.hemiGround[1], light.hemiGround[2]);

    const dir = new DirectionalLight('sunLight', new Vector3(light.sunDirection[0], light.sunDirection[1], light.sunDirection[2]), this.s);
    dir.position = new Vector3(light.sunPosition[0], light.sunPosition[1], light.sunPosition[2]);
    dir.intensity = light.sunIntensity;
    if (light.sunColor) dir.diffuse = new Color3(light.sunColor[0], light.sunColor[1], light.sunColor[2]);

    this.shadowGenerator = new ShadowGenerator(1024, dir);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = light.shadowBlur;

    this.setupFog(map);

    this.dayNightSystem.create(map);
    this.dayNightSystem.attach(dir, hemi);
    this.dayNightSystem.apply();
  }

  setupFog(map) {
    const fog = map.fog;
    if (!fog) return;
    this.s.fogMode = Scene.FOGMODE_LINEAR;
    this.s.fogStart = fog.start;
    this.s.fogEnd = fog.end;
    this.s.fogColor = new Color3(fog.color[0], fog.color[1], fog.color[2]);
    this.dayNightSystem.fogColor = this.s.fogColor;
  }

  setupShadowCasters() {
    const surface = this.terrainSystem.surface;
    if (surface) surface.receiveShadows = true;
  }

  setupOptions() {
    const saved = readJSON(OPTIONS_STORAGE_KEY);
    this.optionsPanel.values = { ...OPTION_DEFAULTS, ...(saved || {}) };
    this.options = { ...this.optionsPanel.values };
    this.applyOptions();
    this.optionsPanel.mount();
    this.optionsPanel.render();
    this.optionsPanel.setButtonVisible(false);
    this.optionsPanel.onChange = (values) => {
      this.options = { ...values };
      this.autoScale = 1;
      writeJSON(OPTIONS_STORAGE_KEY, values);
      this.applyOptions();
    };
    window.addEventListener('beforeunload', (event) => {
      if (!this.mapDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  setupEditorToggle() {
    this.editorToggle.onToggle = () => this.toggleEditorMode();
    this.editorToggle.mount();
    this.editorToggle.setActive(this.editorMode.active);
    this.pauseScreen.onResume = () => this.togglePause();
    this.pauseScreen.mount();
    this.pauseScreen.setSpeed(this.simSystem.speed);
  }

  addShadowCaster(mesh) {
    if (!mesh || this.shadowCasters.includes(mesh)) return;
    this.shadowCasters.push(mesh);
    if (this.options.shadows) this.shadowGenerator.addShadowCaster(mesh);
  }

  removeShadowCaster(mesh) {
    const index = this.shadowCasters.indexOf(mesh);
    if (index < 0) return;
    this.shadowCasters.splice(index, 1);
    const renderList = this.shadowGenerator.getShadowMap().renderList;
    const listIndex = renderList ? renderList.indexOf(mesh) : -1;
    if (listIndex >= 0) renderList.splice(listIndex, 1);
    this.shadowGenerator.removeShadowCaster(mesh);
  }

  applyOptions() {
    this.defaultMaxFPS = this.options.fpsCap > 0 ? this.options.fpsCap : undefined;
    const qualityScale = QUALITY_SCALES[this.options.quality] ?? 1;
    this.renderScale = qualityScale;
    this.engine.setHardwareScalingLevel(1 / (qualityScale * this.autoScale));
    this.cameraSystem.applyOrtho();
    this.engine.maxFPS = this.paused ? 60 : this.defaultMaxFPS;
    this.refreshClock();
    this.shadowGenerator.getShadowMap().renderList = this.options.shadows ? this.shadowCasters.slice() : [];
    this.decoHighlight.setVisible(this.options.highlights);
    this.glowSystem.setEnabled(this.options.fireGlow);
    this.floraSystem.setDensity(this.options.grass);
    if (this.isLoading) return;
    this.audioSystem.setMasterVolume(this.options.sfxVolume / 100);
    this.audioSystem.setAmbientVolume(this.options.ambientVolume / 100);
  }

  autoTune(dt) {
    if (!this.options.autoTune) {
      this.autoWindowFrames = 0;
      return;
    }
    if (this.options.fpsCap > 0 && this.options.fpsCap <= AUTOTUNE_LOW_FPS) {
      this.autoWindowFrames = 0;
      return;
    }
    this.autoWindowStart += dt * 1000;
    this.autoWindowFrames += 1;
    if (this.autoWindowStart < AUTOTUNE_WINDOW_MS) return;
    const fps = this.autoWindowFrames / (this.autoWindowStart / 1000);
    this.autoWindowStart = 0;
    this.autoWindowFrames = 0;
    let next = this.autoScale;
    if (fps < AUTOTUNE_LOW_FPS) next = Math.max(AUTOTUNE_MIN_SCALE, this.autoScale - AUTOTUNE_STEP);
    else if (fps > AUTOTUNE_HIGH_FPS) next = Math.min(1, this.autoScale + AUTOTUNE_STEP);
    if (Math.abs(next - this.autoScale) < 0.001) return;
    this.autoScale = next;
    this.applyOptions();
  }

  setupSimulation() {
    this.simSystem.subscribe((tick) => {
      if (this.options.dayCycle) this.dayNightSystem.update(tick);
      this.refreshAmbient();
    });
    this.simSystem.onTick = null;
    this.refreshClock();
    this.hud.setClockSpeed(this.simSystem.speed, false);
  }

  refreshClock() {
    const cfg = this.dayNightSystem.config;
    const time = this.dayNightSystem.getTime();
    const minutes = Math.floor(time * 24 * 60) % (24 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    this.hud.setClockText(`${hh}:${mm}`);
    this.hud.setClockPhase(this.describeDayPhase(time, cfg));
    this.hud.setClockSpeed(this.simSystem.speed, this.paused || this.simSystem.halted);
  }

  refreshAmbient() {
    const dayness = this.dayNightSystem.config ? this.dayNightSystem.dayness(this.dayNightSystem.getTime()) : 1;
    const value = this.options.dayCycle ? dayness : 1;
    this.audioSystem.setDayness(value);
    this.floraSystem.setDayness(value);
    if (this.playerSystem.torchFire) this.playerSystem.torchFire.setDayness(value);
    this.campfireSystem.setDayness(value);
  }

  describeDayPhase(time, cfg) {
    if (!cfg) return 'Bez denního cyklu';
    if (!this.options.dayCycle) return 'Den a noc vypnutý';
    if (time < cfg.dawnTime || time > cfg.duskTime) return 'Noc';
    const t = (time - cfg.dawnTime) / (cfg.duskTime - cfg.dawnTime);
    if (t < 0.2) return 'Svitání';
    if (t > 0.8) return 'Soumrak';
    return 'Den';
  }

  setupHud() {
    this.hud.onSpeed = (speed) => this.setSimSpeed(speed);
    this.hud.mount();
    this.hud.setCount(this.buildSystem.count);
    this.hud.setStatusVisible(false);
    this.hotbar.mount();
    this.hotbar.onSelect = (key) => this.heldItemSystem.set(key);
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.inventoryPanel.update(this.inventorySystem);
    this.refreshClock();
  }

  onHeldItemChange() {
    this.hud.setStatusVisible(this.isBuilding());
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.playerSystem.setHeldTool(this.heldItemSystem.key);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    if (!this.isBuilding()) {
      this.hoverCell = null;
      this.gridSystem.hideHighlight();
      this.gridSystem.hideHologram();
    } else if (this.hoverCell) {
      this.handleHover(this.hoverCell);
    }
  }

  isBuilding() {
    return this.heldItemSystem.holds('build');
  }

  setupInput() {
    this.inputSystem.suppressContextMenu(this.canvas);
    this.inputSystem.groundPredicate = (mesh) => mesh === this.terrainSystem.ground;
    this.inputSystem.shouldPickByRay = () => this.editorMode.active && this.editorMode.mode === 'area';
    this.inputSystem.attach(this.camera, this);
    this.inputSystem.onLeftDown = () => this.handleLeftDown();
    this.inputSystem.onHoverCell = (cell) => this.handleHover(cell);
    this.inputSystem.onCellRightClick = (cell) => this.handleCellRightClick(cell);
    this.inputSystem.onPaintStart = (cell) => this.handlePaintStart(cell);
    this.inputSystem.onPaintMove = (cell) => this.handlePaintMove(cell);
    this.inputSystem.onPaintEnd = () => this.handlePaintEnd();
    this.inputSystem.onZoom = (delta) => {
      this.cameraSystem.zoomBy(delta);
      this.cameraSystem.applyOrtho();
    };
  }

  setupSave() {
    this.playerSystem.walkableCells = () => this.terrainSystem.realCells || [];
    this.saveSystem.registerState('player', {
      serialize: () => this.playerSystem.serialize(),
      apply: (data) => this.playerSystem.apply(data),
      order: 5,
    });
    this.saveSystem.registerState('inventory', {
      serialize: () => this.inventorySystem.serialize(),
      apply: (data) => {
        this.inventorySystem.apply(data);
        this.inventoryPanel.update(this.inventorySystem);
        this.restoreGatherEntries();
      },
      order: 6,
    });
    this.saveSystem.registerState('heldItem', {
      serialize: () => this.heldItemSystem.serialize(),
      apply: (data) => this.heldItemSystem.apply(data),
      order: 7,
    });
    this.saveSystem.registerState('machines', {
      serialize: () => this.buildSystem.serialize(),
      apply: (data) => this.buildSystem.apply(data),
      order: 10,
    });
    this.saveSystem.registerState('campfires', {
      serialize: () => this.campfireSystem.serializeState(),
      apply: (data) => this.campfireSystem.restoreState(data),
      order: 12,
    });
    this.saveSystem.registerState('dayNight', {
      serialize: () => ({ time: this.dayNightSystem.getTime() }),
      apply: (data) => {
        const defaults = SAVE_DEFAULTS.dayNight;
        const time = data && typeof data.time === 'number' ? data.time : defaults.time;
        this.dayNightSystem.setTime(time);
      },
      order: 20,
    });
    this.saveSystem.registerState('sim', {
      serialize: () => ({ time: this.simSystem.time }),
      apply: (data) => {
        const time = data && typeof data.time === 'number' && Number.isFinite(data.time) && data.time >= 0
          ? data.time
          : SAVE_DEFAULTS.sim.time;
        this.simSystem.time = time;
      },
      order: 25,
    });
  }

  registerHudEvents() {
    window.addEventListener('keydown', (evt) => this.handleKey(evt));
    window.addEventListener('blur', () => this.simSystem.resetAccumulator());
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  setPaused(on) {
    const paused = Boolean(on);
    if (paused === this.paused) return;
    this.paused = paused;
    this.s.paused = paused;
    this.simSystem.setHalted(paused);
    this.engine.maxFPS = paused ? 60 : this.defaultMaxFPS;
    if (paused) {
      this.pauseScreen.setSpeed(this.simSystem.speed);
      this.pauseScreen.show();
    } else if (this.editorMode.active) {
      this.pauseScreen.hide();
    } else {
      this.pauseScreen.hide();
      this.simSystem.resetAccumulator();
    }
    this.refreshClock();
  }

  setSimSpeed(speed) {
    this.simSystem.setSpeed(speed);
    this.pauseScreen.setSpeed(this.simSystem.speed);
    this.refreshClock();
  }

  toggleEditorMode() {
    const active = this.editorMode.toggle();
    if (active) {
      this.editorHud.setBrush(this.editorMode.brushKey);
      this.holdGameForEditor();
    } else {
      this.releaseGameFromEditor();
    }
    this.editorToggle.setActive(this.editorMode.active);
    return active;
  }

  holdGameForEditor() {
    if (this.paused) return;
    this.setPaused(true);
    this.pauseScreen.hide();
  }

  releaseGameFromEditor() {
    if (!this.paused) return;
    this.setPaused(false);
  }

  handleKey(evt) {
    if (!this.loaded) return;
    const typing = evt.target && (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA' || evt.target.isContentEditable);
    if ((evt.key === 'p' || evt.key === 'P') && !typing && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
      if (evt.repeat) return;
      evt.preventDefault();
      this.togglePause();
      return;
    }
    if (this.paused) {
      if (evt.key !== 'Escape') evt.preventDefault();
      return;
    }
    if ((evt.key === 'o' || evt.key === 'O') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.optionsPanel.toggle();
      return;
    }
    if (evt.key === 'F1') {
      evt.preventDefault();
      this.toggleEditorMode();
      return;
    }
    if (evt.key === 'g' || evt.key === 'G') {
      if (!evt.repeat) this.toggleGrid();
      evt.preventDefault();
      return;
    }
    if ((evt.key === 'n' || evt.key === 'N') && !evt.ctrlKey && !evt.metaKey && !evt.altKey && !typing) {
      if (!evt.repeat) this.toggleNight();
      evt.preventDefault();
      return;
    }
    if (this.editorMode.active) {
      if (evt.key === 'Escape' && this.editorMode.mode === 'area' && this.editorMode.hasAreaSelection) {
        this.clearAreaSelection();
        evt.preventDefault();
        return;
      }
      if (evt.key === 'Enter' && this.editorMode.hasAreaSelection) { this.applyAreaSelection(); evt.preventDefault(); return; }
      if (evt.key === 'Escape' && this.editorMode.hasDraft) { this.cancelBrushDraft(); evt.preventDefault(); return; }
      if (evt.key === 'Enter' && this.editorMode.hasDraft) { this.applyBrushDraft(); evt.preventDefault(); return; }
      if (evt.key === 'x' || evt.key === 'X') { this.setEraseMode(!this.editorMode.erasing); evt.preventDefault(); return; }
      if (evt.key === 'z' || evt.key === 'Z') { this.undoEdit(); evt.preventDefault(); return; }
      if (evt.key === 'h' || evt.key === 'H') {
        this.editorMode.setMode(this.editorMode.mode === 'height' ? 'zone' : 'height');
        evt.preventDefault();
        return;
      }
      if (evt.key === 'q' || evt.key === 'Q') { this.editorMode.stepHeightLevel(1); evt.preventDefault(); return; }
      if (evt.key === 'e' || evt.key === 'E') { this.editorMode.stepHeightLevel(-1); evt.preventDefault(); return; }
      if (/^[0-4]$/.test(evt.key)) {
        this.editorMode.setHeightLevel(Number(evt.key));
        evt.preventDefault();
        return;
      }
    }
    if (/^[1-5]$/.test(evt.key)) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      const key = HOTBAR_ITEMS[Number(evt.key) - 1];
      if (!key) return;
      if (this.editorMode.active) return;
      evt.preventDefault();
      if (this.heldItemSystem.key === key) this.heldItemSystem.set(null);
      else this.heldItemSystem.set(key);
      return;
    }
    if (evt.key === 'm' || evt.key === 'M') this.cycleMachine();
    if (evt.key === 'e' || evt.key === 'E') {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      if (this.campfireSystem.pending) {
        evt.preventDefault();
        this.cancelCampfireIgnite();
        return;
      }
      const fire = this.campfireSystem.nearest;
      if (!fire) return;
      evt.preventDefault();
      this.campfireSystem.ignite(fire.entry);
      return;
    }
    if (evt.key === 'r' || evt.key === 'R') this.rotateHovered();
    if (evt.key === 'Escape') this.clearMark();
    if (evt.key === 'F5') {
      evt.preventDefault();
      this.doSave();
    }
    if (evt.key === 'F9') {
      evt.preventDefault();
      this.doLoad();
    }
  }

  toggleGrid() {
    return this.terrainSystem.toggleGrid();
  }

  toggleNight() {
    const time = (this.dayNightSystem.getTime() + TIME_SKIP.hours / 24) % 1;
    this.dayNightSystem.setTime(time);
    this.refreshAmbient();
    this.refreshClock();
    const minutes = Math.floor(time * 24 * 60) % (24 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    this.hud.flashClock(`+${TIME_SKIP.hours} h → ${hh}:${mm}`);
  }

  cycleMachine() {
    if (!this.isBuilding()) return;
    const index = MACHINE_KEYS.indexOf(this.currentMachine);
    this.currentMachine = MACHINE_KEYS[(index + 1) % MACHINE_KEYS.length];
    this.previewRotation = 0;
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
    this.refreshHoverPreview();
  }

  rotateHovered() {
    if (!this.isBuilding()) return;
    const record = this.hoverCell ? this.buildSystem.getAt(this.hoverCell.cx, this.hoverCell.cz) : null;
    if (record) {
      const rotated = this.buildSystem.rotate(this.hoverCell.cx, this.hoverCell.cz);
      if (!rotated) return;
      const def = getMachine(rotated.type);
      this.hud.setSaveHint(`${def.displayName}: ${rotated.rotation * 90}°`);
      return;
    }
    this.previewRotation = (this.previewRotation + 1) % 4;
    this.refreshHoverPreview();
  }

  refreshHoverPreview() {
    if (!this.hoverCell || !this.isBuilding() || this.editorMode.active) return;
    const { cx, cz } = this.hoverCell;
    const topY = this.decoSystem.topAt(cx, cz);
    this.refreshHologram(this.hoverCell, topY, this.buildSystem.canBuild(cx, cz));
  }

  handleHover(cell) {
    this.hoverCell = cell;
    if (cell) this.decoHighlight.setHover(cell);
    if (this.editorMode.active) {
      this.gridSystem.hideHighlight();
      this.gridSystem.hideHologram();
      if (!cell) {
        this.gridSystem.clearBrush();
        this.editorHud.setReadout('–');
        return;
      }
      if (this.editorMode.mode === 'area') {
        this.showAreaPreview(this.editorMode.getAreaSelection());
        if (this.editorMode.hasAreaSelection) return;
        const info = this.editorMode.describeAt(cell.cx, cell.cz);
        const state = this.editorMode.areaTool === 'erase' ? 'mažu' : 'maluju';
        this.editorHud.setReadout(`${cell.cx}, ${cell.cz} — ${state} plochu · ${info.brush ? `zóna: ${info.brush}` : 'bez zóny'}`);
        return;
      }
      if (this.editorMode.hasDraft && this.editorMode.mode !== 'height') {
        this.gridSystem.clearBrush();
      } else {
        this.gridSystem.showBrush([[cell.cx, cell.cz]], (cx, cz) => this.decoSystem.surfaceAt(cx, cz), this.editorMode.erasing);
      }
      const info = this.editorMode.describeAt(cell.cx, cell.cz);
      const tile = describeEntry(info);
      const height = ` · výška ${info.height === null ? '0 m' : info.height + ' m'}`;
      const draft = this.editorMode.draft ? ` · kreslím: ${this.editorMode.draft.brushKey}` : '';
      this.editorHud.setReadout(`${cell.cx}, ${cell.cz} — ${tile}${height}${draft}`);
      return;
    }
    this.moveGridHighlight(cell);
  }

  handlePaintStart(cell) {
    if (!cell) return;
    if (this.editorMode.active) {
      this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
      if (this.editorMode.mode === 'area') this.editorMode.beginAreaDrag(cell.cx, cell.cz);
      else if (this.editorMode.mode === 'height') this.editorMode.paint(cell.cx, cell.cz);
      else if (!this.editorMode.canDraftCell(cell.cx, cell.cz)) this.editorHud.setReadout('Mimo hrací plochu — přepni na Plochu');
      else this.editorMode.draftCell(cell.cx, cell.cz);
      this.handleHover(cell);
      return;
    }
    this.handleCellClick(cell);
  }

  handlePaintMove(cell) {
    if (!cell) return;
    if (this.editorMode.active) {
      const from = this.lastPaintCell || cell;
      if (this.editorMode.mode === 'area') this.editorMode.moveAreaDrag(cell.cx, cell.cz);
      else if (this.editorMode.mode === 'height') this.editorMode.paintRun(from, cell);
      else this.editorMode.draftRun(from, cell);
      this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
      this.handleHover(cell);
    }
  }

  handlePaintEnd() {
    if (this.editorMode.mode === 'area') this.editorMode.finishAreaDrag();
    this.lastPaintCell = null;
  }

  showAreaPreview(selection) {
    if (this.editorMode.active && this.editorMode.mode !== 'area') {
      this.gridSystem.clearBrush();
      this.areaPanel.setCount(0);
      return;
    }
    const cells = selection ? selection.cells : null;
    if (!cells || !cells.length) {
      this.gridSystem.clearBrush();
      this.areaPanel.setCount(0);
      return;
    }
    const erasing = selection.tool === 'erase';
    this.areaPanel.setTool(selection.tool);
    this.gridSystem.showBrush(cells, (cx, cz) => this.decoSystem.surfaceAt(cx, cz), erasing);
    const count = this.editorMode.pendingAreaCells();
    this.areaPanel.setCount(count);
    if (selection.drag) {
      this.editorHud.setReadout(`plocha: ${cells.length} buněk označeno — pusť myš a klikni Aplikovat`);
    }
  }

  applyAreaSelection() {
    const selection = this.editorMode.getAreaSelection();
    if (!selection || !selection.cells.length) return false;
    const erasing = selection.tool === 'erase';
    const pending = this.editorMode.pendingAreaCells();
    this.editorMode.applyAreaSelection();
    this.gridSystem.clearBrush();
    this.areaPanel.setCount(0);
    this.refreshUndoButton();
    this.handleHover(this.hoverCell);
    if (!erasing) this.editorHud.setReadout(`Přidáno ${pending} buněk plochy`);
    else if (!pending) this.editorHud.setReadout('Nic k smazání — tyhle buňky v mapě nejsou');
    else this.editorHud.setReadout(`Smazáno ${pending} buněk i s objekty`);
    return true;
  }

  layerExists(cx, cz) {
    const world = this.editorMode.getMap();
    if (!world) return false;
    return ['floor', 'path', 'water', 'clearing'].some((name) => (world[name] || []).some((e) => e.cx === cx && e.cz === cz));
  }

  decoExists(cx, cz) {
    const world = this.editorMode.getMap();
    return Boolean(world && (world.decorations || []).some((e) => e.cx === cx && e.cz === cz));
  }

  clearAreaSelection() {
    if (!this.editorMode.hasAreaSelection) return false;
    this.editorMode.clearAreaSelection();
    this.gridSystem.clearBrush();
    this.areaPanel.setCount(0);
    this.editorHud.setReadout('Výběr plochy zahozen');
    return true;
  }

  moveGridHighlight(cell) {
    if (!cell || !this.isBuilding()) {
      this.hoverCell = null;
      this.gridSystem.hideHighlight();
      this.gridSystem.hideHologram();
      this.hud.setCell(null, null, true);
      this.hud.setHeight(null);
      return;
    }
    const occupied = this.buildSystem.isOccupied(cell.cx, cell.cz);
    const valid = this.buildSystem.canBuild(cell.cx, cell.cz);
    const topY = this.decoSystem.topAt(cell.cx, cell.cz);
    this.hoverCell = cell;
    this.gridSystem.setHighlight(cell.cx, cell.cz, topY);
    this.gridSystem.setHighlightValid(valid);
    this.refreshHologram(cell, topY, valid);
    this.hud.setCell(cell.cx, cell.cz, valid);
    this.hud.setHeight(topY);
    if (occupied) this.hud.setCellOccupied(this.describeMachine(cell.cx, cell.cz));
    else this.hud.setCellOccupied(null);
  }

  refreshHologram(cell, topY, valid) {
    if (!this.isBuilding() || this.editorMode.active || !this.currentMachine) {
      this.gridSystem.hideHologram();
      return;
    }
    const def = getMachine(this.currentMachine);
    if (!def) return;
    this.gridSystem.showHologram(this.currentMachine, def, cell.cx, cell.cz, topY, this.previewRotation, valid);
  }

  cellsOfArea() {
    return this.terrainSystem.realCells || [];
  }

  isWalkableAt(x, z) {
    const { cx, cz } = worldToCellCoords(x, z);
    const layout = this.decoSystem.layout || this.terrainSystem.layout || null;
    if (hasFloor(layout, cx, cz)) return true;
    if (!this.areaLookup) {
      this.areaLookup = new Set(this.areaCellsNow().map(([ax, az]) => `${ax},${az}`));
    }
    if (!this.areaLookup.has(`${cx},${cz}`)) return false;
    return this.decoSystem.topAt(cx, cz) < WALK_CLEARANCE;
  }

  areaCellsNow() {
    return worldCells(this.decoSystem.layout || this.terrainSystem.layout || null);
  }

  withinBuildRange(cx, cz) {
    const root = this.playerSystem.root;
    if (!root) return true;
    const { cx: pcx, cz: pcz } = worldToCellCoords(root.position.x, root.position.z);
    if (cx === pcx && cz === pcz) return false;
    return Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) <= BUILD_RANGE_CELLS;
  }

  describeMachine(cx, cz) {
    const record = this.buildSystem.getAt(cx, cz);
    if (!record) return null;
    const def = getMachine(record.type);
    return `${def.displayName} ${record.rotation * 90}°`;
  }

  handleCellClick(cell) {
    if (!cell) return;
    if (this.editorMode.active) {
      this.editorMode.paint(cell.cx, cell.cz);
      return;
    }
    if (!this.isBuilding()) return;
    this.clearMark();
    const record = this.buildSystem.build(this.currentMachine, cell.cx, cell.cz, this.previewRotation);
    if (!record) return;
    if (!record.node) this.addShadowCaster(record.mesh);
    record.mesh.receiveShadows = true;
    this.hud.setCount(this.buildSystem.count);
    this.hud.setSaveHint('Neuloženo');
    this.handleHover(cell);
  }

  handleCellRightClick(cell) {
    if (!cell) return;
    if (this.editorMode.active) {
      if (this.editorMode.mode === 'area') {
        const tool = this.editorMode.areaTool === 'erase' ? 'paint' : 'erase';
        this.editorMode.setAreaTool(tool);
        this.areaPanel.setTool(this.editorMode.areaTool);
        this.handleHover(cell);
        return;
      }
      if (this.editorMode.mode === 'height') {
        const wasErasing = this.editorMode.erasing;
        this.editorMode.erasing = true;
        this.editorMode.paint(cell.cx, cell.cz);
        this.editorMode.erasing = wasErasing;
        return;
      }
      if (!this.editorMode.canEditCell(cell.cx, cell.cz)) return;
      this.editorMode.draftCell(cell.cx, cell.cz);
      return;
    }
    if (!this.isBuilding()) return;
    const result = this.buildSystem.toggleMark(cell.cx, cell.cz);

    if (result.removed) {
      this.gridSystem.clearMark();
      this.dropShadowCasters(result.removed);
      this.hud.setCount(this.buildSystem.count);
      this.hud.setSaveHint(`Zbouráno: ${getMachine(result.removed.type).displayName}`);
      this.handleHover(this.hoverCell);
      return;
    }

    if (result.marked) {
      this.gridSystem.setMark(this.buildSystem.markedCell.cx, this.buildSystem.markedCell.cz);
      this.hud.setSaveHint('Označeno k bourání — pravé tlačítko znovu zbourá');
    } else {
      this.gridSystem.clearMark();
      this.hud.setSaveHint('Označení zrušeno');
    }
  }

  clearMark() {
    if (!this.buildSystem.markedCell) return;
    this.buildSystem.demark();
    this.gridSystem.clearMark();
  }

  doSave() {
    const ok = this.saveSystem.save();
    this.hud.setSaveHint(ok ? 'Uloženo ✓' : 'Uložení selhalo');
  }

  warnUnsavedMap() {
    this.hud.setSaveHint('Mapa ještě není zapsaná v souboru — po obnovení stránky se změny ztratí');
  }

  markMapDirty() {
    if (this.mapDirty) return;
    this.mapDirty = true;
    this.editorHud.setReadout('● Neuložené změny');
  }

  clearMapDirty() {
    this.mapDirty = false;
    this.editorHud.setReadout('Uloženo ✓');
  }

  saveMapLayout() {
    const layout = this.editorMode.getMap();
    const key = typeof this.mapKey === 'string' ? this.mapKey.toLowerCase() : '';
    const file = mapFileFromLayout(key, layout);
    if (!file) {
      this.editorHud.setReadout('Mapu nejde složit');
      return Promise.resolve(false);
    }
    if (!Number.isInteger(layout.spawn.cx) || !Number.isInteger(layout.spawn.cz)) {
      this.markMapDirty();
      this.editorHud.setReadout(`● Neuložené změny — střed mapy nemá platné souřadnice (${layout.spawn.cx}, ${layout.spawn.cz})`);
      return Promise.resolve(false);
    }
    const broken = brokenEntries(layout);
    if (broken) {
      this.markMapDirty();
      this.editorHud.setReadout('● Neuložené změny');
      this.hud.setSaveHint(`Mapa se neuložila — ${broken} buněk nemá platné souřadnice, takže by se v souboru rozsypala`);
      return Promise.resolve(false);
    }
    this.editorHud.setReadout('Ukládám do souboru…');
    return this.writeMapFile(file).then((result) => this.finishMapSave(file, result));
  }

  finishMapSave(file, result) {
    this.mapFile = file;
    if (result.ok) {
      this.clearMapDirty();
      this.hud.setSaveHint('Mapa zapsaná do souboru projektu ✓');
      return true;
    }
    this.downloadMapFile(file);
    this.markMapDirty();
    this.editorHud.setReadout(`● Neuložené změny — server odmítl: ${result.reason}`);
    this.hud.setSaveHint(`Mapu se nepodařilo zapsat do souboru (${result.reason}) — soubor je stažený, polož ho do projektu`);
    return false;
  }

  async writeMapFile(file) {
    const url = `/_map/${encodeURIComponent(file.mapKey)}`;
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(file),
      });
    } catch {
      return { ok: false, reason: `server neodpověděl (${url})` };
    }
    if (response.ok) return { ok: true };
    let reason = `HTTP ${response.status}`;
    try {
      const answer = await response.json();
      if (answer && answer.error) reason = `${reason} — ${answer.error}`;
    } catch {
      reason = `${reason} z ${url}`;
    }
    return { ok: false, reason };
  }

  downloadMapFile(file) {
    const name = `${file.mapKey}-map.json`;
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  doLoad() {
    const ok = this.saveSystem.load();
    this.gridSystem.clearMark();
    this.hud.setCount(this.buildSystem.count);
    this.hud.setStatusVisible(this.isBuilding());
    this.refreshShadowCasters();
    this.refreshClock();
    this.hud.setSaveHint(ok ? 'Načteno ✓' : 'Žádný save');
  }

  dropShadowCasters(record) {
    const meshes = record.node ? record.node.getChildMeshes() : [record.mesh];
    for (const mesh of meshes) {
      const caster = this.shadowCasters.find((item) => item === mesh);
      if (caster) this.removeShadowCaster(caster);
    }
    this.refreshShadowCasters();
  }

  refreshShadowCasters() {
    this.shadowCasters = this.shadowCasters.filter((mesh) => mesh && !mesh.isDisposed());
    this.shadowGenerator.getShadowMap().renderList = this.options.shadows ? this.shadowCasters.slice() : [];
  }


  onResize() {
    this.cameraSystem.onResize();
  }
}

function describeEntry(info) {
  if (!info.entry) return 'prázdno';
  if (info.isPath) return `cesta (${info.style})`;
  return info.entry.key;
}

function brokenEntries(layout) {
  let count = 0;
  for (const name of ['floor', 'path', 'water', 'clearing', 'decorations']) {
    for (const entry of layout[name] || []) {
      if (!entry || !Number.isFinite(entry.cx) || !Number.isFinite(entry.cz)) count += 1;
    }
  }
  return count;
}

