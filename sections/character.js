// Character / Inventory section (v1 scaffold)
// Step 2: state-backed rendering (items + equipment + placeholder stats).

import {
    characterState,
    computeCharacterStats,
    computeLevelFromXp,
    getAllocatedStatPoints,
    getTotalStatPointsForLevel,
    allocateStatPoint,
    getBagSize,
    canEquipItemToSlot,
    discardBagItem,
    moveBagItemToEquip,
    moveEquipItemToBag,
    moveEquipItemToEquip,
    swapBagSlots,
} from '../data/character.js';
import { getItemDefinition } from '../data/definitions/items.js';
import { resources } from '../core/resources.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { showConfirmPopup } from '../ui/panels/confirmPopup.js';
import { newBadgeHtml } from '../ui/components/contentNewBadges.js';

let listenersInstalled = false;
let currentDragPayload = null;
let discardMode = false;

const EQUIP_SLOT_LABELS = {
    head: 'Head',
    chest: 'Chest',
    legs: 'Legs',
    boots: 'Boots',
    weapon: 'Weapon',
    offhand: 'Offhand',
    accessory_1: 'Accessory 1',
    accessory_2: 'Accessory 2',
};

const ITEM_STAT_LABELS = {
    health: 'Health',
    stamina: 'Stamina',
    damage: 'Damage',
    attackSpeed: 'Attack Speed',
    armor: 'Armor',
    critChance: 'Crit Chance',
    hitChance: 'Hit Chance',
    evasion: 'Evasion',
    foodCapacity: 'Food Capacity',
    waterCapacity: 'Water Capacity',
};

function refreshCharacterSectionIfVisible() {
    try {
        const sectionEl = document.getElementById('characterSection');
        if (!sectionEl) return;
        // Only refresh if the Character section is currently being shown.
        if (sectionEl.classList.contains('hidden')) return;
        setupCharacterSection(sectionEl);
    } catch { /* non-fatal */ }
}

