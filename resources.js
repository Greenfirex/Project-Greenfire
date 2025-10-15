import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from '../main.js';

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
    resources.push(...initial);
    console.log("Resource data has been reset.");
}

// --- UI SETUP (RUNS ONCE) ---
export function setupInfoPanel() {
    const infoPanel = document.getElementById('infoPanel');
    if (!infoPanel) return;
    infoPanel.innerHTML = ''; 

    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

    // Create the permanent structure for each resource row
    getInitialResources().forEach(resource => {
        const infoRow = document.createElement('div');
        infoRow.className = 'info-row';
        infoRow.dataset.resource = resource.name; 
        infoRow.classList.add('hidden'); // All rows start hidden

        infoRow.innerHTML = `
            <div class="resource-progress-bar"></div>
            <div class="infocolumn1">
                <span>${resource.name}</span>
            </div>
            <div class="infocolumn2">
                <p data-value-type="storage"></p>
            </div>
            <div class="infocolumn3">
                <p data-value-type="generation"></p>
            </div>
        `;
        infoSection.appendChild(infoRow);
    });
    infoPanel.appendChild(infoSection);
}

// --- UI UPDATE (RUNS EVERY TICK) ---
export function updateResourceInfo() {
    const displayResources = [...resources].sort((a, b) => {
        if (a.name === 'Insight') return -1;
        if (b.name === 'Insight') return 1;
        return 0;
    });

    displayResources.forEach(resource => {
        const infoRow = document.querySelector(`.info-row[data-resource="${resource.name}"]`);
        if (!infoRow) return;

        // Auto-discovery logic
        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }
        
        // Show or hide the row based on discovery status
        if (resource.isDiscovered) {
            infoRow.classList.remove('hidden');
        } else {
            infoRow.classList.add('hidden');
            return; // Don't update the rest if it's hidden
        }
        
        // --- Calculate Production Breakdown for Tooltip ---
        const breakdown = {
            base: 0,
            buildings: [],
            bonusMultiplier: 0,
            bonuses: [],
            totalProduction: 0
        };
        buildings.forEach(b => {
            if (b.produces === resource.name && b.count > 0) {
                const amount = b.rate * b.count;
                breakdown.base += amount;
                breakdown.buildings.push({ name: b.name, count: b.count, amount: amount });
            }
        });
        technologies.forEach(t => {
            if (t.isResearched && t.bonus && t.bonus.resource === resource.name) {
                breakdown.bonusMultiplier += t.bonus.multiplier;
                breakdown.bonuses.push({ name: t.name, multiplier: t.bonus.multiplier });
            }
        });
        breakdown.totalProduction = breakdown.base * (1 + breakdown.bonusMultiplier);
        setupTooltip(infoRow, breakdown);

        // --- Update Values of Existing Elements ---
        const progressBar = infoRow.querySelector('.resource-progress-bar');
        const fillPercentage = Math.min((resource.amount / resource.capacity) * 100, 100);
        progressBar.style.width = `${fillPercentage}%`;

        const generationEl = infoRow.querySelector('[data-value-type="generation"]');
        generationEl.textContent = `${formatNumber(breakdown.totalProduction)}/s`;
        
        const storageEl = infoRow.querySelector('[data-value-type="storage"]');
        let amountDisplay;
        if (resource.amount >= resource.capacity) {
            amountDisplay = Math.floor(resource.amount).toLocaleString();
        } else {
            amountDisplay = formatNumber(resource.amount);
        }
        const capacityDisplay = Math.floor(resource.capacity).toLocaleString();
        storageEl.textContent = `${amountDisplay} / ${capacityDisplay}`;

        // Update 'capped' class
        infoRow.classList.toggle('capped', resource.amount >= resource.capacity);
    });
}

