import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { jobs } from './data/jobs.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from './tooltip.js';
import { getActiveCrashSiteAction } from './data/activeActions.js';

export function getInitialResources() {
    return [
        { name: 'Energy', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Survivors', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true },
        { name: 'Food Rations', amount: 85, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.05 },
        { name: 'Clean Water', amount: 60, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.1 },
        { name: 'Scrap Metal', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Ship Components', amount: 0, isDiscovered: false, capacity: 50, producible: false, integer: true },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Stone', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: false },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25, producible: true, integer: false },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10, producible: true, integer: false },
        { name: 'Crude Prybar', amount: 0, isDiscovered: false, capacity: 5, producible: false, integer: true },
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

    // --- Production Calculation (buildings + jobs) ---
    let baseProduction = 0;
    const productionBuildings = [];
    buildings.forEach(b => {
        if (b.produces === resourceName && b.count > 0) {
            const amount = b.rate * b.count;
            baseProduction += amount;
            productionBuildings.push({ name: b.name, count: b.count, amount: amount });
        }
    });

    let jobContribution = 0;
    const jobLines = [];
    if (Array.isArray(jobs)) {
        jobs.forEach(job => {
            if (job.produces === resourceName && job.assigned > 0 && job.rate) {
                const amt = job.rate * job.assigned;
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
            activeDrainRate = drainInfo.amount / Math.max(0.0001, (activeAction.duration || 1));
        }
    }
    const totalConsumption = passiveConsumption + activeDrainRate;

    const netPerSecond = totalProduction - totalConsumption;

    return {
        resource: currentResource,
        totalProduction,
        totalConsumption,
        netPerSecond,
        productionBuildings,
        jobLines,
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

            const { totalProduction, totalConsumption, netPerSecond, productionBuildings, jobLines, passiveConsumption, activeDrainRate } = rates;

            const productionHtml = [];
            if (productionBuildings.length) {
                productionBuildings.forEach(b => productionHtml.push(`<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`));
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

        if (resource.producible || totalConsumption > 0 || activeDrainRate > 0) {
            const sign = netPerSecond >= 0 ? '+' : '';
            if (totalConsumption > 0 && !resource.producible) {
                generationEl.textContent = `(${formatNumber(netPerSecond)}/s)`;
            } else {
                generationEl.textContent = `${sign}${formatNumber(netPerSecond)}/s`;
            }
        } else {
            generationEl.textContent = '';
        }

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;

        infoRow.classList.toggle('capped', resource.amount >= resource.capacity);
    });
}