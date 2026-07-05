// Character / Inventory section (v2 — tabbed layout)
// Tab "Inventory": Equipment + Inventory (1fr 1fr)
// Tab "Stats & Skills": Stats + Skills (1fr 1fr)

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
    getConsumablesFromBag,
    getConsumableTotalValue,
    getAutoConsumeSettings,
    toggleAutoConsume,
    SKILLS,
    getSkillTier,
    getSkillDefinition,
} from './character.js';
import { getItemDefinition } from './items.js';
import { resources } from '../../engine/resources.js';
import { getTotalIngameMinutes } from '../../engine/time.js';
import { setupTooltip } from '../../ui/panels/tooltip.js';
import { showConfirmPopup } from '../../ui/panels/confirmPopup.js';
import { newBadgeHtml } from '../../ui/components/contentNewBadges.js';
import { useConsumableFromBag } from './consumables.js';
import { t } from '../../locales/locales.js';

let listenersInstalled = false;
let currentDragPayload = null;
let discardMode = false;
let selectedBagIndex = null;

function renderConsumablesPanel(consumables, state) {
    if (!consumables || consumables.length === 0) {
        return `<div class="character-card consumables-card">
            <div class="character-card-header"><h3>Supplies</h3></div>
            <p class="character-card-hint" style="text-align:center;padding:12px 0;">No consumable supplies found.</p>
        </div>`;
    }
    const autoSettings = getAutoConsumeSettings(state);
    let waterDrainPerMin = 0;
    let foodDrainPerMin = 0;
    try {
        const waterRes = resources.find(r => r && r.name === 'Drinking Water');
        const foodRes = resources.find(r => r && r.name === 'Food Rations');
        waterDrainPerMin = waterRes?._drainRate != null ? -Number(waterRes._drainRate) : 0.12;
        foodDrainPerMin = foodRes?._drainRate != null ? -Number(foodRes._drainRate) : 0.08;
    } catch { /* ignore */ }

    const rows = consumables.map(c => {
        const totalValue = getConsumableTotalValue(c.itemId, c.count);
        const isWater = c.consumable.resource === 'Drinking Water';
        const isFood = c.consumable.resource === 'Food Rations';
        const drainRate = isWater ? waterDrainPerMin : (isFood ? foodDrainPerMin : 0);
        const minutesEstimate = drainRate > 0 ? Math.round(totalValue / drainRate) : 0;
        
        let estimateHtml = '';
        if (drainRate > 0 && minutesEstimate > 0) {
            const h = Math.floor(minutesEstimate / 60);
            const m = minutesEstimate % 60;
            const timeStr = h > 0 ? `~${h}h ${m}m` : `~${m}m`;
            estimateHtml = `<span class="consumables-estimate">Lasts ${timeStr}</span>`;
        }
        
        const autoEnabled = !!autoSettings[c.itemId];
        const isAutoable = isWater || isFood;
        
        return `<div class="consumable-row">
            <div class="consumable-row-info">
                <span class="consumable-name">${escapeHtml(c.name)} ×${c.count}</span>
                ${totalValue > 0 ? `<span class="consumable-total">Restores ${totalValue} ${escapeHtml(c.consumable.resource)} total</span>` : ''}
                ${estimateHtml}
            </div>
            <div class="consumable-row-actions">
                ${isAutoable ? `<button type="button" class="consumable-auto-btn ${autoEnabled ? 'active' : ''}" data-auto-consumable="${escapeHtml(c.itemId)}" title="${autoEnabled ? 'Auto-use enabled' : 'Auto-use disabled'}">${autoEnabled ? '✓ Auto' : 'Auto'}</button>` : `<button type="button" class="consumable-use-btn" data-consumable-use="${escapeHtml(c.itemId)}" title="Use ${escapeHtml(c.name)}">Use</button>`}
            </div>
        </div>`;
    }).join('');

    return `<div class="character-card consumables-card">
        <div class="character-card-header"><h3>Supplies</h3></div>
        <div class="consumables-list">${rows}</div>
    </div>`;
}

const EQUIP_SLOT_LABELS = { head: 'Head', chest: 'Chest', legs: 'Legs', boots: 'Boots', weapon: 'Weapon', offhand: 'Offhand', accessory_1: 'Accessory 1', accessory_2: 'Accessory 2' };
const ITEM_STAT_LABELS = { health: 'Health', stamina: 'Stamina', foodCapacity: 'Food Capacity', waterCapacity: 'Water Capacity' };

function refreshCharacterSectionIfVisible() {
    try {
        const sectionEl = document.getElementById('characterSection');
        if (!sectionEl || sectionEl.classList.contains('hidden')) return;
        setupCharacterSection(sectionEl);
    } catch { /* non-fatal */ }
}

