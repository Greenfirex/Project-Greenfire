// ==========================================================================
// Tool: validate_action_chain — hloubková validace logiky akcí
// ==========================================================================
// Pro každou akci ověří:
//   - isAvailable: správné použití unlockState klíčů, milestone, hasLogin
//   - onComplete: reference na existující akce, locale klíče, milestone jména
//   - getResultKey: všechny varianty result klíčů existují v locales
//   - onStart: gate logika
//   - Statické fieldy: unlockedBy, targetLocation, rewards, efekty, skilly, area resources
//   - Vzájemné interakce: cykly, dead code, chybějící reference

import fs from 'fs';
import path from 'path';

// ==========================================================================
// Registry builders
// ==========================================================================

function buildItemRegistry(projectRoot) {
    const itemsPath = path.join(projectRoot, 'sections', 'character', 'items.js');
    if (!fs.existsSync(itemsPath)) return new Set();
    const content = fs.readFileSync(itemsPath, 'utf-8');
    const ids = new Set();
    const regex = /\bid\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) ids.add(m[1]);
    return ids;
}

function buildEffectRegistry(projectRoot) {
    const ids = new Set();
    const constants = new Map();
    const effectsPath = path.join(projectRoot, 'engine', 'effects.js');
    if (fs.existsSync(effectsPath)) {
        const content = fs.readFileSync(effectsPath, 'utf-8');
        const constRegex = /\bEFFECT_\w+\s*=\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = constRegex.exec(content)) !== null) {
            constants.set(m[1], m[0].split('=')[0].trim());
            ids.add(m[1]);
        }
        const idRegex = /\bid\s*:\s*['"]([^'"]+)['"]/g;
        while ((m = idRegex.exec(content)) !== null) ids.add(m[1]);
    }
    const enginePath = path.join(projectRoot, 'sections', 'locations', 'locationEngine.js');
    if (fs.existsSync(enginePath)) {
        const content = fs.readFileSync(enginePath, 'utf-8');
        const dynRegex = /addsEffect\s*===?\s*['"]([^'"]+)['"]/g;
        let m;
        while ((m = dynRegex.exec(content)) !== null) ids.add(m[1]);
    }
    return { ids, constants };
}

function buildSkillRegistry(projectRoot) {
    const charPath = path.join(projectRoot, 'sections', 'character', 'character.js');
    if (!fs.existsSync(charPath)) return new Map();
    const content = fs.readFileSync(charPath, 'utf-8');
    const skills = new Map();
    const defRegex = /\bid\s*:\s*['"]([^'"]+)['"]/gs;
    let m;
    while ((m = defRegex.exec(content)) !== null) {
        if (!skills.has(m[1])) skills.set(m[1], new Set());
    }
    const skillRegex = /hasSkill\s*\(\s*['"]([^'"]+)['"]\s*,\s*(\d+)\s*\)/g;
    while ((m = skillRegex.exec(content)) !== null) {
        if (!skills.has(m[1])) skills.set(m[1], new Set());
        skills.get(m[1]).add(parseInt(m[2]));
    }
    return skills;
}

function buildAreaResourceRegistry(projectRoot) {
    const resPath = path.join(projectRoot, 'engine', 'resources.js');
    if (!fs.existsSync(resPath)) return new Set();
    const content = fs.readFileSync(resPath, 'utf-8');
    const names = new Set();
    const regex = /['"]area_(\w+)['"]/g;
    let m;
    while ((m = regex.exec(content)) !== null) names.add('area_' + m[1]);
    return names;
}

function buildLocationRegistry(projectRoot) {
    const defsDir = path.join(projectRoot, 'sections', 'locations', 'definitions');
    if (!fs.existsSync(defsDir)) return new Set();
    const ids = new Set();
    const files = findFilesRecursive(defsDir, ['.js']);
    for (const fp of files) {
        const content = fs.readFileSync(fp, 'utf-8');
        const match = content.match(/\bid\s*:\s*['"]([^'"]+)['"]/);
        if (match) ids.add(match[1]);
    }
    return ids;
}

/** Získej všechny locale klíče ze VŠECH JSON souborů v locales/ (ui.json + character.json) */
function buildLocaleRegistry(projectRoot) {
    const localesDir = path.join(projectRoot, 'locales');
    const keys = new Set();
    for (const lang of ['cs', 'en']) {
        const langDir = path.join(localesDir, lang);
        if (!fs.existsSync(langDir)) continue;
        const jsonFiles = findFilesRecursive(langDir, ['.json']);
        for (const fpath of jsonFiles) {
            try {
                const data = JSON.parse(fs.readFileSync(fpath, 'utf-8'));
                Object.keys(data).forEach(k => keys.add(k));
            } catch { /* ignore */ }
        }
    }
    return keys;
}

function findFilesRecursive(dir, extensions, excludeDirs = ['node_modules']) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!excludeDirs.includes(entry.name)) results.push(...findFilesRecursive(fullPath, extensions, excludeDirs));
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            results.push(fullPath);
        }
    }
    return results;
}

