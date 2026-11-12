// Fotoateliér pro hratelnou postavu: stejná postava i úchop nástroje jako ve hře, jen v prázdné scéně.
// Spouští ho stage.js, když se místo tvora zadá "player"; ke snímkům změří, kam míří nástroj v ruce.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import PlayerSystem from '../../src/systems/player/playerSystem.js';
import { TOOL_TYPES } from '../../src/data/catalogs/items.js';

const STEP = 1 / 60;
const TOOL_WAIT_MS = 15000;
const LID_AHEAD = 0.65;
const SCENES = ['idle', 'walk', 'run', 'strike', 'pickup'];

function rounded(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

async function waitForTool(player) {
  const until = performance.now() + TOOL_WAIT_MS;
  while (!player.toolNode && performance.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return Boolean(player.toolNode);
}

function toolReport(player) {
  const node = player.toolNode;
  if (!node) return null;
  node.computeWorldMatrix(true);
  const meshes = node.getChildMeshes(false).filter((mesh) => mesh.getTotalVertices() > 0);
  const bounds = meshes.length ? node.getHierarchyBoundingVectors(true) : null;
  const axis = Vector3.TransformNormal(Vector3.Up(), node.getWorldMatrix()).normalize();
  const base = node.getAbsolutePosition();
  const hand = player.handSlot ? player.handSlot.getAbsolutePosition() : null;
  return {
    axis: [rounded(axis.x, 2), rounded(axis.y, 2), rounded(axis.z, 2)],
    base: rounded(base.y, 2),
    top: bounds ? rounded(bounds.max.y, 2) : null,
    bottom: bounds ? rounded(bounds.min.y, 2) : null,
    hand: hand ? rounded(Vector3.Distance(hand, base), 3) : null,
  };
}

export async function runPlayer(options, { scene, canvas, camera, aimCamera }) {
  const scenario = SCENES.includes(options.scene) ? options.scene : 'idle';
  const toolKey = options.tool || null;
  if (toolKey && !TOOL_TYPES[toolKey]) return { error: `neznámý nástroj: ${toolKey}` };
  scene.useConstantAnimationDeltaTime = true;
  const player = new PlayerSystem(scene);
  player.groundHeightAt = () => 0;
  const root = await player.create();
  if (!root) return { error: 'postava se nenačetla' };
  scene.onBeforeRenderObservable.add(() => player.updateFire());
  if (toolKey) {
    player.heldToolKey = toolKey;
    player.refreshToolNode();
    if (!(await waitForTool(player))) return { error: `model nástroje se nenačetl: ${toolKey}` };
  }
  if (options.combat) player.inCombat = () => true;
  if (options.glance) player.glance.wait = 0.3;
  player.play(player.idleAnim(), true);
  await scene.whenReadyAsync();
  scene.render();

  const bounds = root.getHierarchyBoundingVectors(true);
  const height = bounds.max.y - bounds.min.y;
  aimCamera({ height, length: height * 0.6 }, options);
  const focusOn = { hand: () => player.handSlot, head: () => player.idleNodes && player.idleNodes.head }[options.focus];

  const tool = TOOL_TYPES[toolKey];
  const anim = options.anim || (tool && tool.weapon ? tool.weapon.anim : undefined);
  const actions = {
    strike: () => player.strike(anim),
    pickup: () => player.pickUp(),
  };
  const action = actions[scenario] || null;
  const lead = action ? options.lead || 0 : 0;
  let seconds = options.seconds || 2;
  if (action) {
    const length = action();
    player.strikeTimer = 0;
    player.pickupTimer = 0;
    player.play(player.idleAnim(), true);
    seconds = options.seconds || lead + length + (lead ? 0.5 : 0.2);
  }
  if (scenario === 'walk' || scenario === 'run') player.play(scenario, true);
  const moving = scenario === 'walk' || scenario === 'run';

  const count = Math.max(1, options.frames || 8);
  const shots = Array.from({ length: count }, (_, index) => (seconds * index) / Math.max(1, count - 1));
  const frames = [];
  let clock = 0;
  let started = !action;
  for (const time of shots) {
    while (clock + STEP <= time + 1e-9) {
      if (!started && clock >= lead - 1e-9) {
        action();
        if (options.lid) player.reachTarget = new Vector3(0, options.lid, LID_AHEAD);
        started = true;
      }
      player.kneeling = Boolean(options.kneel) && clock < lead + options.kneel;
      if (!moving) player.update(STEP);
      scene.render();
      clock += STEP;
    }
    const focus = focusOn ? focusOn() : null;
    if (focus) camera.target.copyFrom(focus.getAbsolutePosition());
    scene.render();
    frames.push({
      time: Number(time.toFixed(2)),
      label: player.currentKey || '',
      tool: toolReport(player),
      hand: player.handSlot ? rounded(player.handSlot.getAbsolutePosition().y, 2) : null,
      image: canvas.toDataURL('image/png'),
    });
  }
  return {
    player: true,
    creature: `postava-${toolKey || 'bez-nastroje'}`,
    height: Number(height.toFixed(2)),
    groundLine: null,
    frames,
  };
}
