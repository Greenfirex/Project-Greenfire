import { technologies } from '../data/definitions/technologies.js';
import { jobs, getEffectiveJobRate } from '../data/jobsManager.js';
import { buildings } from '../data/definitions/buildings.js';
import { gameFlags } from '../data/gameFlags.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { getActiveCrashSiteAction } from '../data/activeActions.js';
import { getMorale } from '../data/morale.js';
import { updateXPMeter } from '../ui/footer.js';

export function getInitialResources() {
    return [
    { name: 'Stamina', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        // Meta progression resource (hidden from info panel)
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Survivors', amount: 0, isDiscovered: false, capacity: 20, producible: false, integer: true },
        { name: 'Food Rations', amount: 50, isDiscovered: true, capacity: 50, producible: false, integer: true, baseConsumption: 0.04 },
        { name: 'Clean Water', amount: 50, isDiscovered: true, capacity: 50, producible: false, integer: true, baseConsumption: 0.06 },
        { name: 'Scrap Metal', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Wire', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Crude Prybar', amount: 0, isDiscovered: false, capacity: 5, producible: false, integer: true },
        { name: 'Fabric', amount: 0, isDiscovered: false, capacity: 100, producible: false, integer: true },
        { name: 'Chemicals', amount: 0, isDiscovered: false, capacity: 50, producible: false, integer: true },
        { name: 'Makeshift Explosive', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true },
        { name: 'Power Cells', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Crystal', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: false },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25, producible: true, integer: false },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10, producible: true, integer: false },
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
            productionBuildings.push({ name: b.name, count: b.count, amount: amount });
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

    // Purification Unit provides a global bonus to Clean Water production and collection
    try {
        if (resourceName === 'Clean Water' && gameFlags && gameFlags.purificationUnitInstalled) {
            bonusMultiplier += 0.20;
        }
    } catch (e) { /* ignore */ }

    let totalProduction = (baseProduction + jobContribution) * (1 + bonusMultiplier);

    // Apply debug multiplier (excluding Survivors) for playtesting gains
    try {
        if (typeof window !== 'undefined' && window.DEBUG_RESOURCE_GAIN === 10 && resourceName !== 'Survivors') {
            totalProduction *= 10;
        }
    } catch (e) { /* ignore */ }

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

    // Add Purification Unit as a visible bonus entry when active
    try {
        if (resourceName === 'Clean Water' && gameFlags && gameFlags.purificationUnitInstalled) {
            bonuses.push({ name: 'Purification Unit', multiplier: 0.2 });
        }
    } catch (e) { /* ignore */ }

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
    const infoPanelContent = document.getElementById('infoPanelContent');
    if (!infoPanelContent) return;
    infoPanelContent.innerHTML = '';

    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

    // --- Insert Morale row at the top ---
    const moraleRow = document.createElement('div');
    moraleRow.className = 'info-row morale';
    moraleRow.dataset.resource = 'Morale';
    moraleRow.classList.remove('hidden');
    moraleRow.innerHTML = `
        <div class="resource-progress-bar"></div>
        <div class="infocolumn1"><span>Morale</span></div>
        <div class="infocolumn2"><p data-value-type="morale"></p></div>
        <div class="infocolumn3"><p></p></div>
    `;

    // Tooltip for Morale breakdown
    setupTooltip(moraleRow, () => {
        const m = getMorale();
        const list = (m.sources || []).map(s => {
            const sign = s.deltaPercent >= 0 ? '+' : '-';
                const hint = (typeof s.remainingDays === 'number' && s.remainingDays > 0)
                    ? ` <span class="tooltip-detail">(~${s.remainingDays} days left)</span>`
                    : '';
                return `<li class="bonus-item">${s.label}: ${sign}${Math.abs(s.deltaPercent)}%${hint}</li>`;
        }).join('');
        const modifiers = list ? `<ul class="tooltip-bonuses">${list}</ul>` : '<p>No active modifiers.</p>';
        return `
            <h4>Morale</h4>
                <p>Current: <strong>${Math.round(m.percent)}%</strong></p>
            <div class="tooltip-section"><h4>Sources</h4>${modifiers}</div>
            
        `;
    });
    infoSection.appendChild(moraleRow);

    // iterate over the master initial set so undiscovered resources still have rows
    getInitialResources().forEach(resource => {
        if (resource.hidden) return; // skip meta/hidden resources like XP
        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        infoRow.dataset.resource = resource.name;
        infoRow.classList.add('hidden');
        infoRow.classList.toggle('non-producible', !resource.producible);

        // Special styling hook for Survivors so we can position and style it differently
        if (resource.name === 'Survivors') {
            infoRow.classList.add('survivors');
        }

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
            
            // Special tooltip for Survivors/Crew Members showing job assignments
            if (resourceName === 'Survivors' || resourceName === 'Crew Members') {
                const currentResource = resources.find(r => r.name === resourceName);
                const total = currentResource ? Math.floor(currentResource.amount) : 0;
                const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
                const idle = Math.max(0, total - totalAssigned);
                
                const jobsList = [];
                // Always show Idle first
                jobsList.push(`<li class="bonus-item">Idle: ${idle}</li>`);
                
                jobs.filter(j => j.assigned > 0).forEach(j => {
                    jobsList.push(`<li class="bonus-item">${j.name}: ${j.assigned}</li>`);
                });
                
                const jobsSection = jobsList.length
                    ? `<div class="tooltip-section"><h4>Job Assignments</h4><ul class="tooltip-bonuses">${jobsList.join('')}</ul></div>`
                    : '<div class="tooltip-section"><p class="tooltip-detail">No jobs assigned</p></div>';
                
                return `
                    <h4>${resourceName}</h4>
                    <p>Total: <strong>${total}</strong></p>
                    <p>Assigned: <strong>${totalAssigned}</strong></p>
                    ${jobsSection}
                `;
            }
            
            // Standard resource tooltip
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
                // add a space after the '-' so it matches the '+ ' formatting used for production lines
                consumptionDetailsHtml += `<p class="tooltip-detail">- ${formatNumber(passiveConsumption)}/s from ${resources.find(r=>r.name==='Survivors')?.amount || 0} survivor(s)</p>`;
            }
            if (activeDrainRate > 0) {
                const activeAction = getActiveCrashSiteAction();
                // add a space after the '-' so it matches the '+ ' formatting used for production lines
                consumptionDetailsHtml += `<p class="tooltip-detail">- ${formatNumber(activeDrainRate)}/s from ${activeAction ? activeAction.name : 'active event'}</p>`;
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

    infoPanelContent.appendChild(infoSection);
}

export function updateResourceInfo() {
    const survivorResource = resources.find(r => r.name === 'Survivors');
    const survivorCount = survivorResource ? survivorResource.amount : 0;
    const activeAction = getActiveCrashSiteAction();

    // Update Morale row first
    try {
        const m = getMorale();
        const row = document.querySelector('.info-row.morale');
        if (row) {
            const valEl = row.querySelector('[data-value-type="morale"]');
            if (valEl) valEl.textContent = `${Math.round(m.percent)}%`;
            row.classList.remove('morale-high','morale-mid','morale-low');
            const pct = m.percent;
            const cls = (pct >= 100) ? 'morale-high' : (pct >= 80 ? 'morale-mid' : 'morale-low');
            row.classList.add(cls);
        }
    } catch {}

    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        // reveal any resource that has a positive amount
        // BUT prevent auto-discovery of Chapter 1-only resources in Chapter 2
        const chapter1OnlyResources = ['Stamina', 'Crude Prybar', 'Makeshift Explosive'];
        const isChapter2 = gameFlags.chapter === 2;
        const shouldPreventDiscovery = isChapter2 && chapter1OnlyResources.includes(resource.name);
        
        if (resource.amount > 0 && !resource.isDiscovered && !shouldPreventDiscovery) {
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

        // Determine "zero" based on the displayed numeric value to match UI rounding:
        const displayedAmountNum = resource.integer ? Math.floor(resource.amount) : Number(resource.amount);
        const isZero = !(isFinite(displayedAmountNum)) ? false : (displayedAmountNum <= 0);
        const amountDisplay = resource.integer ? Math.floor(resource.amount).toLocaleString() : formatNumber(resource.amount);
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();

        if (resource.name === 'Survivors' || resource.name === 'Crew Members') {
            // Survivors/Crew Members: show only the count (no capacity), and hide generation
            storageEl.textContent = `${amountDisplay}`;
            if (generationEl) generationEl.textContent = '';
        } else {
            storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;
        }

        // Toggle zero-amount consistently on the info row and its child elements so styles are removed when >0.
        storageEl.classList.toggle('zero-amount', isZero);
        nameEl.classList.toggle('zero-amount', isZero);
        infoRow.classList.toggle('zero-amount', isZero);

        const rates = computeResourceRates(resource.name);
        if (!rates) return;

    const { totalProduction, totalConsumption, netPerSecond, activeDrainRate } = rates;

    // compute capped state early so we can avoid showing negative styling when capped
    const isCapped = (resource.capacity > 0) ? (resource.amount >= resource.capacity) : false;

    // Only mark negative-rate visually when the resource is not capped. When capped
    // we don't want the UI to render amounts or per-second production in red.
    generationEl.classList.toggle('negative-rate', netPerSecond < 0 && !isCapped);

        // Only show generation when there is an actual non-zero production or consumption.
        // Use a small EPS to avoid floating point noise. Always display a clear sign (+/-)
        // for consistency across resources (no parentheses).
        const EPS = 1e-9;
        if (Math.abs(totalProduction) > EPS || Math.abs(totalConsumption) > EPS || Math.abs(activeDrainRate) > EPS) {
            // Always show explicit '+' for positive and '-' for negative to match formatting.
            const sign = netPerSecond >= 0 ? '+' : '-';
            const value = formatNumber(Math.abs(netPerSecond));
            generationEl.textContent = `${sign}${value}/s`;
        } else {
            generationEl.textContent = '';
        }

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        if (resource.name === 'Survivors' || resource.name === 'Crew Members') {
            // Survivors/Crew Members: keep bar visually full for emphasis of population band
            progressBar.style.width = '100%';
        } else {
            progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;
        }

    infoRow.classList.toggle('capped', isCapped);
    });

    // Update XP meter in footer
    updateXPMeter(resources);
}