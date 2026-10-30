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
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';

import CameraSystem from '../systems/cameraSystem.js';
import GridSystem from '../systems/gridSystem.js';
import TerrainSystem from '../systems/terrainSystem.js';
import WaterSystem from '../systems/waterSystem.js';
import FishSystem from '../systems/fishSystem.js';
import SkySystem from '../systems/skySystem.js';
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
import FellingSystem from '../systems/fellingSystem.js';
import HarvestSystem from '../systems/harvestSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import HeldItemSystem from '../systems/heldItemSystem.js';
import AudioSystem from '../systems/audioSystem.js';
import InventoryPanel from '../ui/inventoryPanel.js';
import Hud from '../ui/hud.js';
import Hotbar from '../ui/hotbar.js';
import MapEditor from '../editor/mapEditor.js';
import EditorToggle from '../editor/editorToggle.js';
import PauseScreen from '../ui/pauseScreen.js';
import LoadingScreen from '../ui/loadingScreen.js';
import TooltipPanel from '../ui/tooltipPanel.js';
import { whenModelsIdle, takeModelError, preloadModel, releaseFrame } from '../utils/assetLoader.js';
import { treeTemplate } from '../utils/treeFactory.js';
import { rockTemplate } from '../utils/rockFactory.js';
import { shellTemplate } from '../utils/shellFactory.js';
import { coralTemplate } from '../utils/coralFactory.js';
import { flowerTemplate } from '../utils/flowerFactory.js';
import { HEIGHT_PRESETS } from '../data/maps/layoutStore.js';
import { WAVE_TIME_WRAP } from '../utils/waterWaves.js';
import { MACHINE_KEYS, DEFAULT_MACHINE, getMachine } from '../data/catalogs/machines.js';
import { HOTBAR_ITEMS } from '../data/catalogs/items.js';
import { worldToCellCoords, worldToCell, CELL_SIZE } from '../utils/gridMath.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { SAVE_VERSION, SAVE_STORAGE_KEY } from '../data/catalogs/saveSchema.js';
import { collectStartupUrls } from '../data/catalogs/modelCatalog.js';
import { mapFileFromLayout, layoutFromMapFile, isMapFile, MAP_VERSION } from '../data/catalogs/mapFile.js';
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
const WORLD_BATCH_BULK = 1500;
const STAGE_LEAD_FRAMES = 2;
const MODEL_LANES = 4;
const LOAD_RETRIES = 2;
const BUILD_RANGE_CELLS = 2;
const WALK_CLEARANCE = 1.25;
const WADE_DEPTH = 0.6;
const WADE_SPEED = 0.65;
const WADE_RAMP = 0.2;
const WATER_STEP_DEPTH = 0.02;
const SHORE_CHECK_SECONDS = 0.3;
const MAX_STEP_SECONDS = 0.1;
const SHADOW_REACH_MARGIN = 20;
const SHADOW_REACH_STEP = 0.2;
const EDITOR_CAM_SPEED = 12;
const EDITOR_CAM_SPRINT = 32;
const IMPACT_DELAY = 0.28;
const TIME_SKIP = { hours: 6 };

function sameMeshes(first, second) {
  if (first.length !== second.length) return false;
  for (let i = 0; i < first.length; i += 1) if (first[i] !== second[i]) return false;
  return true;
}


function surfaceStepSound(key) {
  const name = String(key || '').toLowerCase();
  if (/wood|plank|bridge|deck|board/.test(name)) return 'stepWood';
  if (/path|stone|rock|cobble|brick|tile|pavement|gravel/.test(name)) return 'stepStone';
  return 'stepGrass';
}

function metersText(value) {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  return `${String(rounded).replace('.', ',')} m`;
}

function buildReasonText(reason) {
  if (reason === 'occupied') return 'už tu stojí stroj';
  if (reason === 'blocked') return 'překážka';
  if (reason === 'water') return 'voda';
  if (reason === 'height') return 'není rovná plocha';
  if (reason === 'range') return 'mimo dosah';
  return null;
}

export default class GameScene {

  constructor(scene, engine, canvas) {
    this.s = scene;
    this.engine = engine;
    this.canvas = canvas;
    this.mapKey = DEFAULT_MAP;
    this.rebuildRunning = false;
    this.rebuildPending = false;
    this.heightRunning = false;
    this.heightPending = false;

    this.cameraSystem = new CameraSystem(scene);
    this.gridSystem = new GridSystem(scene);
    this.terrainSystem = new TerrainSystem(scene);
    this.waterSystem = new WaterSystem(scene);
    this.fishSystem = new FishSystem(scene);
    this.skySystem = new SkySystem(scene);
    this.decoSystem = new DecoSystem(scene);
    this.decoSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z);
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
    this.gatherSystem.onLand = () => this.audioSystem.play('fall');
    this.gatherSystem.onFell = (item) => this.finishFelling(item);
    this.fellingSystem = new FellingSystem(scene);
    this.harvestSystem = new HarvestSystem(scene);
    this.audioSystem = new AudioSystem(scene);
    this.inventorySystem = new InventorySystem();
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.tooltipPanel = new TooltipPanel();
    this.hotbar = new Hotbar();
    this.inventoryPanel = new InventoryPanel();
    this.editor = new MapEditor(this);
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
    this.shadowClock = 0;