export function setupCharacterSection(section) {
    if (!section) section = document.getElementById('characterSection');
    if (!section) return;
    installGlobalCharacterListeners();

    const initialTab = (section.dataset && section.dataset.characterActiveTab === 'statsSkills') ? 'statsSkills' : 'inventory';
    section.innerHTML = '';

    const { cols: bagCols } = getBagSize();
    const itemImpact = computeEquippedItemImpact(characterState);
    const bagRows = characterState?.bagRows ?? 2;

    try {
        const bagLen = Array.isArray(characterState?.bag) ? characterState.bag.length : 0;
        if (!Number.isInteger(selectedBagIndex) || selectedBagIndex < 0 || selectedBagIndex >= bagLen) selectedBagIndex = null;
        if (!characterState?.bag?.[selectedBagIndex]) selectedBagIndex = null;
    } catch { /* ignore */ }

    const selectedEntry = selectedBagIndex !== null ? characterState.bag[selectedBagIndex] : null;
    const selectedItemId = typeof selectedEntry === 'string' ? selectedEntry : (selectedEntry?.id || null);
    const selectedDef = selectedItemId ? getItemDefinition(selectedItemId) : null;
    const canUseSelected = !!(selectedDef && selectedDef.consumable);
    const xp = getXPResourceSnapshot();
    const canSpendPoint = (xp?.statPoints?.unspent ?? 0) > 0;
    const hasNewInventoryItems = hasAnyNewInventoryItems();
    const consumables = getConsumablesFromBag(characterState);

    const equipmentCardHtml = `<div class="character-card equipment-card">
        <div class="character-card-header"><h3>${t('character_equipment')}</h3></div>
        <div class="paperdoll" aria-label="Character silhouette and equipment">
            <img class="paperdoll-silhouette" src="assets/images/inventorycharacter.png" alt="" />
            ${renderEquipmentSlot('head', t('equip_slot_head'), characterState?.equipment?.head)}
            ${renderEquipmentSlot('chest', t('equip_slot_chest'), characterState?.equipment?.chest)}
            ${renderEquipmentSlot('legs', t('equip_slot_legs'), characterState?.equipment?.legs)}
            ${renderEquipmentSlot('boots', t('equip_slot_boots'), characterState?.equipment?.boots)}
            ${renderEquipmentSlot('weapon', t('equip_slot_weapon'), characterState?.equipment?.weapon)}
            ${renderEquipmentSlot('offhand', t('equip_slot_offhand'), characterState?.equipment?.offhand)}
            ${renderEquipmentSlot('accessory_1', t('equip_slot_accessory_1'), characterState?.equipment?.accessory_1)}
            ${renderEquipmentSlot('accessory_2', t('equip_slot_accessory_2'), characterState?.equipment?.accessory_2)}
        </div></div>`;

    const inventoryCardHtml = `<div class="character-card inventory-card">
        <div class="character-card-header">
            <h3>Inventory</h3>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="character-card-hint">Bag ${bagRows}×${bagCols}</span>
                <button type="button" class="inventory-use-btn" data-inventory-use ${(!discardMode && canUseSelected) ? '' : 'disabled'} title="${(!discardMode && canUseSelected) ? 'Use selected consumable' : 'Select a consumable to use'}" aria-label="Use selected consumable">Use</button>
                <button type="button" class="inventory-trash-btn ${discardMode ? 'active' : ''}" data-inventory-trash title="Discard items" aria-label="Discard items">${renderTrashIcon()}</button>
            </div></div>
        <div class="bag-grid" style="--bag-cols:${bagCols}; --bag-rows:${bagRows};" aria-label="Inventory bag">${renderBagSlots()}</div></div>`;

    const consumablesCardHtml = renderConsumablesPanel(consumables, characterState);

    const statsCardHtml = `<div class="character-card stats-card">
        <div class="character-card-header">
            <h3>Stats</h3>
            <span class="stat-points-chip" data-stat-points-chip role="button" tabindex="0" aria-label="Stat points">Stat Points: <strong>${escapeHtml(String(xp?.statPoints?.unspent ?? 0))}</strong></span>
        </div>
        <div class="stats-list" aria-label="Character stats">
            ${renderXPRow()}${renderHealthRow()}${renderStaminaRow()}
        </div></div>`;

    const skillsCardHtml = renderSkillsCard();

    section.innerHTML = `<div class="character-tabs" role="tablist" aria-label="Character tabs">
        <button class="character-tab ${initialTab === 'inventory' ? 'active' : ''}" data-tab="inventory" role="tab" aria-selected="${initialTab === 'inventory'}">${t('character_inventory_tab')}${newBadgeHtml(!!hasNewInventoryItems)}</button>
        <button class="character-tab ${initialTab === 'statsSkills' ? 'active' : ''}" data-tab="statsSkills" role="tab" aria-selected="${initialTab === 'statsSkills'}">${t('character_stats_skills_tab')}${newBadgeHtml(!!canSpendPoint)}</button>
    </div>
    <div class="content-panel character-panel">
        <div class="character-tabpanes">
            <div class="character-pane ${initialTab === 'inventory' ? 'active' : ''}" data-pane="inventory" role="tabpanel">
                <div class="character-layout character-layout-inventory">
                    <div class="character-left-col">${equipmentCardHtml}</div>
                    <div class="character-right-col">
                        ${inventoryCardHtml}
                        ${consumablesCardHtml}
                    </div>
                </div></div>
            <div class="character-pane ${initialTab === 'statsSkills' ? 'active' : ''}" data-pane="statsSkills" role="tabpanel">
                <div class="character-layout character-layout-stacked">
                    ${statsCardHtml}${skillsCardHtml}
                </div></div></div></div>`;

    const panel = section.querySelector('.character-panel');
    panel.classList.toggle('discard-mode', !!discardMode);

    const tabs = Array.from(section.querySelectorAll('.character-tab'));
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            try { section.dataset.characterActiveTab = target; } catch { /* ignore */ }
            tabs.forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab ? 'true' : 'false'); });
            const panes = Array.from(section.querySelectorAll('.character-pane'));
            panes.forEach(p => p.classList.toggle('active', String(p.dataset.pane || '') === target));
        });
    });

    attachDnDHandlers(section);
    attachDiscardHandlers(section);
    attachInventoryUseHandlers(section);
    attachItemTooltips(section);
    attachInventoryNewBadges(section);
    attachStatTooltips(section);
    attachStatAllocationHandlers(section);
    setTimeout(() => {
        const panel = section.querySelector('.character-panel');
        if (panel) attachConsumableHandlers(panel, section);
    }, 0);
}

function renderTrashIcon() {
    return `<svg class="inventory-trash-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 3h6l1 2h4v2H4V5h4l1-2z" fill="currentColor" opacity="0.9" />
        <path d="M6 9h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path d="M10 11v8M14 11v8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>`;
}

function attachDiscardHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;
    const trashBtn = panel.querySelector('button[data-inventory-trash]');
    if (trashBtn) trashBtn.addEventListener('click', e => { e.preventDefault(); discardMode = !discardMode; setupCharacterSection(sectionRoot); });
    if (!discardMode) return;
    panel.querySelectorAll('.bag-slot.has-item').forEach(slotEl => {
        slotEl.addEventListener('click', async e => {
            e.preventDefault();
            const idx = Number(slotEl.dataset.slot);
            if (!Number.isInteger(idx)) return;
            const entry = characterState?.bag?.[idx];
            const itemId = typeof entry === 'string' ? entry : entry?.id;
            if (!itemId) return;
            const def = getItemDefinition(itemId);
            const name = def?.name || itemId;
            try {
                const tags = Array.isArray(def?.tags) ? def.tags : [];
                if (def?.quest || tags.some(t => String(t).toLowerCase() === 'quest')) { await showConfirmPopup({ title: t('confirm_quest_title'), message: t('confirm_quest_msg'), confirmText: t('confirm_quest_ok'), cancelText: t('confirm_quest_ok') }); return; }
            } catch { /* ignore */ }
            const ok = await showConfirmPopup({ title: t('confirm_discard_title'), message: t('confirm_discard_msg', { item: name }), confirmText: t('confirm_discard_confirm'), cancelText: t('confirm_discard_cancel') });
            if (!ok) return;
            if (discardBagItem(idx)) commitCharacterChange(sectionRoot);
            setupCharacterSection(sectionRoot);
        });
    });
}

function attachInventoryUseHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel');
    if (!panel) return;
    const useBtn = panel.querySelector('button[data-inventory-use]');
    if (useBtn) useBtn.addEventListener('click', e => {
        e.preventDefault();
        if (discardMode || !Number.isInteger(selectedBagIndex)) return;
        const entry = characterState?.bag?.[selectedBagIndex];
        const itemId = typeof entry === 'string' ? entry : entry?.id;
        if (!itemId) return;
        const def = getItemDefinition(itemId);
        if (!def?.consumable) return;
        useConsumableFromBag(itemId, characterState);
        commitCharacterChange(sectionRoot);
    });
    if (discardMode) return;
    panel.querySelectorAll('.bag-slot').forEach(slotEl => {
        slotEl.addEventListener('click', e => {
            if (currentDragPayload) return;
            const idx = Number(slotEl.dataset.slot);
            if (!Number.isInteger(idx)) return;
            const entry = characterState?.bag?.[idx];
            if (!entry) { selectedBagIndex = null; setupCharacterSection(sectionRoot); return; }
            selectedBagIndex = idx;
            try { if (characterState.bagUiNew?.[idx]) characterState.bagUiNew[idx] = false; } catch { /* ignore */ }
            setupCharacterSection(sectionRoot);
        });
    });
}

function renderEquipmentSlot(key, label, itemId) {
    const safeKey = String(key).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const item = itemId ? getItemDefinition(itemId) : null;
    const hasItem = !!item;
    const icon = item?.icon ? String(item.icon) : '';
    return `<div class="equipment-slot ${hasItem ? 'has-item' : ''}" data-slot="${safeKey}" data-item-id="${hasItem ? escapeHtml(item.id) : ''}" ${hasItem ? 'draggable="true"' : ''} role="button" tabindex="0" aria-label="${label} slot">
        <div class="slot-frame"></div>${hasItem ? `<div class="slot-item">${icon ? `<img class="item-icon" src="${escapeHtml(icon)}" alt="" />` : ''}<span class="item-name">${escapeHtml(item.name)}</span></div>` : ''}
        <div class="slot-label">${label}</div></div>`;
}

function renderStatRow(label, value, opts = {}) {
    const safeKey = String(label).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const iconHtml = renderStatLabelIconHtml(safeKey);
    const impactClass = getItemImpactClassForUiStatKey(safeKey, opts.itemImpact);
    const debuffClass = opts.debuffClass ? String(opts.debuffClass) : '';
    return `<div class="stat-line" data-stat-line="${safeKey}"><div class="stat-row ${[impactClass, debuffClass].filter(Boolean).join(' ')}" data-stat="${safeKey}">
        <span class="stat-label">${iconHtml}<span class="stat-label-text">${escapeHtml(String(label))}</span></span><span class="stat-value">${value}</span></div>${renderAllocateSpacerHtml()}</div>`;
}

function renderStatLabelIconHtml(statKey) {
    const key = String(statKey || '').toLowerCase();
    const kindByKey = { hit_chance: 'target', crit_chance: 'burst', evasion: 'swirl', armor: 'shield', damage: 'sword', attack_speed: 'clock' };
    const kind = kindByKey[key];
    return kind ? `<span class="stat-label-icon" aria-hidden="true">${svgIcon(kind)}</span>` : '';
}

