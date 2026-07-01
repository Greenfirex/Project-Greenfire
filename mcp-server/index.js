#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ==========================================================================
// Helpers
// ==========================================================================

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function findFiles(dir, extensions, excludeDirs = []) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      results.push(...findFiles(fullPath, extensions, excludeDirs));
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// Extrahuje pole actions z definičního JS souboru
// Hledá `actions: [...]` a vrací jen objekty, které mají `id` (filtruje tím POI akce, což jsou stringy)
function extractActionsArray(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const regex = /actions\s*:\s*\[/g;
  let match;
  const allItems = [];

  while ((match = regex.exec(content)) !== null) {
    const startIdx = match.index + match[0].length;
    let depth = 1;
    let i = startIdx;
    let arrayStr = '[';

    // Přeskoč whitespace po [ (gamma site definice používají formát s odřádkováním)
    while (i < content.length && depth > 0) {
      const ch = content[i];
      arrayStr += ch;
      if (ch === '[') depth++;
      else if (ch === ']') depth--;
      else if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        i++;
        while (i < content.length && content[i] !== quote) {
          if (content[i] === '\\') i++;
          arrayStr += content[i];
          i++;
        }
        if (i < content.length) arrayStr += content[i];
      }
      i++;
    }

    if (depth !== 0) continue;

    try {
      const fn = new Function('return ' + arrayStr);
      const arr = fn();
      if (Array.isArray(arr)) {
        // Filtruj — akce jsou objekty s `id`, POI akce jsou stringy
        for (const item of arr) {
          if (typeof item === 'object' && item !== null && item.id) {
            allItems.push(item);
          }
        }
      }
    } catch { /* skip */ }
  }

  return allItems;
}

// ==========================================================================
// Tool: validate_locales
// ==========================================================================

function validateLocales() {
  const localesDir = path.join(PROJECT_ROOT, 'locales');
  const localeFiles = findFiles(localesDir, ['.json'], []).filter(f => {
    const name = path.basename(f);
    return name === 'ui.json';
  });

  const issues = [];
  const langFiles = {};

  for (const filePath of localeFiles) {
    const parentDir = path.basename(path.dirname(filePath));
    const data = readJson(filePath);
    if (data) {
      langFiles[parentDir] = { path: filePath, keys: data };
    } else {
      issues.push({ type: 'parse_error', lang: parentDir, file: filePath });
    }
  }

  const langs = Object.keys(langFiles);
  if (langs.length < 2) {
    return { issues, summary: `Nalezeno pouze ${langs.length} locale souborů.` };
  }

  // Porovnej všechny kombinace
  const allKeys = {};
  for (const [lang, info] of Object.entries(langFiles)) {
    allKeys[lang] = new Set(Object.keys(info.keys));
  }

  const allUniqueKeys = new Set();
  for (const keySet of Object.values(allKeys)) {
    for (const k of keySet) allUniqueKeys.add(k);
  }

  for (const key of [...allUniqueKeys].sort()) {
    for (const [lang, info] of Object.entries(langFiles)) {
      if (!allKeys[lang].has(key)) {
        issues.push({
          type: 'missing_key',
          lang,
          key,
          message: `Klíč "${key}" chybí v ${lang}/ui.json`,
        });
      } else if (info.keys[key] === '' || info.keys[key] === null) {
        issues.push({
          type: 'empty_value',
          lang,
          key,
          message: `Klíč "${key}" v ${lang}/ui.json má prázdnou hodnotu`,
        });
      }
    }
  }

  return {
    summary: `${langs.join(' vs ')}: ${allUniqueKeys.size} unikátních klíčů, ${issues.length} problémů`,
    languages: langs,
    totalKeys: allUniqueKeys.size,
    issues,
  };
}

// ==========================================================================
// Tool: validate_actions
// ==========================================================================

