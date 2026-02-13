import { technologies } from '../data/definitions/technologies.js';
import { jobs, getEffectiveJobRate } from '../data/jobsManager.js';
import { buildings } from '../data/definitions/buildings.js';
import { gameFlags } from '../data/gameFlags.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from '../ui/panels/tooltip.js';
import { getActiveCrashSiteAction } from '../data/activeActions.js';
import { getMorale } from '../data/morale.js';
import { characterState, computeCharacterStats } from '../data/character.js';
import { getTotalIngameMinutes } from './time.js';

const PERSONAL_SUPPLY_BASE_CAP = 10;

export function getInitialResources() {
    return [
        { name: 'Health', amount: 65, isDiscovered: true, capacity: 100, producible: false, integer: true },
        // Visible early-game (Chapter 1) in the info panel; hidden again in Chapter 2+.
        // Still used by action drains and character vitals.
        { name: 'Stamina', amount: 70, isDiscovered: true, capacity: 100, producible: false, integer: true },
        // Meta progression resource (hidden from info panel)
        { name: 'XP', amount: 0, isDiscovered: true, capacity: 9000000000, producible: false, integer: true, hidden: true },
        { name: 'Survivors', amount: 0, isDiscovered: false, capacity: 20, producible: false, integer: true },

        // Personal supplies (carried while exploring). Capacity is dynamic and can be increased by gear.
        { name: 'Food Rations', amount: 50, isDiscovered: true, capacity: PERSONAL_SUPPLY_BASE_CAP, producible: false, integer: true },
        { name: 'Drinking Water', amount: 50, isDiscovered: true, capacity: PERSONAL_SUPPLY_BASE_CAP, producible: false, integer: true },

        // Camp stockpiles (used for buildings/upgrades/crafting). Produced via jobs/buildings.
        { name: 'Provisions', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: true },
        { name: 'Water', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: true },

        { name: 'Metal Parts', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Wire', amount: 0, isDiscovered: false, capacity: 100, producible: false, integer: true },
        // Legacy: now an inventory item (kept hidden for save compatibility).
        { name: 'Crude Prybar', amount: 0, isDiscovered: false, capacity: 5, producible: false, integer: true, hidden: true },
        { name: 'Fabric', amount: 0, isDiscovered: false, capacity: 20, producible: false, integer: true },
        { name: 'Chemicals', amount: 0, isDiscovered: false, capacity: 20, producible: false, integer: true },
        // Legacy: now an inventory item (kept hidden for save compatibility).
        { name: 'Makeshift Explosive', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true, hidden: true },
        // Legacy: now an inventory item (kept hidden for save compatibility).
        { name: 'Power Cells', amount: 0, isDiscovered: false, capacity: 10, producible: false, integer: true, hidden: true },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: true },
        { name: 'Crystal', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: true },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: false },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25, producible: true, integer: false },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10, producible: true, integer: false },
        // Placeholder: used later by Crafting once Workshop is built
        { name: 'Worker Drone Blueprint', amount: 0, isDiscovered: false, capacity: 1, producible: false, integer: true },
    ];
}

export let resources = getInitialResources();

const RESOURCE_CATEGORIES = {
    // Essential vitals and survival
    'Health': 'Essential',
    'Stamina': 'Essential',
    'Food Rations': 'Essential',
    'Drinking Water': 'Essential',
    'Survivors': 'Essential',
    'Crew Members': 'Essential',
    'Morale': 'Essential',

    // Camp stockpiles
    'Provisions': 'Materials',
    'Water': 'Materials',

    // Tools / utility
    'Crude Prybar': 'Tools',
    'Makeshift Explosive': 'Tools',
    'Power Cells': 'Tools',

    // Materials / crafting inputs
    'Metal Parts': 'Materials',
    'Wire': 'Materials',
    'Fabric': 'Materials',
    'Chemicals': 'Materials',

    // Treat gathered crystals as materials (not science) for the new progression path
    'Crystal': 'Materials',
    'Xylite': 'Materials',

    // Exploration / research
    // Insight is effectively a core progression currency; keep it visible near vitals.
    'Insight': 'Essential',
    'Helion-3 Concentrate': 'Science',
    'Cygnium Ore': 'Science',
    'Sentient Mycelium': 'Science',
    'Worker Drone Blueprint': 'Science',
};

function getResourceCategoryName(resourceName) {
    return RESOURCE_CATEGORIES[resourceName] || 'Other';
}

