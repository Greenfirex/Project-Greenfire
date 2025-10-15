import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { technologies } from '../data/technologies.js';
import { addLogEntry, LogType } from '../log.js';
import { setupTooltip, activatedSections, setActivatedSections, applyActivatedSections } from '../main.js';

let isMiningOnCooldown = false;

/**
 * Calculates the current cost of a building based on how many are owned.
 * @param {object} building - The building data object.
 * @returns {Array} - An array of the current costs.
 */
function getCurrentBuildingCost(building) {
    if (!building.costMultiplier) {
        return building.cost; // Return base cost if there's no multiplier
    }
    const currentCosts = [];
    building.cost.forEach(baseCost => {
        // Formula: NewCost = BaseCost * (Multiplier ^ AmountOwned)
        const currentAmount = Math.floor(baseCost.amount * Math.pow(building.costMultiplier, building.count));
        currentCosts.push({ resource: baseCost.resource, amount: currentAmount });
    });
    return currentCosts;
}

export function updateBuildingButtonsState() {
    buildings.forEach(building => {
        const button = document.querySelector(`.image-button[data-building="${building.name}"]`);
        if (!button) { return; }

        const currentCost = getCurrentBuildingCost(building);
        let canAfford = true;
        for (const cost of currentCost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) {
                canAfford = false;
                break;
            }
        }

        if (canAfford) {
            button.classList.remove('unaffordable');
        } else {
            button.classList.add('unaffordable');
        }
    });
}

function animateButtonClick(event) {
    const button = event.currentTarget;
    button.classList.add('is-clicking');
    setTimeout(() => {
        button.classList.remove('is-clicking');
    }, 200);
}

function createBuildingButton(building, container) {
    const button = document.createElement('button');
    button.className = 'image-button';
    button.dataset.building = building.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'building-count';
    countSpan.textContent = `(${building.count})`;
    button.appendChild(countSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'building-name';
    nameSpan.textContent = `Build ${building.name}`;
    button.appendChild(nameSpan);
    
    // Create a temporary object for the tooltip with the updated cost
    const tooltipData = { ...building, cost: getCurrentBuildingCost(building) };
    
    button.addEventListener('click', (event) => buildBuilding(event, building.name));
    setupTooltip(button, tooltipData);

    container.appendChild(button);
}

function buildBuilding(event, buildingName) {
    const building = buildings.find(b => b.name === buildingName);
    if (!building) { return; }

    const currentCost = getCurrentBuildingCost(building);
    let canAfford = true;
    for (const cost of currentCost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) {
            canAfford = false;
            addLogEntry(`Not enough ${cost.resource} to build a ${buildingName}.`, LogType.ERROR);
            break;
        }
    }

    if (canAfford) {
        animateButtonClick(event);

        for (const cost of currentCost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }

        building.count += 1;
        addLogEntry(`Built a new ${buildingName}!`, LogType.SUCCESS);

        if (building.effect && building.effect.type === 'storage') {
            const resourceToUpgrade = resources.find(r => r.name === building.effect.resource);
            if (resourceToUpgrade) {
                resourceToUpgrade.capacity += building.effect.value;
                addLogEntry(`${resourceToUpgrade.name} capacity increased by ${building.effect.value}!`, LogType.INFO);
            }
        }
		
		if (building.name === 'Laboratory' && building.count === 1) {
            if (!activatedSections.researchSection) {
                activatedSections.researchSection = true;
                setActivatedSections(activatedSections);
                applyActivatedSections();
                addLogEntry('The first Laboratory is operational. Research is now available.', LogType.UNLOCK);
            }
        }
        
        updateResourceInfo();
        setupColonySection(); // Note the rename here to avoid infinite loops if it was wrong
    }
}

export function setupColonySection(colonySection) {
    if (!colonySection) {
        colonySection = document.getElementById('colonySection');
    }
    if (!colonySection) { return; }

    colonySection.innerHTML = '';

    // --- Category 1: Manual Gathering ---
    const manualHeader = document.createElement('h2');
    manualHeader.textContent = 'Manual Gathering';
    manualHeader.className = 'section-header';
    colonySection.appendChild(manualHeader);
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
    colonySection.appendChild(manualCategory);

    // --- Category 2: Production ---
    const miningHeader = document.createElement('h2');
    miningHeader.textContent = 'Production';
    miningHeader.className = 'section-header';
    colonySection.appendChild(miningHeader);
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
    colonySection.appendChild(miningCategory);

    // --- Category 3: Storage ---
    const basicStorageTech = technologies.find(t => t.name === 'Basic Storage' && t.isResearched); 
    if (basicStorageTech) {
        const storageHeader = document.createElement('h2');
        storageHeader.textContent = 'Storage';
        storageHeader.className = 'section-header';
        colonySection.appendChild(storageHeader);
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
        colonySection.appendChild(storageCategory);
    }
	
	// --- Category 4: Science ---
    const laboratory = buildings.find(b => b.name === 'Laboratory');
    if (laboratory && laboratory.isUnlocked) {
        const scienceHeader = document.createElement('h2');
        scienceHeader.textContent = 'Science';
        scienceHeader.className = 'section-header';
        colonySection.appendChild(scienceHeader);
        const scienceCategory = document.createElement('div');
        scienceCategory.className = 'mining-category-container';
        const scienceButtons = document.createElement('div');
        scienceButtons.className = 'button-group';
        createBuildingButton(laboratory, scienceButtons);
        scienceCategory.appendChild(scienceButtons);
        colonySection.appendChild(scienceCategory);
    }

    updateBuildingButtonsState();
}

function mineStone(event) {
    // 1. Check if the button is on cooldown
    if (isMiningOnCooldown) {
        return;
    }
    // 2. Start the cooldown
    isMiningOnCooldown = true;

    animateButtonClick(event);
    const stone = resources.find(r => r.name === 'Stone');
    if (stone) {
        if (stone.amount >= stone.capacity) {
            addLogEntry('Stone storage is full!', LogType.ERROR);
        } else {
            stone.amount = Math.min(stone.amount + 1, stone.capacity);
            addLogEntry('Manually mined 1 Stone.', LogType.ACTION);
        }
        updateResourceInfo();
    }

    // 3. End the cooldown after 100ms
    setTimeout(() => {
        isMiningOnCooldown = false;
    }, 100); // 100ms cooldown
}