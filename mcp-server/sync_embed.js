import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const localesJsPath = path.join(root, 'locales', 'locales.js');
const enUiPath = path.join(root, 'locales', 'en', 'ui.json');

// Načti en/ui.json
const enData = JSON.parse(fs.readFileSync(enUiPath, 'utf-8'));

// Vygeneruj novou embedded dictionary
const indent = '    ';
const entries = Object.entries(enData)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, value]) => {
    // Escape string pro JavaScript
    const escaped = JSON.stringify(value);
    return `${indent}"${key}": ${escaped}`;
  });

const newBlock = "loaded['en'] = {\n" + entries.join(',\n') + '\n};';

// Načti locales.js
let content = fs.readFileSync(localesJsPath, 'utf-8');

// Najdi embedded EN blok - počítej {} závorky
const marker = "loaded['en'] = {";
const startIdx = content.indexOf(marker);
if (startIdx === -1) {
  console.error('Nelze najít embedded EN blok v locales.js');
  process.exit(1);
}

// Počítej složené závorky od otevírací { (depth=1 protože marker už obsahuje {)
let depth = 1;
let i = startIdx + marker.length;
// Přeskoč úvodní whitespace/nový řádek před první položkou
while (i < content.length && /\s/.test(content[i])) i++;

while (i < content.length && depth > 0) {
  const ch = content[i];
  if (ch === '{') {
    depth++;
  } else if (ch === '}') {
    depth--;
    if (depth === 0) break;
  } else if (ch === '"' || ch === "'" || ch === '`') {
    const q = ch;
    i++;
    while (i < content.length && content[i] !== q) {
      if (content[i] === '\\') i++;
      i++;
    }
  }
  i++;
}

const endIdx = i + 1; // za };

if (endIdx <= startIdx) {
  console.error('Nelze najít konec embedded EN bloku');
  process.exit(1);
}

// Nahraď
const before = content.substring(0, startIdx);
const after = content.substring(endIdx);
const newContent = before + newBlock + after;

// Zapiš
fs.writeFileSync(localesJsPath, newContent, 'utf-8');

// Zkontroluj
const enKeys = Object.keys(enData).length;
console.log(`Synchornizovano: ${enKeys} klíčů z en/ui.json do locales.js embedded EN`);
console.log('Hotovo.');