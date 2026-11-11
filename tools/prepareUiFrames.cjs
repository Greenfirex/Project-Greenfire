// Připraví obrázky rámů oken z Gemini: odstraní purpurové pozadí, ořeže, zmenší a uloží do hry.
// Zdroje leží v _sources/ui-frame/, hotové obrázky jdou do public/assets/ui/frame/.
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, '_sources', 'ui-frame');
const TARGET = path.join(ROOT, 'public', 'assets', 'ui', 'frame');

const KEY_FROM = 40;
const KEY_TO = 150;
const TRIM_ALPHA = 8;

const FRAME_GEM = { left: 670, top: 40, width: 140, height: 130 };
const FRAME_GEM_PATCH_LEFT = 450;

const JOBS = [
  { from: 'ramokna.jpg', to: 'window-frame.png', width: 1024, gemTo: 'window-gem.png' },
  { from: 'polickanapredmet.png', to: 'slot.png', width: 192 },
  { from: 'button.jpg', to: 'button.png', width: 512 },
  { from: 'divider.jpg', to: 'divider.png', width: 768, keyFrom: 10, keyTo: 60, fadeEnds: 0.16 },
  { from: 'closecross.jpg', to: 'close.png', width: 96 },
  { from: 'vyplnokna.jpg', to: 'panel-fill.jpg', width: 1024, plain: true },
];

function keyMagenta(data, from = KEY_FROM, to = KEY_TO) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const spill = Math.max(0, Math.min(r, b) - g);
    data[i] = r - spill;
    data[i + 2] = b - spill;
    const t = Math.min(1, Math.max(0, (spill - from) / (to - from)));
    data[i + 3] = Math.round(data[i + 3] * (1 - t));
  }
}

function opaqueBounds(data, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < TRIM_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function copyBlock(data, width, from, to) {
  for (let y = 0; y < from.height; y++) {
    const src = ((from.top + y) * width + from.left) * 4;
    const dst = ((to.top + y) * width + to.left) * 4;
    data.copy(data, dst, src, src + from.width * 4);
  }
}

async function keyed(file, job) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  keyMagenta(data, job.keyFrom, job.keyTo);
  return { data, info };
}

async function save(data, info, crop, width, out) {
  const area = crop || opaqueBounds(data, info.width, info.height);
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract(area)
    .resize({ width: Math.min(width, area.width) })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`${path.basename(out)}: ${meta.width}x${meta.height}`);
}

async function run(job) {
  const input = path.join(SOURCE, job.from);
  const output = path.join(TARGET, job.to);
  if (job.plain) {
    await sharp(input).resize({ width: job.width }).jpeg({ quality: 82 }).toFile(output);
    const meta = await sharp(output).metadata();
    console.log(`${job.to}: ${meta.width}x${meta.height}`);
    return;
  }
  const { data, info } = await keyed(input, job);
  if (job.gemTo) {
    await save(Buffer.from(data), info, FRAME_GEM, FRAME_GEM.width, path.join(TARGET, job.gemTo));
    copyBlock(data, info.width, { ...FRAME_GEM, left: FRAME_GEM_PATCH_LEFT }, FRAME_GEM);
  }
  if (job.fadeEnds) fadeEnds(data, info, job.fadeEnds);
  await save(data, info, null, job.width, output);
}

function fadeEnds(data, info, share) {
  const bounds = opaqueBounds(data, info.width, info.height);
  const fade = bounds.width * share;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const edge = Math.min(x - bounds.left, bounds.left + bounds.width - 1 - x);
      if (edge >= fade) continue;
      const i = (y * info.width + x) * 4 + 3;
      const t = Math.max(0, edge) / fade;
      data[i] = Math.round(data[i] * t * t);
    }
  }
}

(async () => {
  require('fs').mkdirSync(TARGET, { recursive: true });
  for (const job of JOBS) await run(job);
})();
