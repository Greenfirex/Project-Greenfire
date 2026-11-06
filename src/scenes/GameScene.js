// Herní scéna — orchestrátor. Drží stav světa, deleguje na systémy a řídí HUD.
// Systémy dostávají scénu v konstruktoru a přistupují k ní přes this.s.
import '@babylonjs/core/Lights/hemisphericLight';
import '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Scene } from '@babylonjs/core/scene';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';

import CameraSystem, { ZOOM_MAX as EDITOR_ZOOM_MAX } from '../systems/cameraSystem.js';
import GridSystem from '../systems/gridSystem.js';
import TerrainSystem from '../systems/terrainSystem.js';
import WaterSystem from '../systems/waterSystem.js';
import FishSystem from '../systems/fishSystem.js';
import CreatureSystem from '../systems/creatureSystem.js';
import SkySystem from '../systems/skySystem.js';
import DecoSystem from '../systems/decoSystem.js';
import FloraSystem from '../systems/floraSystem.js';
import CliffVineSystem from '../systems/cliffVineSystem.js';
import DecoHighlightSystem from '../systems/decoHighlightSystem.js';
import CampfireSystem from '../systems/campfireSystem.js';
import GlowSystem from '../systems/glowSystem.js';
import DayNightSystem from '../systems/dayNightSystem.js';
import SimSystem from '../systems/simSystem.js';
import InputSystem from '../systems/inputSystem.js';
import PlayerSystem, { STEP_LIMIT } from '../systems/playerSystem.js';
import PlayerStatsSystem from '../systems/playerStatsSystem.js';
import InteractionSystem from '../systems/interactionSystem.js';
import PlayerAttackSystem from '../systems/playerAttackSystem.js';
import SaveSystem from '../systems/saveSystem.js';
import GatherSystem from '../systems/gatherSystem.js';
import FellingSystem from '../systems/fellingSystem.js';
import HarvestSystem from '../systems/harvestSystem.js';
import FootprintSystem from '../systems/footprintSystem.js';
import InventorySystem from '../systems/inventorySystem.js';
import HeldItemSystem from '../systems/heldItemSystem.js';
import WaveSpraySystem from '../systems/waveSpraySystem.js';
import AudioSystem from '../systems/audioSystem.js';
import InventoryWindow from '../ui/inventoryWindow.js';
import CharacterWindow from '../ui/characterWindow.js';
import LogPanel from '../ui/logPanel.js';
import FloatingNumbers from '../ui/floatingNumbers.js';
import { itemIcon } from '../ui/itemIcons.js';
import Hud from '../ui/hud.js';
import GameCursor from '../ui/gameCursor.js';
import Hotbar from '../ui/hotbar.js';
import VitalsBar from '../ui/vitalsBar.js';
import HoverHint from '../ui/hoverHint.js';
import CreatureHealthBar from '../ui/creatureHealthBar.js';
import DockButton from '../ui/dockButton.js';
import MapEditor from '../editor/mapEditor.js';
import EditorToggle from '../editor/editorToggle.js';
import PauseScreen from '../ui/pauseScreen.js';
import DeathScreen from '../ui/deathScreen.js';
import Dialog from '../ui/dialog.js';
import LoadingScreen from '../ui/loadingScreen.js';
import TooltipPanel from '../ui/tooltipPanel.js';
import { whenModelsIdle, takeModelError, preloadModel, loadModel, loadContainer, loadImported, releaseFrame } from '../utils/assetLoader.js';
import { decorationModelUrl } from '../utils/decoTemplate.js';
import { grassModelUrls } from '../data/catalogs/grass.js';
import { HEIGHT_PRESETS } from '../data/maps/layoutStore.js';
import { WAVE_TIME_WRAP } from '../utils/waterWaves.js';
import { HOTBAR_ITEMS, ITEM_TYPES } from '../data/catalogs/items.js';
import { worldToCellCoords, worldToCell, cellToWorldCoords, CELL_SIZE } from '../utils/gridMath.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { SAVE_VERSION, SAVE_STORAGE_KEY } from '../data/catalogs/saveSchema.js';
import { collectStartupUrls, CREATURE_MODEL_URLS, PLAYER_ASSET_URLS } from '../data/catalogs/modelCatalog.js';
import { mapFileFromLayout, layoutFromMapFile, isMapFile, MAP_VERSION } from '../data/catalogs/mapFile.js';
import { worldCells, hasFloor, ceilingLiftAt } from '../data/maps/areaShape.js';
import { describeWorld, stagePieces } from '../data/catalogs/worldStages.js';
import { PAINT_TERRAIN, PAINT_DECORATIONS, PAINT_CREATURES, PAINT_FISH, PAINT_ALL } from '../data/catalogs/brushes.js';
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
const WALK_CLEARANCE = 1.25;
const WADE_DEPTH = 0.6;
const INDOOR_FADE_SECONDS = 2;
const CHUNK_HIDE_RADIUS = 6;
const WADE_SPEED = 0.65;
const WADE_RAMP = 0.2;
const WATER_STEP_DEPTH = 0.02;
const FOOTPRINT_WATER_DEPTH = 0.35;
const SHORE_CHECK_SECONDS = 0.3;
const MAX_STEP_SECONDS = 0.1;
const SHADOW_REACH_MARGIN = 20;
const SHADOW_REACH_STEP = 0.2;
const EDITOR_CAM_SPEED = 12;
const EDITOR_CAM_SPRINT = 32;
const IMPACT_DELAY = 0.28;
const PLAYER_FLOAT_HEIGHT = 2.2;
const PLAYER_ZOOM_MAX = 22;
const CREATURE_SOUND_RANGE = 22;
const CREATURE_BAR_LIFT = 0.4;
const SHADOW_FRUSTUM = 70;
const SHADOW_MIN_Z = 1;
const SHADOW_MAX_Z = 180;
const TIME_SKIP = { hours: 6 };
const BACK_HIT_DOT = -0.2;
const REBUILD_LABELS = [
  { part: PAINT_TERRAIN, label: 'terén' },
  { part: PAINT_DECORATIONS, label: 'dekorace' },
  { part: PAINT_CREATURES, label: 'tvory' },
  { part: PAINT_FISH, label: 'ryby' },
];

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

export default class GameScene {