// ==========================================================================
// Extrakce callbacků
// ==========================================================================

function extractCallbackBody(content, callbackName) {
    const patterns = [
        new RegExp(`\\b${callbackName}\\s*\\(\\s*ctx\\s*\\)\\s*\\{`, 'g'),
        new RegExp(`\\b${callbackName}\\s*:\\s*function\\s*\\(\\s*ctx\\s*\\)\\s*\\{`, 'g'),
    ];
    for (const regex of patterns) {
        let m;
        while ((m = regex.exec(content)) !== null) {
            const startIdx = m.index + m[0].length;
            let depth = 1, i = startIdx;
            while (i < content.length && depth > 0) {
                const ch = content[i];
                if (ch === '{') depth++;
                else if (ch === '}') depth--;
                else if (ch === '"' || ch === "'" || ch === '`') {
                    const quote = ch; i++;
                    while (i < content.length && content[i] !== quote) { if (content[i] === '\\') i++; i++; }
                }
                i++;
            }
            if (depth === 0) return content.substring(m.index, i);
        }
    }
    return null;
}

function extractTLocaleKeys(code) {
    const keys = new Set();
    const regex = /\bt\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(code)) !== null) keys.add(m[1]);
    return keys;
}

function extractMilestoneNames(code) {
    const names = new Set();
    const regex = /(?:setMilestone|hasMilestone)\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(code)) !== null) names.add(m[1]);
    return names;
}

function extractActionIdRefs(code) {
    const ids = new Set();
    const regex = /\.id\s*===?\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = regex.exec(code)) !== null) ids.add(m[1]);
    return ids;
}

function extractFlagActionAsNew(code) {
    const ids = new Set();
    const fanRegex = /flagActionAsNew\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = fanRegex.exec(code)) !== null) ids.add(m[1]);
    return ids;
}

function extractUnlockStateKeys(code) {
    const keys = new Set();
    const bracketRegex = /us\s*\[\s*['"]([^'"]+)['"]\s*\]/g;
    let m;
    while ((m = bracketRegex.exec(code)) !== null) keys.add(m[1]);
    return keys;
}

function extractActionsArrayFromFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const regex = /actions\s*:\s*\[/g;
    let match;
    const allItems = [];
    while ((match = regex.exec(content)) !== null) {
        const startIdx = match.index + match[0].length;
        let depth = 1, i = startIdx;
        let arrayStr = '[';
        while (i < content.length && depth > 0) {
            const ch = content[i]; arrayStr += ch;
            if (ch === '[') depth++;
            else if (ch === ']') depth--;
            else if (ch === '"' || ch === "'" || ch === '`') {
                const quote = ch; i++;
                while (i < content.length && content[i] !== quote) { if (content[i] === '\\') i++; arrayStr += content[i]; i++; }
                if (i < content.length) arrayStr += content[i];
            }
            i++;
        }
        if (depth !== 0) continue;
        try {
            const fn = new Function('return ' + arrayStr);
            const arr = fn();
            if (Array.isArray(arr)) {
                for (const item of arr) {
                    if (typeof item === 'object' && item !== null && item.id) allItems.push({ item, content, filePath });
                }
            }
        } catch { /* skip */ }
    }
    return allItems;
}

// ==========================================================================
// Hlavní validace
// ==========================================================================