export function setupCharacterSection(section) {
    if (!section) {
        section = document.getElementById('characterSection');
    }
    if (!section) return;

    installGlobalCharacterListeners();

    const initialTab = (section.dataset && section.dataset.characterActiveTab === 'stats') ? 'stats' : 'gear';
    section.innerHTML = '';

    const { cols: bagCols } = getBagSize();
    const stats = computeCharacterStats(characterState);
    const itemImpact = computeEquippedItemImpact(characterState);
    const bagRows = characterState?.bagRows ?? 2;

    const xp = getXPResourceSnapshot();
    const canSpendPoint = (xp?.statPoints?.unspent ?? 0) > 0;
    const hasNewInventoryItems = hasAnyNewInventoryItems();

    section.innerHTML = `
        <div class="character-tabs" role="tablist" aria-label="Character tabs">
            <button class="character-tab ${initialTab === 'gear' ? 'active' : ''}" data-tab="gear" role="tab" aria-selected="${initialTab === 'gear' ? 'true' : 'false'}">Gear${newBadgeHtml(!!hasNewInventoryItems)}</button>
            <button class="character-tab ${initialTab === 'stats' ? 'active' : ''}" data-tab="stats" role="tab" aria-selected="${initialTab === 'stats' ? 'true' : 'false'}">Stats${newBadgeHtml(!!canSpendPoint)}</button>
        </div>
        <div class="content-panel character-panel">
            <div class="character-tabpanes">
                <div class="character-pane ${initialTab === 'gear' ? 'active' : ''}" data-pane="gear" role="tabpanel">
                    <div class="character-layout character-layout-gear">
                        <div class="character-card equipment-card">
                            <div class="character-card-header">
                                <h3>Equipment</h3>
                            </div>

                            <div class="paperdoll" aria-label="Character silhouette and equipment">
                                <img class="paperdoll-silhouette" src="assets/images/inventorycharacter.png" alt="" />

                                ${renderEquipmentSlot('head', 'Head', characterState?.equipment?.head)}
                                ${renderEquipmentSlot('chest', 'Chest', characterState?.equipment?.chest)}
                                ${renderEquipmentSlot('legs', 'Legs', characterState?.equipment?.legs)}
                                ${renderEquipmentSlot('boots', 'Boots', characterState?.equipment?.boots)}

                                ${renderEquipmentSlot('weapon', 'Weapon', characterState?.equipment?.weapon)}
                                ${renderEquipmentSlot('offhand', 'Offhand', characterState?.equipment?.offhand)}

                                ${renderEquipmentSlot('accessory_1', 'Accessory 1', characterState?.equipment?.accessory_1)}
                                ${renderEquipmentSlot('accessory_2', 'Accessory 2', characterState?.equipment?.accessory_2)}
                            </div>
                        </div>

                        <div class="character-card inventory-card">
                            <div class="character-card-header">
                                <h3>Inventory</h3>
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <span class="character-card-hint">Bag ${bagRows}×${bagCols}</span>
                                    <button type="button" class="inventory-trash-btn ${discardMode ? 'active' : ''}" data-inventory-trash title="Discard items" aria-label="Discard items">
                                        ${renderTrashIcon()}
                                    </button>
                                </div>
                            </div>

                            <div class="bag-grid" style="--bag-cols:${bagCols}; --bag-rows:${bagRows};" aria-label="Inventory bag">
                                ${renderBagSlots()}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="character-pane ${initialTab === 'stats' ? 'active' : ''}" data-pane="stats" role="tabpanel">
                    <div class="character-layout character-layout-stats">
                        <div class="character-card stats-card">
                            <div class="character-card-header">
                                <h3>Stats</h3>
                                <span class="stat-points-chip" data-stat-points-chip role="button" tabindex="0" aria-label="Stat points">
                                    Stat Points: <strong>${escapeHtml(String(xp?.statPoints?.unspent ?? 0))}</strong>
                                </span>
                            </div>

                            <div class="stats-list" aria-label="Character stats">
                                ${renderXPRow()}
                                ${renderHealthRow()}
                                ${renderStaminaRow()}
                                ${renderStatRow('Damage', formatDamageRange(stats), { itemImpact })}
                                ${renderUpgradeableStatRow('Attack Speed', formatAttackSpeed(stats.attackSpeed), { allocateKey: 'attackSpeed', canSpend: canSpendPoint, itemImpact })}
                                ${renderUpgradeableStatRow('Hit Chance', `${Number(stats.hitChance ?? 0)}%`, { allocateKey: 'hitChance', canSpend: canSpendPoint, itemImpact }) }
                                ${renderUpgradeableStatRow('Crit Chance', `${Number(stats.critChance ?? 0)}%`, { allocateKey: 'critChance', canSpend: canSpendPoint, itemImpact })}
                                ${renderStatRow('Armor', String(stats.armor ?? 0), { itemImpact })}
                                ${renderUpgradeableStatRow('Evasion', `${Number(stats.evasion ?? 0)}%`, { allocateKey: 'evasion', canSpend: canSpendPoint, itemImpact })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const panel = section.querySelector('.character-panel');

    // Visual state for discard mode
    panel.classList.toggle('discard-mode', !!discardMode);

    // Tab switching
    const tabs = Array.from(section.querySelectorAll('.character-tab'));
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab === 'stats' ? 'stats' : 'gear';
            try { section.dataset.characterActiveTab = target; } catch { /* ignore */ }
            tabs.forEach(t => {
                t.classList.toggle('active', t === tab);
                t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
            });
            const panes = Array.from(section.querySelectorAll('.character-pane'));
            panes.forEach(p => {
                const isMatch = String(p.dataset.pane || '') === target;
                p.classList.toggle('active', isMatch);
            });
        });
    });

    // Attach interactions after markup is in the DOM
    attachDnDHandlers(section);

    // Attach discard behavior
    attachDiscardHandlers(section);

    // Attach tooltips after markup is in the DOM
    attachItemTooltips(section);

    // Inventory "new" badges: clear on hover/touch.
    attachInventoryNewBadges(section);

    // Stat tooltips (+ points breakdown)
    attachStatTooltips(section);

    // Stat point allocation (+ buttons)
    attachStatAllocationHandlers(section);
}

function renderTrashIcon() {
    // Inline SVG so we don't need an asset file.
    return `
        <svg class="inventory-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" opacity="0.9" />
            <path d="M6 9h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z" fill="none" stroke="currentColor" stroke-width="1.6" />
            <path d="M10 11v8M14 11v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
    `;
}

function attachDiscardHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const trashBtn = panel.querySelector('button[data-inventory-trash]');
    if (trashBtn) {
        trashBtn.addEventListener('click', (e) => {
            e.preventDefault();
            discardMode = !discardMode;
            setupCharacterSection(sectionRoot);
        });
    }

    if (!discardMode) return;

    const bagSlots = Array.from(panel.querySelectorAll('.bag-slot.has-item'));
    for (const slotEl of bagSlots) {
        slotEl.addEventListener('click', async (e) => {
            e.preventDefault();

            const idx = Number(slotEl.dataset.slot);
            if (!Number.isInteger(idx)) return;
            const itemId = Array.isArray(characterState?.bag) ? characterState.bag[idx] : null;
            if (!itemId) return;

            const def = getItemDefinition(itemId);
            const name = def?.name || itemId;

            const ok = await showConfirmPopup({
                title: 'Discard Item',
                message: `Discard ${name}? This cannot be undone.`,
                confirmText: 'Yes',
                cancelText: 'Cancel',
            });
            if (!ok) return;

            const changed = discardBagItem(idx);
            if (changed) commitCharacterChange(sectionRoot);

            // Keep discard mode enabled so the player can discard multiple items.
            setupCharacterSection(sectionRoot);
        });
    }
}

function renderEquipmentSlot(key, label, itemId) {
    const safeKey = String(key).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const item = itemId ? getItemDefinition(itemId) : null;
    const hasItem = !!item;
    const icon = (item && item.icon) ? String(item.icon) : '';
    return `
        <div class="equipment-slot ${hasItem ? 'has-item' : ''}" data-slot="${safeKey}" data-item-id="${hasItem ? escapeHtml(item.id) : ''}" ${hasItem ? 'draggable="true"' : ''} role="button" tabindex="0" aria-label="${label} slot">
            <div class="slot-frame"></div>
            ${hasItem ? `
                <div class="slot-item">
                    ${icon ? `<img class="item-icon" src="${escapeHtml(icon)}" alt="" />` : ''}
                    <span class="item-name">${escapeHtml(item.name)}</span>
                </div>
            ` : ''}
            <div class="slot-label">${label}</div>
        </div>
    `;
}

function renderStatRow(label, value, opts = {}) {
    const safeKey = String(label).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const iconHtml = renderStatLabelIconHtml(safeKey);
    const impactClass = getItemImpactClassForUiStatKey(safeKey, opts.itemImpact);
    return `
        <div class="stat-line" data-stat-line="${safeKey}">
            <div class="stat-row ${impactClass}" data-stat="${safeKey}">
                <span class="stat-label">${iconHtml}<span class="stat-label-text">${escapeHtml(String(label))}</span></span>
                <span class="stat-value">${value}</span>
            </div>
            ${renderAllocateSpacerHtml()}
        </div>
    `;
}

function renderStatLabelIconHtml(statKey) {
    const key = String(statKey || '').toLowerCase();

    // Match the combat popup stat icons.
    const kindByKey = {
        hit_chance: 'target',
        crit_chance: 'burst',
        evasion: 'swirl',
        armor: 'shield',
        damage: 'sword',
        attack_speed: 'clock',
    };

    const kind = kindByKey[key];
    if (!kind) return '';

    return `<span class="stat-label-icon" aria-hidden="true">${svgIcon(kind)}</span>`;
}

function svgIcon(kind) {
    switch (kind) {
        case 'target':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/></svg>`;
        case 'burst':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2L12 2z"/></svg>`;
        case 'swirl':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/><path d="M12 7a5 5 0 1 0 5 5"/></svg>`;
        case 'shield':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/></svg>`;
        case 'sword':
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-9 9H5v-7l9-9z"/><path d="M16 5l3 3"/><path d="M6 18l3 3"/></svg>`;
        case 'clock':
        default:
            return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`;
    }
}

function renderAllocateButtonHtml(allocateKey, opts = {}) {
    const key = String(allocateKey || '');
    if (!key) return '';
    const disabled = !!opts.disabled;
    const label = opts.label ? String(opts.label) : 'Increase stat (cost: 1 stat point)';
    return `
        <button type="button" class="stat-allocate-btn" data-allocate-stat="${escapeHtml(key)}" ${disabled ? 'disabled' : ''} aria-label="${escapeHtml(label)}">
            +
        </button>
    `;
}

function renderAllocateSpacerHtml() {
    return `<span class="stat-allocate-spacer" aria-hidden="true"></span>`;
}

function renderUpgradeableStatRow(label, value, opts = {}) {
    const safeKey = String(label).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const allocateKey = opts.allocateKey ? String(opts.allocateKey) : '';
    const canSpend = !!opts.canSpend;
    const iconHtml = renderStatLabelIconHtml(safeKey);
    const impactClass = getItemImpactClassForUiStatKey(safeKey, opts.itemImpact);
    const btn = allocateKey
        ? renderAllocateButtonHtml(allocateKey, { disabled: !canSpend, label: `Increase ${label} (cost: 1 stat point)` })
        : '';
    return `
        <div class="stat-line" data-stat-line="${safeKey}">
            <div class="stat-row ${impactClass}" data-stat="${safeKey}">
                <span class="stat-label">${iconHtml}<span class="stat-label-text">${escapeHtml(String(label))}</span></span>
                <span class="stat-value">${value}</span>
            </div>
            ${btn}
        </div>
    `;
}

function computeEquippedItemImpact(state = characterState) {
    const equipment = (state && state.equipment && typeof state.equipment === 'object') ? state.equipment : {};
    const slots = Object.keys(EQUIP_SLOT_LABELS);

    const byUiKey = {
        damage: { total: 0, parts: [] },
        attack_speed: { total: 0, parts: [] },
        hit_chance: { total: 0, parts: [] },
        crit_chance: { total: 0, parts: [] },
        armor: { total: 0, parts: [] },
        evasion: { total: 0, parts: [] },
    };

    const addPart = (uiKey, slotKey, itemId, itemName, delta, kind) => {
        if (!byUiKey[uiKey]) byUiKey[uiKey] = { total: 0, parts: [] };
        byUiKey[uiKey].total += delta;
        byUiKey[uiKey].parts.push({ slotKey, slotLabel: EQUIP_SLOT_LABELS[slotKey] || slotKey, itemId, itemName, delta, kind });
    };

    for (const slotKey of slots) {
        const itemId = equipment[slotKey];
        if (!itemId) continue;
        const def = getItemDefinition(itemId);
        if (!def) continue;
        const itemName = def.name || def.id || itemId;
        const stats = (def.stats && typeof def.stats === 'object') ? def.stats : null;
        if (!stats) continue;

        for (const [k, raw] of Object.entries(stats)) {
            const v = Number(raw);
            if (!Number.isFinite(v) || v === 0) continue;

            // UI stat keys are snake_case; item stat keys are camelCase.
            if (k === 'damage') {
                // Damage affects both ends equally; treat it as a single delta for coloring.
                addPart('damage', slotKey, itemId, itemName, v, 'damage');
                continue;
            }
            if (k === 'damageMin' || k === 'damageMax') {
                // If any item ever uses explicit min/max, approximate the overall change.
                addPart('damage', slotKey, itemId, itemName, v, k);
                continue;
            }

            const uiKey = (
                k === 'attackSpeed' ? 'attack_speed'
                    : (k === 'hitChance' ? 'hit_chance'
                        : (k === 'critChance' ? 'crit_chance'
                            : k))
            );

            if (!byUiKey[uiKey]) continue;
            addPart(uiKey, slotKey, itemId, itemName, v, k);
        }
    }

    return byUiKey;
}

function getItemImpactClassForUiStatKey(uiStatKey, itemImpact) {
    const key = String(uiStatKey || '').toLowerCase();
    const impact = itemImpact && itemImpact[key];
    if (!impact || !Number.isFinite(Number(impact.total)) || Number(impact.total) === 0) return '';

    // For most stats: higher is better. For attack_speed (seconds per attack): lower is better.
    const higherIsBetter = (key !== 'attack_speed');
    const score = Number(impact.total) * (higherIsBetter ? 1 : -1);
    if (score > 0) return 'is-item-positive';
    if (score < 0) return 'is-item-negative';
    return '';
}

function getXPResourceSnapshot() {
    const res = Array.isArray(resources) ? resources.find(r => r && r.name === 'XP') : null;
    const total = res ? Math.max(0, Math.floor(Number(res.amount ?? 0))) : 0;

    const lvl = computeLevelFromXp(total);
    const alloc = getAllocatedStatPoints(characterState);
    const totalPoints = getTotalStatPointsForLevel(lvl.level);
    const spent = Math.max(0, Math.floor(Number(alloc?.spent ?? 0)));
    const unspent = Math.max(0, totalPoints - spent);

    return {
        total: lvl.total,
        level: lvl.level,
        progress: lvl.progress,
        max: lvl.toNext,
        percent: Math.max(0, Math.min(1, lvl.percent)),
        statPoints: {
            total: totalPoints,
            spent,
            unspent,
        },
        allocated: alloc?.allocated || {},
    };
}

function renderXPRow() {
    const xp = getXPResourceSnapshot();
    const percent = Math.round(xp.percent * 100);
    const valueText = `Lv ${xp.level}`;
    const aria = `Level ${xp.level}. XP ${xp.progress} / ${xp.max}. Total XP ${xp.total}.`;

    return `
        <div class="stat-line" data-stat-line="xp">
            <div class="stat-row stat-row-bar" data-stat="xp">
                <span class="stat-label">Level</span>
                <div class="stat-bar" role="img" aria-label="${escapeHtml(aria)}">
                    <div class="stat-bar-fill" style="width:${percent}%"></div>
                </div>
                <span class="stat-value">${escapeHtml(valueText)}</span>
            </div>
            ${renderAllocateSpacerHtml()}
        </div>
    `;
}

function getStaminaResourceSnapshot() {
    const res = Array.isArray(resources) ? resources.find(r => r && r.name === 'Stamina') : null;
    if (!res) return { current: 0, max: 0, percent: 0 };
    const max = Math.max(0, Number(res.capacity ?? 0));
    const current = Math.max(0, Math.min(max || Number.POSITIVE_INFINITY, Number(res.amount ?? 0)));
    const percent = max > 0 ? (current / max) : 0;
    return {
        current: Math.round(current),
        max: Math.round(max),
        percent: Math.max(0, Math.min(1, percent))
    };
}

function getHealthResourceSnapshot() {
    const res = Array.isArray(resources) ? resources.find(r => r && r.name === 'Health') : null;
    if (!res) return { current: 0, max: 0, percent: 0 };
    const max = Math.max(0, Number(res.capacity ?? 0));
    const current = Math.max(0, Math.min(max || Number.POSITIVE_INFINITY, Number(res.amount ?? 0)));
    const percent = max > 0 ? (current / max) : 0;
    return {
        current: Math.round(current),
        max: Math.round(max),
        percent: Math.max(0, Math.min(1, percent))
    };
}

function renderHealthRow() {
    const h = getHealthResourceSnapshot();
    const percent = Math.round(h.percent * 100);
    const valueText = h.max > 0 ? `${h.current} / ${h.max}` : String(h.current);
    const aria = (h.max > 0)
        ? `Health ${h.current} / ${h.max}`
        : `Health ${h.current}`;

    const xp = getXPResourceSnapshot();
    const btn = renderAllocateButtonHtml('health', {
        disabled: (xp?.statPoints?.unspent ?? 0) <= 0,
        label: 'Increase max Health (cost: 1 stat point)'
    });

    return `
        <div class="stat-line" data-stat-line="health">
            <div class="stat-row stat-row-bar" data-stat="health">
                <span class="stat-label">Health</span>
                <div class="stat-bar" role="img" aria-label="${escapeHtml(aria)}">
                    <div class="stat-bar-fill" style="width:${percent}%"></div>
                </div>
                <span class="stat-value">${escapeHtml(valueText)}</span>
            </div>
            ${btn}
        </div>
    `;
}

function renderStaminaRow() {
    const s = getStaminaResourceSnapshot();
    const percent = Math.round(s.percent * 100);
    const valueText = s.max > 0 ? `${s.current} / ${s.max}` : String(s.current);
    const aria = (s.max > 0)
        ? `Stamina ${s.current} / ${s.max}`
        : `Stamina ${s.current}`;

    const xp = getXPResourceSnapshot();
    const btn = renderAllocateButtonHtml('stamina', {
        disabled: (xp?.statPoints?.unspent ?? 0) <= 0,
        label: 'Increase max Stamina (cost: 1 stat point)'
    });

    return `
        <div class="stat-line" data-stat-line="stamina">
            <div class="stat-row stat-row-bar" data-stat="stamina">
                <span class="stat-label">Stamina</span>
                <div class="stat-bar" role="img" aria-label="${escapeHtml(aria)}">
                    <div class="stat-bar-fill" style="width:${percent}%"></div>
                </div>
                <span class="stat-value">${escapeHtml(valueText)}</span>
            </div>
            ${btn}
        </div>
    `;
}

function attachStatAllocationHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const buttons = Array.from(panel.querySelectorAll('button[data-allocate-stat]'));
    if (!buttons.length) return;

    for (const btn of buttons) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const key = String(btn.dataset.allocateStat || '');
            if (!key) return;

            const xp = getXPResourceSnapshot();
            const ok = allocateStatPoint(key, xp.total, characterState);
            if (!ok) return;

            commitCharacterChange(sectionRoot);
        });
    }
}

function renderBagSlots() {
    const bag = Array.isArray(characterState?.bag) ? characterState.bag : [];
    return bag.map((itemId, i) => {
        const item = itemId ? getItemDefinition(itemId) : null;
        const hasItem = !!item;
        const label = hasItem ? item.name : '';
        const icon = (item && item.icon) ? String(item.icon) : '';
        const showNew = hasItem && !!(characterState?.bagUiNew && characterState.bagUiNew[i]);
        return `
            <div class="bag-slot ${hasItem ? 'has-item' : ''}" data-slot="${i}" data-item-id="${hasItem ? escapeHtml(item.id) : ''}" ${hasItem ? 'draggable="true"' : ''} role="button" tabindex="0" aria-label="Bag slot ${i + 1}">
                ${newBadgeHtml(showNew)}
                ${hasItem ? `
                    <div class="bag-item">
                        ${icon ? `<img class="item-icon" src="${escapeHtml(icon)}" alt="" />` : ''}
                        <span class="item-name">${escapeHtml(label)}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function hasAnyNewInventoryItems() {
    try {
        const flags = characterState && Array.isArray(characterState.bagUiNew) ? characterState.bagUiNew : [];
        return flags.some(v => !!v);
    } catch {
        return false;
    }
}

function attachInventoryNewBadges(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const slots = Array.from(panel.querySelectorAll('.bag-slot.has-item'));
    if (!slots.length) return;

    const clearForIndex = (slotEl, idx) => {
        if (!Number.isInteger(idx) || idx < 0) return;
        try {
            if (characterState && Array.isArray(characterState.bagUiNew) && characterState.bagUiNew[idx]) {
                characterState.bagUiNew[idx] = false;
            } else {
                return;
            }
        } catch { /* ignore */ }

        try { slotEl.querySelector('.action-new-badge')?.remove(); } catch { /* ignore */ }

        // If no more new inventory, remove the Gear tab badge.
        try {
            if (!hasAnyNewInventoryItems()) {
                const gearTab = sectionRoot.querySelector('.character-tab[data-tab="gear"]');
                gearTab?.querySelector('.action-new-badge')?.remove();
            }
        } catch { /* ignore */ }

        // Persist quietly (avoid log spam)
        import('../core/saveload.js').then(mod => {
            try { mod?.saveGameStateQuiet?.(); } catch { /* ignore */ }
        }).catch(() => {});
    };

    for (const slotEl of slots) {
        const idx = Number(slotEl?.dataset?.slot);
        if (!Number.isInteger(idx)) continue;
        if (!(characterState && Array.isArray(characterState.bagUiNew) && characterState.bagUiNew[idx])) continue;

        if (slotEl.dataset && slotEl.dataset.invUiNewWired === 'true') continue;
        try { if (slotEl.dataset) slotEl.dataset.invUiNewWired = 'true'; } catch { /* ignore */ }

        const clear = () => clearForIndex(slotEl, idx);
        slotEl.addEventListener('mouseenter', clear);
        slotEl.addEventListener('focus', clear);
        slotEl.addEventListener('pointerdown', clear, { passive: true });
        slotEl.addEventListener('touchstart', clear, { passive: true });
    }
}

function attachItemTooltips(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const equipSlots = Array.from(panel.querySelectorAll('.equipment-slot.has-item'));
    const bagSlots = Array.from(panel.querySelectorAll('.bag-slot.has-item'));

    for (const el of [...equipSlots, ...bagSlots]) {
        if (!el || !el.dataset) continue;
        const itemId = String(el.dataset.itemId || '');
        if (!itemId) continue;

        // Use a function so tooltips can auto-refresh safely.
        setupTooltip(el, () => buildItemTooltipHTML(el));
    }
}

function attachStatTooltips(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const rows = Array.from(panel.querySelectorAll('.stats-card .stat-row'));
    for (const row of rows) {
        const statKey = String(row?.dataset?.stat || '');
        if (!statKey) continue;
        setupTooltip(row, () => buildStatTooltipHTML(statKey));
    }

    const pointsChip = panel.querySelector('[data-stat-points-chip]');
    if (pointsChip) {
        setupTooltip(pointsChip, () => buildStatTooltipHTML('stat_points'));
    }
}

function buildStatTooltipHTML(statKey) {
    const key = String(statKey || '').toLowerCase();
    const stats = computeCharacterStats(characterState);
    const itemImpact = computeEquippedItemImpact(characterState);
    const xp = getXPResourceSnapshot();
    const alloc = xp?.allocated || {};

    const bullets = (items) => {
        const clean = (Array.isArray(items) ? items : []).filter(Boolean).map(s => String(s));
        if (!clean.length) return '';
        return `<ul class="tooltip-bullets">${clean.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    };

    switch (key) {
        case 'xp': {
            return `
                <h4>Level</h4>
                <p>Current Level: <strong>${escapeHtml(String(xp.level))}</strong></p>
                <p class="tooltip-detail">XP to next level: ${escapeHtml(String(xp.progress))} / ${escapeHtml(String(xp.max))}</p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    <p>Level is derived from total XP. Each level gained grants <strong>3 stat points</strong> to allocate.</p>
                    <p class="tooltip-detail">Formula: XP to next level = 100 × current level.</p>
                    <p class="tooltip-detail">Total XP: ${escapeHtml(xp.total.toLocaleString())}</p>
                </div>
            `;
        }
        case 'stat_points': {
            const pts = xp?.statPoints || { unspent: 0, total: 0, spent: 0 };
            return `
                <h4>Stat Points</h4>
                <p>Available: <strong>${escapeHtml(String(pts.unspent))}</strong></p>
                <p class="tooltip-detail">Spent: ${escapeHtml(String(pts.spent))} / ${escapeHtml(String(pts.total))}</p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    <p>You gain 3 points each time your Level increases.</p>
                    <p class="tooltip-detail">Spend points using the + buttons next to upgradeable stats.</p>
                </div>
            `;
        }
        case 'health': {
            const h = getHealthResourceSnapshot();
            const pts = Math.max(0, Math.floor(Number(alloc.health) || 0));
            const b = bullets([
                '1 stat point: +5 max Health.',
                `Allocated: ${pts} (total: +${pts * 5} max Health).`,
            ]);
            return `
                <h4>Health</h4>
                <p>Current: <strong>${escapeHtml(String(h.current))}</strong>${h.max > 0 ? ` / ${escapeHtml(String(h.max))}` : ''}</p>
                <div class="tooltip-section">
                    <h4>Notes</h4>
                    <p>Health is your HP in combat.</p>
                    ${b}
                </div>
            `;
        }
        case 'stamina': {
            const s = getStaminaResourceSnapshot();
            const pts = Math.max(0, Math.floor(Number(alloc.stamina) || 0));
            const b = bullets([
                '1 stat point: +5 max Stamina.',
                `Allocated: ${pts} (total: +${pts * 5} max Stamina).`,
            ]);
            return `
                <h4>Stamina</h4>
                <p>Current: <strong>${escapeHtml(String(s.current))}</strong>${s.max > 0 ? ` / ${escapeHtml(String(s.max))}` : ''}</p>
                <div class="tooltip-section">
                    <h4>Notes</h4>
                    <p>Stamina is your short-term endurance.</p>
                    ${b}
                </div>
            `;
        }
        case 'damage': {
            const min = Number(stats?.damageMin ?? 0);
            const max = Number(stats?.damageMax ?? min);

            const parts = (itemImpact?.damage?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const hasWeapon = !!(characterState?.equipment?.weapon);
            const lines = [];
            if (parts.length) {
                for (const p of parts) {
                    const sign = p.delta > 0 ? '+' : '';
                    lines.push(`${p.slotLabel}: ${p.itemName} (${sign}${Math.abs(p.delta)} damage)`);
                }
            } else {
                lines.push(hasWeapon ? 'No equipped items modify damage.' : 'No weapon equipped (damage is unmodified).');
            }
            return `
                <h4>Damage</h4>
                <p>Shown as a range: <strong>${escapeHtml(String(Math.floor(min)))} - ${escapeHtml(String(Math.floor(max)))}</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    <p>Higher damage increases your DPS in combat.</p>
                    ${bullets(['Affected by your equipped weapon (and any other equipped items with damage modifiers).'])}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(lines)}
                </div>
            `;
        }
        case 'attack_speed': {
            const speed = Number(stats?.attackSpeed ?? 1);
            const pts = Math.max(0, Math.floor(Number(alloc.attackSpeed) || 0));
            const bonusDelta = pts > 0 ? (-(pts * 0.05)).toFixed(2) : '0.00';
            const parts = (itemImpact?.attack_speed?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const itemLines = parts.length
                ? parts.map(p => {
                    const sign = p.delta > 0 ? '+' : '';
                    return `${p.slotLabel}: ${p.itemName} (${sign}${Number(p.delta).toFixed(2)}s)`;
                })
                : ['No equipped items modify attack speed.'];
            const b = bullets([
                'Seconds per attack (lower is faster).',
                'Minimum: 0.20s per attack.',
                '1 stat point: −0.05s per attack.',
                `Allocated: ${pts} (total: ${bonusDelta}s).`,
            ]);
            return `
                <h4>Attack Speed</h4>
                <p>Time between attacks: <strong>${escapeHtml(formatAttackSpeed(speed))}</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    ${b}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(itemLines)}
                </div>
            `;
        }
        case 'hit_chance': {
            const hit = Number(stats?.hitChance ?? 0);
            const pts = Math.max(0, Math.floor(Number(alloc.hitChance) || 0));
            const parts = (itemImpact?.hit_chance?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const itemLines = parts.length
                ? parts.map(p => {
                    const sign = p.delta > 0 ? '+' : '';
                    return `${p.slotLabel}: ${p.itemName} (${sign}${Math.abs(p.delta)}% hit chance)`;
                })
                : ['No equipped items modify hit chance.'];
            const b = bullets([
                'Chance to land an attack before evasion.',
                'Capped at: 95%.',
                '1 stat point: +1% hit chance.',
                `Allocated: ${pts} (total: +${pts}% hit chance).`,
                'On miss, that attack deals no damage.',
            ]);
            return `
                <h4>Hit Chance</h4>
                <p>Chance to land an attack: <strong>${escapeHtml(String(hit))}%</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    ${b}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(itemLines)}
                </div>
            `;
        }
        case 'crit_chance': {
            const crit = Number(stats?.critChance ?? 0);
            const pts = Math.max(0, Math.floor(Number(alloc.critChance) || 0));
            const parts = (itemImpact?.crit_chance?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const itemLines = parts.length
                ? parts.map(p => {
                    const sign = p.delta > 0 ? '+' : '';
                    return `${p.slotLabel}: ${p.itemName} (${sign}${Math.abs(p.delta)}% crit chance)`;
                })
                : ['No equipped items modify crit chance.'];
            const b = bullets([
                'Critical hits add +50% damage.',
                'Capped at: 100%.',
                '1 stat point: +1% crit chance.',
                `Allocated: ${pts} (total: +${pts}% crit chance).`,
            ]);
            return `
                <h4>Crit Chance</h4>
                <p>Chance: <strong>${escapeHtml(String(crit))}%</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    ${b}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(itemLines)}
                </div>
            `;
        }
        case 'armor': {
            const armor = Math.max(0, Number(stats?.armor ?? 0));
            const parts = (itemImpact?.armor?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const itemLines = parts.length
                ? parts.map(p => {
                    const sign = p.delta > 0 ? '+' : '';
                    return `${p.slotLabel}: ${p.itemName} (${sign}${Math.abs(p.delta)} armor)`;
                })
                : ['No equipped items modify armor.'];
            const mitigation = armor / (armor + 20);
            const taken = 1 - mitigation;
            const b = bullets([
                'Armor reduces damage taken with diminishing returns.',
                'Damage taken = round(damage × 20/(armor+20)).',
                'Examples: armor 0→100%, 10→67%, 20→50%, 40→33%.',
                `Current: ~${Math.round(taken * 100)}% damage taken.`,
            ]);
            return `
                <h4>Armor</h4>
                <p>Value: <strong>${escapeHtml(String(Math.floor(armor)))}</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    ${b}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(itemLines)}
                </div>
            `;
        }
        case 'evasion': {
            const ev = Math.max(0, Number(stats?.evasion ?? 0));
            const pts = Math.max(0, Math.floor(Number(alloc.evasion) || 0));
            const parts = (itemImpact?.evasion?.parts || []).filter(p => Number.isFinite(Number(p.delta)) && Number(p.delta) !== 0);
            const itemLines = parts.length
                ? parts.map(p => {
                    const sign = p.delta > 0 ? '+' : '';
                    return `${p.slotLabel}: ${p.itemName} (${sign}${Math.abs(p.delta)}% evasion)`;
                })
                : ['No equipped items modify evasion.'];
            const b = bullets([
                "Reduces the enemy's chance to hit you (multiplies by 1 − evasion).",
                'Capped at: 75%.',
                '1 stat point: +1% evasion.',
                `Allocated: ${pts} (total: +${pts}% evasion).`,
            ]);
            return `
                <h4>Evasion</h4>
                <p>Chance to avoid an incoming attack: <strong>${escapeHtml(String(ev))}%</strong></p>
                <div class="tooltip-section">
                    <h4>How It Works</h4>
                    ${b}
                </div>
                <div class="tooltip-section">
                    <h4>Affected By Items</h4>
                    ${bullets(itemLines)}
                </div>
            `;
        }
        default:
            return `<h4>${escapeHtml(statKey)}</h4><p class="tooltip-detail">No tooltip available.</p>`;
    }
}

function formatAttackSpeed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '1.00s';
    return `${n.toFixed(2)}s`;
}

function formatDamageRange(stats) {
    const min = Number(stats?.damageMin);
    const max = Number(stats?.damageMax);
    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : safeMin;
    const isInt = Number.isInteger(safeMin) && Number.isInteger(safeMax);
    const fmt = (n) => isInt ? String(Math.floor(n)) : Number(n).toFixed(1);
    return `${fmt(safeMin)} - ${fmt(safeMax)}`;
}

function buildItemTooltipHTML(slotEl) {
    if (!slotEl || !slotEl.dataset) return '';
    const itemId = String(slotEl.dataset.itemId || '');
    if (!itemId) return '';

    const def = getItemDefinition(itemId);
    if (!def) return '';

    const isEquip = slotEl.classList && slotEl.classList.contains('equipment-slot');

    const lines = [];
    const statLabels = {
        health: 'Health',
        stamina: 'Stamina',
        damage: 'Damage',
        attackSpeed: 'Attack Speed',
        armor: 'Armor',
        critChance: 'Crit Chance',
        hitChance: 'Hit Chance',
        evasion: 'Evasion',
    };
    const equipSlotLabels = {
        head: 'Head',
        chest: 'Chest',
        legs: 'Legs',
        boots: 'Boots',
        weapon: 'Weapon',
        offhand: 'Offhand',
        accessory_1: 'Accessory 1',
        accessory_2: 'Accessory 2',
    };

    const stats = (def && def.stats && typeof def.stats === 'object') ? def.stats : null;
    if (stats) {
        for (const [k, v] of Object.entries(stats)) {
            if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue;
            const label = statLabels[k] || k;
            const sign = v > 0 ? '+' : '';
            const suffix = (k === 'critChance' || k === 'hitChance' || k === 'evasion') ? '%'
                : (k === 'attackSpeed' ? 's' : '');
            lines.push(`${escapeHtml(label)}: ${sign}${escapeHtml(String(v))}${suffix}`);
        }
    }

    const slotName = (def.slot === 'accessory')
        ? 'Accessory'
        : (equipSlotLabels[String(def.slot || '')] || String(def.slot || ''));

    let html = `<h4>${escapeHtml(def.name || def.id || 'Item')}</h4>`;

    if (def.description) {
        html += `<p class="tooltip-description">${escapeHtml(String(def.description))}</p>`;
    }

    html += `<div class="tooltip-section"><h4>Slot</h4><p>${escapeHtml(String(slotName || '—'))}</p></div>`;

    if (lines.length) {
        html += `<div class="tooltip-section"><h4>Modifiers</h4><ul class="tooltip-bonuses">${lines.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul></div>`;
    } else {
        html += `<div class="tooltip-section"><h4>Modifiers</h4><p>None</p></div>`;
    }

    return html;
}

function installGlobalCharacterListeners() {
    if (listenersInstalled) return;
    listenersInstalled = true;

    // Refresh UI when inventory/equipment changes while the Character screen is open.
    window.addEventListener('character-state-changed', () => {
        refreshCharacterSectionIfVisible();
    });

    window.addEventListener('game-state-applied', () => {
        const section = document.getElementById('characterSection');
        if (section) setupCharacterSection(section);
    });
    window.addEventListener('gameReset', () => {
        const section = document.getElementById('characterSection');
        if (section) setupCharacterSection(section);
    });

    // Keep stamina bar live as the Stamina resource drains/recovers.
    window.addEventListener('resources-updated', () => {
        const section = document.getElementById('characterSection');
        if (!section) return;
        updateVitalRowsIfPresent(section);
    });
}

function updateVitalRowsIfPresent(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;
    updateXPRowIfPresent(panel);
    updateStatPointsChipIfPresent(panel);
    updateAllocateButtonsIfPresent(panel);
    updateSingleVitalRow(panel, 'stamina', getStaminaResourceSnapshot, 'Stamina');
    updateSingleVitalRow(panel, 'health', getHealthResourceSnapshot, 'Health');
}

function updateXPRowIfPresent(panelEl) {
    const row = panelEl.querySelector('.stat-row[data-stat="xp"]');
    if (!row) return;

    const fill = row.querySelector('.stat-bar-fill');
    const text = row.querySelector('.stat-value');
    const bar = row.querySelector('.stat-bar');

    const xp = getXPResourceSnapshot();
    const percent = Math.round(xp.percent * 100);
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `Lv ${xp.level}`;
    if (bar) bar.setAttribute('aria-label', `Level ${xp.level}. XP ${xp.progress} / ${xp.max}. Total XP ${xp.total}.`);
}

function updateStatPointsChipIfPresent(panelEl) {
    const chip = panelEl.querySelector('[data-stat-points-chip]');
    if (!chip) return;
    const xp = getXPResourceSnapshot();
    const unspent = xp?.statPoints?.unspent ?? 0;
    // Keep inner HTML structure stable (label + strong).
    chip.innerHTML = `Stat Points: <strong>${escapeHtml(String(unspent))}</strong>`;
}

function updateAllocateButtonsIfPresent(panelEl) {
    const xp = getXPResourceSnapshot();
    const disabled = (xp?.statPoints?.unspent ?? 0) <= 0;
    const buttons = Array.from(panelEl.querySelectorAll('button[data-allocate-stat]'));
    for (const btn of buttons) {
        btn.disabled = disabled;
    }
}

function updateSingleVitalRow(panelEl, statKey, getSnapshotFn, label) {
    const row = panelEl.querySelector(`.stat-row[data-stat="${statKey}"]`);
    if (!row) return;

    const fill = row.querySelector('.stat-bar-fill');
    const text = row.querySelector('.stat-value');
    const bar = row.querySelector('.stat-bar');

    const s = getSnapshotFn();
    const percent = Math.round(s.percent * 100);
    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = s.max > 0 ? `${s.current} / ${s.max}` : String(s.current);
    if (bar) {
        const aria = (s.max > 0)
            ? `${label} ${s.current} / ${s.max}`
            : `${label} ${s.current}`;
        bar.setAttribute('aria-label', aria);
    }
}

function attachDnDHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    const bagSlots = Array.from(panel.querySelectorAll('.bag-slot'));
    const equipSlots = Array.from(panel.querySelectorAll('.equipment-slot'));

    bagSlots.forEach(slotEl => {
        slotEl.addEventListener('dragstart', (e) => onDragStart(e, { type: 'bag', index: Number(slotEl.dataset.slot) }));
        slotEl.addEventListener('dragend', onDragEnd);
        slotEl.addEventListener('dragover', (e) => onDragOver(e, { type: 'bag', index: Number(slotEl.dataset.slot) }));
        slotEl.addEventListener('dragleave', () => clearDropVisual(slotEl));
        slotEl.addEventListener('drop', (e) => onDrop(e, { type: 'bag', index: Number(slotEl.dataset.slot) }, sectionRoot));
        slotEl.addEventListener('dblclick', () => {
            const idx = Number(slotEl.dataset.slot);
            if (!Number.isFinite(idx)) return;
            const changed = autoEquipFromBag(idx);
            if (changed) commitCharacterChange(sectionRoot);
        });
    });

    equipSlots.forEach(slotEl => {
        slotEl.addEventListener('dragstart', (e) => onDragStart(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }));
        slotEl.addEventListener('dragend', onDragEnd);
        slotEl.addEventListener('dragover', (e) => onDragOver(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }));
        slotEl.addEventListener('dragleave', () => clearDropVisual(slotEl));
        slotEl.addEventListener('drop', (e) => onDrop(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }, sectionRoot));
        slotEl.addEventListener('dblclick', () => {
            const slot = String(slotEl.dataset.slot || '');
            if (!slot) return;
            const changed = autoUnequipToFirstEmptyBag(slot);
            if (changed) commitCharacterChange(sectionRoot);
        });
    });

    // Mobile/touch fallback: pointer-based drag/drop + double-tap equip/unequip.
    attachTouchInventoryInteractions(sectionRoot);
}

function attachTouchInventoryInteractions(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;

    // Avoid re-attaching global listeners on every re-render.
    if (sectionRoot._touchInventoryInteractionsAttached) return;
    sectionRoot._touchInventoryInteractionsAttached = true;

    const state = {
        activePointerId: null,
        startX: 0,
        startY: 0,
        panelEl: null,
        source: null,
        itemId: null,
        originKey: '',
        originEl: null,
        dragging: false,
        payload: null,
        hoverEl: null,
        ghostEl: null,
        lastTapTime: 0,
        lastTapKey: '',
    };
    sectionRoot._touchInventoryState = state;

    const isTouchLike = (e) => {
        const pt = String(e?.pointerType || '');
        return pt && pt !== 'mouse';
    };

    const keyForSource = (src) => {
        if (!src) return '';
        if (src.type === 'bag') return `bag:${String(src.index)}`;
        if (src.type === 'equip') return `equip:${String(src.slot || '')}`;
        return '';
    };

    const sourceFromSlotEl = (slotEl) => {
        if (!slotEl || !slotEl.classList) return null;
        if (slotEl.classList.contains('bag-slot')) {
            const idx = Number(slotEl.dataset.slot);
            if (!Number.isFinite(idx)) return null;
            return { type: 'bag', index: idx };
        }
        if (slotEl.classList.contains('equipment-slot')) {
            const slot = String(slotEl.dataset.slot || '');
            if (!slot) return null;
            return { type: 'equip', slot };
        }
        return null;
    };

    const targetFromSlotEl = (slotEl) => {
        const src = sourceFromSlotEl(slotEl);
        if (!src) return null;
        // Rename to match expected target format.
        if (src.type === 'bag') return { type: 'bag', index: Number(src.index) };
        return { type: 'equip', slot: String(src.slot || '') };
    };

    const updateGhostPosition = (x, y) => {
        const g = state.ghostEl;
        if (!g) return;
        g.style.left = `${Math.round(x)}px`;
        g.style.top = `${Math.round(y)}px`;
    };

    const clearHover = () => {
        if (state.hoverEl && state.hoverEl.classList) state.hoverEl.classList.remove('drop-hover');
        state.hoverEl = null;
    };

    const cleanupDrag = () => {
        state.dragging = false;
        state.payload = null;
        state.panelEl = null;
        state.source = null;
        state.itemId = null;
        state.originKey = '';
        state.originEl = null;
        state.activePointerId = null;
        clearHover();
        currentDragPayload = null;
        clearAllDropVisuals();
        document.body.classList.remove('is-touch-dragging');
        if (state.ghostEl && state.ghostEl.parentNode) state.ghostEl.parentNode.removeChild(state.ghostEl);
        state.ghostEl = null;
    };

    const startTouchDrag = (clientX, clientY) => {
        if (discardMode) return;
        if (!state.source || !state.itemId) return;

        state.dragging = true;
        state.payload = { source: state.source, itemId: state.itemId };
        currentDragPayload = state.payload;

        // Show valid targets, like desktop drag.
        highlightValidDropTargets(state.payload);
        document.body.classList.add('is-touch-dragging');

        // Create a lightweight ghost (icon + short label).
        const ghost = document.createElement('div');
        ghost.className = 'touch-drag-ghost';
        const img = state.originEl ? state.originEl.querySelector('img.item-icon') : null;
        const name = state.originEl ? (state.originEl.querySelector('.item-name')?.textContent || '') : '';
        if (img && img.getAttribute) {
            const src = img.getAttribute('src') || '';
            ghost.innerHTML = `${src ? `<img class="item-icon" src="${escapeHtml(src)}" alt="" />` : ''}<span class="ghost-label">${escapeHtml(String(name || ''))}</span>`;
        } else {
            ghost.innerHTML = `<span class="ghost-label">${escapeHtml(String(name || ''))}</span>`;
        }
        document.body.appendChild(ghost);
        state.ghostEl = ghost;
        updateGhostPosition(clientX, clientY);
    };

    sectionRoot.addEventListener('pointerdown', (e) => {
        try {
            if (!isTouchLike(e)) return;
            if (discardMode) return;
            if (!e.isPrimary) return;

            const panelEl = sectionRoot.querySelector('.character-panel');
            if (!panelEl) return;

            const slotEl = e.target && e.target.closest ? e.target.closest('.bag-slot, .equipment-slot') : null;
            if (!slotEl || !panelEl.contains(slotEl)) return;

            const src = sourceFromSlotEl(slotEl);
            if (!src) return;

            const itemId = getDragItemIdFromSource(src);

            state.activePointerId = e.pointerId;
            state.startX = Number(e.clientX) || 0;
            state.startY = Number(e.clientY) || 0;
            state.panelEl = panelEl;
            state.source = src;
            state.itemId = itemId;
            state.originKey = keyForSource(src);
            state.originEl = slotEl;
            state.dragging = false;
            state.payload = null;
            clearHover();

            // Don't prevent default here: allow scrolling unless a drag actually starts.
        } catch { /* ignore */ }
    }, { passive: true });

    document.addEventListener('pointermove', (e) => {
        try {
            if (!isTouchLike(e)) return;
            if (state.activePointerId == null || e.pointerId !== state.activePointerId) return;

            const x = Number(e.clientX) || 0;
            const y = Number(e.clientY) || 0;

            if (!state.dragging) {
                if (!state.itemId) return;
                const dx = x - state.startX;
                const dy = y - state.startY;
                const dist = Math.hypot(dx, dy);
                if (dist < 10) return;
                startTouchDrag(x, y);
            }

            if (!state.dragging) return;

            // Once dragging, suppress scrolling.
            e.preventDefault();
            updateGhostPosition(x, y);

            const elAtPoint = document.elementFromPoint(x, y);
            const slotEl = elAtPoint && elAtPoint.closest ? elAtPoint.closest('.bag-slot, .equipment-slot') : null;
            if (slotEl && state.panelEl && !state.panelEl.contains(slotEl)) {
                clearHover();
                return;
            }
            const target = slotEl ? targetFromSlotEl(slotEl) : null;
            const ok = target ? isDropAllowed(state.payload, target) : false;

            clearHover();
            if (slotEl && ok && slotEl.classList) {
                slotEl.classList.add('drop-hover');
                state.hoverEl = slotEl;
            }
        } catch { /* ignore */ }
    }, { passive: false });

    document.addEventListener('pointerup', (e) => {
        try {
            if (!isTouchLike(e)) return;
            if (state.activePointerId == null || e.pointerId !== state.activePointerId) return;

            const now = Date.now();

            if (state.dragging && state.payload) {
                e.preventDefault();
                const dropEl = state.hoverEl;
                const target = dropEl ? targetFromSlotEl(dropEl) : null;
                const ok = target ? isDropAllowed(state.payload, target) : false;
                const changed = ok ? performDrop(state.payload, target) : false;
                cleanupDrag();
                if (changed) commitCharacterChange(sectionRoot);
                return;
            }

            // Not a drag: interpret as a potential double-tap.
            const src = state.source;
            const key = state.originKey;
            const itemId = state.itemId;
            state.activePointerId = null;
            state.source = null;
            state.itemId = null;
            state.originKey = '';
            state.originEl = null;

            if (!src || !key || !itemId) return;

            const isDouble = (state.lastTapKey === key) && (now - state.lastTapTime <= 380);
            if (isDouble) {
                // Prevent double-tap-to-zoom on mobile.
                e.preventDefault();
                state.lastTapKey = '';
                state.lastTapTime = 0;

                let changed = false;
                if (src.type === 'bag') changed = autoEquipFromBag(Number(src.index));
                if (src.type === 'equip') changed = autoUnequipToFirstEmptyBag(String(src.slot || ''));
                if (changed) commitCharacterChange(sectionRoot);
                return;
            }

            state.lastTapKey = key;
            state.lastTapTime = now;
        } catch {
            cleanupDrag();
        }
    }, { passive: false });

    document.addEventListener('pointercancel', (e) => {
        try {
            if (!isTouchLike(e)) return;
            if (state.activePointerId == null || e.pointerId !== state.activePointerId) return;
            cleanupDrag();
        } catch { /* ignore */ }
    }, { passive: true });
}

function onDragStart(event, source) {
    // Prevent accidental dragging while in discard mode.
    if (discardMode) {
        event.preventDefault();
        return;
    }

    // Only allow dragging when the source has an item.
    const itemId = getDragItemIdFromSource(source);
    if (!itemId) {
        event.preventDefault();
        return;
    }

    currentDragPayload = {
        source,
        itemId,
    };

    try {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify(currentDragPayload));
    } catch {
        // non-fatal
    }

    highlightValidDropTargets(currentDragPayload);
}

