import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { technologies } from '../data/technologies.js';
import { addLogEntry } from '../log.js';
import { setupTooltip } from '../main.js';

/**
 * Creates a stylish, image-based button for a building, including its name and current count.
 * @param {object} building - The building object from the buildings data.
 * @param {HTMLElement} container - The parent element to append the button to.
 */
function createBuildingButton(building, container) {
    const button = document.createElement('button');
    button.className = 'image-button';

    // --- FIXED: Swapped the order of these two blocks ---

    // Create a separate span for the building's count and add it FIRST
    const countSpan = document.createElement('span');
    countSpan.className = 'building-count';
    countSpan.textContent = `(${building.count})`;
    button.appendChild(countSpan);

    // Create a span for the building's name and add it SECOND
    const nameSpan = document.createElement('span');
    nameSpan.textContent = `Build ${building.name}`;
    button.appendChild(nameSpan);
    
    // Set the button's action and tooltip
    button.addEventListener('click', () => buildBuilding(building.name));
    setupTooltip(button, building);

    container.appendChild(button);
}

/**
 * A single, reusable function to handle purchasing any building.
 */
function buildBuilding(buildingName) {
    const building = buildings.find(b => b.name === buildingName);
    if (!building) { return; }

    let canAfford = true;
    for (const cost of building.cost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) {
            canAfford = false;
            addLogEntry(`Not enough ${cost.resource} to build a ${buildingName}.`, 'red');
            break;
        }
    }

    if (canAfford) {
        for (const cost of building.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }

        building.count += 1;
        addLogEntry(`Built a new ${buildingName}!`, 'green');

        if (building.effect && building.effect.type === 'storage') {
            const resourceToUpgrade = resources.find(r => r.name === building.effect.resource);
            if (resourceToUpgrade) {
                resourceToUpgrade.capacity += building.effect.value;
                addLogEntry(`${resourceToUpgrade.name} capacity increased by ${building.effect.value}!`, 'blue');
            }
        }
        
        updateResourceInfo();
        setupMiningSection(); // Rebuild the mining section to update the button counts
    }
}

export function setupMiningSection(miningSection) {
    if (!miningSection) {
        miningSection = document.getElementById('miningSection');
    }
    if (!miningSection) { return; }

    miningSection.innerHTML = '';
    // We don't need the 'mining-bg' class if the main background is already set

    // --- Category 1: Manual Gathering ---
    const manualHeader = document.createElement('h2');
    manualHeader.textContent = 'Manual Gathering';
    manualHeader.className = 'section-header';
    miningSection.appendChild(manualHeader);
    const manualCategory = document.createElement('div');
    manualCategory.className = 'mining-category-container';
    const manualButtons = document.createElement('div');
    manualButtons.className = 'button-group'; // We can reuse button-group from research.css
    // Manual button also gets the new style for consistency
    const mineStoneButton = document.createElement('button');
    mineStoneButton.className = 'image-button';
    mineStoneButton.textContent = 'Mine Stone';
    mineStoneButton.addEventListener('click', mineStone);
    setupTooltip(mineStoneButton, 'Gain 1 Stone');
    manualButtons.appendChild(mineStoneButton);
    manualCategory.appendChild(manualButtons);
    miningSection.appendChild(manualCategory);

    // --- Category 2: Mining ---
    const miningHeader = document.createElement('h2');
    miningHeader.textContent = 'Production';
    miningHeader.className = 'section-header';
    miningSection.appendChild(miningHeader);
    const miningCategory = document.createElement('div');
    miningCategory.className = 'mining-category-container';
    const miningButtons = document.createElement('div');
    miningButtons.className = 'button-group';
    
    createBuildingButton(buildings.find(b => b.name === 'Quarry'), miningButtons);
    const xylite = resources.find(r => r.name === 'Xylite');
    if (xylite && xylite.isDiscovered) {
        createBuildingButton(buildings.find(b => b.name === 'Extractor'), miningButtons);
    }
    miningCategory.appendChild(miningButtons);
    miningSection.appendChild(miningCategory);

    // --- Category 3: Storage ---
    const basicStorageTech = technologies.find(t => t.name === 'Basic Storage' && t.isResearched);
    if (basicStorageTech) {
        const storageHeader = document.createElement('h2');
        storageHeader.textContent = 'Storage';
        storageHeader.className = 'section-header';
        miningSection.appendChild(storageHeader);
        const storageCategory = document.createElement('div');
        storageCategory.className = 'mining-category-container';
        const storageButtons = document.createElement('div');
        storageButtons.className = 'button-group';
        
        createBuildingButton(buildings.find(b => b.name === 'Stone Stockpile'), storageButtons);
        const xyliteStorageTech = technologies.find(t => t.name === 'Xylite Storage' && t.isResearched);
        if (xyliteStorageTech) {
            createBuildingButton(buildings.find(b => b.name === 'Xylite Silo'), storageButtons);
        }
        storageCategory.appendChild(storageButtons);
        miningSection.appendChild(storageCategory);
    }
}

function mineStone() {
    const stone = resources.find(r => r.name === 'Stone');
    if (stone) {
        if (stone.amount >= stone.capacity) {
            addLogEntry('Stone storage is full!', 'orange');
            return;
        }
        stone.amount = Math.min(stone.amount + 1, stone.capacity);
        updateResourceInfo();
        addLogEntry('Manually mined 1 Stone.', 'blue');
    }
}