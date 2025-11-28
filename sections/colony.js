import { resources, updateResourceInfo } from '../core/resources.js';
import { buildings } from '../data/definitions/buildings.js';
import { technologies } from '../data/definitions/technologies.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import { createBuildingButton, updateBuildingButtonsState, rehydrateBuildingButton } from '../ui/components/buildingButtons.js';
import { getProgress } from '../data/buildingsManager.js';

let isMiningOnCooldown = false;
let colonyUiInterval = null;

export function startColonyLoop() {
    if (colonyUiInterval) return;
    colonyUiInterval = setInterval(() => {
        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? window.TIME_SCALE : 1;
        
        // Handle progress updates for actively building items FIRST
        document.querySelectorAll('.image-button[data-building]').forEach(btn => {
            const name = btn.dataset.building;
            const prog = getProgress(name);
            
            if (!prog) {
                // No active build - ensure button isn't stuck in running state
                if (btn.classList.contains('running')) {
                    btn.classList.remove('running');
                    const bar = btn.querySelector('.action-progress-bar');
                    if (bar) bar.style.width = '0%';
                    const labelEl = btn.querySelector('.building-name');
                    if (labelEl && btn.dataset.originalLabel) {
                        labelEl.textContent = btn.dataset.originalLabel;
                        delete btn.dataset.originalLabel;
                    }
                }
                return;
            }
            
            // Active build - update progress bar and countdown
            const bar = btn.querySelector('.action-progress-bar');
            const labelEl = btn.querySelector('.building-name');
            const pct = Math.min((prog.elapsedSec / Math.max(1e-9, prog.durationSec)) * 100, 100);
            if (bar) bar.style.width = `${pct}%`;
            if (labelEl) {
                const rem = Math.max(0, (prog.durationSec - (prog.elapsedSec || 0)) / Math.max(1e-9, timeScale));
                labelEl.textContent = `${rem.toFixed(1)}s`;
            }
            // ensure running state visually
            btn.classList.add('running');
            btn.disabled = true;
        });
        
        // THEN update all building affordability states (this will re-enable non-running affordable buttons)
        updateBuildingButtonsState(document);
    }, 100);
}

export function stopColonyLoop() {
    if (colonyUiInterval) { clearInterval(colonyUiInterval); colonyUiInterval = null; }
}

