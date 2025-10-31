import { addLogEntry, LogType } from '../log.js';
import { buildings } from './buildings.js';
import { jobs } from './jobs.js';

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
    purificationUnitInstalled: false
};

export function getInitialGameFlags() {
    // return a deep copy to avoid sharing references
    return JSON.parse(JSON.stringify(initialGameFlags));
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
    addLogEntry('Tents constructed at base camp — resting yields +20% energy.', LogType.UNLOCK);
});

// Insulate shelters -> set flag and log (unlocked only after tents)
registerActionCompletionHandler('insulateShelters', () => {
    gameFlags.sheltersInsulated = true;
    addLogEntry('Shelters insulated — resting yields +10% energy.', LogType.UNLOCK);
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