// Herní scéna — orchestrátor. Drží stav světa, deleguje na systémy a řídí HUD.
// Systémy dostávají scénu v konstruktoru a přistupují k ní přes this.s.
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { FxaaPostProcess } from '@babylonjs/core/PostProcesses/fxaaPostProcess';
import CameraSystem, { ZOOM_MAX as EDITOR_ZOOM_MAX } from '../systems/core/cameraSystem.js';
import GridSystem from '../systems/core/gridSystem.js';
import TerrainSystem from '../systems/terrain/terrainSystem.js';
import WaterSystem from '../systems/water/waterSystem.js';
import FishSystem from '../systems/water/fishSystem.js';
import CrabSystem from '../systems/creatures/crabSystem.js';
import CreatureSystem from '../systems/creatures/creatureSystem.js';
import SkySystem from '../systems/atmosphere/skySystem.js';
import DecoSystem from '../systems/world/decoSystem.js';
import BuildingSystem from '../systems/world/buildingSystem.js';
import { buildingCellKeys } from '../data/catalogs/buildings.js';
import RevealSystem from '../systems/world/revealSystem.js';
import { setNightLight } from '../systems/materials/nightLightPlugin.js';
import SightSystem from '../systems/world/sightSystem.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import FloraSystem from '../systems/flora/floraSystem.js';
import CliffVineSystem from '../systems/terrain/cliffVineSystem.js';
import CaveFrameSystem from '../systems/terrain/caveFrameSystem.js';
import CliffDressSystem from '../systems/terrain/cliffDressSystem.js';
import DecoHighlightSystem from '../systems/world/decoHighlightSystem.js';
import CampfireSystem from '../systems/world/campfireSystem.js';
import LootSystem from '../systems/world/lootSystem.js';
import PickupSparkleSystem from '../systems/world/pickupSparkleSystem.js';
import EquipmentSystem from '../systems/player/equipmentSystem.js';
import DayNightSystem from '../systems/atmosphere/dayNightSystem.js';
import LightingSystem from '../systems/atmosphere/lightingSystem.js';
import FireLightSystem from '../systems/atmosphere/fireLightSystem.js';
import SimSystem from '../systems/core/simSystem.js';
import NavigationSystem, { WADE_DEPTH } from '../systems/core/navigationSystem.js';
import InputSystem from '../systems/core/inputSystem.js';
import PlayerSystem, { STEP_LIMIT, PLAYER_EYE_HEIGHT } from '../systems/player/playerSystem.js';
import PlayerStatsSystem from '../systems/player/playerStatsSystem.js';
import InteractionSystem from '../systems/core/interactionSystem.js';
import PlayerAttackSystem from '../systems/player/playerAttackSystem.js';
import SaveSystem from '../systems/core/saveSystem.js';
import MainMenu from '../ui/mainMenu.js';
import MenuBackdrop from '../ui/menuBackdrop.js';
import SaveSlotsWindow from '../ui/saveSlotsWindow.js';
import GatherSystem from '../systems/gathering/gatherSystem.js';
import FellingSystem from '../systems/gathering/fellingSystem.js';
import HarvestSystem from '../systems/gathering/harvestSystem.js';
import FootprintSystem from '../systems/creatures/footprintSystem.js';
import SandBurstSystem from '../systems/creatures/sandBurstSystem.js';
import InventorySystem from '../systems/player/inventorySystem.js';
import RecipeBookSystem from '../systems/player/recipeBookSystem.js';
import HeldItemSystem from '../systems/player/heldItemSystem.js';
import PortraitSystem from '../systems/player/portraitSystem.js';
import WaveSpraySystem from '../systems/water/waveSpraySystem.js';
import AudioSystem from '../systems/atmosphere/audioSystem.js';
import CharacterPanel from '../ui/characterPanel.js';
import LootWindow from '../ui/lootWindow.js';
import LogPanel from '../ui/logPanel.js';
import ToastNotices from '../ui/toastNotices.js';
import FloatingNumbers from '../ui/floatingNumbers.js';
import { itemIcon } from '../ui/itemIcons.js';
import Hud from '../ui/hud.js';
import GameCursor from '../ui/gameCursor.js';
import Hotbar from '../ui/hotbar.js';
import VitalsBar from '../ui/vitalsBar.js';
import XpBar from '../ui/xpBar.js';
import HoverHint from '../ui/hoverHint.js';
import CreatureHealthBar from '../ui/creatureHealthBar.js';
import PlayerOverheadBars from '../ui/playerOverheadBars.js';
import DockButton from '../ui/dockButton.js';
import MapEditor from '../editor/mapEditor.js';
import EditorToggle from '../editor/editorToggle.js';
import PauseScreen from '../ui/pauseScreen.js';
import DeathScreen from '../ui/deathScreen.js';
import Dialog from '../ui/dialog.js';
import LoadingScreen from '../ui/loadingScreen.js';
import TooltipPanel from '../ui/tooltipPanel.js';
import CreaturePanel from '../ui/creaturePanel.js';
import BestiaryWindow from '../ui/bestiaryWindow.js';
import CraftingWindow from '../ui/craftingWindow.js';
import JournalWindow from '../ui/journalWindow.js';
import BestiarySystem from '../systems/creatures/bestiarySystem.js';
import { takeModelError, preloadModel, loadContainer, loadImported } from '../utils/assetLoader.js';
import { WAVE_TIME_WRAP, SEA_DIRECTION } from '../utils/waterWaves.js';
import { ITEM_TYPES, RECIPE_STATIONS, barEntry, getTool, itemFood, toolForItem } from '../data/catalogs/items.js';
import { worldToCellCoords, CELL_SIZE } from '../utils/gridMath.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { collectStartupUrls, CREATURE_MODEL_URLS, PLAYER_ASSET_URLS } from '../data/catalogs/modelCatalog.js';
import { describeWorld } from '../data/catalogs/worldStages.js';
import { getDecoration } from '../data/catalogs/decorations.js';
import { CRAB } from '../data/catalogs/crabs.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { NO_FLOOR_PICK_HEIGHT } from './sceneSettings.js';
import { mergeSavedOptions, OPTIONS_STORAGE_KEY, QUALITY_SCALES } from '../data/catalogs/optionsSchema.js';
import OptionsPanel from '../ui/optionsPanel.js';
import BusyNotice from '../ui/busyNotice.js';
import { WATER_STEP_DEPTH } from './sceneSettings.js';
import sceneWorldParts from './sceneWorld.js';
import sceneCombatParts from './sceneCombat.js';
import sceneGatheringParts from './sceneGathering.js';
import sceneStepsParts from './sceneSteps.js';
import sceneEquipmentParts from './sceneEquipment.js';
import sceneCraftingParts from './sceneCrafting.js';
import sceneFoodParts from './sceneFood.js';
import sceneProgressParts from './sceneProgress.js';
import sceneSaveParts from './sceneSave.js';
import sceneReloadParts from './sceneReload.js';

const LOADING_DRAW_MS = 500;

const AUTOTUNE_WINDOW_MS = 2000;
const AUTOTUNE_LOW_FPS = 45;
const AUTOTUNE_HIGH_FPS = 57;
const AUTOTUNE_MIN_SCALE = 0.7;
const AUTOTUNE_STEP = 0.1;
const INDOOR_FADE_SECONDS = 2;
const CAVE_DECO_REFRESH_SECONDS = 1;
const SHELF_GRASS_CLEAR = 0.6;
const DECK_ABOVE_GROUND = 0.05;
const PEEK_PICK_THROUGH = 0.5;
const EDITOR_PEEK_RADIUS = 3;
const DOOR_SHUT_LEAD = 0.24;
const WADE_SPEED = 0.65;
const WADE_RAMP = 0.2;
const WATER_SOUND_SECONDS = 0.15;
const MAX_STEP_SECONDS = 0.1;
const SHADOW_REACH_STEP = 0.2;
const EDITOR_CAM_SPEED = 12;
const EDITOR_CAM_SPRINT = 32;
const PLAYER_ZOOM_MAX = 22;
const TIME_SKIP = { hours: 4 };
const AMBIENT_TIME_STEP = 0.0005;

const LEFT_CLICK_PREFIX = 'Levé tlačítko — ';

