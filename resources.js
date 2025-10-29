import { technologies } from './data/technologies.js';
import { jobs, getEffectiveJobRate } from './data/jobs.js';
import { buildings } from './data/buildings.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from './tooltip.js';
import { getActiveCrashSiteAction } from './data/activeActions.js';

export function getInitialResources() {
    return [
        { name: 'Energy', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Survivors', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true },
        { name: 'Food Rations', amount: 85, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.05 },
        { name: 'Clean Water', amount: 60, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.06 },
        { name: 'Scrap Metal', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Ship Components', amount: 0, isDiscovered: false, capacity: 50, producible: false, integer: true },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Stone', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: false },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25, producible: true, integer: false },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10, producible: true, integer: false },
        { name: 'Crude Prybar', amount: 0, isDiscovered: false, capacity: 5, producible: false, integer: true },
        { name: 'Fabric', amount: 0, isDiscovered: false, capacity: 100, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

export function computeResourceRates(resourceName) {
    const currentResource = resources.find(r => r.name === resourceName);
    if (!currentResource) return null;

    // --- Get Active States ---
    const activeAction = getActiveCrashSiteAction();
    const survivorResource = resources.find(r => r.name === 'Survivors');
    const survivorCount = survivorResource ? survivorResource.amount : 0;

    // --- Action debuff multiplier (match crashSite logic) ---
    // If food or water are depleted, actions take longer -> drain spreads over longer time.
    let actionDebuff = 1;
    const foodRes = resources.find(r => r.name === 'Food Rations');
    const waterRes = resources.find(r => r.name === 'Clean Water');
    if (foodRes && foodRes.amount <= 0) actionDebuff *= 1.5;
    if (waterRes && waterRes.amount <= 0) actionDebuff *= 1.5;

    // --- Production Calculation (buildings + jobs) ---
    // Collect buildings that actively produce this resource (either via `produces` or passive effect)
    let baseProduction = 0;
    const productionBuildings = [];
    buildings.forEach(b => {
        if (!b || b.count <= 0) return;
        // buildings that declare a direct `produces` value
        if (b.produces === resourceName) {
            const amount = (b.rate || 0) * b.count;
            baseProduction += amount;
            productionBuildings.push({ name: b.name, count: b.count, amount: amount });
        }
        // buildings that provide a passive effect for this resource
        if (b.effect && b.effect.type === 'passive' && b.effect.resource === resourceName) {
            const amount = (b.effect.rate || 0) * b.count;
            // treat passive contributions as production for tooltip/total calculations
            baseProduction += amount;
            productionBuildings.push({ name: b.name + ' (passive)', count: b.count, amount: amount });
        }
    });

    let jobContribution = 0;
    const jobLines = [];
    if (Array.isArray(jobs)) {
        jobs.forEach(job => {
            if (job.produces === resourceName && job.assigned > 0 && job.rate) {
                const amt = getEffectiveJobRate(job) * job.assigned;
                jobContribution += amt;
                jobLines.push({ name: job.name, assigned: job.assigned, amount: amt });
            }
        });
    }

    let bonusMultiplier = 0;
    technologies.forEach(t => {
        if (t.isResearched && t.bonus?.resource === resourceName) {
            bonusMultiplier += t.bonus.multiplier;
        }
    });

    const totalProduction = (baseProduction + jobContribution) * (1 + bonusMultiplier);

    // --- Consumption & Drain Calculation ---
    const passiveConsumption = currentResource.baseConsumption ? currentResource.baseConsumption * survivorCount : 0;
    let activeDrainRate = 0;
    if (activeAction && activeAction.drain) {
        const drainInfo = activeAction.drain.find(d => d.resource === resourceName);
        if (drainInfo) {
            // spread the drain across the effective duration (accounting for hunger/thirst debuff)
            const effectiveDuration = Math.max(0.0001, (activeAction.duration || 1) * actionDebuff);
            activeDrainRate = drainInfo.amount / effectiveDuration;
        }
    }
    const totalConsumption = passiveConsumption + activeDrainRate;

    // (building passive effects were already included above in `baseProduction`)
    const netPerSecond = totalProduction - totalConsumption;

    // produce a structured bonuses array so tooltips can display what contributed
    const bonuses = technologies.filter(t => t.isResearched && t.bonus?.resource === resourceName)
        .map(t => ({ name: t.name || t.id || 'Technology', multiplier: t.bonus.multiplier }));

    return {
        resource: currentResource,
        // base building production (includes passive building effects)
        base: baseProduction,
        // buildings array for detailed breakdown
        buildings: productionBuildings,
        // job contribution lines and total
        jobLines,
        jobContribution,
        // bonuses data
        bonusMultiplier: bonusMultiplier,
        bonuses,
        totalProduction,
        totalConsumption,
        netPerSecond,
        passiveConsumption,
        activeDrainRate,
    };
}

export function resetResources() {
    const initial = getInitialResources();
    resources.length = 0;
    initial.forEach(res => resources.push({...res}));
}

export function setupInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    if (!infoPanel) return;
    infoPanel.innerHTML = '';

    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

    // iterate over the master initial set so undiscovered resources still have rows
    getInitialResources().forEach(resource => {
        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        infoRow.dataset.resource = resource.name;
        infoRow.classList.add('hidden');
        infoRow.classList.toggle('non-producible', !resource.producible);

        if (resource.name === 'Insight') {
            infoRow.classList.add('insight-resource');
        }

        infoRow.innerHTML = `
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1"><span>${resource.name}</span></div>
            <div class="infocolumn2"><p data-value-type="storage"></p></div>
            <div class="infocolumn3"><p data-value-type="generation"></p></div>
        `;

        // register the row with the shared tooltip system.
        setupTooltip(infoRow, () => {
            const resourceName = infoRow.dataset.resource;
            const rates = computeResourceRates(resourceName);
            if (!rates) return `<h4>${resourceName}</h4><p>No data available.</p>`;

            const { totalProduction, totalConsumption, netPerSecond, buildings, jobLines, passiveConsumption, activeDrainRate } = rates;

            const productionHtml = [];
            if (buildings && buildings.length) {
                buildings.forEach(b => productionHtml.push(`<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`));
            }
            if (jobLines.length) {
                jobLines.forEach(j => productionHtml.push(`<p class="tooltip-detail">+ ${formatNumber(j.amount)}/s from ${j.assigned}x ${j.name}</p>`));
            }

            let consumptionDetailsHtml = '';
            if (passiveConsumption > 0) {
                consumptionDetailsHtml += `<p class="tooltip-detail">-${formatNumber(passiveConsumption)}/s from ${resources.find(r=>r.name==='Survivors')?.amount || 0} survivor(s)</p>`;
            }
            if (activeDrainRate > 0) {
                const activeAction = getActiveCrashSiteAction();
                consumptionDetailsHtml += `<p class="tooltip-detail">-${formatNumber(activeDrainRate)}/s from ${activeAction ? activeAction.name : 'active event'}</p>`;
            }

            const sign = netPerSecond >= 0 ? '+' : '';

            return `
                <h4>${resourceName} Details</h4>
                <div class="tooltip-section">
                    <p>Production: +${formatNumber(totalProduction)}/s</p>
                    ${productionHtml.join('')}
                </div>
                <div class="tooltip-section">
                    <p>Consumption: -${formatNumber(totalConsumption)}/s</p>
                    ${consumptionDetailsHtml}
                </div>
                <hr>
                <p><strong>Net Change: ${sign}${formatNumber(netPerSecond)}/s</strong></p>
            `;
        });

        infoSection.appendChild(infoRow);
    });

    infoPanel.appendChild(infoSection);
}

export function updateResourceInfo() {
    const survivorResource = resources.find(r => r.name === 'Survivors');
    const survivorCount = survivorResource ? survivorResource.amount : 0;
    const activeAction = getActiveCrashSiteAction();

    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        // reveal any resource that has a positive amount
        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
            // notify other systems that a resource was discovered (e.g. colony can unlock upgrades)
            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                try {
                    window.dispatchEvent(new CustomEvent('resourceDiscovered', { detail: { name: resource.name } }));
                } catch (e) { /* ignore in non-browser env */ }
            }
        }

        infoRow.classList.toggle('hidden', !resource.isDiscovered);
        if (!resource.isDiscovered) return;

        infoRow.classList.toggle('non-producible', !resource.producible);

        const generationEl = infoRow.querySelector('[data-value-type="generation"]');
        const storageEl = infoRow.querySelector('[data-value-type="storage"]');
        const nameEl = infoRow.querySelector('.infocolumn1 span');

        const isZero = resource.amount <= 0;
        storageEl.classList.toggle('zero-amount', isZero);
        nameEl.classList.toggle('zero-amount', isZero);

        const amountDisplay = resource.integer ? Math.floor(resource.amount).toLocaleString() : formatNumber(resource.amount);
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();
        storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;

        const rates = computeResourceRates(resource.name);
        if (!rates) return;

        const { totalProduction, totalConsumption, netPerSecond, activeDrainRate } = rates;

        generationEl.classList.toggle('negative-rate', netPerSecond < 0);

        // Only show generation when there is an actual non-zero production or consumption.
        // Use a small EPS to avoid floating point noise. Always display a clear sign (+/-)
        // for consistency across resources (no parentheses).
        const EPS = 1e-9;
        if (Math.abs(totalProduction) > EPS || Math.abs(totalConsumption) > EPS || Math.abs(activeDrainRate) > EPS) {
            const sign = netPerSecond >= 0 ? '+' : '';
            const value = formatNumber(Math.abs(netPerSecond));
            generationEl.textContent = `${sign}${value}/s`;
        } else {
            generationEl.textContent = '';
        }

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;

        infoRow.classList.toggle('capped', resource.amount >= resource.capacity);
    });
}