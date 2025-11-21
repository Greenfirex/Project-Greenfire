import { addLogEntry, LogType } from '../core/ingameLog.js';
import { buildings } from './definitions/buildings.js';
import { jobs } from './jobsManager.js';
import { upgradeActions } from './definitions/upgrades.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { resources } from '../core/resources.js';

const initialGameFlags = {
    // set true once the salvaged cooking equipment is installed
    cafeteriaCookerInstalled: false,
    // set true once tents at base camp are installed
    tentsInstalled: false,
    // set true when shelters are insulated
    sheltersInsulated: false,
    // Crude Foraging Tools upgrade flag
    improvedForagingTools: false,
    // Rain catchers passive water collection
    rainCatchersInstalled: false
    ,
    // Purification Unit improves purifyWater yields and water collection job
    purificationUnitInstalled: false,
    // Morale-related flags
    crashlandedActive: true,
    // Start markers (in-game minutes) for time-based morale sources
    crashlandedStartMinutes: 0,
    baseCampEstablished: false,
    baseCampBoostStartMinutes: 0,
    // Engineering/state flags
    emergencyPowerRestored: false,
    // Upgrades
    scavengerKitInstalled: false,
    campfireLit: false,
    wireScavengingOrganized: false,
    // Progress tracking flags
    hasReached15ScrapMetal: false,
    hasCompleted_tasksSurvivors: false,
    assembleMakeshiftExplosive_completions: 0,
    // Weather state (v1): stored in flags for simple persistence
    weatherCurrentId: 'clear',
    weatherStartMinutes: 0,
    weatherDurationMinutes: 8 * 60, // default 8 in-game hours
    weatherTempC: 22
    ,
    // Narrative gating: ensure distant smoke sighting popup only shows once
    smokeSightingShown: false
};

export function getInitialGameFlags() {
    // return a deep copy to avoid sharing references and stamp dynamic in-game minutes lazily
    const copy = JSON.parse(JSON.stringify(initialGameFlags));
    try {
        if (!copy.crashlandedStartMinutes) copy.crashlandedStartMinutes = getTotalIngameMinutes();
        if (!copy.weatherStartMinutes) copy.weatherStartMinutes = getTotalIngameMinutes();
    } catch (e) { /* fallback to 0; morale module will lazily initialize */ }
    return copy;
}

// live flags object that the rest of the game imports and mutates
export let gameFlags = getInitialGameFlags();

export function resetGameFlags() {
    // reset the live object to defaults while keeping the same reference
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags());
}

// load flags from a saved object (used by saveload.applyGameState)
export function applySavedGameFlags(savedFlags = {}) {
    Object.keys(gameFlags).forEach(k => delete gameFlags[k]);
    Object.assign(gameFlags, getInitialGameFlags()); // ensure all keys exist
    Object.keys(savedFlags).forEach(k => {
        if (Object.prototype.hasOwnProperty.call(savedFlags, k)) {
            gameFlags[k] = savedFlags[k];
        }
    });
}

// --- Action completion handler registry (minimal) ---
// Handlers are small functions that run when an action finishes.
// Register with registerActionCompletionHandler(actionId, fn).
const handlers = Object.create(null);

export function registerActionCompletionHandler(actionId, fn) {
    if (!actionId || typeof fn !== 'function') return;
    handlers[actionId] = handlers[actionId] || [];
    handlers[actionId].push(fn);
}

export function runActionCompletionHandlers(original, completed, section) {
    if (!original || !original.id) return;
    const list = handlers[original.id] || [];
    for (let i = 0; i < list.length; i++) {
        list[i](original, completed, section);
    }
}

// --- Built-in handlers (minimal, no saving) ---
registerActionCompletionHandler('salvageCookingEquipment', () => {
    gameFlags.cafeteriaCookerInstalled = true;
    addLogEntry('Installed: Salvaged Cooking Equipment — food & water gathering yields improved.', LogType.UNLOCK);
});

registerActionCompletionHandler('makeTents', () => {
    gameFlags.tentsInstalled = true;
    addLogEntry('Tents constructed at base camp — resting yields +20% stamina.', LogType.UNLOCK);
});

// Insulate shelters -> set flag and log (unlocked only after tents)
registerActionCompletionHandler('insulateShelters', () => {
    gameFlags.sheltersInsulated = true;
    addLogEntry('Shelters insulated — resting yields +10% stamina.', LogType.UNLOCK);
});