function validateActions() {
  const defsDir = path.join(PROJECT_ROOT, 'sections', 'locations', 'definitions');
  const jsFiles = findFiles(defsDir, ['.js']);

  const csUiPath = path.join(PROJECT_ROOT, 'locales', 'cs', 'ui.json');
  const enUiPath = path.join(PROJECT_ROOT, 'locales', 'en', 'ui.json');
  const csKeys = new Set(Object.keys(readJson(csUiPath) || {}));
  const enKeys = new Set(Object.keys(readJson(enUiPath) || {}));

  const issues = [];
  const allActions = [];
  let actionCount = 0;

  const REQUIRED_FIELDS = ['id', 'drain', 'durationSeconds', 'category'];

  for (const filePath of jsFiles) {
    const actions = extractActionsArray(filePath);
    const relPath = path.relative(PROJECT_ROOT, filePath);

    for (const action of actions) {
      const id = action.id;
      // Bezpečnostní pojistka (už by nemělo nastat, extractActionsArray filtruje)
      if (!id) continue;

      actionCount++;
      allActions.push({ id, file: relPath });

      // Povinná pole
      for (const field of REQUIRED_FIELDS) {
        if (action[field] === undefined || action[field] === null) {
          issues.push({
            type: 'missing_field',
            action: id,
            field,
            file: relPath,
            message: `Akce "${id}" postrádá povinné pole "${field}"`,
          });
        }
      }

      // durationSeconds podezřelé hodnoty
      if (typeof action.durationSeconds === 'number' && action.durationSeconds >= 300) {
        issues.push({
          type: 'suspicious_duration',
          action: id,
          value: action.durationSeconds,
          file: relPath,
          message: `Akce "${id}" má durationSeconds=${action.durationSeconds} — podezření na minuty místo sekund`,
        });
      }

      // nameKey
      if (action.nameKey) {
        if (!csKeys.has(action.nameKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.nameKey,
            lang: 'cs',
            file: relPath,
            message: `nameKey "${action.nameKey}" pro akci "${id}" chybí v cs/ui.json`,
          });
        }
        if (!enKeys.has(action.nameKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.nameKey,
            lang: 'en',
            file: relPath,
            message: `nameKey "${action.nameKey}" pro akci "${id}" chybí v en/ui.json`,
          });
        }
      }

      // descKey
      if (action.descKey) {
        if (!csKeys.has(action.descKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.descKey,
            lang: 'cs',
            file: relPath,
            message: `descKey "${action.descKey}" pro akci "${id}" chybí v cs/ui.json`,
          });
        }
        if (!enKeys.has(action.descKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.descKey,
            lang: 'en',
            file: relPath,
            message: `descKey "${action.descKey}" pro akci "${id}" chybí v en/ui.json`,
          });
        }
      }

      // resultKey
      if (action.resultKey) {
        if (!csKeys.has(action.resultKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.resultKey,
            lang: 'cs',
            file: relPath,
            message: `resultKey "${action.resultKey}" pro akci "${id}" chybí v cs/ui.json`,
          });
        }
        if (!enKeys.has(action.resultKey)) {
          issues.push({
            type: 'missing_locale',
            action: id,
            key: action.resultKey,
            lang: 'en',
            file: relPath,
            message: `resultKey "${action.resultKey}" pro akci "${id}" chybí v en/ui.json`,
          });
        }
      }

      // nameKey chybí úplně
      if (!action.nameKey) {
        issues.push({
          type: 'missing_namekey',
          action: id,
          file: relPath,
          message: `Akce "${id}" nemá nameKey`,
        });
      }
    }
  }

  return {
    summary: `Nalezeno ${actionCount} akcí v ${jsFiles.length} souborech, ${issues.length} problémů`,
    fileCount: jsFiles.length,
    actionCount,
    issues,
  };
}

// ==========================================================================
// Tool: find_hardcoded
// ==========================================================================