function buildResourceTooltipHtml(resourceName) {
    const name = String(resourceName || '');

    // Special tooltip for Survivors/Crew Members showing job assignments
    if (name === 'Survivors' || name === 'Crew Members') {
        const currentResource = resources.find(r => r.name === name);
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
            <h4>${name}</h4>
            <p>Total: <strong>${total}</strong></p>
            <p>Assigned: <strong>${totalAssigned}</strong></p>
            ${jobsSection}
        `;
    }

    // Standard resource tooltip
    const rates = computeResourceRates(name);
    if (!rates) return `<h4>${name}</h4><p>No data available.</p>`;

    const { totalProduction, totalConsumption, netPerSecond, buildings, jobLines, jobConsumptionLines, activeDrainRate } = rates;

    // Personalized tooltips for personal vitals/supplies (match tone/structure of Morale tooltip)
    const isHealth = name === 'Health';
    const isStamina = name === 'Stamina';
    const isFood = name === 'Food Rations';
    const isDrink = name === 'Drinking Water';
    const isPersonalVital = isHealth || isStamina;
    const isPersonalSupply = isFood || isDrink;

    const productionHtml = [];
    if (buildings && buildings.length) {
        buildings.forEach(b => productionHtml.push(`<p class="tooltip-detail">+ <span class="tooltip-amount-produces">${formatNumber(b.amount)}</span>/s from ${b.count}x ${b.name}</p>`));
    }
    if (jobLines.length) {
        jobLines.forEach(j => productionHtml.push(`<p class="tooltip-detail">+ <span class="tooltip-amount-produces">${formatNumber(j.amount)}</span>/s from ${j.assigned}x ${j.name}</p>`));
    }

    let consumptionDetailsHtml = '';
    if (jobConsumptionLines && jobConsumptionLines.length) {
        jobConsumptionLines.forEach(j => {
            consumptionDetailsHtml += `<p class="tooltip-detail">- <span class="tooltip-amount-consumes">${formatNumber(j.amount)}</span>/s from ${j.assigned}x ${j.name}</p>`;
        });
    }
    if (activeDrainRate > 0) {
        const activeAction = getActiveCrashSiteAction();
        consumptionDetailsHtml += `<p class="tooltip-detail">- <span class="tooltip-amount-consumes">${formatNumber(activeDrainRate)}</span>/s from ${activeAction ? activeAction.name : 'active event'}</p>`;
    }

    const sign = netPerSecond >= 0 ? '+' : '';

    if (isPersonalVital || isPersonalSupply) {
        const res = resources.find(r => r && r.name === name);
        const amt = res ? (res.integer ? Math.floor(Number(res.amount) || 0) : (Number(res.amount) || 0)) : 0;
        const cap = res ? (res.integer ? Math.floor(Number(res.capacity) || 0) : (Number(res.capacity) || 0)) : 0;

        let description = '';
        if (isHealth) description = 'Your physical condition. Passively regenerates over time.';
        if (isStamina) description = 'Your endurance. Passively regenerates over time.';
        if (isFood) description = 'Personal rations carried while exploring. Depletion causes Hunger penalties.';
        if (isDrink) description = 'Personal water carried while exploring. Depletion causes Thirst penalties.';

        const regenLabel = isPersonalVital ? 'Regeneration' : 'Gains';
        const drainLabel = isPersonalVital ? 'Drain' : 'Usage';

        return `
            <h4>${name}</h4>
            <p class="tooltip-description">${description}</p>
            <div class="tooltip-section">
                <p>Current: <strong>${amt}${cap > 0 ? `/${cap}` : ''}</strong></p>
            </div>
            <div class="tooltip-section">
                <p>${regenLabel}: +<span class="tooltip-amount-produces">${formatNumber(totalProduction)}</span>/s</p>
                ${productionHtml.join('')}
            </div>
            <div class="tooltip-section">
                <p>${drainLabel}: -<span class="tooltip-amount-consumes">${formatNumber(totalConsumption)}</span>/s</p>
                ${consumptionDetailsHtml}
            </div>
            <hr>
            <p><strong>Net Change: ${sign}${formatNumber(netPerSecond)}/s</strong></p>
        `;
    }

    return `
        <h4>${name} Details</h4>
        <div class="tooltip-section">
            <p>Production: +<span class="tooltip-amount-produces">${formatNumber(totalProduction)}</span>/s</p>
            ${productionHtml.join('')}
        </div>
        <div class="tooltip-section">
            <p>Consumption: -<span class="tooltip-amount-consumes">${formatNumber(totalConsumption)}</span>/s</p>
            ${consumptionDetailsHtml}
        </div>
        <hr>
        <p><strong>Net Change: ${sign}${formatNumber(netPerSecond)}/s</strong></p>
    `;
}

export function computeResourceRates(resourceName) {
    const currentResource = resources.find(r => r.name === resourceName);
    if (!currentResource) return null;

    // --- Get Active States ---
    const activeAction = getActiveCrashSiteAction();
    // --- Action debuff multiplier (match crashSite logic) ---
    // If food or water are depleted, actions take longer -> drain spreads over longer time.
    let actionDebuff = 1;
    const foodRes = resources.find(r => r.name === 'Food Rations');
    const waterRes = resources.find(r => r.name === 'Drinking Water');
    const isHungry = !!(foodRes && Number(foodRes.amount) <= 0);
    const isThirsty = !!(waterRes && Number(waterRes.amount) <= 0);
    actionDebuff = 1 + (isHungry ? 0.5 : 0) + (isThirsty ? 0.5 : 0);

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

    // Purification Unit provides a global bonus to camp Water production/collection.
    try {
        if (resourceName === 'Water' && gameFlags && gameFlags.purificationUnitInstalled) {
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
    const passiveConsumption = 0;

    // Job upkeep / consumption (per-second), defined on job definitions as:
    //   consumes: [{ resource: 'Water', rate: 0.003 }, ...]
    // Rates are per assigned crew and are NOT modified by morale.
    let jobConsumption = 0;
    const jobConsumptionLines = [];
    try {
        if (Array.isArray(jobs)) {
            for (const job of jobs) {
                if (!job || !(job.assigned > 0)) continue;
                const consumes = Array.isArray(job.consumes) ? job.consumes : [];
                for (const c of consumes) {
                    if (!c || c.resource !== resourceName) continue;
                    const rate = Number(c.rate);
                    if (!Number.isFinite(rate) || rate <= 0) continue;
                    const amt = rate * Number(job.assigned || 0);
                    if (!(amt > 0)) continue;
                    jobConsumption += amt;
                    jobConsumptionLines.push({ name: job.name, assigned: job.assigned, amount: amt });
                }
            }
        }
    } catch { /* ignore */ }
    let activeDrainRate = 0;
    if (activeAction && activeAction.drain) {
        const drainInfo = activeAction.drain.find(d => d.resource === resourceName);
        if (drainInfo) {
            // spread the drain across the effective duration (accounting for hunger/thirst debuff)
            const effectiveDuration = Math.max(0.0001, (activeAction.duration || 1) * actionDebuff);
            activeDrainRate = drainInfo.amount / effectiveDuration;
        }
    }

    // Passive regeneration: keep consistent regardless of base camp/chapter.
    // These are per-second rates.
    if (resourceName === 'Stamina') {
        // Thirst disables passive stamina regeneration.
        if (!isThirsty) {
            totalProduction += 0.2;
        }
        try {
            const buff = characterState?.buffs?.staminaRegen;
            const until = Math.floor(Number(buff?.untilMinutes) || 0);
            const bonus = Number(buff?.bonusPerSec) || 0;
            if (bonus > 0) {
                const now = getTotalIngameMinutes();
                if (now < until) totalProduction += bonus;
            }
        } catch { /* non-fatal */ }
    }
    if (resourceName === 'Health') {
        // Hunger disables passive health regeneration.
        if (!isHungry) {
            totalProduction += 0.1;
        }
    }

    const totalConsumption = passiveConsumption + jobConsumption + activeDrainRate;

    // (building passive effects were already included above in `baseProduction`)
    const netPerSecond = totalProduction - totalConsumption;

    // produce a structured bonuses array so tooltips can display what contributed
    const bonuses = technologies.filter(t => t.isResearched && t.bonus?.resource === resourceName)
        .map(t => ({ name: t.name || t.id || 'Technology', multiplier: t.bonus.multiplier }));

    // Add Purification Unit as a visible bonus entry when active
    try {
        if (resourceName === 'Water' && gameFlags && gameFlags.purificationUnitInstalled) {
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
        jobConsumption,
        jobConsumptionLines,
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

function applyPersonalSupplyCapacities() {
    try {
        const stats = computeCharacterStats(characterState);

        const foodCap = Math.max(0, PERSONAL_SUPPLY_BASE_CAP + (Number(stats?.foodCapacity) || 0));
        const waterCap = Math.max(0, PERSONAL_SUPPLY_BASE_CAP + (Number(stats?.waterCapacity) || 0));

        const food = resources.find(r => r && r.name === 'Food Rations');
        if (food && Number.isFinite(foodCap) && foodCap > 0) {
            food.capacity = foodCap;
            food.amount = Math.min(Number(food.amount) || 0, food.capacity);
        }

        const water = resources.find(r => r && r.name === 'Drinking Water');
        if (water && Number.isFinite(waterCap) && waterCap > 0) {
            water.capacity = waterCap;
            water.amount = Math.min(Number(water.amount) || 0, water.capacity);
        }
    } catch { /* non-fatal */ }
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

    // --- Insert Morale row at the top ---
    const moraleRow = document.createElement('div');
    moraleRow.className = 'info-row morale';
    moraleRow.dataset.resource = 'Morale';
    moraleRow.classList.toggle('hidden', !shouldShowMoraleResource());
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
                <p class="tooltip-description">Morale scales job output. 100% is normal; higher morale increases production, lower morale reduces it.</p>
                <p>Current: <strong>${Math.round(m.percent)}%</strong></p>
            <div class="tooltip-section"><h4>Sources</h4>${modifiers}</div>
            
        `;
    });
    (categoryContainers.get('Essential') || infoSection).appendChild(moraleRow);

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

        const displayName = (resource.name === 'Survivors' && gameFlags && Number(gameFlags.chapter) >= 2)
            ? 'Crew Members'
            : resource.name;

        infoRow.innerHTML = `
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1"><span>${displayName}</span></div>
            <div class="infocolumn2"><p data-value-type="storage"></p></div>
            <div class="infocolumn3"><p data-value-type="generation"></p></div>
        `;

        // register the row with the shared tooltip system.
        setupTooltip(infoRow, () => {
            const resourceName = infoRow.dataset.resource;
            return buildResourceTooltipHtml(resourceName);
        });

        const cat = getResourceCategoryName(resource.name);
        (categoryContainers.get(cat) || categoryContainers.get('Other') || infoSection).appendChild(infoRow);
    });

    infoPanelContent.appendChild(infoSection);

    // Initial category visibility (after DOM attach)
    updateResourceCategoryVisibility(infoPanelContent);
}