function leftAction(detail) {
  const text = String(detail || '').replace(LEFT_CLICK_PREFIX, '');
  return text ? `${text.charAt(0).toLocaleUpperCase('cs')}${text.slice(1)}` : null;
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

    this.cameraSystem = new CameraSystem(scene);
    this.gridSystem = new GridSystem(scene);
    this.terrainSystem = new TerrainSystem(scene);
    this.terrainSystem.waterLevelAtCell = (cx, cz) => this.waterLevelAtCell(cx, cz);
    this.bodyCache = null;
    this.decorShaping = false;
    this.decorStale = null;
    this.decorHidden = false;
    this.revealSystem = new RevealSystem(scene);
    this.sightSystem = new SightSystem(scene);
    this.sightSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z, 0);
    this.revealSystem.rockHeightAt = (x, z) => this.rockHeightAt(x, z);
    this.waterSystem = new WaterSystem(scene);
    this.waveSpray = new WaveSpraySystem(scene);
    this.fishSystem = new FishSystem(scene);
    this.fishSystem.onSchoolsChanged = () => this.refreshReflectionExclusions();
    this.crabSystem = new CrabSystem(scene);
    this.crabSystem.onReady = () => this.refreshReflectionExclusions();
    this.crabSystem.onBurst = (x, y, z, scale, seconds) => this.sandBursts.burst(x, y, z, scale, seconds);
    this.creatureSystem = new CreatureSystem(scene);
    this.skySystem = new SkySystem(scene);
    this.decoSystem = new DecoSystem(scene);
    this.decoSystem.groundHeightAt = (x, z, level = 0) => this.terrainSystem.heightAt(x, z, level);
    this.buildingSystem = new BuildingSystem(scene);
    this.buildingSystem.groundHeightAt = (x, z) => this.terrainSystem.heightAt(x, z, 0);
    this.buildingSystem.onMesh = (mesh) => this.addShadowCaster(mesh);
    this.buildingSystem.doorShutLead = DOOR_SHUT_LEAD;
    this.buildingSystem.onDoorShut = () => this.audioSystem.play('doorClose');
    this.floraSystem = new FloraSystem(scene);
    this.cliffVineSystem = new CliffVineSystem(scene);
    this.caveFrameSystem = new CaveFrameSystem(scene);
    this.cliffDressSystem = new CliffDressSystem(scene);
    this.caveDressSystem = new CliffDressSystem(scene);
    this.campfireSystem = new CampfireSystem(scene);
    this.lootSystem = new LootSystem(scene);
    this.equipmentSystem = new EquipmentSystem();
    this.lootPickup = null;
    this.meal = null;
    this.decoHighlight = new DecoHighlightSystem(scene);
    this.decoHighlight.levelOf = () => this.gatherSystem.levelOf();
    this.decoHighlight.playerAt = () => (this.editor.active || !this.playerSystem.root ? null : this.playerSystem.root.position);
    this.decoHighlight.isEmptied = (cx, cz, level) => {
      const box = this.lootSystem.at(cx, cz, level);
      return Boolean(box) && this.lootSystem.isEmpty(box);
    };
    this.pickupSparkles = new PickupSparkleSystem(scene);
    this.dayNightSystem = new DayNightSystem(scene);
    this.lighting = new LightingSystem(scene);
    this.fireLights = new FireLightSystem(scene);
    this.simSystem = new SimSystem(scene);
    this.navigation = new NavigationSystem(scene);
    this.navigation.layoutOf = () => this.decoSystem.layout || this.terrainSystem.layout || null;
    this.navigation.connectorsOf = () => {
      const layout = this.navigation.layout() || {};
      return this.terrainSystem.movementConnectors || layout.connectors || [];
    };
    this.navigation.bridgeDeckAt = (x, z) => this.terrainSystem.bridgeDeckAt(x, z);
    this.navigation.waterDepthAt = (x, z) => this.waterDepthAt(x, z);
    this.navigation.topAt = (cx, cz) => this.decoSystem.topAt(cx, cz);
    this.navigation.wallRiseAt = (x, z, radius, level) => this.terrainSystem.riseNear(x, z, radius, level, this.standHeightAt(x, z, level));
    this.navigation.cliffOverlapAt = (x, z, level) => (this.onBuildingDeck(x, z, level) ? -Infinity : this.terrainSystem.cliffOverlap(x, z, level));
    this.navigation.buildingGapAt = (x, z, feetY, level) => ((level || 0) === 0 ? this.buildingSystem.wallGapAt(x, z, feetY) : Infinity);
    this.navigation.objectGapAt = (x, z, radius, level) => {
      const contact = this.decoSystem.nearestContact(x, z, radius, 0, level);
      return contact ? contact.gap : Infinity;
    };
    this.navigation.stepLimit = STEP_LIMIT;
    this.inputSystem = new InputSystem(scene, this);
    this.playerSystem = new PlayerSystem(scene);
    const fireSource = (source, on) => (on ? this.fireLights.add(source) : this.fireLights.remove(source));
    this.campfireSystem.onLightSource = fireSource;
    this.buildingSystem.onLightSource = fireSource;
    this.playerSystem.onLightSource = fireSource;
    this.fireLights.castersNear = (source) => this.fireCastersNear(source);
    this.playerStats = new PlayerStatsSystem();
    this.playerAttackSystem = new PlayerAttackSystem();
    this.playerAttackSystem.groundHeightAt = (x, z, level) => this.terrainSystem.walkHeightAt(x, z, Number.isFinite(level) ? level : this.playerSystem.level);
    this.playerAttackSystem.candidates = () => this.attackCandidates();
    this.playerAttackSystem.onHit = (creature, amount, crit, graze, absorbed, detail) => this.damageCreature(creature, amount, crit, graze, absorbed, detail);
    this.playerAttackSystem.onWhiff = () => this.audioSystem.play('miss');
    this.playerAttackSystem.onMiss = (creature) => this.missCreature(creature);
    this.interaction = new InteractionSystem(scene);
    this.gatherSystem = new GatherSystem(scene);
    this.gatherSystem.decoSystem = this.decoSystem;
    this.gatherSystem.levelOf = () => (this.editor.active ? 0 : this.playerSystem.level);
    this.gatherSystem.onTopple = () => this.audioSystem.play('fall');
    this.gatherSystem.onFell = (item) => this.finishFelling(item);
    this.fellingSystem = new FellingSystem(scene);
    this.harvestSystem = new HarvestSystem(scene);
    this.footprintSystem = new FootprintSystem(scene);
    this.sandBursts = new SandBurstSystem(scene);
    this.audioSystem = new AudioSystem(scene);
    this.inventorySystem = new InventorySystem();
    this.recipeBook = new RecipeBookSystem();
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.tooltipPanel = new TooltipPanel();
    this.creaturePanel = new CreaturePanel();
    this.creaturePanel.onClose = () => this.dismissCreaturePanel();
    this.pinnedCreature = null;
    this.combatFocus = null;
    this.mutedFocus = null;
    this.focusShown = false;
    this.focusSeenAt = 0;
    this.bestiary = new BestiarySystem();
    this.hotbar = new Hotbar();
    this.bagButton = new DockButton({ icon: '🎒', label: 'Postava a batoh', key: 'I', slot: 'bag' });
    this.bestiaryButton = new DockButton({ icon: '📖', label: 'Bestiář', key: 'B', slot: 'bestiary' });
    this.bestiaryWindow = new BestiaryWindow();
    this.journalButton = new DockButton({ icon: '📜', label: 'Deník', key: 'J', slot: 'journal' });
    this.journalWindow = new JournalWindow();
    this.craftButton = new DockButton({ icon: '🔨', label: 'Výroba', key: 'V', slot: 'craft' });
    this.craftingWindow = new CraftingWindow();
    this.cookingWindow = new CraftingWindow({ id: 'hud-cooking', closeTitle: 'Zavřít', ...RECIPE_STATIONS.fire });
    this.craftJob = null;
    this.log = new LogPanel();
    this.toasts = new ToastNotices();
    this.characterPanel = new CharacterPanel();
    this.portraitSystem = new PortraitSystem(scene);
    this.portraitSystem.onLightOn = () => this.portraitLightOn();
    this.portraitSystem.onLightOff = () => this.portraitLightOff();
    this.portraitLight = null;
    this.lootWindow = new LootWindow();
    this.lootSource = null;
    this.vitalsBar = new VitalsBar();
    this.xpBar = new XpBar();
    this.hoverHint = new HoverHint();
    this.creatureHealthBar = new CreatureHealthBar();
    this.playerOverheadBars = new PlayerOverheadBars();
    this.floatingNumbers = new FloatingNumbers();
    this.walkStepLimit = STEP_LIMIT;
    this.editor = new MapEditor(this);
    this.optionsPanel = new OptionsPanel();
    this.busyNotice = new BusyNotice();
    this.editorToggle = new EditorToggle();
    this.pauseScreen = new PauseScreen();
    this.deathScreen = new DeathScreen();
    this.dialog = new Dialog();
    this.paused = false;
    this.optionsPaused = false;
    this.dying = false;
    this.deathTimer = 0;
    this.deathShown = false;
    this.loader = new LoadingScreen();
    this.loader.onHiddenCallback = () => this.onLoadingHidden();
    this.isLoading = true;
    this.loadingDrawnAt = 0;
    this.loaded = false;
    this.saveHintAfterLoad = null;
    this.autosaveTimer = 0;
    this.menuBackdrop = new MenuBackdrop();
    this.mainMenu = new MainMenu();
    this.saveSlots = new SaveSlotsWindow();
    this.menuKeyHandler = null;
    this.gameStarted = false;
    this.pendingLoadSlot = null;
    this.reloadingSave = false;
    this.warmedItems = new Set();
    this.warmQueue = [];
    this.warmRunning = null;
    this.defaultMaxFPS = undefined;
    this.options = mergeSavedOptions(readJSON(OPTIONS_STORAGE_KEY));
    this.renderScale = 1;
    this.autoScale = 1;
    this.autoWindowStart = 0;
    this.autoWindowFrames = 0;
    this.shadowClock = 0;
    this.camera = null;
    this.fxaa = null;
    this.heldItemSystem = new HeldItemSystem();
    this.heldItemSystem.onChange = () => this.onHeldItemChange();
    this.heldItemSystem.onBarChange = (bar) => {
      this.hotbar.setSlots(bar);
      for (const key of bar) if (key) this.playerSystem.prefetchTool(key);
    };
    this.playerSystem.onStep = (x, z, sprint) => this.onPlayerStep(x, z, sprint);
    this.playerSystem.onFootPlant = (x, z, facing, side, sprint) => this.footfall(x, z, facing, 1, 'human', sprint ? 1.25 : 1, side === 'left');
    this.creatureSystem.onFootPlant = (creature, x, z) => this.onCreatureFoot(creature, x, z);
    this.creatureSystem.onDig = (creature) => this.onCreatureDig(creature);
    this.playerStats.onChange = (health, maxHealth) => this.vitalsBar.setHealth(health, maxHealth);
    this.playerStats.onStamina = (stamina, maxStamina) => this.vitalsBar.setStamina(stamina, maxStamina);
    this.playerStats.onExhausted = () => this.audioSystem.play('outOfBreath');
    this.playerStats.onProgress = () => this.refreshProgress();
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
    this.waterSoundClock = 0;
    this.creaturePickAt = 0;
    this.creatureTooltipOn = false;
    this.creatureLayoutKey = null;
  }

  start() {
    this.wireSaveSlots();
    const slot = this.saveSystem.consumeLoadOnStart();
    if (slot) this.beginGame(slot);
    else this.showMainMenu();
  }

  beginGame(slot) {
    if (this.gameStarted) return;
    this.gameStarted = true;
    this.pendingLoadSlot = slot || null;
    this.loader.useBackdrop(this.menuBackdrop);
    const urls = collectStartupUrls(this.heldItemSystem.key);
    this.loader.plan(urls.length);
    this.closeMainMenu();
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
    this.campfireSystem.igniteBusy = () => this.playerSystem.igniteImpactAt > 0;
    this.campfireSystem.onIgnite = () => {
      this.audioSystem.play('ignite');
      this.log.add('Táborák zapálen', 'action');
    };
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
    await this.setupTerrain();
    if (takeModelError()) console.warn('[start] Některé modely se nepodařilo načíst — hra pokračuje bez nich.');
    const stages = describeWorld(this.mapFile || {});
    this.loader.beginWorld(stages.length);
    this.wireDecoReady();
    this.decoHighlight.clear();
    const map = getMap(this.mapKey);
    if (stages.length) {
      this.decoSystem.beginStages(this.mapFile, map.colors);
      this.decoSystem.buildPath();
    } else {
      this.decoSystem.create(this.mapFile, map.colors);
    }
    this.buildBuildings();
    this.setupDecorations();
    this.setupSimulation();
    this.setupHud();
    this.setupOptions();
    this.setupInput();
    this.setupEditorToggle();
    this.registerHudEvents();
    this.loader.logPhase('Stavby, simulace a rozhraní');

    this.s.onBeforeRenderObservable.add(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_STEP_SECONDS);
      this.shadowClock += dt;
      if (this.shadowClock >= SHADOW_REACH_STEP) {
        this.shadowClock = 0;
        this.refreshShadowReach();
        this.cliffVineSystem.updateView(this.viewCircle());
        this.cliffDressSystem.updateView(this.viewCircle());
        this.caveDressSystem.updateView(this.viewCircle());
        if (!this.isLoading) this.decoSystem.updateView(this.viewCircle());
        if (this.loaded) this.refreshCreatureSight();
      }
      this.refreshCreatureHealthBars();
      this.refreshPlayerOverheadBars();
      this.refreshPinnedCreature();
      this.refreshMouseHint();
      this.portraitSystem.update(this.playerSystem.root, this.playerSystem.anims.idle, this.playerSystem.handSlot);
      this.updateReveal(dt);
      this.updateBuildingInside(dt);
      this.fireLights.update(dt, this.fireFocus());
      this.setDecorShaping(this.editor.shapesTerrain());
      if (this.paused || this.decorShaping) {
        if (this.editor.active) {
          this.pickupSparkles.clear();
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
      if (!this.simSystem.halted) {
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
      this.sandBursts.update(dt);
      this.updateGathering(dt);
      this.updateMeal(dt);
      this.updatePlayerAttack(dt);
      const root = this.playerSystem.root;
      this.campfireSystem.update(dt, root, this.playerSystem.level);
      this.updateCrafting(dt);
      this.lootSystem.update(dt, root, this.playerSystem.level);
      this.buildingSystem.updateInteractive(dt);
      this.waterSystem.update(dt);
      this.updateWaveSpray();
      this.fishSystem.update(dt);
      this.crabSystem.update(dt);
      this.updateWaterCaustics();
      this.updateCampfireSound();
      this.updateWaterSound(dt);
      if (root) {
        if (this.editor.active) this.updateEditorCamera(dt);
        else this.cameraSystem.follow(root.position.x, root.position.z, root.position.y, dt);
      }
      if (this.editor.active) {
        this.editor.updateHeightLabels();
        this.editor.followCreatureMarks(dt);
      }
      this.autoTune(dt);
      this.updateAutosave(dt);
      this.audioSystem.update(dt);
      this.playerSystem.updateFire();
      this.refreshClock();
    });

    this.engine.runRenderLoop(() => {
      if (this.shouldDrawFrame()) this.s.render();
    });
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.refreshInventory();
    await this.prepareGame();
  }

  shouldDrawFrame() {
    if (!this.isLoading || this.loader.allDone) return true;
    const now = performance.now();
    if (now - this.loadingDrawnAt < LOADING_DRAW_MS) return false;
    this.loadingDrawnAt = now;
    return true;
  }

  async prepareGame() {
    await this.buildWorld();
    this.refreshShadowCasters();
    this.saveSystem.dropLegacy();
    this.setupSave();
    if (this.pendingLoadSlot) this.loadSaveState(this.pendingLoadSlot);
    this.gainXp(350);
    this.loader.beginFloat('Budím postavu…');
    await this.setupPlayer();
    this.loader.floatProgress(1, 1, 'Balím výbavu…');
    await this.warmOwnedItems();
    await this.setupCreatures();
    this.loader.floatProgress(1, 1, 'Seju trávu…');
    this.grassModelList = await this.loadGrassModels();
    this.floraSystem.create(this.decoSystem, this.options.grass, () => this.viewCircle(), this.grassModelList, this.grassLook());
    this.sowAnchoredGrass();
    this.floraSystem.updateView(this.viewCircle());
    this.refreshReflectionExclusions();
    this.loader.floatProgress(1, 1, 'Nastavuji stíny…');
    this.refreshShadowCasters();
    this.loader.endFloat();
    await this.waitForWorld();
    this.s.loaded = true;
  }

  onLoadingHidden() {
    if (!this.isLoading) return;
    this.isLoading = false;
    this.loaded = true;
    this.s.loaded = true;
    this.s.paused = false;
    this.optionsPanel.setButtonVisible(true);
    this.toasts.release();
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

  viewLevel() {
    if (!this.editor.active) return this.playerSystem.level;
    return this.editor.mode.undergroundView ? this.editor.mode.floorLevel : 0;
  }

  listener() {
    const root = this.playerSystem.root;
    if (root && !this.editor.active) return { x: root.position.x, z: root.position.z, level: this.playerSystem.level };
    const center = this.cameraSystem.viewCenter();
    return { x: center.x, z: center.z, level: this.viewLevel() };
  }

  updateCampfireSound() {
    const ear = this.listener();
    const burning = this.campfireSystem.nearestBurning(ear.x, ear.z, ear.level);
    this.audioSystem.setFire(burning !== null, burning ? burning.distance : Infinity);
  }

  updateWaterSound(dt) {
    this.waterSoundClock += dt;
    if (this.waterSoundClock < WATER_SOUND_SECONDS) return;
    this.waterSoundClock = 0;
    const ear = this.listener();
    this.audioSystem.setWaterDistances(this.waterSystem.waterDistancesAt(ear.x, ear.z));
  }

  updateWaterCaustics() {
    const water = this.waterSystem;
    const sun = this.dayNightSystem ? this.dayNightSystem.sunLight : null;
    const level = water && Number.isFinite(water.level) && !water.hidden ? water.surfaceY : null;
    const wetLevel = water && Number.isFinite(water.level) ? water.level : null;
    this.terrainSystem.updateWetLevel(wetLevel);
    const bodiesShown = water && !water.hidden && water.bodies.length > 0;
    if (!water || !sun || (level === null && !bodiesShown)) {
      this.terrainSystem.updateCaustics(0, null, 0, 0, null, 0, 0);
      return;
    }
    const dirX = water.seaDir ? water.seaDir.x : SEA_DIRECTION[0];
    const dirZ = water.seaDir ? water.seaDir.y : SEA_DIRECTION[1];
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
    const entry = pointer ? this.gatherSystem.itemAtCell(pointer.cx, pointer.cz, pointer.point) : null;
    const tool = this.heldItemSystem.tool();
    if (!entry || entry.def.byHand || !tool || !tool.harvest || !tool.harvest.kinds.includes(entry.def.kind)) {
      this.gameCursor.setState('default');
      return;
    }
    this.gameCursor.setState(entry.def.kind === 'rock' ? 'mine' : 'chop');
  }

  followPointer() {
    const now = performance.now();
    const moved = this.inputSystem.takeMoved();
    if (!this.inputSystem.pointerInside()) {
      this.pointerAction = null;
      this.decoHighlight.setHover(null);
      this.creatureSystem.clearHover();
      this.crabSystem.clearHover();
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
        this.pointerAction = { kind: 'creature' };
        this.decoHighlight.setHover(null);
        this.crabSystem.clearHover();
        this.showCreatureTooltip(creature);
        this.setHoverHint({ inReach: true, detail: this.hitChanceText(creature) });
        this.gameCursor.setState(this.editor.active ? 'default' : 'attack');
        return;
      }
      const corpse = this.creatureSystem.corpseAt(this.s.pointerX, this.s.pointerY);
      if (corpse) {
        this.pointerAction = { kind: 'corpse', left: 'Prohledat tělo' };
        this.decoHighlight.setHover(null);
        this.crabSystem.clearHover();
        this.showCorpseTooltip(corpse);
        this.setHoverHint(null);
        this.gameCursor.setState('default');
        return;
      }
      if (this.crabSystem.hoverAt(this.s.pointerX, this.s.pointerY)) {
        this.pointerAction = null;
        this.decoHighlight.setHover(null);
        this.creatureTooltipOn = true;
        this.tooltipPanel.show(CRAB.displayName, CRAB.description);
        this.setHoverHint(null);
        this.gameCursor.setState('default');
        return;
      }
      this.hideCreatureTooltip();
      this.setPointerCursorState();
      const target = this.hintTarget(this.inputSystem.cellAtPointer());
      this.pointerAction = target && target.inReach ? { kind: 'target', left: leftAction(target.detail) } : null;
      this.setHoverHint(target);
    }
    if (!moved) return;
    const pointer = this.inputSystem.lastCell;
    if (pointer && this.decoHighlight.hasEntry(pointer.cx, pointer.cz)) {
      this.hoverDeco(pointer);
      this.setPointerCursorState();
      return;
    }
    this.hoverDeco(this.pointedCell(this.inputSystem.cellAtPointer()));
    this.setPointerCursorState();
  }

  hintTarget(cell) {
    for (const id of ['gather', 'loot', 'door', 'station', 'campfire']) {
      const target = this.interaction.targetOf(id, { cell });
      if (target) return target;
    }
    return null;
  }

  refreshMouseHint() {
    if (!this.loaded || this.editor.active || this.dying || this.paused) {
      this.tooltipPanel.setMouse(null);
      return;
    }
    const action = this.pointerAction || null;
    const stance = this.playerSystem.weaponDrawn;
    const pin = action && action.kind === 'creature' ? { text: 'Připnout tvora' } : null;
    if (stance) {
      const attack = this.playerAttackSystem;
      const blow = (kind, name) => {
        const cost = attack.blow(kind).cost;
        return { text: `${name} · ${Math.round(cost)} energie`, off: !this.playerStats.canSpend(cost) };
      };
      this.tooltipPanel.setMouse({
        left: blow('primary', 'Rána'),
        right: blow('secondary', 'Silná rána'),
        middle: pin,
        keys: [['Mezerník', 'úskok'], ['X', 'zandat']],
      });
      return;
    }
    const left = !action ? null
      : action.kind === 'creature' ? { text: 'Útok' }
        : action.left ? { text: action.left } : null;
    const armed = Boolean(this.equipmentSystem.get('weapon'));
    this.tooltipPanel.setMouse({
      left,
      right: null,
      middle: pin,
      keys: [['X', armed ? 'tasit zbraň' : 'bojový postoj']],
    });
  }

  setHoverHint(target) {
    this.buildingSystem.setHover(target && (target.id === 'door' || target.id === 'station') && !this.editor.active ? target.ref : null);
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
    const detail = names.length ? `Kořist: ${names.join(' a ')}` : 'Mrtvý tvor';
    this.tooltipPanel.show(`${corpse.type.label} (mrtvá)`, detail);
  }

  handleLeftDown() {
    if (!this.loaded || this.editor.active) return;
    if (this.playerSystem.lying || this.dying) return;
    if (this.campfireSystem.pending) {
      this.cancelCampfireIgnite();
      return;
    }
    const target = this.interactionTarget();
    if (this.playerSystem.weaponDrawn && (!target || target.id === 'creature')) {
      this.attackToward(target ? target.ref : null);
      return;
    }
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
      act: (target) => this.attackToward(target.ref),
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
        const item = cell ? this.gatherSystem.itemAtCell(cell.cx, cell.cz, cell.point) : null;
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
        if (!cell) return null;
        const onCell = (fire) => fire && fire.cx === cell.cx && fire.cz === cell.cz;
        const burning = this.campfireSystem.burning;
        if (onCell(burning)) return { ref: burning.entry, cook: burning, detail: 'Levé tlačítko — vařit u Táboráku', inReach: true };
        const fire = this.campfireSystem.nearest;
        if (!onCell(fire)) return null;
        return { ref: fire.entry, detail: 'Levé tlačítko — zapálit Táborák', inReach: true };
      },
      act: (target) => {
        if (!target.cook) return this.campfireSystem.ignite(target.ref);
        this.playerSystem.useToward(target.cook.x, target.cook.z);
        this.openCookingWindow();
        return true;
      },
    });
    this.interaction.register('door', {
      priority: 44,
      pick: ({ cell }) => {
        const root = this.playerSystem.root;
        if (!root || this.playerSystem.level !== 0) return null;
        const door = this.buildingSystem.doorAt(this.s.pointerX, this.s.pointerY, cell ? cell.point : null);
        if (!door) return null;
        return { ref: door, detail: `Levé tlačítko — ${this.buildingSystem.doorHint(door)}`, inReach: this.buildingSystem.inReach(door, root.position) };
      },
      act: (target) => {
        this.playerSystem.useToward(target.ref.x, target.ref.z);
        if (this.buildingSystem.toggleDoor(target.ref)) this.audioSystem.play('doorOpen');
        return true;
      },
    });
    this.interaction.register('station', {
      priority: 43,
      pick: ({ cell }) => {
        const root = this.playerSystem.root;
        if (!root || this.playerSystem.level !== 0) return null;
        const station = this.buildingSystem.stationAt(this.s.pointerX, this.s.pointerY, cell ? cell.point : null);
        if (!station) return null;
        return { ref: station, detail: `Levé tlačítko — ${this.buildingSystem.stationHint(station)}`, inReach: this.buildingSystem.inReach(station, root.position) };
      },
      act: (target) => {
        this.playerSystem.useToward(target.ref.x, target.ref.z);
        if (target.ref.use.kind === 'crafting' && !this.craftingWindow.open) this.toggleCraftingWindow();
        if (target.ref.use.kind === 'lamp' && this.buildingSystem.toggleLamp(target.ref)) this.audioSystem.play('ignite');
        return true;
      },
    });
    this.interaction.register('loot', {
      priority: 45,
      pick: ({ cell }) => {
        const box = cell ? this.lootSystem.at(cell.cx, cell.cz, this.playerSystem.level) : null;
        if (!box || this.lootSystem.isEmpty(box)) return null;
        if (this.lootSource && this.lootSource.ref === box) return null;
        return {
          ref: box,
          detail: `Levé tlačítko — ${box.def.lootVerb} ${box.def.displayName}`,
          inReach: this.lootSystem.nearest === box,
        };
      },
      act: (target) => this.openLoot(target.ref),
    });
  }

  async setupPlayer() {
    this.playerSystem.inputBlocked = () => this.dialog.open || this.dying || this.reloadingSave;
    this.playerSystem.moveBlocked = () => this.editor.active;
    this.playerSystem.walkable = (x, z, level) => this.isWalkableAt(x, z, level);
    this.playerSystem.stepLevel = (fromX, fromZ, level, toX, toZ) => this.stepLevel(fromX, fromZ, level, toX, toZ);
    this.playerSystem.bodyFree = (x, z, level, here, body) => this.navigation.bodyFree(x, z, level, here, body);
    this.playerSystem.inCombat = () => Boolean(this.playerSystem.root) && this.creatureSystem.isPlayerInCombat(this.playerSystem.root.position);
    this.playerSystem.canSprint = () => this.playerStats.canSprint();
    this.playerSystem.speedScale = (x, z) => {
      if (this.terrainSystem.bridgeDeckAt(x, z) !== null) return 1;
      const depth = this.waterDepthNowAt(x, z);
      if (depth <= WATER_STEP_DEPTH) return 1;
      const wet = Math.min(1, depth / WADE_RAMP);
      return 1 - (1 - WADE_SPEED) * wet;
    };
    this.playerSystem.decoSystem = this.decoSystem;
    this.creatureSystem.pointerLevel = () => this.viewLevel();
    this.playerSystem.groundHeightAt = (x, z, level) => this.standHeightAt(x, z, level);
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z, this.playerSystem.root ? this.playerSystem.root.position.y : 0);
    this.playerSystem.onIntroChange = (lying) => {
      if (lying) this.log.add('Stiskni WASD nebo šipky pro vstání', 'info');
      else this.audioSystem.play('wakeUp');
    };
    this.playerSystem.spawnCell = this.mapLayout.spawn;
    this.refreshHands('instant');
    this.playerSystem.onProgress = (done) => this.loader.floatProgress(done);
    this.playerSystem.onWornMesh = (mesh) => this.addShadowCaster(mesh);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.addShadowCaster(child);
    this.cameraSystem.snapTo(root.position.x, root.position.z, root.position.y);
    this.rescuePlayerFromWater();
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
    const excluded = [...this.floraSystem.grassMeshes];
    const shadows = this.decoSystem.contactShadow ? this.decoSystem.contactShadow.mesh : null;
    if (shadows) excluded.push(shadows);
    for (const school of this.fishSystem.schools) {
      if (school.mesh) excluded.push(school.mesh);
    }
    for (const mesh of [this.crabSystem.mesh, this.crabSystem.outline]) {
      if (mesh && !mesh.isDisposed()) excluded.push(mesh);
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
    this.waterSystem.create(this.terrainSystem.groundCells, level, (x, z) => this.terrainSystem.heightAt(x, z), rgb, quality, this.waterBodies().list, this.waterBodies().falls);
    this.terrainSystem.setSeaDry(this.waterSystem.dryMap, this.waterSystem.dryArea);
    this.waveSpray.build(this.waterSystem);
    this.refreshWaterVisibility();
    this.refreshFish();
    this.refreshCrabs();
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

  refreshCrabs() {
    const level = this.mapLayout && Number.isFinite(this.mapLayout.waterLevel) ? this.mapLayout.waterLevel : null;
    this.crabSystem.create(
      this.mapLayout,
      level,
      (x, z) => this.terrainSystem.heightAt(x, z),
      (cx, cz) => this.terrainSystem.floorKeyAt(cx, cz) === CRAB.sandFloor,
      () => (this.playerSystem.root ? this.playerSystem.root.position : null),
    );
  }

  waterDayness() {
    const system = this.dayNightSystem;
    if (!system || !system.config) return 1;
    return system.dayness(system.getTime());
  }

  mapColor(mapKey, key) {
    const map = getMap(mapKey);
    if (!map || !map.colors[key]) return null;
    const c = map.colors[key];
    return new Color4(c[0], c[1], c[2], 1);
  }

  setupLighting() {
    const map = getMap(this.mapKey);
    const { sun, sky } = this.lighting.create(map.light, this.camera);
    this.refreshShadowDepth();
    const fogColor = this.lighting.createFog(map.fog);
    if (fogColor) this.dayNightSystem.fogColor = fogColor;
    this.dayNightSystem.create(map);
    this.dayNightSystem.attach(sun, sky);
    this.dayNightSystem.applyLighting();
    this.terrainSystem.onRebuilt = () => this.refreshCaveLighting();
    this.refreshCaveLighting();
  }

  refreshCaveLighting() {
    if (!this.terrainSystem) return;
    this.caveDressSystem.create(this.terrainSystem.caveWallFaces(), (style, mossy, source) => this.terrainSystem.caveDressMaterial(style, source));
    this.sightSystem.setBlockers(this.terrainSystem.liveSurfaces());
    this.fireLights.refreshCasters();
    this.revealSystem.setLightMap(this.terrainSystem.caveLightMap());
    this.caveFrameSystem.create(this.caveDoorsAround(), (style, source) => this.terrainSystem.caveFrameMaterial(style, source));
    for (const mesh of this.caveFrameSystem.meshes()) this.addShadowCaster(mesh);
    const fallFaces = this.waterfallFaces();
    const housed = buildingCellKeys((this.mapFile || {}).buildings);
    const faces = this.terrainSystem.cliffFaces().filter((face) => !fallFaces.has(`${face.cx},${face.cz}|${face.dx},${face.dz}`)
      && !housed.has(`${face.cx + face.dx},${face.cz + face.dz}`));
    this.cliffDressSystem.create(faces, (style, mossy, source) => this.terrainSystem.cliffDressMaterial(style, mossy, source));
    this.refreshVines();
    this.editor.syncFloorView();
  }

  caveDoorsAround() {
    const housed = buildingCellKeys((this.mapFile || {}).buildings);
    return this.terrainSystem.caveDoors().map((door) => (
      housed.has(`${door.cx},${door.cz}`) || housed.has(`${door.cx + door.dx},${door.cz + door.dz}`) ? { ...door, sunk: true } : door
    ));
  }

  standHeightAt(x, z, level) {
    const ground = this.terrainSystem.walkHeightAt(x, z, level);
    if ((level || 0) !== 0) return ground;
    const root = this.playerSystem && this.playerSystem.root;
    const deck = this.buildingSystem.walkHeightAt(x, z, root ? Math.max(root.position.y, ground) : Infinity);
    return deck === null ? ground : Math.max(ground, deck);
  }

  rockHeightAt(x, z) {
    const { cx, cz } = worldToCellCoords(x, z);
    return this.navigation.hasCaveAt(cx, cz) ? -Infinity : this.terrainSystem.heightAt(x, z, 0);
  }

  onBuildingDeck(x, z, level) {
    return (level || 0) === 0 && this.standHeightAt(x, z, level) > this.terrainSystem.walkHeightAt(x, z, level) + DECK_ABOVE_GROUND;
  }

  refreshVines() {
    this.cliffVineSystem.create({
      edges: this.terrainSystem.shelfAnchors,
      terraces: this.cliffDressSystem.terraceAnchors,
      doors: this.caveDoorsAround().filter((door) => !door.sunk),
      walls: this.buildingSystem.vineAnchors(),
    });
  }

  sowAnchoredGrass() {
    this.floraSystem.addShelfGrass(this.shelfGrassAnchors());
    this.floraSystem.addGrassSpots(this.buildingSystem.grassSpots());
  }

  shelfGrassAnchors() {
    return [...(this.terrainSystem.shelfAnchors || []), ...this.cliffDressSystem.terraceAnchors]
      .filter((anchor) => !this.buildingSystem.keepsClear(anchor.x, anchor.z, SHELF_GRASS_CLEAR));
  }

  refreshShadowCasters() {
    this.lighting.syncSurfaces(this.terrainSystem.surfaces, this.shadowsOn());
    this.refreshShadowReach(true);
  }

  setupOptions() {
    this.optionsPanel.values = { ...this.options };
    this.applyOptions();
    this.optionsPanel.mount();
    this.optionsPanel.render();
    this.optionsPanel.setButtonVisible(false);
    this.optionsPanel.onChange = (values) => {
      this.storeOptions(values);
      this.autoScale = 1;
      this.applyOptions();
    };
    this.optionsPanel.onToggle = (open) => this.holdGameForOptions(open);
    this.optionsPanel.onVolumeSet = (key) => { if (key === 'sfxVolume') this.audioSystem.play('miss'); };
    window.addEventListener('beforeunload', (event) => {
      if (!this.editor.mapDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  setupEditorToggle() {
    this.editorToggle.onToggle = () => this.toggleEditorMode();
    this.editorToggle.mount();
    this.editorToggle.setActive(this.editor.active);
    this.pauseScreen.onResume = () => this.togglePause();
    this.pauseScreen.onSave = () => this.openSaveSlots('save');
    this.pauseScreen.onLoad = () => this.openSaveSlots('load');
    this.pauseScreen.onMenu = () => this.askReturnToMenu();
    this.pauseScreen.mount();
    this.pauseScreen.setSpeed(this.simSystem.speed);
  }

  addShadowCaster(mesh) {
    this.lighting.addCaster(mesh, this.shadowsOn());
  }

  shadowsOn() {
    return this.options.shadows !== 'off';
  }

  removeShadowCaster(mesh) {
    this.lighting.removeCaster(mesh);
  }

  applyOptions() {
    this.defaultMaxFPS = this.options.fpsCap > 0 ? this.options.fpsCap : undefined;
    const qualityScale = QUALITY_SCALES[this.options.quality] ?? 1;
    this.renderScale = qualityScale;
    this.engine.setHardwareScalingLevel(1 / (qualityScale * this.autoScale));
    this.cameraSystem.applyOrtho();
    this.engine.maxFPS = this.paused ? 60 : this.defaultMaxFPS;
    this.refreshClock();
    this.lighting.setShadowDetail(this.options.shadows);
    this.sightSystem.setDetail(this.options.sight);
    this.refreshShadowReach(true);
    this.decoHighlight.setVisible(this.options.highlights);
    this.crabSystem.setOutlineVisible(this.options.highlights);
    this.pickupSparkles.setEnabled(this.options.pickupSparkles);
    this.applyUiOptions();
    this.vitalsBar.setVisible(this.options.playerBars !== 'head');
    this.gameCursor.setEnabled(this.options.customCursor);
    const densityChanged = this.floraSystem.density !== this.options.grass;
    if (densityChanged && this.grassModelList) this.rebuildGrass();
    this.waterSystem.setReflections(this.options.reflections);
    if (this.isLoading) return;
    this.audioSystem.setMasterVolume(this.options.sfxVolume / 100);
    this.audioSystem.setAmbientVolume(this.options.ambientVolume / 100);
    this.audioSystem.setMusicVolume(this.options.musicVolume / 100);
    if (this.waterSystem.quality !== this.options.quality) this.withBusy('Přepočítávám vodu…', () => this.renderWater());
  }

  portraitLightOn() {
    const day = this.dayNightSystem;
    if (!day.sunLight || !day.light) return;
    this.portraitLight = {
      levels: this.s.lights.map((light) => [light, light.intensity]),
      sunDiffuse: day.sunLight.diffuse.clone(),
    };
    for (const light of this.s.lights) light.intensity = 0;
    day.sunLight.intensity = day.light.sunIntensity;
    if (day.sunDiffuse) day.sunLight.diffuse.copyFrom(day.sunDiffuse);
    if (day.skyLight) day.skyLight.intensity = day.light.hemiIntensity;
  }

  portraitLightOff() {
    const saved = this.portraitLight;
    if (!saved) return;
    this.portraitLight = null;
    for (const [light, intensity] of saved.levels) light.intensity = intensity;
    this.dayNightSystem.sunLight.diffuse.copyFrom(saved.sunDiffuse);
  }

  storeOptions(values) {
    this.options = { ...values };
    writeJSON(OPTIONS_STORAGE_KEY, values);
  }

  applyUiOptions() {
    document.documentElement.style.setProperty('--ui-scale', String((Number(this.options.uiScale) || 100) / 100));
    document.documentElement.style.setProperty('--panel-backdrop', String(1 - (Number(this.options.panelTransparency) || 0) / 100));
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
    this.refreshClock();
    this.hud.setClockSpeed(false, this.simSystem.speed);
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
    this.hud.setClockSpeed(this.paused || this.simSystem.halted, this.simSystem.speed);
    if (this.characterPanel.open) this.refreshCharacterPanel();
  }

  refreshAmbient(dt = 0) {
    const time = this.dayNightSystem.getTime();
    const value = this.dayNightSystem.config ? this.dayNightSystem.dayness(time) : 1;
    const settled = dt > 0 && Math.abs(time - this.ambientTime) < AMBIENT_TIME_STEP;
    if (settled) {
      this.updateIndoor(dt);
      return;
    }
    this.ambientTime = time;
    const light = getMap(this.mapKey).light;
    setNightLight(1 - value, light.sunIntensity + light.hemiIntensity);
    this.audioSystem.setDayness(value);
    this.floraSystem.setDayness(value);
    const sun = this.dayNightSystem.sunLight;
    if (sun) this.floraSystem.setSunDirection(sun.direction.scale(-1));
    this.skySystem.setDayness(value, this.dayNightSystem.sunLight);
    this.waterSystem.setDayness(value);
    this.waterSystem.setSkyTint(this.skySystem.tint());
    if (this.playerSystem.torchFire) this.playerSystem.torchFire.setDayness(value);
    this.buildingSystem.setDayness(value);
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
    const sheltered = Boolean(root) && level === 0 && !this.editor.active && this.buildingSystem.shelterAt(root.position) ? 1 : 0;
    this.sheltered = (this.sheltered || 0) + (sheltered - (this.sheltered || 0)) * step;
    if (Math.abs(sheltered - this.sheltered) < 0.001) this.sheltered = sheltered;
    this.audioSystem.setSheltered(this.sheltered);
    if (this.playerSystem && this.playerSystem.torchFire) this.playerSystem.torchFire.setIndoors(level < 0 || this.sheltered > 0.5);
  }

  updateReveal(dt) {
    const root = this.playerSystem ? this.playerSystem.root : null;
    const level = this.playerSystem ? this.playerSystem.level : 0;
    const view = this.editor.floorView();
    const under = Boolean(view) || (Boolean(root) && !this.editor.active && this.isUnderRoof(root.position.x, root.position.z, level));
    if (view) {
      const floor = this.editor.mode.floorLevel;
      const own = [...this.terrainSystem.roofMeshes, ...this.decoSystem.caveDecoMeshes(floor)];
      if (root && level === floor) own.push(...root.getChildMeshes(false));
      for (const creature of this.creatureSystem.bodies()) {
        if ((creature.level || 0) === floor) own.push(...creature.meshes);
      }
      this.revealSystem.setKeptMeshes(own);
    } else if (under || this.revealSystem.isOpen()) {
      const viewer = { x: root.position.x, y: root.position.y, z: root.position.z, level };
      const seen = ({ x, y, z }, floor) => this.navigation.seesAcrossFloors(viewer, { x, y, z, level: floor });
      const own = [...root.getChildMeshes(false), ...this.portraitSystem.meshes(), ...this.terrainSystem.roofMeshes, ...this.decoSystem.caveDecoInSight(seen), ...this.attackArcMeshes()];
      for (const creature of this.creatureSystem.bodies()) {
        const floor = creature.level || 0;
        const y = this.creatureSystem.groundAt(creature.x, creature.z, floor, creature.y);
        if (seen({ x: creature.x, y, z: creature.z }, floor)) own.push(...creature.meshes);
      }
      this.revealSystem.setKeptMeshes(own);
    }
    this.updateUndergroundMeshes(dt, root, level);
    this.updateSight(dt, view, under);
    const peeking = root && !view && !this.editor.active && level === 0;
    const eye = this.camera ? this.camera.globalPosition : null;
    if (this.editor.active) this.revealSystem.setPeek(dt, view ? null : this.editorPeekPoint(), eye, EDITOR_PEEK_RADIUS);
    else this.revealSystem.setPeek(dt, peeking ? root.position : null, eye);
    this.revealSystem.update(dt, under, root ? root.position : null, this.camera, view);
    this.terrainSystem.showCaveRing(this.revealSystem.isOpen());
  }

  editorPeekPoint() {
    if (!this.inputSystem || !this.inputSystem.pointerInside()) return null;
    const cell = this.inputSystem.cellAtPointer();
    return cell ? cell.point : null;
  }

  fireFocus() {
    const root = this.playerSystem ? this.playerSystem.root : null;
    if (root && !this.editor.active) return { x: root.position.x, y: root.position.y, z: root.position.z, level: this.playerSystem.level };
    const target = this.camera ? this.camera.target : null;
    if (!target) return null;
    return { x: target.x, y: target.y, z: target.z, level: this.editor.active ? this.editor.mode.floorLevel || 0 : 0 };
  }

  fireCastersNear(source) {
    const at = new Vector3(source.x, source.y, source.z);
    const near = (mesh) => {
      mesh.computeWorldMatrix(true);
      const { centerWorld, radiusWorld } = mesh.getBoundingInfo().boundingSphere;
      return Vector3.Distance(centerWorld, at) <= source.range + radiusWorld;
    };
    const rock = this.terrainSystem.liveSurfaces().filter((mesh) => mesh.metadata && mesh.metadata.volume && near(mesh));
    const building = this.buildingSystem.meshes.filter((mesh) => !mesh.isDisposed() && near(mesh));
    return [...rock, ...building];
  }

  updateBuildingInside(dt) {
    const root = this.playerSystem ? this.playerSystem.root : null;
    const watching = root && !this.editor.active && this.playerSystem.level === 0;
    const eye = this.camera ? this.camera.globalPosition : null;
    const storey = this.editor.active ? this.editor.buildingView : null;
    const hidden = this.buildingSystem.updateInside(dt, watching ? root.position : null, eye, storey);
    if (hidden) this.cliffVineSystem.hideGroups(hidden);
  }

  updateUndergroundMeshes(dt, root, level) {
    this.caveDecoTimer = (this.caveDecoTimer || 0) - dt;
    if (!this.caveDecoList || this.caveDecoTimer <= 0) {
      this.caveDecoTimer = CAVE_DECO_REFRESH_SECONDS;
      this.caveDecoList = this.decoSystem.caveDecoInSight(() => true);
    }
    const meshes = [...this.caveDecoList];
    if (root && level < 0) meshes.push(...root.getChildMeshes(false));
    meshes.push(...this.creatureSystem.meshesBelowGround());
    this.revealSystem.setUndergroundMeshes(meshes);
  }

  updateSight(dt, view, under) {
    const root = this.playerSystem ? this.playerSystem.root : null;
    const watching = root && !view && !this.editor.active;
    const eye = watching ? { x: root.position.x, y: root.position.y + PLAYER_EYE_HEIGHT, z: root.position.z } : null;
    this.sightSystem.update(dt, eye, Boolean(eye) && under);
    this.revealSystem.setSight(this.sightSystem.view());
  }

  hoverDeco(cell) {
    this.decoHighlight.setHover(cell && this.cellInSight(cell) ? cell : null);
  }

  cellInSight(cell) {
    const root = this.playerSystem ? this.playerSystem.root : null;
    const sight = this.sightSystem.view();
    if (!root || !sight.active || sight.hide < 0.5) return true;
    const level = Number.isFinite(cell.level) ? cell.level : this.playerSystem.level;
    const spot = this.decoHighlight.spotAt(cell.cx, cell.cz, level, cell.point);
    const x = spot ? spot.x : cell.cx * CELL_SIZE;
    const z = spot ? spot.z : cell.cz * CELL_SIZE;
    const y = spot ? spot.y : this.terrainSystem.walkHeightAt(x, z, level);
    const eye = new Vector3(root.position.x, root.position.y + PLAYER_EYE_HEIGHT, root.position.z);
    return this.seesSpot(eye, x, y, z, sight.range);
  }

  pointedCell(cell) {
    const root = this.playerSystem.root;
    if (!cell || !root || this.editor.active) return cell;
    const { x, y, z } = root.position;
    const viewer = { x, y, z, level: this.playerSystem.level };
    for (const level of this.navigation.floorsInSight(x, z, viewer.level)) {
      const candidate = level === viewer.level ? cell : this.inputSystem.cellAtPointer(level);
      if (!candidate) continue;
      const spot = this.decoHighlight.spotAt(candidate.cx, candidate.cz, level, candidate.point);
      if (spot && this.navigation.seesAcrossFloors(viewer, { x: spot.x, y: spot.y, z: spot.z, level })) return { ...candidate, level };
    }
    return cell;
  }

  playerOnSurface() {
    return !this.playerSystem || this.editor.active || this.playerSystem.level === 0;
  }

  isUnderRoof(x, z, level = 0) {
    return this.navigation.isUnderRoof(x, z, level);
  }

  describeDayPhase(time, cfg) {
    if (!cfg) return 'Bez denního cyklu';
    if (time < cfg.dawnTime || time > cfg.duskTime) return 'Noc';
    const t = (time - cfg.dawnTime) / (cfg.duskTime - cfg.dawnTime);
    if (t < 0.2) return 'Svitání';
    if (t > 0.8) return 'Soumrak';
    return 'Den';
  }

  setupHud() {
    this.hud.onSpeed = (speed) => this.setSimSpeed(speed);
    this.hud.onSave = () => this.openSaveSlots('save');
    this.hud.onLoad = () => this.openSaveSlots('load');
    this.hud.mount();
    this.hotbar.mount();
    this.hotbar.onSelect = (key) => this.selectTool(key);
    this.hotbar.onAssign = (index, toolKey) => {
      this.heldItemSystem.assign(index, toolKey);
      this.audioSystem.play('itemDrop');
    };
    this.hotbar.onSwap = (from, to) => {
      this.heldItemSystem.swap(from, to);
      this.audioSystem.play('itemDrop');
    };
    this.hotbar.onClear = (index) => this.heldItemSystem.clear(index);
    this.hotbar.onGrab = () => this.audioSystem.play('itemGrab');
    this.hotbar.setSlots(this.heldItemSystem.bar);
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.bagButton.onClick = () => this.toggleCharacterPanel();
    this.bestiaryButton.onClick = () => this.toggleBestiaryWindow();
    this.journalButton.onClick = () => this.toggleJournalWindow();
    this.craftButton.onClick = () => this.toggleCraftingWindow();
    this.craftingWindow.onCraft = (key) => this.craftRecipe(key);
    this.cookingWindow.onCraft = (key) => this.craftRecipe(key);
    this.cookingWindow.onClose = () => this.audioSystem.play('windowClose');
    this.bagButton.mount();
    this.bestiaryButton.mount();
    this.journalButton.mount();
    this.craftButton.mount();
    this.journalWindow.onClose = () => {
      this.journalButton.setActive(false);
      this.audioSystem.play('windowClose');
    };
    this.bestiaryWindow.onRevealAll = (on) => this.setBestiaryRevealAll(on);
    this.bestiaryWindow.onClose = () => {
      this.bestiaryButton.setActive(false);
      this.audioSystem.play('windowClose');
    };
    this.craftingWindow.onClose = () => {
      this.craftButton.setActive(false);
      this.audioSystem.play('windowClose');
    };
    this.characterPanel.onClose = () => {
      this.portraitSystem.hide();
      this.audioSystem.play('windowClose');
      this.bagButton.setActive(false);
    };
    this.characterPanel.onUnequip = (slot) => this.unequipSlot(slot);
    this.characterPanel.onMove = (from, to) => {
      if (!this.inventorySystem.move(from, to)) return;
      this.audioSystem.play('itemDrop');
      this.refreshInventory();
    };
    this.characterPanel.onClearBar = (index) => {
      this.heldItemSystem.clear(index);
      this.audioSystem.play('itemDrop');
    };
    this.characterPanel.onGrab = () => this.audioSystem.play('itemGrab');
    this.lootWindow.onTake = (itemKey) => this.takeLoot(itemKey);
    this.lootWindow.onTakeAll = () => this.takeAllLoot();
    this.lootWindow.onClose = () => this.closeLoot();
    this.characterPanel.onEquip = (itemKey, slot) => this.equipItem(itemKey, slot);
    this.characterPanel.onUse = (itemKey) => this.useBagItem(itemKey);
    this.characterPanel.onPreview = (itemKey) => this.previewStats(itemKey);
    this.characterPanel.onSpendPoint = (key) => this.spendAttributePoint(key);
    this.vitalsBar.setHealth(this.playerStats.health, this.playerStats.maxHealth);
    this.vitalsBar.setStamina(this.playerStats.stamina, this.playerStats.maxStamina);
    this.refreshProgress();
    this.creatureHealthBar.mount();
    this.log.mount();
    this.toasts.onShow = () => this.audioSystem.play('notice');
    this.hoverHint.mount();
    this.deathScreen.onRespawn = () => this.respawnPlayer();
    this.deathScreen.mount();
    this.refreshInventory();
    this.refreshClock();
  }

  toggleCharacterPanel() {
    if (this.characterPanel.open) {
      this.characterPanel.close();
      return;
    }
    this.refreshInventory();
    this.refreshCharacterPanel();
    this.characterPanel.show();
    this.audioSystem.play('windowOpen');
    this.portraitSystem.show(this.characterPanel.portraitCanvas);
    this.bagButton.setActive(true);
  }

  toggleJournalWindow() {
    if (this.journalWindow.open) {
      this.journalWindow.close();
      return;
    }
    this.journalWindow.show();
    this.audioSystem.play('windowOpen');
    this.journalButton.setActive(true);
  }

  toggleCraftingWindow() {
    if (this.craftingWindow.open) {
      this.craftingWindow.close();
      return;
    }
    this.craftingWindow.setRecipes(this.craftingRecipes());
    this.craftingWindow.show();
    this.audioSystem.play('windowOpen');
    this.craftButton.setActive(true);
  }

  closeOpenWindows() {
    let closed = false;
    if (this.characterPanel.open) {
      this.characterPanel.close();
      closed = true;
    }
    if (this.bestiaryWindow.open) {
      this.bestiaryWindow.close();
      closed = true;
    }
    if (this.craftingWindow.open) {
      this.craftingWindow.close();
      closed = true;
    }
    if (this.cookingWindow.open) {
      this.cookingWindow.close();
      closed = true;
    }
    if (this.journalWindow.open) {
      this.journalWindow.close();
      closed = true;
    }
    if (this.lootWindow.open) {
      this.closeLoot();
      closed = true;
    }
    if (this.dismissCreaturePanel()) closed = true;
    return closed;
  }

  refreshCharacterPanel() {
    const weapon = this.equippedWeapon();
    this.characterPanel.updateCharacter({
      health: this.playerStats.health,
      maxHealth: this.playerStats.maxHealth,
      stamina: this.playerStats.stamina,
      maxStamina: this.playerStats.maxStamina,
      ...this.playerAttackSystem.weaponStats(weapon ? weapon.tool : null),
      defense: this.playerStats.defense,
      armor: this.playerStats.armor,
      level: this.playerStats.level,
      xp: this.playerStats.xp,
      xpNeeded: this.playerStats.xpNeeded(),
      points: this.playerStats.points,
      attributes: this.playerStats.attributes,
      resistances: this.playerStats.resistances,
    });
  }

  receiveItems(yields) {
    for (const { itemKey, amount } of yields) {
      const fresh = this.inventorySystem.count(itemKey) === 0;
      this.inventorySystem.add(itemKey, amount);
      const tool = toolForItem(itemKey);
      if (fresh && tool) this.heldItemSystem.keep(tool);
      const def = ITEM_TYPES[itemKey];
      if (fresh && def && def.slot === 'weapon' && !this.equipmentSystem.get('weapon')) this.equipItem(itemKey, 'weapon');
    }
    this.discoverRecipes(yields.map(({ itemKey }) => itemKey));
    this.refreshInventory();
    this.logGain(yields);
  }

  logGain(yields) {
    for (const { itemKey, amount } of yields) {
      const def = ITEM_TYPES[itemKey];
      this.log.add(`+${amount} ${itemIcon(itemKey)} ${def ? def.displayName : itemKey}`, 'gain');
    }
  }

  ownsTool(key) {
    const tool = getTool(key);
    return Boolean(tool) && this.inventorySystem.count(tool.item) > 0;
  }

  ownsBarItem(key) {
    const entry = barEntry(key);
    return Boolean(entry) && this.inventorySystem.count(entry.item) > 0;
  }

  selectTool(key) {
    if (itemFood(key)) this.eatItem(key);
    else if (this.ownsTool(key)) this.heldItemSystem.set(key);
  }

  refreshInventory() {
    this.warmOwnedItems();
    this.characterPanel.updateInventory(this.inventorySystem, this.carriedLoad());
    this.hotbar.setAvailable((key) => this.ownsBarItem(key));
    if (this.heldItemSystem.key && !this.ownsTool(this.heldItemSystem.key)) this.heldItemSystem.set(null);
    if (this.characterPanel.open) this.refreshCharacterPanel();
    this.refreshCrafting();
  }

  onHeldItemChange() {
    this.hotbar.setSelected(this.heldItemSystem.key);
    this.refreshHands();
    this.gatherSystem.setTool(this.heldItemSystem.tool());
    this.gridSystem.hideHologram();
    this.setPointerCursorState();
  }

  setupInput() {
    this.inputSystem.suppressContextMenu(this.canvas);
    this.inputSystem.groundPredicate = (mesh) => mesh === this.terrainSystem.ground;
    this.inputSystem.groundHeightAt = (x, z, wanted = null) => {
      const plane = wanted === null ? this.editor.floorPlane(x, z, true) : null;
      if (plane !== null) return plane;
      const level = wanted !== null ? wanted : this.gatherSystem.levelOf();
      if (level !== 0 && !this.navigation.isWalkableAt(x, z, level)) return NO_FLOOR_PICK_HEIGHT;
      return this.standHeightAt(x, z, level);
    };
    this.inputSystem.shouldPickByRay = () => this.editor.active && this.editor.mode.selectsArea;
    this.inputSystem.seesThrough = (x, y, z) => this.revealSystem.peekAt(x, y, z) >= PEEK_PICK_THROUGH;
    this.inputSystem.attach(this.camera, this);
    this.inputSystem.onLeftDown = () => this.handleLeftDown();
    this.inputSystem.onHoverCell = (cell) => this.handleHover(cell);
    this.inputSystem.onCellRightClick = (cell) => this.handleCellRightClick(cell);
    this.inputSystem.onMiddleClick = () => {
      if (this.loaded && !this.editor.active && !this.dying) this.pinCreatureAtPointer();
    };
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
    this.registerSavedState(this.buildingSystem, 'doors', 11);
    this.registerSavedState(this.campfireSystem, 'campfires', 12);
    this.saveSystem.register('loot', {
      serialize: () => this.lootSystem.serialize(),
      apply: (data) => {
        this.lootSystem.apply(data);
        this.syncLootHighlights();
      },
      defaults: () => this.lootSystem.defaultState(),
      order: 13,
    });
    this.registerSavedState(this.fellingSystem, 'felling', 14);
    this.registerSavedState(this.harvestSystem, 'harvest', 15);
    this.registerSavedState(this.creatureSystem, 'creatures', 16);
    this.registerSavedState(this.bestiary, 'bestiary', 17);
    this.registerSavedState(this.dayNightSystem, 'dayNight', 20);
    this.registerSavedState(this.simSystem, 'sim', 25);
    this.saveSystem.register('inventory', {
      serialize: () => this.inventorySystem.serialize(),
      apply: (data) => {
        this.inventorySystem.apply(data);
        this.refreshInventory();
      },
      defaults: () => this.inventorySystem.defaultState(),
      order: 6,
    });
    this.saveSystem.register('equipment', {
      serialize: () => this.equipmentSystem.serialize(),
      apply: (data) => {
        this.equipmentSystem.apply(data);
        this.refreshEquipment();
      },
      defaults: () => this.equipmentSystem.defaultState(),
      order: 9,
    });
    this.saveSystem.register('recipeBook', {
      serialize: () => this.recipeBook.serialize(),
      apply: (data) => {
        this.recipeBook.apply(data);
        this.recipeBook.notice(this.ownedItemKeys());
        this.refreshCrafting();
      },
      defaults: () => this.recipeBook.defaultState(),
      order: 10,
    });
  }

  registerSavedState(owner, key, order) {
    this.saveSystem.register(key, {
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

  holdGameForOptions(open) {
    if (open) {
      if (this.paused || this.editor.active) return;
      this.optionsPaused = true;
      this.setPaused(true);
      return;
    }
    if (!this.optionsPaused) return;
    this.optionsPaused = false;
    this.setPaused(false);
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
      if (!this.editor.active && !this.optionsPaused) this.pauseScreen.show();
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
    return this.editor.toggle();
  }

  syncZoomLimit() {
    this.cameraSystem.setMaxZoom(this.editor.active ? EDITOR_ZOOM_MAX : PLAYER_ZOOM_MAX);
    this.refreshShadowDepth();
  }

  refreshShadowDepth() {
    if (!this.camera) return;
    this.lighting.refreshDepth(this.camera, this.cameraSystem.viewDepthRange(), this.cameraSystem.zoom > PLAYER_ZOOM_MAX);
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
      if (!typing) evt.preventDefault();
      return;
    }
    if (this.dying) {
      if (evt.key !== 'Enter') evt.preventDefault();
      return;
    }
    if (evt.key === 'Escape' && this.saveSlots.open) {
      evt.preventDefault();
      this.saveSlots.close();
      return;
    }
    if (this.editor.active) {
      this.editor.handleKey(evt, typing);
      return;
    }
    if (this.optionsPanel.isOpen) {
      if (typing) return;
      evt.preventDefault();
      if (evt.key === 'Escape' || evt.key === 'o' || evt.key === 'O') this.optionsPanel.hide();
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
      this.toggleCharacterPanel();
      return;
    }
    if ((evt.key === 'c' || evt.key === 'C') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleCharacterPanel();
      return;
    }
    if ((evt.key === 'b' || evt.key === 'B') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleBestiaryWindow();
      return;
    }
    if ((evt.key === 'j' || evt.key === 'J') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleJournalWindow();
      return;
    }
    if ((evt.key === 'v' || evt.key === 'V') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      this.toggleCraftingWindow();
      return;
    }
    if (evt.key === 'g' || evt.key === 'G') {
      if (!evt.repeat) this.toggleGrid();
      evt.preventDefault();
      return;
    }
    if (evt.code === 'Space' && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      if (!evt.repeat) this.tryDodge();
      return;
    }
    if ((evt.key === 'x' || evt.key === 'X') && !typing) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey) return;
      evt.preventDefault();
      if (!evt.repeat) this.toggleWeapon();
      return;
    }
    if ((evt.key === 'n' || evt.key === 'N') && !evt.ctrlKey && !evt.metaKey && !evt.altKey && !typing) {
      if (!evt.repeat) this.skipTime();
      evt.preventDefault();
      return;
    }
    if (/^[0-9]$/.test(evt.key)) {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      const key = this.heldItemSystem.bar[(Number(evt.key) + 9) % 10];
      if (!key) return;
      evt.preventDefault();
      if (this.heldItemSystem.key === key) this.heldItemSystem.set(null);
      else this.selectTool(key);
      return;
    }
    if (evt.key === 'e' || evt.key === 'E') {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing || !this.lootWindow.open) return;
      evt.preventDefault();
      if (!evt.repeat) this.takeAllLoot();
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

  toggleGrid() {
    return this.terrainSystem.toggleGrid();
  }

  skipTime() {
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
    const plane = this.editor.floorPlane(cx * CELL_SIZE, cz * CELL_SIZE);
    if (plane !== null) return plane;
    const deck = this.terrainSystem.bridgeDeckAt(cx * CELL_SIZE, cz * CELL_SIZE);
    if (deck !== null) return deck;
    return this.decorHidden ? this.terrainSystem.heightAt(cx * CELL_SIZE, cz * CELL_SIZE) : this.decoSystem.surfaceAt(cx, cz);
  }

  handleHover(cell) {
    this.hoverCell = cell;
    const pointedCell = this.editor.active && this.editor.mode.undergroundView ? null : this.pointedCell(cell);
    this.hoverDeco(pointedCell || null);
    if (!this.editor.active) {
      this.gridSystem.clearHoverCell();
      this.gridSystem.clearCreatureRadius();
      this.gridSystem.hideHologram();
      this.refreshHoverTooltip(pointedCell);
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
    if (this.editor.mapMode === 'floors' || this.editor.mode.undergroundView) {
      this.editor.showFloorHoverReadout(cell);
      return;
    }
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
    if (!cell || !this.cellInSight(cell)) {
      this.tooltipPanel.hide();
      return;
    }
    const level = Number.isFinite(cell.level) ? cell.level : this.gatherSystem.levelOf();
    const height = this.terrainSystem.walkHeightAt(cell.cx * CELL_SIZE, cell.cz * CELL_SIZE, level);
    const detail = `výška ${metersText(height)}`;
    const deco = this.decoHighlight.labelAt(cell.cx, cell.cz, level, cell.point);
    if (deco) {
      this.tooltipPanel.show(deco.label, detail);
      return;
    }
    const surfaceKey = this.playerOnSurface() && this.decoSystem.surfaceKeyAt ? this.decoSystem.surfaceKeyAt(cell.cx, cell.cz) : null;
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
    if (this.editor.mode.selectsArea) this.editor.mode.finishAreaDrag();
    this.editor.endPaint();
  }

  isWalkableAt(x, z, level = 0) {
    return this.navigation.isWalkableAt(x, z, level);
  }

  stepLevel(fromX, fromZ, level, toX, toZ) {
    return this.navigation.stepLevel(fromX, fromZ, level, toX, toZ);
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
    const best = this.navigation.nearestWalkable(pos.x, pos.z);
    if (best) player.apply({ x: best.x, z: best.z, facing: player.facing });
  }

  handleCellClick(cell) {
    if (!cell) return;
    if (!this.editor.active) return;
    this.editor.paintCell(cell.cx, cell.cz);
  }

  handleCellRightClick(cell) {
    if (!this.editor.active) {
      if (!this.loaded || this.dying || this.paused) return;
      if (this.playerSystem.weaponDrawn) this.secondaryAttackToward();
      return;
    }
    if (!cell) return;
    this.editor.rightClickCell(cell);
    this.handleHover(cell);
  }

  markMapDirty() {
    return this.editor.markDirty();
  }

  refreshShadowReach(force = false) {
    this.lighting.refreshReach(this.viewCircle(), this.shadowsOn(), force);
  }


  onResize() {
    this.cameraSystem.onResize();
  }
}

Object.assign(GameScene.prototype, sceneWorldParts, sceneCombatParts, sceneGatheringParts, sceneStepsParts, sceneEquipmentParts, sceneCraftingParts, sceneFoodParts, sceneProgressParts, sceneSaveParts, sceneReloadParts);