    this.camera = null;
    this.fxaa = null;
    this.shadowGenerator = null;
    this.sunLight = null;
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
    this.shoreClock = 0;
  }

  start() {
    const urls = collectStartupUrls(this.heldItemSystem.key);
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
    this.fxaa = new FxaaPostProcess('fxaa', 1.0, this.camera);
    this.skySystem.create();
    this.skySystem.setDayness(this.waterDayness(), this.dayNightSystem.sunLight);
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
    this.saveSystem.load();

    this.buildSystem.onMachineReady = (record, node) => {
      const placeholder = record.mesh;
      if (placeholder) {
        const index = this.shadowCasters.indexOf(placeholder);
        if (index >= 0) this.shadowCasters.splice(index, 1);
      }
      for (const child of node.getChildMeshes()) this.addShadowCaster(child);
    };

    this.s.onBeforeRenderObservable.add(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_STEP_SECONDS);
      this.shadowClock += dt;
      if (this.shadowClock >= SHADOW_REACH_STEP) {
        this.shadowClock = 0;
        this.refreshShadowReach();
      }
      if (this.paused) {
        if (this.editor.active) {
          this.updateEditorCamera(dt);
          this.waterSystem.update(dt);
          this.decoSystem.updateWind(this.floraSystem.clock);
          this.updateWaterCaustics();
        }
        this.refreshClock();
        return;
      }
      this.simSystem.update(dt);
      this.decoHighlight.update(dt);
      this.decoSystem.updateWind(this.floraSystem.clock);
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
      this.waterSystem.update(dt);
      this.fishSystem.update(dt);
      this.updateWaterCaustics();
      this.updateCampfireSound(root);
      this.updateShoreSound(root, dt);
      if (root) this.cameraSystem.follow(root.position.x, root.position.z, root.position.y, dt);
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
    this.saveSystem.dropLegacy();
    this.setupSave();
    this.loader.beginFloat('Budím postavu…');
    await this.setupPlayer();
    this.loader.floatProgress(1, 1, 'Seju trávu…');
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle());
    this.refreshReflectionExclusions();
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
    this.syncFelling();
    this.syncHarvest();
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

  updateShoreSound(root, dt) {
    this.shoreClock += dt;
    if (this.shoreClock < SHORE_CHECK_SECONDS) return;
    this.shoreClock = 0;
    const distance = root ? this.waterSystem.shoreDistanceAt(root.position.x, root.position.z) : Infinity;
    this.audioSystem.setShoreDistance(distance);
  }

  updateWaterCaustics() {
    const water = this.waterSystem;
    const sun = this.dayNightSystem ? this.dayNightSystem.sunLight : null;
    const level = water && Number.isFinite(water.level) && !water.hidden ? water.surfaceY : null;
    const wetLevel = water && Number.isFinite(water.level) ? water.level : null;
    this.terrainSystem.updateWetLevel(wetLevel);
    if (!water || !sun || level === null) {
      this.terrainSystem.updateCaustics(0, null, 0, 0, null, 0, 0);
      return;
    }
    const dirX = water.seaDir ? water.seaDir.x : 0.94;
    const dirZ = water.seaDir ? water.seaDir.y : 0.34;
    const strength = sun.intensity * this.waterDayness() * 0.2;
    this.terrainSystem.updateCaustics(water.time % WAVE_TIME_WRAP, level, dirX, dirZ, sun.diffuse, strength, water.maxDepth);
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
    const active = this.loaded && !this.editor.active && !this.isBuilding();
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
    if (this.editor.active || this.isBuilding()) return '';
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
    if (!this.loaded || this.editor.active || this.isBuilding()) return;
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
    if (target.def.byHand) return `Levé tlačítko — sbírat ${target.def.displayName} (${target.left}/${target.total})`;
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
    if (!this.inputSystem.leftDown || this.isBuilding() || this.editor.active) return false;
    if (this.campfireSystem.pending) return false;
    const gather = this.gatherSystem;
    if (!gather.target || gather.cooldown > 0 || gather.pending) return false;
    return this.strikeGather();
  }

  onPlayerStep(x, z, sprint) {
    const inWater = this.waterDepthNowAt(x, z) > WATER_STEP_DEPTH;
    if (inWater) this.waterSystem.splash(x, z, sprint ? 1.2 : 1);
    const key = this.decoSystem.surfaceKeyAt(worldToCell(x), worldToCell(z)) || '';
    this.audioSystem.play(inWater ? 'stepWater' : surfaceStepSound(key), { gain: sprint ? 1.35 : 1 });
  }

  onGatherImpact(result) {
    this.audioSystem.play(result.sound);
    if (!result.exhausted) return;
    const isTree = result.item.def.kind === 'tree';
    const cell = { cx: result.item.entry.cx, cz: result.item.entry.cz };
    const yields = this.gatherSystem.takeYield(result.item, !isTree);
    if (!yields) return;
    if (isTree) {
      const root = this.playerSystem ? this.playerSystem.root : null;
      const fromX = root ? root.position.x : result.item.x + 1;
      const fromZ = root ? root.position.z : result.item.z;
      this.gatherSystem.beginFall(result.item, fromX, fromZ);
    } else {
      this.releaseGatherCell(this.takenAnchor(cell) || result.item.anchor, cell);
      if (result.item.def.byHand) this.harvestSystem.record(cell.cx, cell.cz, this.simSystem.time);
    }
    this.refreshGatherTargets();
    for (const { itemKey, amount } of yields) this.inventorySystem.add(itemKey, amount);
    this.inventoryPanel.update(this.inventorySystem);
  }

  finishFelling(item) {
    const anchor = item ? item.anchor : null;
    if (!anchor || anchor.isDisposed()) return;
    const fall = item.fall || { dirX: 1, dirZ: 0 };
    this.applyFelling(item.entry.cx, item.entry.cz, anchor, item.def, fall, true);
    this.refreshGatherTargets();
  }

  applyFelling(cx, cz, anchor, def, dir, record) {
    if (!anchor || anchor.isDisposed() || !def) return;
    if (anchor.metadata && anchor.metadata.stump) return;
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (model && !model.isDisposed()) {
      for (const child of model.getChildMeshes()) this.removeShadowCaster(child);
      model.setEnabled(false);
    }
    const parts = [
      ...this.decoSystem.showStump(anchor, def),
      ...this.decoSystem.showLogs(anchor, def, dir.dirX, dir.dirZ),
    ];
    if (def.tree && def.tree.startsWith('palm')) {
      parts.push(...this.decoSystem.showFronds(anchor, def, dir.dirX, dir.dirZ));
    }
    for (const node of parts) {
      for (const child of node.getChildMeshes()) {
        child.isPickable = false;
        if (def.castsShadow) this.addShadowCaster(child);
      }
    }
    this.decoHighlight.remove(cx, cz);
    this.decoSystem.releaseCell(cx, cz);
    this.gatherSystem.markTaken(cx, cz);
    if (record) this.fellingSystem.record(cx, cz, def, dir);
  }

  syncFelling() {
    for (const cell of this.fellingSystem.list()) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || found.def.tree !== cell.tree) {
        this.fellingSystem.drop(cell.cx, cell.cz);
        continue;
      }
      this.applyFelling(cell.cx, cell.cz, found.anchor, found.def, cell, false);
    }
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

  syncHarvest() {
    for (const cell of this.harvestSystem.list()) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || !found.def.byHand) {
        this.harvestSystem.drop(cell.cx, cell.cz);
        continue;
      }
      const anchor = found.anchor;
      if (anchor && !anchor.isDisposed()) anchor.setEnabled(false);
      this.decoHighlight.remove(cell.cx, cell.cz);
      this.decoSystem.releaseCell(cell.cx, cell.cz);
      this.gatherSystem.markTaken(cell.cx, cell.cz);
    }
  }

  updateHarvestRespawns() {
    const ripe = this.harvestSystem.ripe(this.simSystem.time);
    if (!ripe.length) return;
    let restored = 0;
    for (const cell of ripe) {
      const found = this.decoSystem.entryAt(cell.cx, cell.cz);
      if (!found || !found.def || !found.def.byHand) {
        this.harvestSystem.drop(cell.cx, cell.cz);
        continue;
      }
      if (this.buildSystem.isOccupied(cell.cx, cell.cz)) continue;
      this.restoreHarvested(found, cell);
      this.harvestSystem.drop(cell.cx, cell.cz);
      restored += 1;
    }
    if (restored) this.refreshGatherTargets();
  }

  restoreHarvested(found, cell) {
    const anchor = found.anchor;
    if (!anchor || anchor.isDisposed()) return;
    anchor.setEnabled(true);
    const model = anchor.metadata ? anchor.metadata.model : null;
    if (model && !model.isDisposed()) model.setEnabled(true);
    this.gatherSystem.ensureEntry(anchor);
    this.decoHighlight.add(found.entry, model, found.def);
  }

  async setupPlayer() {
    this.playerSystem.blockedTest = (cx, cz) => this.buildSystem.isOccupied(cx, cz);
    this.playerSystem.walkable = (x, z) => this.isWalkableAt(x, z);
    this.playerSystem.speedScale = (x, z) => {
      const depth = this.waterDepthNowAt(x, z);
      if (depth <= WATER_STEP_DEPTH) return 1;
      const wet = Math.min(1, depth / WADE_RAMP);
      return 1 - (1 - WADE_SPEED) * wet;
    };
    this.playerSystem.decoSystem = this.decoSystem;
    this.playerSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z);
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z, this.playerSystem.root ? this.playerSystem.root.position.y : 0);
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    this.playerSystem.setHeldTool(this.heldItemSystem.key);
    this.playerSystem.onProgress = (done) => this.loader.floatProgress(done);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.addShadowCaster(child);
    this.cameraSystem.snapTo(root.position.x, root.position.z, root.position.y);
    this.rescuePlayerFromWater();
  }

  refreshTerrain() {
    const reach = this.editor.active ? this.terrainSystem.reachCells() : null;
    this.terrainSystem.clear();
    this.terrainSystem.create(this.mapKey, this.mapFile, reach);
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
    this.renderWater();
  }

  setupTerrain() {
    const ground = this.terrainSystem.create(this.mapKey, this.mapFile);
    if (ground && ground.length) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
    this.renderWater();
  }

  updateEditorCamera(dt) {
    const camera = this.s.activeCamera;
    const input = this.playerSystem ? this.playerSystem.moveInput : null;
    if (!camera || !input) return;
    const forward = this.playerSystem.cameraForward(camera);
    const rightX = forward.z;
    const rightZ = -forward.x;
    let dirX = 0;
    let dirZ = 0;
    if (input.forward) { dirX += forward.x; dirZ += forward.z; }
    if (input.back) { dirX -= forward.x; dirZ -= forward.z; }
    if (input.right) { dirX += rightX; dirZ += rightZ; }
    if (input.left) { dirX -= rightX; dirZ -= rightZ; }
    if (!dirX && !dirZ) return;
    const length = Math.hypot(dirX, dirZ) || 1;
    const step = (input.sprint ? EDITOR_CAM_SPRINT : EDITOR_CAM_SPEED) * dt;
    const target = this.cameraSystem.viewCenter();
    let x = target.x + (dirX / length) * step;
    let z = target.z + (dirZ / length) * step;
    const bounds = this.decoSystem.boundsOfCells ? this.decoSystem.boundsOfCells() : null;
    if (bounds) {
      const margin = CELL_SIZE + 2;
      x = Math.min(bounds.maxX * CELL_SIZE + margin, Math.max(bounds.minX * CELL_SIZE - margin, x));
      z = Math.min(bounds.maxZ * CELL_SIZE + margin, Math.max(bounds.minZ * CELL_SIZE - margin, z));
    }
    this.cameraSystem.snapTo(x, z, this.terrainSystem.heightAt(x, z));
  }

  refreshWaterVisibility() {
    this.waterSystem.setVisible(!this.editor || this.editor.mode.waterShown !== false);
    this.fishSystem.show();
  }

  refreshReflectionExclusions() {
    const excluded = [this.terrainSystem.skirtMesh, ...this.floraSystem.grassMeshes];
    for (const school of this.fishSystem.schools) {
      if (school.mesh) excluded.push(school.mesh);
    }
    const level = this.waterSystem.level;
    for (const anchor of this.decoSystem.nodes) {
      if (!anchor || anchor.isDisposed()) continue;
      const def = anchor.metadata ? anchor.metadata.def : null;
      const hidden = (def && def.noReflection) || (Number.isFinite(level) && anchor.position.y < level);
      if (!hidden) continue;
      excluded.push(...anchor.getChildMeshes());
    }
    this.waterSystem.setReflectionExclusions(excluded);
  }

  viewCircle() {
    const camera = this.camera;
    const target = this.cameraSystem.target;
    if (!camera || !target) return null;
    const halfWidth = Math.abs(camera.orthoRight - camera.orthoLeft) / 2;
    const halfHeight = Math.abs(camera.orthoTop - camera.orthoBottom) / 2;
    return { x: target.x, z: target.z, radius: Math.hypot(halfWidth, halfHeight) };
  }

  renderWater() {
    const level = this.mapLayout && Number.isFinite(this.mapLayout.waterLevel) ? this.mapLayout.waterLevel : null;
    const quality = (this.options && this.options.quality) || 'high';
    const map = getMap(this.mapKey);
    const rgb = map && map.colors && map.colors.water ? map.colors.water : null;
    this.waterSystem.setSun(this.dayNightSystem ? this.dayNightSystem.sunLight : null);
    this.waterSystem.setDayness(this.waterDayness());
    this.waterSystem.setSkyTint(this.skySystem.tint());
    this.waterSystem.create(this.terrainSystem.groundCells, level, (x, z) => this.terrainSystem.heightAt(x, z), rgb, quality);
    this.refreshWaterVisibility();
    this.fishSystem.create(
      this.mapLayout,
      level,
      this.waterSystem,
      (x, z) => this.terrainSystem.heightAt(x, z),
      () => (this.playerSystem.root ? this.playerSystem.root.position : null),
    );
    this.refreshReflectionExclusions();
    this.rescuePlayerFromWater();
  }

  waterDayness() {
    const system = this.dayNightSystem;
    if (!system || !system.config) return 1;
    if (this.options && !this.options.dayCycle) return 1;
    return system.dayness(system.getTime());
  }

  wireDecoReady() {
    this.gatherSystem.clear();
    this.decoSystem.onDecoReady = (anchor, node, def, entry) => this.onDecoPlaced(anchor, node, def, entry);
  }

  onDecoPlaced(anchor, node, def, entry) {
    const underWater = this.underWaterLevel(anchor.position.y);
    for (const child of node.getChildMeshes()) {
      child.isPickable = false;
      if (def.castsShadow && !underWater) this.addShadowCaster(child);
    }
    this.decoHighlight.add(entry, node, def);
    this.gatherSystem.ensureEntry(anchor);
    this.campfireSystem.add(entry, def, anchor.position.y);
  }

  underWaterLevel(y) {
    const level = this.mapLayout ? this.mapLayout.waterLevel : null;
    return Number.isFinite(level) && y < level;
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
      const def = getDecoration(entry.key);
      if (def && def.tree) {
        treeTemplate(this.s, def.tree);
        known.set(entry.key, null);
        continue;
      }
      if (def && def.rock) {
        rockTemplate(this.s, def.rock);
        known.set(entry.key, null);
        continue;
      }
      if (def && def.shell) {
        shellTemplate(this.s, def.shell);
        known.set(entry.key, null);
        continue;
      }
      if (def && def.coral) {
        coralTemplate(this.s, def.coral);
        known.set(entry.key, null);
        continue;
      }
      if (def && def.flower) {
        flowerTemplate(this.s, def.flower);
        known.set(entry.key, null);
        continue;
      }
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
    if (kind === 'floor' || kind === 'ground') return kind;
    return 'deco';
  }

  stageHasModels(entries) {
    for (const entry of entries) {
      if (this.decoSystem.hasModel(entry.key)) return true;
    }
    return false;
  }

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
    this.buildSystem.waterTest = (cx, cz) => this.waterSystem.reachesAt(cx * CELL_SIZE, cz * CELL_SIZE);
    this.buildSystem.heightTest = (cx, cz) => this.decoSystem.topAt(cx, cz) !== 0;
    this.buildSystem.rangeTest = (cx, cz) => this.withinBuildRange(cx, cz);
    this.gridSystem.onHologramReady = (machineKey) => {
      if (machineKey !== this.currentMachine) return;
      this.refreshHoverPreview();
    };

    this.editor.connect();
  }

  setEraseMode(on) {
    return this.editor.setEraseMode(on);
  }

  applyBrushDraft() {
    return this.editor.applyBrushDraft();
  }

  cancelBrushDraft() {
    return this.editor.cancelBrushDraft();
  }

  undoEdit() {
    return this.editor.undo();
  }

  updateDraftView(draft) {
    return this.editor.updateDraftView(draft);
  }

  refreshZoneOverlay() {
    return this.editor.refreshZoneOverlay();
  }

  renderMapLayout() {
    this.rebuildPending = true;
    if (this.rebuildRunning) return;
    this.runMapRebuild();
  }

  async runMapRebuild() {
    if (this.rebuildRunning) return;
    this.rebuildRunning = true;
    try {
      while (this.rebuildPending) {
        this.rebuildPending = false;
        this.gatherSystem.clear();
        this.adoptEditorMap();
        this.markMapDirty();
        this.refreshTerrain();
        await this.terrainSystem.whenReady();
        await this.rebuildDecorations();
      }
    } catch (error) {
      console.error('[debug] rebuildDecorations ERROR:', error);
      this.reportRebuildError(error);
    } finally {
      this.rebuildRunning = false;
      if (this.rebuildPending) this.runMapRebuild();
    }
  }

  renderHeights() {
    this.heightPending = true;
    if (this.heightRunning) return;
    this.runHeightRebuild();
  }

  async runHeightRebuild() {
    if (this.heightRunning) return;
    this.heightRunning = true;
    try {
      while (this.heightPending) {
        this.heightPending = false;
        this.adoptEditorMap();
        this.markMapDirty();
        this.refreshTerrain();
        await this.terrainSystem.whenReady();
        this.reseatDecorations();
      }
    } catch (error) {
      console.error('[mapa] Přesazení výšek selhalo:', error);
      this.reportRebuildError(error);
    } finally {
      this.heightRunning = false;
      if (this.heightPending) this.runHeightRebuild();
    }
  }

  reseatDecorations() {
    const layout = this.mapFile || {};
    this.decoSystem.beginHeights(layout, getMap(this.mapKey).colors);
    this.decoSystem.reseatHeights();
    this.floraSystem.reseatHeights();
    this.campfireSystem.reseatHeights((entry) => this.decoSystem.entryHeight(entry));
    this.gatherSystem.syncFromDeco();
    this.syncFelling();
    this.refreshShadowCasters();
    this.handleHover(this.hoverCell);
    this.reportRebuild();
  }

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
  }

  finishRebuild() {
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle());
    this.refreshReflectionExclusions();
    this.gatherSystem.syncFromDeco();
    this.syncFelling();
    this.syncHarvest();
    this.campfireSystem.sync((this.mapFile || {}).decorations || []);
    this.refreshShadowCasters();
    this.handleHover(this.hoverCell);
    this.reportRebuild();
  }

  reportRebuildError(error) {
    const reason = error && error.message ? error.message : 'neznámá chyba';
    console.error('[mapa] Skládání světa selhalo:', error);
    this.editor.hud.setReadout(`Mapu se nepodařilo postavit — ${reason}`);
  }

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
  }

  toggleEditorPanel(active) {
    return this.editor.togglePanel(active);
  }

  syncEditorPanels(mode) {
    return this.editor.syncPanels(mode);
  }

  exitEditor() {
    return this.editor.close();
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
      return { version: MAP_VERSION, mapKey: this.mapKey, seed: getMap(this.mapKey).seed, spawn: { cx: 0, cz: 0 }, floor: [], path: [], decorations: [] };
    }
  }

  buildMapLayout(mapFile) {
    this.mapFile = mapFile;
    this.mapLayout = layoutFromMapFile(mapFile, getMap(this.mapKey).seed);
    this.editor.useLayout(this.mapLayout);
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    return this.mapFile;
  }

  adoptEditorMap() {
    const layout = this.editor.getMap();
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

    this.sunLight = dir;
    this.shadowGenerator = new ShadowGenerator(light.shadowMapSize, dir);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadowGenerator.bias = 0.00005;
    this.shadowGenerator.normalBias = 0.002;
    this.shadowGenerator.getShadowMap().clearColor = new Color4(1, 1, 1, 1);

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
    for (const surface of this.terrainSystem.surfaces || []) surface.receiveShadows = true;
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
    this.editorToggle.setActive(this.editor.active);
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
    this.refreshShadowReach(true);
    this.decoHighlight.setVisible(this.options.highlights);
    this.glowSystem.setEnabled(this.options.fireGlow);
    const grassDensity = this.floraSystem.density;
    this.floraSystem.setDensity(this.options.grass);
    if (this.floraSystem.density !== grassDensity) this.refreshReflectionExclusions();
    this.waterSystem.setDetail(this.options.waterDetail);
    if (this.isLoading) return;
    this.audioSystem.setMasterVolume(this.options.sfxVolume / 100);
    this.audioSystem.setAmbientVolume(this.options.ambientVolume / 100);
    if (this.waterSystem.quality !== this.options.quality) this.renderWater();
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
    const map = getMap(this.mapKey);
    this.harvestSystem.configure(map && map.dayNight ? map.dayNight.dayLengthSeconds : null);
    this.simSystem.subscribe((tick) => {
      if (this.options.dayCycle) this.dayNightSystem.update(tick);
      this.refreshAmbient();
      this.updateHarvestRespawns();
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
    const sun = this.dayNightSystem.sunLight;
    if (sun) this.floraSystem.setSunDirection(sun.direction.scale(-1));
    this.skySystem.setDayness(value, this.dayNightSystem.sunLight);
    this.waterSystem.setDayness(value);
    this.waterSystem.setSkyTint(this.skySystem.tint());
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
    this.inputSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z);
    this.inputSystem.shouldPickByRay = () => this.editor.active && this.editor.mapMode === 'area';
    this.inputSystem.attach(this.camera, this);
    this.inputSystem.onLeftDown = () => this.handleLeftDown();
    this.inputSystem.onHoverCell = (cell) => this.handleHover(cell);
    this.inputSystem.onCellRightClick = (cell) => this.handleCellRightClick(cell);
    this.inputSystem.onPaintStart = (cell) => this.handlePaintStart(cell);
    this.inputSystem.onPaintMove = (cell) => this.handlePaintMove(cell);
    this.inputSystem.onPaintEnd = () => this.handlePaintEnd();
    this.inputSystem.onRightPaintStart = (cell) => this.handleRightPaintStart(cell);
    this.inputSystem.onRightPaintMove = (cell) => this.handleRightPaintMove(cell);
    this.inputSystem.onRightPaintEnd = () => this.handleRightPaintEnd();
    this.inputSystem.onZoom = (delta) => {
      this.cameraSystem.zoomBy(delta);
      this.cameraSystem.applyOrtho();
    };
  }

  setupSave() {
    this.playerSystem.walkableCells = () => this.terrainSystem.realCells || [];
    this.registerSavedState(this.playerSystem, 'player', 5);
    this.registerSavedState(this.heldItemSystem, 'heldItem', 7);
    this.registerSavedState(this.buildSystem, 'machines', 10);
    this.registerSavedState(this.campfireSystem, 'campfires', 12);
    this.registerSavedState(this.fellingSystem, 'felling', 14);
    this.registerSavedState(this.harvestSystem, 'harvest', 15);
    this.registerSavedState(this.dayNightSystem, 'dayNight', 20);
    this.registerSavedState(this.simSystem, 'sim', 25);
    this.saveSystem.register(this.inventorySystem, 'inventory', {
      serialize: () => this.inventorySystem.serialize(),
      apply: (data) => {
        this.inventorySystem.apply(data);
        this.inventoryPanel.update(this.inventorySystem);
      },
      defaults: { items: {} },
      order: 6,
    });
  }

  registerSavedState(owner, key, order) {
    this.saveSystem.register(owner, key, {
      serialize: () => owner.serialize(),
      apply: (data) => owner.apply(data),
      defaults: () => owner.defaultState(),
      order,
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
    } else if (this.editor.active) {
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
    const active = this.editor.open();
    this.editorToggle.setActive(active);
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
    const root = this.playerSystem.root;
    if (root) this.cameraSystem.snapTo(root.position.x, root.position.z, root.position.y);
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
    if (this.editor.active) {
      if (evt.key === 'Escape' && this.editor.mapMode === 'area' && this.editor.mode.hasAreaSelection) {
        this.clearAreaSelection();
        evt.preventDefault();
        return;
      }
      if (evt.key === 'Enter' && this.editor.mode.hasAreaSelection) { this.applyAreaSelection(); evt.preventDefault(); return; }
      if (evt.key === 'Escape' && this.editor.mode.hasDraft) { this.cancelBrushDraft(); evt.preventDefault(); return; }
      if (evt.key === 'Enter' && this.editor.mode.hasDraft) { this.applyBrushDraft(); evt.preventDefault(); return; }
      if (evt.key === 'x' || evt.key === 'X') { this.setEraseMode(!this.editor.erasing); evt.preventDefault(); return; }
      if (evt.key === 'z' || evt.key === 'Z') { this.undoEdit(); evt.preventDefault(); return; }
      if (evt.key === 'h' || evt.key === 'H') {
        this.editor.mode.setMode(this.editor.mapMode === 'height' ? 'zone' : 'height');
        evt.preventDefault();
        return;
      }
      if (evt.key === 'q' || evt.key === 'Q') { this.editor.mode.stepHeightLevel(1); evt.preventDefault(); return; }
      if (evt.key === 'e' || evt.key === 'E') { this.editor.mode.stepHeightLevel(-1); evt.preventDefault(); return; }
      if (/^[1-9]$/.test(evt.key)) {
        this.editor.mode.setHeightLevel(HEIGHT_PRESETS[Number(evt.key) - 1]);
        evt.preventDefault();
        return;
      }
    }
    if (/^[1-5]$/.test(evt.key)) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      const key = HOTBAR_ITEMS[Number(evt.key) - 1];
      if (!key) return;
      if (this.editor.active) return;
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
    if (!this.hoverCell || !this.isBuilding() || this.editor.active) return;
    const { cx, cz } = this.hoverCell;
    const topY = this.decoSystem.topAt(cx, cz);
    this.refreshHologram(this.hoverCell, topY, this.buildSystem.canBuild(cx, cz));
  }

  handleHover(cell) {
    this.hoverCell = cell;
    this.decoHighlight.setHover(cell || null);
    if (!this.editor.active) {
      this.gridSystem.clearHoverCell();
      this.moveGridHighlight(cell);
      this.refreshHoverTooltip(cell);
      return;
    }
    this.tooltipPanel.hide();
    this.gridSystem.hideHighlight();
    this.gridSystem.hideHologram();
    if (!cell) {
      this.editor.clearHoverReadout();
      return;
    }
    this.gridSystem.showHoverCell(cell.cx, cell.cz, (cx, cz) => this.decoSystem.surfaceAt(cx, cz), this.editor.mode.mode === 'height' ? this.editor.mode.heightStampSpan : 1);
    if (this.editor.mapMode === 'area') {
      this.editor.showAreaPreview(this.editor.mode.getAreaSelection());
      if (this.editor.mode.hasAreaSelection) return;
      this.editor.showAreaHoverReadout(cell);
      return;
    }
    this.editor.showCellHoverReadout(cell);
  }

  refreshHoverTooltip(cell) {
    if (!cell || !this.options.highlights || this.isBuilding() || this.hud.isStatusOpen()) {
      this.tooltipPanel.hide();
      return;
    }
    const height = this.terrainSystem.heightAt(cell.cx * CELL_SIZE, cell.cz * CELL_SIZE);
    const detail = `výška ${metersText(height)}`;
    const deco = this.decoHighlight.labelAt(cell.cx, cell.cz);
    if (deco) {
      this.tooltipPanel.show(deco.label, detail);
      return;
    }
    const surfaceKey = this.decoSystem.surfaceKeyAt ? this.decoSystem.surfaceKeyAt(cell.cx, cell.cz) : null;
    const surface = surfaceKey ? getDecoration(surfaceKey) : null;
    this.tooltipPanel.show(surface ? surface.displayName : 'Země', detail);
  }

  handlePaintStart(cell) {
    if (!cell) return;
    if (this.editor.active) {
      this.editor.startPaint(cell);
      this.handleHover(cell);
      return;
    }
    this.handleCellClick(cell);
  }

  handlePaintMove(cell) {
    if (!cell) return;
    if (this.editor.active) {
      this.editor.movePaint(cell);
      this.handleHover(cell);
      return;
    }
  }

  handlePaintEnd() {
    if (this.editor.mapMode === 'area') this.editor.mode.finishAreaDrag();
    this.editor.lastPaintCell = null;
  }

  handleRightPaintStart(cell) {
    if (!cell || !this.editor.active) return;
    this.handleCellRightClick(cell);
  }

  handleRightPaintMove(cell) {
    if (!cell || !this.editor.active) return;
    this.editor.rightMovePaint(cell);
    this.handleHover(cell);
  }

  handleRightPaintEnd() {
    this.editor.lastPaintCell = null;
  }

  showAreaPreview(selection) {
    return this.editor.showAreaPreview(selection);
  }

  applyAreaSelection() {
    return this.editor.applyAreaSelection();
  }

  layerExists(cx, cz) {
    const world = this.editor.getMap();
    if (!world) return false;
    return ['floor', 'path', 'clearing'].some((name) => (world[name] || []).some((e) => e.cx === cx && e.cz === cz));
  }

  decoExists(cx, cz) {
    const world = this.editor.getMap();
    return Boolean(world && (world.decorations || []).some((e) => e.cx === cx && e.cz === cz));
  }

  clearAreaSelection() {
    return this.editor.clearAreaSelection();
  }

  moveGridHighlight(cell) {
    if (!cell || !this.isBuilding()) {
      this.hoverCell = null;
      this.gridSystem.hideHighlight();
      this.gridSystem.hideHologram();
      this.hud.setCell(null, null, true);
      this.hud.setHeight(null);
      this.hud.setBuildReason(null);
      return;
    }
    const occupied = this.buildSystem.isOccupied(cell.cx, cell.cz);
    const reason = this.buildSystem.blockReason(cell.cx, cell.cz);
    const valid = reason === null;
    const topY = this.decoSystem.topAt(cell.cx, cell.cz);
    this.hoverCell = cell;
    this.gridSystem.setHighlight(cell.cx, cell.cz, topY);
    this.gridSystem.setHighlightValid(valid);
    this.refreshHologram(cell, topY, valid);
    this.hud.setCell(cell.cx, cell.cz, valid);
    this.hud.setHeight(topY);
    this.hud.setBuildReason(buildReasonText(reason));
    if (occupied) this.hud.setCellOccupied(this.describeMachine(cell.cx, cell.cz));
    else this.hud.setCellOccupied(null);
  }

  refreshHologram(cell, topY, valid) {
    if (!this.isBuilding() || this.editor.active || !this.currentMachine) {
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
    if (this.waterDepthAt(x, z) > WADE_DEPTH) return false;
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

  waterDepthAt(x, z) {
    return this.waterSystem ? this.waterSystem.depthAt(x, z) : 0;
  }

  waterDepthNowAt(x, z) {
    return this.waterSystem ? this.waterSystem.waveDepthAt(x, z) : 0;
  }

  rescuePlayerFromWater() {
    const player = this.playerSystem;
    if (!player || !player.ready || !player.root) return;
    const pos = player.root.position;
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.z)) return;
    if (this.waterDepthAt(pos.x, pos.z) <= WADE_DEPTH) return;
    let best = null;
    let bestDist = Infinity;
    for (const [cx, cz] of this.areaCellsNow()) {
      const x = cx * CELL_SIZE;
      const z = cz * CELL_SIZE;
      if (!this.isWalkableAt(x, z)) continue;
      const dist = Math.hypot(x - pos.x, z - pos.z);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x, z };
      }
    }
    if (best) player.apply({ x: best.x, z: best.z, facing: player.facing });
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
    if (this.editor.active) {
      this.editor.paintCell(cell.cx, cell.cz);
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
    if (this.editor.active) {
      this.editor.rightClickCell(cell);
      this.handleHover(cell);
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
    return this.editor.warnUnsaved();
  }

  markMapDirty() {
    return this.editor.markDirty();
  }

  clearMapDirty() {
    return this.editor.clearDirty();
  }

  saveMapLayout() {
    return this.editor.saveMap();
  }

  doLoad() {
    const ok = this.saveSystem.load();
    this.gridSystem.clearMark();
    this.hud.setCount(this.buildSystem.count);
    this.hud.setStatusVisible(this.isBuilding());
    if (ok) this.renderMapLayout();
    if (ok) this.syncHarvest();
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
    this.refreshShadowReach(true);
  }

  refreshShadowReach(force = false) {
    if (!this.shadowGenerator) return;
    const shadows = Boolean(this.options.shadows);
    if (this.sunLight) this.sunLight.shadowEnabled = shadows;
    const shadowMap = this.shadowGenerator.getShadowMap();
    if (!shadows) {
      if (!force && shadowMap.renderList && !shadowMap.renderList.length) return;
      shadowMap.renderList = [];
      return;
    }
    const view = this.viewCircle();
    const reach = view ? view.radius + SHADOW_REACH_MARGIN : Infinity;
    const centerX = view ? view.x : 0;
    const centerZ = view ? view.z : 0;
    const next = [];
    for (const mesh of this.shadowCasters) {
      if (!mesh || mesh.isDisposed() || !mesh.isEnabled()) continue;
      const point = mesh.getAbsolutePosition();
      if (Math.hypot(point.x - centerX, point.z - centerZ) > reach) continue;
      next.push(mesh);
    }
    if (!force && sameMeshes(next, shadowMap.renderList || [])) return;
    shadowMap.renderList = next;
  }


  onResize() {
    this.cameraSystem.onResize();
  }
}

