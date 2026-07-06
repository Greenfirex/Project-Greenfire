import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { t } from '../locales/locales.js';
import { setupEffectsUI, getEffectDebuffs, getEffectDrains, getEffectDebuffDetails, addEffect, removeEffect, hasEffect, updateEffectsUI, EFFECT_HUNGRY, EFFECT_THIRSTY, EFFECT_EXHAUSTED, EFFECT_LIFE_SUPPORT_FAILURE, EFFECT_OXYGEN_DEPLETED, clearAllEffects } from './effects.js';
import { setupQueueUI } from './queue.js';
import { setupInfoVitals, updateInfoVitals, updateEffectsStrip, updateAreaVitals } from '../ui/chrome/infoVitals.js';
import { gameFlags, flagActionAsNew, resetPerLoopFlags } from './gameFlags.js';
import { switchToLocation, getAllLocations } from '../sections/locations/locationData.js';
import { clearQueue } from './queue.js';
import { resetIngameTime } from './time.js';
import { showStoryPopup } from '../ui/panels/storyPopup.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { getAutoConsumeSettings, countItemInBag, characterState } from '../sections/character/character.js';
import { resetCharacterState } from '../sections/character/character.js';
import { getItemDefinition } from '../sections/character/items.js';

export const RESOURCE_LOCALE_KEYS = {
    'Health': 'res_health',
    'Stamina': 'res_stamina',
    'XP': 'res_xp',
    'Food Rations': 'res_food',
    'Drinking Water': 'res_water',
    'Oxygen': 'res_oxygen',
};

export const RESOURCE_EMOJIS = {
    'Health': '❤️',
    'Stamina': '⚡',
    'XP': '⭐',
    'Food Rations': '🥩',
    'Drinking Water': '💧',
    'Oxygen': '🫧',
};

const RESOURCE_DESC_KEYS = {
    'Health': 'res_health_desc',
    'Stamina': 'res_stamina_desc',
    'Food Rations': 'res_food_desc',
    'Drinking Water': 'res_water_desc',
    'Oxygen': 'res_oxygen_desc',
};