export function setupColonySection(colonySection) {
    if (!colonySection) {
        colonySection = document.getElementById('colonySection');
    }
    if (!colonySection) { return; }

    // Reuse existing content panel like Crash Site to better preserve nodes
    let contentPanel = colonySection.querySelector('.content-panel');
    if (!contentPanel) {
        contentPanel = document.createElement('div');
        contentPanel.className = 'content-panel';
        colonySection.appendChild(contentPanel);
    }
    // Don't clear innerHTML - preserve existing buttons and only update them
    // Only clear if completely empty OR if we need to show new unlocked buildings
    const shouldRebuild = contentPanel.children.length === 0;

    if (shouldRebuild) {
        // --- Category 1: Manual Gathering ---
        const manualHeader = document.createElement('h2');
        manualHeader.textContent = 'Manual Gathering';
        manualHeader.className = 'section-header';
        contentPanel.appendChild(manualHeader);
    const manualCategory = document.createElement('div');
    manualCategory.className = 'mining-category-container';
    const manualButtons = document.createElement('div');
    manualButtons.className = 'button-group';
    const mineCrystalButton = document.createElement('button');
    mineCrystalButton.className = 'image-button';
    mineCrystalButton.innerHTML = `
        <div class="action-progress-bar"></div>
        <span class="building-name">Mine Crystal</span>
    `;
    mineCrystalButton.addEventListener('click', (event) => mineCrystal(event));
    setupTooltip(mineCrystalButton, 'Gain 1 Crystal');
    manualButtons.appendChild(mineCrystalButton);
    manualCategory.appendChild(manualButtons);
    contentPanel.appendChild(manualCategory);

    // --- Category 2: Production ---
    const miningHeader = document.createElement('h2');
    miningHeader.textContent = 'Production';
    miningHeader.className = 'section-header';
    contentPanel.appendChild(miningHeader);
    const miningCategory = document.createElement('div');
    miningCategory.className = 'mining-category-container';
    const miningButtons = document.createElement('div');
    miningButtons.className = 'button-group';
    const quarry = buildings.find(b => b.name === 'Quarry');
    rehydrateBuildingButton(createBuildingButton(quarry, miningButtons), quarry?.name);
    const xylite = resources.find(r => r.name === 'Xylite');
    if (xylite && xylite.isDiscovered) {
        const ext = buildings.find(b => b.name === 'Extractor');
        rehydrateBuildingButton(createBuildingButton(ext, miningButtons), ext?.name);
    }
    // Add colony production buildings
    const productionBuildings = buildings.filter(b => 
        ['Foraging Camp', 'Water Station', 'Rain Tarp'].includes(b.name) && b.isUnlocked
    );
    productionBuildings.forEach(b => {
        rehydrateBuildingButton(createBuildingButton(b, miningButtons), b.name);
    });
    miningCategory.appendChild(miningButtons);
    contentPanel.appendChild(miningCategory);

    // --- Category 4: Storage ---
    const basicStorageTech = technologies.find(t => t.name === 'Basic Storage' && t.isResearched); 
    if (basicStorageTech) {
        const storageHeader = document.createElement('h2');
        storageHeader.textContent = 'Storage';
        storageHeader.className = 'section-header';
        contentPanel.appendChild(storageHeader);
        const storageCategory = document.createElement('div');
        storageCategory.className = 'mining-category-container';
        const storageButtons = document.createElement('div');
        storageButtons.className = 'button-group';
        const cs = buildings.find(b => b.name === 'Crystal Stockpile');
        rehydrateBuildingButton(createBuildingButton(cs, storageButtons), cs?.name);
        const xyliteStorageTech = technologies.find(t => t.name === 'Xylite Storage' && t.isResearched);
        if (xyliteStorageTech) {
            const xs = buildings.find(b => b.name === 'Xylite Silo');
            rehydrateBuildingButton(createBuildingButton(xs, storageButtons), xs?.name);
        }
        storageCategory.appendChild(storageButtons);
        contentPanel.appendChild(storageCategory);
    }
    
    // Add Food Larder and Water Reservoir to Storage (always show if unlocked)
    const storageBuildings = buildings.filter(b => 
        ['Food Larder', 'Water Reservoir'].includes(b.name) && b.isUnlocked
    );
    if (storageBuildings.length > 0) {
        // If Storage category wasn't created yet (no Basic Storage tech), create it now
        if (!basicStorageTech) {
            const storageHeader = document.createElement('h2');
            storageHeader.textContent = 'Storage';
            storageHeader.className = 'section-header';
            contentPanel.appendChild(storageHeader);
            const storageCategory = document.createElement('div');
            storageCategory.className = 'mining-category-container';
            const storageButtons = document.createElement('div');
            storageButtons.className = 'button-group';
            storageBuildings.forEach(building => {
                createBuildingButton(building, storageButtons);
            });
            storageCategory.appendChild(storageButtons);
            contentPanel.appendChild(storageCategory);
        } else {
            // Add to existing storage buttons
            const existingStorageCategory = contentPanel.querySelector('.mining-category-container:last-of-type');
            const existingStorageButtons = existingStorageCategory?.querySelector('.button-group');
            if (existingStorageButtons) {
                storageBuildings.forEach(b => {
                    rehydrateBuildingButton(createBuildingButton(b, existingStorageButtons), b.name);
                });
            }
        }
    }
	
	// --- Category 5: Science ---
    const laboratory = buildings.find(b => b.name === 'Laboratory');
    if (laboratory && laboratory.isUnlocked) {
        const scienceHeader = document.createElement('h2');
        scienceHeader.textContent = 'Science';
        scienceHeader.className = 'section-header';
        contentPanel.appendChild(scienceHeader);
        const scienceCategory = document.createElement('div');
        scienceCategory.className = 'mining-category-container';
        const scienceButtons = document.createElement('div');
        scienceButtons.className = 'button-group';
        rehydrateBuildingButton(createBuildingButton(laboratory, scienceButtons), laboratory.name);
        scienceCategory.appendChild(scienceButtons);
        contentPanel.appendChild(scienceCategory);
    }
    }  // End of shouldRebuild block

    // Ensure panel is attached (it already is if reused)
    if (!contentPanel.parentElement) {
        colonySection.appendChild(contentPanel);
    }

    updateBuildingButtonsState();
    startColonyLoop();
}

function mineCrystal(event) {
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
    
    // 2. Start the cooldown and disable button
    isMiningOnCooldown = true;
    const button = event.currentTarget;
    button.disabled = true;
    
    const bar = button.querySelector('.action-progress-bar');
    const label = button.querySelector('.building-name');
    
    // Reset progress bar instantly without transition
    if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth; // Force reflow
        bar.style.transition = ''; // Restore CSS transition
    }
    
    const duration = 2.0; // 2 seconds
    let elapsed = 0;
    
    // Update progress every 100ms
    const progressInterval = setInterval(() => {
        elapsed += 0.1;
        const progress = Math.min((elapsed / duration) * 100, 100);
        const remaining = Math.max(0, duration - elapsed);
        
        if (bar) bar.style.width = `${progress}%`;
        if (label) label.textContent = `${remaining.toFixed(1)}s`;
        
        if (elapsed >= duration) {
            clearInterval(progressInterval);
            completeMining(button, bar, label);
        }
    }, 100);
}

function completeMining(button, bar, label) {
    const crystal = resources.find(r => r.name === 'Crystal');
    if (crystal) {
        if (crystal.amount >= crystal.capacity) {
            addLogEntry('Crystal storage is full!', LogType.ERROR);
        } else {
            crystal.amount = Math.min(crystal.amount + 1, crystal.capacity);
            addLogEntry('Manually mined 1 Crystal.', LogType.ACTION);
        }
        updateResourceInfo();
        try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }
    }
    
    // Reset button state
    if (bar) bar.style.width = '0%';
    if (label) label.textContent = 'Mine Crystal';
    button.disabled = false;
    isMiningOnCooldown = false;
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
    
    // Re-render Colony on building completion so counts and availability refresh
    window.addEventListener('building-complete', () => {
        try { 
            // Force rebuild to show newly unlocked buildings
            const panel = document.querySelector('#colonySection .content-panel');
            if (panel) panel.innerHTML = '';
            setupColonySection(); 
        } catch (e) { /* ignore */ }
    });
}