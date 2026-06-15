import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { t } from '../locales/locales.js';

const RESOURCE_LOCALE_KEYS = {
    'Health': 'res_health',
    'Stamina': 'res_stamina',
    'XP': 'res_xp',
    'Food Rations': 'res_food',
    'Drinking Water': 'res_water',
};

const RESOURCE_DESC_KEYS = {
    'Health': 'res_health_desc',
    'Stamina': 'res_stamina_desc',
    'Food Rations': 'res_food_desc',
    'Drinking Water': 'res_water_desc',
};

export function getInitialResources() {
    return [
        { name: 'Health', amount: 65, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Stamina', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Food Rations', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
        { name: 'Drinking Water', amount: 25, isDiscovered: true, capacity: 25, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

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
    const cat = RESOURCE_CATEGORIES[resourceName] || 'Other';
    return t('res_category_' + cat.toLowerCase()) || cat;
}

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
        totalProduction += 0.1;
        productionSources.push({ rate: 0.1, label: t('res_health_desc') });
    }
    if (resourceName === 'Food Rations') {
        totalConsumption += 0.1;
        consumptionSources.push({ rate: 0.1, label: t('res_food_desc') });
    }
    if (resourceName === 'Drinking Water') {
        totalConsumption += 0.1;
        consumptionSources.push({ rate: 0.1, label: t('res_water_desc') });
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
    initial.forEach(res => resources.push({...res}));
}

export function setupInfoPanel() {
    const infoPanelContent = document.getElementById('infoPanelContent');
    if (!infoPanelContent) return;
    infoPanelContent.innerHTML = '';

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
        header.textContent = cat.title;

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

        const displayName = t(RESOURCE_LOCALE_KEYS[resource.name] || resource.name);
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

    infoPanelContent.appendChild(infoSection);
    updateResourceCategoryVisibility(infoPanelContent);
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
        const amountDisplay = resource.integer ? Math.floor(resource.amount).toLocaleString() : formatNumber(resource.amount);
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
        if (Math.abs(netPerMinute) > EPS) {
            const sign = netPerMinute >= 0 ? '+' : '-';
            const value = formatNumber(Math.abs(netPerMinute));
            generationEl.textContent = `${sign}${value}/min`;
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

/**
 * Apply passive resource changes driven by time passing,
 * including active drain rates from ongoing actions.
 * @param {number} realSeconds — amount of real time that passed
 */
export function applyTimePassiveDrain(realSeconds) {
    if (!Number.isFinite(realSeconds) || realSeconds <= 0) return;

    // Per-minute rates for Food, Water, Health
    resources.forEach(res => {
        let perMinRate = 0;
        if (res.name === 'Food Rations') perMinRate = -0.1;
        else if (res.name === 'Drinking Water') perMinRate = -0.1;
        else if (res.name === 'Health') perMinRate = 0.1;

        // Also apply active drain rates (Stamina from actions)
        if (_activeDrainRates && _activeDrainRates[res.name] !== undefined) {
            perMinRate += Number(_activeDrainRates[res.name]);
        }

        if (perMinRate === 0) return;
        const delta = perMinRate * realSeconds;
        if (delta === 0) return;
        res.amount = Math.max(0, Math.min(res.capacity, res.amount + delta));
    });
}