function onDragEnd() {
    currentDragPayload = null;
    clearAllDropVisuals();
}

function onDragOver(event, target) {
    const payload = getCurrentPayload(event);
    if (!payload) return;

    const ok = isDropAllowed(payload, target);
    if (ok) event.preventDefault();

    // Only highlight valid targets (no red/invalid feedback).
    const el = event.currentTarget;
    if (el && el.classList) {
        if (ok) el.classList.add('drop-ok');
    }
}

function onDrop(event, target, sectionRoot) {
    const payload = getCurrentPayload(event);
    if (!payload) return;
    event.preventDefault();

    const ok = isDropAllowed(payload, target);
    clearDropVisual(event.currentTarget);
    if (!ok) return;

    const changed = performDrop(payload, target);
    currentDragPayload = null;

    if (changed) {
        commitCharacterChange(sectionRoot);
    } else {
        // Even if nothing changed, end the drag UI state.
        clearAllDropVisuals();
    }
}

function commitCharacterChange(sectionRoot) {
    // Persist promptly (avoid static import cycles)
    import('../core/saveload.js').then(mod => {
        try { mod?.saveGameState?.(); } catch { /* non-fatal */ }
    }).catch(() => {});

    // Re-render to reflect new state + stats
    setupCharacterSection(sectionRoot);
}

