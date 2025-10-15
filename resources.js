import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from './main.js';

export function updateResourceInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = ''; 

    // Create the new wrapper for all resource rows
    const infoSection = document.createElement('div');
    infoSection.className = 'info-section';

    const displayResources = [...resources].sort((a, b) => {
        if (a.name === 'Insight') return -1;
        if (b.name === 'Insight') return 1;
        return 0;
    });

    displayResources.forEach(resource => {
        // Auto-discover a resource once its amount is > 0
        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }
        
        if (resource.isDiscovered) {
            // This is the individual row for a single resource
            const infoRow = document.createElement('div');
            infoRow.className = 'info-row';
            
            if (resource.amount >= resource.capacity) {
                infoRow.classList.add('capped');
            }
            
            const progressBar = document.createElement('div');
            progressBar.className = 'resource-progress-bar';
            const fillPercentage = Math.min((resource.amount / resource.capacity) * 100, 100);
            progressBar.style.width = `${fillPercentage}%`;
            infoRow.appendChild(progressBar);

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
                if (t.isReserached && t.bonus && t.bonus.resource === resource.name) {
                    breakdown.bonusMultiplier += t.bonus.multiplier;
                    breakdown.bonuses.push({ name: t.name, multiplier: t.bonus.multiplier });
                }
            });
            breakdown.totalProduction = breakdown.base * (1 + breakdown.bonusMultiplier);
            setupTooltip(infoRow, breakdown);

            const column1 = document.createElement('div');
            column1.className = 'infocolumn1';
            const column2 = document.createElement('div');
            column2.className = 'infocolumn2';
            const column3 = document.createElement('div');
            column3.className = 'infocolumn3';

            const nameElement = document.createElement('span'); 
            nameElement.textContent = resource.name;

            const generationElement = document.createElement('p');
            generationElement.textContent = `${formatNumber(breakdown.totalProduction)}/s`;

            const storageElement = document.createElement('p');
            let amountDisplay;
            if (resource.amount >= resource.capacity) {
                amountDisplay = Math.floor(resource.amount).toLocaleString();
            } else {
                amountDisplay = formatNumber(resource.amount);
            }
            const capacityDisplay = Math.floor(resource.capacity).toLocaleString();
            storageElement.textContent = `${amountDisplay} / ${capacityDisplay}`;

            column1.appendChild(nameElement);
            column2.appendChild(storageElement);
            column3.appendChild(generationElement);

            infoRow.appendChild(column1);
            infoRow.appendChild(column2);
            infoRow.appendChild(column3);

            // Append the finished row to our new section wrapper
            infoSection.appendChild(infoRow);
        }
    });

    // Append the single section wrapper to the main panel
    infoPanel.appendChild(infoSection);
}

export function getInitialResources() {
    return [
        { name: 'Stone', amount: 0, isDiscovered: true, capacity: 100 },
        { name: 'Xylite', amount: 0, isDiscovered: false, capacity: 50 },
        { name: 'Insight', amount: 0, isDiscovered: false, capacity: 100 },
    ];
}

// This pattern makes resetting the data easy and safe
const initialResources = getInitialResources();
export let resources = JSON.parse(JSON.stringify(initialResources));

export function resetResources() {
    resources.length = 0;
    resources.push(...JSON.parse(JSON.stringify(initialResources)));
    console.log("Resource data has been reset.");
}