function updateResourceCategoryVisibility(root = document) {
    const wrappers = root.querySelectorAll('.info-category');
    wrappers.forEach(w => {
        const hasVisibleRow = !!w.querySelector('.info-row:not(.hidden)');
        w.classList.toggle('hidden', !hasVisibleRow);
    });
}

function shouldShowMoraleResource() {
    // Morale is only meaningful once there are people; hide until the first survivor/crew member is found.
    const survivors = resources.find(r => r && r.name === 'Survivors');
    const crew = resources.find(r => r && r.name === 'Crew Members');
    const survivorsCount = survivors ? Math.floor(Number(survivors.amount) || 0) : 0;
    const crewCount = crew ? Math.floor(Number(crew.amount) || 0) : 0;
    return (survivorsCount + crewCount) > 0;
}

function ensureCollapsedVitalsRail() {
    const infoPanel = document.getElementById('infoPanel');
    if (!infoPanel) return null;
    let rail = infoPanel.querySelector('.info-vitals-icons');
    if (!rail) {
        rail = document.createElement('div');
        rail.className = 'info-vitals-icons';
        rail.setAttribute('aria-hidden', 'true');

        const mk = (vitalKey) => {
            const orb = document.createElement('div');
            orb.className = 'info-vital-orb';
            orb.dataset.vital = vitalKey;
            orb.dataset.tooltipTouchTap = 'true';
            orb.innerHTML = `
                <div class="orb-text">
                    <div class="orb-current"></div>
                </div>
            `;
            rail.appendChild(orb);
            return orb;
        };

        mk('health');
        mk('stamina');
        mk('water');
        mk('food');

        infoPanel.appendChild(rail);

        // Wire tooltips for the orbs to match the info panel resource tooltips.
        try {
            const map = {
                health: 'Health',
                stamina: 'Stamina',
                water: 'Drinking Water',
                food: 'Food Rations',
            };
            Object.entries(map).forEach(([key, resName]) => {
                const orb = rail.querySelector(`.info-vital-orb[data-vital="${key}"]`);
                if (!orb) return;
                setupTooltip(orb, () => buildResourceTooltipHtml(resName));
            });
        } catch { /* ignore */ }
    }
    return rail;
}

