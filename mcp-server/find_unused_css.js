import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function findFiles(dir, extensions, excludeDirs = []) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      results.push(...findFiles(full, extensions, excludeDirs));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

// Extrahuje selectory: třídy a ID z CSS pravidel (ne z hodnot vlastností)
function extractSelectors(cssContent) {
  const selectors = []; // { sel, rule }
  const clean = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');
  let depth = 0;
  let currentBlock = '';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '{') {
      depth++;
      if (depth === 1) {
        let selStart = currentBlock.lastIndexOf('}');
        selStart = selStart === -1 ? 0 : selStart + 1;
        let rule = currentBlock.substring(selStart).trim();
        if (rule && !looksLikeProperty(rule)) selectors.push({ rule, sel: null });
      }
    } else if (ch === '}') {
      depth--;
    }
    currentBlock += ch;
  }

  const result = [];
  for (const item of selectors) {
    const parts = item.rule.split(',').map(s => s.trim()).filter(s => s.length > 0);
    for (const part of parts) {
      const classes = [...part.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
      const ids = [...part.matchAll(/#([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map(m => m[1]);
      for (const cls of classes) {
        if (/^\d/.test(cls)) continue;
        result.push({ sel: '.' + cls, rule: part.substring(0, 70) });
      }
      for (const id of ids) {
        if (/^\d/.test(id)) continue;
        result.push({ sel: '#' + id, rule: part.substring(0, 70) });
      }
    }
  }
  return result;
}

function looksLikeProperty(text) {
  if (text.includes('(') && !text.includes('(') ) return false; // zjednodušení
  if (text.includes(':') && !text.includes('::') && !text.includes(':hover') &&
      !text.includes(':active') && !text.includes(':focus') && !text.includes(':not(') &&
      !text.includes(':last-child') && !text.includes(':first-child') && !text.includes(':nth-child') &&
      !text.includes(':disabled') && !text.includes(':first-of-type') && !text.includes(':last-of-type') &&
      !text.includes(':not(.collapsed)')) return true;
  return false;
}

const excludeDirs = ['node_modules', 'mcp-server', '.git', 'backup', 'assets', 'locales'];
const cssFiles = findFiles(path.join(root, 'styles'), ['.css']);

// Pro každý CSS: seznam selektorů
const fileData = new Map(); // file → [{sel, rule}]
for (const cssFile of cssFiles) {
  const content = fs.readFileSync(cssFile, 'utf-8');
  const selectors = extractSelectors(content);
  const rel = path.relative(root, cssFile);
  fileData.set(rel, selectors);
}

// Všechny HTML soubory
const htmlFiles = findFiles(root, ['.html'], excludeDirs);
const htmlContents = new Map();
for (const f of htmlFiles) {
  htmlContents.set(path.relative(root, f), fs.readFileSync(f, 'utf-8'));
}

// Hledej každý selektor v HTML
const foundInHtml = new Set();
for (const [file, html] of htmlContents) {
  const classRe = /class="([^"]+)"/g;
  const idRe = /id="([^"]+)"/g;
  let m;
  while ((m = classRe.exec(html)) !== null) {
    for (const c of m[1].split(/\s+/)) foundInHtml.add('.' + c);
  }
  while ((m = idRe.exec(html)) !== null) foundInHtml.add('#' + m[1]);
}

// Hledej v JS: string literal 'className', "className", `className`
const jsFiles = [
  ...findFiles(path.join(root, 'engine'), ['.js'], excludeDirs),
  ...findFiles(path.join(root, 'sections'), ['.js'], excludeDirs),
  ...findFiles(path.join(root, 'ui'), ['.js'], excludeDirs),
];
const foundInJs = new Set();
for (const f of jsFiles) {
  const content = fs.readFileSync(f, 'utf-8');
  // Hledej všechny třídy/ID
  const strRe = /['"`]([a-zA-Z_][a-zA-Z0-9_-]*)['"`]/g;
  let m;
  while ((m = strRe.exec(content)) !== null) {
    const name = m[1];
    foundInJs.add('.' + name);
    foundInJs.add('#' + name);
  }
}

const allFound = new Set([...foundInHtml, ...foundInJs]);

// Report po souborech
console.log('===== CSS UNUSED SELECTORS REPORT (by file) =====\n');

const SUMMARY = [];
let totalDead = 0;
let totalAlive = 0;

for (const [file, selectors] of [...fileData].sort(([,a],[,b]) => b.length - a.length)) {
  const dead = [];
  const alive = [];
  for (const {sel} of selectors) {
    if (allFound.has(sel)) alive.push(sel); else dead.push(sel);
  }
  const pct = selectors.length > 0 ? Math.round(dead.length / selectors.length * 100) : 0;
  totalDead += dead.length;
  totalAlive += alive.length;
  SUMMARY.push({ file, total: selectors.length, alive: alive.length, dead: dead.length, pct });
  
  const icon = pct > 80 ? '🔴' : pct > 50 ? '🟡' : pct > 20 ? '🟠' : '🟢';
  console.log(`${icon} ${file}: ${selectors.length} selectors, ${dead.length} dead (${pct}%), ${alive.length} alive`);
  if (dead.length > 0 && dead.length <= 30) {
    for (const d of dead) console.log(`     ✗ ${d}`);
  } else if (dead.length > 30) {
    for (const d of dead.slice(0, 15)) console.log(`     ✗ ${d}`);
    console.log(`     ... and ${dead.length - 15} more`);
  }
  console.log('');
}

console.log('===== SUMMARY =====');
console.log(`Total: ${totalDead + totalAlive} selectors, ${totalDead} dead, ${totalAlive} alive`);
console.log(`Files with >50% dead: ${SUMMARY.filter(s => s.pct > 50).map(s => s.file).join(', ')}`);