function findHardcoded() {
  const results = [];
  const excludeDirs = ['node_modules', 'mcp-server', 'locales', '.git', 'backup', 'assets'];

  // Patterny pro hardcodované anglické stringy
  const patterns = [
    { regex: /'You\s+(need|must|can't|cannot|don't|have|are)\b/gi, label: 'You [verb]...' },
    { regex: /'Received:\s*/gi, label: 'Received:' },
    { regex: /\bcompleted\.'/gi, label: 'completed.' },
    { regex: /'You got\b/gi, label: 'You got' },
    { regex: /'You found\b/gi, label: 'You found' },
    { regex: /'Not enough\b/gi, label: 'Not enough' },
    { regex: /'Success'/gi, label: 'Success' },
    { regex: /'Error'/gi, label: 'Error (hardcoded)' },
    { regex: /'Warning'/gi, label: 'Warning (hardcoded)' },
  ];

  const filesToCheck = [
    ...findFiles(path.join(PROJECT_ROOT, 'sections'), ['.js'], excludeDirs),
    ...findFiles(path.join(PROJECT_ROOT, 'engine'), ['.js'], excludeDirs),
    ...findFiles(path.join(PROJECT_ROOT, 'ui'), ['.js'], excludeDirs),
    ...findFiles(PROJECT_ROOT, ['.html'], excludeDirs),
  ];

  for (const filePath of filesToCheck) {
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const relPath = path.relative(PROJECT_ROOT, filePath);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Přeskoč řádky, které používají t()
      if (/\bt\s*\(/.test(line)) continue;
      // Přeskoč komentáře
      if (/^\s*\/\//.test(line.trim())) continue;

      for (const pattern of patterns) {
        if (pattern.regex.test(line)) {
          // Reset lastIndex pro globální regex
          pattern.regex.lastIndex = 0;
          results.push({
            file: relPath,
            line: i + 1,
            pattern: pattern.label,
            content: line.trim().substring(0, 120),
          });
          break; // Jen jeden match na řádek
        }
      }
    }
  }

  return {
    summary: `Nalezeno ${results.length} podezřelých výskytů`,
    issues: results,
  };
}

// ==========================================================================
// Tool: check_engine
// ==========================================================================

function checkEngine() {
  const enginePath = path.join(PROJECT_ROOT, 'sections', 'locations', 'locationEngine.js');
  if (!fs.existsSync(enginePath)) {
    return { ok: false, message: 'locationEngine.js nenalezen' };
  }

  const content = fs.readFileSync(enginePath, 'utf-8');
  const matches = [];
  const regex = /if\s*\(\s*action\.id\s*===/g;
  let match;

  const lines = content.split('\n');
  while ((match = regex.exec(content)) !== null) {
    const pos = match.index;
    let lineNum = 1;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const nextCount = charCount + lines[i].length + 1;
      if (pos < nextCount) {
        lineNum = i + 1;
        break;
      }
      charCount = nextCount;
    }
    matches.push({
      line: lineNum,
      snippet: lines[lineNum - 1]?.trim().substring(0, 120) || '',
    });
  }

  const ok = matches.length === 0;
  return {
    ok,
    message: ok
      ? 'locationEngine.js je čistý — žádné if (action.id === ...) nalezeno'
      : `Nalezeno ${matches.length} výskytů if (action.id === ...) v locationEngine.js — toto je zakázáno!`,
    violations: matches,
  };
}

// ==========================================================================
// Tool: validate_state_coverage
// ==========================================================================
// Ověří, že všechny locations definované v definitions/**/*.js jsou skutečně
// zaregistrovány (importovány + registerLocation()) v locationData.js.
// Nahrazuje potřebu ručně udržovaného hardcoded seznamu locId, který byl
// dříve zdrojem bugů typu "getActionCompletionState() nezná novou lokaci".

function extractLocationId(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Najdi export const X = { id: 'location_id', ... siteId: ...
  const match = content.match(/export\s+const\s+\w+\s*=\s*\{[^}]*?\bid\s*:\s*['"]([^'"]+)['"]/s);
  return match ? match[1] : null;
}

function validateStateCoverage() {
  const defsDir = path.join(PROJECT_ROOT, 'sections', 'locations', 'definitions');
  const locationDataPath = path.join(PROJECT_ROOT, 'sections', 'locations', 'locationData.js');
  const jsFiles = findFiles(defsDir, ['.js']);

  const locationDataContent = fs.existsSync(locationDataPath)
    ? fs.readFileSync(locationDataPath, 'utf-8')
    : '';

  const issues = [];
  const definedLocations = [];

  for (const filePath of jsFiles) {
    const relPath = path.relative(PROJECT_ROOT, filePath);
    const locId = extractLocationId(filePath);
    if (!locId) continue; // soubor bez top-level location definice (např. helper)

    definedLocations.push({ id: locId, file: relPath });

    // Najdi jméno exportované proměnné pro tento soubor
    const exportMatch = fs.readFileSync(filePath, 'utf-8').match(/export\s+const\s+(\w+)\s*=/);
    const exportName = exportMatch ? exportMatch[1] : null;

    const isImported = exportName && new RegExp(`import\\s*\\{[^}]*\\b${exportName}\\b[^}]*\\}\\s*from`).test(locationDataContent);
    const isRegistered = exportName && new RegExp(`registerLocation\\(\\s*${exportName}\\s*\\)`).test(locationDataContent);

    if (!isImported) {
      issues.push({
        type: 'not_imported',
        locationId: locId,
        exportName,
        file: relPath,
        message: `Lokace "${locId}" (export "${exportName}") není importována v locationData.js`,
      });
    }
    if (!isRegistered) {
      issues.push({
        type: 'not_registered',
        locationId: locId,
        exportName,
        file: relPath,
        message: `Lokace "${locId}" (export "${exportName}") není zaregistrována přes registerLocation() v locationData.js`,
      });
    }
  }

  return {
    summary: `Nalezeno ${definedLocations.length} lokací, ${issues.length} problémů s registrací`,
    definedLocations,
    issues,
  };
}

// ==========================================================================
// MCP Server
// ==========================================================================


const server = new Server(
  {
    name: 'project-greenfire-validator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'validate_locales',
      description: 'Porovná cs/ui.json a en/ui.json — najde chybějící klíče, prázdné hodnoty, nesrovnalosti.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'validate_actions',
      description: 'Zkontroluje všechny definiční soubory akcí — povinná pole, durationSeconds podezřelé hodnoty, chybějící locale klíče.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'find_hardcoded',
      description: 'Najde hardcodované anglické stringy v JS/HTML souborech, které by měly používat t() lokalizační funkci.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'check_engine',
      description: 'Ověří, že locationEngine.js neobsahuje zakázané if (action.id === ...) bloky.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'validate_state_coverage',
      description: 'Ověří, že všechny location definice v sections/locations/definitions/**/*.js jsou importovány a zaregistrovány (registerLocation) v locationData.js. Zabraňuje bugům, kdy engine kód iteruje jen přes hardcoded seznam lokací a nová lokace zůstane nepokrytá.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],
}));


server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case 'validate_locales': {
      const result = validateLocales();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'validate_actions': {
      const result = validateActions();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'find_hardcoded': {
      const result = findHardcoded();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'check_engine': {
      const result = checkEngine();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    case 'validate_state_coverage': {
      const result = validateStateCoverage();
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
    default:

      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

server.onerror = (error) => console.error('[MCP Error]', error);
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Project Greenfire MCP server running on stdio');
}

run().catch(console.error);