  constructor(scene, engine, canvas) {
    this.s = scene;
    this.engine = engine;
    this.canvas = canvas;
    this.gameCursor = new GameCursor();
    this.mapKey = DEFAULT_MAP;
    this.rebuildRunning = false;
    this.rebuildPending = false;
    this.rebuildParts = null;
    this.heightRunning = false;
    this.heightPending = false;

    this.cameraSystem = new CameraSystem(scene);
    this.gridSystem = new GridSystem(scene);
    this.terrainSystem = new TerrainSystem(scene);
    this.waterSystem = new WaterSystem(scene);
    this.waveSpray = new WaveSpraySystem(scene);
    this.fishSystem = new FishSystem(scene);
    this.creatureSystem = new CreatureSystem(scene);
    this.skySystem = new SkySystem(scene);
    this.decoSystem = new DecoSystem(scene);
    this.decoSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z);
    this.floraSystem = new FloraSystem(scene);
    this.cliffVineSystem = new CliffVineSystem(scene);
    this.campfireSystem = new CampfireSystem(scene);
    this.glowSystem = new GlowSystem(scene);
    this.decoHighlight = new DecoHighlightSystem(scene);
    this.dayNightSystem = new DayNightSystem(scene);
    this.simSystem = new SimSystem(scene);
    this.inputSystem = new InputSystem(scene, this);
    this.playerSystem = new PlayerSystem(scene);
    this.playerStats = new PlayerStatsSystem();
    this.playerAttackSystem = new PlayerAttackSystem();
    this.playerAttackSystem.groundHeightAt = (x, z, level) => this.terrainSystem.walkHeightAt(x, z, Number.isFinite(level) ? level : this.playerSystem.level);
    this.playerAttackSystem.onHit = (creature, amount, crit) => this.damageCreature(creature, amount, crit);
    this.playerAttackSystem.onMiss = (creature) => this.missCreature(creature);
    this.interaction = new InteractionSystem(scene);
    this.gatherSystem = new GatherSystem(scene);
    this.gatherSystem.decoSystem = this.decoSystem;
    this.gatherSystem.onLand = () => this.audioSystem.play('fall');
    this.gatherSystem.onFell = (item) => this.finishFelling(item);
    this.fellingSystem = new FellingSystem(scene);
    this.harvestSystem = new HarvestSystem(scene);
    this.footprintSystem = new FootprintSystem(scene);
    this.audioSystem = new AudioSystem(scene);
    this.inventorySystem = new InventorySystem();
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.tooltipPanel = new TooltipPanel();
    this.hotbar = new Hotbar();
    this.bagButton = new DockButton({ icon: '🎒', label: 'Inventář', title: 'Inventář (I)', slot: 'bag' });
    this.characterButton = new DockButton({ icon: '🧍', label: 'Postava', title: 'Postava (C)', slot: 'character' });
    this.log = new LogPanel();
    this.inventoryWindow = new InventoryWindow();
    this.characterWindow = new CharacterWindow();
    this.vitalsBar = new VitalsBar();
    this.hoverHint = new HoverHint();
    this.creatureHealthBar = new CreatureHealthBar();
    this.floatingNumbers = new FloatingNumbers();
    this.walkStepLimit = STEP_LIMIT;
    this.editor = new MapEditor(this);
    this.optionsPanel = new OptionsPanel();
    this.editorToggle = new EditorToggle();
    this.pauseScreen = new PauseScreen();
    this.deathScreen = new DeathScreen();
    this.dialog = new Dialog();
    this.paused = false;
    this.dying = false;
    this.deathTimer = 0;
    this.deathShown = false;
    this.loader = new LoadingScreen();
    this.loader.onHiddenCallback = () => this.onLoadingHidden();
    this.isLoading = true;
    this.loaded = false;
    this.saveHintAfterLoad = null;
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
    this.heldItemSystem = new HeldItemSystem();
    this.heldItemSystem.onChange = () => this.onHeldItemChange();
    this.playerSystem.onStep = (x, z, sprint) => this.onPlayerStep(x, z, sprint);
    this.playerSystem.onFootPlant = (x, z, facing, side, sprint) => this.footfall(x, z, facing, 1, 'human', sprint ? 1.25 : 1);
    this.playerSystem.lookAt = () => this.playerLookPoint();
    this.creatureSystem.onStep = (creature, side) => this.onCreatureStep(creature, side);
    this.playerStats.onChange = (health, maxHealth) => this.vitalsBar.setHealth(health, maxHealth);
    this.playerStats.onStamina = (stamina, maxStamina) => this.vitalsBar.setStamina(stamina, maxStamina);
    this.unlockAudio = () => {
      this.audioSystem.unlock();
      this.audioSystem.startAmbient();
    };
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio, { once: true });
    this.hoverCell = null;
    this.mapLayout = null;
    this.clockText = '';
    this.impactTimer = 0;
    this.shoreClock = 0;
    this.creaturePickAt = 0;
    this.creatureTooltipOn = false;
    this.creatureLayoutKey = null;
  }

  start() {
    const urls = collectStartupUrls(this.heldItemSystem.key);
    this.loader.plan(urls.length);
    this.startPreload(urls);
  }

  async startPreload(urls) {
    const creatureModels = new Set(CREATURE_MODEL_URLS);
    const playerAssets = new Set(PLAYER_ASSET_URLS);
    const result = await this.loader.runAssets(urls, (url) => {
      if (playerAssets.has(url)) return loadImported(this.s, url);
      if (creatureModels.has(url)) return loadContainer(this.s, url);
      return preloadModel(this.s, url);
    });
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
    this.campfireSystem.onIgnite = () => {
      this.audioSystem.play('ignite');
      this.log.add('Táborák zapálen', 'action');
    };
    this.setupGlow();
    this.camera = this.cameraSystem.create();
    this.setupLighting();
    this.cameraSystem.setMaxZoom(PLAYER_ZOOM_MAX);
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
    this.setupSimulation();
    this.setupHud();
    this.setupOptions();
    this.setupInput();
    this.setupEditorToggle();
    this.registerHudEvents();

    this.s.onBeforeRenderObservable.add(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_STEP_SECONDS);
      this.shadowClock += dt;
      if (this.shadowClock >= SHADOW_REACH_STEP) {
        this.shadowClock = 0;
        this.refreshShadowReach();
      }
      this.refreshCreatureHealthBars();
      if (this.paused) {
        if (this.editor.active) {
          this.updateEditorCamera(dt);
          this.waterSystem.update(dt);
          this.updateWaveSpray();
          this.decoSystem.updateWind(this.floraSystem.clock);
          this.updateWaterCaustics();
          this.editor.updateHeightLabels();
        }
        this.refreshClock();
        return;
      }
      this.simSystem.update(dt);
      if (this.options.dayCycle && !this.simSystem.halted) {
        this.dayNightSystem.update(dt * this.simSystem.speed);
      }
      this.refreshAmbient(dt);
      this.decoHighlight.update(dt);
      this.decoSystem.updateWind(this.floraSystem.clock);
      if (this.isLoading) {
        this.audioSystem.update(dt);
        this.refreshClock();
        return;
      }
      this.followPointer();
      this.hoverHint.follow(this.s.pointerX, this.s.pointerY);
      this.playerSystem.update(dt);
      this.updateDeath(dt);
      this.creatureSystem.update(dt);
      this.footprintSystem.update(dt);
      this.glowSystem.retryPending();
      this.updateGathering(dt);
      this.updatePlayerAttack(dt);
      const root = this.playerSystem.root;
      this.campfireSystem.update(dt, root);
      this.waterSystem.update(dt);
      this.updateWaveSpray();
      this.fishSystem.update(dt);
      this.updateWaterCaustics();
      this.updateCampfireSound(root);
      this.updateShoreSound(root, dt);
      if (root) {
        if (this.editor.active) this.updateEditorCamera(dt);
        else this.cameraSystem.follow(root.position.x, root.position.z, root.position.y, dt);
      }
      this.autoTune(dt);
      this.audioSystem.update(dt);
      this.playerSystem.updateFire();
      this.refreshClock();
    });

    this.engine.runRenderLoop(() => this.s.render());
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.inventoryWindow.update(this.inventorySystem);
    await this.prepareGame();
  }

  async prepareGame() {
    await this.buildWorld();
    this.refreshShadowCasters();
    this.saveSystem.dropLegacy();
    this.setupSave();
    if (this.saveSystem.consumeLoadOnStart()) this.loadSaveState();
    this.loader.beginFloat('Budím postavu…');
    await this.setupPlayer();
    await this.setupCreatures();
    this.loader.floatProgress(1, 1, 'Seju trávu…');
    this.grassModelList = await this.loadGrassModels();
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.floraSystem.addShelfGrass(this.terrainSystem.shelfAnchors);
    this.floraSystem.updateView(this.viewCircle());
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
    if (this.saveHintAfterLoad) {
      const notice = this.saveHintAfterLoad;
      this.saveHintAfterLoad = null;
      this.dialog.tell(notice);
    }
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
    this.audioSystem.setMusicVolume(this.options.musicVolume / 100);
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

  setPointerCursorState() {
    if (this.editor.active) {
      this.gameCursor.setState('default');
      return;
    }
    const pointer = this.inputSystem.lastCell;
    const entry = pointer
      ? this.gatherSystem.entries.find((item) => item.left > 0
        && item.entry.cx === pointer.cx && item.entry.cz === pointer.cz)
      : null;
    const tool = this.heldItemSystem.tool();
    if (!entry || entry.def.byHand || !tool || !tool.harvest || !tool.harvest.kinds.includes(entry.def.kind)) {
      this.gameCursor.setState('default');
      return;
    }
    this.gameCursor.setState(tool.model === 'pickaxe' ? 'mine' : 'chop');
  }

  followPointer() {
    const now = performance.now();
    const moved = this.inputSystem.takeMoved();
    if (!this.options.highlights) {
      this.creatureSystem.clearHover();
      this.creatureTooltipOn = false;
      this.tooltipPanel.hide();
      this.setHoverHint(null);
      this.gameCursor.setState('default');
      return;
    }
    if (!this.inputSystem.pointerInside()) {
      this.decoHighlight.setHover(null);
      this.creatureSystem.clearHover();
      this.creatureTooltipOn = false;
      this.tooltipPanel.hide();
      this.setHoverHint(null);
      this.gameCursor.setState('default');
      return;
    }
    if (moved || now - this.creaturePickAt > 250) {
      this.creaturePickAt = now;
      const creature = this.creatureSystem.hoverAt(this.s.pointerX, this.s.pointerY)
        || this.assistCreatureAtPointer();
      if (creature) {
        this.decoHighlight.setHover(null);
        this.showCreatureTooltip(creature);
        this.setHoverHint(null);
        this.gameCursor.setState(this.editor.active ? 'default' : 'attack');
        return;
      }
      const corpse = this.creatureSystem.corpseAt(this.s.pointerX, this.s.pointerY);
      if (corpse) {
        this.decoHighlight.setHover(null);
        this.showCorpseTooltip(corpse);
        this.setHoverHint(null);
        this.gameCursor.setState('default');
        return;
      }
      this.hideCreatureTooltip();
      this.setPointerCursorState();
      this.setHoverHint(this.interaction.targetOf('gather', { cell: this.inputSystem.cellAtPointer() }));
    }
    if (!moved) return;
    const pointer = this.inputSystem.lastCell;
    if (pointer && this.decoHighlight.hasEntry(pointer.cx, pointer.cz)) {
      this.decoHighlight.setHover(pointer);
      this.setPointerCursorState();
      return;
    }
    this.decoHighlight.setHover(this.inputSystem.cellAtPointer());
    this.setPointerCursorState();
  }

  setHoverHint(target) {
    if (!target || !target.inReach || this.editor.active || this.dying) {
      this.hoverHint.hide();
      return;
    }
    this.hoverHint.show(target.detail);
    this.hoverHint.follow(this.s.pointerX, this.s.pointerY);
  }

  showCreatureTooltip(creature) {
    if (!creature) return;
    this.creatureTooltipOn = true;
    const total = creature.tier && Number.isFinite(creature.tier.health) ? Math.round(creature.tier.health) : null;
    const left = Number.isFinite(creature.health) ? Math.max(0, Math.round(creature.health)) : null;
    const detail = total !== null && left !== null ? `Zdraví ${left} / ${total}` : '';
    this.tooltipPanel.show(`${creature.type.label} (${creature.tier.label})`, detail);
  }

  hideCreatureTooltip() {
    if (!this.creatureTooltipOn) return;
    this.creatureTooltipOn = false;
    this.refreshHoverTooltip(this.inputSystem.lastCell);
  }

  showCorpseTooltip(corpse) {
    if (!corpse) return;
    this.creatureTooltipOn = true;
    const loot = corpse.type && corpse.type.loot ? Object.entries(corpse.type.loot) : [];
    const names = loot
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .map(([key]) => (ITEM_TYPES[key] ? ITEM_TYPES[key].displayName : key));
    const detail = names.length ? `Levé tlačítko — sebrat ${names.join(' a ')}` : 'Mrtvý tvor';
    this.tooltipPanel.show(`${corpse.type.label} (mrtvá)`, detail);
  }

  updateGathering(dt) {
    const active = this.loaded && !this.editor.active && !this.dying;
    this.gatherSystem.setPlayer(active ? this.playerSystem : null);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gatherSystem.update(dt, this.playerSystem, active ? this.inputSystem.lastCell : null);
    if (active) this.holdStrikeReady();
    this.updateGatherImpact(dt);
    this.hotbar.setPrompt(this.gatherPrompt());
  }

  gatherPrompt() {
    if (this.editor.active) return '';
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

  handleLeftDown() {
    if (!this.loaded || this.editor.active) return;
    if (this.playerSystem.lying || this.dying) return;
    if (this.campfireSystem.pending) {
      this.cancelCampfireIgnite();
      return;
    }
    const target = this.interactionTarget();
    if (!target || !target.inReach) return;
    this.interaction.act(target);
  }

  interactionTarget() {
    return this.interaction.targetAt({
      cell: this.inputSystem.cellAtPointer(),
      pointerX: this.s.pointerX,
      pointerY: this.s.pointerY,
    });
  }

  registerInteractions() {
    this.interaction.register('creature', {
      priority: 100,
      pick: ({ pointerX, pointerY }) => {
        const creature = this.creatureSystem.hoverAt(pointerX, pointerY) || this.assistCreatureAtPointer();
        if (!creature) return null;
        return {
          ref: creature,
          inReach: this.playerAttackSystem.canHit(creature, this.playerSystem),
        };
      },
      act: (target) => this.swingCreature(target.ref),
    });
    this.interaction.register('corpse', {
      priority: 90,
      pick: ({ pointerX, pointerY }) => {
        const corpse = this.creatureSystem.corpseAt(pointerX, pointerY);
        if (!corpse) return null;
        return { ref: corpse, inReach: true };
      },
      act: (target) => this.lootCorpse(target.ref),
    });
    this.interaction.register('gather', {
      priority: 50,
      pick: ({ cell }) => {
        const item = cell ? this.gatherSystem.itemAtCell(cell.cx, cell.cz) : null;
        if (!item) return null;
        return {
          ref: item,
          detail: this.describeGatherTarget(item),
          inReach: this.gatherSystem.inReach(item),
        };
      },
      act: (target) => this.strikeGather(target.ref),
    });
    this.interaction.register('campfire', {
      priority: 40,
      pick: ({ cell }) => {
        if (!cell || !this.campfireSystem.nearest) return null;
        if (!this.campfireSystem.has(cell.cx, cell.cz)) return null;
        return { ref: cell, inReach: true };
      },
      act: (target) => this.campfireSystem.ignite(target.ref),
    });
  }

  describeGatherTarget(target) {
    if (target.def.byHand) return `Levé tlačítko — sbírat ${target.def.displayName} (${target.left}/${target.total})`;
    const verb = target.def.kind === 'tree' ? 'kácet' : 'těžit';
    return `Levé tlačítko — ${verb} ${target.def.displayName} (${target.left}/${target.total})`;
  }

  strikeGather(item) {
    const swung = item ? this.gatherSystem.hitItem(item) : this.gatherSystem.beginHit();
    if (swung) this.playerStats.spendGather();
    return swung;
  }

  takenAnchor(cell) {
    for (const item of this.gatherSystem.entries) {
      if (item.left > 0) continue;
      if (item.entry.cx === cell.cx && item.entry.cz === cell.cz) return item.anchor;
    }
    return null;
  }

  holdStrikeReady() {
    if (!this.inputSystem.leftDown || this.editor.active) return false;
    if (this.campfireSystem.pending) return false;
    if (this.playerAttackSystem.target) return false;
    if (this.creatureSystem.hovered || this.creatureSystem.hoveredCorpse) return false;
    const gather = this.gatherSystem;
    if (!gather.target || gather.cooldown > 0 || gather.pending) return false;
    return this.strikeGather();
  }

  onPlayerStep(x, z, sprint) {
    const onBridge = this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null;
    const inWater = !onBridge && this.waterDepthNowAt(x, z) > WATER_STEP_DEPTH;
    const key = this.decoSystem.surfaceKeyAt(worldToCell(x), worldToCell(z)) || '';
    this.audioSystem.play(inWater ? 'stepWater' : surfaceStepSound(key), { gain: sprint ? 1.35 : 1 });
  }

  onCreatureStep(creature, step) {
    if (!creature || !creature.type) return;
    const footprint = creature.type.footprint || {};
    const tierScale = creature.tier && Number.isFinite(creature.tier.scale) ? creature.tier.scale : 1;
    const scale = (Number.isFinite(footprint.scale) ? footprint.scale : 0.85) * tierScale;
    const angle = creature.holder && Number.isFinite(creature.holder.rotation.y)
      ? creature.holder.rotation.y
      : (Number.isFinite(creature.renderFacing) ? creature.renderFacing : (Number.isFinite(creature.facing) ? creature.facing : 0)) + (creature.type.yawOffset || 0);
    const kind = footprint.kind || 'turtle';
    const feet = Array.isArray(footprint.feet) ? footprint.feet : null;
    if (feet && feet.length) {
      const order = Array.isArray(footprint.order) && footprint.order.length
        ? footprint.order
        : feet.map((_, index) => index);
      const foot = feet[order[step % order.length]];
      if (!foot) return;
      const lateral = (Number(foot.side) || 0) * tierScale;
      const forward = (Number(foot.forward) || 0) * tierScale;
      const x = creature.x + Math.cos(angle) * lateral + Math.sin(angle) * forward;
      const z = creature.z - Math.sin(angle) * lateral + Math.cos(angle) * forward;
      this.footfall(x, z, angle, scale, kind, 0.45 + scale);
      return;
    }
    const offset = Number.isFinite(footprint.offset) ? footprint.offset : 0.22;
    const direction = step % 2 === 0 ? 1 : -1;
    const x = creature.x + Math.cos(angle + Math.PI / 2) * offset * tierScale * direction;
    const z = creature.z + Math.sin(angle + Math.PI / 2) * offset * tierScale * direction;
    this.footfall(x, z, angle, scale, kind, 0.45 + scale);
  }

  footfall(x, z, angle, scale, kind, strength = 1) {
    this.stepSplash(x, z, strength);
    this.spawnFootprint(x, z, angle, scale, kind);
  }

  stepSplash(x, z, strength) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null) return;
    if (this.waterDepthNowAt(x, z) <= WATER_STEP_DEPTH) return;
    this.waterSystem.splash(x, z, strength);
  }

  spawnFootprint(x, z, angle, scale, kind = 'human') {
    if (!this.options.footprints) return;
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    if (this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null) return;
    const cx = worldToCell(x);
    const cz = worldToCell(z);
    const pathKey = this.decoSystem.surfaceKeyAt(cx, cz) || '';
    const floorKey = this.terrainSystem.floorKeyAt ? this.terrainSystem.floorKeyAt(cx, cz) : null;
    const key = pathKey || floorKey || '';
    if (!/sand/i.test(key)) return;
    const depth = this.waterDepthNowAt(x, z);
    if (depth > FOOTPRINT_WATER_DEPTH) return;
    const y = this.terrainSystem.walkHeightAt(x, z) + 0.025;
    this.footprintSystem.spawn({ x, y, z, angle, scale, kind, wet: depth > WATER_STEP_DEPTH });
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
    this.inventoryWindow.update(this.inventorySystem);
    this.logGain(yields);
  }

  finishFelling(item) {
    const anchor = item ? item.anchor : null;
    if (!anchor || anchor.isDisposed()) return;
    const fall = item.fall || { dirX: 1, dirZ: 0 };
    this.applyFelling(item.entry.cx, item.entry.cz, anchor, item.def, fall, true);
    this.log.add(`Pokáceno: ${item.def.displayName}`, 'action');
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
      this.restoreHarvested(found, cell);
      this.harvestSystem.drop(cell.cx, cell.cz);
      restored += 1;
    }
    if (restored) this.refreshGatherTargets();
    if (restored === 1) this.log.add('Na místě vyrostla houba nebo mušle', 'info');
    else if (restored > 1) this.log.add(`Na místě vyrostlo ${restored} hub a mušlí`, 'info');
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
    this.playerSystem.inputBlocked = () => this.dialog.open || this.dying;
    this.playerSystem.moveBlocked = () => this.editor.active;
    this.playerSystem.walkable = (x, z, level) => this.isWalkableAt(x, z, level);
    this.playerSystem.stepLevel = (fromX, fromZ, level, toX, toZ) => this.stepLevel(fromX, fromZ, level, toX, toZ);
    this.playerSystem.passageAt = (x, z, level) => this.isPassageAt(x, z, level);
    this.playerSystem.inCombat = () => this.creatureSystem.isPlayerInCombat(this.playerSystem.root);
    this.playerSystem.canSprint = () => this.playerStats.canSprint();
    this.playerSystem.speedScale = (x, z) => {
      if (this.terrainSystem.bridgeDeckAt(x, z) !== null) return 1;
      const depth = this.waterDepthNowAt(x, z);
      if (depth <= WATER_STEP_DEPTH) return 1;
      const wet = Math.min(1, depth / WADE_RAMP);
      return 1 - (1 - WADE_SPEED) * wet;
    };
    this.playerSystem.decoSystem = this.decoSystem;
    this.playerSystem.groundHeightAt = (x, z, level) => this.terrainSystem.walkHeightAt(x, z, level);
    this.playerSystem.wallRiseAt = (x, z, radius, level) => this.terrainSystem.riseNear(x, z, radius, level);
    this.playerSystem.cliffOverlapAt = (x, z, level) => this.terrainSystem.cliffOverlap(x, z, level);
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z, this.playerSystem.root ? this.playerSystem.root.position.y : 0);
    this.playerSystem.onIntroChange = (lying) => {
      if (lying) this.log.add('Stiskni WASD nebo šipky pro vstání', 'info');
    };
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    this.playerSystem.setHeldTool(this.heldItemSystem.key);
    this.playerSystem.onProgress = (done) => this.loader.floatProgress(done);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.addShadowCaster(child);
    this.cameraSystem.snapTo(root.position.x, root.position.z, root.position.y);
    this.rescuePlayerFromWater();
  }

  async setupCreatures() {
    const system = this.creatureSystem;
    system.groundHeightAt = (x, z, level) => this.terrainSystem.walkHeightAt(x, z, level);
    system.walkableAt = (x, z, level) => this.isWalkableAt(x, z, level);
    system.wallRiseAt = (x, z, radius) => this.terrainSystem.riseNear(x, z, radius);
    system.playerAt = () => (this.editor.active || !this.playerSystem.root ? null : this.playerSystem.root.position);
    system.defenseAt = () => this.playerStats.defense;
    system.onMeshReady = (mesh) => this.addShadowCaster(mesh);
    system.onMeshGone = (mesh) => this.removeShadowCaster(mesh);
    system.onRosterChange = () => {
      this.refreshShadowCasters();
      this.refreshReflectionExclusions();
    };
    system.onSound = (key, creature) => this.playCreatureSound(key, creature);
    system.onBite = (creature, damage, crit) => this.onCreatureBite(creature, damage, crit);
    system.onBiteMiss = (creature) => this.onCreatureBiteMiss(creature);
    await system.create(this.mapLayout);
    this.creatureLayoutKey = this.creatureLayoutSignature();
    this.refreshReflectionExclusions();
  }

  creatureLayoutSignature() {
    const layout = this.mapLayout || {};
    return JSON.stringify(Array.isArray(layout.creatures) ? layout.creatures : null);
  }

  async refreshCreatures() {
    const key = this.creatureLayoutSignature();
    if (key === this.creatureLayoutKey) return;
    this.creatureLayoutKey = key;
    await this.setupCreatures();
    this.refreshShadowCasters();
    if (this.editor.active) this.editor.refreshCreatureMarks();
  }

  creatureStatusAt(cx, cz, kind, tierKey) {
    return this.creatureSystem.statusAt(cx, cz, kind, tierKey);
  }

  playCreatureSound(key, creature) {
    if (!key || !creature) return;
    const root = this.playerSystem.root;
    const center = root ? root.position : this.cameraSystem.viewCenter();
    const distance = Math.hypot(creature.renderX - center.x, creature.renderZ - center.z);
    const gain = Math.max(0, Math.min(1, 1 - distance / CREATURE_SOUND_RANGE));
    if (gain <= 0.02) return;
    this.audioSystem.play(key, { gain });
  }

  playerLookPoint() {
    if (!this.options.lookAtPointer) return null;
    if (this.editor.active) return null;
    const root = this.playerSystem.root;
    if (!root || !this.inputSystem.pointerInside()) return null;
    const camera = this.cameraSystem.camera;
    if (!camera) return null;
    const ray = this.s.createPickingRay(this.s.pointerX, this.s.pointerY, null, camera);
    if (!ray) return null;
    const dy = ray.direction.y;
    if (!Number.isFinite(dy) || Math.abs(dy) < 0.0001) return null;
    const t = (root.position.y - ray.origin.y) / dy;
    if (!Number.isFinite(t) || t <= 0) return null;
    return { x: ray.origin.x + ray.direction.x * t, z: ray.origin.z + ray.direction.z * t };
  }

  swingCreature(creature) {
    const swung = this.playerAttackSystem.swing(creature, this.playerSystem);
    if (swung) this.playerStats.spendAttack();
    return swung;
  }

  assistCreatureAtPointer() {
    const root = this.playerSystem.root;
    if (!root || !this.inputSystem.pointerInside()) return null;
    let best = null;
    let bestDistance = 32;
    const reach = this.playerAttackSystem.reach + 0.35;
    for (const creature of this.creatureSystem.creatures) {
      if (!creature || creature.dead) continue;
      const worldDistance = Math.hypot(creature.x - root.position.x, creature.z - root.position.z);
      if (worldDistance > reach) continue;
      const holderY = creature.holder && !creature.holder.isDisposed()
        ? creature.holder.position.y
        : root.position.y;
      const point = this.screenPointOf(creature.renderX, holderY + creature.markHeight * 0.5, creature.renderZ);
      if (!point) continue;
      const distance = Math.hypot(point.x - this.s.pointerX, point.y - this.s.pointerY);
      if (distance > bestDistance) continue;
      best = creature;
      bestDistance = distance;
    }
    return best;
  }

  lootCorpse(corpse) {
    if (!corpse) return false;
    const yields = this.creatureSystem.loot(corpse);
    if (!yields) return false;
    this.creatureTooltipOn = false;
    this.tooltipPanel.hide();
    this.playerSystem.faceTo(corpse.x, corpse.z);
    this.playerSystem.crouchPickUp();
    this.decoHighlight.setHover(null);
    for (const { itemKey, amount } of yields) this.inventorySystem.add(itemKey, amount);
    this.inventoryWindow.update(this.inventorySystem);
    this.logGain(yields);
    return true;
  }

  updatePlayerAttack(dt) {
    const active = this.loaded && !this.editor.active && !this.dying;
    this.playerAttackSystem.update(active ? dt : 0);
    if (!active || !this.inputSystem.leftDown) return;
    const target = this.playerAttackSystem.target;
    if (!target || !this.creatureSystem.creatures.includes(target)) {
      this.playerAttackSystem.target = null;
      return;
    }
    if (this.creatureSystem.hovered !== target && this.assistCreatureAtPointer() !== target) {
      this.playerAttackSystem.target = null;
      return;
    }
    this.swingCreature(target);
  }

  damageCreature(creature, amount, crit) {
    if (!creature) return false;
    const killed = this.creatureSystem.damage(creature, amount, this.simSystem.time);
    this.audioSystem.play('bare');
    const label = creature.type ? creature.type.label : 'Tvor';
    this.showFloatingDamage(creature, amount, crit);
    if (killed) {
      this.log.add(`Porazil jsi: ${label}`, 'warn');
      return true;
    }
    const left = Math.max(0, Math.round(creature.health));
    const total = creature.tier && Number.isFinite(creature.tier.health) ? Math.round(creature.tier.health) : null;
    const suffix = total === null ? '' : ` (${left} / ${total})`;
    const critText = crit ? ' kriticky' : '';
    this.log.add(`${label} — ${Math.round(amount)} poškození${critText}${suffix}`, 'action');
    return false;
  }

  missCreature(creature) {
    if (!creature) return;
    this.audioSystem.play('miss');
    const label = creature.type ? creature.type.label : 'Tvor';
    this.log.add(`Minul jsi: ${label}`, 'action');
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ);
    this.spawnFloatingText('Minul', creature.renderX, ground + creature.markHeight, creature.renderZ, 'miss');
  }

  showFloatingDamage(creature, amount, crit) {
    if (!creature) return;
    const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ);
    const kind = crit ? 'crit' : null;
    this.spawnFloatingNumber(amount, creature.renderX, ground + creature.markHeight, creature.renderZ, kind);
  }

  showFloatingOverPlayer(amount, crit) {
    const root = this.playerSystem.root;
    if (!root) return;
    const y = root.position.y + PLAYER_FLOAT_HEIGHT;
    this.spawnFloatingNumber(amount, root.position.x, y, root.position.z, crit ? 'crit' : 'hurt');
  }

  spawnFloatingNumber(amount, x, y, z, kind) {
    if (!Number.isFinite(amount)) return;
    this.spawnFloatingText(Math.round(amount), x, y, z, kind);
  }

  spawnFloatingText(text, x, y, z, kind) {
    if (!this.options.floatingNumbers) return;
    const point = this.screenPointOf(x, y, z);
    if (!point) return;
    this.floatingNumbers.spawn(point, text, kind);
  }

  screenPointOf(x, y, z) {
    const camera = this.cameraSystem.camera;
    const canvas = this.engine.getRenderingCanvas();
    if (!camera || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const viewport = camera.viewport.toGlobal(rect.width, rect.height);
    const point = new Vector3(x, y, z);
    const projected = Vector3.Project(point, Matrix.Identity(), this.s.getTransformMatrix(), viewport);
    if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
    return { x: projected.x, y: projected.y };
  }

  refreshCreatureHealthBars() {
    if (!this.loaded || this.paused || this.editor.active) {
      this.creatureHealthBar.update([]);
      return;
    }
    const canvas = this.engine.getRenderingCanvas();
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    if (!rect || !rect.width || !rect.height) {
      this.creatureHealthBar.update([]);
      return;
    }
    const items = [];
    for (const creature of this.creatureSystem.creatures) {
      if (!creature || !creature.slotKey || !Number.isFinite(creature.health) || creature.buried) continue;
      const total = creature.tier && Number.isFinite(creature.tier.health) ? creature.tier.health : 0;
      if (total <= 0) continue;
      const ratio = creature.health / total;
      const combat = creature.mode === 'alert' || creature.mode === 'chase'
        || creature.mode === 'windup' || creature.mode === 'recover';
      const hovered = this.creatureSystem.hovered === creature;
      if (ratio >= 0.999 && !combat && !hovered) continue;
      const ground = this.terrainSystem.walkHeightAt(creature.renderX, creature.renderZ);
      const point = this.screenPointOf(creature.renderX, ground + creature.markHeight + CREATURE_BAR_LIFT, creature.renderZ);
      if (!point) continue;
      if (point.x < 0 || point.y < 0 || point.x > rect.width || point.y > rect.height) continue;
      items.push({ key: creature.slotKey, x: point.x, y: point.y, ratio });
    }
    this.creatureHealthBar.update(items);
  }

  hurtPlayer(amount, label, crit = false, fromBehind = false) {
    if (!this.loaded || this.paused || this.dying) return false;
    if (!this.playerStats.hurt(amount)) return false;
    this.audioSystem.play(crit ? 'hurtCrit' : 'hurt');
    if (this.options.cameraShake) this.cameraSystem.shake(0.28, 0.32);
    if (this.options.damageFlash) this.vitalsBar.flash();
    if (label) this.log.add(label, 'warn');
    if (this.playerStats.health <= 0) this.onPlayerDeath(fromBehind);
    else this.playerSystem.flinch();
    return true;
  }

  isBehindPlayer(creature) {
    const root = this.playerSystem.root;
    if (!root || !creature) return false;
    const dx = creature.x - root.position.x;
    const dz = creature.z - root.position.z;
    const distance = Math.hypot(dx, dz);
    if (!Number.isFinite(distance) || distance < 0.001) return false;
    const facing = this.playerSystem.facing;
    const dot = (dx * Math.sin(facing) + dz * Math.cos(facing)) / distance;
    return dot < BACK_HIT_DOT;
  }

  onCreatureBite(creature, damage, crit) {
    const who = creature && creature.type ? creature.type.label : 'Útok';
    const critText = crit ? ' kriticky' : '';
    const behind = this.isBehindPlayer(creature);
    const hurt = this.hurtPlayer(damage, `${who} — ${Math.round(damage)} poškození${critText}`, crit, behind);
    if (hurt) this.showFloatingOverPlayer(damage, crit);
  }

  onCreatureBiteMiss(creature) {
    const who = creature && creature.type ? creature.type.label : 'Útok';
    this.audioSystem.play('miss');
    this.log.add(`${who} — útok minul`, 'info');
    this.showFloatingTextOverPlayer('Minul', 'miss');
  }

  showFloatingTextOverPlayer(text, kind) {
    const root = this.playerSystem.root;
    if (!root) return;
    this.spawnFloatingText(text, root.position.x, root.position.y + PLAYER_FLOAT_HEIGHT, root.position.z, kind);
  }

  onPlayerDeath(fromBehind) {
    if (this.dying) return;
    this.dying = true;
    this.deathShown = false;
    this.deathTimer = this.playerSystem.die(Boolean(fromBehind));
    this.playerSystem.releaseKeys();
    this.closeOpenWindows();
    this.hoverHint.hide();
    this.simSystem.setHalted(true);
  }

  updateDeath(dt) {
    if (!this.dying || this.deathShown) return;
    this.deathTimer -= dt;
    if (this.deathTimer > 0) return;
    this.deathShown = true;
    this.log.add('Zemřel jsi', 'warn');
    this.deathScreen.show();
  }

  respawnPlayer() {
    if (!this.dying) return;
    this.dying = false;
    this.deathShown = false;
    this.deathTimer = 0;
    this.deathScreen.hide();
    const spawn = this.mapLayout && this.mapLayout.spawn ? this.mapLayout.spawn : null;
    const spot = spawn ? cellToWorldCoords(spawn.cx, spawn.cz) : null;
    this.playerStats.resurrect();
    this.playerSystem.revive(spot ? spot.x : null, spot ? spot.z : null);
    this.simSystem.setHalted(false);
    this.simSystem.resetAccumulator();
    this.log.add('Probral ses na pláži', 'warn');
  }

  refreshTerrain() {
    this.floatingNumbers.clear();
    this.terrainSystem.clear();
    this.terrainSystem.create(this.mapKey, this.mapFile);
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
    this.creatureSystem.clearPathCache();
    this.refreshShadowCasters();
    this.renderWater();
    this.cliffVineSystem.create(this.terrainSystem.shelfAnchors, this.greenTint());
  }

  setupTerrain() {
    const ground = this.terrainSystem.create(this.mapKey, this.mapFile);
    if (ground && ground.length) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    this.editor.mode.assignRealCells(this.terrainSystem.realCells);
    this.areaLookup = null;
    this.creatureSystem.clearPathCache();
    this.renderWater();
    this.cliffVineSystem.create(this.terrainSystem.shelfAnchors, this.greenTint());
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
    this.cameraSystem.snapTo(x, z, this.terrainSystem.walkHeightAt(x, z));
  }

  refreshWaterVisibility() {
    this.waterSystem.setVisible(!this.editor || this.editor.mode.waterShown !== false);
    this.fishSystem.show();
  }

  refreshReflectionExclusions() {
    const excluded = [this.terrainSystem.skirtMesh, ...this.floraSystem.grassMeshes];
    const shadows = this.decoSystem.contactShadow ? this.decoSystem.contactShadow.mesh : null;
    if (shadows) excluded.push(shadows);
    for (const school of this.fishSystem.schools) {
      if (school.mesh) excluded.push(school.mesh);
    }
    for (const mesh of this.creatureSystem.meshes) {
      if (mesh && !mesh.isDisposed()) excluded.push(mesh);
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
    this.waveSpray.build(this.waterSystem);
    this.refreshWaterVisibility();
    this.refreshFish();
    this.refreshReflectionExclusions();
    this.rescuePlayerFromWater();
  }

  updateWaveSpray() {
    const camera = this.s.activeCamera;
    if (!camera) return;
    this.waveSpray.update(camera.position.x, camera.position.z);
  }

  refreshFish() {
    const level = this.mapLayout && Number.isFinite(this.mapLayout.waterLevel) ? this.mapLayout.waterLevel : null;
    this.fishSystem.create(
      this.mapLayout,
      level,
      this.waterSystem,
      (x, z) => this.terrainSystem.heightAt(x, z),
      () => (this.playerSystem.root ? this.playerSystem.root.position : null),
    );
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
    this.gatherSystem.syncFromDeco();
    this.campfireSystem.sync(this.mapFile.decorations || []);

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

  renderMapLayout(parts) {
    const list = Array.isArray(parts) ? parts : PAINT_ALL;
    if (!this.rebuildParts) this.rebuildParts = new Set();
    for (const part of list) this.rebuildParts.add(part);
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
  }

  takeRebuildParts() {
    const parts = this.rebuildParts || new Set(PAINT_ALL);
    this.rebuildParts = null;
    return parts;
  }

  nextFrame() {
    if (document.hidden) return Promise.resolve();
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  async rebuildWorld(parts) {
    this.adoptEditorMap();
    this.markMapDirty();
    const terrain = parts.has(PAINT_TERRAIN);
    if (terrain) {
      this.gatherSystem.clear();
      this.refreshTerrain();
      await this.terrainSystem.whenReady();
    }
    if (parts.has(PAINT_DECORATIONS)) await this.rebuildDecorations();
    if (parts.has(PAINT_CREATURES)) {
      await this.refreshCreatures();
      this.handleHover(this.hoverCell);
    }
    if (!terrain && parts.has(PAINT_FISH)) this.refreshFish();
  }

  showRebuildBusy(parts) {
    if (!this.editor.active) return;
    const labels = REBUILD_LABELS.filter((entry) => parts.has(entry.part)).map((entry) => entry.label);
    this.editor.hud.setBusy(labels.length ? `Přepočítávám: ${labels.join(' · ')}` : 'Přepočítávám mapu…');
  }

  hideRebuildBusy() {
    if (this.rebuildRunning || this.heightRunning) return;
    this.editor.hud.setBusy(null);
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
        this.showRebuildBusy(new Set([PAINT_TERRAIN]));
        await this.nextFrame();
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
      this.hideRebuildBusy();
      if (this.heightPending) this.runHeightRebuild();
    }
  }

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

  grassLook() {
    const map = getMap(this.mapKey);
    return {
      shade: this.terrainSystem.grassShade(map),
      groundPatch: this.options.groundBlend !== false,
    };
  }

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
  }

  async rebuildGrass() {
    this.grassModelList = await this.loadGrassModels();
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.floraSystem.addShelfGrass(this.terrainSystem.shelfAnchors);
    this.floraSystem.updateView(this.viewCircle());
    this.refreshReflectionExclusions();
  }

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
      console.warn(`[mapa] Mapu ${this.mapKey} nejde přečíst ze souboru — ${error.message}`);
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

  greenTint() {
    const map = getMap(this.mapKey);
    const tone = (map && map.colors && map.colors.surfaceTint) || [0.5, 0.62, 0.45];
    return [
      Math.min(1.15, tone[0] * 1.9),
      Math.min(1.15, tone[1] * 1.9),
      Math.min(1.15, tone[2] * 1.7),
    ];
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
    dir.autoUpdateExtends = false;
    dir.shadowFrustumSize = SHADOW_FRUSTUM;
    dir.shadowMinZ = SHADOW_MIN_Z;
    dir.shadowMaxZ = SHADOW_MAX_Z;
    if (CascadedShadowGenerator.IsSupported) {
      const csm = new CascadedShadowGenerator(light.shadowMapSize, dir, true, this.camera);
      csm.numCascades = 2;
      csm.stabilizeCascades = true;
      csm.lambda = 0.8;
      csm.cascadeBlendPercentage = 0.1;
      csm.shadowMaxZ = SHADOW_MAX_Z;
      csm.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      this.shadowGenerator = csm;
    } else {
      this.shadowGenerator = new ShadowGenerator(light.shadowMapSize, dir);
      this.shadowGenerator.usePercentageCloserFiltering = true;
      this.shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    this.shadowGenerator.bias = 0.00005;
    this.shadowGenerator.normalBias = 0.002;
    this.shadowGenerator.getShadowMap().clearColor = new Color4(1, 1, 1, 1);
    this.refreshShadowDepth();

    this.setupFog(map);

    this.dayNightSystem.create(map);
    this.dayNightSystem.attach(dir, hemi);
    this.dayNightSystem.apply();
    this.terrainSystem.onRebuilt = () => this.refreshCaveLighting();
    this.refreshCaveLighting();
  }

  refreshCaveLighting() {
    if (!this.terrainSystem || !this.sunLight) return;
    const cave = this.terrainSystem.caveMeshes();
    this.caveMeshList = cave;
    this.sunLight.excludedMeshes = cave;
    const sky = this.dayNightSystem ? this.dayNightSystem.skyLight : null;
    if (sky) sky.excludedMeshes = cave;
    if (!this.caveLight) {
      const light = new HemisphericLight('caveLight', new Vector3(0, 1, 0), this.s);
      light.groundColor = new Color3(0.02, 0.02, 0.03);
      light.diffuse = new Color3(0.16, 0.18, 0.22);
      light.specular = new Color3(0, 0, 0);
      light.intensity = 1;
      this.caveLight = light;
    }
    this.caveLight.includedOnlyMeshes = cave;
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

  refreshShadowCasters() {
    this.shadowCasters = this.shadowCasters.filter((mesh) => mesh && !mesh.isDisposed());
    for (const surface of this.terrainSystem.surfaces || []) {
      if (!surface) continue;
      surface.receiveShadows = true;
      if (surface.metadata && surface.metadata.shadowAlways) this.addShadowCaster(surface);
    }
    this.refreshShadowReach(true);
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
    this.gameCursor.setEnabled(this.options.customCursor);
    this.glowSystem.setEnabled(this.options.fireGlow);
    const grassDensity = this.floraSystem.density;
    const fernMode = this.options.grassFern === 'detail' ? 'detail' : 'light';
    const fernChanged = this.fernMode !== fernMode;
    this.fernMode = fernMode;
    this.floraSystem.setDensity(this.options.grass);
    if (this.floraSystem.density !== grassDensity) this.refreshReflectionExclusions();
    if (fernChanged && this.grassModelList) this.rebuildGrass();
    const groundBlend = this.options.groundBlend !== false;
    const blendChanged = this.groundBlend !== groundBlend;
    this.groundBlend = groundBlend;
    this.terrainSystem.setGroundBlend(groundBlend);
    if (blendChanged && this.grassModelList) this.rebuildGrass();
    this.waterSystem.setDetail(this.options.waterDetail);
    if (this.isLoading) return;
    this.audioSystem.setMasterVolume(this.options.sfxVolume / 100);
    this.audioSystem.setAmbientVolume(this.options.ambientVolume / 100);
    this.audioSystem.setMusicVolume(this.options.musicVolume / 100);
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
    this.creatureSystem.configure(map && map.dayNight ? map.dayNight.dayLengthSeconds : null);
    this.simSystem.subscribe((tick) => {
      this.updateHarvestRespawns();
      this.creatureSystem.tick(tick, this.simSystem.time);
      this.playerStats.tick(tick, this.playerSystem.sprinting);
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
    this.clockText = `${hh}:${mm}`;
    this.hud.setClockText(this.clockText);
    this.hud.setClockPhase(this.describeDayPhase(time, cfg));
    this.hud.setClockSpeed(this.simSystem.speed, this.paused || this.simSystem.halted);
    if (this.characterWindow.open) this.refreshCharacterWindow();
  }

  refreshAmbient(dt = 0) {
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
    this.updateIndoor(dt);
  }

  updateIndoor(dt) {
    const root = this.playerSystem ? this.playerSystem.root : null;
    const level = this.playerSystem ? this.playerSystem.level : 0;
    const under = root ? this.isUnderRoof(root.position.x, root.position.z, level) : false;
    const target = under ? 1 : 0;
    const step = Math.min(1, Math.max(0, dt) / INDOOR_FADE_SECONDS);
    this.indoor = (this.indoor || 0) + (target - (this.indoor || 0)) * step;
    if (Math.abs(target - this.indoor) < 0.001) this.indoor = target;
    this.audioSystem.setIndoor(this.indoor);
    this.updateSurfaceChunks();
  }

  updateSurfaceChunks() {
    const chunks = this.terrainSystem ? this.terrainSystem.surfaceChunks : null;
    if (!chunks || !chunks.length) return;
    const root = this.playerSystem ? this.playerSystem.root : null;
    const level = this.playerSystem ? this.playerSystem.level : 0;
    const under = root ? this.isUnderRoof(root.position.x, root.position.z, level) : false;
    let cx = 0;
    let cz = 0;
    if (root) {
      const cell = worldToCellCoords(root.position.x, root.position.z);
      cx = cell.cx;
      cz = cell.cz;
    }
    for (const mesh of chunks) {
      const meta = mesh.metadata;
      if (!meta || meta.level === undefined) continue;
      let visible = true;
      if (under && meta.overCave && meta.level > level) {
        const near = cx >= meta.minCx - CHUNK_HIDE_RADIUS && cx <= meta.maxCx + CHUNK_HIDE_RADIUS
          && cz >= meta.minCz - CHUNK_HIDE_RADIUS && cz <= meta.maxCz + CHUNK_HIDE_RADIUS;
        if (near) visible = false;
      }
      if (mesh._chunkVisible !== visible) {
        mesh._chunkVisible = visible;
        mesh.setEnabled(visible);
      }
    }
  }

  isUnderRoof(x, z, level = 0) {
    const layout = (this.decoSystem && this.decoSystem.layout) || (this.terrainSystem && this.terrainSystem.layout) || null;
    if (!layout) return false;
    const { cx, cz } = worldToCellCoords(x, z);
    return Number.isFinite(ceilingLiftAt(layout, cx, cz, level));
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
    this.hud.onSave = () => this.doSave();
    this.hud.onLoad = () => this.requestLoad();
    this.hud.mount();
    this.hotbar.mount();
    this.hotbar.onSelect = (key) => this.heldItemSystem.set(key);
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.bagButton.onClick = () => this.toggleInventoryWindow();
    this.characterButton.onClick = () => this.toggleCharacterWindow();
    this.bagButton.mount();
    this.characterButton.mount();
    this.inventoryWindow.onClose = () => this.bagButton.setActive(false);
    this.characterWindow.onClose = () => this.characterButton.setActive(false);
    this.vitalsBar.setHealth(this.playerStats.health, this.playerStats.maxHealth);
    this.vitalsBar.setStamina(this.playerStats.stamina, this.playerStats.maxStamina);
    this.creatureHealthBar.mount();
    this.log.mount();
    this.hoverHint.mount();
    this.deathScreen.onRespawn = () => this.respawnPlayer();
    this.deathScreen.mount();
    this.inventoryWindow.update(this.inventorySystem);
    this.refreshClock();
  }

  toggleInventoryWindow() {
    const open = !this.inventoryWindow.open;
    this.closeOpenWindows();
    if (!open) return;
    this.inventoryWindow.update(this.inventorySystem);
    this.inventoryWindow.show();
    this.bagButton.setActive(true);
  }

  toggleCharacterWindow() {
    const open = !this.characterWindow.open;
    this.closeOpenWindows();
    if (!open) return;
    this.refreshCharacterWindow();
    this.characterWindow.show();
    this.characterButton.setActive(true);
  }

  closeOpenWindows() {
    let closed = false;
    if (this.inventoryWindow.open) {
      this.inventoryWindow.close();
      closed = true;
    }
    if (this.characterWindow.open) {
      this.characterWindow.close();
      closed = true;
    }
    return closed;
  }

  refreshCharacterWindow() {
    const root = this.playerSystem.root;
    const carrying = Object.values(this.inventorySystem.items || {})
      .reduce((sum, count) => sum + (Number(count) || 0), 0);
    let cell = '—';
    if (root) {
      const coords = worldToCellCoords(root.position.x, root.position.z);
      cell = `${coords.cx}, ${coords.cz}`;
    }
    this.characterWindow.update({
      health: `${Math.ceil(this.playerStats.health)} / ${this.playerStats.maxHealth}`,
      stamina: `${Math.ceil(this.playerStats.stamina)} / ${this.playerStats.maxStamina}`,
      cell,
      height: root ? metersText(root.position.y) : '—',
      carrying,
      clock: this.clockText || '—',
    });
  }

  logGain(yields) {
    const parts = yields.map(({ itemKey, amount }) => {
      const def = ITEM_TYPES[itemKey];
      return `+${amount} ${itemIcon(itemKey)} ${def ? def.displayName : itemKey}`;
    });
    if (parts.length) this.log.add(parts.join('   '), 'gain');
  }

  onHeldItemChange() {
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.playerSystem.setHeldTool(this.heldItemSystem.key);
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gridSystem.hideHologram();
    this.setPointerCursorState();
  }

  setupInput() {
    this.inputSystem.suppressContextMenu(this.canvas);
    this.inputSystem.groundPredicate = (mesh) => mesh === this.terrainSystem.ground;
    this.inputSystem.groundHeightAt = (x, z) => this.terrainSystem.walkHeightAt(x, z, this.editor.active ? 0 : this.playerSystem.level);
    this.inputSystem.shouldPickByRay = () => this.editor.active && this.editor.mapMode === 'area';
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
      this.refreshShadowDepth();
    };
    this.registerInteractions();
  }

  setupSave() {
    this.playerSystem.walkableCells = () => this.terrainSystem.realCells || [];
    this.registerSavedState(this.playerSystem, 'player', 5);
    this.registerSavedState(this.heldItemSystem, 'heldItem', 7);
    this.registerSavedState(this.playerStats, 'playerStats', 8);
    this.registerSavedState(this.campfireSystem, 'campfires', 12);
    this.registerSavedState(this.fellingSystem, 'felling', 14);
    this.registerSavedState(this.harvestSystem, 'harvest', 15);
    this.registerSavedState(this.creatureSystem, 'creatures', 16);
    this.registerSavedState(this.dayNightSystem, 'dayNight', 20);
    this.registerSavedState(this.simSystem, 'sim', 25);
    this.saveSystem.register(this.inventorySystem, 'inventory', {
      serialize: () => this.inventorySystem.serialize(),
      apply: (data) => {
        this.inventorySystem.apply(data);
        this.inventoryWindow.update(this.inventorySystem);
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
      if (!this.editor.active) this.pauseScreen.show();
      this.hoverHint.hide();
    } else {
      this.pauseScreen.hide();
      this.simSystem.resetAccumulator();
    }
    if (this.editor.hud) this.editor.hud.setPaused(paused);
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

  syncZoomLimit() {
    this.cameraSystem.setMaxZoom(this.editor.active ? EDITOR_ZOOM_MAX : PLAYER_ZOOM_MAX);
    this.refreshShadowDepth();
  }

  refreshShadowDepth() {
    if (!this.shadowGenerator || !this.camera) return;
    const range = this.cameraSystem.viewDepthRange();
    if (this.shadowGenerator instanceof CascadedShadowGenerator) {
      const span = this.camera.maxZ - this.camera.minZ;
      this.shadowGenerator.shadowMaxZ = range.far;
      if (span > 0) {
        this.shadowGenerator.setMinMaxDistance(
          (range.near - this.camera.minZ) / span,
          (range.far - this.camera.minZ) / span,
        );
      }
    }
    const soft = this.cameraSystem.zoom > PLAYER_ZOOM_MAX;
    this.shadowGenerator.filteringQuality = soft ? ShadowGenerator.QUALITY_HIGH : ShadowGenerator.QUALITY_MEDIUM;
  }

  holdGameForEditor() {
    if (this.paused) this.pauseScreen.hide();
    if (this.editor.hud) this.editor.hud.setPaused(this.paused);
  }

  releaseGameFromEditor() {
    const root = this.playerSystem.root;
    if (root) this.cameraSystem.snapTo(root.position.x, root.position.z, root.position.y);
    if (!this.paused) return;
    this.pauseScreen.setSpeed(this.simSystem.speed);
    this.pauseScreen.show();
  }

  handleKey(evt) {
    if (!this.loaded) return;
    const typing = evt.target && (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA' || evt.target.isContentEditable);
    if (this.dialog.handleKey(evt)) {
      evt.preventDefault();
      return;
    }
    if (this.dialog.open) {
      evt.preventDefault();
      return;
    }
    if (this.dying) {
      if (evt.key !== 'Enter') evt.preventDefault();
      return;
    }
    if (this.editor.active) {
      this.handleEditorKey(evt, typing);
      return;
    }
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
    if (evt.key === 'Escape' && this.closeOpenWindows()) {
      evt.preventDefault();
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
      this.hud.toggleHelp();
      return;
    }
    if (evt.key === 'F2') {
      evt.preventDefault();
      this.toggleEditorMode();
      return;
    }
    if ((evt.key === 'i' || evt.key === 'I') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleInventoryWindow();
      return;
    }
    if ((evt.key === 'c' || evt.key === 'C') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleCharacterWindow();
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
    if (/^[1-5]$/.test(evt.key)) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      const key = HOTBAR_ITEMS[Number(evt.key) - 1];
      if (!key) return;
      evt.preventDefault();
      if (this.heldItemSystem.key === key) this.heldItemSystem.set(null);
      else this.heldItemSystem.set(key);
      return;
    }
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
    if (evt.key === 'F5') {
      evt.preventDefault();
      this.doSave();
    }
    if (evt.key === 'F9') {
      evt.preventDefault();
      this.requestLoad();
    }
  }

  handleEditorKey(evt, typing) {
    if (evt.key === 'F2') {
      evt.preventDefault();
      this.toggleEditorMode();
      return;
    }
    if (typing && evt.key !== 'Escape') return;
    if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
    if (evt.key === 'p' || evt.key === 'P') {
      evt.preventDefault();
      this.togglePause();
      return;
    }
    if (evt.key === 'Escape') {
      if (this.editor.mapMode === 'area' && this.editor.mode.hasAreaSelection) {
        this.clearAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.editor.mode.hasDraft) {
        this.cancelBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.key === 'Enter') {
      if (this.editor.mapMode === 'area' && this.editor.mode.hasAreaSelection) {
        this.applyAreaSelection();
        evt.preventDefault();
        return;
      }
      if (this.editor.mode.hasDraft) {
        this.applyBrushDraft();
        evt.preventDefault();
      }
      return;
    }
    if (evt.key === 'x' || evt.key === 'X') {
      this.setEraseMode(!this.editor.erasing);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'z' || evt.key === 'Z') {
      this.undoEdit();
      evt.preventDefault();
      return;
    }
    if (evt.key === 'h' || evt.key === 'H') {
      this.editor.mode.setMode(this.editor.mapMode === 'height' ? 'zone' : 'height');
      evt.preventDefault();
      return;
    }
    if (evt.key === 'q' || evt.key === 'Q') {
      this.editor.mode.stepHeightLevel(1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'e' || evt.key === 'E') {
      this.editor.mode.stepHeightLevel(-1);
      evt.preventDefault();
      return;
    }
    if (evt.key === 'r' || evt.key === 'R') {
      if (this.editor.mode.rotateDeco(evt.shiftKey ? -1 : 1)) {
        this.editor.refreshBrushOptions();
        this.handleHover(this.hoverCell);
        evt.preventDefault();
        return;
      }
    }
    if (/^[1-9]$/.test(evt.key)) {
      this.editor.mode.setHeightLevel(HEIGHT_PRESETS[Number(evt.key) - 1]);
      evt.preventDefault();
      return;
    }
    evt.preventDefault();
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

  cellSurfaceAt(cx, cz) {
    const deck = this.terrainSystem.bridgeDeckAt(cx * CELL_SIZE, cz * CELL_SIZE);
    return deck === null ? this.decoSystem.surfaceAt(cx, cz) : deck;
  }

  handleHover(cell) {
    this.hoverCell = cell;
    this.decoHighlight.setHover(cell || null);
    if (!this.editor.active) {
      this.gridSystem.clearHoverCell();
      this.gridSystem.clearCreatureRadius();
      this.gridSystem.hideHologram();
      this.refreshHoverTooltip(cell);
      return;
    }
    this.gridSystem.hideHologram();
    if (!cell) {
      this.editor.clearHoverReadout();
      return;
    }
    const preview = this.editor.mode.decoPreview(cell.cx, cell.cz);
    if (preview) {
      this.gridSystem.showDecorPreview(preview.def, preview.items, cell.cx, cell.cz, this.cellSurfaceAt(cell.cx, cell.cz), 0);
    }
    const mapMode = this.editor.mapMode;
    const hoverSpan = mapMode === 'height' ? this.editor.mode.heightStampSpan : mapMode === 'zone' ? this.editor.mode.brushSpan : 1;
    const hoverSurfaceAt = (cx, cz) => this.cellSurfaceAt(cx, cz);
    const erasing = Boolean(this.editor.mode.eraseKind) || this.editor.erasing;
    this.gridSystem.showHoverCell(cell.cx, cell.cz, hoverSurfaceAt, hoverSpan, erasing);
    this.editor.syncCreatureRadius(cell);
    if (this.editor.mapMode === 'area') {
      this.editor.showAreaPreview(this.editor.mode.getAreaSelection());
      if (this.editor.mode.hasAreaSelection) return;
      this.editor.showAreaHoverReadout(cell);
      return;
    }
    this.editor.showCellHoverReadout(cell);
  }

  refreshHoverTooltip(cell) {
    if (this.creatureTooltipOn) return;
    if (!cell || !this.options.highlights) {
      this.tooltipPanel.hide();
      return;
    }
    const height = this.terrainSystem.walkHeightAt(cell.cx * CELL_SIZE, cell.cz * CELL_SIZE);
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

  cellsOfArea() {
    return this.terrainSystem.realCells || [];
  }

  isWalkableAt(x, z, level = 0) {
    if (level === 0 && this.terrainSystem && this.terrainSystem.bridgeDeckAt(x, z) !== null) return true;
    if (level === 0 && this.waterDepthAt(x, z) > WADE_DEPTH) return false;
    const { cx, cz } = worldToCellCoords(x, z);
    const layout = this.decoSystem.layout || this.terrainSystem.layout || null;
    if (hasFloor(layout, cx, cz, level)) return true;
    if (level !== 0) return false;
    if (!this.areaLookup) {
      this.areaLookup = new Set(this.areaCellsNow().map(([ax, az]) => `${ax},${az}`));
    }
    if (!this.areaLookup.has(`${cx},${cz}`)) return false;
    return this.decoSystem.topAt(cx, cz) < WALK_CLEARANCE;
  }

  connectorLevelMap() {
    const layout = this.decoSystem.layout || this.terrainSystem.layout || {};
    if (this.connectorMap && this.connectorMapFor === layout) return this.connectorMap;
    const map = new Map();
    const levelOf = (end) => (end && Number.isFinite(end.level) ? end.level : 0);
    for (const record of layout.connectors || []) {
      const from = record && record.from;
      const to = record && record.to;
      if (!from || !to) continue;
      const dx = Math.sign(to.cx - from.cx);
      const dz = Math.sign(to.cz - from.cz);
      if (dx === 0 && dz === 0) continue;
      map.set(`${from.cx},${from.cz},${levelOf(from)}|${dx},${dz}`, levelOf(to));
      map.set(`${to.cx},${to.cz},${levelOf(to)}|${-dx},${-dz}`, levelOf(from));
    }
    this.connectorMap = map;
    this.connectorMapFor = layout;
    return map;
  }

  stepLevel(fromX, fromZ, level, toX, toZ) {
    const from = worldToCellCoords(fromX, fromZ);
    const to = worldToCellCoords(toX, toZ);
    if (from.cx === to.cx && from.cz === to.cz) return level;
    const dx = Math.sign(to.cx - from.cx);
    const dz = Math.sign(to.cz - from.cz);
    if (dx !== 0 && dz !== 0) return level;
    const map = this.connectorLevelMap();
    if (!map.size) return level;
    const target = map.get(`${from.cx},${from.cz},${level}|${dx},${dz}`);
    return target !== undefined ? target : level;
  }

  passageCells() {
    const layout = this.decoSystem.layout || this.terrainSystem.layout || {};
    if (this.passageSet && this.passageFor === layout) return this.passageSet;
    const set = new Set();
    for (const record of layout.connectors || []) {
      for (const end of [record && record.from, record && record.to]) {
        if (!end || !Number.isFinite(end.cx) || !Number.isFinite(end.cz)) continue;
        const lv = Number.isFinite(end.level) ? end.level : 0;
        set.add(`${end.cx},${end.cz},${lv}`);
      }
    }
    this.passageSet = set;
    this.passageFor = layout;
    return set;
  }

  isPassageAt(x, z, level = 0) {
    const { cx, cz } = worldToCellCoords(x, z);
    return this.passageCells().has(`${cx},${cz},${level}`);
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
    if (this.terrainSystem && this.terrainSystem.bridgeDeckAt(pos.x, pos.z) !== null) return;
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

  handleCellClick(cell) {
    if (!cell) return;
    if (!this.editor.active) return;
    this.editor.paintCell(cell.cx, cell.cz);
  }

  handleCellRightClick(cell) {
    if (!cell) return;
    if (!this.editor.active) return;
    this.editor.rightClickCell(cell.cx, cell.cz);
    this.handleHover(cell);
  }

  doSave() {
    if (this.dying) return;
    const ok = this.saveSystem.save();
    this.log.add(ok ? 'Hra uložena' : 'Uložení selhalo', ok ? 'info' : 'warn');
    this.dialog.tell({
      title: ok ? 'Uloženo' : 'Uložení selhalo',
      text: ok
        ? 'Hra je uložená. Načíst ji můžeš tlačítkem 📂 Načíst nebo klávesou F9.'
        : 'Uložení se nepodařilo — prohlížeč nepovolil zápis do úložiště.',
    });
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

  requestLoad() {
    if (this.dialog.open) return;
    this.playerSystem.releaseKeys();
    this.dialog.ask({
      title: 'Načíst uloženou hru?',
      text: 'Hra se znovu načte a vrátí se stav z posledního uložení. Co jsi od té doby udělal, se ztratí.',
      confirmLabel: 'Načíst',
      cancelLabel: 'Zrušit',
      onConfirm: () => this.reloadFromSave(),
    });
  }

  loadSaveState() {
    const ok = this.saveSystem.load();
    this.saveHintAfterLoad = ok
      ? { title: 'Načteno', text: 'Hra je obnovená z posledního uložení.' }
      : { title: 'Načtení selhalo', text: 'Uloženou hru nešlo načíst — chybí, nebo je z jiné verze.' };
    this.log.add(ok ? 'Hra načtena' : 'Načtení selhalo', ok ? 'info' : 'warn');
    if (!ok) {
      console.warn('[save] Uloženou hru nešlo načíst — chybí, nebo má jinou verzi.');
      return;
    }
    console.info('[save] Obnoveno:', {
      druhyPredmetu: Object.keys(this.inventorySystem.items || {}).length,
      sebrane: this.harvestSystem.list().length,
      cas: Math.round(this.simSystem.time),
    });
  }

  reloadFromSave() {
    if (!this.saveSystem.hasSave()) {
      this.dialog.tell({
        title: 'Žádný save',
        text: 'Nejdřív hru ulož — tlačítkem 💾 Uložit nebo klávesou F5.',
      });
      return;
    }
    if (!this.saveSystem.markLoadOnStart()) {
      this.dialog.tell({
        title: 'Načtení selhalo',
        text: 'Prohlížeč nepovolil připravit načtení uložené hry.',
      });
      return;
    }
    window.location.reload();
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
      const always = mesh.metadata && mesh.metadata.shadowAlways;
      if (!always) {
        const point = mesh.getAbsolutePosition();
        if (Math.hypot(point.x - centerX, point.z - centerZ) > reach) continue;
      }
      next.push(mesh);
    }
    if (!force && sameMeshes(next, shadowMap.renderList || [])) return;
    shadowMap.renderList = next;
  }


  onResize() {
    this.cameraSystem.onResize();
  }
}

