import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { formatNumber } from './formatting.js';
import { getOrCreateTooltip, updateTooltipPosition } from '../main.js';

// --- DATA ---
export function getInitialResources() {
    return [
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100 },
        { name: 'Stone', amount: 0, isDiscovered: true, capacity: 100 },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50 },
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25 },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100 },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10 },
    ];
}
export let resources = getInitialResources();

export function resetResources() {
    const initial = getInitialResources();
    resources.length = 0;
    // Use Object.assign on individual items if they are objects to preserve references
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

        infoRow.innerHTML = `
            <div class="info-section-hover-bg"></div>
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1"><span>${resource.name}</span></div>
            <div class="infocolumn2"><p data-value-type="storage"></p></div>
            <div class="infocolumn3"><p data-value-type="generation"></p></div>
        `;

        const tooltip = getOrCreateTooltip();
        infoRow.addEventListener('mouseenter', (e) => {
            const resourceName = infoRow.dataset.resource;
            const currentResource = resources.find(r => r.name === resourceName);
            if (!currentResource) return;

            const breakdown = {
                base: 0, buildings: [], bonusMultiplier: 0,
                bonuses: [], totalProduction: 0
            };

            buildings.forEach(b => {
                if (b.produces === resourceName && b.count > 0) {
                    const amount = b.rate * b.count;
                    breakdown.base += amount;
                    breakdown.buildings.push({ name: b.name, count: b.count, amount: amount });
                }
            });
            technologies.forEach(t => {
                if (t.isResearched && t.bonus?.resource === resourceName) {
                    breakdown.bonusMultiplier += t.bonus.multiplier;
                    breakdown.bonuses.push({ name: t.name, multiplier: t.bonus.multiplier });
                }
            });
            breakdown.totalProduction = breakdown.base * (1 + breakdown.bonusMultiplier);
            
            tooltip.innerHTML = `
                <h4>${resourceName} Production</h4>
                <div class="tooltip-section">
                    <p>Base: ${formatNumber(breakdown.base)}/s</p>
                    ${breakdown.buildings.map(b => `<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`).join('')}
                </div>
                <div class="tooltip-section">
                    <p>Bonus: +${(breakdown.bonusMultiplier * 100).toFixed(0)}%</p>
                    ${breakdown.bonuses.map(b => `<p class="tooltip-detail">+${b.multiplier * 100}% from ${b.name}</p>`).join('')}
                </div>
                <hr>
                <p><strong>Total: ${formatNumber(breakdown.totalProduction)}/s</strong></p>
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
    resources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }
        
        infoRow.classList.toggle('hidden', !resource.isDiscovered);
        if (!resource.isDiscovered) return;
        
        let baseProduction = 0;
        let bonusMultiplier = 0;
        buildings.forEach(b => {
            if (b.produces === resource.name) baseProduction += b.rate * b.count;
        });
        technologies.forEach(t => {
            if (t.isResearched && t.bonus?.resource === resource.name) bonusMultiplier += t.bonus.multiplier;
        });
        const totalProduction = baseProduction * (1 + bonusMultiplier);

        const progressBar = infoRow.querySelector('.resource-progress-bar');
        progressBar.style.width = `${Math.min((resource.amount / resource.capacity) * 100, 100)}%`;

        const generationEl = infoRow.querySelector('[data-value-type="generation"]');
        generationEl.textContent = `${formatNumber(totalProduction)}/s`;
        
        const storageEl = infoRow.querySelector('[data-value-type="storage"]');
        let amountDisplay = (resource.amount >= resource.capacity) ? Math.floor(resource.amount).toLocaleString() : formatNumber(resource.amount);
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();
        storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;

        infoRow.classList.toggle('capped', resource.amount >= resource.capacity);
    });
}