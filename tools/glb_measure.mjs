// Měří GLB modely — rozměry, pivot a rozložení geometrie po dlaždici.
// Slouží k odvození orientace dlaždic (kde má dlaždice rameno, stěnu nebo okraj).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

const CHUNK_JSON = 0x4E4F534A;
const CHUNK_BIN = 0x004E4942;

function readGlb(path) {
  const buffer = readFileSync(path);
  if (buffer.readUInt32LE(0) !== 0x46546C67) return null;

  const chunks = {};
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === CHUNK_JSON) chunks.json = JSON.parse(buffer.subarray(start, start + length).toString('utf8'));
    if (type === CHUNK_BIN) chunks.bin = buffer.subarray(start, start + length);
    offset = start + length;
  }
  return chunks.json ? chunks : null;
}

const COMPONENT_READERS = {
  5120: (buffer, offset) => buffer.readInt8(offset),
  5121: (buffer, offset) => buffer.readUInt8(offset),
  5122: (buffer, offset) => buffer.readInt16LE(offset),
  5123: (buffer, offset) => buffer.readUInt16LE(offset),
  5125: (buffer, offset) => buffer.readUInt32LE(offset),
  5126: (buffer, offset) => buffer.readFloatLE(offset),
};

const COMPONENT_SIZES = {
  5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4,
};

function accessorValues(gltf, index) {
  const accessor = gltf.accessors[index];
  const view = gltf.bufferViews[accessor.bufferView];
  if (!view) return null;

  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
  const read = COMPONENT_READERS[accessor.componentType];
  const elementSize = components * COMPONENT_SIZES[accessor.componentType];
  const stride = view.byteStride || elementSize;
  const base = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const out = [];

  for (let i = 0; i < accessor.count; i++) {
    const item = [];
    for (let c = 0; c < components; c++) {
      item.push(read(gltf.bin, base + i * stride + c * COMPONENT_SIZES[accessor.componentType]));
    }
    out.push(item);
  }
  return out;
}

function meshPositions(gltf, mesh) {
  const points = [];
  const faces = [];
  for (const primitive of mesh.primitives) {
    const positionIndex = primitive.attributes.POSITION;
    if (positionIndex === undefined) continue;

    const values = accessorValues(gltf, positionIndex);
    if (!values) continue;
    const base = points.length;
    points.push(...values);

    if (primitive.indices !== undefined) {
      const indices = accessorValues(gltf, primitive.indices).map((item) => item[0]);
      for (let i = 0; i + 2 < indices.length; i += 3) {
        faces.push([base + indices[i], base + indices[i + 1], base + indices[i + 2]]);
      }
    } else {
      for (let i = 0; i + 2 < values.length; i += 3) faces.push([base + i, base + i + 1, base + i + 2]);
    }
  }
  return { points, faces };
}

function nodeTranslation(gltf) {
  let tx = 0;
  let tz = 0;
  for (const node of gltf.nodes || []) {
    if (!node.translation) continue;
    tx += node.translation[0];
    tz += node.translation[2];
  }
  return { tx, tz };
}

function bounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let a = 0; a < 3; a++) {
      if (p[a] < min[a]) min[a] = p[a];
      if (p[a] > max[a]) max[a] = p[a];
    }
  }
  return { min, max };
}

function sideProfile(points, faces, grid) {
  const filled = Array.from({ length: grid }, () => new Array(grid).fill(false));
  const deck = Array.from({ length: grid }, () => new Array(grid).fill(false));
  const samples = grid * 4;

  for (const [ia, ib, ic] of faces) {
    const a = points[ia];
    const b = points[ib];
    const c = points[ic];

    for (let i = 0; i <= samples; i++) {
      for (let j = 0; j + i <= samples; j++) {
        const u = i / samples;
        const v = j / samples;
        const w = 1 - u - v;
        const x = a[0] * w + b[0] * u + c[0] * v;
        const y = a[1] * w + b[1] * u + c[1] * v;
        const z = a[2] * w + b[2] * u + c[2] * v;
        const gx = Math.min(grid - 1, Math.max(0, Math.floor((x + 0.5) * grid)));
        const gz = Math.min(grid - 1, Math.max(0, Math.floor((z + 0.5) * grid)));
        filled[gz][gx] = true;
        if (y > -0.02) deck[gz][gx] = true;
      }
    }
  }

  const sides = { north: 0, south: 0, east: 0, west: 0 };
  let deckCount = 0;
  for (let gz = 0; gz < grid; gz++) {
    for (let gx = 0; gx < grid; gx++) {
      if (!deck[gz][gx]) continue;
      deckCount++;
      if (gz === 0) sides.north++;
      if (gz === grid - 1) sides.south++;
      if (gx === grid - 1) sides.east++;
      if (gx === 0) sides.west++;
    }
  }
  return { filled, deck, sides, deckCount };
}

