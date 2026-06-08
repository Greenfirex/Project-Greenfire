import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';

export function getInitialResources() {
    return [
        { name: 'Health', amount: 65, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Stamina', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Food Rations', amount: 50, isDiscovered: true, capacity: 10, producible: false, integer: true },
        { name: 'Drinking Water', amount: 50, isDiscovered: true, capacity: 10, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

const RESOURCE_CATEGORIES = {
    'Health': 'Essential',
    'Stamina': 'Essential',
    'Food Rations': 'Essential',
    'Drinking Water': 'Essential',
};

function getResourceCategoryName(resourceName) {
    return RESOURCE_CATEGORIES[resourceName] || 'Other';
}

function buildResourceTooltipHtml(resourceName) {
    const name = String(resourceName || '');
    const currentResource = resources.find(r => r.name === name);
    if (!currentResource) return `<h4>${name}</h4><p>No data available.</p>`;

    const rates = computeResourceRates(name);
    if (!rates) return `<h4>${name}</h4><p>No data available.</p>`;

    const { totalProduction, totalConsumption, netPerSecond } = rates;

    const res = resources.find(r => r && r.name === name);
    const amt = res ? (res.integer ? Math.floor(Number(res.amount) || 0) : (Number(res.amount) || 0)) : 0;
    const cap = res ? (res.integer ? Math.floor(Number(res.capacity) || 0) : (Number(res.capacity) || 0)) : 0;

    let description = '';
    if (name === 'Health') description = 'Your physical condition. Passively regenerates over time.';
    if (name === 'Stamina') description = 'Your endurance. Passively regenerates over time.';
    if (name === 'Food Rations') description = 'Personal rations carried while exploring. Depletion causes Hunger penalties.';
    if (name === 'Drinking Water') description = 'Personal water carried while exploring. Depletion causes Thirst penalties.';

    const sign = netPerSecond >= 0 ? '+' : '';
    const regenLabel = (name === 'Health' || name === 'Stamina') ? 'Regeneration' : 'Gains';
    const drainLabel = (name === 'Health' || name === 'Stamina') ? 'Drain' : 'Usage';

    let productionHtml = '';
    if (totalProduction > 0) {
        productionHtml = `<p class="tooltip-detail">+ ${formatNumber(totalProduction)}/s passive</p>`;
    }
    let consumptionHtml = '';
    if (totalConsumption > 0) {
        consumptionHtml = `<p class="tooltip-detail">- ${formatNumber(totalConsumption)}/s active</p>`;
    }

    return `
        <h4>${name}</h4>
        <p class="tooltip-description">${description}</p>
        <div class="tooltip-section">
            <p>Current: <strong>${amt}${cap > 0 ? `/${cap}` : ''}</strong></p>
        </div>
        <div class="tooltip-section">
            <p>${regenLabel}: +<span class="tooltip-amount-produces">${formatNumber(totalProduction)}</span>/s</p>
            ${productionHtml}
        </div>
        <div class="tooltip-section">
            <p>${drainLabel}: -<span class="tooltip-amount-consumes">${formatNumber(totalConsumption)}</span>/s</p>
            ${consumptionHtml}
        </div>
        <hr>
        <p><strong>Net Change: ${sign}${formatNumber(netPerSecond)}/s</strong></p>
    `;
}

export function computeResourceRates(resourceName) {
    const currentResource = resources.find(r => r.name === resourceName);
    if (!currentResource) return null;

    let totalProduction = 0;
    let totalConsumption = 0;

    // Passive regeneration
    if (resourceName === 'Stamina') {
        totalProduction += 0.2;
    }
    if (resourceName === 'Health') {
        totalProduction += 0.1;
    }

    const netPerSecond = totalProduction - totalConsumption;

    return {
        resource: currentResource,
        totalProduction,
        totalConsumption,
        netPerSecond,
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

        infoRow.innerHTML = `
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1"><span>${resource.name}</span></div>
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

        const { netPerSecond } = rates;
        const isCapped = (resource.capacity > 0) ? (resource.amount >= resource.capacity) : false;
        generationEl.classList.toggle('negative-rate', netPerSecond < 0 && !isCapped);

        const EPS = 1e-9;
        if (Math.abs(netPerSecond) > EPS) {
            const sign = netPerSecond >= 0 ? '+' : '-';
            const value = formatNumber(Math.abs(netPerSecond));
            generationEl.textContent = `${sign}${value}/s`;
        } else {
            generationEl.textContent = '';
        }

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;

        infoRow.classList.toggle('capped', isCapped);
    });

    updateResourceCategoryVisibility(document.getElementById('infoPanelContent') || document);
}

// Stub exports needed by tooltip.js (recovery/channeled action systems moved to backup)
export function getRecoveryActionRegenBonusesPerSec(actionId) {
    return null;
}

export function getChanneledActionYieldBonusesPerSec(actionId) {
    return null;
}

export function getResourceTooltipHtml(resourceName) {
    try { return buildResourceTooltipHtml(resourceName); } catch { return `<h4>${String(resourceName || '')}</h4>`; }
}