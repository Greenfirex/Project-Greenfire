// Vstupní bod hry — nastartuje Babylon engine, plátno a herní scénu.
import '@babylonjs/core/Engines/Extensions/engine.dynamicTexture';
import '@babylonjs/core/Engines/Extensions/engine.rawTexture';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Effect } from '@babylonjs/core/Materials/effect';
import { Scene } from '@babylonjs/core/scene';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import GameScene from './scenes/GameScene.js';

Effect.PersistentMode = true;

const canvas = document.getElementById('render-canvas');
const engine = new Engine(canvas, false, {
  stencil: true,
  disableWebGL2Support: false,
  adaptToDeviceRatio: true,
});

const scene = new Scene(engine);
scene.clearColor = new Color4(0.05, 0.06, 0.08, 1);

const game = new GameScene(scene, engine, canvas);
game.start();

window.addEventListener('resize', () => {
  engine.resize();
  game.onResize();
});

window.greenfire = { engine, scene, game };

if (import.meta.env.DEV) {
  let inspectorToken = null;
  const toggleInspector = async () => {
    if (inspectorToken) {
      inspectorToken.dispose();
      inspectorToken = null;
      return;
    }
    const { ShowInspector } = await import('@babylonjs/inspector');
    inspectorToken = ShowInspector(scene, {});
  };
  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.altKey || event.code !== 'KeyI') return;
    event.preventDefault();
    toggleInspector();
  });
  if (new URLSearchParams(window.location.search).has('inspector')) toggleInspector();
}
