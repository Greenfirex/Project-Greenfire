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
import DayNightSystem from '../systems/dayNightSystem.js';
import InputSystem from '../systems/inputSystem.js';
import PlayerSystem from '../systems/playerSystem.js';
import BuildSystem from '../systems/buildSystem.js';
import SaveSystem from '../systems/saveSystem.js';
import Hud from '../ui/hud.js';
import EditorMode from '../systems/editorMode.js';
import EditorHud from '../ui/editorHud.js';
import BrushPanel from '../ui/brushPanel.js';
import TileThumbnails from '../ui/tileThumbnails.js';
import { MACHINE_KEYS, DEFAULT_MACHINE, getMachine } from '../data/catalogs/machines.js';
import { getBrush } from '../data/catalogs/brushes.js';
import { DEFAULT_MAP, getMap } from '../data/catalogs/maps.js';
import { SAVE_DEFAULTS } from '../data/catalogs/saveSchema.js';
import { buildGladeLayout } from '../data/maps/glade.js';
import gladeLayoutData from '../data/maps/glade/layout.json';
import { normalizeLayout } from '../data/maps/layoutStore.js';
import { generateLayout } from '../data/maps/mapGenerator.js';

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
    this.dayNightSystem = new DayNightSystem(scene);
    this.inputSystem = new InputSystem(scene);
    this.playerSystem = new PlayerSystem(scene);
    this.buildSystem = new BuildSystem(scene);
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();
    this.editorMode = new EditorMode();
    this.lastPaintCell = null;
    this.editorHud = new EditorHud();
    this.brushPanel = new BrushPanel();
    this.tileThumbs = null;

    this.camera = null;
    this.shadowGenerator = null;
    this.currentMachine = DEFAULT_MACHINE;
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
    this.setupPlayer();
    this.setupHud();
    this.setupInput();
    this.setupSave();
    this.registerHudEvents();

    this.buildSystem.onMachineReady = (record, node) => {
      for (const child of node.getChildMeshes()) this.shadowGenerator.addShadowCaster(child);
    };

    this.s.onBeforeRenderObservable.add(() => {
      const dt = this.engine.getDeltaTime() / 1000;
      this.dayNightSystem.update(dt);
      this.playerSystem.update(dt);
      const root = this.playerSystem.root;
      if (root) this.cameraSystem.follow(root.position.x, root.position.z, dt);
    });

    this.engine.runRenderLoop(() => this.s.render());
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
  }

  async setupPlayer() {
    this.playerSystem.blockedTest = (cx, cz) => this.buildSystem.isOccupied(cx, cz);
    this.playerSystem.onTeleport = (x, z) => this.cameraSystem.snapTo(x, z);
    const root = await this.playerSystem.create();
    if (!root) return;
    for (const child of root.getChildMeshes()) this.shadowGenerator.addShadowCaster(child);
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
    this.decoSystem.create(layout, map.colors);
    this.decoSystem.rememberLayout(this.mapLayout);
    this.tileThumbs = new TileThumbnails(this.s, map.colors);
    this.buildSystem.blockedTest = (cx, cz) => this.decoSystem.isBlocked(cx, cz);
    this.decoSystem.onDecoReady = (anchor, node, def) => {
      for (const child of node.getChildMeshes()) {
        child.isPickable = false;
        if (def.castsShadow) this.shadowGenerator.addShadowCaster(child);
      }
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
    this.editorHud.onErase = (on) => { this.editorMode.erasing = on; };
    this.editorHud.onUndo = () => this.undoEditor();
    this.editorHud.onMode = (mode) => this.editorMode.setMode(mode);
    this.editorHud.onHeightLevel = (level) => this.editorMode.setHeightLevel(level);
    this.editorHud.onHeightStep = (delta) => this.editorMode.stepHeightLevel(delta);
    this.editorHud.onSmooth = () => this.editorMode.smoothHeights();
    this.editorHud.onClose = () => this.exitEditor();
    this.editorHud.onBrushOpts = (key, opts) => this.setBrushOpts(key, opts);
    this.brushPanel.onThumbnail = (key, img) => this.fillThumbnail(key, img);
    this.brushPanel.onApply = () => this.applyBrushDraft();
    this.brushPanel.onCancel = () => this.cancelBrushDraft();
    this.brushPanel.onStyle = (brushKey, styleKey) => this.editorMode.setStyle(styleKey);
    this.brushPanel.onTile = (key) => this.editorMode.setTileKey(key);
    this.brushPanel.onManualMode = (on) => this.editorMode.setManualMode(on);
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
    const count = this.editorMode.applyDraft();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.refreshZoneOverlay();
    this.editorHud.setReadout(count ? `Aplikováno ${count} buněk` : 'Prázdná zóna');
  }

  cancelBrushDraft() {
    this.editorMode.cancelDraft();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.refreshZoneOverlay();
    this.handleHover(this.hoverCell);
  }

  undoEditor() {
    this.editorMode.undo();
    this.brushPanel.close();
    this.editorHud.clearBrushSelection();
    this.refreshZoneOverlay();
  }

  updateDraftView(draft) {
    if (!draft) {
      this.brushPanel.close();
      this.refreshZoneOverlay();
      return;
    }
    this.brushPanel.setCount(draft.cells.size);
    this.refreshZoneOverlay();
  }

  refreshZoneOverlay() {
    if (!this.editorMode.active || !this.mapLayout || !this.editorMode.hasDraft) {
      this.gridSystem.clearZones();
      this.gridSystem.clearDraftCells();
      return;
    }
    const draft = this.editorMode.draft;
    const surfaceAt = (cx, cz) => this.decoSystem.surfaceAt(cx, cz);
    const same = [];
    const other = [];
    for (const zone of this.mapLayout.zones) {
      if (zone.brush === draft.brushKey) same.push(...zone.cells);
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
        color: new Color3(0.15, 1, 0.85),
        glow: new Color3(0.2, 0.95, 0.8),
        alpha: 0.72,
        lift: 0.055,
      },
    ], surfaceAt);

    this.gridSystem.showDraftCells(draftCells, surfaceAt);
  }

  renderMapLayout(editorLayout) {
    const map = getMap(this.mapKey);
    this.mapLayout = editorLayout;
    const layout = generateLayout(this.mapKey, editorLayout);
    if (this.decoSystem.canUpdatePath(editorLayout)) {
      this.decoSystem.updatePath(layout);
      return;
    }
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
    const data = this.mapKey === 'glade' ? gladeLayoutData : null;
    this.mapLayout = data
      ? normalizeLayout(data, map.seed)
      : normalizeLayout(buildGladeLayout(this.mapKey), map.seed);
    this.editorMode.attach(this.mapLayout);
    return generateLayout(this.mapKey, this.mapLayout);
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

  setupHud() {
    this.hud.mount();
    this.hud.setCount(this.buildSystem.count);
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
  }

  registerHudEvents() {
    window.addEventListener('keydown', (evt) => this.handleKey(evt));
  }

  handleKey(evt) {
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
      if (evt.key === 'x' || evt.key === 'X') { this.editorMode.erasing = !this.editorMode.erasing; evt.preventDefault(); this.handleHover(this.hoverCell); return; }
      if (evt.key === 'z' || evt.key === 'Z') { this.editorMode.undo(); evt.preventDefault(); return; }
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
    const index = MACHINE_KEYS.indexOf(this.currentMachine);
    this.currentMachine = MACHINE_KEYS[(index + 1) % MACHINE_KEYS.length];
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
  }

  rotateHovered() {
    if (!this.hoverCell) return;
    const record = this.buildSystem.rotate(this.hoverCell.cx, this.hoverCell.cz);
    if (!record) return;
    const def = getMachine(record.type);
    this.hud.setSaveHint(`${def.displayName}: ${record.rotation * 90}°`);
  }

  handleHover(cell) {
    this.hoverCell = cell;
    if (this.editorMode.active) {
      this.gridSystem.hideHighlight();
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
      else if (this.editorMode.isManualBrush()) this.editorMode.placeAt(cell.cx, cell.cz);
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
      else if (this.editorMode.isManualBrush()) this.editorMode.placeAt(cell.cx, cell.cz);
      else this.editorMode.draftRun(from, cell);
      this.lastPaintCell = { cx: cell.cx, cz: cell.cz };
      this.handleHover(cell);
    }
  }

  handlePaintEnd() {
    this.lastPaintCell = null;
  }

  moveGridHighlight(cell) {
    if (!cell) {
      this.hoverCell = null;
      this.gridSystem.hideHighlight();
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
    this.hud.setCell(cell.cx, cell.cz, valid);
    this.hud.setHeight(topY);
    if (occupied) this.hud.setCellOccupied(this.describeMachine(cell.cx, cell.cz));
    else this.hud.setCellOccupied(null);
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
    this.clearMark();
    const record = this.buildSystem.build(this.currentMachine, cell.cx, cell.cz);
    if (!record) return;
    this.shadowGenerator.addShadowCaster(record.mesh);
    record.mesh.receiveShadows = true;
    this.hud.setCount(this.buildSystem.count);
    this.hud.setSaveHint('Neuloženo');
  }

  handleCellRightClick(cell) {
    if (!cell) return;
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

  doLoad() {
    const ok = this.saveSystem.load();
    this.gridSystem.clearMark();
    this.hud.setCount(this.buildSystem.count);
    this.refreshShadowCasters();
    this.hud.setSaveHint(ok ? 'Načteno ✓' : 'Žádný save');
  }

  refreshShadowCasters() {
    this.shadowGenerator.getShadowMap().renderList = [];
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