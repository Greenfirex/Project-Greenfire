import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { formatNumber } from './formatting.js';
import { getOrCreateTooltip, updateTooltipPosition } from './main.js';

// --- DATA ---
export function getInitialResources() {
    return [
        // ADDED: New survival resources with a consumption rate
		{ name: 'Survivors', amount: 1, isDiscovered: false, capacity: 10, producible: false, integer: true },
		{ name: 'Energy', amount: 100, isDiscovered: true, capacity: 100, producible: false, integer: true },
        { name: 'Food Rations', amount: 100, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.15 },
        { name: 'Clean Water', amount: 100, isDiscovered: true, capacity: 150, producible: false, integer: true, baseConsumption: 0.18 },
        
        { name: 'Scrap Metal', amount: 0, isDiscovered: false, capacity: 200, producible: false, integer: true },
        { name: 'Ship Components', amount: 0, isDiscovered: false, capacity: 50, producible: false, integer: true },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Stone', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50, producible: true, integer: false },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25, producible: true, integer: false },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100, producible: true, integer: false },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10, producible: true, integer: false },
    ];
}
export let resources = getInitialResources();

export function resetResources() {
    const initial = getInitialResources();
    resources.length = 0;
    initial.forEach(res => resources.push({...res}));
    console.log("Resource data has been reset.");
}

// --- UI SETUP (RUNS ONCE) ---
export function setupInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    if (!infoPanel) return;
    infoPanel.innerHTML = ''; 

    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

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

        const tooltip = getOrCreateTooltip();

        // MODIFIED: This entire event listener has been updated
        infoRow.addEventListener('mouseenter', (e) => {
            const resourceName = infoRow.dataset.resource;
            const currentResource = resources.find(r => r.name === resourceName);
            if (!currentResource) return;

            // --- Production Calculation ---
            let baseProduction = 0;
            const productionBuildings = [];
            buildings.forEach(b => {
                if (b.produces === resourceName && b.count > 0) {
                    const amount = b.rate * b.count;
                    baseProduction += amount;
                    productionBuildings.push({ name: b.name, count: b.count, amount: amount });
                }
            });
            let bonusMultiplier = 0;
            technologies.forEach(t => {
                if (t.isResearched && t.bonus?.resource === resourceName) {
                    bonusMultiplier += t.bonus.multiplier;
                }
            });
            const totalProduction = baseProduction * (1 + bonusMultiplier);

            // --- Consumption Calculation ---
            const survivorResource = resources.find(r => r.name === 'Survivors');
            const survivorCount = survivorResource ? survivorResource.amount : 0;
            const totalConsumption = currentResource.baseConsumption ? currentResource.baseConsumption * survivorCount : 0;

            // --- Net Change Calculation ---
            const netChange = totalProduction - totalConsumption;
            const sign = netChange >= 0 ? '+' : '';

            // --- Build Tooltip HTML ---
            tooltip.innerHTML = `
                <h4>${resourceName} Details</h4>
                
                <div class="tooltip-section">
                    <p>Production: +${formatNumber(totalProduction)}/s</p>
                    ${productionBuildings.map(b => `<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`).join('')}
                </div>

                <div class="tooltip-section">
                    <p>Consumption: -${formatNumber(totalConsumption)}/s</p>
                    ${totalConsumption > 0 ? `<p class="tooltip-detail">from ${survivorCount} survivor(s)</p>` : ''}
                </div>

                <hr>
                <p><strong>Net Change: ${sign}${formatNumber(netChange)}/s</strong></p>
            `;

            tooltip.style.visibility = 'visible';
            updateTooltipPosition(e, tooltip);
        });

        infoRow.addEventListener('mouseleave', () => {
            tooltip.style.visibility = 'hidden';
        });

        infoRow.addEventListener('mousemove', (e) => {
            updateTooltipPosition(e, tooltip);
        });
        
        infoSection.appendChild(infoRow);
    });
    infoPanel.appendChild(infoSection);
}

// --- UI UPDATE (RUNS EVERY TICK) ---
export function updateResourceInfo() {
    const survivorResource = resources.find(r => r.name === 'Survivors');
    const survivorCount = survivorResource ? survivorResource.amount : 0;

    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        if (resource.name !== 'Survivors' && resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }
        
        infoRow.classList.toggle('hidden', !resource.isDiscovered);
        if (!resource.isDiscovered) return;

        infoRow.classList.toggle('non-producible', !resource.producible);
        
        const generationEl = infoRow.querySelector('[data-value-type="generation"]');
        const storageEl = infoRow.querySelector('[data-value-type="storage"]');
		const nameEl = infoRow.querySelector('.infocolumn1 span');
        const isZero = resource.amount <= 0;
        storageEl.classList.toggle('zero-amount', resource.amount <= 0);
		nameEl.classList.toggle('zero-amount', isZero);

        // 1. Always calculate and display storage text in the second column
        const amountDisplay = resource.integer ? Math.floor(resource.amount).toLocaleString() : formatNumber(resource.amount);
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();
        storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;

        // 2. Calculate net change (production - consumption)
        let baseProduction = 0;
        buildings.forEach(b => {
            if (b.produces === resource.name) baseProduction += b.rate * b.count;
        });
        // There was a typo here, it should be isResearched
        let bonusMultiplier = 0;
        technologies.forEach(t => {
            if (t.isResearched && t.bonus?.resource === resource.name) bonusMultiplier += t.bonus.multiplier;
        });
        const totalProduction = baseProduction * (1 + bonusMultiplier);
        const totalConsumption = resource.baseConsumption ? resource.baseConsumption * survivorCount : 0;
        const netChange = totalProduction - totalConsumption;
		
		generationEl.classList.toggle('negative-rate', netChange < 0);

        // 3. Display the net change in the third column, if applicable
        if (resource.producible || totalConsumption > 0) {
            const sign = netChange >= 0 ? '+' : '';
            // For pure consumables, show rate in parentheses
            if (totalConsumption > 0 && !resource.producible) {
                generationEl.textContent = `(${formatNumber(netChange)}/s)`;
            } else {
                generationEl.textContent = `${sign}${formatNumber(netChange)}/s`;
            }
        } else {
            // Clear the third column for simple resources like Scrap Metal
            generationEl.textContent = '';
        }

        // --- End of Corrected Logic ---

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;
        
        infoRow.classList.toggle('capped', resource.amount >= resource.capacity);
    });
}