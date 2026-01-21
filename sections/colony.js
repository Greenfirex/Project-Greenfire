import { resources, updateResourceInfo } from '../core/resources.js';
import { buildings } from '../data/definitions/buildings.js';
import { technologies } from '../data/definitions/technologies.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { setupTooltip, refreshCurrentTooltip } from '../ui/panels/tooltip.js';
import { createBuildingButton, updateBuildingButtonsState, rehydrateBuildingButton } from '../ui/components/buildingButtons.js';
import { getProgress } from '../data/buildingsManager.js';
import { gameFlags } from '../data/gameFlags.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../ui/components/contentNewBadges.js';

let isMiningOnCooldown = false;
let isSalvagingOnCooldown = false;
let isCargoBayOnCooldown = false;
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
    // Don't clear innerHTML - preserve existing buttons and only update them.
    // Rebuild if completely empty OR if a newly-unlocked UI element has no button yet.
    const hasMissingUnlockedBuildingButton = (buildings || []).some(b => {
        if (!b || !b.isUnlocked) return false;
        try {
            const selectorName = (typeof CSS !== 'undefined' && CSS.escape) ? CSS.escape(b.name) : String(b.name).replace(/"/g, '\\"');
            return !contentPanel.querySelector(`.image-button[data-building="${selectorName}"]`);
        } catch {
            return !contentPanel.querySelector(`.image-button[data-building="${String(b.name).replace(/"/g, '\\"')}"]`);
        }
    });

    // Also rebuild if manual/action buttons should appear/disappear (not covered by building checks).
    let hasMissingUnlockedActionButton = false;
    try {
        const workforce = (technologies || []).find(t => t && t.name === 'Workforce');
        const hasWorkforce = !!(workforce && workforce.isResearched);
        const clears = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
        const reached = !!gameFlags.cargoBayReached || clears >= 5;
        const shouldHaveCargoBayButton = hasWorkforce && !reached;
        const hasCargoBayButton = !!contentPanel.querySelector('.image-button[data-action-id="cargoBayRoute"]');
        if (shouldHaveCargoBayButton !== hasCargoBayButton) hasMissingUnlockedActionButton = true;
    } catch { /* non-fatal */ }

    const shouldRebuild = contentPanel.children.length === 0 || hasMissingUnlockedBuildingButton || hasMissingUnlockedActionButton;

    if (shouldRebuild) {
        // If we already rendered once, clear so we don't duplicate categories.
        if (contentPanel.children.length > 0) {
            contentPanel.innerHTML = '';
        }
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
    setupTooltip(mineCrystalButton, `
        <h4>Mine Crystal</h4>
        <p class="tooltip-description">Manually extract raw crystal from nearby deposits.</p>
        <div class="tooltip-section"><h4>Reward</h4><p>Crystal: <span class="reward-amount">+1</span></p></div>
        <div class="tooltip-section"><p>Duration: 2s</p></div>
    `);
    manualButtons.appendChild(mineCrystalButton);

    manualCategory.appendChild(manualButtons);
    contentPanel.appendChild(manualCategory);

    // --- Category 2: Ship Salvage ---
    const salvageHeader = document.createElement('h2');
    salvageHeader.textContent = 'Ship Salvage';
    salvageHeader.className = 'section-header';
    contentPanel.appendChild(salvageHeader);

    const salvageCategory = document.createElement('div');
    salvageCategory.className = 'mining-category-container';
    const salvageButtons = document.createElement('div');
    salvageButtons.className = 'button-group';

    const salvageVineaButton = document.createElement('button');
    salvageVineaButton.className = 'image-button';
    salvageVineaButton.innerHTML = `
        <div class="action-progress-bar"></div>
        <span class="building-name">Salvage Vinea-IV</span>
    `;
    salvageVineaButton.addEventListener('click', (event) => salvageVinea(event));
    setupTooltip(salvageVineaButton, `
        <h4>Salvage Vinea-IV</h4>
        <p class="tooltip-description">Scavenge the surface for ship debris and usable materials.</p>
        <div class="tooltip-section"><h4>Reward</h4>
            <p>Metal Parts: <span class="reward-amount">+2 to +5</span> (guaranteed)</p>
            <p>Wire: <span class="reward-amount">+1 to +2</span> (25% chance)</p>
            <p>Fabric: <span class="reward-amount">+1</span> (10% chance)</p>
            <p>Chemicals: <span class="reward-amount">+1</span> (3% chance)</p>
        </div>
        <div class="tooltip-section"><p>Duration: 2.5s</p></div>
    `);
    salvageButtons.appendChild(salvageVineaButton);

    // Workforce-gated action: Clear route to Cargo Bay (5 steps)
    const workforce = (technologies || []).find(t => t && t.name === 'Workforce');
    const hasWorkforce = !!(workforce && workforce.isResearched);
    const clears = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
    const reached = !!gameFlags.cargoBayReached || clears >= 5;
    if (hasWorkforce && !reached) {
        const cargoBtn = document.createElement('button');
        cargoBtn.className = 'image-button';
        cargoBtn.dataset.actionId = 'cargoBayRoute';
        cargoBtn.innerHTML = `
            <div class="action-progress-bar"></div>
            ${newBadgeHtml(!!gameFlags.cargoBayRouteUiNew)}
            <span class="building-count">(${clears}/5)</span>
            <span class="building-name">Clear Route to Cargo Bay</span>
        `;
        cargoBtn.addEventListener('click', (event) => clearRouteToCargoBay(event));

        // Clear "new" badge after the player notices the button (persist quietly).
        if (gameFlags.cargoBayRouteUiNew) wireClearUiNewBadge(cargoBtn, { legacyObj: gameFlags, legacyProp: 'cargoBayRouteUiNew' });

        setupTooltip(cargoBtn, () => {
            const c = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
            return `
                <h4>Clear Route to Cargo Bay</h4>
                <p class="tooltip-description">Your crew is digging a tunnel through collapsed bulkheads to reach the ship's Cargo Bay.</p>
                <div class="tooltip-section"><h4>Progress</h4><p>${c}/5</p></div>
                <div class="tooltip-section"><h4>Cost</h4>
                    <p>Food Rations: <span class="reward-amount">-250</span></p>
                    <p>Clean Water: <span class="reward-amount">-300</span></p>
                </div>
                <div class="tooltip-section"><p>Duration: 8s</p></div>
            `;
        });
        salvageButtons.appendChild(cargoBtn);
    }

    salvageCategory.appendChild(salvageButtons);
    contentPanel.appendChild(salvageCategory);

    // --- Category 3: Production ---
    const miningHeader = document.createElement('h2');
    miningHeader.textContent = 'Production';
    miningHeader.className = 'section-header';
    contentPanel.appendChild(miningHeader);
    const miningCategory = document.createElement('div');
    miningCategory.className = 'mining-category-container';
    const miningButtons = document.createElement('div');
    miningButtons.className = 'button-group';
    const quarry = buildings.find(b => b.name === 'Quarry');
    if (quarry && quarry.isUnlocked) {
        rehydrateBuildingButton(createBuildingButton(quarry, miningButtons), quarry?.name);
    }
    const xylite = resources.find(r => r.name === 'Xylite');
    if (xylite && xylite.isDiscovered) {
        const ext = buildings.find(b => b.name === 'Extractor');
        if (ext && ext.isUnlocked) {
            rehydrateBuildingButton(createBuildingButton(ext, miningButtons), ext?.name);
        }
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
    const fieldLab = buildings.find(b => b.name === 'Field Lab');
    const workshop = buildings.find(b => b.name === 'Workshop');
    if ((laboratory && laboratory.isUnlocked) || (fieldLab && fieldLab.isUnlocked) || (workshop && workshop.isUnlocked)) {
        const scienceHeader = document.createElement('h2');
        scienceHeader.textContent = 'Science';
        scienceHeader.className = 'section-header';
        contentPanel.appendChild(scienceHeader);
        const scienceCategory = document.createElement('div');
        scienceCategory.className = 'mining-category-container';
        const scienceButtons = document.createElement('div');
        scienceButtons.className = 'button-group';
        if (fieldLab && fieldLab.isUnlocked) {
            rehydrateBuildingButton(createBuildingButton(fieldLab, scienceButtons), fieldLab.name);
        }
        if (laboratory && laboratory.isUnlocked) {
            rehydrateBuildingButton(createBuildingButton(laboratory, scienceButtons), laboratory.name);
        }
        if (workshop && workshop.isUnlocked) {
            rehydrateBuildingButton(createBuildingButton(workshop, scienceButtons), workshop.name);
        }
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
    
    const durationIngameSec = 2.0;
    let elapsedIngameSec = 0;
    let lastTickAt = Date.now();

    const progressInterval = setInterval(() => {
        const now = Date.now();
        const dtReal = Math.max(0, (now - lastTickAt) / 1000);
        lastTickAt = now;

        // Pause safety: do not advance while paused.
        try {
            if (localStorage.getItem('gamePaused') === 'true') return;
        } catch { /* ignore */ }

        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1;
        const ts = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
        elapsedIngameSec += dtReal * ts;

        const progress = Math.min((elapsedIngameSec / Math.max(1e-9, durationIngameSec)) * 100, 100);
        const remainingReal = Math.max(0, (durationIngameSec - elapsedIngameSec) / ts);

        if (bar) bar.style.width = `${progress}%`;
        if (label) label.textContent = `${remainingReal.toFixed(1)}s`;

        if (elapsedIngameSec >= durationIngameSec) {
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
            let debugMul = 1;
            try {
                if (typeof window !== 'undefined' && window.DEBUG_RESOURCE_GAIN === 10) debugMul = 10;
            } catch { /* ignore */ }
            const amt = Math.max(0, Math.floor(1 * debugMul));
            const before = Number(crystal.amount) || 0;
            const cap = Number(crystal.capacity);
            const canCap = Number.isFinite(cap) ? cap : Number.POSITIVE_INFINITY;
            const next = Math.min(before + amt, canCap);
            crystal.amount = next;
            const gained = Math.max(0, next - before);
            if (gained > 0) addLogEntry(`Manually mined ${gained} Crystal.`, LogType.ACTION);
            else addLogEntry('Crystal storage is full!', LogType.ERROR);
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

function salvageVinea(event) {
    // Prevent manual actions while paused
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry('Cannot salvage while game is paused. Resume the game first.', LogType.INFO);
            return;
        }
    } catch (e) { /* ignore localStorage errors */ }

    if (isSalvagingOnCooldown) return;

    isSalvagingOnCooldown = true;
    const button = event.currentTarget;
    button.disabled = true;

    const bar = button.querySelector('.action-progress-bar');
    const label = button.querySelector('.building-name');

    if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.style.transition = '';
    }

    const durationIngameSec = 2.5;
    let elapsedIngameSec = 0;
    let lastTickAt = Date.now();
    const progressInterval = setInterval(() => {
        const now = Date.now();
        const dtReal = Math.max(0, (now - lastTickAt) / 1000);
        lastTickAt = now;

        // Pause safety: do not advance while paused.
        try {
            if (localStorage.getItem('gamePaused') === 'true') return;
        } catch { /* ignore */ }

        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1;
        const ts = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
        elapsedIngameSec += dtReal * ts;

        const progress = Math.min((elapsedIngameSec / Math.max(1e-9, durationIngameSec)) * 100, 100);
        const remainingReal = Math.max(0, (durationIngameSec - elapsedIngameSec) / ts);

        if (bar) bar.style.width = `${progress}%`;
        if (label) label.textContent = `${remainingReal.toFixed(1)}s`;

        if (elapsedIngameSec >= durationIngameSec) {
            clearInterval(progressInterval);
            completeSalvageVinea(button, bar, label);
        }
    }, 100);
}

function addResourceClamped(resourceName, amount) {
    const res = resources.find(r => r && r.name === resourceName);
    if (!res) return 0;
    const before = Number(res.amount) || 0;
    const cap = Number(res.capacity);
    const canCap = Number.isFinite(cap) ? cap : Number.POSITIVE_INFINITY;
    const next = Math.min(before + (Number(amount) || 0), canCap);
    res.amount = next;
    return Math.max(0, next - before);
}

function completeSalvageVinea(button, bar, label) {
    let debugMul = 1;
    try {
        if (typeof window !== 'undefined' && window.DEBUG_RESOURCE_GAIN === 10) debugMul = 10;
    } catch { /* ignore */ }

    // Guaranteed Metal Parts (2-5)
    const metalRoll = (2 + Math.floor(Math.random() * 4)) * debugMul;
    const gained = {
        metal: addResourceClamped('Metal Parts', Math.floor(metalRoll)),
        wire: 0,
        fabric: 0,
        chem: 0,
    };

    // Lower chance of Wire (25%) (1-2)
    if (Math.random() < 0.25) {
        const wireRoll = (1 + Math.floor(Math.random() * 2)) * debugMul;
        gained.wire = addResourceClamped('Wire', Math.floor(wireRoll));
    }

    // Even lower chance of Fabric (10%) (1)
    if (Math.random() < 0.10) {
        gained.fabric = addResourceClamped('Fabric', Math.floor(1 * debugMul));
    }

    // Very low chance of Chemicals (3%) (1)
    if (Math.random() < 0.03) {
        gained.chem = addResourceClamped('Chemicals', Math.floor(1 * debugMul));
    }

    const parts = [];
    if (gained.metal > 0) parts.push(`+${gained.metal} Metal Parts`);
    if (gained.wire > 0) parts.push(`+${gained.wire} Wire`);
    if (gained.fabric > 0) parts.push(`+${gained.fabric} Fabric`);
    if (gained.chem > 0) parts.push(`+${gained.chem} Chemicals`);

    if (parts.length) {
        addLogEntry(`Salvaged Vinea-IV: ${parts.join(', ')}.`, LogType.ACTION);
    } else {
        addLogEntry('Salvage yielded nothing usable (storage may be full).', LogType.INFO);
    }

    updateResourceInfo();
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

    if (bar) bar.style.width = '0%';
    if (label) label.textContent = 'Salvage Vinea-IV';
    button.disabled = false;
    isSalvagingOnCooldown = false;
}

function canPayCargoBayCosts() {
    const food = resources.find(r => r && r.name === 'Food Rations');
    const water = resources.find(r => r && r.name === 'Clean Water');
    if (!food || !water) return { ok: false, reason: 'Missing required resources.' };
    if ((Number(food.amount) || 0) < 250) return { ok: false, reason: 'Not enough Food Rations.' };
    if ((Number(water.amount) || 0) < 300) return { ok: false, reason: 'Not enough Clean Water.' };
    return { ok: true };
}

function payCargoBayCosts() {
    const food = resources.find(r => r && r.name === 'Food Rations');
    const water = resources.find(r => r && r.name === 'Clean Water');
    if (food) food.amount = Math.max(0, (Number(food.amount) || 0) - 250);
    if (water) water.amount = Math.max(0, (Number(water.amount) || 0) - 300);
}

function clearRouteToCargoBay(event) {
    // Prevent manual actions while paused
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry('Cannot work while game is paused. Resume the game first.', LogType.INFO);
            return;
        }
    } catch (e) { /* ignore localStorage errors */ }

    if (isCargoBayOnCooldown) return;
    if (gameFlags.cargoBayReached) return;

    const workforce = (technologies || []).find(t => t && t.name === 'Workforce');
    if (!workforce || !workforce.isResearched) {
        addLogEntry('You need Workforce research to organize a salvage crew.', LogType.INFO);
        return;
    }

    const check = canPayCargoBayCosts();
    if (!check.ok) {
        addLogEntry(check.reason || 'Not enough resources.', LogType.ERROR);
        return;
    }

    isCargoBayOnCooldown = true;
    const button = event.currentTarget;
    button.disabled = true;

    // Deduct costs up-front (like Crash Site actions)
    payCargoBayCosts();
    updateResourceInfo();
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

    const bar = button.querySelector('.action-progress-bar');
    const countEl = button.querySelector('.building-count');
    const label = button.querySelector('.building-name');

    if (bar) {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        void bar.offsetWidth;
        bar.style.transition = '';
    }

    const durationIngameSec = 8.0;
    let elapsedIngameSec = 0;
    let lastTickAt = Date.now();
    const progressInterval = setInterval(() => {
        const now = Date.now();
        const dtReal = Math.max(0, (now - lastTickAt) / 1000);
        lastTickAt = now;

        // Pause safety: do not advance while paused.
        try {
            if (localStorage.getItem('gamePaused') === 'true') return;
        } catch { /* ignore */ }

        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1;
        const ts = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
        elapsedIngameSec += dtReal * ts;

        const progress = Math.min((elapsedIngameSec / Math.max(1e-9, durationIngameSec)) * 100, 100);
        const remainingReal = Math.max(0, (durationIngameSec - elapsedIngameSec) / ts);

        if (bar) bar.style.width = `${progress}%`;
        if (label) label.textContent = `${remainingReal.toFixed(1)}s`;

        if (elapsedIngameSec >= durationIngameSec) {
            clearInterval(progressInterval);
            completeCargoBayRoute(button, bar, countEl, label);
        }
    }, 100);
}

function completeCargoBayRoute(button, bar, countEl, label) {
    const before = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
    const next = Math.max(0, Math.min(5, before + 1));
    gameFlags.cargoBayRouteClears = next;

    addLogEntry(`Cargo Bay route progress: ${next}/5.`, LogType.ACTION);

    if (next >= 5 && !gameFlags.cargoBayReached) {
        gameFlags.cargoBayReached = true;
        gameFlags.workerDroneBlueprintUnlocked = true;

        // Reward: +1 Crew Members (Survivors) and unlock blueprint placeholder as a resource
        const crew = resources.find(r => r && r.name === 'Survivors');
        if (crew) {
            const cap = Number.isFinite(Number(crew.capacity)) ? Number(crew.capacity) : Number.POSITIVE_INFINITY;
            crew.amount = Math.min((Number(crew.amount) || 0) + 1, cap);
            crew.isDiscovered = true;
        }

        const bp = resources.find(r => r && r.name === 'Worker Drone Blueprint');
        if (bp) {
            bp.amount = Math.min((Number(bp.amount) || 0) + 1, Number(bp.capacity) || 1);
            bp.isDiscovered = true;
        }

        updateResourceInfo();
        try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

        try {
            const evt = storyEvents && storyEvents.cargo_bay_reached;
            if (evt) {
                showStoryPopup(evt);
                addLogEntry('Cargo Bay reached. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt) });
            }
        } catch { /* non-fatal */ }

        // Rebuild Colony UI so the completed action disappears and categories stay clean
        try {
            const panel = document.querySelector('#colonySection .content-panel');
            if (panel) panel.innerHTML = '';
            setupColonySection();
        } catch { /* ignore */ }
    } else {
        // Reset button label back to normal, keep progress in the count like buildings.
        const c = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
        if (countEl) countEl.textContent = `(${c}/5)`;
        if (label) label.textContent = 'Clear Route to Cargo Bay';
    }

    if (bar) bar.style.width = '0%';
    button.disabled = false;
    isCargoBayOnCooldown = false;
}