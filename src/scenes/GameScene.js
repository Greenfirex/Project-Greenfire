// Herní scéna — orchestrátor. Drží stav světa, deleguje na systémy a řídí HUD.
// Systémy dostávají scénu v konstruktoru a přistupují k ní přes this.s.
import '@babylonjs/core/Lights/hemisphericLight';
import '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';

import CameraSystem from '../systems/cameraSystem.js';
import GridSystem from '../systems/gridSystem.js';
import InputSystem from '../systems/inputSystem.js';
import BuildSystem from '../systems/buildSystem.js';
import SaveSystem from '../systems/saveSystem.js';
import Hud from '../ui/hud.js';
import { MACHINE_KEYS, DEFAULT_MACHINE, getMachine } from '../data/catalogs/machines.js';

export default class GameScene {

  constructor(scene, engine, canvas) {
    this.s = scene;
    this.engine = engine;
    this.canvas = canvas;

    this.cameraSystem = new CameraSystem(scene);
    this.gridSystem = new GridSystem(scene);
    this.inputSystem = new InputSystem(scene);
    this.buildSystem = new BuildSystem(scene);
    this.saveSystem = new SaveSystem(this);
    this.hud = new Hud();

    this.camera = null;
    this.shadowGenerator = null;
    this.currentMachine = DEFAULT_MACHINE;
    this.hoverCell = null;
  }

  start() {
    this.setupLighting();
    this.camera = this.cameraSystem.create();
    this.gridSystem.create();
    this.setupShadowCasters();
    this.setupHud();
    this.setupInput();
    this.setupSave();
    this.registerHudEvents();

    this.engine.runRenderLoop(() => this.s.render());
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
  }

  setupLighting() {
    const hemi = new HemisphericLight('skyLight', new Vector3(0.3, 1, 0.2), this.s);
    hemi.intensity = 0.65;
    hemi.groundColor = new Color3(0.18, 0.2, 0.24);

    const dir = new DirectionalLight('sunLight', new Vector3(-0.5, -1, 0.4), this.s);
    dir.position = new Vector3(22, 34, -18);
    dir.intensity = 1.1;

    this.shadowGenerator = new ShadowGenerator(1024, dir);
    this.shadowGenerator.useBlurExponentialShadowMap = true;
    this.shadowGenerator.blurKernel = 24;
  }

  setupShadowCasters() {
    this.gridSystem.ground.receiveShadows = true;
  }

  setupHud() {
    this.hud.mount();
    this.hud.setCount(this.buildSystem.count);
  }

  setupInput() {
    this.inputSystem.attach(this.camera);
    this.inputSystem.onHoverCell = (cell) => this.handleHover(cell);
    this.inputSystem.onCellClick = (cell) => this.handleCellClick(cell);
    this.inputSystem.onZoom = (delta) => {
      this.cameraSystem.zoomBy(delta);
      this.cameraSystem.applyOrtho();
    };
  }

  setupSave() {
    this.saveSystem.registerState('machines', {
      serialize: () => this.buildSystem.serialize(),
      apply: (data) => this.buildSystem.apply(data),
      order: 10,
    });
  }

  registerHudEvents() {
    window.addEventListener('keydown', (evt) => this.handleKey(evt));
  }

  handleKey(evt) {
    if (evt.key === 'm' || evt.key === 'M') this.cycleMachine();
    if (evt.key === 'F5') {
      evt.preventDefault();
      this.doSave();
    }
    if (evt.key === 'F9') {
      evt.preventDefault();
      this.doLoad();
    }
  }

  cycleMachine() {
    const index = MACHINE_KEYS.indexOf(this.currentMachine);
    this.currentMachine = MACHINE_KEYS[(index + 1) % MACHINE_KEYS.length];
    this.hud.setMachine(getMachine(this.currentMachine).displayName);
  }

  handleHover(cell) {
    if (!cell) {
      this.hoverCell = null;
      this.gridSystem.hideHighlight();
      this.hud.setCell(null, null, true);
      return;
    }
    const valid = this.buildSystem.canBuild(cell.cx, cell.cz);
    this.hoverCell = cell;
    this.gridSystem.setHighlight(cell.cx, cell.cz);
    this.gridSystem.setHighlightValid(valid);
    this.hud.setCell(cell.cx, cell.cz, valid);
  }

  handleCellClick(cell) {
    const record = this.buildSystem.build(this.currentMachine, cell.cx, cell.cz);
    if (!record) return;
    this.shadowGenerator.addShadowCaster(record.mesh);
    record.mesh.receiveShadows = true;
    this.hud.setCount(this.buildSystem.count);
    this.hud.setSaveHint('Neuloženo');
  }

  doSave() {
    const ok = this.saveSystem.save();
    this.hud.setSaveHint(ok ? 'Uloženo ✓' : 'Uložení selhalo');
  }

  doLoad() {
    const ok = this.saveSystem.load();
    this.hud.setCount(this.buildSystem.count);
    this.shadowGenerator.getShadowMap().renderList = [];
    for (const record of this.buildSystem.machines.values()) {
      this.shadowGenerator.addShadowCaster(record.mesh);
    }
    for (const mesh of this.s.meshes) mesh.receiveShadows = true;
    this.hud.setSaveHint(ok ? 'Načteno ✓' : 'Žádný save');
  }

  onResize() {
    this.cameraSystem.onResize();
  }
}