function svgIcon(kind) {
    switch (kind) {
        case 'target': return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3"/></svg>`;
        case 'burst': return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 5.2L19 5l-2.2 5.2L22 12l-5.2 1.8L19 19l-5.2-2.2L12 22l-1.8-5.2L5 19l2.2-5.2L2 12l5.2-1.8L5 5l5.2 2.2L12 2z"/></svg>`;
        case 'swirl': return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/><path d="M12 7a5 5 0 1 0 5 5"/></svg>`;
        case 'shield': return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 4v6c0 5-3.4 9.4-8 10-4.6-.6-8-5-8-10V6l8-4z"/></svg>`;
        case 'sword': return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3l7 7-9 9H5v-7l9-9z"/><path d="M16 5l3 3"/><path d="M6 18l3 3"/></svg>`;
        case 'clock':
        default: return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>`;
    }
}

function renderAllocateButtonHtml(allocateKey, opts = {}) {
    const key = String(allocateKey || '');
    if (!key) return '';
    return `<button type="button" class="stat-allocate-btn" data-allocate-stat="${escapeHtml(key)}" ${opts.disabled ? 'disabled' : ''} aria-label="${escapeHtml(opts.label || 'Increase stat')}">+</button>`;
}

function renderAllocateSpacerHtml() { return '<span class="stat-allocate-spacer" aria-hidden="true"></span>'; }

function computeEquippedItemImpact(state = characterState) {
    return {};
}

function getItemImpactClassForUiStatKey(uiStatKey, itemImpact) {
    const key = String(uiStatKey || '').toLowerCase(); const impact = itemImpact?.[key];
    if (!impact || !Number.isFinite(Number(impact.total)) || Number(impact.total) === 0) return '';
    const higherIsBetter = key !== 'attack_speed'; const score = Number(impact.total) * (higherIsBetter ? 1 : -1);
    return score > 0 ? 'is-item-positive' : (score < 0 ? 'is-item-negative' : '');
}

function getXPResourceSnapshot() {
    const res = resources.find(r => r?.name === 'XP'); const total = res ? Math.max(0, Math.floor(Number(res.amount ?? 0))) : 0;
    const lvl = computeLevelFromXp(total); const alloc = getAllocatedStatPoints(characterState);
    const totalPoints = getTotalStatPointsForLevel(lvl.level); const spent = Math.max(0, Math.floor(Number(alloc?.spent ?? 0)));
    return { total: lvl.total, level: lvl.level, progress: lvl.progress, max: lvl.toNext, percent: Math.max(0, Math.min(1, lvl.percent)), statPoints: { total: totalPoints, spent, unspent: Math.max(0, totalPoints - spent) }, allocated: alloc?.allocated || {} };
}

function renderXPRow() {
    const xp = getXPResourceSnapshot(); const percent = Math.round(xp.percent * 100);
    return `<div class="stat-line" data-stat-line="xp"><div class="stat-row stat-row-bar" data-stat="xp">
        <span class="stat-label">Level</span><div class="stat-bar" role="img" aria-label="Level ${xp.level}. XP ${xp.progress} / ${xp.max}."><div class="stat-bar-fill" style="width:${percent}%"></div></div><span class="stat-value">Lv ${xp.level}</span></div>${renderAllocateSpacerHtml()}</div>`;
}

function getStaminaResourceSnapshot() {
    const res = resources.find(r => r?.name === 'Stamina'); if (!res) return { current: 0, max: 0, percent: 0 };
    const max = Math.max(0, Number(res.capacity ?? 0)); const current = Math.max(0, Math.min(max, Number(res.amount ?? 0)));
    return { current: Math.round(current), max: Math.round(max), percent: max > 0 ? current / max : 0 };
}

function getHealthResourceSnapshot() {
    const res = resources.find(r => r?.name === 'Health'); if (!res) return { current: 0, max: 0, percent: 0 };
    const max = Math.max(0, Number(res.capacity ?? 0)); const current = Math.max(0, Math.min(max, Number(res.amount ?? 0)));
    return { current: Math.round(current), max: Math.round(max), percent: max > 0 ? current / max : 0 };
}

function renderHealthRow() {
    const h = getHealthResourceSnapshot(); const percent = Math.round(h.percent * 100);
    const xp = getXPResourceSnapshot();
    return `<div class="stat-line" data-stat-line="health"><div class="stat-row stat-row-bar" data-stat="health">
        <span class="stat-label">Health</span><div class="stat-bar" role="img" aria-label="Health ${h.current} / ${h.max}"><div class="stat-bar-fill" style="width:${percent}%"></div></div><span class="stat-value">${h.max > 0 ? `${h.current} / ${h.max}` : String(h.current)}</span></div>
        ${renderAllocateButtonHtml('health', { disabled: (xp?.statPoints?.unspent ?? 0) <= 0, label: 'Increase max Health' })}</div>`;
}

function renderStaminaRow() {
    const s = getStaminaResourceSnapshot(); const percent = Math.round(s.percent * 100);
    const xp = getXPResourceSnapshot();
    return `<div class="stat-line" data-stat-line="stamina"><div class="stat-row stat-row-bar" data-stat="stamina">
        <span class="stat-label">Stamina</span><div class="stat-bar" role="img" aria-label="Stamina ${s.current} / ${s.max}"><div class="stat-bar-fill" style="width:${percent}%"></div></div><span class="stat-value">${s.max > 0 ? `${s.current} / ${s.max}` : String(s.current)}</span></div>
        ${renderAllocateButtonHtml('stamina', { disabled: (xp?.statPoints?.unspent ?? 0) <= 0, label: 'Increase max Stamina' })}</div>`;
}

function attachStatAllocationHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    panel.querySelectorAll('button[data-allocate-stat]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault(); e.stopPropagation();
            const key = String(btn.dataset.allocateStat || ''); if (!key) return;
            if (allocateStatPoint(key, getXPResourceSnapshot().total, characterState)) commitCharacterChange(sectionRoot);
        });
    });
}

function renderBagSlots() {
    const bag = Array.isArray(characterState?.bag) ? characterState.bag : [];
    const getEntryId = e => !e ? null : (typeof e === 'string' ? e : e?.id || null);
    const getEntryQty = e => { if (!e) return 0; if (typeof e === 'string') return 1; if (e?.id) { const q = Math.floor(Number(e.qty ?? 1)); return Number.isFinite(q) ? Math.max(1, q) : 1; } return 0; };
    return bag.map((entry, i) => {
        const itemId = getEntryId(entry); const qty = getEntryQty(entry);
        const item = itemId ? getItemDefinition(itemId) : null; const hasItem = !!item;
        const showNew = hasItem && !!(characterState?.bagUiNew?.[i]);
        const isSelected = Number.isInteger(selectedBagIndex) && selectedBagIndex === i && hasItem && !discardMode;
        return `<div class="bag-slot ${hasItem ? 'has-item' : ''} ${showNew ? 'has-new-badge' : ''} ${isSelected ? 'selected' : ''}" data-slot="${i}" data-item-id="${hasItem ? escapeHtml(item.id) : ''}" ${hasItem ? 'draggable="true"' : ''} role="button" tabindex="0" aria-label="Bag slot ${i + 1}">
            ${newBadgeHtml(showNew)}${hasItem ? `<div class="bag-item">${item.icon ? `<img class="item-icon" src="${escapeHtml(item.icon)}" alt="" />` : ''}<span class="item-name">${escapeHtml(item.name)}</span>${qty > 1 ? `<span class="item-qty">×${String(qty)}</span>` : ''}</div>` : ''}</div>`;
    }).join('');
}

function hasAnyNewInventoryItems() { try { return (characterState?.bagUiNew || []).some(v => !!v); } catch { return false; } }

function attachInventoryNewBadges(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    panel.querySelectorAll('.bag-slot.has-item').forEach(slotEl => {
        const idx = Number(slotEl?.dataset?.slot); if (!Number.isInteger(idx)) return;
        if (!characterState?.bagUiNew?.[idx]) return;
        if (slotEl.dataset?.invUiNewWired === 'true') return;
        try { slotEl.dataset.invUiNewWired = 'true'; } catch { /* ignore */ }
        const clear = () => { try { if (characterState.bagUiNew?.[idx]) { characterState.bagUiNew[idx] = false; slotEl.querySelector('.action-new-badge')?.remove(); if (!hasAnyNewInventoryItems()) sectionRoot.querySelector('.character-tab[data-tab="inventory"]')?.querySelector('.action-new-badge')?.remove(); import('../engine/saveload.js').then(m => m?.saveGameStateQuiet?.()); } } catch { /* ignore */ } };
        slotEl.addEventListener('mouseenter', clear); slotEl.addEventListener('focus', clear);
        slotEl.addEventListener('pointerdown', clear, { passive: true }); slotEl.addEventListener('touchstart', clear, { passive: true });
    });
}

function attachItemTooltips(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    [...panel.querySelectorAll('.equipment-slot.has-item'), ...panel.querySelectorAll('.bag-slot.has-item')].forEach(el => {
        if (!el?.dataset) return; if (!el.dataset.itemId) return;
        setupTooltip(el, () => buildItemTooltipHTML(el));
    });
}

function attachStatTooltips(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    panel.querySelectorAll('.stats-card .stat-row').forEach(row => { const key = String(row?.dataset?.stat || ''); if (key) setupTooltip(row, () => buildStatTooltipHTML(key)); });
    const chip = panel.querySelector('[data-stat-points-chip]'); if (chip) setupTooltip(chip, () => buildStatTooltipHTML('stat_points'));
}

function buildStatTooltipHTML(statKey) {
    const key = String(statKey || '').toLowerCase(); const stats = computeCharacterStats(characterState);
    const itemImpact = computeEquippedItemImpact(characterState); const xp = getXPResourceSnapshot(); const alloc = xp?.allocated || {};
    const bullets = items => { const clean = (Array.isArray(items) ? items : []).filter(Boolean).map(String); if (!clean.length) return ''; return `<ul class="tooltip-bullets">${clean.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`; };
    switch (key) {
        case 'xp': return `<h4>Level</h4><p>Current Level: <strong>${xp.level}</strong></p><p class="tooltip-detail">XP to next level: ${xp.progress} / ${xp.max}</p><div class="tooltip-section"><h4>How It Works</h4><p>Level is derived from total XP. Each level gained grants <strong>3 stat points</strong>.</p><p class="tooltip-detail">Formula: XP to next level = 100 × current level.</p><p class="tooltip-detail">Total XP: ${xp.total.toLocaleString()}</p></div>`;
        case 'stat_points': { const pts = xp?.statPoints || { unspent: 0, total: 0, spent: 0 }; return `<h4>Stat Points</h4><p>Available: <strong>${pts.unspent}</strong></p><p class="tooltip-detail">Spent: ${pts.spent} / ${pts.total}</p><div class="tooltip-section"><h4>How It Works</h4><p>You gain 3 points each Level. Spend them using the + buttons.</p></div>`; }
        case 'health': { const h = getHealthResourceSnapshot(); const pts = Math.max(0, Math.floor(Number(alloc.health) || 0)); return `<h4>Health</h4><p>Current: <strong>${h.current}${h.max > 0 ? ` / ${h.max}` : ''}</strong></p><div class="tooltip-section"><h4>Notes</h4><p>Health is your HP in combat.</p>${bullets([`1 stat point: +5 max Health.`, `Allocated: ${pts} (total: +${pts * 5} max Health).`])}</div>`; }
        case 'stamina': { const s = getStaminaResourceSnapshot(); const pts = Math.max(0, Math.floor(Number(alloc.stamina) || 0)); return `<h4>Stamina</h4><p>Current: <strong>${s.current}${s.max > 0 ? ` / ${s.max}` : ''}</strong></p><div class="tooltip-section"><h4>Notes</h4><p>Stamina is your short-term endurance.</p>${bullets([`1 stat point: +5 max Stamina.`, `Allocated: ${pts} (total: +${pts * 5} max Stamina).`])}</div>`; }
        default: return `<h4>${escapeHtml(statKey)}</h4><p class="tooltip-detail">No tooltip available.</p>`;
    }
}

function renderSkillsCard() {
    const geoIcon = `<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>`;

    const items = SKILLS.map(skill => {
        const tier = getSkillTier(skill.id);
        const def = getSkillDefinition(skill.id);
        const unlocked = tier > 0;
        const currentTier = def.tiers.find(t => t.tier === tier);
        const name = currentTier ? t(currentTier.nameKey) : (def.tiers[0] ? t(def.tiers[0].nameKey) : skill.id);
        const desc = currentTier ? t(currentTier.descKey) : '';
        const tierLabel = unlocked ? t('skill_tier_label', { tier: toRoman(tier) }) : '';

        return `<div class="skill-item ${unlocked ? 'skill-acquired' : 'skill-locked'}">
            <div class="skill-icon">${geoIcon}</div>
            <div class="skill-info">
                <div class="skill-name-row">
                    <span class="skill-name">${escapeHtml(name)}</span>
                    ${unlocked ? `<span class="skill-tier-badge">${escapeHtml(tierLabel)}</span>` : `<span class="skill-tier-badge skill-tier-locked">🔒</span>`}
                </div>
                ${desc ? `<p class="skill-desc">${escapeHtml(desc)}</p>` : ''}
            </div>
        </div>`;
    }).join('');

    return `<div class="character-card skills-card">
        <div class="character-card-header"><h3>${t('character_skills')}</h3></div>
        <div class="skills-list">${items}</div>
    </div>`;
}

function toRoman(num) {
    const map = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
    return map[num] || String(num);
}

function buildItemTooltipHTML(slotEl) {
    if (!slotEl?.dataset) return ''; const itemId = String(slotEl.dataset.itemId || ''); if (!itemId) return '';
    const def = getItemDefinition(itemId); if (!def) return '';
    const lines = []; const statLabels = { health: 'Health', stamina: 'Stamina', foodCapacity: 'Food Capacity', waterCapacity: 'Water Capacity' };
    const equipSlotLabels = { head: 'Head', chest: 'Chest', legs: 'Legs', boots: 'Boots', weapon: 'Weapon', offhand: 'Offhand', accessory_1: 'Accessory 1', accessory_2: 'Accessory 2' };
    if (def.stats) for (const [k, v] of Object.entries(def.stats)) { if (typeof v !== 'number' || !Number.isFinite(v) || v === 0) continue; const l = statLabels[k] || k; const s = v > 0 ? '+' : ''; lines.push(`${escapeHtml(l)}: ${s}${escapeHtml(String(v))}`); }
    const slotName = def.slot === 'accessory' ? 'Accessory' : (equipSlotLabels[String(def.slot || '')] || String(def.slot || ''));
    const tagsHtml = []; try { if (def?.stackable && def?.consumable) { const idx = Math.floor(Number(slotEl.dataset.slot)); const e = Number.isInteger(idx) ? characterState?.bag?.[idx] : null; const q = !e ? 1 : (typeof e === 'string' ? 1 : (e?.id ? Math.max(1, Math.floor(Number(e.qty ?? 1)) || 1) : 1)); tagsHtml.push(`<span class="tooltip-tag">${q}/5</span>`); } } catch { /* ignore */ }
    try { if (def?.quest || (Array.isArray(def?.tags) && def.tags.some(t => String(t).toLowerCase() === 'quest'))) tagsHtml.push('<span class="tooltip-tag">Quest</span>'); } catch { /* ignore */ }
    const tags = tagsHtml.join('');
    let html = tags ? `<div class="tooltip-header-row"><h4>${escapeHtml(def.name || def.id)}</h4><div class="tooltip-tags">${tags}</div></div>` : `<h4>${escapeHtml(def.name || def.id)}</h4>`;
    if (def.description) html += `<p class="tooltip-description">${escapeHtml(String(def.description))}</p>`;
    html += `<div class="tooltip-section"><h4>Slot</h4><p>${escapeHtml(slotName || '—')}</p></div>`;
    try { if (def.consumable) { let t = ''; if (def.consumable.type === 'heal') { const a = Math.floor(Number(def.consumable.amount) || 0); const r = String(def.consumable.resource || '').trim(); if (a > 0 && r) t = `Restores ${a} ${escapeHtml(r)}.`; } else if (def.consumable.type === 'buff' && String(def.consumable.buff) === 'staminaRegen') { const b = Number(def.consumable.bonusPerSec) || 0; const m = Math.floor(Number(def.consumable.durationMinutes) || 0); if (b > 0 && m > 0) t = `Stamina regen +${b}/s for ${m / 60}h.`; } if (t) html += `<div class="tooltip-section"><h4>Use</h4><p>${t}</p></div>`; } } catch { /* ignore */ }
    if (lines.length) html += `<div class="tooltip-section"><h4>Modifiers</h4><ul class="tooltip-bonuses">${lines.map(l => `<li class="bonus-item">${l}</li>`).join('')}</ul></div>`;
    else html += `<div class="tooltip-section"><h4>Modifiers</h4><p>None</p></div>`;
    return html;
}

function installGlobalCharacterListeners() {
    if (listenersInstalled) return; listenersInstalled = true;
    window.addEventListener('character-state-changed', () => refreshCharacterSectionIfVisible());
    window.addEventListener('game-state-applied', () => { const s = document.getElementById('characterSection'); if (s) setupCharacterSection(s); });
    window.addEventListener('gameReset', () => { const s = document.getElementById('characterSection'); if (s) setupCharacterSection(s); });
    // Only update vital rows when characterSection is visible to avoid wasted DOM work.
    window.addEventListener('resources-updated', () => {
        try {
            const s = document.getElementById('characterSection');
            if (!s || s.classList.contains('hidden')) return;
            updateVitalRowsIfPresent(s);
        } catch { /* ignore */ }
    });
}

function updateVitalRowsIfPresent(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    updateXPRowIfPresent(panel); updateStatPointsChipIfPresent(panel); updateAllocateButtonsIfPresent(panel);
    ['stamina', 'health'].forEach(k => updateSingleVitalRow(panel, k, k === 'stamina' ? getStaminaResourceSnapshot : getHealthResourceSnapshot, k === 'stamina' ? 'Stamina' : 'Health'));
}

function updateXPRowIfPresent(panelEl) { const row = panelEl.querySelector('.stat-row[data-stat="xp"]'); if (!row) return; const xp = getXPResourceSnapshot(); const fill = row.querySelector('.stat-bar-fill'); if (fill) fill.style.width = `${Math.round(xp.percent * 100)}%`; const text = row.querySelector('.stat-value'); if (text) text.textContent = `Lv ${xp.level}`; }

function updateStatPointsChipIfPresent(panelEl) { const chip = panelEl.querySelector('[data-stat-points-chip]'); if (!chip) return; const xp = getXPResourceSnapshot(); chip.innerHTML = `Stat Points: <strong>${xp?.statPoints?.unspent ?? 0}</strong>`; }

function updateAllocateButtonsIfPresent(panelEl) { const xp = getXPResourceSnapshot(); const d = (xp?.statPoints?.unspent ?? 0) <= 0; panelEl.querySelectorAll('button[data-allocate-stat]').forEach(b => b.disabled = d); }

function updateSingleVitalRow(panelEl, statKey, getSnapshotFn, label) {
    const row = panelEl.querySelector(`.stat-row[data-stat="${statKey}"]`); if (!row) return;
    const s = getSnapshotFn(); const pct = Math.round(s.percent * 100);
    const fill = row.querySelector('.stat-bar-fill'); if (fill) fill.style.width = `${pct}%`;
    const text = row.querySelector('.stat-value'); if (text) text.textContent = s.max > 0 ? `${s.current} / ${s.max}` : String(s.current);
}

function attachDnDHandlers(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    // Skip re-attachment if we already wired this section (prevents event listener leaks
    // when setupCharacterSection is called repeatedly on tab switches).
    // NOTE: flag is on sectionRoot, NOT panel, because panel is wiped by section.innerHTML = ''.
    if (sectionRoot.dataset.dndWired === 'true') return;
    sectionRoot.dataset.dndWired = 'true';
    panel.querySelectorAll('.bag-slot').forEach(slotEl => {
        slotEl.addEventListener('dragstart', e => onDragStart(e, { type: 'bag', index: Number(slotEl.dataset.slot) }));
        slotEl.addEventListener('dragend', onDragEnd); slotEl.addEventListener('dragover', e => onDragOver(e, { type: 'bag', index: Number(slotEl.dataset.slot) }));
        slotEl.addEventListener('dragleave', () => clearDropVisual(slotEl)); slotEl.addEventListener('drop', e => onDrop(e, { type: 'bag', index: Number(slotEl.dataset.slot) }, sectionRoot));
        slotEl.addEventListener('dblclick', () => { const idx = Number(slotEl.dataset.slot); if (Number.isFinite(idx) && autoEquipFromBag(idx)) commitCharacterChange(sectionRoot); });
    });
    panel.querySelectorAll('.equipment-slot').forEach(slotEl => {
        slotEl.addEventListener('dragstart', e => onDragStart(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }));
        slotEl.addEventListener('dragend', onDragEnd); slotEl.addEventListener('dragover', e => onDragOver(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }));
        slotEl.addEventListener('dragleave', () => clearDropVisual(slotEl)); slotEl.addEventListener('drop', e => onDrop(e, { type: 'equip', slot: String(slotEl.dataset.slot || '') }, sectionRoot));
        slotEl.addEventListener('dblclick', () => { const s = String(slotEl.dataset.slot || ''); if (s && autoUnequipToFirstEmptyBag(s)) commitCharacterChange(sectionRoot); });
    });
    attachTouchInventoryInteractions(sectionRoot);
}

function attachTouchInventoryInteractions(sectionRoot) {
    const panel = sectionRoot.querySelector('.character-panel'); if (!panel) return;
    if (sectionRoot._touchInventoryInteractionsAttached) return; sectionRoot._touchInventoryInteractionsAttached = true;
    const state = { activePointerId: null, startX: 0, startY: 0, panelEl: null, source: null, itemId: null, originKey: '', originEl: null, dragging: false, payload: null, hoverEl: null, ghostEl: null, lastTapTime: 0, lastTapKey: '' };
    sectionRoot._touchInventoryState = state;
    const isTouchLike = e => { const pt = String(e?.pointerType || ''); return pt && pt !== 'mouse'; };
    const keyForSource = src => !src ? '' : (src.type === 'bag' ? `bag:${src.index}` : `equip:${src.slot || ''}`);
    const sourceFromSlotEl = el => { if (!el?.classList) return null; if (el.classList.contains('bag-slot')) { const i = Number(el.dataset.slot); return Number.isFinite(i) ? { type: 'bag', index: i } : null; } if (el.classList.contains('equipment-slot')) { const s = String(el.dataset.slot || ''); return s ? { type: 'equip', slot: s } : null; } return null; };
    const targetFromSlotEl = el => { const src = sourceFromSlotEl(el); if (!src) return null; return src.type === 'bag' ? { type: 'bag', index: Number(src.index) } : { type: 'equip', slot: String(src.slot || '') }; };
    const updateGhost = (x, y) => { const g = state.ghostEl; if (g) { g.style.left = `${Math.round(x)}px`; g.style.top = `${Math.round(y)}px`; } };
    const clearHover = () => { if (state.hoverEl?.classList) state.hoverEl.classList.remove('drop-hover'); state.hoverEl = null; };
    const cleanupDrag = () => { state.dragging = false; state.payload = null; state.source = null; state.itemId = null; state.originEl = null; state.activePointerId = null; clearHover(); currentDragPayload = null; clearAllDropVisuals(); document.body.classList.remove('is-touch-dragging'); if (state.ghostEl?.parentNode) state.ghostEl.parentNode.removeChild(state.ghostEl); state.ghostEl = null; };
    const startDrag = (x, y) => { if (discardMode || !state.source || !state.itemId) return; state.dragging = true; state.payload = { source: state.source, itemId: state.itemId }; currentDragPayload = state.payload; highlightValidDropTargets(state.payload); document.body.classList.add('is-touch-dragging'); const ghost = document.createElement('div'); ghost.className = 'touch-drag-ghost'; const img = state.originEl?.querySelector('img.item-icon'); const n = state.originEl?.querySelector('.item-name')?.textContent || ''; ghost.innerHTML = `${img?.getAttribute('src') ? `<img class="item-icon" src="${escapeHtml(img.getAttribute('src'))}" alt="" />` : ''}<span class="ghost-label">${escapeHtml(String(n))}</span>`; document.body.appendChild(ghost); state.ghostEl = ghost; updateGhost(x, y); };
    sectionRoot.addEventListener('pointerdown', e => { try { if (!isTouchLike(e) || discardMode || !e.isPrimary) return; const el = e.target?.closest?.('.bag-slot, .equipment-slot'); if (!el) return; const src = sourceFromSlotEl(el); if (!src) return; state.activePointerId = e.pointerId; state.startX = e.clientX || 0; state.startY = e.clientY || 0; state.panelEl = panel; state.source = src; state.itemId = getDragItemIdFromSource(src); state.originKey = keyForSource(src); state.originEl = el; state.dragging = false; state.payload = null; clearHover(); } catch { /* ignore */ } }, { passive: true });
    document.addEventListener('pointermove', e => { try { if (!isTouchLike(e) || state.activePointerId == null || e.pointerId !== state.activePointerId) return; const x = e.clientX || 0, y = e.clientY || 0; if (!state.dragging) { if (!state.itemId || Math.hypot(x - state.startX, y - state.startY) < 10) return; startDrag(x, y); } if (!state.dragging) return; e.preventDefault(); updateGhost(x, y); const elAt = document.elementFromPoint(x, y)?.closest?.('.bag-slot, .equipment-slot'); if (!elAt || (state.panelEl && !state.panelEl.contains(elAt))) { clearHover(); return; } const t = targetFromSlotEl(elAt); const ok = t && isDropAllowed(state.payload, t); clearHover(); if (elAt && ok && elAt.classList) { elAt.classList.add('drop-hover'); state.hoverEl = elAt; } } catch { /* ignore */ } }, { passive: false });
    document.addEventListener('pointerup', e => { try { if (!isTouchLike(e) || state.activePointerId == null || e.pointerId !== state.activePointerId) return; const now = Date.now(); if (state.dragging && state.payload) { e.preventDefault(); const dropEl = state.hoverEl; const t = dropEl ? targetFromSlotEl(dropEl) : null; if (t && isDropAllowed(state.payload, t) && performDrop(state.payload, t)) commitCharacterChange(sectionRoot); cleanupDrag(); return; } const src = state.source, key = state.originKey, itemId = state.itemId; state.activePointerId = null; state.source = null; state.itemId = null; state.originEl = null; if (!src || !key || !itemId) return; if (state.lastTapKey === key && now - state.lastTapTime <= 380) { e.preventDefault(); state.lastTapKey = ''; state.lastTapTime = 0; let changed = false; if (src.type === 'bag') changed = autoEquipFromBag(Number(src.index)); if (src.type === 'equip') changed = autoUnequipToFirstEmptyBag(String(src.slot || '')); if (changed) commitCharacterChange(sectionRoot); return; } state.lastTapKey = key; state.lastTapTime = now; } catch { cleanupDrag(); } }, { passive: false });
    document.addEventListener('pointercancel', e => { if (isTouchLike(e) && state.activePointerId != null && e.pointerId === state.activePointerId) cleanupDrag(); }, { passive: true });
}

function onDragStart(event, source) { if (discardMode) { event.preventDefault(); return; } const itemId = getDragItemIdFromSource(source); if (!itemId) { event.preventDefault(); return; } currentDragPayload = { source, itemId }; try { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', JSON.stringify(currentDragPayload)); } catch { /* non-fatal */ } highlightValidDropTargets(currentDragPayload); }
function onDragEnd() { currentDragPayload = null; clearAllDropVisuals(); }
function onDragOver(event, target) { const payload = getCurrentPayload(event); if (!payload) return; if (isDropAllowed(payload, target)) event.preventDefault(); event.currentTarget?.classList?.toggle('drop-ok', isDropAllowed(payload, target)); }
function onDrop(event, target, sectionRoot) { const payload = getCurrentPayload(event); if (!payload) return; event.preventDefault(); clearDropVisual(event.currentTarget); if (!isDropAllowed(payload, target)) return; if (performDrop(payload, target)) { currentDragPayload = null; commitCharacterChange(sectionRoot); } else { currentDragPayload = null; clearAllDropVisuals(); } }

function commitCharacterChange(sectionRoot) { import('../engine/saveload.js').then(m => m?.saveGameStateQuiet?.()); setupCharacterSection(sectionRoot); }
function autoEquipFromBag(bagIndex) { if (!Array.isArray(characterState?.bag) || !Number.isInteger(bagIndex) || bagIndex < 0 || bagIndex >= characterState.bag.length) return false; const entry = characterState.bag[bagIndex]; if (!entry || typeof entry !== 'string') return false; const def = getItemDefinition(entry); if (!def) return false; let targetSlot = def.slot === 'accessory' ? (!characterState?.equipment?.accessory_1 ? 'accessory_1' : (!characterState?.equipment?.accessory_2 ? 'accessory_2' : 'accessory_1')) : def.slot; return canEquipItemToSlot(entry, targetSlot) && moveBagItemToEquip(bagIndex, targetSlot); }
function autoUnequipToFirstEmptyBag(equipSlot) { const s = String(equipSlot || ''); const eq = characterState?.equipment?.[s]; if (!eq) return false; const bag = characterState?.bag; if (!Array.isArray(bag)) return false; const empty = bag.findIndex(x => !x); return empty >= 0 && moveEquipItemToBag(s, empty); }

function clearDropVisual(el) { el?.classList?.remove('drop-ok', 'drop-bad'); }
function clearAllDropVisuals() { document.querySelectorAll('.bag-slot.drop-ok, .bag-slot.drop-bad, .equipment-slot.drop-ok, .equipment-slot.drop-bad').forEach(el => el.classList.remove('drop-ok', 'drop-bad')); }
function highlightValidDropTargets(payload) { clearAllDropVisuals(); if (!payload) return; document.querySelectorAll('.bag-slot, .equipment-slot').forEach(el => { if (!el?.dataset) return; let t = null; if (el.classList.contains('bag-slot')) t = { type: 'bag', index: Number(el.dataset.slot) }; else if (el.classList.contains('equipment-slot')) t = { type: 'equip', slot: String(el.dataset.slot || '') }; if (t && isDropAllowed(payload, t)) el.classList.add('drop-ok'); }); }
function getCurrentPayload(event) { if (currentDragPayload) return currentDragPayload; try { const txt = event?.dataTransfer?.getData('text/plain'); if (txt) { const p = JSON.parse(txt); if (p?.source && p.itemId) return p; } } catch { /* ignore */ } return null; }
function getDragItemIdFromSource(source) { if (!source) return null; if (source.type === 'bag') { const entry = characterState?.bag?.[Number(source.index)]; if (!entry) return null; return typeof entry === 'string' ? entry : entry?.id || null; } if (source.type === 'equip') { const s = String(source.slot || ''); return characterState?.equipment?.[s] || null; } return null; }
function isDropAllowed(payload, target) { if (!payload?.source || !payload.itemId || !target) return false; if (target.type === 'bag') return Number.isInteger(target.index) && target.index >= 0; if (target.type === 'equip') return canEquipItemToSlot(payload.itemId, target.slot); return false; }
function performDrop(payload, target) { const src = payload.source; if (!src) return false; if (src.type === 'bag' && target.type === 'bag') return swapBagSlots(Number(src.index), Number(target.index)); if (src.type === 'bag' && target.type === 'equip') return moveBagItemToEquip(Number(src.index), target.slot); if (src.type === 'equip' && target.type === 'bag') return moveEquipItemToBag(src.slot, Number(target.index)); if (src.type === 'equip' && target.type === 'equip') return moveEquipItemToEquip(src.slot, target.slot); return false; }

function attachConsumableHandlers(panel, sectionRoot) {
    panel.querySelectorAll('[data-auto-consumable]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const itemId = btn.dataset.autoConsumable;
            if (!itemId) return;
            toggleAutoConsume(itemId, characterState);
            commitCharacterChange(sectionRoot);
        });
    });
    panel.querySelectorAll('[data-consumable-use]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            const itemId = btn.dataset.consumableUse;
            if (!itemId) return;
            useConsumableFromBag(itemId, characterState);
            commitCharacterChange(sectionRoot);
        });
    });
}

function escapeHtml(text) { return String(text).replaceAll('&', '&').replaceAll('<', '<').replaceAll('>', '>').replaceAll('"', '"').replaceAll("'", '&#39;'); }