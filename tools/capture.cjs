// Vývojový nástroj: vyfotí tvora nebo postavu ve fotoateliéru (tools/capture/stage.html) a složí snímky do jednoho obrázku.
// Spouští se nad běžícím dev serverem: node tools/capture.cjs koa_tiki peck --view side
// Scény: idle, walk, tracks (chůze se stopami), attack (--attack peck|jump), hit, death, peck. Pohledy: side, side2 (z druhé strany), front, diag, top.
// Postava: node tools/capture.cjs player idle --sheath saber --wear pirate_coat,pirate_pants --focus hip --zoom 1.3
// Portrét do bestiáře: node tools/capture.cjs gnaw_rat idle --portrait 1
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer-core');

const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const STAGE_URL = process.env.GREENFIRE_URL || 'http://localhost:5174/tools/capture/stage.html';
const OUT_DIR = path.join(__dirname, '_temp');
const PORTRAIT_DIR = path.join(__dirname, '..', 'public', 'assets', 'ui', 'bestiary');
const PORTRAIT_SIZE = 384;
const PORTRAIT_PAD = 0.06;

function readOptions(argv) {
  const options = { kind: argv[0] || 'koa_tiki', scene: argv[1] || 'idle', view: 'side' };
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index].replace(/^--/, '');
    const value = argv[index + 1];
    index += 1;
    options[key] = ['frames', 'zoom', 'seconds', 'lead', 'kneel', 'lid'].includes(key) ? Number(value) : value;
  }
  return options;
}

function findBrowser() {
  const found = BROWSERS.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error('Nenašel jsem Edge ani Chrome.');
  return found;
}

async function makeSheet(page, result) {
  return page.evaluate(async ({ frames, groundLine }) => {
    const tileWidth = 420;
    const first = new Image();
    first.src = frames[0].image;
    await first.decode();
    const tileHeight = Math.round((first.height * tileWidth) / first.width);
    const columns = Math.min(4, frames.length);
    const rows = Math.ceil(frames.length / columns);
    const sheet = document.createElement('canvas');
    sheet.width = tileWidth * columns;
    sheet.height = tileHeight * rows;
    const ctx = sheet.getContext('2d');
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const image = new Image();
      image.src = frame.image;
      await image.decode();
      const x = (index % columns) * tileWidth;
      const y = Math.floor(index / columns) * tileHeight;
      ctx.drawImage(image, x, y, tileWidth, tileHeight);
      if (groundLine !== null) {
        ctx.strokeStyle = '#d02020';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + groundLine * tileHeight);
        ctx.lineTo(x + tileWidth, y + groundLine * tileHeight);
        ctx.stroke();
      }
      ctx.strokeStyle = '#30343a';
      ctx.strokeRect(x, y, tileWidth, tileHeight);
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`${index}  ${frame.time.toFixed(2)} s ${frame.label}`, x + 8, y + 22);
    }
    return sheet.toDataURL('image/png');
  }, { frames: result.frames, groundLine: result.groundLine });
}

async function makePortrait(page, image) {
  return page.evaluate(async ({ source, size, pad }) => {
    const picture = new Image();
    picture.src = source;
    await picture.decode();
    const scratch = document.createElement('canvas');
    scratch.width = picture.width;
    scratch.height = picture.height;
    const scratchCtx = scratch.getContext('2d');
    scratchCtx.drawImage(picture, 0, 0);
    const pixels = scratchCtx.getImageData(0, 0, picture.width, picture.height).data;
    let left = picture.width;
    let right = 0;
    let top = picture.height;
    let bottom = 0;
    for (let y = 0; y < picture.height; y += 1) {
      for (let x = 0; x < picture.width; x += 1) {
        if (pixels[(y * picture.width + x) * 4 + 3] < 8) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left) return null;
    const width = right - left + 1;
    const height = bottom - top + 1;
    const fit = (size * (1 - pad * 2)) / Math.max(width, height);
    const sheet = document.createElement('canvas');
    sheet.width = size;
    sheet.height = size;
    const ctx = sheet.getContext('2d');
    ctx.drawImage(scratch, left, top, width, height,
      (size - width * fit) / 2, (size - height * fit) / 2, width * fit, height * fit);
    return sheet.toDataURL('image/png');
  }, { source: image, size: PORTRAIT_SIZE, pad: PORTRAIT_PAD });
}

function printCreature(result) {
  console.log(`Tvor ${result.creature}: délka ${result.length} m, výška ${result.height} m`);
  console.log('Výška nad zemí v m (záporné = pod zemí). Celé tělo: nejnižší bod a kde leží (vpředu +, vzadu −).');
  console.log('Přední část: nejnižší bod v přední čtvrtině délky (hlava, krk).');
  result.frames.forEach((frame, index) => {
    const all = `${String(frame.lowest).padStart(7)} na ${String(frame.lowestAt).padStart(5)}`;
    console.log(`  ${index}  ${frame.time.toFixed(2)} s ${frame.label.padEnd(4)} tělo ${all}   přední část ${String(frame.front).padStart(7)}`);
  });
}

function printPlayer(result) {
  console.log(`Postava ${result.creature}: výška ${result.height} m. Postava kouká na +z (k pohledu front).`);
  console.log('Ruka: výška pravé ruky nad zemí. Nástroj: směr osy (x, y, z; y kladné = nahoru), výška spodku a vršku nad zemí, odstup úchopu od dlaně.');
  result.frames.forEach((frame, index) => {
    const tool = frame.tool;
    const text = tool
      ? `osa [${tool.axis.join(', ')}]  spodek ${tool.bottom} m  vršek ${tool.top} m  od dlaně ${tool.hand} m${tool.sheath ? `  od úchytu na boku ${tool.sheath.total} m (vpřed ${tool.sheath.ahead}, nahoru ${tool.sheath.up})` : ''}`
      : 'bez nástroje';
    console.log(`  ${index}  ${frame.time.toFixed(2)} s ${frame.label.padEnd(12)} ruka ${frame.hand} m  ${text}`);
  });
}

async function run() {
  const options = readOptions(process.argv.slice(2));
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: 'new',
    defaultViewport: { width: 900, height: 700 },
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle'],
    windowsHide: true,
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => console.log('[stránka]', error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') console.log(`[${message.type()}]`, message.text());
    });
    try {
      await page.goto(STAGE_URL, { waitUntil: 'load', timeout: 30000 });
    } catch {
      throw new Error(`Dev server neodpovídá na ${STAGE_URL}. Běží?`);
    }
    await page.waitForFunction(() => window.stage && window.stage.ready, { timeout: 60000 });
    const result = await page.evaluate((wanted) => window.stage.run(wanted), options);
    if (result.error) throw new Error(result.error);
    if (options.portrait) {
      const portrait = await makePortrait(page, result.frames[0].image);
      if (!portrait) throw new Error('Na snímku není žádný tvor.');
      fs.mkdirSync(PORTRAIT_DIR, { recursive: true });
      const file = path.join(PORTRAIT_DIR, `${options.kind}.png`);
      fs.writeFileSync(file, Buffer.from(portrait.split(',')[1], 'base64'));
      console.log(`Portrét uložen: ${path.relative(process.cwd(), file)}`);
      return;
    }
    const png = await makeSheet(page, result);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const file = path.join(OUT_DIR, `snimky-${result.creature}-${options.scene}-${options.view}${options.focus ? `-${options.focus}` : ''}.png`);
    fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
    if (result.player) printPlayer(result);
    else printCreature(result);
    console.log(`Uloženo: ${path.relative(process.cwd(), file)}`);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