function autoEquipFromBag(bagIndex) {
    if (!Array.isArray(characterState?.bag)) return false;
    if (!Number.isInteger(bagIndex) || bagIndex < 0 || bagIndex >= characterState.bag.length) return false;

    const itemId = characterState.bag[bagIndex];
    if (!itemId) return false;

    const def = getItemDefinition(itemId);
    if (!def) return false;

    let targetSlot = null;

    if (def.slot === 'accessory') {
        const a1 = characterState?.equipment?.accessory_1 ?? null;
        const a2 = characterState?.equipment?.accessory_2 ?? null;
        targetSlot = !a1 ? 'accessory_1' : (!a2 ? 'accessory_2' : 'accessory_1');
    } else {
        targetSlot = def.slot;
    }

    if (!canEquipItemToSlot(itemId, targetSlot)) return false;
    return moveBagItemToEquip(bagIndex, targetSlot);
}

function autoUnequipToFirstEmptyBag(equipSlot) {
    const slot = String(equipSlot || '');
    const equipped = characterState?.equipment ? characterState.equipment[slot] : null;
    if (!equipped) return false;

    const bag = Array.isArray(characterState?.bag) ? characterState.bag : null;
    if (!bag) return false;
    const emptyIndex = bag.findIndex(x => !x);
    if (emptyIndex < 0) return false;
    return moveEquipItemToBag(slot, emptyIndex);
}

