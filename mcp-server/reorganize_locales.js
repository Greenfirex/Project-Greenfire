import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ==========================================================================
// Doménová pravidla — prefix → soubor
// ==========================================================================
const DOMAIN_RULES = [
  // actions.json — akce, výsledky, kategorie, objectives
  { prefixes: ['action_', 'result_', 'cat_', 'obj_'], file: 'actions' },
  // game.json — herní data: character, itemy, skilly, buffy, debuffy, resources, effects
  { prefixes: ['character_', 'equip_', 'inventory_', 'stat_', 'skill_', 'buff_', 'debuff_', 'item_', 'res_', 'resource_', 'area_', 'effect_', 'effects_'], file: 'game' },
];
// Všechno ostatní → ui.json (confirm_, log_, menu_, header_, footer_, title_, options_, death_, pause_, clock_, popup_, queue_, rotate_, info_, journal_, objectives_, crash_, tag_, detail_, lang_, loc_, poi_, personal_)

const ALL_DOMAINS = ['ui', 'actions', 'game'];

function getDomainForKey(key) {
  for (const rule of DOMAIN_RULES) {
    for (const prefix of rule.prefixes) {
      if (key.startsWith(prefix)) return rule.file;
    }
  }
  return 'ui';
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

function loadAllLocaleData() {
  const result = {};
  for (const lang of ['cs', 'en']) {
    result[lang] = {};
    const langDir = path.join(PROJECT_ROOT, 'locales', lang);
    for (const domain of ALL_DOMAINS) {
      const filePath = path.join(langDir, `${domain}.json`);
      const data = readJsonSafe(filePath);
      result[lang][domain] = data;
    }
  }
  return result;
}

// ==========================================================================
// analyze_only — vrátí report, nic nemění
// ==========================================================================
function analyze() {
  const data = loadAllLocaleData();
  const issues = [];
  const stats = {};

  // 1. Duplicitní klíče napříč soubory
  for (const lang of ['cs', 'en']) {
    const allKeys = {}; // key → [domains]
    for (const domain of ALL_DOMAINS) {
      for (const key of Object.keys(data[lang][domain])) {
        if (!allKeys[key]) allKeys[key] = [];
        allKeys[key].push(domain);
      }
    }
    for (const [key, domains] of Object.entries(allKeys)) {
      if (domains.length > 1) {
        issues.push({
          type: 'duplicate_key',
          lang,
          key,
          domains,
          message: `Klíč "${key}" existuje ve více souborech [${domains.join(', ')}] (${lang})`,
        });
      }
    }
  }

  // 2. Kategorizace podle domén — pro každý klíč z en/ui.json (ten je hlavní)
  const categorized = {};
  for (const domain of ALL_DOMAINS) {
    categorized[domain] = { keys: [], keep: [], move_in: [], move_out: [] };
  }

  // Projdeme en data — ta jsou referenční
  for (const lang of ['cs', 'en']) {
    for (const domain of ALL_DOMAINS) {
      for (const key of Object.keys(data[lang][domain])) {
        const targetDomain = getDomainForKey(key);
        if (targetDomain === domain) {
          if (!categorized[domain].keep.includes(key)) {
            categorized[domain].keep.push(key);
          }
        } else {
          const moveKey = `${lang}:${key}`;
          if (!categorized[domain].move_out.includes(moveKey)) {
            categorized[domain].move_out.push(moveKey);
          }
          if (!categorized[targetDomain].move_in.includes(moveKey)) {
            categorized[targetDomain].move_in.push(moveKey);
          }
        }
      }
    }
  }

  // 3. Hledání orphan klíčů bez jasného prefixu
  const orphans = [];
  for (const key of Object.keys(data['en']['ui'])) {
    if (getDomainForKey(key) === 'ui') {
      // Zkontroluj, jestli nemá podezřelý prefix
      const suspicious = ['log_', 'menu_', 'header_', 'footer_', 'title_', 'options_', 
        'death_', 'pause_', 'clock_', 'popup_', 'queue_', 'rotate_', 'info_', 'journal_',
        'objectives_', 'crash_', 'tag_', 'detail_', 'lang_', 'loc_', 'poi_', 'personal_'];
      const hasKnownPrefix = suspicious.some(p => key.startsWith(p));
      // Tyhle jsou v pořádku pro ui.json
    }
  }

  // 4. Statistika
  for (const lang of ['cs', 'en']) {
    stats[lang] = {};
    for (const domain of ALL_DOMAINS) {
      stats[lang][domain] = Object.keys(data[lang][domain]).length;
    }
    stats[lang].total = ALL_DOMAINS.reduce((sum, d) => sum + stats[lang][d], 0);
  }

  // Spočítej move statistiky
  const moveStats = {};
  for (const domain of ALL_DOMAINS) {
    moveStats[domain] = {
      keep: categorized[domain].keep.length,
      move_in: categorized[domain].move_in.length,
      move_out: categorized[domain].move_out.length,
    };
  }

  return {
    mode: 'analyze_only',
    summary: `CS: ${stats.cs.total} klíčů, EN: ${stats.en.total} klíčů. Duplicit: ${issues.filter(i => i.type === 'duplicate_key').length}`,
    currentStats: stats,
    moves: moveStats,
    duplicates: issues.filter(i => i.type === 'duplicate_key'),
    domainRules: DOMAIN_RULES.map(r => ({ prefixes: r.prefixes, file: `${r.file}.json` })),
  };
}

// ==========================================================================
// migrate — provede přesun klíčů
// ==========================================================================
function migrate() {
  const data = loadAllLocaleData();
  const log = [];

  for (const lang of ['cs', 'en']) {
    const langDir = path.join(PROJECT_ROOT, 'locales', lang);

    // Sesbírej všechny klíče podle jejich cílové domény
    const newDomains = {};
    for (const domain of ALL_DOMAINS) {
      newDomains[domain] = {};
    }

    for (const domain of ALL_DOMAINS) {
      for (const [key, value] of Object.entries(data[lang][domain])) {
        const targetDomain = getDomainForKey(key);
        if (newDomains[targetDomain][key] !== undefined) {
          // Duplicita — první výskyt vyhrává (nebo přepiš, pokud hodnota není prázdná)
          if (value && value !== '') {
            newDomains[targetDomain][key] = value;
          }
          log.push(`[${lang}] Duplicitní klíč "${key}" — ponechána hodnota z ${targetDomain}.json`);
        } else {
          newDomains[targetDomain][key] = value;
        }
      }
    }

    // Zapiš zpět do souborů (abecedně seřazené)
    for (const domain of ALL_DOMAINS) {
      const filePath = path.join(langDir, `${domain}.json`);
      const oldData = data[lang][domain];
      const newData = newDomains[domain];

      // Seřaď klíče abecedně
      const sorted = {};
      for (const key of Object.keys(newData).sort()) {
        sorted[key] = newData[key];
      }

      const oldKeys = Object.keys(oldData).sort();
      const newKeys = Object.keys(sorted).sort();

      const added = newKeys.filter(k => !oldKeys.includes(k));
      const removed = oldKeys.filter(k => !newKeys.includes(k));

      if (added.length > 0 || removed.length > 0) {
        log.push(`[${lang}] ${domain}.json: +${added.length} klíčů, -${removed.length} klíčů`);
        if (added.length > 0) log.push(`  Přidáno: ${added.join(', ')}`);
        if (removed.length > 0) log.push(`  Odebráno: ${removed.join(', ')}`);
      }

      fs.writeFileSync(filePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    }
  }

  return {
    mode: 'migrate',
    summary: `Migrace dokončena. ${log.length} změn.`,
    log,
  };
}

export function reorganizeLocales(mode = 'analyze_only') {
  if (mode === 'analyze_only') {
    return analyze();
  } else if (mode === 'migrate') {
    return migrate();
  } else {
    return { error: `Neznámý režim: ${mode}. Použij "analyze_only" nebo "migrate".` };
  }
}