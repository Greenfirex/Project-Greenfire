import { buildings } from './data/buildings.js';
import { technologies } from './data/technologies.js';
import { formatNumber } from './formatting.js';
import { setupTooltip } from './main.js';

export function updateResourceInfo() {
    const infoPanel = document.getElementById('infoPanel');
    infoPanel.innerHTML = ''; 

    const displayResources = [...resources].sort((a, b) => {
        if (a.name === 'Insight') return -1;
        if (b.name === 'Insight') return 1;
        return 0;
    });

    displayResources.forEach(resource => {
        if (resource.amount > 0 && !resource.isDiscovered) {
            resource.isDiscovered = true;
        }

        if (resource.isDiscovered) {
            // This is the outer container for one row, used for layout and tooltips
            const resourceRow = document.createElement('div');
            resourceRow.className = 'info-section-row';

            // This is the inner div that contains all visible content and gets the hover effect
            const resourceContent = document.createElement('div');
            resourceContent.className = 'info-section-content';
            
            if (resource.amount >= resource.capacity) {
                resourceContent.classList.add('capped');
            }
            
            const progressBar = document.createElement('div');
            progressBar.className = 'resource-progress-bar';
            
            const fillPercentage = Math.min((resource.amount / resource.capacity) * 100, 100);
            progressBar.style.width = `${fillPercentage}%`;
            resourceContent.appendChild(progressBar);

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
            setupTooltip(resourceRow, breakdown);

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

            resourceContent.appendChild(column1);
            resourceContent.appendChild(column2);
            resourceContent.appendChild(column3);

            resourceRow.appendChild(resourceContent);
            infoPanel.appendChild(resourceRow);
        }
    });
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