function updateCollapsedVitalsRail() {
    const rail = ensureCollapsedVitalsRail();
    if (!rail) return;

    const get = (name) => resources.find(r => r && r.name === name);
    const resMap = {
        health: get('Health'),
        stamina: get('Stamina'),
        water: get('Drinking Water'),
        food: get('Food Rations'),
    };

    for (const [key, res] of Object.entries(resMap)) {
        const orb = rail.querySelector(`.info-vital-orb[data-vital="${key}"]`);
        if (!orb) continue;

        // Hide orb if the resource isn't present.
        if (!res) {
            orb.style.display = 'none';
            continue;
        }
        orb.style.display = '';

        const amt = res.integer ? Math.floor(Number(res.amount) || 0) : (Number(res.amount) || 0);
        const cap = res.integer ? Math.floor(Number(res.capacity) || 0) : (Number(res.capacity) || 0);
        const pct = (cap > 0) ? Math.max(0, Math.min(100, (amt / cap) * 100)) : 0;

        try { orb.style.setProperty('--fill', `${pct}%`); } catch { /* ignore */ }

        const curEl = orb.querySelector('.orb-current');
        if (curEl) curEl.textContent = `${amt}`;
    }
}

export function updateResourceInfo() {
    // Keep personal supplies capacity in sync with equipment.
    try { applyPersonalSupplyCapacities(); } catch {}

    // Keep collapsed (mobile) vitals rail in sync with resource amounts.
    // (Shown/hidden purely via responsive CSS when #infoPanel is collapsed.)
    try { updateCollapsedVitalsRail(); } catch {}

    const survivorResource = resources.find(r => r.name === 'Survivors');
    const survivorCount = survivorResource ? survivorResource.amount : 0;
    const activeAction = getActiveCrashSiteAction();

    // Update Morale row first
    try {
        const m = getMorale();
        const row = document.querySelector('.info-row.morale');
        if (row) {
            const shouldShow = shouldShowMoraleResource();
            row.classList.toggle('hidden', !shouldShow);
            row.classList.remove('morale-high','morale-mid','morale-low');
            if (shouldShow) {
                const valEl = row.querySelector('[data-value-type="morale"]');
                if (valEl) valEl.textContent = `${Math.round(m.percent)}%`;
                const pct = m.percent;
                const cls = (pct >= 100) ? 'morale-high' : (pct >= 80 ? 'morale-mid' : 'morale-low');
                row.classList.add(cls);
            }
        }
    } catch {}

    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        // Chapter 2+ label rename (UI-only): Survivors -> Crew Members
        try {
            if (resource.name === 'Survivors') {
                const isChapter2Plus = gameFlags && Number(gameFlags.chapter) >= 2;
                const nameEl = infoRow.querySelector('.infocolumn1 > span');
                if (nameEl) nameEl.textContent = isChapter2Plus ? 'Crew Members' : 'Survivors';
            }
        } catch { /* non-fatal */ }

        // Chapter 2+: Health/Stamina become less relevant in the right-side info panel.
        // Keep the resources themselves (used by combat/character), but hide the UI rows.
        const isChapter2 = gameFlags.chapter === 2;
        if ((resource.name === 'Stamina' || resource.name === 'Health') && isChapter2) {
            infoRow.classList.add('hidden');
            return;
        }

        // reveal any resource that has a positive amount
        // BUT prevent auto-discovery of Chapter 1-only resources in Chapter 2
        const chapter1OnlyResources = ['Health', 'Stamina', 'Crude Prybar', 'Makeshift Explosive'];
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
        // The survival debuff badge injects its own <span> inside .infocolumn1.
        // Use the direct child span, which is the resource name, so we don't toggle styles on the badge.
        const nameEl = infoRow.querySelector('.infocolumn1 > span');

        // Determine "zero" based on the underlying amount (not the floored display).
        // Otherwise integer resources can stay red while recovering from 0 -> 1.
        const rawAmountNum = Number(resource.amount);
        const isZero = !(isFinite(rawAmountNum)) ? false : (rawAmountNum <= 0);
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
        if (nameEl) nameEl.classList.toggle('zero-amount', isZero);
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

    // Hide empty categories to avoid spoilers.
    updateResourceCategoryVisibility(document.getElementById('infoPanelContent') || document);

}

// Public: allow other UI surfaces (e.g., Campsite resource orbs) to reuse the exact
// tooltip content from the info panel.
export function getResourceTooltipHtml(resourceName) {
    try { return buildResourceTooltipHtml(resourceName); } catch { return `<h4>${String(resourceName || '')}</h4>`; }
}