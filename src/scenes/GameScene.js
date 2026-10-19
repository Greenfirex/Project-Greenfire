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

import CameraSystem from '../systems/cameraSystem.js';
import GridSystem from '../systems/gridSystem.js';
import TerrainSystem from '../systems/terrainSystem.js';
import DecoSystem from '../systems/decoSystem.js';
import DecoHighlightSystem from '../systems/decoHighlightSystem.js';
import DayNightSystem from '../systems/dayNightSystem.js';
import SimSystem from '../systems/simSystem.js';
import InputSystem from '../systems/inputSystem.js';
import PlayerSystem from '../systems/playerSystem.js';
import BuildSystem from '../systems/buildSystem.js';
import SaveSystem from '../systems/saveSystem.js';
import Hud from '../ui/hud.js';
import Hotbar from '../ui/hotbar.js';
import EditorMode from '../systems/editorMode.js';
import EditorHud from '../ui/editorHud.js';
import BrushPanel from '../ui/brushPanel.js';
import TileThumbnails from '../ui/tileThumbnails.js';
import { MACHINE_KEYS, DEFAULT_MACHINE, getMachine } from '../data/catalogs/machines.js';
import { worldToCellCoords } from '../utils/gridMath.js';
import { getBrush } from '../data/catalogs/brushes.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { SAVE_DEFAULTS, SAVE_VERSION, SAVE_STORAGE_KEY } from '../data/catalogs/saveSchema.js';
import { buildGladeLayout } from '../data/maps/glade.js';
import gladeLayoutData from '../data/maps/glade/layout.json';
import { normalizeLayout, cloneLayout } from '../data/maps/layoutStore.js';
import { generateLayout } from '../data/maps/mapGenerator.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { OPTION_DEFAULTS, OPTIONS_STORAGE_KEY, QUALITY_SCALES } from '../data/catalogs/optionsSchema.js';
import OptionsPanel from '../ui/optionsPanel.js';

