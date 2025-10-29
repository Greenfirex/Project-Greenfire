import { resources, updateResourceInfo } from '../resources.js';
import { buildings } from '../data/buildings.js';
import { technologies } from '../data/technologies.js';
import { addLogEntry, LogType } from '../log.js';
import { activatedSections, setActivatedSections, applyActivatedSections } from '../main.js';
import { setupTooltip, refreshCurrentTooltip } from '../tooltip.js';
import { addSlotsForBuilding } from '../data/jobs.js';
import { salvageActions } from '../data/actions.js';

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

let _updateBuildingButtonsStateTimer = null;
export function updateBuildingButtonsState(immediate = false) {
    if (!immediate) {
        if (_updateBuildingButtonsStateTimer) clearTimeout(_updateBuildingButtonsStateTimer);
        _updateBuildingButtonsStateTimer = setTimeout(() => updateBuildingButtonsState(true), 40);
        return;
    }
    _updateBuildingButtonsStateTimer = null;

    buildings.forEach(building => {
        const button = document.querySelector(`.image-button[data-building="${building.name}"]`);
        if (!button) return;

        const countEl = button.querySelector('.building-count');
        const desiredCount = `(${building.count})`;
        if (countEl && countEl.textContent !== desiredCount) countEl.textContent = desiredCount;

        const nameEl = button.querySelector('.building-name');
        if (nameEl && nameEl.textContent !== building.name) nameEl.textContent = building.name;

        const currentCost = getCurrentBuildingCost(building);
        let canAfford = true;
        for (const cost of currentCost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) { canAfford = false; break; }
        }

        if (canAfford) {
            button.classList.remove('unaffordable');
            button.removeAttribute('aria-disabled');
        } else {
            button.classList.add('unaffordable');
            button.setAttribute('aria-disabled', 'true');
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

export function createBuildingButton(building, container) {
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

    // register tooltip with a function so cost is computed on-demand (keeps it up-to-date)
    const tooltipGetter = () => ({ ...building, cost: getCurrentBuildingCost(building) });

    // determine initial affordability BEFORE appending to DOM
    const currentCost = getCurrentBuildingCost(building);
    let canAfford = true;
    for (const cost of currentCost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) { canAfford = false; break; }
    }
    if (!canAfford) {
        button.classList.add('unaffordable');
        button.setAttribute('aria-disabled', 'true');
    }

    button.addEventListener('click', (event) => buildBuilding(event, building.name));
    setupTooltip(button, tooltipGetter);

    container.appendChild(button);
    return button;
}

export function buildBuilding(event, buildingName) {
    const building = buildings.find(b => b.name === buildingName);
    if (!building) return false;

    // Prevent building while game is paused (persisted in localStorage)
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry(`Cannot build "${buildingName}" while game is paused. Resume the game first.`, LogType.INFO);
            return false;
        }
    } catch (e) { /* ignore localStorage errors */ }

    const currentCost = getCurrentBuildingCost(building);
    // Check affordability
    for (const cost of currentCost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) {
            addLogEntry(`Not enough ${cost.resource} to build a ${buildingName}.`, LogType.ERROR);
            return false;
        }
    }

    // animate only when a DOM event was passed (Crash Site calls buildBuilding programmatically)
    if (event && event.currentTarget) animateButtonClick(event);

    // Deduct costs
    for (const cost of currentCost) {
        const resource = resources.find(r => r.name === cost.resource);
        if (resource) resource.amount -= cost.amount;
    }
    // update any visible tooltip (ETA/shortfall) immediately
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

    // Build
    building.count += 1;
    addLogEntry(`Built a new ${buildingName}!`, LogType.SUCCESS);

    // Unlock upgrades tied to first-build of some structures
    if (building.name === 'Foraging Camp' && building.count === 1) {
        const act = (salvageActions || []).find(a => a.id === 'installForagingTools' || a.name === 'Crude Foraging Tools');
        if (act && !act.isUnlocked) {
            act.isUnlocked = true;
            addLogEntry('Upgrade available: Crude Foraging Tools', LogType.UNLOCK);
            // refresh crash-site UI so the newly unlocked upgrade appears immediately
        if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
            window.setupCrashSiteSection();
        }
    }
        // Unlock Food Larder building (storage for Food Rations)
        const foodLarder = buildings.find(b => b.name === 'Food Larder');
        if (foodLarder && !foodLarder.isUnlocked) {
            foodLarder.isUnlocked = true;
            addLogEntry('New building available: Food Larder', LogType.UNLOCK);
            try { setupColonySection(); } catch (e) { if (typeof window !== 'undefined' && window.setupColonySection) window.setupColonySection(); }
            // refresh other UIs so Crash Site and global buttons show the new building immediately
            if (typeof window !== 'undefined') {
                if (typeof window.setupCrashSiteSection === 'function') {
                    try { window.setupCrashSiteSection(); } catch (e) { /* ignore */ }
                }
                if (typeof window.updateBuildingButtonsState === 'function') {
                    try { window.updateBuildingButtonsState(); } catch (e) { /* ignore */ }
                }
                if (typeof window.setupColonySection === 'function') {
                    try { window.setupColonySection(); } catch (e) { /* ignore */ }
                }
            }
        }
    }

    // Unlock Rain Catchers when a Water Station is built AND Fabric has been discovered
    if (building.name === 'Water Station' && building.count === 1) {
        const fabricRes = (typeof resources !== 'undefined' ? resources : []).find(r => r.name === 'Fabric');
        const act = (salvageActions || []).find(a => a.id === 'installRainCatchers');
        // only unlock immediately if Fabric has actually been discovered
        if (fabricRes && fabricRes.isDiscovered && act && !act.isUnlocked) {
            act.isUnlocked = true;
            addLogEntry('Upgrade available: Rain Catchers', LogType.UNLOCK);
            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') window.setupCrashSiteSection();
        } else if (act && !act.isUnlocked) {
            // Fabric not discovered yet — register a one-time listener to unlock when Fabric is discovered
            if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                const onDiscover = (ev) => {
                    if (!ev || !ev.detail || ev.detail.name !== 'Fabric') return;
                    const fr = resources.find(r => r.name === 'Fabric');
                    if (fr && fr.isDiscovered && act && !act.isUnlocked) {
                        act.isUnlocked = true;
                        addLogEntry('Upgrade available: Rain Catchers', LogType.UNLOCK);
                        if (typeof window.setupCrashSiteSection === 'function') window.setupCrashSiteSection();
                    }
                };
                window.addEventListener('resourceDiscovered', onDiscover);
            }
        }
        // Unlock Water Reservoir building (storage for Clean Water)
        const waterReservoir = buildings.find(b => b.name === 'Water Reservoir');
        if (waterReservoir && !waterReservoir.isUnlocked) {
            // only make it available if Fabric has been discovered (same gating as rain catchers)
            const refreshColonyUI = () => {
                // try local then global helpers; also refresh crash-site and button state
                try { if (typeof setupColonySection === 'function') setupColonySection(); } catch (e) {}
                if (typeof window !== 'undefined') {
                    if (typeof window.setupColonySection === 'function') try { window.setupColonySection(); } catch (e) {}
                    if (typeof window.setupCrashSiteSection === 'function') try { window.setupCrashSiteSection(); } catch (e) {}
                    if (typeof window.updateBuildingButtonsState === 'function') try { window.updateBuildingButtonsState(); } catch (e) {}
                }
            };

            if (fabricRes && fabricRes.isDiscovered) {
                waterReservoir.isUnlocked = true;
                addLogEntry('New building available: Water Reservoir', LogType.UNLOCK);
                refreshColonyUI();
            } else {
                // register a one-time unlock when Fabric is discovered
                if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                    const onDiscoverReservoir = (ev) => {
                        if (!ev || !ev.detail || ev.detail.name !== 'Fabric') return;
                        const fr = resources.find(r => r.name === 'Fabric');
                        if (fr && fr.isDiscovered && waterReservoir && !waterReservoir.isUnlocked) {
                            waterReservoir.isUnlocked = true;
                            addLogEntry('New building available: Water Reservoir', LogType.UNLOCK);
                            refreshColonyUI();
                        }
                        window.removeEventListener('resourceDiscovered', onDiscoverReservoir);
                    };
                    window.addEventListener('resourceDiscovered', onDiscoverReservoir);
                }
            }
        }
    }

    // Handle job-unlock buildings
    if (building.effect && building.effect.type === 'job') {
        try {
            // addSlotsForBuilding expects the building.name (e.g. "Water Station")
            addSlotsForBuilding(building.name, 1);
            addLogEntry(`New job slot available: ${building.name} (from ${building.name}).`, LogType.UNLOCK);
            if (typeof updateCrewSection === 'function') updateCrewSection();
        } catch (e) { /* ignore */ }
    }

    // Handle storage effect
    if (building.effect && building.effect.type === 'storage') {
        const resourceToUpgrade = resources.find(r => r.name === building.effect.resource);
        if (resourceToUpgrade) {
            resourceToUpgrade.capacity += building.effect.value;
            addLogEntry(`${resourceToUpgrade.name} capacity increased by ${building.effect.value}!`, LogType.INFO);
        }
    }

    // Laboratory unlock handling
    if (building.name === 'Laboratory' && building.count === 1) {
        if (!activatedSections.researchSection) {
            activatedSections.researchSection = true;
            setActivatedSections(activatedSections);
            applyActivatedSections();
            addLogEntry('The first Laboratory is operational. Research is now available.', LogType.UNLOCK);
        }
    }

    updateResourceInfo();
    setupColonySection();
    return true;
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
        // Add Food Larder / Water Reservoir buttons if the buildings are available/unlocked
        const foodLarder = buildings.find(b => b.name === 'Food Larder');
        if (foodLarder && foodLarder.isUnlocked) createBuildingButton(foodLarder, storageButtons);
        const waterReservoir = buildings.find(b => b.name === 'Water Reservoir');
        if (waterReservoir && waterReservoir.isUnlocked) createBuildingButton(waterReservoir, storageButtons);
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
    // Prevent manual actions while paused
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry('Cannot mine while game is paused. Resume the game first.', LogType.INFO);
            return;
        }
    } catch (e) { /* ignore localStorage errors */ }

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
        try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }
    }

    // 3. End the cooldown after 100ms
    setTimeout(() => {
        isMiningOnCooldown = false;
    }, 100); // 100ms cooldown
}

// Listen for UI refresh requests from other modules (e.g. upgrade completion handlers)
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('refreshColonyUI', (ev) => {
        // prefer direct call to setupColonySection if available in this module
        if (typeof setupColonySection === 'function') {
            try { setupColonySection(); } catch (e) { /* ignore */ }
        } else {
            // fallback: try other exposed helpers
            if (typeof window.setupColonySection === 'function') {
                try { window.setupColonySection(); } catch (e) { /* ignore */ }
            }
        }
    });
}