function clearDropVisual(el) {
    if (!el || !el.classList) return;
    el.classList.remove('drop-ok', 'drop-bad');
}

function clearAllDropVisuals() {
    // Clear any visuals that might have stuck
    document.querySelectorAll('.bag-slot.drop-ok, .bag-slot.drop-bad, .equipment-slot.drop-ok, .equipment-slot.drop-bad')
        .forEach(el => el.classList.remove('drop-ok', 'drop-bad'));
}

function highlightValidDropTargets(payload) {
    clearAllDropVisuals();
    if (!payload) return;

    document.querySelectorAll('.bag-slot, .equipment-slot').forEach(el => {
        if (!el || !el.dataset) return;

        let target = null;
        if (el.classList.contains('bag-slot')) {
            target = { type: 'bag', index: Number(el.dataset.slot) };
        } else if (el.classList.contains('equipment-slot')) {
            target = { type: 'equip', slot: String(el.dataset.slot || '') };
        }

        if (!target) return;
        if (isDropAllowed(payload, target)) {
            el.classList.add('drop-ok');
        }
    });
}

function getCurrentPayload(event) {
    if (currentDragPayload) return currentDragPayload;
    try {
        const txt = event?.dataTransfer?.getData('text/plain');
        if (!txt) return null;
        const parsed = JSON.parse(txt);
        if (parsed && parsed.source && parsed.itemId) return parsed;
    } catch {
        // ignore
    }
    return null;
}