const AUTOTUNE_WINDOW_MS = 2000;
const AUTOTUNE_LOW_FPS = 45;
const AUTOTUNE_HIGH_FPS = 57;
const AUTOTUNE_MIN_SCALE = 0.7;
const AUTOTUNE_STEP = 0.1;
const BUILD_RANGE_CELLS = 2;


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
    this.decoHighlight = new DecoHighlightSystem(scene);
    this.dayNightSystem = new DayNightSystem(scene);
    this.simSystem = new SimSystem(scene);
    this.inputSystem = new InputSystem(scene);
    this.playerSystem = new PlayerSystem(scene);
    this.buildSystem = new BuildSystem(scene);
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.hotbar = new Hotbar();
    this.editorMode = new EditorMode();
    this.lastPaintCell = null;
    this.editorHud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.optionsPanel = new OptionsPanel();
    this.options = { ...OPTION_DEFAULTS };
    this.renderScale = 1;
    this.autoScale = 1;
    this.autoWindowStart = 0;
    this.autoWindowFrames = 0;
    this.shadowCasters = [];

    this.tileThumbs = null;

    this.camera = null;
    this.shadowGenerator = null;
    this.currentMachine = DEFAULT_MACHINE;
    this.previewRotation = 0;
    this.heldTool = null;
    this.hoverCell = null;
    this.mapLayout = null;
  }

  start() {
    this.setupLighting();
    this.camera = this.cameraSystem.create();
    this.setupTerrain();
    this.setupDecorations();
    this.gridSystem.create();
    this.setupShadowCasters();
    this.setupSimulation();
    this.setupPlayer();
    this.setupHud();
    this.setupOptions();
    this.setupInput();
    this.setupSave();
    this.registerHudEvents();

    this.buildSystem.onMachineReady = (record, node) => {
      for (const child of node.getChildMeshes()) this.addShadowCaster(child);
    };

    this.s.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      this.simSystem.update(dt);
      this.followPointer();
      this.decoHighlight.update(dt);
      this.playerSystem.update(dt);
      const root = this.playerSystem.root;
      if (root) this.cameraSystem.follow(root.position.x, root.position.z, dt);
      this.autoTune(dt);
    });

    this.engine.runRenderLoop(() => this.s.render());
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
    this.hotbar.setHeld(this.heldTool);
  }

  followPointer() {
    if (!this.options.highlights || !this.decoHighlight.hasEntries()) return;
    const cell = this.inputSystem.pointerInside()
      ? this.inputSystem.cellAtPointer()
      : null;
    this.decoHighlight.setHover(cell);
  }

  async setupPlayer() {
    this.playerSystem.blockedTest = (cx, cz) => this.buildSystem.isOccupied(cx, cz);
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.addShadowCaster(child);
    this.cameraSystem.snapTo(root.position.x, root.position.z);
  }

  setupTerrain() {
    const ground = this.terrainSystem.create(this.mapKey);
    if (ground) this.s.clearColor = this.mapColor(this.mapKey, 'sky');
    const map = getMap(this.mapKey);
    if (map) this.buildSystem.buildLimit = map.buildLimit;
  }

  setupDecorations() {
    const map = getMap(this.mapKey);
    const layout = this.buildMapLayout();
    this.decoHighlight.clear();
    this.decoHighlight.create((cx, cz) => this.decoSystem.surfaceAt(cx, cz));
    this.decoSystem.create(layout, map.colors);
    this.decoSystem.rememberLayout(this.mapLayout);
    this.tileThumbs = new TileThumbnails(this.s, map.colors);
    this.buildSystem.blockedTest = (cx, cz) => this.decoSystem.isBlocked(cx, cz);
    this.buildSystem.rangeTest = (cx, cz) => this.withinBuildRange(cx, cz);
    this.gridSystem.onHologramReady = (machineKey) => {
      if (machineKey !== this.currentMachine) return;
      this.refreshHoverPreview();
    };
    this.decoSystem.onDecoReady = (anchor, node, def, entry) => {
      for (const child of node.getChildMeshes()) {
        child.isPickable = false;
        if (def.castsShadow) this.addShadowCaster(child);
      }
      this.decoHighlight.add(entry, node, def);
    };

    this.editorMode.onRegenerate = (editorLayout) => this.renderMapLayout(editorLayout);
    this.editorMode.onChange = (active) => this.toggleEditorPanel(active);
    this.editorMode.onModeChange = (mode) => {
      this.editorHud.setMode(mode);
      this.handleHover(this.hoverCell);
    };
    this.editorMode.onStyleChange = (brushKey, styleKey) => {
      this.brushPanel.setStyle(styleKey, this.editorMode.tileKey);
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
    this.editorHud.onBrushOpts = (key, opts) => this.setBrushOpts(key, opts);
    this.editorHud.onSaveMap = () => this.saveMapLayout();
    this.brushPanel.onThumbnail = (key, img) => this.fillThumbnail(key, img);
    this.brushPanel.onApply = () => this.applyBrushDraft();
    this.brushPanel.onCancel = () => this.cancelBrushDraft();
    this.brushPanel.onStyle = (brushKey, styleKey) => this.editorMode.setStyle(styleKey);
    this.brushPanel.onTile = (key) => this.editorMode.setTileKey(key);
    this.brushPanel.onManualMode = (on) => this.editorMode.setManualMode(on);
    this.brushPanel.onErase = () => this.setEraseMode(!this.editorMode.erasing);
    this.brushPanel.onUndo = () => this.undoEdit();
    this.editorMode.onManualModeChange = () => this.openBrushPanel(this.editorMode.brushKey);
  }

  fillThumbnail(key, img) {
    if (!img || !this.tileThumbs) return;
    if (img.dataset.state !== 'idle') return;
    img.dataset.state = 'loading';
    this.tileThumbs.get(key).then((url) => {
      if (!img.isConnected) return;
      if (!url) {
        img.dataset.state = 'missing';
        return;
      }
      img.src = url;
      img.dataset.state = 'done';
    }).catch(() => {
      img.dataset.state = 'missing';
    });
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
    const brush = getBrush(brushKey);
    const manual = Boolean(brush && brush.poolByStyle) && this.editorMode.manualMode;
    if (manual) {
      this.editorMode.cancelDraft();
      this.editorHud.setReadout('Maluj dílky · pravý klik maže · R otáčí');
    } else {
      this.editorMode.beginDraft(brushKey);
    }
    this.brushPanel.open(
      brushKey,
      0,
      this.editorMode.pathStyle,
      manual ? this.editorMode.tileKey : null,
      manual,
    );
    this.brushPanel.setDraftMode(this.editorMode.draftMode);
    this.refreshUndoButton();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  setBrushOpts(brushKey, opts) {
    this.editorMode.setBrushOpts(brushKey, opts);
    if (this.editorMode.draft && this.editorMode.draft.brushKey === brushKey) {
      this.editorMode.setDraftOpts(opts);
    }
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
    this.handleHover(this.hoverCell);
    return true;
  }

  ensureDraft() {
    if (this.editorMode.draft) return;
    if (!this.brushPanel.isOpen) return;
    if (this.editorMode.manualMode) return;
    const brushKey = this.editorMode.brushKey;
    if (!brushKey) return;
    this.editorMode.beginDraft(brushKey);
  }

  refreshUndoButton() {
    this.brushPanel.setUndoEnabled(this.editorMode.canUndo);
  }

  undoEditor() {
    this.editorMode.undo();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.setEraseMode(false);
    this.editorMode.setManualMode(false);
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
    for (const zone of this.mapLayout.zones) {
      if (!removing && zone.brush === draft.brushKey) same.push(...zone.cells);
      else other.push(...zone.cells);
    }

    const draftCells = [];
    for (const key of draft.cells) {
      const [cx, cz] = key.split(',').map(Number);
      draftCells.push([cx, cz]);
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

  renderMapLayout(editorLayout) {
    const map = getMap(this.mapKey);
    this.mapLayout = editorLayout;
    const layout = generateLayout(this.mapKey, editorLayout);
    if (this.decoSystem.canUpdatePath(editorLayout)) {
      this.decoSystem.updatePath(layout);
      this.decoSystem.updateWater(layout);
      this.decoSystem.rememberLayout(editorLayout);
      return;
    }
    this.decoHighlight.clear();
    this.decoSystem.create(layout, map.colors);
    this.decoSystem.rememberLayout(editorLayout);
  }

  toggleEditorPanel(active) {
    if (active) {
      this.editorHud.show();
      this.editorHud.setMode(this.editorMode.mode);
      this.editorHud.setHeightLevel(this.editorMode.heightLevel);
    } else {
      this.editorHud.hide();
      this.gridSystem.clearBrush();
    }
  }

  exitEditor() {
    this.editorMode.cancelDraft();
    this.editorMode.active = false;
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.gridSystem.clearBrush();
    this.gridSystem.clearZones();
    this.gridSystem.clearDraftCells();
    this.toggleEditorPanel(false);
  }

  buildMapLayout() {
    const map = getMap(this.mapKey);
    const saved = this.loadSavedLayout();
    const data = saved || (this.mapKey === 'glade' ? gladeLayoutData : null);
    this.mapLayout = data
      ? normalizeLayout(data, map.seed)
      : normalizeLayout(buildGladeLayout(this.mapKey), map.seed);
    this.editorMode.attach(this.mapLayout);
    return generateLayout(this.mapKey, this.mapLayout);
  }

  loadSavedLayout() {
    const payload = readJSON(SAVE_STORAGE_KEY);
    if (!payload || payload.version !== SAVE_VERSION || !payload.state) return null;
    const maps = payload.state.mapLayouts;
    if (!maps || typeof maps !== 'object') return null;
    return maps[this.mapKey] || null;
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

    this.shadowGenerator = new ShadowGenerator(1024, dir);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = light.shadowBlur;

    this.dayNightSystem.create(map);
    this.dayNightSystem.attach(dir, hemi);
    this.dayNightSystem.apply();
  }

  setupShadowCasters() {
    const ground = this.terrainSystem.ground;
    if (ground) ground.receiveShadows = true;
  }

  setupOptions() {
    const saved = readJSON(OPTIONS_STORAGE_KEY);
    this.optionsPanel.values = { ...OPTION_DEFAULTS, ...(saved || {}) };
    this.options = { ...this.optionsPanel.values };
    this.applyOptions();
    this.optionsPanel.mount();
    this.optionsPanel.render();
    this.optionsPanel.onChange = (values) => {
      this.options = { ...values };
      this.autoScale = 1;
      writeJSON(OPTIONS_STORAGE_KEY, values);
      this.applyOptions();
    };
  }

  addShadowCaster(mesh) {
    if (!mesh || this.shadowCasters.includes(mesh)) return;
    this.shadowCasters.push(mesh);
    if (this.options.shadows) this.shadowGenerator.addShadowCaster(mesh);
  }

  applyOptions() {
    const qualityScale = QUALITY_SCALES[this.options.quality] ?? 1;
    this.renderScale = qualityScale;
    this.engine.setHardwareScalingLevel(1 / (qualityScale * this.autoScale));
    this.cameraSystem.applyOrtho();
    this.engine.maxFPS = this.options.fpsCap > 0 ? this.options.fpsCap : undefined;
    this.simSystem.setSpeed(this.options.gameSpeed);
    this.refreshClock();
    this.shadowGenerator.getShadowMap().renderList = this.options.shadows ? this.shadowCasters.slice() : [];
    this.decoHighlight.setVisible(this.options.highlights);
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
    });
    this.simSystem.onTick = () => this.refreshClock();
    this.simSystem.setSpeed(this.options.gameSpeed);
    this.refreshClock();
  }

  refreshClock() {
    const cfg = this.dayNightSystem.config;
    const time = this.dayNightSystem.getTime();
    const minutes = Math.floor(time * 24 * 60) % (24 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    this.hud.setClockText(`${hh}:${mm}`);
    this.hud.setClockPhase(this.describeDayPhase(time, cfg));
    this.hud.setClockSpeed(this.simSystem.isPaused(), this.simSystem.speed);
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
    this.hud.mount();
    this.hud.setCount(this.buildSystem.count);
    this.hud.setStatusVisible(false);
    this.hotbar.mount();
    this.hotbar.onSelect = (key) => this.setHeldTool(key);
    this.hotbar.setHeld(this.heldTool);
  }

  setHeldTool(key) {
    this.heldTool = key || null;
    this.hud.setStatusVisible(Boolean(this.heldTool));
    this.hotbar.setHeld(this.heldTool);
    if (!this.heldTool) {
      this.gridSystem.hideHighlight();
      this.gridSystem.hideHologram();
      this.clearMark();
    } else if (this.hoverCell) {
      this.handleHover(this.hoverCell);
    }
  }

  setupInput() {
    this.inputSystem.suppressContextMenu(this.canvas);
    this.inputSystem.groundPredicate = (mesh) => mesh === this.terrainSystem.ground;
    this.inputSystem.attach(this.camera);
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
    this.saveSystem.registerState('player', {
      serialize: () => this.playerSystem.serialize(),
      apply: (data) => this.playerSystem.apply(data),
      order: 5,
    });
    this.saveSystem.registerState('machines', {
      serialize: () => this.buildSystem.serialize(),
      apply: (data) => this.buildSystem.apply(data),
      order: 10,
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
    this.saveSystem.registerState('mapLayouts', {
      serialize: () => ({ [this.mapKey]: cloneLayout(this.mapLayout) }),
      apply: (data) => {
        const raw = data && typeof data === 'object' ? data[this.mapKey] : null;
        if (!raw) return;
        const map = getMap(this.mapKey);
        this.mapLayout = normalizeLayout(raw, map.seed);
        this.editorMode.attach(this.mapLayout);
        this.renderMapLayout(this.mapLayout);
        this.decoSystem.rememberLayout(this.mapLayout);
      },
      order: 1,
    });
  }

  registerHudEvents() {
    window.addEventListener('keydown', (evt) => this.handleKey(evt));
    window.addEventListener('blur', () => this.simSystem.resetAccumulator());
  }

  togglePause() {
    const paused = this.simSystem.isPaused();
    this.optionsPanel.patch({ gameSpeed: paused ? 1 : 0 });
  }

  handleKey(evt) {
    const typing = evt.target && (evt.target.tagName === 'INPUT' || evt.target.tagName === 'TEXTAREA' || evt.target.isContentEditable);
    if (evt.key === ' ' && !typing) {
      evt.preventDefault();
      this.togglePause();
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
      const active = this.editorMode.toggle();
      if (active) this.editorHud.setBrush(this.editorMode.brushKey);
      return;
    }
    if (evt.key === 'g' || evt.key === 'G') {
      if (!evt.repeat) this.toggleGrid();
      evt.preventDefault();
      return;
    }
    if (this.editorMode.active) {
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
      if ((evt.key === 'r' || evt.key === 'R') && this.editorMode.isManualBrush() && this.hoverCell) {
        this.editorMode.rotateAt(this.hoverCell.cx, this.hoverCell.cz);
        evt.preventDefault();
        this.handleHover(this.hoverCell);
        return;
      }
      if (/^[0-4]$/.test(evt.key)) {
        this.editorMode.setHeightLevel(Number(evt.key));
        evt.preventDefault();
        return;
      }
    }
    if (evt.key === 'b' || evt.key === 'B') {
      if (evt.ctrlKey || evt.metaKey || evt.altKey || typing) return;
      evt.preventDefault();
      this.setHeldTool(this.heldTool ? null : 'builder');
      return;
    }
    if (evt.key === 'm' || evt.key === 'M') this.cycleMachine();
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

  cycleMachine() {
    if (!this.heldTool) return;
    const index = MACHINE_KEYS.indexOf(this.currentMachine);
    this.currentMachine = MACHINE_KEYS[(index + 1) % MACHINE_KEYS.length];
    this.previewRotation = 0;
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
    this.refreshHoverPreview();
  }

  rotateHovered() {
    if (!this.heldTool) return;
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
    if (!this.hoverCell || !this.heldTool || this.editorMode.active) return;
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
      if (this.editorMode.hasDraft && this.editorMode.mode !== 'height') {
        this.gridSystem.clearBrush();
      } else {
        this.gridSystem.showBrush([[cell.cx, cell.cz]], (cx, cz) => this.decoSystem.surfaceAt(cx, cz), this.editorMode.erasing);
      }
      const info = this.editorMode.describeAt(cell.cx, cell.cz);
      const brush = info.brush ? `zóna: ${info.brush}` : 'bez zóny';
      const manual = info.manual ? ` · ruční: ${info.manual.key}` : '';
      const override = info.override ? ` · dlážděno: ${info.override.key}` : '';
      const style = info.style ? ` · styl ${info.style}` : '';
      const height = ` · výška ${info.height === null ? '–' : info.height + ' m'}`;
      const draft = this.editorMode.draft ? ` · kreslím: ${this.editorMode.draft.brushKey}` : '';
      this.editorHud.setReadout(`${cell.cx}, ${cell.cz} — ${brush}${manual}${override}${style}${height}${draft}`);
      return;
    }
    this.moveGridHighlight(cell);
  }

  handlePaintStart(cell) {
    if (!cell) return;
    if (this.editorMode.active) {
      this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
      if (this.editorMode.mode === 'height') this.editorMode.paint(cell.cx, cell.cz);
      else if (this.editorMode.isManualBrush()) this.paintManual(cell);
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
      if (this.editorMode.mode === 'height') this.editorMode.paintRun(from, cell);
      else if (this.editorMode.isManualBrush()) this.paintManual(cell);
      else this.editorMode.draftRun(from, cell);
      this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
      this.handleHover(cell);
    }
  }

  handlePaintEnd() {
    this.lastPaintCell = null;
  }

  paintManual(cell) {
    if (this.editorMode.erasing) this.editorMode.deleteAt(cell.cx, cell.cz);
    else this.editorMode.placeAt(cell.cx, cell.cz);
  }

  moveGridHighlight(cell) {
    if (!cell || !this.heldTool) {
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
    if (!this.heldTool || this.editorMode.active || !this.currentMachine) {
      this.gridSystem.hideHologram();
      return;
    }
    const def = getMachine(this.currentMachine);
    if (!def) return;
    this.gridSystem.showHologram(this.currentMachine, def, cell.cx, cell.cz, topY, this.previewRotation, valid);
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
    if (!cell || !this.heldTool) return;
    if (this.editorMode.active) {
      this.editorMode.paint(cell.cx, cell.cz);
      return;
    }
    this.clearMark();
    const record = this.buildSystem.build(this.currentMachine, cell.cx, cell.cz, this.previewRotation);
    if (!record) return;
    for (const child of record.mesh.getChildMeshes()) this.addShadowCaster(child);
    this.addShadowCaster(record.mesh);
    record.mesh.receiveShadows = true;
    this.hud.setCount(this.buildSystem.count);
    this.hud.setSaveHint('Neuloženo');
    this.handleHover(cell);
  }

  handleCellRightClick(cell) {
    if (!cell || !this.heldTool) return;
    if (this.editorMode.active) {
      if (this.editorMode.isManualBrush()) {
        this.editorMode.deleteAt(cell.cx, cell.cz);
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
      this.editorMode.draftCell(cell.cx, cell.cz);
      return;
    }
    const result = this.buildSystem.toggleMark(cell.cx, cell.cz);

    if (result.removed) {
      this.gridSystem.clearMark();
      this.refreshShadowCasters();
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

  saveMapLayout() {
    const ok = this.saveSystem.save();
    this.editorHud.setReadout(ok ? 'Mapa uložena ✓' : 'Uložení selhalo');
    return ok;
  }

  doLoad() {
    const ok = this.saveSystem.load();
    this.gridSystem.clearMark();
    this.hud.setCount(this.buildSystem.count);
    this.hud.setStatusVisible(Boolean(this.heldTool));
    this.refreshShadowCasters();
    this.refreshClock();
    this.hud.setSaveHint(ok ? 'Načteno ✓' : 'Žádný save');
  }

  refreshShadowCasters() {
    if (this.shadowCasters.length) {
      this.shadowGenerator.getShadowMap().renderList = this.options.shadows ? this.shadowCasters.slice() : [];
      return;
    }
    for (const record of this.buildSystem.machines.values()) {
      if (record.node) {
        for (const child of record.node.getChildMeshes()) this.shadowGenerator.addShadowCaster(child);
      } else {
        this.shadowGenerator.addShadowCaster(record.mesh);
      }
    }
  }

  onResize() {
    this.cameraSystem.onResize();
  }
}
