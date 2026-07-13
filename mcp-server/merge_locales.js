import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const DOMAIN_RULES = [
  { prefixes: ['action_', 'result_', 'cat_', 'obj_'], file: 'actions' },
  { prefixes: ['character_', 'equip_', 'inventory_', 'stat_', 'skill_', 'buff_', 'debuff_', 'item_', 'res_', 'resource_', 'area_', 'effect_', 'effects_'], file: 'game' },
];

function getDomain(key) {
  for (const r of DOMAIN_RULES) {
    for (const p of r.prefixes) {
      if (key.startsWith(p)) return r.file;
    }
  }
  return 'ui';
}

const ALL_DOMAINS = ['ui', 'actions', 'game', 'confirm', 'resources', 'character', 'effects'];
const TARGET_DOMAINS = ['ui', 'actions', 'game'];

for (const lang of ['cs', 'en']) {
  const dir = path.join(root, 'locales', lang);
  const merged = { ui: {}, actions: {}, game: {} };

  for (const domain of ALL_DOMAINS) {
    const fp = path.join(dir, `${domain}.json`);
    if (!fs.existsSync(fp)) continue;
    const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    for (const [key, value] of Object.entries(data)) {
      const target = getDomain(key);
      if (!merged[target][key] || (value && value !== '')) {
        merged[target][key] = value;
      }
    }
  }

  for (const domain of TARGET_DOMAINS) {
    const fp = path.join(dir, `${domain}.json`);
    const sorted = {};
    for (const key of Object.keys(merged[domain]).sort()) {
      sorted[key] = merged[domain][key];
    }
    fs.writeFileSync(fp, JSON.stringify(sorted, null, 2) + '\n', 'utf-8');
    console.log(`${lang}/${domain}.json: ${Object.keys(sorted).length} keys`);
  }

  // Delete old files
  for (const domain of ['confirm', 'resources', 'character', 'effects']) {
    const fp = path.join(dir, `${domain}.json`);
    if (fs.existsSync(fp)) {
      fs.unlinkSync(fp);
      console.log(`Deleted: ${fp}`);
    }
  }
}

console.log('Done.');