// Vývojový nástroj: vyfotí sérii póz tvora a slepí je do jednoho obrázku.
// Spouští se nad běžícím dev serverem: node tools/capture.cjs koa_tiki attack 10
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

function findBrowser() {
  const found = BROWSERS.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Nenašel jsem Edge ani Chrome.');
  return found;
}

const url = process.env.GREENFIRE_URL || 'http://localhost:5174/?capture';
const kind = process.argv[2] || 'koa_tiki';
const scene = process.argv[3] || 'walk';
const frames = Number(process.argv[4] || (scene === 'attack' ? 10 : 8));
const zoom = Number(process.argv[5] || 6.5);
const outDir = path.join(__dirname, '_temp');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    defaultViewport: { width: 900, height: 700 },
    args: ['--window-size=900,700', '--enable-unsafe-swiftshader', '--use-gl=angle'],
    windowsHide: true,
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.log('[stránka]', error.message));
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('[koa-tiki]')) console.log(text);
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => {
      const game = window.greenfire && window.greenfire.game;
      return Boolean(game && game.loaded && game.creatureSystem && game.creatureSystem.creatures.length);
    }, { timeout: 120000, polling: 500 });

    const result = await page.evaluate(async ({ wanted, sceneName, count, zoomLevel }) => {
      const { engine, s, game } = { engine: window.greenfire.engine, s: window.greenfire.scene, game: window.greenfire.game };
      game.paused = true;
      const list = (game.creatureSystem.creatures || []).filter((entry) => entry && entry.type && entry.type.rig);
      const creature = list.find((entry) => entry.kind === wanted) || list[0];
      if (!creature) return { error: 've scéně není žádný tvor s rigem' };
      const ground = game.terrainSystem.walkHeightAt(creature.x, creature.z);
      const holder = creature.holder || creature.root || null;
      const own = new Set(holder && holder.getChildMeshes ? holder.getChildMeshes() : []);
      if (holder) own.add(holder);
      for (const mesh of s.meshes) {
        if (own.has(mesh)) continue;
        mesh.setEnabled(false);
      }
      s.shadowsEnabled = false;
      s.clearColor.set(0.55, 0.6, 0.65, 1);
      if (holder) {
        holder.computeWorldMatrix(true);
      }
      if (holder && holder.getChildMeshes) {
        for (const child of holder.getChildMeshes()) child.alwaysSelectAsActiveMesh = true;
      }
      const meshes = holder && holder.getChildMeshes ? holder.getChildMeshes() : [];
      const bounds = holder && holder.getHierarchyBoundingVectors
        ? holder.getHierarchyBoundingVectors(true)
        : null;
      const center = bounds
        ? bounds.min.add(bounds.max).scale(0.5)
        : { x: creature.x, y: ground + 0.5, z: creature.z };
      const info = {
        kind: creature.kind,
        tier: creature.tierKey,
        x: Number(creature.x.toFixed(2)),
        z: Number(creature.z.toFixed(2)),
        ground: Number(ground.toFixed(2)),
        mode: creature.mode,
        meshes: meshes.length,
        visible: meshes.filter((mesh) => mesh.isEnabled() && mesh.isVisible).length,
        center: [center.x, center.y, center.z].map((value) => Number(value.toFixed(2))),
        holder: holder && holder.getAbsolutePosition
          ? [holder.getAbsolutePosition().x, holder.getAbsolutePosition().y, holder.getAbsolutePosition().z]
            .map((value) => Number(value.toFixed(2)))
          : null,
        size: bounds
          ? [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z]
            .map((value) => Number(value.toFixed(2)))
          : null,
      };
      const cs = game.creatureSystem;
      const terrain = game.terrainSystem;
      if (terrain && typeof terrain.cliffOverlap === 'function') {
        const playerRoot = game.playerSystem && game.playerSystem.root ? game.playerSystem.root.position : null;
        info.rise = {
          player: playerRoot ? Number(terrain.riseNear(playerRoot.x, playerRoot.z, 0.38).toFixed(2)) : null,
          creature: Number(terrain.riseNear(creature.homeX, creature.homeZ, 0.3).toFixed(2)),
          overlap: playerRoot ? Number(terrain.cliffOverlap(playerRoot.x, playerRoot.z).toFixed(2)) : null,
        };
      }
      if (cs && typeof cs.buildPath === 'function') {
        const clear = cs.pathClear(creature.x, creature.z, creature.homeX, creature.homeZ, creature.type);
        const route = cs.buildPath(creature, creature.homeX, creature.homeZ);
        info.pathToHome = { straight: clear, waypoints: route ? route.length : 0 };
        const playerPos = game.playerSystem && game.playerSystem.root ? game.playerSystem.root.position : null;
        if (playerPos) {
          const startX = creature.x;
          const startZ = creature.z;
          const speed = creature.type.walkSpeed * creature.tier.speed * 0.6;
          const dx = playerPos.x - startX;
          const dz = playerPos.z - startZ;
          const length = Math.hypot(dx, dz) || 1;
          creature.x = startX + (dx / length) * 10;
          creature.z = startZ + (dz / length) * 10;
          const startGap = Math.hypot(creature.x - creature.homeX, creature.z - creature.homeZ);
          creature.path = null;
          creature.pathClock = 0;
          creature.stuckTime = 0;
          creature.walking = false;
          for (let frame = 0; frame < 1200; frame += 1) {
            cs.moveTo(creature, creature.homeX, creature.homeZ, speed, 1 / 60);
            creature.walking = false;
          }
          info.homeSim = {
            from: Number(startGap.toFixed(1)),
            to: Number(Math.hypot(creature.x - creature.homeX, creature.z - creature.homeZ).toFixed(1)),
          };
          creature.x = startX;
          creature.z = startZ;
          creature.path = null;
          creature.pathClock = 0;
          creature.stuckTime = 0;
        }
      }
      game.cameraSystem.setZoom(zoomLevel);
      game.cameraSystem.snapTo(center.x, center.z, center.y);
      const cam = game.cameraSystem.camera;
      if (cam) {
        cam.alpha = (holder && Number.isFinite(holder.rotation.y) ? holder.rotation.y : 0) + Math.PI / 2;
        cam.beta = Math.PI / 3;
        const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
        const half = zoomLevel / 2;
        cam.orthoTop = half;
        cam.orthoBottom = -half;
        cam.orthoLeft = -half * aspect;
        cam.orthoRight = half * aspect;
        cam.getViewMatrix(true);
        cam.getProjectionMatrix(true);
      }
      info.zoom = [game.cameraSystem.zoom, cam ? cam.orthoTop - cam.orthoBottom : null];
      if (cam) {
        info.camTarget = [cam.target.x, cam.target.y, cam.target.z].map((value) => Number(value.toFixed(2)));
        info.camPos = [cam.position.x, cam.position.y, cam.position.z].map((value) => Number(value.toFixed(2)));
      }
      const target = meshes.find((mesh) => mesh.getTotalVertices && mesh.getTotalVertices() > 10000) || meshes[2];
      if (target) {
        if (target.skeleton && target.skeleton.prepare) target.skeleton.prepare();
        if (target.material && target.material.forceCompilationAsync) {
          await target.material.forceCompilationAsync(target);
        }
        for (let warm = 0; warm < 3; warm += 1) s.render();
      }
      if (target) {
        info.target = {
          name: target.name,
          ready: target.isReady ? target.isReady(true) : null,
          material: target.material ? target.material.name : null,
          materialReady: target.material && target.material.isReady ? target.material.isReady(target) : null,
          active: s.getActiveMeshes ? s.getActiveMeshes().data.indexOf(target) >= 0 : null,
          always: target.alwaysSelectAsActiveMesh,
          scale: [target.scaling.x, target.scaling.y, target.scaling.z],
          infinite: target.infiniteDistance,
        };
      }
      if (game.waterSystem && game.waterSystem.setReflectionExclusions) {
        game.waterSystem.setReflectionExclusions([]);
      }
      const walkInfo = (step) => ({ mode: 'roam', moving: true, engaged: false, moved: 0.55 * step });
      const idleInfo = { mode: 'idle', moving: false, engaged: false };
      const attackInfo = (index) => (index < 3
        ? { mode: 'windup', moving: false, engaged: true }
        : { mode: 'recover', moving: false, engaged: true });
      const canvas = engine.getRenderingCanvas();
      const baseY = holder ? holder.position.y : 0;
      const shots = [];
      for (let index = 0; index < count; index += 1) {
        const step = sceneName === 'attack'
          ? (index < 3 ? 0.12 : 0.07)
          : sceneName === 'idle' ? 0.3 : 0.45;
        const info = sceneName === 'attack' ? attackInfo(index) : sceneName === 'idle' ? idleInfo : walkInfo(step);
        const posed = creature.type.rig.pose(creature.rig, step, info);
        if (holder && posed && Number.isFinite(posed.bob)) holder.position.y = baseY + posed.bob;
        s.render();
        shots.push(canvas.toDataURL('image/png'));
      }

      const tileWidth = 420;
      const columns = Math.min(4, shots.length);
      const rows = Math.ceil(shots.length / columns);
      const scale = tileWidth / canvas.width;
      const tileHeight = Math.round(canvas.height * scale);
      const strip = document.createElement('canvas');
      strip.width = tileWidth * columns;
      strip.height = tileHeight * rows;
      const ctx = strip.getContext('2d');
      for (let index = 0; index < shots.length; index += 1) {
        const image = new Image();
        image.src = shots[index];
        await image.decode();
        const column = index % columns;
        const row = Math.floor(index / columns);
        ctx.drawImage(image, column * tileWidth, row * tileHeight, tileWidth, tileHeight);
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(String(index), column * tileWidth + 8, row * tileHeight + 24);
      }
      return { png: strip.toDataURL('image/png'), label: `${creature.kind}-${creature.tierKey || 'tier'}`, info };
    }, { wanted: kind, sceneName: scene, count: frames, zoomLevel: zoom });

    if (result.error) {
      console.error(result.error);
      return;
    }
    console.log('Tvor:', JSON.stringify(result.info));
    const base64 = result.png.split(',')[1];
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `pohled-${result.label}-${scene}.png`);
    fs.writeFileSync(file, Buffer.from(base64, 'base64'));
    console.log(`Uloženo: ${path.relative(process.cwd(), file)}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
