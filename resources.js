import { buildings } from './data/buildings.js'; // We need this to calculate generation rates

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
            
            // --- NEW: Create and update the progress bar ---
            const progressBar = document.createElement('div');
            progressBar.className = 'resource-progress-bar';
            
            // Calculate the fill percentage and cap it at 100%
            const fillPercentage = Math.min((resource.amount / resource.capacity) * 100, 100);
            progressBar.style.width = `${fillPercentage}%`;

            // Add the bar to the row
            resourceDiv.appendChild(progressBar);

            if (resource.amount >= resource.capacity) {
                resourceDiv.classList.add('capped');
            }

            // --- The rest of the function is the same ---
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
            generationElement.textContent = `${totalGeneration.toFixed(2)}/s`;

            const storageElement = document.createElement('p');
            const storedAmount = resource.amount.toFixed(2);
            storageElement.textContent = `${storedAmount} / ${resource.capacity}`;

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
        { name: 'Helion-3 Concentrate', amount: 0, isDiscovered: false, capacity: 25 },
        { name: 'Cygnium Ore', amount: 0, isDiscovered: false, capacity: 100 },
        { name: 'Sentient Mycelium', amount: 0, isDiscovered: false, capacity: 10 },
        // --- NEW RESOURCE ---
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