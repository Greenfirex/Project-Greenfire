import { addLogEntry, LogType } from '../core/ingameLog.js';
import { buildings } from './definitions/buildings.js';
import { jobs } from './jobsManager.js';
import { upgradeActions } from './definitions/upgrades.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { resources } from '../core/resources.js';
import { allActions as salvageActions } from './definitions/allActions.js';
import { characterState, grantItemToCharacter, countItemInBag } from './character.js';
import { storyEvents } from './definitions/storyEvents.js';
import { getLocalMapTileAt, isCrashWallBetween } from './definitions/localMapTiles.js';

const initialGameFlags = {
    // Narrative chapter marker (1 = Crash Site, 2 = Colony)
    chapter: 1,
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
    // Objective reward: Stockpile resources morale boost (+10% for 5 in-game days)
    stockpileMoraleBoostActive: false,
    stockpileMoraleBoostStartMinutes: 0,
    // Engineering/state flags
    emergencyPowerRestored: false,
    // Upgrades
    scavengerKitInstalled: false,
    campfireLit: false,
    wireScavengingOrganized: false,
    // Progress tracking flags
    hasReached15ScrapMetal: false,
    // Objective guidance (Crash Site): after reaching 15 Metal Parts, prompt returning to the cave to craft a prybar
    returnToCaveAfterScrap15Shown: false,
    returnedToCaveAfter15Scrap: false,
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
    ,
    // Colony salvage progression: clear route to Cargo Bay (0..5)
    cargoBayRouteClears: 0,
    cargoBayReached: false,
    cargoBayRouteUiNew: false,
    // UI-only persistence: which unlocks/buttons the player has already seen.
    // Keys are strings like "tech:Workforce", "building:Workshop", "action:assembleMakeshiftExplosive".
    uiSeen: {},
    // Placeholder unlock for future Manufacturing usage
    workerDroneBlueprintUnlocked: false
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

export async function runActionCompletionHandlers(original, completed, section) {
    if (!original || !original.id) return;
    const list = handlers[original.id] || [];
    for (let i = 0; i < list.length; i++) {
        try {
            // Allow handlers to be async (returning a Promise).
            // Use Promise.resolve to support sync handlers without branching.
            // Run sequentially to preserve existing ordering assumptions.
            // eslint-disable-next-line no-await-in-loop
            await Promise.resolve(list[i](original, completed, section));
        } catch (e) {
            // Handlers should never break action completion.
            console.warn(`Action completion handler failed for ${original.id}`, e);
        }
    }
}

// --- Crash Site / Local Map handlers ---

// Unlock Journal on the initial re-entry attempt and surface the menu "new" badge.
registerActionCompletionHandler('attemptReentry', () => {
    if (typeof window === 'undefined') return;
    try {
        if (typeof window.enableSection === 'function') {
            window.enableSection('journalSection');
        } else {
            window.dispatchEvent(new CustomEvent('requestEnableSection', { detail: { section: 'journalSection' } }));
        }
    } catch { /* ignore */ }

    // Mark Journal as "new" in the main menu until the player visits it.
    try {
        if (typeof window.setMenuNewItemFlag === 'function') {
            let current = null;
            try { current = localStorage.getItem('currentSection'); } catch { current = null; }
            if (current !== 'journalSection') window.setMenuNewItemFlag('journalSection', true);
        }
    } catch { /* ignore */ }
});

// Create Basic Torch (tile action at B6)
registerActionCompletionHandler('createBasicTorch', () => {
    try {
        const hasTorch =
            (characterState?.equipment?.accessory_1 === 'basic_torch')
            || (characterState?.equipment?.accessory_2 === 'basic_torch')
            || (countItemInBag('basic_torch') > 0);

        if (hasTorch) {
            addLogEntry('You already have a Basic Torch.', LogType.INFO);
            return;
        }

        const placed = grantItemToCharacter('basic_torch', { preferEquip: false });
        if (placed && placed.ok) {
            addLogEntry('Items Found: Basic Torch.', LogType.INFO);
        } else {
            addLogEntry('Could not carry the Basic Torch (inventory full).', LogType.INFO);
        }
    } catch { /* ignore */ }
});

// After prying open the hull, allow entering the Crash POI via D5.
registerActionCompletionHandler('pryOpenHull', () => {
    try {
        if (characterState && characterState.localMap) {
            characterState.localMap.d5HullOpened = true;
        }
    } catch { /* ignore */ }
});

// Local Map movement (prototype)
registerActionCompletionHandler('move', async () => {
    try {
        const st = characterState?.localMap;
        if (!st || !Number.isFinite(st.x) || !Number.isFinite(st.y)) return;

        const beforeX = st.x;
        const beforeY = st.y;
        const tx = Number.isFinite(st.selectedX) ? st.selectedX : st.x;
        const ty = Number.isFinite(st.selectedY) ? st.selectedY : st.y;
        const dist = Math.abs(tx - st.x) + Math.abs(ty - st.y);

        // Enforce adjacency: move is a 1-tile step to the selected tile.
        if (dist !== 1) {
            addLogEntry('Select an adjacent tile to move there.', LogType.INFO);
        } else {
            const hasTorchEquipped = !!(
                (characterState?.equipment?.accessory_1 === 'basic_torch')
                || (characterState?.equipment?.accessory_2 === 'basic_torch')
            );
            const isTorchGatedTile = (tx === 3 && ty === 5);

            // Gate: do not allow moving west until the H8 river encounter has been visited.
            const movingWest = tx < st.x;
            const blockedByWestGate = !!(movingWest && !st.riverCombatDone);
            if (blockedByWestGate) {
                addLogEntry('You should first check out the east side.', LogType.INFO);
                // Keep selection where the player clicked, but do not move.
                st.selectedX = tx;
                st.selectedY = ty;
            } else if (isTorchGatedTile && !hasTorchEquipped) {
                addLogEntry('It is too dark to go there without a torch equipped.', LogType.INFO);
                st.selectedX = tx;
                st.selectedY = ty;
            } else {
                // Respect tile defs (blocked tiles are impassable).
                const scout = (salvageActions || []).find(a => a && a.id === 'scoutSurroundings');
                const scoutStage = Number(scout?.stage || 0);
                const hasTriedReentry = !!(st.hasTriedReentry === true);
                const blockedByCrashWall = isCrashWallBetween(st.x, st.y, tx, ty, { localMapState: st });
                if (blockedByCrashWall) {
                    addLogEntry('Wreckage blocks the way.', LogType.INFO);
                    st.selectedX = tx;
                    st.selectedY = ty;
                    return;
                }

                const meta = getLocalMapTileAt(tx, ty, { scoutStage, hasTriedReentry, localMapState: st });
                if (meta && meta.blocked) {
                    addLogEntry('There is currently no need to go there.', LogType.INFO);
                } else {
                    // For UI animation: capture origin/destination.
                    try {
                        st.lastMoveAt = Date.now();
                        st.lastMoveFromX = beforeX;
                        st.lastMoveFromY = beforeY;
                        st.lastMoveToX = tx;
                        st.lastMoveToY = ty;
                    } catch { /* ignore */ }

                    st.x = tx;
                    st.y = ty;

                    // Keep selection synced so context actions appear immediately after moving.
                    st.selectedX = st.x;
                    st.selectedY = st.y;

                    // H7 (8,7): one-time log note about the blocked eastern path.
                    try {
                        if (st.x === 8 && st.y === 7 && !st.h7BlockedNoteShown) {
                            st.h7BlockedNoteShown = true;
                            addLogEntry('Path here is blocked by debris and flowing river. I will have to return back and go around to the west.', LogType.INFO);
                        }
                    } catch { /* ignore */ }

                    // C6 (3,6): one-time story popup hinting at shelter to the west.
                    try {
                        if (st.x === 3 && st.y === 6 && !st.caveSpottedWest) {
                            st.caveSpottedWest = true;
                            const ev = storyEvents ? (storyEvents.caveSpottedWest || null) : null;
                            if (ev) {
                                const { showStoryPopup } = await import('../ui/panels/popup.js');
                                showStoryPopup(ev, null);
                            }
                        }
                    } catch { /* ignore */ }

                    // Map-driven discoveries: reuse Scout Surroundings stage unlocks on specific tiles.
                    try {
                        const scout2 = (salvageActions || []).find(a => a && a.id === 'scoutSurroundings');
                        const stages = Array.isArray(scout2?.stages) ? scout2.stages : [];
                        const totalScoutStages = stages.length;

                        const { showStoryPopup } = await import('../ui/panels/popup.js');
                        const { showCombatPopup } = await import('../ui/panels/combatPopup.js');

                        const unlockFromScoutStage = (stageIndex) => {
                            const stg = stages[stageIndex];
                            if (!stg) return;

                            // Advance Scout Surroundings progress so objectives reflect map discoveries.
                            try {
                                if (scout2) {
                                    const next = stageIndex + 1;
                                    const cur = Number.isFinite(scout2.stage) ? scout2.stage : 0;
                                    scout2.stage = Math.max(cur, next);
                                    if (totalScoutStages && scout2.stage >= totalScoutStages) {
                                        scout2.completed = true;
                                    }
                                }
                            } catch { /* ignore */ }

                            if (Array.isArray(stg.unlocks)) {
                                for (const id of stg.unlocks) {
                                    const a = (salvageActions || []).find(x => x && (x.id === id || x.name === id));
                                    if (a && !a.isUnlocked) {
                                        a.isUnlocked = true;
                                        a.uiNew = true;
                                        const isUpgrade = (a.category === 'Upgrade');
                                        addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                                    }
                                }
                            }

                            if (stg.story) {
                                const ev = storyEvents ? (storyEvents[stg.story] || null) : null;
                                if (ev) showStoryPopup(ev, null);
                                if (stg.logText) addLogEntry(stg.logText, LogType.STORY, { onClick: () => (ev ? showStoryPopup(ev, null) : null) });
                            } else if (stg.logText) {
                                addLogEntry(stg.logText, LogType.STORY);
                            }
                        };

                        // B6 (cave) -> Scout stage 0 unlocks Rest
                        if (st.x === 2 && st.y === 6 && !st.discoveredCave) {
                            st.discoveredCave = true;
                            unlockFromScoutStage(0);
                        }

                        // D7 (berries) -> Scout stage 1 unlocks Forage for Food
                        if (st.x === 4 && st.y === 7 && !st.discoveredBerries) {
                            st.discoveredBerries = true;
                            unlockFromScoutStage(1);
                        }

                        // H8 (water source) -> Scout stage 2 unlocks Purify Water (and related)
                        if (st.x === 8 && st.y === 8 && !st.discoveredRiver) {
                            st.discoveredRiver = true;
                            unlockFromScoutStage(2);

                            // One-time combat at the river.
                            if (!st.riverCombatDone) {
                                st.riverCombatDone = true;
                                try {

                                    // Base camp tile (B7): once unlocked, visiting it marks it as discovered (changes marker).
                                    if (st.b7Unlocked === true && st.x === 2 && st.y === 7 && !st.discoveredBaseCamp) {
                                        st.discoveredBaseCamp = true;
                                    }
                                    await showCombatPopup('wildlife_river', { sourceActionId: 'scoutSurroundings', stageIndex: 2 });
                                } catch { /* ignore */ }
                            }
                        }

                        // G8 -> one-time story hint + tutorial weapon
                        if (st.x === 7 && st.y === 8 && !st.heardRiverEast) {
                            st.heardRiverEast = true;
                            const hasBranch = (characterState?.equipment?.weapon === 'spiked_branch') || (countItemInBag('spiked_branch') > 0);

                            let granted = false;
                            let note = '';
                            if (!hasBranch) {
                                try {
                                    const placed = grantItemToCharacter('spiked_branch', { preferEquip: false });
                                    granted = !!(placed && placed.ok);
                                    note = placed?.placed === 'equip'
                                        ? `Equipped (${placed.slot})`
                                        : (placed?.placed === 'bag' ? 'Added to bag' : 'Obtained');
                                } catch { /* ignore */ }
                            }

                            try {
                                const ev = storyEvents ? (storyEvents.heardRiverEast || null) : null;
                                if (ev) {
                                    const out = granted ? { items: [{ id: 'spiked_branch', note }] } : null;
                                    showStoryPopup(ev, out);
                                }
                            } catch { /* ignore */ }
                        }
                    } catch { /* ignore */ }

                    // Ship interior junction (E5): once the alternate access route is opened, reaching E5
                    // surfaces the branching choices and unlocks the corresponding actions.
                    try {
                        const isE5 = (st.x === 5 && st.y === 5);
                        const canBeInside = !!(st.d5HullOpened === true);
                        if (canBeInside && isE5 && !st.shipInteriorJunctionShown) {
                            st.shipInteriorJunctionShown = true;

                            // Also mark hint tiles (E4/E5/E6/F5) the first time the player reaches E5.
                            // These are rendered as "!" markers to guide the player to interactable junction tiles.
                            try {
                                if (!st.shipInteriorTileHints) {
                                    st.shipInteriorTileHints = true;
                                }
                            } catch { /* ignore */ }

                            const { showStoryPopup } = await import('../ui/panels/popup.js');
                            const ev = storyEvents ? (storyEvents.shipInteriorJunction || null) : null;
                            if (ev) {
                                showStoryPopup(ev, null);
                                try {
                                    addLogEntry('The corridors branch ahead. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(ev, null) });
                                } catch { /* ignore */ }
                            }

                            const toUnlock = ['searchSouthCorridor', 'searchNorthCorridor', 'investigateBridge', 'investigateSound', 'stripWiring'];
                            // Investigate Nearby Sound (E5): unlock the base camp tile on the local map.
                            registerActionCompletionHandler('investigateSound', () => {
                                try {
                                    const st = characterState?.localMap;
                                    if (st && typeof st === 'object') {
                                        st.b7Unlocked = true;
                                        st.investigateSoundDone = true;
                                    }
                                } catch { /* ignore */ }

                                try {
                                    addLogEntry('A promising spot for a base camp is marked on your map.', LogType.UNLOCK);
                                } catch { /* ignore */ }

                                // Refresh Crash Site UI (including local map) so the marker appears immediately.
                                if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                    try { window.setupCrashSiteSection(); } catch { /* ignore */ }
                                }
                            });

                            const applyPendingActionMove = (expectedActionId) => {
                                try {
                                    const st = characterState?.localMap;
                                    if (!st || typeof st !== 'object') return;
                                    const pending = st.pendingActionMove;
                                    if (!pending || typeof pending !== 'object') return;
                                    if (String(pending.actionId || '') !== String(expectedActionId || '')) return;

                                    const fromX = Number(pending.fromX);
                                    const fromY = Number(pending.fromY);
                                    const toX = Number(pending.toX);
                                    const toY = Number(pending.toY);
                                    if (![fromX, fromY, toX, toY].every(Number.isFinite)) return;
                                    const dist = Math.abs(toX - fromX) + Math.abs(toY - fromY);
                                    if (dist !== 1) return;

                                    // Only apply if the player is still at the queued origin.
                                    if (Number(st.x) !== fromX || Number(st.y) !== fromY) return;

                                    st.lastMoveAt = Date.now();
                                    st.lastMoveFromX = fromX;
                                    st.lastMoveFromY = fromY;
                                    st.lastMoveToX = toX;
                                    st.lastMoveToY = toY;
                                    st.x = toX;
                                    st.y = toY;
                                    st.selectedX = toX;
                                    st.selectedY = toY;
                                    delete st.pendingActionMove;

                                    try {
                                        const letter = String.fromCharCode('A'.charCodeAt(0) + (toX - 1));
                                        addLogEntry(`Moved to ${letter}${toY}.`, LogType.INFO);
                                    } catch { /* ignore */ }

                                    if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                        try { window.setupCrashSiteSection(); } catch { /* ignore */ }
                                    }
                                } catch { /* ignore */ }
                            };

                            // Corridor/bridge actions: once finished, step onto the tile (so traversal becomes possible).
                            registerActionCompletionHandler('searchNorthCorridor', () => applyPendingActionMove('searchNorthCorridor'));
                            registerActionCompletionHandler('searchSouthCorridor', () => applyPendingActionMove('searchSouthCorridor'));
                            registerActionCompletionHandler('investigateBridge', () => applyPendingActionMove('investigateBridge'));
                            for (const id of toUnlock) {
                                const a = (salvageActions || []).find(x => x && (x.id === id || x.name === id));
                                if (a && !a.isUnlocked) {
                                    a.isUnlocked = true;
                                    a.uiNew = true;
                                    const isUpgrade = (a.category === 'Upgrade');
                                    addLogEntry(`${isUpgrade ? 'Upgrade available' : 'New action available'}: ${a.name}`, LogType.UNLOCK);
                                }
                            }

                            // Surface the new actions immediately in the Crash Site list.
                            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                try { window.setupCrashSiteSection(); } catch { /* ignore */ }
                            }
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        // Clamp to the A-K / 1-9 grid
        st.x = Math.max(1, Math.min(11, st.x));
        st.y = Math.max(1, Math.min(9, st.y));

        if (st.x !== beforeX || st.y !== beforeY) {
            const letter = String.fromCharCode('A'.charCodeAt(0) + (st.x - 1));
            addLogEntry(`Moved to ${letter}${st.y}.`, LogType.INFO);
        }
    } catch { /* ignore */ }
});

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
            rainBuilding.uiNew = true; // Mark as new for UI
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
    // Crew management is now embedded under the Crash Site -> Campsite tab.

    const toUnlock = ['Foraging Camp', 'Water Station'];
    buildings.forEach(b => {
        if (toUnlock.includes(b.name) && !b.isUnlocked) {
            b.isUnlocked = true;
                b.uiNew = true; // Mark as new for UI
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
        try {
            if (characterState && characterState.localMap) {
                characterState.localMap.baseCampEstablished = true;
                if (characterState.localMap.campsiteTabUiNew !== false) {
                    characterState.localMap.campsiteTabUiNew = true;
                }
            }
        } catch { /* ignore */ }
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

    // Refresh Crash Site UI so the Campsite tab enables immediately.
    try {
        if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
            window.setupCrashSiteSection();
        }
    } catch { /* ignore */ }
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
    
    // Hide Crash Site section and show Colony/Encrypted Drive sections
    if (typeof window !== 'undefined') {
        // Disable Crash Site
        if (window.activatedSections) {
            window.activatedSections.crashSiteSection = false;
            // Persist the change
            if (typeof window.setActivatedSections === 'function') {
                window.setActivatedSections(window.activatedSections);
            }
        }
        
        // Enable new sections
        if (typeof window.enableSection === 'function') {
            window.enableSection('encryptedDriveSection');
            window.enableSection('colonySection');
        }
        
        // Update menu buttons visibility
        if (typeof window.applyActivatedSections === 'function') {
            window.applyActivatedSections();
        }
        
        // Switch to Colony section as the active section
        if (typeof window.showSection === 'function') {
            window.showSection('colonySection');
        }
    }
    
    // Log a clear menu unlock message for consistency with other sections
    try { addLogEntry('New menu section unlocked: Encrypted Drive', LogType.UNLOCK); } catch (e) { /* ignore */ }
    try { addLogEntry('New menu section unlocked: Colony', LogType.UNLOCK); } catch (e) { /* ignore */ }
    
    // Hide Chapter I-specific resources that are no longer needed
    try {
        // NOTE: Stamina remains used by Character/Combat in Chapter 2+ (it is already hidden from the info panel elsewhere).
        const obsoleteResources = ['Crude Prybar', 'Makeshift Explosive'];
        for (const name of obsoleteResources) {
            const r = (resources || []).find(res => res && res.name === name);
            if (r) {
                r.amount = 0; // Zero out to prevent auto-rediscovery
                r.isDiscovered = false; // Mark as undiscovered to hide
            }
        }
        
        // UI: display label for Survivors becomes "Crew Members" in Chapter II+
        // Keep the underlying resource name stable for save/load compatibility.
        
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
