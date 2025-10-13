import { buildings } from './data/buildings.js'; // We need this to calculate generation rates
import { formatNumber } from './formatting.js';

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
            const resourceDiv = document.createElement('div');
            resourceDiv.className = 'info-section';
            
            const progressBar = document.createElement('div');
            progressBar.className = 'resource-progress-bar';
            
            const fillPercentage = Math.min((resource.amount / resource.capacity) * 100, 100);
            progressBar.style.width = `${fillPercentage}%`;

            resourceDiv.appendChild(progressBar);

            if (resource.amount >= resource.capacity) {
                resourceDiv.classList.add('capped');
            }

            const column1 = document.createElement('div');
            column1.className = 'infocolumn1';
            const column2 = document.createElement('div');
            column2.className = 'infocolumn2';
            const column3 = document.createElement('div');
            column3.className = 'infocolumn3';

            const nameElement = document.createElement('span'); 
            nameElement.textContent = resource.name;

            let totalGeneration = 0;
            buildings.forEach(building => {
                if (building.produces === resource.name) {
                    totalGeneration += building.rate * building.count;
                }
            });

            const generationElement = document.createElement('p');
            // MODIFIED: Use the new formatNumber function
            generationElement.textContent = `${formatNumber(totalGeneration)}/s`;

            const storageElement = document.createElement('p');
            // MODIFIED: Use the new formatNumber function for both amount and capacity
            storageElement.textContent = `${formatNumber(resource.amount)} / ${formatNumber(resource.capacity)}`;

            column1.appendChild(nameElement);
            column2.appendChild(generationElement);
            column3.appendChild(storageElement);

            resourceDiv.appendChild(column1);
            resourceDiv.appendChild(column2);
            resourceDiv.appendChild(column3);

            infoPanel.appendChild(resourceDiv);
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