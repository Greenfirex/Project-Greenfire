// Fotoateliér pro hratelnou postavu: stejná postava i úchop nástroje jako ve hře, jen v prázdné scéně.
// Spouští ho stage.js, když se místo tvora zadá "player"; ke snímkům změří, kam míří nástroj v ruce.
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import PlayerSystem from '../../src/systems/player/playerSystem.js';
import { TOOL_TYPES, ITEM_TYPES } from '../../src/data/catalogs/items.js';

const STEP = 1 / 60;
const TOOL_WAIT_MS = 15000;
const LID_AHEAD = 0.65;
const HIP_LENGTH = 0.8;
const SCENES = ['idle', 'walk', 'run', 'strike', 'dodge', 'pickup', 'draw', 'sheath', 'grab', 'putaway', 'eat', 'use'];
const EAT_LENGTH = 1.6;
const USE_LENGTH = 0.7;
const HIP_SCENES = ['draw', 'sheath', 'grab', 'putaway'];

function rounded(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

async function waitFor(check) {
  const until = performance.now() + TOOL_WAIT_MS;
  while (!check() && performance.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return Boolean(check());
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
    sheath: sheathGap(player, node),
  };
}

function sheathGap(player, node) {
  const tool = TOOL_TYPES[player.toolNodeKey];
  if (!player.sheathSlot || !tool || !tool.grip) return null;
  const grip = Vector3.TransformCoordinates(new Vector3(0, tool.grip.hold || 0, 0), node.getWorldMatrix());
  const gap = grip.subtract(player.sheathSlot.getAbsolutePosition());
  const forward = new Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  return { ahead: rounded(Vector3.Dot(gap, forward), 3), up: rounded(gap.y, 3), total: rounded(gap.length(), 3) };
}

export async function runPlayer(options, { scene, canvas, camera, aimCamera }) {
  const scenario = SCENES.includes(options.scene) ? options.scene : 'idle';
  const toolKey = options.tool || null;
  if (toolKey && !TOOL_TYPES[toolKey]) return { error: `neznámý nástroj: ${toolKey}` };
  if (toolKey && options.grip) Object.assign(TOOL_TYPES[toolKey].grip, JSON.parse(options.grip));
  scene.useConstantAnimationDeltaTime = true;
  const player = new PlayerSystem(scene);
  player.groundHeightAt = () => 0;
  const root = await player.create();
  if (!root) return { error: 'postava se nenačetla' };
  scene.onBeforeRenderObservable.add(() => player.updateFire());
  if (toolKey) {
    player.heldToolKey = toolKey;
    player.refreshToolNode();
    if (!(await waitFor(() => player.toolNode))) return { error: `model nástroje se nenačetl: ${toolKey}` };
  }
  const sheathKey = options.sheath || null;
  if (sheathKey) {
    if (!TOOL_TYPES[sheathKey]) return { error: `neznámá zbraň: ${sheathKey}` };
    player.setSheathedTool(sheathKey);
    if (!(await waitFor(() => player.sheathNode))) return { error: `zbraň na boku se neukázala: ${sheathKey}` };
    player.weaponDrawn = Boolean(toolKey);
  }
  for (const itemKey of (options.wear || '').split(',').filter(Boolean)) {
    const def = ITEM_TYPES[itemKey];
    if (!def || !def.slot || !def.wear) return { error: `neznámé oblečení: ${itemKey}` };
    player.wear(def.slot, def.wear);
    if (def.wear.fitted && !(await waitFor(() => player.fittedShown[def.slot]))) return { error: `oblečení se nenačetlo: ${itemKey}` };
  }
  const offHandKey = options.offhand || null;
  if (offHandKey) {
    if (!TOOL_TYPES[offHandKey]) return { error: `neznámý nástroj do levé ruky: ${offHandKey}` };
    player.setOffHandTool(offHandKey, true);
    if (!(await waitFor(() => player.offNode))) return { error: `nástroj v levé ruce se neukázal: ${offHandKey}` };
  }
  if (options.combat) player.inCombat = () => true;
  if (options.curlaxis) {
    const local = Vector3.FromArray(JSON.parse(options.curlaxis)).normalize();
    player.closeFist = function (curl, arm = this.armNodes) {
      if (!arm || !curl || !arm.fingers.length || !arm.fist.length) return null;
      const side = Vector3.TransformNormal(local, arm.hand.getWorldMatrix()).normalize();
      for (const node of arm.fingers) {
        const rest = arm.fingerRest.get(node);
        if (rest) node.rotationQuaternion.copyFrom(rest);
        this.turnBone(node, side, curl * (arm.curlSign || 1));
        node.computeWorldMatrix(true);
      }
      return this.fistCenter(arm);
    };
  }
  if (options.axis) {
    const local = Vector3.FromArray(JSON.parse(options.axis)).normalize();
    player.gripAxis = () => Vector3.TransformNormal(local, player.armNodes.hand.getWorldMatrix()).normalize();
  }
  if (options.glance) player.glance.wait = 0.3;
  player.play(player.idleAnim(), true);
  await scene.whenReadyAsync();
  scene.render();
  if (player.swingTrail) await player.swingTrail.mesh.material.forceCompilationAsync(player.swingTrail.mesh);

  const bounds = root.getHierarchyBoundingVectors(true);
  const height = bounds.max.y - bounds.min.y;
  aimCamera({ height, length: height * 0.6 }, options);
  const focusOn = { hand: () => player.handSlot, left: () => player.leftSlot, head: () => player.idleNodes && player.idleNodes.head, hip: () => player.sheathSlot }[options.focus];

  const tool = TOOL_TYPES[toolKey];
  const weaponAnim = tool && tool.weapon && tool.weapon.primary ? tool.weapon.primary.anim : undefined;
  const anim = options.anim || (Array.isArray(weaponAnim) ? weaponAnim[0] : weaponAnim);
  const actions = {
    strike: () => player.strike(anim),
    dodge: () => {
      player.dodge(0, 1);
      return player.dodgeTimer;
    },
    pickup: () => player.pickUp(),
    eat: () => {
      player.eat(ITEM_TYPES.mushroom.food.hold);
      return EAT_LENGTH;
    },
    use: () => {
      player.useToward(0.4, 2);
      return USE_LENGTH;
    },
    draw: () => {
      player.weaponDrawn = true;
      player.setHeldTool(sheathKey, false, true);
      return HIP_LENGTH;
    },
    sheath: () => {
      player.weaponDrawn = false;
      player.setHeldTool(null, false, true);
      return HIP_LENGTH;
    },
    grab: () => {
      player.setOffHandTool(options.grab);
      return HIP_LENGTH;
    },
    putaway: () => {
      player.setOffHandTool(null);
      return HIP_LENGTH;
    },
  };
  if ((scenario === 'draw' || scenario === 'sheath') && !sheathKey) return { error: 'tasení potřebuje --sheath <zbraň>' };
  if (scenario === 'grab' && !TOOL_TYPES[options.grab]) return { error: 'vytažení potřebuje --grab <nástroj>' };
  if (scenario === 'grab') {
    player.prefetchTool(options.grab);
    await waitFor(() => player.toolTemplates[TOOL_TYPES[options.grab].model]);
    player.setOffHandTool(options.grab, true);
    await scene.whenReadyAsync();
    scene.render();
    player.setOffHandTool(null, true);
  }
  if (scenario === 'eat') await player.prefetchMeal(ITEM_TYPES.mushroom.food.hold);
  const action = actions[scenario] || null;
  const lead = action ? options.lead || 0 : 0;
  let seconds = options.seconds || 2;
  if (action) {
    const length = HIP_SCENES.includes(scenario) ? HIP_LENGTH : action();
    player.strikeTimer = 0;
    player.pickupTimer = 0;
    player.dodgeTimer = 0;
    player.dodgeWait = 0;
    player.stopEating();
    player.useTimer = 0;
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
  const aimFocus = () => {
    const focus = focusOn ? focusOn() : null;
    if (focus) camera.target.copyFrom(focus.getAbsolutePosition());
  };
  for (const time of shots) {
    let stepped = false;
    while (clock + STEP <= time + 1e-9) {
      if (!started && clock >= lead - 1e-9) {
        action();
        if (options.lid) player.reachTarget = new Vector3(0, options.lid, LID_AHEAD);
        started = true;
      }
      player.kneeling = Boolean(options.kneel) && clock < lead + options.kneel;
      if (!moving) player.update(STEP);
      aimFocus();
      scene.render();
      clock += STEP;
      stepped = true;
    }
    if (!stepped) {
      aimFocus();
      scene.render();
    }
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
    creature: `postava-${toolKey || sheathKey || 'bez-nastroje'}`,
    height: Number(height.toFixed(2)),
    groundLine: null,
    frames,
  };
}
