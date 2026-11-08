// Vývojový nástroj: otevře hru ve skrytém prohlížeči a vypíše chyby a varování z konzole.
// Spouští se nad běžícím dev serverem: node tools/checkConsole.cjs. Zkusí i pobyt v jeskyni.
const fs = require('node:fs');
const puppeteer = require('puppeteer-core');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const URL = process.env.GREENFIRE_URL || 'http://localhost:5174/';
const SETTLE_MS = 8000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function moveIntoCave(page) {
  return page.evaluate(() => {
    const { game } = window.greenfire;
    const cell = (game.terrainSystem.layout.floor || []).find((entry) => entry.level < 0 && Number.isFinite(entry.ceilY));
    if (!cell) return null;
    const player = game.playerSystem;
    const x = cell.cx * 2;
    const z = cell.cz * 2;
    player.level = cell.level;
    player.root.position.set(x, cell.liftY || 0, z);
    return { cx: cell.cx, cz: cell.cz, level: cell.level };
  });
}

async function shortUniformBuffers(page) {
  return page.evaluate(() => {
    const { scene, engine } = window.greenfire;
    const gl = engine._gl;
    const found = new Map();
    for (const mesh of scene.meshes) {
      for (const subMesh of mesh.subMeshes || []) {
        const effect = subMesh.effect;
        const material = subMesh.getMaterial && subMesh.getMaterial();
        const program = effect && effect.getPipelineContext() && effect.getPipelineContext().program;
        if (!program || !material || !material._uniformBuffer) continue;
        const index = gl.getUniformBlockIndex(program, 'Material');
        if (index === gl.INVALID_INDEX) continue;
        const needed = gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_DATA_SIZE);
        const data = material._uniformBuffer._data || [];
        const has = data.length * 4;
        if (has >= needed) continue;
        const known = material._uniformBuffer._uniformLocations || {};
        const members = gl.getActiveUniformBlockParameter(program, index, gl.UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES);
        const missing = [...members].map((member) => gl.getActiveUniform(program, member).name).filter((name) => !(name in known));
        found.set(material.name, { needed, has, missing, plugins: material.pluginManager._plugins.map((plugin) => plugin.name) });
      }
    }
    return [...found].map(([name, info]) => ({ name, ...info }));
  });
}

async function dryPitReport(page) {
  return page.evaluate(() => {
    const { game } = window.greenfire;
    const entry = (game.mapFile.floor || []).find((item) => item.cx === -15 && item.cz === -5 && !item.level);
    if (!entry) return null;
    const original = entry.liftY;
    entry.liftY = -0.75;
    game.refreshTerrain();
    const water = game.waterSystem;
    const report = {
      terrain: game.terrainSystem.heightAt(-30, -10),
      waterHeight: water.heightAt(-30, -10),
      depth: water.depthAt(-30, -10),
      cliff: water.cliffAt(-30, -10),
      level: water.level,
      sameLayout: game.terrainSystem.layout === game.mapFile,
    };
    entry.liftY = original;
    game.refreshTerrain();
    return report;
  });
}