function validateActionChain(projectRoot) {
    const issues = [];
    const actionMap = {};
    const allActionIds = new Set();
    const itemRegistry = buildItemRegistry(projectRoot);
    const effectRegistry = buildEffectRegistry(projectRoot);
    const skillRegistry = buildSkillRegistry(projectRoot);
    const areaRegistry = buildAreaResourceRegistry(projectRoot);
    const localeKeys = buildLocaleRegistry(projectRoot);
    const allLocations = buildLocationRegistry(projectRoot);
    const defsDir = path.join(projectRoot, 'sections', 'locations', 'definitions');
    const jsFiles = findFilesRecursive(defsDir, ['.js']);

    for (const filePath of jsFiles) {
        for (const { item } of extractActionsArrayFromFile(filePath)) allActionIds.add(item.id);
    }

    for (const filePath of jsFiles) {
        const relPath = path.relative(projectRoot, filePath);
        for (const { item: action, content } of extractActionsArrayFromFile(filePath)) {
            const id = action.id;
            const mapEntry = { id, file: relPath, conditions: [], hides: [], shows: [], milestones: [] };

            // unlockedBy
            if (action.unlockedBy) {
                const deps = Array.isArray(action.unlockedBy) ? action.unlockedBy : [action.unlockedBy];
                for (const dep of deps) {
                    mapEntry.conditions.push(`Akce: ${dep}`);
                    if (typeof dep === 'string' && !allActionIds.has(dep)) issues.push({ type: 'bad_unlockedBy', action: id, ref: dep, file: relPath, message: `unlockedBy odkazuje na neexistující akci "${dep}"` });
                }
            }

            // targetLocation
            if (action.targetLocation) {
                mapEntry.conditions.push(`Cílová lokace: ${action.targetLocation}`);
                if (!allLocations.has(action.targetLocation)) issues.push({ type: 'bad_target_location', action: id, ref: action.targetLocation, file: relPath, message: `targetLocation "${action.targetLocation}" není registrovaná lokace` });
            }

            // requiresItem / requiredItems
            const rItems = action.requiredItems ? (Array.isArray(action.requiredItems) ? action.requiredItems : [action.requiredItems]) : (action.requiresItem ? [action.requiresItem] : []);
            for (const itemId of rItems) {
                if (!itemRegistry.has(itemId)) issues.push({ type: 'bad_required_item', action: id, ref: itemId, file: relPath, message: `requiresItem "${itemId}" neexistuje v items.js` });
            }

            // rewards
            if (Array.isArray(action.rewards)) {
                for (const r of action.rewards) {
                    if (r.type === 'item') {
                        const itemId = String(r.name || '').toLowerCase().replace(/\s+/g, '_');
                        if (itemId && !itemRegistry.has(itemId)) issues.push({ type: 'bad_reward_item', action: id, ref: itemId, file: relPath, message: `Reward item "${itemId}" neexistuje v items.js (z "${r.name}")` });
                    }
                }
            }

            // effects
            for (const field of ['addsEffect', 'removesEffect']) {
                if (action[field] && !effectRegistry.ids.has(action[field])) issues.push({ type: 'bad_effect', action: id, ref: action[field], file: relPath, message: `${field} "${action[field]}" — efekt neexistuje` });
            }

            // skill
            if (action.requiredSkill && !skillRegistry.has(action.requiredSkill.skill)) issues.push({ type: 'bad_skill', action: id, ref: action.requiredSkill.skill, file: relPath, message: `requiredSkill "${action.requiredSkill.skill}" — skill není definován` });

            // area resources
            for (const field of ['requiresAreaResource', 'drainsAreaResource']) {
                if (action[field]) {
                    const an = typeof action[field] === 'string' ? action[field] : action[field].resource;
                    if (an && !areaRegistry.has(an)) issues.push({ type: 'bad_area_resource', action: id, ref: an, file: relPath, message: `${field} "${an}" — area resource neexistuje` });
                }
            }

            // isAvailable
            const isAvailCode = extractCallbackBody(content, 'isAvailable');
            if (isAvailCode) {
                for (const uk of extractUnlockStateKeys(isAvailCode)) {
                    if (!allActionIds.has(uk) && !uk.endsWith('_repeatCount') && !allActionIds.has(uk.replace(/_repeatCount$/, ''))) issues.push({ type: 'isAvailable_bad_unlock_key', action: id, ref: uk, file: relPath, message: `isAvailable používá unlockState klíč "${uk}", který neodpovídá žádné akci` });
                }
                for (const lk of extractTLocaleKeys(isAvailCode)) { if (!localeKeys.has(lk)) issues.push({ type: 'isAvailable_missing_locale', action: id, ref: lk, file: relPath, message: `isAvailable používá t('${lk}'), ale klíč chybí v locale` }); }
                if (/\bctx\.gameFlags\.loopCount\b/.test(isAvailCode)) mapEntry.conditions.push('Závislé na loopCount');
                if (/\bhasLogin\s*\(/.test(isAvailCode)) mapEntry.conditions.push('hasLogin');
                if (/\bhasMilestone\s*\(/.test(isAvailCode)) mapEntry.conditions.push(`Milestone: ${[...extractMilestoneNames(isAvailCode)].join(', ')}`);
            } else mapEntry.conditions.push('Vždy viditelná');

            // onComplete
            const onCompleteCode = extractCallbackBody(content, 'onComplete');
            if (onCompleteCode) {
                for (const ms of extractMilestoneNames(onCompleteCode)) mapEntry.milestones.push(ms);
                for (const refId of extractActionIdRefs(onCompleteCode)) {
                    if (!allActionIds.has(refId)) issues.push({ type: 'onComplete_bad_action_ref', action: id, ref: refId, file: relPath, message: `onComplete odkazuje na neexistující akci "${refId}"` });
                    else if (refId !== id) mapEntry.hides.push(refId);
                }
                for (const refId of extractFlagActionAsNew(onCompleteCode)) {
                    if (!allActionIds.has(refId)) issues.push({ type: 'onComplete_bad_flag_new', action: id, ref: refId, file: relPath, message: `onComplete volá flagActionAsNew('${refId}'), ale tato akce neexistuje` });
                    else if (refId !== id) mapEntry.shows.push(refId);
                }
                for (const lk of extractTLocaleKeys(onCompleteCode)) { if (!localeKeys.has(lk)) issues.push({ type: 'onComplete_missing_locale', action: id, ref: lk, file: relPath, message: `onComplete používá t('${lk}'), ale klíč chybí v locale` }); }
            }

            // getResultKey
            const getResultKeyCode = extractCallbackBody(content, 'getResultKey');
            if (getResultKeyCode) {
                for (const sm of getResultKeyCode.matchAll(/['"](result_\w+)['"]/g)) { if (!localeKeys.has(sm[1])) issues.push({ type: 'getResultKey_missing_locale', action: id, ref: sm[1], file: relPath, message: `getResultKey používá "${sm[1]}", ale chybí v locale` }); }
                for (const sm of getResultKeyCode.matchAll(/return\s+['"]([^'"]+)['"]/g)) { if (sm[1].startsWith('result_') && !localeKeys.has(sm[1])) issues.push({ type: 'getResultKey_missing_locale', action: id, ref: sm[1], file: relPath, message: `getResultKey vrací "${sm[1]}", ale chybí v locale` }); }
            }

            // onStart
            const onStartCode = extractCallbackBody(content, 'onStart');
            if (onStartCode) {
                for (const lk of extractTLocaleKeys(onStartCode)) { if (!localeKeys.has(lk)) issues.push({ type: 'onStart_missing_locale', action: id, ref: lk, file: relPath, message: `onStart používá t('${lk}'), ale klíč chybí v locale` }); }
            }

            // static resultKey
            if (action.resultKey && typeof action.resultKey === 'string' && !localeKeys.has(action.resultKey)) issues.push({ type: 'resultKey_missing_locale', action: id, ref: action.resultKey, file: relPath, message: `resultKey "${action.resultKey}" chybí v locale` });

            actionMap[id] = mapEntry;
        }
    }

    // Křížové validace — cykly (pouze různé akce)
    for (const [id, entry] of Object.entries(actionMap)) {
        for (const showId of entry.shows) {
            if (showId === id) continue;
            const target = actionMap[showId];
            if (target && target.hides.includes(id)) issues.push({ type: 'cycle_detected', action: id, ref: showId, file: entry.file, message: `Cyklická závislost: "${id}" odkrývá "${showId}", ale "${showId}" skrývá "${id}"` });
        }
    }

    return {
        summary: `Nalezeno ${Object.keys(actionMap).length} akcí, ${issues.length} problémů`, actionCount: Object.keys(actionMap).length, issueCount: issues.length, issues, actionMap,
        registries: { itemCount: itemRegistry.size, effectCount: effectRegistry.ids.size, locationCount: allLocations.size, areaResourceCount: areaRegistry.size, localeKeyCount: localeKeys.size },
    };
}

export { validateActionChain };