function getDragItemIdFromSource(source) {
    if (!source) return null;
    if (source.type === 'bag') {
        const idx = Number(source.index);
        return (Array.isArray(characterState?.bag) ? characterState.bag[idx] : null) || null;
    }
    if (source.type === 'equip') {
        const slot = String(source.slot || '');
        return (characterState?.equipment ? characterState.equipment[slot] : null) || null;
    }
    return null;
}

function isDropAllowed(payload, target) {
    if (!payload || !payload.source || !payload.itemId) return false;
    if (!target) return false;

    // Drop onto bag: always allowed (swap/move)
    if (target.type === 'bag') {
        return Number.isInteger(target.index) && target.index >= 0;
    }

    // Drop onto equipment: must validate slot compatibility
    if (target.type === 'equip') {
        return canEquipItemToSlot(payload.itemId, target.slot);
    }

    return false;
}

function performDrop(payload, target) {
    const src = payload.source;
    if (!src) return false;

    // Bag -> Bag
    if (src.type === 'bag' && target.type === 'bag') {
        return swapBagSlots(Number(src.index), Number(target.index));
    }

    // Bag -> Equip
    if (src.type === 'bag' && target.type === 'equip') {
        return moveBagItemToEquip(Number(src.index), target.slot);
    }

    // Equip -> Bag
    if (src.type === 'equip' && target.type === 'bag') {
        return moveEquipItemToBag(src.slot, Number(target.index));
    }

    // Equip -> Equip
    if (src.type === 'equip' && target.type === 'equip') {
        return moveEquipItemToEquip(src.slot, target.slot);
    }

    return false;
}

function escapeHtml(text) {
    return String(text)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