async function floorEditorReport(page) {
  const open = await page.evaluate(() => {
    const { game } = window.greenfire;
    const { editor } = game;
    if (!editor.active) game.toggleEditorMode();
    editor.mode.setMode('floors');
    editor.floorPanel.onSelect(-1);
    return editor.floorPanelView();
  });
  await sleep(SETTLE_MS);
  const raised = await page.evaluate(() => {
    const { editor } = window.greenfire.game;
    const before = editor.currentFloorReport().low.length;
    editor.floorPanel.onRaise();
    const after = editor.currentFloorReport();
    return { before, after: after.low.length, pierced: after.pierced.length };
  });
  console.log(`  zvednutí stropu: ${JSON.stringify(raised)}`);
  await sleep(SETTLE_MS);
  await page.evaluate(() => window.greenfire.game.editor.undo());
  await sleep(SETTLE_MS);
  await page.evaluate(() => {
    const { game } = window.greenfire;
    const { editor } = game;
    editor.floorPanel.onAdd();
    editor.mode.addAreaCells([[0, 0], [1, 0]]);
    editor.applyAreaSelection();
    return true;
  });
  console.log('  vykopáno');
  await sleep(SETTLE_MS);
  const broken = await page.evaluate(() => {
    const names = new Set();
    for (const mesh of window.greenfire.scene.meshes) {
      for (const subMesh of mesh.subMeshes || []) {
        const effect = subMesh.effect;
        if (effect && effect.getCompilationError()) names.add(`${mesh.name}: ${effect.getCompilationError().slice(0, 400)}`);
      }
    }
    return [...names];
  });
  if (broken.length) console.log(broken.join(' | '));
  const result = await page.evaluate(() => {
    const { editor } = window.greenfire.game;
    const report = editor.currentFloorReport();
    const floors = editor.mode.floorList().length;
    editor.undo();
    return { sealed: report.sealed, floors, afterUndo: editor.mode.floorEntries().length };
  });
  await sleep(SETTLE_MS);
  await page.evaluate(() => window.greenfire.game.editor.close());
  await sleep(SETTLE_MS);
  return { floors: open.floors, report: { doors: open.report.doors, low: open.report.low.length, pierced: open.report.pierced.length, sealed: open.report.sealed }, dug: result };
}

async function run() {
  const executablePath = BROWSERS.find((candidate) => fs.existsSync(candidate));
  if (!executablePath) throw new Error('Nenašel jsem Edge ani Chrome.');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    defaultViewport: { width: 900, height: 700 },
    args: ['--window-size=900,700', '--enable-unsafe-swiftshader', '--use-gl=angle'],
    windowsHide: true,
  });
  const problems = new Map();
  let phase = 'načítání';
  const note = (text) => {
    if (!problems.has(text)) console.log(`  (první výskyt při: ${phase}) ${text.slice(0, 160)}`);
    problems.set(text, (problems.get(text) || 0) + 1);
  };
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => note(`[stránka] ${error.message}`));
    page.on('response', (response) => {
      if (response.status() >= 400) note(`[soubor ${response.status()}] ${response.url()}`);
    });
    page.on('console', (message) => {
      const type = message.type();
      const text = message.text();
      if (type === 'error' || type === 'warn' || type === 'warning' || /error/i.test(text)) note(`[${type}] ${text}`);
    });
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => Boolean(window.greenfire && window.greenfire.game && window.greenfire.game.loaded), { timeout: 240000, polling: 500 });
    console.log('Svět je načtený.');
    phase = 'běh hry';
    await sleep(SETTLE_MS);
    console.log(`Zkušební jáma na −15, −5: ${JSON.stringify(await dryPitReport(page))}`);
    phase = 'pobyt v jeskyni';
    const cave = await moveIntoCave(page);
    console.log(cave ? `Hráč přesunut do jeskyně: ${JSON.stringify(cave)}` : 'V mapě není jeskyně.');
    await sleep(SETTLE_MS);
    phase = 'editor pater';
    console.log(`Editor pater: ${JSON.stringify(await floorEditorReport(page))}`);
    for (const item of await shortUniformBuffers(page)) note(`[materiál] ${JSON.stringify(item)}`);
    if (cave) {
      const amount = await page.evaluate(() => window.greenfire.game.revealSystem.state.amount);
      const mouths = await page.evaluate(() => window.greenfire.game.revealSystem.litCells);
      console.log(`Rentgen otevřený na: ${amount.toFixed(2)}, osvětlených buněk u vchodů: ${mouths}`);
    }
  } finally {
    await browser.close();
  }
  if (!problems.size) {
    console.log('Konzole je čistá.');
    return;
  }
  console.log(`Nalezeno různých hlášek: ${problems.size}`);
  for (const [text, count] of problems) console.log(`${count}× ${text.slice(0, 1500)}`);
  process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
