import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { t } from '../locales/locales.js';
import { setupEffectsUI, getEffectDebuffs, addEffect, removeEffect, hasEffect, updateEffectsUI, EFFECT_HUNGRY, EFFECT_THIRSTY, EFFECT_EXHAUSTED, clearAllEffects } from './effects.js';
import { setupQueueUI } from './queue.js';
import { gameFlags } from './gameFlags.js';
import { switchToLocation } from '../sections/locations/locationData.js';
import { clearQueue } from './queue.js';
import { resetIngameTime } from './time.js';
import { showStoryPopup } from '../ui/panels/storyPopup.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { getAutoConsumeSettings, countItemInBag } from '../sections/character/character.js';
import { resetCharacterState } from '../sections/character/character.js';
import { getItemDefinition } from '../sections/character/items.js';

const RESOURCE_LOCALE_KEYS = {
    'Health': 'res_health',
    'Stamina': 'res_stamina',
    'XP': 'res_xp',
    'Food Rations': 'res_food',
    'Drinking Water': 'res_water',
};

export const RESOURCE_EMOJIS = {
    'Health': '❤️',
    'Stamina': '⚡',
    'XP': '⭐',
    'Food Rations': '🥩',
    'Drinking Water': '💧',
};

const RESOURCE_DESC_KEYS = {
    'Health': 'res_health_desc',
    'Stamina': 'res_stamina_desc',
    'Food Rations': 'res_food_desc',
    'Drinking Water': 'res_water_desc',
};

