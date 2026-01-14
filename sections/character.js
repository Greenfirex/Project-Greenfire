// Character / Inventory section (v1 scaffold)
// Step 2: state-backed rendering (items + equipment + placeholder stats).

import {
    characterState,
    computeCarryCapacity,
    computeCharacterStats,
    getBagSize,
    canEquipItemToSlot,
    moveBagItemToEquip,
    moveEquipItemToBag,
    moveEquipItemToEquip,
    swapBagSlots,
} from '../data/character.js';
import { getItemDefinition } from '../data/definitions/items.js';
import { resources } from '../core/resources.js';
import { setupTooltip } from '../ui/panels/tooltip.js';

let listenersInstalled = false;
let currentDragPayload = null;

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

    section.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'content-panel character-panel';

    const { cols: bagCols } = getBagSize();
    const stats = computeCharacterStats(characterState);
    const carry = computeCarryCapacity(characterState);
    const bagRows = characterState?.bagRows ?? 2;

    panel.innerHTML = `
        <h2>Character</h2>

        <div class="character-layout">
            <div class="character-card equipment-card">
                <div class="character-card-header">
                    <h3>Equipment</h3>
                </div>

                <div class="paperdoll" aria-label="Character silhouette and equipment">
                    <img class="paperdoll-silhouette" src="assets/images/inventorycharacter.png" alt="" />

                    ${renderEquipmentSlot('head', 'Head', characterState?.equipment?.head)}
                    ${renderEquipmentSlot('chest', 'Chest', characterState?.equipment?.chest)}
                    ${renderEquipmentSlot('legs', 'Legs', characterState?.equipment?.legs)}

                    ${renderEquipmentSlot('weapon', 'Weapon', characterState?.equipment?.weapon)}
                    ${renderEquipmentSlot('offhand', 'Offhand', characterState?.equipment?.offhand)}

                    ${renderEquipmentSlot('accessory_1', 'Accessory 1', characterState?.equipment?.accessory_1)}
                    ${renderEquipmentSlot('accessory_2', 'Accessory 2', characterState?.equipment?.accessory_2)}
                </div>
            </div>

            <div class="character-card stats-card">
                <div class="character-card-header">
                    <h3>Stats</h3>
                </div>

                <div class="stats-list" aria-label="Character stats">
                    ${renderHealthRow()}
                    ${renderStaminaRow()}
                    ${renderStatRow('Damage', formatDamageRange(stats))}
                    ${renderStatRow('Attack Speed', formatAttackSpeed(stats.attackSpeed))}
                    ${renderStatRow('Hit Chance', `${Number(stats.hitChance ?? 0)}%`) }
                    ${renderStatRow('Crit Chance', `${Number(stats.critChance ?? 0)}%`)}
                    ${renderStatRow('Armor', String(stats.armor ?? 0))}
                    ${renderStatRow('Carry Capacity', `${carry.used} / ${carry.total}`)}
                </div>
            </div>

            <div class="character-card inventory-card">
                <div class="character-card-header">
                    <h3>Inventory</h3>
                    <span class="character-card-hint">Bag ${bagRows}×${bagCols}</span>
                </div>

                <div class="bag-grid" style="--bag-cols:${bagCols}; --bag-rows:${bagRows};" aria-label="Inventory bag">
                    ${renderBagSlots()}
                </div>
            </div>
        </div>
    `;

    section.appendChild(panel);

    // Attach interactions after markup is in the DOM
    attachDnDHandlers(section);

    // Attach tooltips after markup is in the DOM
    attachItemTooltips(section);
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

function renderStatRow(label, value) {
    const safeKey = String(label).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    return `
        <div class="stat-row" data-stat="${safeKey}">
            <span class="stat-label">${label}</span>
            <span class="stat-value">${value}</span>
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

    return `
        <div class="stat-row stat-row-bar" data-stat="health">
            <span class="stat-label">Health</span>
            <div class="stat-bar" role="img" aria-label="${escapeHtml(aria)}">
                <div class="stat-bar-fill" style="width:${percent}%"></div>
            </div>
            <span class="stat-value">${escapeHtml(valueText)}</span>
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

    return `
        <div class="stat-row stat-row-bar" data-stat="stamina">
            <span class="stat-label">Stamina</span>
            <div class="stat-bar" role="img" aria-label="${escapeHtml(aria)}">
                <div class="stat-bar-fill" style="width:${percent}%"></div>
            </div>
            <span class="stat-value">${escapeHtml(valueText)}</span>
        </div>
    `;
}

function renderBagSlots() {
    const bag = Array.isArray(characterState?.bag) ? characterState.bag : [];
    return bag.map((itemId, i) => {
        const item = itemId ? getItemDefinition(itemId) : null;
        const hasItem = !!item;
        const label = hasItem ? item.name : '';
        const icon = (item && item.icon) ? String(item.icon) : '';
        return `
            <div class="bag-slot ${hasItem ? 'has-item' : ''}" data-slot="${i}" data-item-id="${hasItem ? escapeHtml(item.id) : ''}" ${hasItem ? 'draggable="true"' : ''} role="button" tabindex="0" aria-label="Bag slot ${i + 1}">
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

function formatAttackSpeed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '1.0';
    return n.toFixed(1);
}

function formatDamageRange(stats) {
    const min = Number(stats?.damageMin);
    const max = Number(stats?.damageMax);
    const safeMin = Number.isFinite(min) ? Math.floor(min) : 0;
    const safeMax = Number.isFinite(max) ? Math.floor(max) : safeMin;
    return `${safeMin} - ${safeMax}`;
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
    };
    const equipSlotLabels = {
        head: 'Head',
        chest: 'Chest',
        legs: 'Legs',
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
            const suffix = (k === 'critChance') ? '%' : '';
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
    updateSingleVitalRow(panel, 'stamina', getStaminaResourceSnapshot, 'Stamina');
    updateSingleVitalRow(panel, 'health', getHealthResourceSnapshot, 'Health');
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
}

function onDragStart(event, source) {
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