export function getInitialResources() {
    return [
        { name: 'Health', amount: 100, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Stamina', amount: 100, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Food Rations', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
        { name: 'Drinking Water', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
        { name: 'Oxygen', amount: 0, capacity: 0, isDiscovered: false, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

// ==========================================================================
// Uniform Set Bonus — Personal Oxygen
// ==========================================================================

const UNIFORM_ITEM_IDS = ['basic_helmet', 'basic_armor', 'basic_legs', 'basic_boots'];
const UNIFORM_O2_CAPACITY = 120;
const UNIFORM_O2_DRAIN_PER_MIN = 4; // same rate as area_o2 when oxygen_depleted

/**
 * Sync personal Oxygen resource based on whether the full uniform set is equipped.
 * Called on equipment changes and during passive drain ticks.
 */
export function syncUniformOxygen() {
    const oxygen = getResourceByName('Oxygen');
    if (!oxygen) return;

    const equipped = characterState?.equipment || {};
    const equippedIds = Object.values(equipped).filter(Boolean);
    const hasFullSet = UNIFORM_ITEM_IDS.every(id => equippedIds.includes(id));

    if (hasFullSet) {
        if (oxygen.capacity === 0) {
            // First equipping — initialize from saved state or full tank
            oxygen.capacity = UNIFORM_O2_CAPACITY;
            const saved = (typeof characterState.uniformOxygen === 'number' && characterState.uniformOxygen >= 0)
                ? characterState.uniformOxygen : UNIFORM_O2_CAPACITY;
            oxygen.amount = Math.min(saved, UNIFORM_O2_CAPACITY);
            oxygen.isDiscovered = true;
            oxygen.hidden = false;
            // If oxygen_depleted was active, uniform now protects — remove effect
            if (hasEffect('oxygen_depleted')) {
                removeEffect('oxygen_depleted');
                addLogEntry(t('log_effect_removed', { effect: t('effect_oxygen_depleted_name') }), LogType.ERROR);
            }
        }
    } else {
        if (oxygen.capacity > 0) {
            // Save current amount to characterState before hiding
            characterState.uniformOxygen = oxygen.amount;
            oxygen.amount = 0;
            oxygen.capacity = 0;
            oxygen.isDiscovered = false;
            oxygen.hidden = true;
            // Reinstate oxygen_depleted if conditions warrant it
            if (hasEffect('life_support_failure') && !hasEffect('oxygen_depleted')) {
                const bridgeList = areaResources['scout_ship_bridge'];
                const areaO2 = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_o2') : null;
                if (!areaO2 || areaO2.amount <= 0) {
                    addEffect({ ...EFFECT_OXYGEN_DEPLETED });
                    addLogEntry(t('log_effect_added', { effect: t('effect_oxygen_depleted_name') }), LogType.ERROR);
                }
            }
        }
    }
}

// Listen for equipment changes to sync uniform O2
if (typeof window !== 'undefined') {
    try {
        window.addEventListener('character-state-changed', () => {
            syncUniformOxygen();
            updateResourceInfo();
        });
    } catch { /* ignore */ }
}

// ==========================================================================
// Area Resources — location-based supply stocks
// ==========================================================================

export const areaResources = {};

// Track which locations have had their area resources revealed to the player.
// Resources can be initialized early (e.g. for drain mechanics) but remain
// hidden from the UI until the appropriate reveal action is completed.
const _revealedAreaLocations = new Set();

export function revealAreaResources(locationId) {
    _revealedAreaLocations.add(locationId);
    updateAreaResourcesUI();
}

export function isAreaRevealed(locationId) {
    return _revealedAreaLocations.has(locationId);
}

export function getRevealedAreaLocationsForSave() {
    return Array.from(_revealedAreaLocations);
}

export function setRevealedAreaLocationsFromSave(saved) {
    _revealedAreaLocations.clear();
    if (Array.isArray(saved)) {
        saved.forEach(id => _revealedAreaLocations.add(id));
    }
}

export function resetRevealedAreaLocations() {
    _revealedAreaLocations.clear();
}

const AREA_EMOJIS = {
    'area_food': '🥫',
    'area_water': '💦',
    'area_fuel': '⛽',
    'area_o2': '🫧',
};

const AREA_LOCALE_KEYS = {
    'area_food': 'area_food',
    'area_water': 'area_water',
    'area_fuel': 'area_fuel',
    'area_o2': 'area_o2',
};

const AREA_DESC_KEYS = {
    'area_food': 'area_food',
    'area_water': 'area_water',
    'area_fuel': 'area_fuel',
    'area_o2': 'area_o2',
};

/**
 * Initialize area resources for a location. Called when player first enters or assess_supplies completes.
 */
export function initAreaResources(locationId) {
    if (areaResources[locationId]) return; // already initialized
    if (locationId === 'scout_ship_main_area') {
        areaResources[locationId] = [
            { name: 'area_water', amount: 15, capacity: 99 },
        ];
    } else if (locationId === 'scout_ship_bridge') {
        areaResources[locationId] = [
            { name: 'area_fuel', amount: 300, capacity: 600 },
            { name: 'area_o2', amount: 200, capacity: 200 },
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

/**
 * Deep-clone areaResources for save persistence.
 */
export function getAreaResourcesForSave() {
    try {
        return JSON.parse(JSON.stringify(areaResources));
    } catch { return {}; }
}

/**
 * Replace areaResources from saved data (used during load).
 */
export function setAreaResourcesFromSave(saved) {
    if (!saved || typeof saved !== 'object') return;
    // Clear existing keys
    for (const key of Object.keys(areaResources)) {
        delete areaResources[key];
    }
    // Repopulate from saved data
    Object.assign(areaResources, saved);
    // Auto-reveal any locations that have area resources in the save
    // (covers old saves that lack revealedAreaLocations, and edge cases)
    for (const locId of Object.keys(areaResources)) {
        if (Array.isArray(areaResources[locId]) && areaResources[locId].length > 0) {
            _revealedAreaLocations.add(locId);
        }
    }
    // Refresh UI if area supplies panel is visible
    showAreaSuppliesPanel();
}

export function showAreaSuppliesPanel() {
    if (_areaSectionHost) {
        _areaSectionHost.classList.remove('hidden');
    }
    updateAreaResourcesUI();
}

// Active area drain rates set by locationEngine during actions
let _activeAreaDrainRates = null;
let _actionAreaDrainRates = null;

export function setActiveAreaDrainRates(rates) {
    _activeAreaDrainRates = rates || null;
    updateAreaResourcesUI();
}

export function setActionAreaDrainRates(rates) {
    _actionAreaDrainRates = rates || null;
    updateAreaResourcesUI();
}

function getAreaResourceDrainRate(resourceName) {
    // Action-specific drain takes priority over passive drain.
    if (_actionAreaDrainRates && _actionAreaDrainRates[resourceName] !== undefined) {
        return _actionAreaDrainRates[resourceName];
    }
    if (_activeAreaDrainRates && _activeAreaDrainRates[resourceName] !== undefined) {
        return _activeAreaDrainRates[resourceName];
    }
    return '';
}

export function updateAreaResourcesUI() {
    if (!_areaSectionHost) {
        _areaSectionHost = document.getElementById('areaResourcesSection');
    }
    if (!_areaSectionHost) return;
    
    // Merge area resources only from locations that have been revealed to the player.
    // Resources can be initialized early for drain mechanics but stay hidden until
    // the appropriate reveal action (e.g. assess_supplies, check_reactor_status) completes.
    const list = [];
    for (const locId of Object.keys(areaResources)) {
        if (!_revealedAreaLocations.has(locId)) continue;
        if (Array.isArray(areaResources[locId])) {
            for (const res of areaResources[locId]) {
                // Always show all revealed area resources — even when depleted
                list.push(res);
            }
        }
    }
    
    // Show/hide the area section based on whether any area resources exist
    const hasAnyResources = list.length > 0;
    _areaSectionHost.classList.toggle('no-resources', !hasAnyResources);
    if (hasAnyResources) {
        _areaSectionHost.classList.remove('hidden');
    }
    
    const body = _areaSectionHost.querySelector('.area-resources-body');
    if (!body) return;
    
    if (!hasAnyResources) {
        body.innerHTML = '';
        return;
    }
    
    body.innerHTML = list.map(res => {
        const emoji = AREA_EMOJIS[res.name] || '';
        const name = t(AREA_LOCALE_KEYS[res.name] || res.name);
        const amt = parseFloat(res.amount).toFixed(2);
        const cap = parseFloat(res.capacity).toFixed(2);
        const pct = cap > 0 ? Math.min(100, (amt / cap) * 100) : 0;
        const isZero = amt <= 0;
        // Color code: food=orange, water=blue, fuel=yellow/amber, o2=cyan
        let barClass = '';
        if (/area_food/i.test(res.name)) barClass = 'bar-food';
        else if (/area_water/i.test(res.name)) barClass = 'bar-water';
        else if (/area_fuel/i.test(res.name)) barClass = 'bar-fuel';
        else if (/area_o2/i.test(res.name)) barClass = 'bar-o2';
        
        const drainRate = getAreaResourceDrainRate(res.name);
        const hasDrain = drainRate !== '';
        return `<div class="area-resource-row" data-resource="${res.name}">
            <div class="area-resource-bar ${barClass}" style="width:${pct}%"></div>
            <span class="area-resource-name">${emoji} ${name}</span>
            <span class="area-resource-amount${isZero ? ' zero-amount' : ''}${hasDrain ? ' negative-rate' : ''}">${amt} / ${cap}</span>
            ${hasDrain ? `<span class="area-resource-rate negative-rate">${drainRate}</span>` : ''}
        </div>`;
    }).join('');
    
    // Wire tooltips on area resource rows
    try {
        const rows = body.querySelectorAll('.area-resource-row');
        rows.forEach(row => {
            if (row.dataset.tooltipWired) return;
            row.dataset.tooltipWired = '1';
            const resName = row.dataset.resource;
            setupTooltip(row, () => {
                const res = list.find(r => r.name === resName);
                if (!res) return '';
                const descKey = AREA_DESC_KEYS[resName] || '';
                return `<h4>${t(AREA_LOCALE_KEYS[resName] || resName)}</h4><p>Remaining: <strong>${Math.floor(res.amount)}</strong> / ${Math.floor(res.capacity)}</p>`;
            });
        });
    } catch { /* ignore */ }
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
    'Oxygen': 'Essential',
};

function getResourceCategoryName(resourceName) {
    return RESOURCE_CATEGORIES[resourceName] || 'Essential';
}

// Per-minute passive rates (no action running)
const PASSIVE_PER_MIN = {
    'Health': 0,
    'Stamina': 0,
    'Food Rations': 0,
    'Drinking Water': 0,
};

// Health drain rate when Exhausted (per minute)
const EXHAUSTED_HEALTH_DRAIN = -1.0;

function buildResourceTooltipHtml(resourceName) {
    const name = String(resourceName || '');
    const displayName = t(RESOURCE_LOCALE_KEYS[name] || name);
    const currentResource = resources.find(r => r.name === name);
    if (!currentResource) return `<h4>${displayName}</h4><p>No data available.</p>`;

    const rates = computeResourceRates(name);
    if (!rates) return `<h4>${displayName}</h4><p>No data available.</p>`;

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
        <h4>${displayName}</h4>
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
    // (Health no longer regens passively — use Rest action instead)

    // Active drain rates from running action (Stamina costs/gains during actions)
    if (_activeDrainRates && _activeDrainRates[resourceName] !== undefined) {
        const activeRate = Number(_activeDrainRates[resourceName]);
        if (activeRate < 0) {
            const absRate = Math.abs(activeRate);
            totalConsumption += absRate;
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

    // Static effect drains (e.g., hungry -0.3 Stamina/min, oxygen_depleted -2.0 Health/min)
    const effectDrains = getEffectDrains();
    if (effectDrains[resourceName]) {
        totalConsumption += Math.abs(effectDrains[resourceName]);
        // Add effect drain sources
        const details = getEffectDebuffDetails();
        for (const d of details) {
            if (d.debuffs && d.debuffs[resourceName]) {
                consumptionSources.push({ rate: Math.abs(d.debuffs[resourceName]), label: t(d.nameKey) });
            }
        }
    }

    // When exhausted, Stamina-targeted effect drains (hungry, thirsty, alarm) redirect to Health.
    // Also redirect the action's own active Stamina drain rate.
    // Include them in Health's consumption rate so the tooltip reflects actual health drain.
    if (resourceName === 'Health' && hasEffect('exhausted')) {
        if (effectDrains['Stamina']) {
            totalConsumption += Math.abs(effectDrains['Stamina']);
            const details = getEffectDebuffDetails();
            for (const d of details) {
                if (d.debuffs && d.debuffs['Stamina']) {
                    consumptionSources.push({ rate: Math.abs(d.debuffs['Stamina']), label: t(d.nameKey) });
                }
            }
        }
        if (_activeDrainRates && _activeDrainRates['Stamina']) {
            totalConsumption += Math.abs(_activeDrainRates['Stamina']);
            if (_activeDrainSources && _activeDrainSources['Stamina']) {
                consumptionSources.push(..._activeDrainSources['Stamina'].map(s => ({ ...s })));
            }
        }
    }

    // Personal Oxygen drain from uniform — only when life support failed AND area O2 is empty
    if (resourceName === 'Oxygen' && currentResource.capacity > 0 && hasEffect('life_support_failure')) {
        const bridgeList = areaResources['scout_ship_bridge'];
        const areaO2 = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_o2') : null;
        if (!areaO2 || areaO2.amount <= 0) {
            if (currentResource.amount > 0) {
                totalConsumption += UNIFORM_O2_DRAIN_PER_MIN;
                consumptionSources.push({ rate: UNIFORM_O2_DRAIN_PER_MIN, label: t('res_oxygen_desc') });
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

    // Show any area resources that were loaded from a saved game
    updateAreaResourcesUI();

    // Mobile compact vitals orbs — rendered into #infoPanel (outside infoPanelContent)
    const infoPanel = document.getElementById('infoPanel');
    if (infoPanel) setupInfoVitals(infoPanel);
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
        // Oxygen drain rate is passive (not driven by _activeDrainRates) — always show if non-zero
        const isOxygen = (resource.name === 'Oxygen');
        if (!_activeDrainRates && !isOxygen) {
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
        progressBar.classList.remove('bar-stamina', 'bar-food', 'bar-water', 'bar-health', 'bar-oxygen');
        if (/stamina/i.test(rn)) progressBar.classList.add('bar-stamina');
        else if (/food/i.test(rn)) progressBar.classList.add('bar-food');
        else if (/water/i.test(rn)) progressBar.classList.add('bar-water');
        else if (/health/i.test(rn)) progressBar.classList.add('bar-health');
        else if (/oxygen/i.test(rn)) progressBar.classList.add('bar-oxygen');

        infoRow.classList.toggle('capped', isCapped);
    });

    updateResourceCategoryVisibility(document.getElementById('infoPanelContent') || document);

    // Update mobile compact vitals orbs and effects strip
    updateInfoVitals();
    updateAreaVitals();
    // updateEffectsStrip() is now called from addEffect/removeEffect/clearAllEffects
    // in engine/effects.js — no need to poll it 10×/s from game loop
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
    
    // Clear completed/one-time flags from all registered location actions (synchronous)
    try {
        const allLocations = getAllLocations();
        Object.values(allLocations).forEach(loc => {
            if (loc && Array.isArray(loc.actions)) {
                loc.actions.forEach(action => {
                    delete action._completed;
                    delete action._repeatCount;
                });
            }
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
            addLogEntry(t('log_effect_added', { effect: t('effect_hungry_name') }), LogType.ERROR);
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
            addLogEntry(t('log_effect_added', { effect: t('effect_thirsty_name') }), LogType.ERROR);
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
            addLogEntry(t('log_effect_added', { effect: t('effect_exhausted_name') }), LogType.ERROR);
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
function handleDeathAndLoop(opts = {}) {
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

    addLogEntry(t('log_death'), LogType.ERROR);

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
    let pages = (pagesText || '').split('\n\n').filter(p => p.trim());

    // If this was a manual reset and the player hasn't seen the manual-reset
    // flavour page yet, append it once — then mark it seen forever.
    if (opts.isManual) {
        if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = {};
        if (!gameFlags.loopKnowledge._manualResetSeen) {
            gameFlags.loopKnowledge._manualResetSeen = true;
            // Persist immediately so it survives reloads
            try {
                const state = JSON.parse(localStorage.getItem('gameState') || '{}');
                if (!state.gameFlags) state.gameFlags = {};
                if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
                state.gameFlags.loopKnowledge._manualResetSeen = true;
                localStorage.setItem('gameState', JSON.stringify(state));
            } catch { /* ignore */ }
            const extraPage = t('death_pages_manual_reset');
            if (extraPage) pages.push(extraPage);
        }
    }

    // Reset per-loop game flags (single source of truth: INITIAL_PER_LOOP_FLAGS)
    resetPerLoopFlags();

    // Clear all survival effects for the fresh loop
    clearAllEffects();

    // Reset resources and character inventory to full defaults
    resetResources();
    resetCharacterState();

    // Reset area resources and hide the area supplies panel
    for (const key of Object.keys(areaResources)) {
        delete areaResources[key];
    }
    _revealedAreaLocations.clear();
    // Re-initialize bridge area resources so fuel drain begins counting down again
    initAreaResources('scout_ship_bridge');
    if (_areaSectionHost) {
        _areaSectionHost.classList.add('hidden');
    }

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
                                addLogEntry(t('log_auto_drink', { amount: def.consumable.amount }), LogType.INFO);
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
                                addLogEntry(t('log_auto_eat', { amount: def.consumable.amount }), LogType.INFO);
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

// Low resource warning cooldowns — timestamp-based, no persistent flags needed
const WARNING_COOLDOWN_MS = 60000; // 1 minute between repeated warnings
const LOW_RESOURCE_THRESHOLD = 0.25; // warn below 25%
let _lastWaterWarning = 0;
let _lastFoodWarning = 0;
let _lastStaminaWarning = 0;

/** Smart low-resource warnings with inventory context. Uses timestamp cooldown. */
function syncLowResourceWarnings() {
    const now = Date.now();

    // --- Drinking Water ---
    const water = getResourceByName('Drinking Water');
    if (water && water.capacity > 0 && water.amount > 0
        && water.amount < water.capacity * LOW_RESOURCE_THRESHOLD
        && now - _lastWaterWarning > WARNING_COOLDOWN_MS) {
        _lastWaterWarning = now;
        const hasWater = countItemInBag('bottled_water') > 0;
        const autoOn = getAutoConsumeSettings()['bottled_water'];
        if (hasWater && !autoOn) {
            addLogEntry(t('log_water_low_has_auto_hint'), LogType.WARNING);
        } else if (hasWater) {
            addLogEntry(t('log_water_low_has'), LogType.WARNING);
        } else {
            addLogEntry(t('log_water_low_none'), LogType.WARNING);
        }
    }

    // --- Food Rations ---
    const food = getResourceByName('Food Rations');
    if (food && food.capacity > 0 && food.amount > 0
        && food.amount < food.capacity * LOW_RESOURCE_THRESHOLD
        && now - _lastFoodWarning > WARNING_COOLDOWN_MS) {
        _lastFoodWarning = now;
        const hasFood = countItemInBag('packaged_food') > 0;
        const autoOn = getAutoConsumeSettings()['packaged_food'];
        if (hasFood && !autoOn) {
            addLogEntry(t('log_food_low_has_auto_hint'), LogType.WARNING);
        } else if (hasFood) {
            addLogEntry(t('log_food_low_has'), LogType.WARNING);
        } else {
            addLogEntry(t('log_food_low_none'), LogType.WARNING);
        }
    }

    // --- Stamina ---
    const stamina = getResourceByName('Stamina');
    if (stamina && stamina.capacity > 0 && stamina.amount > 0
        && stamina.amount < stamina.capacity * LOW_RESOURCE_THRESHOLD
        && now - _lastStaminaWarning > WARNING_COOLDOWN_MS) {
        _lastStaminaWarning = now;
        addLogEntry(t('log_stamina_low'), LogType.WARNING);
    }
}

export function applyTimePassiveDrain(realSeconds) {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;

    // First, compute the per-minute base rates for each resource.
    // This combines passive rates + active drain rates from running actions + effect drains.
    const effectDrains = getEffectDrains();
    const perMinRates = {};
    resources.forEach(res => {
        let perMinRate = PASSIVE_PER_MIN[res.name] || 0;

        // Active drain rates from running actions
        if (_activeDrainRates && _activeDrainRates[res.name] !== undefined) {
            perMinRate += Number(_activeDrainRates[res.name]);
        }

        // Static effect drains (only applied when action is running)
        if (_activeDrainRates && effectDrains[res.name]) {
            // Cascade: if Stamina is depleted and effect drains Stamina, redirect to Health
            if (res.name === 'Stamina' && res.amount <= 0) {
                // Don't apply stamina drain; will be redirected to health
            } else if (res.name === 'Health') {
                // Redirect Stamina-targeted effect debuffs to Health if stamina is depleted
                if (effectDrains['Stamina']) {
                    const stamina = getResourceByName('Stamina');
                    if (stamina && stamina.amount <= 0) {
                        perMinRate -= Math.abs(effectDrains['Stamina']);
                    }
                }
                // Also redirect the action's own active Stamina drain rate to Health
                if (_activeDrainRates && _activeDrainRates['Stamina']) {
                    const stamina = getResourceByName('Stamina');
                    if (stamina && stamina.amount <= 0) {
                        perMinRate -= Math.abs(_activeDrainRates['Stamina']);
                    }
                }
                perMinRate += effectDrains[res.name];
            } else {
                perMinRate += effectDrains[res.name];
            }
        }

        perMinRates[res.name] = perMinRate;
    });

    // Apply the delta for the passed time
    resources.forEach(res => {
        const perMinRate = perMinRates[res.name] || 0;
        if (perMinRate === 0) return;
        if (res.name === 'Oxygen') return; // Oxygen handled separately above
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
    
    // --- Area resource passive drains (ship fuel → O2 cascade) ---
    // Ship fuel drains over time (~1 unit per second)
    const FUEL_DRAIN_PER_MIN = gameFlags.reactorOptimized ? 1.20 : 1.80;
    const O2_DRAIN_PER_MIN = 4; // O2 drains slower than fuel

    const bridgeList = areaResources['scout_ship_bridge'];
    let fuel = null;
    let o2 = null;
    if (bridgeList && Array.isArray(bridgeList)) {
        fuel = bridgeList.find(r => r.name === 'area_fuel');
        o2 = bridgeList.find(r => r.name === 'area_o2');

        // Drain ship fuel
        if (fuel && fuel.amount > 0) {
            const fuelDelta = (FUEL_DRAIN_PER_MIN * realSeconds);
            fuel.amount = Math.max(0, fuel.amount - fuelDelta);

            // Fuel just ran out
            if (fuel.amount <= 0) {
                fuel.amount = 0;
                if (!hasEffect('life_support_failure')) {
                    addEffect({ ...EFFECT_LIFE_SUPPORT_FAILURE });
                    addLogEntry(t('log_fuel_depleted'), LogType.ERROR);
                    addLogEntry(t('log_effect_added', { effect: t('effect_life_support_failure_name') }), LogType.ERROR);
                    // Uniform hint — only if player doesn't already have it
                    if (!gameFlags.uniformGrabbed) {
                        if (gameFlags.uniformNoticed) {
                            addLogEntry(t('log_lifesupport_uniform_hint_tried'), LogType.UNLOCK);
                        } else {
                            addLogEntry(t('log_lifesupport_uniform_hint_first'), LogType.UNLOCK);
                        }
                    }
                }
            }
        }

        // Drain area O2 first — only when life support failed
        if (o2 && hasEffect('life_support_failure') && o2.amount > 0) {
            const o2Delta = (O2_DRAIN_PER_MIN * realSeconds);
            o2.amount = Math.max(0, o2.amount - o2Delta);

            // Area O2 just ran out — cascade to personal or health
            if (o2.amount <= 0) {
                o2.amount = 0;
                // Check if uniform provides personal oxygen
                const oxygenRes = getResourceByName('Oxygen');
                if (oxygenRes && oxygenRes.capacity > 0 && oxygenRes.amount > 0) {
                    // Uniform protects — hide oxygen_depleted effect, drain personal O2 instead
                    if (hasEffect('oxygen_depleted')) {
                        removeEffect('oxygen_depleted');
                        addLogEntry(t('log_effect_removed', { effect: t('effect_oxygen_depleted_name') }), LogType.ERROR);
                    }
                } else {
                    // No personal O2 — health drains via oxygen_depleted effect
                    if (!hasEffect('oxygen_depleted')) {
                        addEffect({ ...EFFECT_OXYGEN_DEPLETED });
                        addLogEntry(t('log_o2_depleted'), LogType.ERROR);
                        addLogEntry(t('log_effect_added', { effect: t('effect_oxygen_depleted_name') }), LogType.ERROR);
                    }
                }
            }
        }

        // Drain personal O2 when life support failed and area O2 is empty
        if (hasEffect('life_support_failure') && o2 && o2.amount <= 0) {
            const oxygenRes = getResourceByName('Oxygen');
            if (oxygenRes && oxygenRes.capacity > 0 && oxygenRes.amount > 0) {
                const o2DrainRate = -(UNIFORM_O2_DRAIN_PER_MIN);
                const o2Delta = parseFloat((o2DrainRate * realSeconds).toFixed(10));
                oxygenRes.amount = parseFloat(Math.max(0, Math.min(oxygenRes.capacity, oxygenRes.amount + o2Delta)).toFixed(10));
                characterState.uniformOxygen = oxygenRes.amount;
                // Personal O2 just ran out — reinstate oxygen_depleted effect
                if (oxygenRes.amount <= 0) {
                    oxygenRes.amount = 0;
                    characterState.uniformOxygen = 0;
                    addLogEntry(t('log_personal_o2_depleted'), LogType.ERROR);
                    if (!hasEffect('oxygen_depleted')) {
                        addEffect({ ...EFFECT_OXYGEN_DEPLETED });
                        addLogEntry(t('log_effect_added', { effect: t('effect_oxygen_depleted_name') }), LogType.ERROR);
                    }
                }
            }
        }
    }

    // --- Area resource passive regeneration (recycler fixed → water regen) ---
    if (gameFlags.recyclerFixed) {
        const mainList = areaResources['scout_ship_main_area'];
        if (mainList && Array.isArray(mainList)) {
            const areaWater = mainList.find(r => r.name === 'area_water');
            if (areaWater) {
                const regenDelta = (0.50 * realSeconds);
                areaWater.amount = Math.min(areaWater.capacity, areaWater.amount + regenDelta);
            }
        }
    }

    // Set area drain rates for passive fuel/O2 drain display
    const areaRates = {};
    if (fuel && fuel.amount > 0) areaRates['area_fuel'] = `-${FUEL_DRAIN_PER_MIN.toFixed(2)}/min`;
    if (o2 && hasEffect('life_support_failure') && o2.amount > 0) areaRates['area_o2'] = '-4.00/min';
    if (gameFlags.recyclerFixed) areaRates['area_water'] = '+0.50/min';
    setActiveAreaDrainRates(Object.keys(areaRates).length > 0 ? areaRates : null);

    // Low resource warnings with smart context (cooldown-based, no flag spam)
    syncLowResourceWarnings();

    // Sync survival effects based on current resource levels
    syncSurvivalEffects();

    // Check for death
    const health = getResourceByName('Health');
    if (health && health.amount <= 0) {
        health.amount = 0;
        handleDeathAndLoop();
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

/**
 * Manually trigger a loop reset (End Loop button).
 * Sets health to 0 and invokes the standard death-and-loop handler.
 */
export function triggerManualLoopReset() {
    const health = getResourceByName('Health');
    if (health) {
        health.amount = 0;
    }
    // Dispatch force-cancel so any running action is stopped first
    try { window.dispatchEvent(new CustomEvent('force-cancel-action')); } catch { /* ignore */ }
    handleDeathAndLoop({ isManual: true });
}