export function getInitialResources() {
    return [
        { name: 'Health', amount: 100, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Stamina', amount: 100, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Food Rations', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
        { name: 'Drinking Water', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

// ==========================================================================
// Area Resources — location-based supply stocks
// ==========================================================================

export const areaResources = {};

const AREA_EMOJIS = {
    'area_food': '🥫',
    'area_water': '💦',
};

const AREA_LOCALE_KEYS = {
    'area_food': 'area_food',
    'area_water': 'area_water',
};

const AREA_DESC_KEYS = {
    'area_food': 'area_food',
    'area_water': 'area_water',
};

/**
 * Initialize area resources for a location. Called when player first enters or assess_supplies completes.
 */
export function initAreaResources(locationId) {
    if (areaResources[locationId]) return; // already initialized
    if (locationId === 'scout_ship_main_area') {
        areaResources[locationId] = [
            { name: 'area_food', amount: 12, capacity: 99 },
            { name: 'area_water', amount: 15, capacity: 99 },
        ];
    }
}

/**
 * Drain an area resource by amount. Returns true if successful.
 */
export function drainAreaResource(locationId, resourceName, amount) {
    const list = areaResources[locationId];
    if (!list) return false;
    const res = list.find(r => r.name === resourceName);
    if (!res) return false;
    if (res.amount < amount) return false;
    res.amount -= amount;
    if (res.amount < 0) res.amount = 0;
    updateAreaResourcesUI();
    return true;
}

/**
 * Get the current amount of an area resource.
 */
export function getAreaResourceAmount(locationId, resourceName) {
    const list = areaResources[locationId];
    if (!list) return 0;
    const res = list.find(r => r.name === resourceName);
    return res ? res.amount : 0;
}

let _areaSectionHost = null;

function buildAreaResourceTooltipHtml(resourceName) {
    const list = (typeof window !== 'undefined' && window._currentAreaResourceList) ? window._currentAreaResourceList : null;
    if (!list) return '';
    const res = list.find(r => r.name === resourceName);
    if (!res) return '';
    const name = t(AREA_LOCALE_KEYS[resourceName] || resourceName);
    const desc = t(AREA_DESC_KEYS[resourceName] || '');
    return `<h4>${name}</h4><p class="tooltip-description">${desc}</p><p>Remaining: <strong>${Math.floor(res.amount)}</strong></p>`;
}

export function showAreaSuppliesPanel() {
    if (_areaSectionHost) {
        _areaSectionHost.classList.remove('hidden');
    }
    updateAreaResourcesUI();
}

export function updateAreaResourcesUI() {
    if (!_areaSectionHost) {
        _areaSectionHost = document.getElementById('areaResourcesSection');
    }
    if (!_areaSectionHost) return;
    
    const list = [];
    // Try to find the current area resources from window global set by locationEngine
    if (typeof window !== 'undefined' && window._currentAreaResourceList) {
        list.push(...window._currentAreaResourceList);
    }
    
    const body = _areaSectionHost.querySelector('.area-resources-body');
    if (!body) return;
    
    if (list.length === 0) {
        body.innerHTML = '';
        return;
    }
    
    body.innerHTML = list.map(res => {
        const emoji = AREA_EMOJIS[res.name] || '';
        const name = t(AREA_LOCALE_KEYS[res.name] || res.name);
        const amt = Math.floor(res.amount);
        const cap = Math.floor(res.capacity);
        const pct = cap > 0 ? Math.min(100, (amt / cap) * 100) : 0;
        const isZero = amt <= 0;
        return `<div class="area-resource-row">
            <div class="area-resource-bar" style="width:${pct}%"></div>
            <span class="area-resource-name">${emoji} ${name}</span>
            <span class="area-resource-amount${isZero ? ' zero-amount' : ''}">${amt} / ${cap}</span>
        </div>`;
    }).join('');
}

export function roundResourceAmount(resource) {
    if (resource && Number.isFinite(resource.amount)) {
        resource.amount = parseFloat(resource.amount.toFixed(2));
    }
}

// Active drain rates and their source descriptions for tooltips.
let _activeDrainRates = null;
let _activeDrainSources = null; // { resourceName: [{ rate, label }] }

export function setActiveDrainRates(rates, sources) {
    _activeDrainRates = rates ? { ...rates } : null;
    _activeDrainSources = sources || null;
}

const RESOURCE_CATEGORIES = {
    'Health': 'Essential',
    'Stamina': 'Essential',
    'Food Rations': 'Essential',
    'Drinking Water': 'Essential',
};

function getResourceCategoryName(resourceName) {
    return RESOURCE_CATEGORIES[resourceName] || 'Essential';
}

// Per-minute passive rates (no action running)
const PASSIVE_PER_MIN = {
    'Health': 0.1,
    'Stamina': 0,
    'Food Rations': 0,
    'Drinking Water': 0,
};

// Health drain rate when Exhausted (per minute)
const EXHAUSTED_HEALTH_DRAIN = -1.0;

function buildResourceTooltipHtml(resourceName) {
    const name = String(resourceName || '');
    const currentResource = resources.find(r => r.name === name);
    if (!currentResource) return `<h4>${name}</h4><p>No data available.</p>`;

    const rates = computeResourceRates(name);
    if (!rates) return `<h4>${name}</h4><p>No data available.</p>`;

    const res = resources.find(r => r && r.name === name);
    const amt = res ? (res.integer ? Math.floor(Number(res.amount) || 0) : (Number(res.amount) || 0)) : 0;
    const cap = res ? (res.integer ? Math.floor(Number(res.capacity) || 0) : (Number(res.capacity) || 0)) : 0;

    let description = t(RESOURCE_DESC_KEYS[name] || '') || '';

    const sign = rates.netPerMinute >= 0 ? '+' : '-';
    const regenLabel = (name === 'Health' || name === 'Stamina') ? 'Regeneration' : 'Gains';
    const drainLabel = (name === 'Health' || name === 'Stamina') ? 'Drain' : 'Usage';

    let sectionsHtml = '';

    // Show Gains/Regeneration section with source bullet points
    if (rates.totalProduction > 1e-9) {
        const sourceLines = (rates.productionSources && rates.productionSources.length)
            ? rates.productionSources.map(s => `<p class="tooltip-detail">• ${s.label}</p>`).join('')
            : '';
        sectionsHtml += `<div class="tooltip-section">
            <p>${regenLabel}: +<span class="tooltip-amount-produces">${formatNumber(rates.totalProduction)}</span>/min</p>
            ${sourceLines}
        </div>`;
    }

    // Show Usage/Drain section with source bullet points
    if (rates.totalConsumption > 1e-9) {
        const sourceLines = (rates.consumptionSources && rates.consumptionSources.length)
            ? rates.consumptionSources.map(s => `<p class="tooltip-detail">• ${s.label}</p>`).join('')
            : '';
        sectionsHtml += `<div class="tooltip-section">
            <p>${drainLabel}: -<span class="tooltip-amount-consumes">${formatNumber(rates.totalConsumption)}</span>/min</p>
            ${sourceLines}
        </div>`;
    }

    return `
        <h4>${name}</h4>
        <p class="tooltip-description">${description}</p>
        <div class="tooltip-section">
            <p>Current: <strong>${amt}${cap > 0 ? `/${cap}` : ''}</strong></p>
        </div>
        ${sectionsHtml}
        <hr>
        <p><strong>Net Change: ${sign}${formatNumber(Math.abs(rates.netPerMinute))}/min</strong></p>
    `;
}

export function computeResourceRates(resourceName) {
    const currentResource = resources.find(r => r.name === resourceName);
    if (!currentResource) return null;

    let totalProduction = 0;
    let totalConsumption = 0;
    const productionSources = [];
    const consumptionSources = [];

    // Passive rates with source labels
    if (resourceName === 'Health') {
        // Health only regens if NOT exhausted
        if (!hasEffect('exhausted')) {
            totalProduction += 0.1;
            productionSources.push({ rate: 0.1, label: 'Passive regeneration' });
        }
    }

    // Active drain rates from running action (Stamina costs/gains during actions)
    if (_activeDrainRates && _activeDrainRates[resourceName] !== undefined) {
        const activeRate = Number(_activeDrainRates[resourceName]);
        if (activeRate < 0) {
            const absRate = Math.abs(activeRate);
            totalConsumption += absRate;
            // Use the source label if available
            if (_activeDrainSources && _activeDrainSources[resourceName]) {
                consumptionSources.push(..._activeDrainSources[resourceName]);
            }
        } else {
            totalProduction += activeRate;
            if (_activeDrainSources && _activeDrainSources[resourceName]) {
                productionSources.push(..._activeDrainSources[resourceName]);
            }
        }
    }

    const netPerMinute = totalProduction - totalConsumption;

    return {
        resource: currentResource,
        totalProduction,
        totalConsumption,
        netPerMinute,
        productionSources,
        consumptionSources,
    };
}

export function resetResources() {
    const initial = getInitialResources();
    resources.length = 0;
    initial.forEach(res => resources.push({ ...res }));
}

export function setupInfoPanel() {
    const infoPanelContent = document.getElementById('infoPanelContent');
    if (!infoPanelContent) return;
    infoPanelContent.innerHTML = '';

    // Three equal sub-panels
    const resourcesPanel = document.createElement('div');
    resourcesPanel.className = 'info-sub-panel';
    resourcesPanel.id = 'infoResourcesPanel';

    const effectsPanel = document.createElement('div');
    effectsPanel.className = 'info-sub-panel';
    effectsPanel.id = 'infoEffectsPanel';

    const queuePanel = document.createElement('div');
    queuePanel.className = 'info-sub-panel';
    queuePanel.id = 'infoQueuePanel';

    infoPanelContent.appendChild(resourcesPanel);
    infoPanelContent.appendChild(effectsPanel);
    infoPanelContent.appendChild(queuePanel);

    // Add unified section header above resources
    const resourcesHeader = document.createElement('div');
    resourcesHeader.className = 'panel-section-header';
    resourcesHeader.setAttribute('data-locale', 'personal_resources');
    resourcesHeader.textContent = t('personal_resources');
    resourcesPanel.appendChild(resourcesHeader);

    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

    const CATEGORY_ORDER = [
        { id: 'Essential', title: 'Essential' },
        { id: 'Materials', title: 'Materials' },
        { id: 'Tools', title: 'Tools' },
        { id: 'Science', title: 'Science' },
        { id: 'Other', title: 'Other' },
    ];

    const categoryContainers = new Map();
    CATEGORY_ORDER.forEach(cat => {
        const wrapper = document.createElement('div');
        wrapper.className = 'info-category hidden';
        wrapper.dataset.category = cat.id;

        const header = document.createElement('div');
        header.className = 'info-category-header';
        header.textContent = t('res_category_' + cat.id.toLowerCase());

        const body = document.createElement('div');
        body.className = 'info-category-body';

        wrapper.appendChild(header);
        wrapper.appendChild(body);
        infoSection.appendChild(wrapper);
        categoryContainers.set(cat.id, body);
    });

    getInitialResources().forEach(resource => {
        if (resource.hidden) return;
        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        infoRow.dataset.resource = resource.name;
        infoRow.classList.add('hidden');
        infoRow.classList.toggle('non-producible', !resource.producible);

        const emoji = RESOURCE_EMOJIS[resource.name] || '';
        const displayName = emoji ? `${emoji} ${t(RESOURCE_LOCALE_KEYS[resource.name] || resource.name)}` : t(RESOURCE_LOCALE_KEYS[resource.name] || resource.name);
        infoRow.innerHTML = `
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1"><span>${displayName}</span></div>
            <div class="infocolumn2"><p data-value-type="storage"></p></div>
            <div class="infocolumn3"><p data-value-type="generation"></p></div>
        `;

        setupTooltip(infoRow, () => {
            return buildResourceTooltipHtml(infoRow.dataset.resource);
        });

        const cat = getResourceCategoryName(resource.name);
        (categoryContainers.get(cat) || categoryContainers.get('Other') || infoSection).appendChild(infoRow);
    });

    resourcesPanel.appendChild(infoSection);

    // Area Supplies section (below Personal, initially hidden)
    const areaSection = document.createElement('div');
    areaSection.className = 'area-section hidden';
    areaSection.id = 'areaResourcesSection';
    areaSection.innerHTML = `
        <div class="panel-section-header" data-locale="area_supplies">${t('area_supplies')}</div>
        <div class="area-resources-body"></div>
    `;
    resourcesPanel.appendChild(areaSection);
    _areaSectionHost = areaSection;

    updateResourceCategoryVisibility(infoPanelContent);
    setupQueueUI(queuePanel);
    setupEffectsUI(effectsPanel);
}

function updateResourceCategoryVisibility(root = document) {
    const wrappers = root.querySelectorAll('.info-category');
    wrappers.forEach(w => {
        const hasVisibleRow = !!w.querySelector('.info-row:not(.hidden)');
        w.classList.toggle('hidden', !hasVisibleRow);
    });
}

export function updateResourceInfo() {
    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }

        infoRow.classList.toggle('hidden', !resource.isDiscovered);
        if (!resource.isDiscovered) return;

        infoRow.classList.toggle('non-producible', !resource.producible);

        const generationEl = infoRow.querySelector('[data-value-type="generation"]');
        const storageEl = infoRow.querySelector('[data-value-type="storage"]');
        const nameEl = infoRow.querySelector('.infocolumn1 > span');

        const rawAmountNum = Number(resource.amount);
        const isZero = !(isFinite(rawAmountNum)) ? false : (rawAmountNum <= 0);
        const amountDisplay = formatNumber(resource.amount, 2);
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();

        storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;
        storageEl.classList.toggle('zero-amount', isZero);
        if (nameEl) nameEl.classList.toggle('zero-amount', isZero);
        infoRow.classList.toggle('zero-amount', isZero);

        const rates = computeResourceRates(resource.name);
        if (!rates) return;

        const { netPerMinute } = rates;
        const isCapped = (resource.capacity > 0) ? (resource.amount >= resource.capacity) : false;
        generationEl.classList.toggle('negative-rate', netPerMinute < 0 && !isCapped);

        const EPS = 1e-9;
        if (!_activeDrainRates) {
            generationEl.textContent = '';
        } else if (Math.abs(netPerMinute) > EPS) {
            // Don't show negative drain rate when resource is already depleted
            if (netPerMinute < 0 && resource.amount <= 0) {
                generationEl.textContent = '';
            } else {
                const sign = netPerMinute >= 0 ? '+' : '-';
                const value = formatNumber(Math.abs(netPerMinute));
                generationEl.textContent = `${sign}${value}/min`;
            }
        } else {
            generationEl.textContent = '';
        }

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;

        const rn = String(resource.name || '');
        progressBar.classList.remove('bar-stamina', 'bar-food', 'bar-water', 'bar-health');
        if (/stamina/i.test(rn)) progressBar.classList.add('bar-stamina');
        else if (/food/i.test(rn)) progressBar.classList.add('bar-food');
        else if (/water/i.test(rn)) progressBar.classList.add('bar-water');
        else if (/health/i.test(rn)) progressBar.classList.add('bar-health');

        infoRow.classList.toggle('capped', isCapped);
    });

    updateResourceCategoryVisibility(document.getElementById('infoPanelContent') || document);
}

// ==========================================================================
// NEW: Cascading Survival System
// ==========================================================================

/**
 * Reset all action state across all locations — clears unlocks, completion flags, and repeat counts.
 * Called on death loop so only wake_up remains available.
 */
function resetAllActionState() {
    try {
        // Clear all unlock state from localStorage
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('unlocks_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch { /* ignore */ }
    
    // Clear completed/one-time flags from all registered location actions
    try {
        import('../sections/locations/locationData.js').then(({ getAllLocations }) => {
            const allLocations = getAllLocations();
            Object.values(allLocations).forEach(loc => {
                if (loc && Array.isArray(loc.actions)) {
                    loc.actions.forEach(action => {
                        delete action._completed;
                        delete action._repeatCount;
                    });
                }
            });
        });
    } catch { /* ignore */ }
}

let _deathLoopHandled = false; // prevent re-entry

function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

/**
 * Update survival effects based on current resource levels.
 * Hungry = Food ≤ 0, Thirsty = Water ≤ 0, Exhausted = Stamina ≤ 0.
 */
function syncSurvivalEffects() {
    const food = getResourceByName('Food Rations');
    const water = getResourceByName('Drinking Water');
    const stamina = getResourceByName('Stamina');

    // Hungry
    if (food && food.amount <= 0) {
        if (!hasEffect('hungry')) {
            addEffect({ ...EFFECT_HUNGRY });
            addLogEntry(t('log_effect_added', { effect: t('effect_hungry_name') }), LogType.WARNING);
        }
    } else {
        if (hasEffect('hungry')) {
            removeEffect('hungry');
        }
    }

    // Thirsty
    if (water && water.amount <= 0) {
        if (!hasEffect('thirsty')) {
            addEffect({ ...EFFECT_THIRSTY });
            addLogEntry(t('log_effect_added', { effect: t('effect_thirsty_name') }), LogType.WARNING);
        }
    } else {
        if (hasEffect('thirsty')) {
            removeEffect('thirsty');
        }
    }

    // Exhausted
    if (stamina && stamina.amount <= 0) {
        if (!hasEffect('exhausted')) {
            addEffect({ ...EFFECT_EXHAUSTED });
            addLogEntry(t('log_effect_added', { effect: t('effect_exhausted_name') }), LogType.WARNING);
        }
    } else {
        if (hasEffect('exhausted')) {
            removeEffect('exhausted');
        }
    }
}

/**
 * Handle death and loop reset when Health reaches 0.
 * Shows a story popup whose content varies by loopCount,
 * increments the loop counter, and resets all resources to full default values.
 */
function handleDeathAndLoop() {
    if (_deathLoopHandled) return;
    _deathLoopHandled = true;

    // Cancel any running action (we signal via clearing active drain rates)
    setActiveDrainRates(null, null);
    try { window.dispatchEvent(new CustomEvent('force-cancel-action')); } catch { /* ignore */ }

    resetAllActionState();

    // Clear the action queue
    try { clearQueue(); } catch { /* ignore */ }

    // Reset in-game time to Day 0 but keep total played time
    try { resetIngameTime(); } catch { /* ignore */ }

    // Increment loop count
    gameFlags.loopCount = (gameFlags.loopCount || 0) + 1;
    const loop = gameFlags.loopCount;

    try {
        const state = JSON.parse(localStorage.getItem('gameState') || '{}');
        if (!state.gameFlags) state.gameFlags = {};
        state.gameFlags.loopCount = loop;
        localStorage.setItem('gameState', JSON.stringify(state));
    } catch { /* ignore */ }

    addLogEntry(`💀 You have died. Health reached 0.`, LogType.ERROR);

    // Determine story popup content based on loop stage
    let titleKey, pagesKey;
    if (loop === 1) {
        titleKey = 'death_title_1';
        pagesKey = 'death_pages_1';
    } else if (loop === 2) {
        titleKey = 'death_title_2';
        pagesKey = 'death_pages_2';
    } else if (loop === 3) {
        titleKey = 'death_title_3';
        pagesKey = 'death_pages_3';
    } else {
        titleKey = 'death_title_loop';
        pagesKey = 'death_pages_loop';
    }

    const title = t(titleKey, { loop });
    const pagesText = t(pagesKey, { loop });
    const pages = (pagesText || '').split('\n\n').filter(p => p.trim());

    // Clear all survival effects for the fresh loop
    clearAllEffects();

    // Reset resources and character inventory to full defaults
    resetResources();
    resetCharacterState();

    // Move player back to Crew Quarters
    switchToLocation('scout_ship_crew_quarters');

    // Show the story popup with a game area pulse animation on close
    showStoryPopup({
        id: `death_loop_${loop}`,
        title,
        pages,
        onClose: () => {
            // Pulse the game area to signal the reset
            try {
                const gameArea = document.getElementById('gameArea');
                if (gameArea) {
                    gameArea.style.transition = 'opacity 0.3s ease';
                    gameArea.style.opacity = '0';
                    setTimeout(() => {
                        gameArea.style.opacity = '1';
                    }, 350);
                }
            } catch { /* ignore */ }
            // Force UI refresh so actions panel shows Wake Up immediately
            try { window.dispatchEvent(new CustomEvent('death-loop-reset')); } catch { /* ignore */ }
        },
    });

    // Reset the guard after a short delay
    setTimeout(() => {
        _deathLoopHandled = false;
    }, 1000);

    // Force UI refresh
    try { updateResourceInfo(); } catch { /* ignore */ }
}

/**
 * Apply passive resource changes driven by time passing,
 * including active drain rates from ongoing actions.
 * Cascade: Food/Water = 0 → Hungry/Thirsty → Stamina drain ↑
 *          Stamina = 0 → Exhausted → Health drains
 *          Health = 0 → Death → Loop reset
 * @param {number} realSeconds — amount of real time that passed
 */
const AUTO_CONSUME_THRESHOLD_PCT = 0.25; // 25% of capacity

function tickAutoConsume() {
    try {
        const autoSettings = getAutoConsumeSettings();
        const waterRes = getResourceByName('Drinking Water');
        const foodRes = getResourceByName('Food Rations');
        
        // Auto-drink bottled_water when below 25%
        if (autoSettings.bottled_water && waterRes) {
            const threshold = waterRes.capacity * AUTO_CONSUME_THRESHOLD_PCT;
            if (waterRes.amount >= 0 && waterRes.amount < threshold) {
                const count = countItemInBag('bottled_water');
                if (count > 0) {
                    const def = getItemDefinition('bottled_water');
                    if (def && def.consumable && def.consumable.amount) {
                        // Dynamically import to avoid circular dependency at module init
                        import('../sections/character/character.js').then(({ consumeItemQuantityFromBag }) => {
                            if (consumeItemQuantityFromBag('bottled_water', 1)) {
                                waterRes.amount = Math.min(waterRes.capacity, waterRes.amount + def.consumable.amount);
                                addLogEntry(`Auto-drink: Used Bottled Water (+${def.consumable.amount} Water)`, LogType.INFO);
                            }
                        });
                    }
                }
            }
        }
        
        // Auto-eat packaged_food when below 25%
        if (autoSettings.packaged_food && foodRes) {
            const threshold = foodRes.capacity * AUTO_CONSUME_THRESHOLD_PCT;
            if (foodRes.amount >= 0 && foodRes.amount < threshold) {
                const count = countItemInBag('packaged_food');
                if (count > 0) {
                    const def = getItemDefinition('packaged_food');
                    if (def && def.consumable && def.consumable.amount) {
                        import('../sections/character/character.js').then(({ consumeItemQuantityFromBag }) => {
                            if (consumeItemQuantityFromBag('packaged_food', 1)) {
                                foodRes.amount = Math.min(foodRes.capacity, foodRes.amount + def.consumable.amount);
                                addLogEntry(`Auto-eat: Used Packaged Food (+${def.consumable.amount} Food)`, LogType.INFO);
                            }
                        });
                    }
                }
            }
        }
    } catch { /* ignore */ }
}

// Throttle auto-consume to once per 10 seconds
let _lastAutoConsumeTick = 0;

export function applyTimePassiveDrain(realSeconds) {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;

    // First, compute the per-minute base rates for each resource.
    // This combines passive rates + active drain rates from running actions.
    const perMinRates = {};
    resources.forEach(res => {
        let perMinRate = PASSIVE_PER_MIN[res.name] || 0;

        // Active drain rates from running actions
        if (_activeDrainRates && _activeDrainRates[res.name] !== undefined) {
            perMinRate += Number(_activeDrainRates[res.name]);
        }

        // If exhausted, Health drains instead of regens
        if (res.name === 'Health' && hasEffect('exhausted')) {
            perMinRate = EXHAUSTED_HEALTH_DRAIN;
            // Still apply action drain on top if any
            if (_activeDrainRates && _activeDrainRates['Health'] !== undefined) {
                perMinRate += Number(_activeDrainRates['Health']);
            }
        }

        perMinRates[res.name] = perMinRate;
    });

    // Apply the delta for the passed time
    resources.forEach(res => {
        const perMinRate = perMinRates[res.name] || 0;
        if (perMinRate === 0) return;
        const delta = parseFloat((perMinRate * realSeconds).toFixed(10));
        if (delta === 0) return;
        res.amount = parseFloat(Math.max(0, Math.min(res.capacity, res.amount + delta)).toFixed(10));
    });

    // Auto-consume supplies (throttled to once per 10s)
    const now = Date.now();
    if (now - _lastAutoConsumeTick > 10000) {
        _lastAutoConsumeTick = now;
        tickAutoConsume();
    }
    
    // Sync survival effects based on current resource levels
    syncSurvivalEffects();

    // Check for death
    const health = getResourceByName('Health');
    if (health && health.amount <= 0) {
        health.amount = 0;
        if (!_deathLoopHandled) {
            _deathLoopHandled = true;
            // Use setTimeout to break out of any interval context safely
            setTimeout(() => {
                _deathLoopHandled = false;
                handleDeathAndLoop();
            }, 0);
        }
    }
}

// ==========================================================================
// Expose for external callers (locationEngine, etc.)
// ==========================================================================

/**
 * Check if the player has died (health ≤ 0) and trigger loop if so.
 * Called after action completion to catch death from lump-sum costs.
 */
export function checkDeathAndLoop() {
    const health = getResourceByName('Health');
    if (!health) return;
    // Sync effects first in case resources went to 0 from lump-sum costs
    syncSurvivalEffects();
    if (health.amount <= 0) {
        health.amount = 0;
        handleDeathAndLoop();
    }
}