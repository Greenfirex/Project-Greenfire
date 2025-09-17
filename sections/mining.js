import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { technologies } from '../data/technologies.js';
import { addLogEntry } from '../log.js';
import { setupTooltip } from '../main.js';

/**
 * NEW: Checks affordability for all buildings and updates their button styles.
 */
export function updateBuildingButtonsState() {
    buildings.forEach(building => {
        // Find the button associated with this building
        const button = document.querySelector(`.image-button[data-building="${building.name}"]`);
        if (!button) { return; } // Skip if the button isn't currently displayed

        // Check if the player has enough resources
        let canAfford = true;
        for (const cost of building.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) {
                canAfford = false;
                break;
            }
        }

        // Add or remove the 'unaffordable' class based on the check
        if (canAfford) {
            button.classList.remove('unaffordable');
        } else {
            button.classList.add('unaffordable');
        }
    });
}

/**
 * A reusable function to apply a click animation to a button.
 */
function animateButtonClick(event) {
    const button = event.currentTarget;
    button.classList.add('is-clicking');
    setTimeout(() => {
        button.classList.remove('is-clicking');
    }, 200);
}

/**
 * Creates a stylish, image-based button for a building.
 */
function createBuildingButton(building, container) {
    const button = document.createElement('button');
    button.className = 'image-button';
    button.dataset.building = building.name; // ADDED: A data-attribute to easily find the button

    const countSpan = document.createElement('span');
    countSpan.className = 'building-count';
    countSpan.textContent = `(${building.count})`;
    button.appendChild(countSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'building-name'; // ADDED: A class for specific styling
    nameSpan.textContent = `Build ${building.name}`;
    button.appendChild(nameSpan);
    
    button.addEventListener('click', (event) => buildBuilding(event, building.name));
    setupTooltip(button, building);

    container.appendChild(button);
}

/**
 * A single, reusable function to handle purchasing any building.
 */
function buildBuilding(event, buildingName) {
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
        animateButtonClick(event);

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
        setupMiningSection();
    }
}

export function setupMiningSection(miningSection) {
    if (!miningSection) {
        miningSection = document.getElementById('miningSection');
    }
    if (!miningSection) { return; }

    miningSection.innerHTML = '';

    // --- Category 1: Manual Gathering ---
    const manualHeader = document.createElement('h2');
    manualHeader.textContent = 'Manual Gathering';
    manualHeader.className = 'section-header';
    miningSection.appendChild(manualHeader);
    const manualCategory = document.createElement('div');
    manualCategory.className = 'mining-category-container';
    const manualButtons = document.createElement('div');
    manualButtons.className = 'button-group';
    const mineStoneButton = document.createElement('button');
    mineStoneButton.className = 'image-button';
    mineStoneButton.textContent = 'Mine Stone';
    mineStoneButton.addEventListener('click', (event) => mineStone(event));
    setupTooltip(mineStoneButton, 'Gain 1 Stone');
    manualButtons.appendChild(mineStoneButton);
    manualCategory.appendChild(manualButtons);
    miningSection.appendChild(manualCategory);

    // --- Category 2: Production ---
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
    // TYPO FIX: Changed "isReserached" to "isResearched"
    const basicStorageTech = technologies.find(t => t.name === 'Basic Storage' && t.isResearched); 
    if (basicStorageTech) {
        const storageHeader = document.createElement('h2');
        storageHeader.textContent = 'Storage';
        storageHeader.className = 'section-header';
        miningSection.appendChild(storageHeader);
        const storageCategory = document.createElement('div');
        storageCategory.className = 'mining-category-container';
        const storageButtons = document.createElement('