// Crude Foraging Tools -> set flag and log
registerActionCompletionHandler('installForagingTools', () => {
    gameFlags.improvedForagingTools = true;
    addLogEntry('Crude Foraging Tools installed — foragers produce +25%.', LogType.UNLOCK);
});

// Rain catchers handler
registerActionCompletionHandler('installRainCatchers', () => {
    gameFlags.rainCatchersInstalled = true;
    addLogEntry('Rain catchers installed — water collectors +10% and Rain Tarp building unlocked.', LogType.UNLOCK);

    // unlock the Rain Tarp building so player can construct it
    // tolerate both legacy and current names just in case
    const rainBuilding = (buildings || []).find(b => ['Rain Tarp', 'Rain Catchment'].includes(b.name));
    if (rainBuilding) {
        rainBuilding.isUnlocked = true;
        // best-effort UI refresh: call known globals if present and dispatch an event
        if (typeof window !== 'undefined') {
            if (typeof window.setupColonySection === 'function') window.setupColonySection();
            if (typeof window.updateBuildingButtonsState === 'function') window.updateBuildingButtonsState();
            try {
                window.dispatchEvent(new CustomEvent('refreshColonyUI', { detail: { name: rainBuilding.name } }));
            } catch (e) { /* ignore non-browser env */ }
        }
    }
});

registerActionCompletionHandler('establishBaseCamp', () => {
    // prefer direct global call if present (keeps compatibility),
    // otherwise dispatch an event that main.js can listen for.
    if (typeof window !== 'undefined' && typeof window.enableSection === 'function') {
        window.enableSection('crewManagementSection');
    } else {
        window.dispatchEvent(new CustomEvent('requestEnableSection', { detail: { section: 'crewManagementSection' } }));
    }

    const toUnlock = ['Foraging Camp', 'Water Station'];
    buildings.forEach(b => {
        if (toUnlock.includes(b.name) && !b.isUnlocked) {
            b.isUnlocked = true;
            addLogEntry(`New building available: ${b.name}`, LogType.UNLOCK);
        }
    });

    // Unlock the Scrap Collector job and make it effectively unlimited
    try {
        const scrapJob = (jobs || []).find(j => j.id === 'scrap_collector');
        if (scrapJob && !scrapJob.unlimited) {
            scrapJob.unlimited = true;
            // some code paths expect a numeric slots value — use Infinity to denote unlimited
            scrapJob.slots = Number.POSITIVE_INFINITY;
            addLogEntry('New job unlocked: Scrap Collector (unlimited assignments)', LogType.UNLOCK);
            // refresh crew UI where possible (avoid direct imports to prevent cycles)
            if (typeof window !== 'undefined') {
                if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
                if (typeof window.setupCrewManagementSection === 'function') try { window.setupCrewManagementSection(document.querySelector('#crewSection')); } catch (e) {}
            }
        }
    } catch (e) { /* non-fatal */ }

    // Set morale-related base camp flag
    try {
        gameFlags.baseCampEstablished = true;
        // Start a temporary +10% morale boost that decays over 7 in-game days from this moment
        gameFlags.baseCampBoostStartMinutes = getTotalIngameMinutes();
    } catch {}

    // Unlock Scavenger Kit upgrade at Base Camp
    try {
        const act = (upgradeActions || []).find(a => a && a.id === 'installScavengerKit');
        if (act && !act.isUnlocked) {
            act.isUnlocked = true;
            addLogEntry('Upgrade available: Scavenger Kit', LogType.UNLOCK);
            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                try { window.setupCrashSiteSection(); } catch (e) {}
            }
        }
    } catch (e) { /* ignore */ }

    // Unlock Light Campfire upgrade at Base Camp
    try {
        const campfire = (upgradeActions || []).find(a => a && a.id === 'lightCampfire');
        if (campfire && !campfire.isUnlocked) {
            campfire.isUnlocked = true;
            addLogEntry('Upgrade available: Light Campfire', LogType.UNLOCK);
            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                try { window.setupCrashSiteSection(); } catch (e) {}
            }
        }
    } catch (e) { /* ignore */ }

    // Unlock Organize Wire Scavenging upgrade at Base Camp
    try {
        const wireUpgrade = (upgradeActions || []).find(a => a && a.id === 'organizeWireScavenging');
        if (wireUpgrade && !wireUpgrade.isUnlocked) {
            wireUpgrade.isUnlocked = true;
            addLogEntry('Upgrade available: Organize Wire Scavenging', LogType.UNLOCK);
            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                try { window.setupCrashSiteSection(); } catch (e) {}
            }
        }
    } catch (e) { /* ignore */ }
});

