import { resources, updateResourceInfo } from '../resources.js';
import { technologies } from '../data/technologies.js';
import { buildings } from '../data/buildings.js';
import { addLogEntry } from '../log.js';
import { setupTooltip } from '../main.js';

/**
 * A single, reusable function to handle purchasing any building.
 * It checks costs, deducts resources, and applies the building's effect.
 * @param {string} buildingName The name of the building to build.
 */
function buildBuilding(buildingName) {
    const building = buildings.find(b => b.name === buildingName);
    if (!building) {
        console.error(`Building ${buildingName} not found!`);
        return;
    }

    // --- Step 1: Check if the player can afford it ---
    let canAfford = true;
    for (const cost of building.cost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) {
            canAfford = false;
            addLogEntry(`Not enough ${cost.resource} to build a ${buildingName}.`, 'red');
            break; // Stop checking if we find one thing we can't afford
        }
    }

    // --- Step 2: If they can afford it, deduct resources and apply the effect ---
    if (canAfford) {
        // Deduct costs
        for (const cost of building.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }

        // Increment the building count
        building.count += 1;
        addLogEntry(`Built a new ${buildingName}!`, 'green');

        // --- Step 3: Apply the building's special effect (if it has one) ---
        if (building.effect) {
            if (building.effect.type === 'storage') {
                const resourceToUpgrade = resources.find(r => r.name === building.effect.resource);
                if (resourceToUpgrade) {
                    resourceToUpgrade.capacity += building.effect.value;
                    addLogEntry(`${resourceToUpgrade.name} capacity increased by ${building.effect.value}!`, 'blue');
                }
            }
        }
        
        // Finally, update the UI
        updateResourceInfo();
    }
}

export function setupMiningSection(miningSection) {
    if (!miningSection) {
        miningSection = document.getElementById('miningSection');
    }

    if (miningSection) {
        miningSection.innerHTML = '';
        miningSection.classList.add('mining-bg');

        // --- Category 1: Manual Gathering (Unchanged) ---
        const manualHeader = document.createElement('h2');
        manualHeader.textContent = 'Manual Gathering';
        manualHeader.className = 'section-header';
        miningSection.appendChild(manualHeader);
        const manualCategory = document.createElement('div');
        manualCategory.className = 'mining-category-container';
        const manualButtons = document.createElement('div');
        manualButtons.className = 'button-group';
        createMiningButton('Mine Stone', mineStone, manualButtons, 'Gain 1 Stone');
        manualCategory.appendChild(manualButtons);
        miningSection.appendChild(manualCategory);

        // --- Category 2: Mining (Unchanged) ---
        const miningHeader = document.createElement('h2');
        miningHeader.textContent = 'Mining';
        miningHeader.className = 'section-header';
        miningSection.appendChild(miningHeader);
        const miningCategory = document.createElement('div');
        miningCategory.className = 'mining-category-container';
        const miningButtons = document.createElement('div');
        miningButtons.className = 'button-group';
        const quarryData = buildings.find(b => b.name === 'Quarry');
        createMiningButton('Build Quarry', () => buildBuilding('Quarry'), miningButtons, quarryData);
        const xylite = resources.find(r => r.name === 'Xylite');
        if (xylite && xylite.isDiscovered) {
            const extractorData = buildings.find(b => b.name === 'Extractor');
            createMiningButton('Build Extractor', () => buildBuilding('Extractor'), miningButtons, extractorData);
        }
        miningCategory.appendChild(miningButtons);
        miningSection.appendChild(miningCategory);

        // --- FIXED: Category 3: Storage (Now checks for researched tech) ---
        const basicStorageTech = technologies.find(t => t.name === 'Basic Storage' && t.isResearched);
        const xyliteStorageTech = technologies.find(t => t.name === 'Xylite Storage' && t.isResearched);
        
        // Only show the Storage category if at least one of its buildings is unlocked
        if (basicStorageTech) {
            const storageHeader = document.createElement('h2');
            storageHeader.textContent = 'Storage';
            storageHeader.className = 'section-header';
            miningSection.appendChild(storageHeader);

            const storageCategory = document.createElement('div');
            storageCategory.className = 'mining-category-container';
            const storageButtons = document.createElement('div');
            storageButtons.className = 'button-group';

            // Check for Basic Storage tech before creating the button
            const stockpileData = buildings.find(b => b.name === 'Stone Stockpile');
            createMiningButton('Build Stone Stockpile', () => buildBuilding('Stone Stockpile'), storageButtons, stockpileData);

            // Check for Xylite Storage tech before creating the button
            if (xyliteStorageTech) {
                const siloData = buildings.find(b => b.name === 'Xylite Silo');
                createMiningButton('Build Xylite Silo', () => buildBuilding('Xylite Silo'), storageButtons, siloData);
            }
            
            storageCategory.appendChild(storageButtons);
            miningSection.appendChild(storageCategory);
        }
    }
}

function createMiningButton(buttonText, callback, container, tooltipData) {
    const button = document.createElement('button');
    button.className = 'game-button';
    button.textContent = buttonText;
    button.addEventListener('click', callback);

    if (tooltipData) {
        setupTooltip(button, tooltipData);
    }
    container.appendChild(button);
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

// The old buildQuarry and buildExtractor functions are no longer needed
// and can be deleted, since buildBuilding() handles everything.