function renderHeatmap(filled, deck) {
  const lines = [];
  for (let gz = 0; gz < filled.length; gz++) {
    let line = '';
    for (let gx = 0; gx < filled[gz].length; gx++) {
      if (deck[gz][gx]) line += '#';
      else if (filled[gz][gx]) line += '.';
      else line += ' ';
    }
    lines.push(`      ${line}`);
  }
  return lines.join('\n');
}

function measureFile(path) {
  const chunks = readGlb(path);
  if (!chunks || !chunks.bin) return null;

  const gltf = chunks.json;
  gltf.bin = chunks.bin;

  const points = [];
  const faces = [];
  for (const mesh of gltf.meshes || []) {
    const result = meshPositions(gltf, mesh);
    const offset = points.length;
    points.push(...result.points);
    for (const face of result.faces) faces.push(face.map((index) => index + offset));
  }
  if (!points.length) return null;

  const box = bounds(points);
  const profile = sideProfile(points, faces, 8);

  return {
    name: basename(path, extname(path)),
    vertices: points.length,
    triangles: faces.length,
    min: box.min,
    max: box.max,
    size: [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]],
    pivotOffset: nodeTranslation(gltf),
    deckCount: profile.deckCount,
    sides: profile.sides,
    filled: profile.filled,
    deck: profile.deck,
  };
}

function fmt(value) {
  return value.toFixed(3).padStart(7);
}

function printText(result) {
  console.log(`\n${result.name}`);
  console.log(`  vertexy: ${result.vertices}   trojuhelniky: ${result.triangles}`);
  console.log(`  bbox min: ${result.min.map(fmt).join(' ')}`);
  console.log(`  bbox max: ${result.max.map(fmt).join(' ')}`);
  console.log(`  rozmer  : ${result.size.map(fmt).join(' ')}`);
  console.log(`  pivot   : x=${result.pivotOffset.tx.toFixed(3)} z=${result.pivotOffset.tz.toFixed(3)}`);
  console.log(`  deck bunek: ${result.deckCount}   zastoupeni stran:`);
  console.log(`    N=${result.sides.north} S=${result.sides.south} E=${result.sides.east} W=${result.sides.west}`);
  console.log('  maska (sever nahore, # = horni deska, . = jen lem):');
  console.log(renderHeatmap(result.filled, result.deck));
}

function collectGlbs(targets, pattern) {
  const re = pattern ? new RegExp(pattern) : null;
  const files = [];

  for (const target of targets) {
    const stat = statSync(target);
    if (stat.isFile()) {
      files.push(target);
      continue;
    }
    for (const file of readdirSync(target)) {
      if (extname(file).toLowerCase() !== '.glb') continue;
      if (re && !re.test(basename(file, '.glb'))) continue;
      files.push(join(target, file));
    }
  }
  return [...new Set(files)].sort();
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const patternIndex = args.indexOf('--pattern');
  const pattern = patternIndex >= 0 ? args[patternIndex + 1] : null;
  const targets = args.filter((arg) => !arg.startsWith('--') && arg !== pattern);

  if (!targets.length) {
    console.log('Pouziti: node tools/glb_measure.mjs <soubor.glb | slozka> [...] [--pattern <regex>] [--json]');
    process.exit(1);
  }

  const results = [];
  for (const file of collectGlbs(targets, pattern)) {
    const result = measureFile(file);
    if (result) results.push(result);
  }

  if (!results.length) {
    console.log('Nic k mereni.');
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  for (const result of results) printText(result);
  console.log(`\nZmereno ${results.length} modelu.`);
}

main();