// Purification Unit completion handler
registerActionCompletionHandler('installPurificationUnit', () => {
    gameFlags.purificationUnitInstalled = true;
    addLogEntry('Purification Unit installed — Purify Water now rewards +20% more and Water Collection job is +20% more effective.', LogType.UNLOCK);
    // best-effort UI refresh: call known update functions where available
    if (typeof window !== 'undefined') {
        try {
            // update resource rows and related UI
            if (typeof window.updateResourceInfo === 'function') try { window.updateResourceInfo(); } catch (e) {}
            if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
            if (typeof window.updateBuildingButtonsState === 'function') try { window.updateBuildingButtonsState(); } catch (e) {}
            if (typeof window.updateCrashSiteActionButtonsState === 'function') try { window.updateCrashSiteActionButtonsState(); } catch (e) {}
            if (typeof window.setupCrashSiteSection === 'function') try { window.setupCrashSiteSection(document.querySelector('.content-panel')); } catch (e) {}
            // dispatch an event so other systems can react
            try { window.dispatchEvent(new CustomEvent('gameFlagsChanged', { detail: { flag: 'purificationUnitInstalled' } })); } catch (e) {}
        } catch (e) { /* ignore non-fatal UI errors */ }
    }
});

// Emergency power restore handler
registerActionCompletionHandler('restoreEmergencyPower', () => {
    gameFlags.emergencyPowerRestored = true;
    addLogEntry('Emergency power restored — lift access is now available.', LogType.UNLOCK);
    // best-effort UI refresh so blocked actions update immediately
    if (typeof window !== 'undefined') {
        // Notify other systems that emergency power is now online
        try { window.dispatchEvent(new CustomEvent('emergencyPowerRestored')); } catch (e) { /* ignore */ }
        try {
            if (typeof window.updateCrashSiteActionButtonsState === 'function') try { window.updateCrashSiteActionButtonsState(); } catch (e) {}
            if (typeof window.setupCrashSiteSection === 'function') try { window.setupCrashSiteSection(document.querySelector('.content-panel')); } catch (e) {}
        } catch (e) { /* ignore */ }
    }
});

// Check captain's quarters handler - unlock encrypted drive section
registerActionCompletionHandler('checkCaptainsQuarters', () => {
    gameFlags.chapter = 2;
    // Unlock the Encrypted Drive section
    if (typeof window !== 'undefined' && typeof window.enableSection === 'function') {
        window.enableSection('encryptedDriveSection');
        window.enableSection('colonySection');
    } else {
        window.dispatchEvent(new CustomEvent('requestEnableSection', { detail: { section: 'encryptedDriveSection' } }));
        window.dispatchEvent(new CustomEvent('requestEnableSection', { detail: { section: 'colonySection' } }));
    }
    // Log a clear menu unlock message for consistency with other sections
    try { addLogEntry('New menu section unlocked: Encrypted Drive', LogType.UNLOCK); } catch (e) { /* ignore */ }
    try { addLogEntry('New menu section unlocked: Colony', LogType.UNLOCK); } catch (e) { /* ignore */ }
    
    // Hide Chapter I-specific resources that are no longer needed
    try {
        const obsoleteResources = ['Stamina', 'Crude Prybar', 'Makeshift Explosive'];
        for (const name of obsoleteResources) {
            const r = (resources || []).find(res => res && res.name === name);
            if (r) {
                r.amount = 0; // Zero out to prevent auto-rediscovery
                r.isDiscovered = false; // Mark as undiscovered to hide
            }
        }
        
        // Rename Survivors to Crew Members for Chapter II
        const survivors = (resources || []).find(res => res && res.name === 'Survivors');
        if (survivors) {
            survivors.name = 'Crew Members';
            // Update the DOM element's displayed name
            const row = document.querySelector('.info-row[data-resource="Survivors"]');
            if (row) {
                row.dataset.resource = 'Crew Members';
                const nameEl = row.querySelector('.infocolumn1 span');
                if (nameEl) nameEl.textContent = 'Crew Members';
            }
        }
        
        // Refresh resource display to hide obsolete resources
        if (typeof window !== 'undefined' && typeof window.updateResourceInfo === 'function') {
            window.updateResourceInfo();
        }
        
        // Re-render Crew Management section to update labels for Chapter 2
        try {
            const crewSection = document.querySelector('#crewManagementSection');
            if (crewSection && typeof window !== 'undefined' && typeof window.setupCrewManagementSection === 'function') {
                window.setupCrewManagementSection(crewSection);
            }
        } catch (e) { /* ignore */ }
    } catch (e) { /* ignore */ }
});

// Scavenger Kit completion handler
registerActionCompletionHandler('installScavengerKit', () => {
    gameFlags.scavengerKitInstalled = true;
    addLogEntry('Scavenger Kit installed — Scrap Collector job +20%.', LogType.UNLOCK);
    if (typeof window !== 'undefined') {
        try {
            if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
            if (typeof window.updateResourceInfo === 'function') try { window.updateResourceInfo(); } catch (e) {}
        } catch (e) { /* ignore */ }
    }
});

// Organize Wire Scavenging completion handler - unlocks the Wire Collector job
registerActionCompletionHandler('organizeWireScavenging', () => {
    gameFlags.wireScavengingOrganized = true;
    
    // Unlock the Wire Collector job and make it unlimited
    try {
        const wireJob = (jobs || []).find(j => j.id === 'wire_collector');
        if (wireJob && !wireJob.unlimited) {
            wireJob.unlimited = true;
            wireJob.slots = Number.POSITIVE_INFINITY;
            addLogEntry('New job unlocked: Wire Collector', LogType.UNLOCK);
            // Refresh crew UI
            if (typeof window !== 'undefined') {
                if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
                if (typeof window.setupCrewManagementSection === 'function') try { window.setupCrewManagementSection(document.querySelector('#crewSection')); } catch (e) {}
            }
        }
    } catch (e) { /* non-fatal */ }
    
    if (typeof window !== 'undefined') {
        try {
            if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
            if (typeof window.updateResourceInfo === 'function') try { window.updateResourceInfo(); } catch (e) {}
        } catch (e) { /* ignore */ }
    }
});

// Light Campfire completion handler
registerActionCompletionHandler('lightCampfire', () => {
    gameFlags.campfireLit = true;
    addLogEntry('Campfire lit — Morale +5%.', LogType.UNLOCK);
    if (typeof window !== 'undefined') {
        try {
            if (typeof window.updateResourceInfo === 'function') try { window.updateResourceInfo(); } catch (e) {}
            if (typeof window.updateCrewSection === 'function') try { window.updateCrewSection(); } catch (e) {}
        } catch (e) { /* ignore */ }
    }
});

// Planning upgrades that unlock colony storage buildings
registerActionCompletionHandler('planFoodLarder', () => {
    try {
        const b = (buildings || []).find(x => x && x.name === 'Food Larder');
        if (b && !b.isUnlocked) {
            b.isUnlocked = true;
            addLogEntry('New building available: Food Larder', LogType.UNLOCK);
            // Refresh Colony UI and related panels
            if (typeof window !== 'undefined') {
                if (typeof window.setupColonySection === 'function') try { window.setupColonySection(); } catch (e) {}
                if (typeof window.updateBuildingButtonsState === 'function') try { window.updateBuildingButtonsState(); } catch (e) {}
            }
        }
    } catch (e) { /* ignore */ }
});

registerActionCompletionHandler('planWaterReservoir', () => {
    try {
        const b = (buildings || []).find(x => x && x.name === 'Water Reservoir');
        if (b && !b.isUnlocked) {
            b.isUnlocked = true;
            addLogEntry('New building available: Water Reservoir', LogType.UNLOCK);
            if (typeof window !== 'undefined') {
                if (typeof window.setupColonySection === 'function') try { window.setupColonySection(); } catch (e) {}
                if (typeof window.updateBuildingButtonsState === 'function') try { window.updateBuildingButtonsState(); } catch (e) {}
            }
        }
    } catch (e) { /* ignore */ }
});

registerActionCompletionHandler('assembleMakeshiftExplosive', (original) => {
    try {
        if (!original) return;
        // Increment uses counter (persisted by save system via smart-merge)
        if (typeof original.uses !== 'number') original.uses = 0;
        if (typeof original.maxUses !== 'number') original.maxUses = 3;
        
        original.uses = Math.max(0, original.uses) + 1;
        
        // After 3 completions, mark completed and hide from UI
        if (original.uses >= original.maxUses) {
            original.completed = true; // prevents re-unlock
            original.isUnlocked = false; // hides from UI
            addLogEntry('Three makeshift explosives should be enough to blast the power core seal.', LogType.INFO);
            
            // Refresh crash site UI so button disappears
            if (typeof window !== 'undefined') {
                try {
                    if (typeof window.setupCrashSiteSection === 'function') {
                        window.setupCrashSiteSection(document.querySelector('.content-panel'));
                    }
                } catch (e) { /* ignore */ }
            }
        }
    } catch (e) { /* non-fatal */ }
});