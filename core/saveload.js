import { resources, getInitialResources, resetResources } from './resources.js';
import { technologies, resetTechnologies } from '../data/definitions/technologies.js';
import { buildings, getInitialBuildings, resetBuildings } from '../data/definitions/buildings.js'; 
import {
    setResearchProgress,
    getResearchProgress,
    getCurrentResearchingTech,
    setCurrentResearchingTech,
    setResearchInterval,
    getResearchInterval,
    getCurrentResearchStartTime,
    setCurrentResearchStartTime,
    getCurrentResearchElapsedSec,
    setCurrentResearchElapsedSec,
    getCurrentResearchLastTickAt,
    setCurrentResearchLastTickAt,
    resumeOngoingResearch
} from '../sections/research.js';
import { activatedSections, setActivatedSections, getInitialActivatedSections } from './main.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { resetIngameTime, getTotalIngameMinutes, setTotalIngameMinutes } from './time.js';
import { storyEvents } from '../data/definitions/storyEvents.js';
import { salvageActions, resetSalvageActions } from '../data/definitions/actions.js';
import { recipeActions, resetRecipeActions } from '../data/definitions/recipes.js';
import { upgradeActions, resetUpgradeActions } from '../data/definitions/upgrades.js';
import { refreshAllActions } from '../data/definitions/allActions.js';
import { jobs, resetJobs } from '../data/jobsManager.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { gameFlags, resetGameFlags, applySavedGameFlags } from '../data/gameFlags.js';
import { storyLog, resetStoryLog, applySavedStoryLog, getInitialStoryLog, renderJournalEntries } from '../sections/journal.js';
import { resetObjectives, recomputeObjectives, getObjectivesStatus, setObjectivesStatus } from '../data/objectives.js';
import { resetActiveActions, getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { resetMoraleModifiers, listMoraleModifiers, setMoraleModifier } from '../data/morale.js';
import { resetWeather } from '../data/weather.js';
import { driveTasks, resetDriveTasks } from '../data/definitions/encryptedDriveTasks.js';
import { characterState, applySavedCharacterState, getCharacterStateForSave, resetCharacterState, grantItemToCharacter, countItemInBag, computeCarryCapacity } from '../data/character.js';
import { getItemDefinition } from '../data/definitions/items.js';
import { getItemIdForResourceName } from '../data/inventoryAliases.js';

function migrateLegacyToolResourcesToInventory() {
    try {
        if (!Array.isArray(resources) || !characterState) return;

        const legacyNames = ['Power Cells', 'Crude Prybar', 'Makeshift Explosive'];
        const migrations = legacyNames
            .map(name => ({ name, itemId: getItemIdForResourceName(name) }))
            .filter(x => !!x.itemId);
        if (!migrations.length) return;

        // Compute how many additional bag slots we might need (avoid losing items on load).
        let requiredSlots = 0;
        for (const m of migrations) {
            const res = resources.find(r => r && r.name === m.name);
            const amt = Math.max(0, Math.floor(Number(res?.amount) || 0));
            if (!res || amt <= 0) continue;

            const def = getItemDefinition(m.itemId);
            const isStackable = !!def?.stackable;
            if (isStackable) {
                const have = countItemInBag(m.itemId, characterState);
                if (have <= 0) requiredSlots += 1;
            } else {
                requiredSlots += amt;
            }
        }

        if (requiredSlots > 0) {
            const cap = computeCarryCapacity(characterState);
            const free = Math.max(0, (cap.total ?? 0) - (cap.used ?? 0));
            const missing = Math.max(0, requiredSlots - free);
            if (missing > 0) {
                const cols = Math.max(1, Math.floor(Number(characterState?.bagCols) || 1));
                const rows = Math.max(1, Math.floor(Number(characterState?.bagRows) || 1));
                const rowsToAdd = Math.ceil(missing / cols);
                const nextRows = Math.min(12, rows + rowsToAdd);
                const addedRows = Math.max(0, nextRows - rows);

                if (addedRows > 0) {
                    characterState.bagRows = nextRows;
                    const nextTotal = cols * nextRows;
                    const bag = Array.isArray(characterState.bag) ? characterState.bag : [];
                    const uiNew = Array.isArray(characterState.bagUiNew) ? characterState.bagUiNew : [];
                    while (bag.length < nextTotal) bag.push(null);
                    while (uiNew.length < nextTotal) uiNew.push(false);
                    characterState.bag = bag;
                    characterState.bagUiNew = uiNew;
                }
            }
        }

        // Perform migration; keep any remainder as a last-resort fallback.
        for (const m of migrations) {
            const res = resources.find(r => r && r.name === m.name);
            let remaining = Math.max(0, Math.floor(Number(res?.amount) || 0));
            if (!res || remaining <= 0) continue;

            const def = getItemDefinition(m.itemId);
            const isStackable = !!def?.stackable;
            if (isStackable) {
                const placed = grantItemToCharacter(m.itemId, { preferEquip: false, amount: remaining }, characterState);
                if (placed && placed.ok) remaining = 0;
            } else {
                while (remaining > 0) {
                    const placed = grantItemToCharacter(m.itemId, { preferEquip: false, amount: 1 }, characterState);
                    if (!placed || !placed.ok) break;
                    remaining -= 1;
                }
            }

            res.amount = remaining;
        }
    } catch { /* non-fatal */ }
}

function reconcileActivatedSectionsAfterLoad() {
    try {
        // Start from whatever was loaded (or defaults if none)
        const next = { ...getInitialActivatedSections(), ...(activatedSections || {}) };

        // Compatibility: older saves may still contain this legacy section flag.
        delete next.crewManagementSection;

        // Chapter 2+ implies Colony + Encrypted Drive are available, and Crash Site is hidden.
        if (gameFlags && Number(gameFlags.chapter) >= 2) {
            next.colonySection = true;
            next.encryptedDriveSection = true;
            next.crashSiteSection = false;
        }

        // Research (tab) becomes available once the first Field Lab exists.
        try {
            const fieldLab = Array.isArray(buildings) ? buildings.find(b => b && b.name === 'Field Lab') : null;
            const fieldLabCount = fieldLab ? Number(fieldLab.count) : 0;
            const hasFieldLab = fieldLabCount >= 1;
            if (hasFieldLab) {
                // New UX: Research is inside Crafting, so ensure the section exists.
                next.craftingSection = true;
                // Persist the Research tab unlock.
                try { gameFlags.researchTabUnlocked = true; } catch { /* ignore */ }
            }

            // Forward-compat: older saves won't have Scientist slots persisted.
            // Ensure the job has at least one slot per existing Field Lab.
            const sci = Array.isArray(jobs) ? jobs.find(j => j && j.id === 'scientist') : null;
            if (sci && isFinite(fieldLabCount) && fieldLabCount > 0) {
                const currentSlots = (typeof sci.slots === 'number') ? sci.slots : 0;
                if (currentSlots < fieldLabCount) sci.slots = fieldLabCount;
                if (typeof sci.assigned === 'number' && sci.assigned > sci.slots) sci.assigned = sci.slots;
            }
        } catch { /* non-fatal */ }

        // Tech-driven sections (mirrors research.js completion unlocks).
        try {
            const hasShipyardTech = Array.isArray(technologies) && technologies.some(t => t && t.name === 'Starship Construction' && t.isResearched);
            if (hasShipyardTech) next.shipyardSection = true;
            const hasGalaxyTech = Array.isArray(technologies) && technologies.some(t => t && t.name === 'Stellar Cartography' && t.isResearched);
            if (hasGalaxyTech) next.galaxyMapSection = true;
        } catch { /* non-fatal */ }

        setActivatedSections(next);

        // If the UI is already built (manual load), refresh visibility.
        try {
            if (typeof window !== 'undefined' && typeof window.applyActivatedSections === 'function') {
                window.applyActivatedSections();
            }
        } catch { /* ignore */ }
    } catch { /* non-fatal */ }
}

export function saveGameState() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
    addLogEntry('Game saved.', LogType.INFO);
}

// Save without emitting an in-game log entry.
// Useful for UI-only state (e.g., "new" badges) where logging would be noisy.
export function saveGameStateQuiet() {
    const gameState = getGameState();
    localStorage.setItem('gameState', JSON.stringify(gameState));
}

export function getGameState() {
    return {
        resources,
        technologies,
        jobs,
        researchProgress: getResearchProgress(),
        currentResearchingTech: getCurrentResearchingTech(),
        researchStartTime: getCurrentResearchStartTime(),
        researchElapsedSec: getCurrentResearchElapsedSec(),
        researchLastTickAt: getCurrentResearchLastTickAt(),
        activatedSections,
        buildings,
        salvageActions,
        recipeActions,
        upgradeActions,
        gameFlags: { ...gameFlags },
        storyLog: Array.isArray(storyLog) ? storyLog : getInitialStoryLog(),
        ingameTimeMinutes: getTotalIngameMinutes(),
        timeScale: window.TIME_SCALE ? Number(window.TIME_SCALE) : 1,
        paused: localStorage.getItem('gamePaused') === 'true',
        activeCrashSiteAction: getActiveCrashSiteAction(),
        moraleModifiers: listMoraleModifiers(),
        driveTasks,
        characterState: (function(){ try { return getCharacterStateForSave(); } catch { return null; } })(),
        // Persist narrative objectives alongside the main save so they don't drift
        objectivesStatus: (function(){ try { return getObjectivesStatus(); } catch { return []; } })()
    };
}

export function applyGameState(gameState) {
    if (!gameState) return;

    // Restore ingame time before starting any timers
    if (typeof gameState.ingameTimeMinutes === 'number') {
        setTotalIngameMinutes(gameState.ingameTimeMinutes);
        localStorage.setItem('ingameTimeMinutes', String(gameState.ingameTimeMinutes));
    }

    // Restore game flags (persisted upgrades/toggles)
    if (gameState.gameFlags) {
        applySavedGameFlags(gameState.gameFlags);
    }

    // Restore journal/story log
    if (Array.isArray(gameState.storyLog)) {
        applySavedStoryLog(gameState.storyLog);
        localStorage.setItem('storyLog', JSON.stringify(gameState.storyLog));
        const journalContainer = document.getElementById('journalEntriesContainer');
        if (journalContainer) {
            renderJournalEntries(journalContainer);
        }
    } else {
        resetStoryLog();
        localStorage.setItem('storyLog', JSON.stringify(storyLog));
    }

    // Restore character state (equipment + inventory)
    try {
        if (gameState.characterState && typeof gameState.characterState === 'object') {
            applySavedCharacterState(gameState.characterState);
            localStorage.setItem('characterStateV1', JSON.stringify(gameState.characterState));
        } else {
            resetCharacterState();
            localStorage.setItem('characterStateV1', JSON.stringify(getCharacterStateForSave()));
        }
    } catch { /* non-fatal */ }

    // Smart loading: merge saved data into fresh defaults to preserve forward compatibility
    const defaultResources = getInitialResources();

    // Migration: Scrap Metal -> Metal Parts
    // Old saves used the resource name "Scrap Metal". We now use "Metal Parts".
    // When loading, map the old entry into the new one if present.
    try {
        const saved = Array.isArray(gameState.resources) ? gameState.resources : [];
        const oldScrap = saved.find(r => r && r.name === 'Scrap Metal');
        const hasMetal = saved.some(r => r && r.name === 'Metal Parts');
        if (oldScrap && !hasMetal) {
            saved.push({ ...oldScrap, name: 'Metal Parts' });
        }
    } catch { /* non-fatal */ }

    // Migration: Crew Members -> Survivors
    // We keep the underlying resource name stable as "Survivors" for save/load compatibility,
    // but Chapter 2+ displays it as "Crew Members" in the UI.
    try {
        const saved = Array.isArray(gameState.resources) ? gameState.resources : [];
        const crew = saved.find(r => r && r.name === 'Crew Members');
        const hasSurvivors = saved.some(r => r && r.name === 'Survivors');
        if (crew && !hasSurvivors) {
            saved.push({ ...crew, name: 'Survivors' });
        }
    } catch { /* non-fatal */ }

    defaultResources.forEach(defaultResource => {
        const savedResource = (gameState.resources || []).find(r => r.name === defaultResource.name);
        if (savedResource) {
            Object.assign(defaultResource, savedResource);
        }
    });

    // Ensure design-time balance values are not pinned by older saves.
    // (Older saves may have persisted `baseConsumption`.)
    try {
        const canonical = getInitialResources();
        const canonicalByName = new Map(canonical.map(r => [r.name, r]));
        defaultResources.forEach(r => {
            const c = canonicalByName.get(r.name);
            if (c && typeof c.baseConsumption === 'number') {
                r.baseConsumption = c.baseConsumption;
            }
        });
    } catch { /* non-fatal */ }

    // Migration/UI consistency: Insight + Crystal should display as whole numbers in the info panel.
    // Older saves may have persisted `integer:false` for these resources.
    try {
        defaultResources.forEach(r => {
            if (!r) return;
            if (r.name === 'Insight' || r.name === 'Crystal') {
                r.integer = true;
            }
        });
    } catch { /* non-fatal */ }
    resources.length = 0;
    resources.push(...defaultResources);

    // Migration: convert legacy "tool resources" to inventory items.
    // (Power Cells / Crude Prybar / Makeshift Explosive are now true inventory items.)
    migrateLegacyToolResourcesToInventory();

    const defaultBuildings = getInitialBuildings();
    if (gameState.buildings) {
        // Restore only runtime-mutating fields for buildings while preserving design-time definitions
        // (costs, descriptions, effects, production rates) so content updates apply to old saves.
        const RUNTIME_BUILDING_KEYS = new Set(['count', 'isUnlocked', 'uiNew']);
        defaultBuildings.forEach(defaultBuilding => {
            const savedBuilding = gameState.buildings.find(b => b.name === defaultBuilding.name);
            if (savedBuilding) {
                for (const k of RUNTIME_BUILDING_KEYS) {
                    if (Object.prototype.hasOwnProperty.call(savedBuilding, k)) {
                        defaultBuilding[k] = savedBuilding[k];
                    }
                }
            }
        });
        buildings.length = 0;
        buildings.push(...defaultBuildings);
    }

    if (gameState.salvageActions) {
        // Restore runtime-mutating fields for actions while preserving design-time definitions.
        // Include usage counters and completion flags so limited-use actions stay retired.
        const RUNTIME_ACTION_KEYS = new Set([
            'isUnlocked', 'stage', 'uses', 'maxUses', 'completed',
            'startTime', 'lastTickTime', 'pauseStart',
            // If an action was paused mid-progress (e.g., Stamina ran out), allow resume.
            'savedProgress', 'savedProgressStage',
            // UI-only hint: show "new" badge until user hovers.
            'uiNew',
            // UI/runtime hint: if a spoiler-free encounter was discovered (retreat/lose), show combat badge.
            'encounterDiscovered',
            // Prevent repeatable single-stage actions from re-spamming stage log text.
            'stageLogShown'
        ]);
        salvageActions.forEach(defaultAction => {
            const savedAction = gameState.salvageActions.find(a => a.id === defaultAction.id);
            if (!savedAction) return;
            for (const k of RUNTIME_ACTION_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedAction, k)) {
                    defaultAction[k] = savedAction[k];
                }
            }
        });

        // Migration: older builds incorrectly marked multi-stage actions as fully `completed`
        // after finishing stage 0. If an action still has remaining stages, it must not be completed.
        try {
            for (const a of salvageActions) {
                if (!a || a.repeatable) continue;
                const total = Array.isArray(a.stages) ? a.stages.length : 0;
                if (total <= 1) continue;
                const idx = Number(a.stage || 0);
                if (Number.isFinite(idx) && idx < total) {
                    a.completed = false;
                }
            }
        } catch { /* non-fatal */ }

        // Forward-compat/sanity: if the player already reached D5 (interior wiring story flag),
        // ensure the Strip Wiring action isn't accidentally left locked.
        try {
            const lm = characterState?.localMap;
            if (lm && lm.d5InteriorWiresShown === true) {
                const strip = salvageActions.find(a => a && a.id === 'stripWiring');
                if (strip && strip.isUnlocked !== true) {
                    strip.isUnlocked = true;
                }
            }
        } catch { /* non-fatal */ }

        // Keep aggregator in sync after applying saved action state
        try { refreshAllActions(); } catch {}
    }

    if (gameState.recipeActions) {
        // Restore runtime-mutating fields for recipe actions (crafting) while preserving definitions.
        const RUNTIME_ACTION_KEYS = new Set([
            'isUnlocked', 'stage', 'uses', 'maxUses', 'completed',
            'startTime', 'lastTickTime', 'pauseStart',
            'savedProgress', 'savedProgressStage',
            'uiNew',
            'encounterDiscovered',
            'stageLogShown'
        ]);
        recipeActions.forEach(defaultAction => {
            const savedAction = gameState.recipeActions.find(a => a.id === defaultAction.id);
            if (!savedAction) return;
            for (const k of RUNTIME_ACTION_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedAction, k)) {
                    defaultAction[k] = savedAction[k];
                }
            }
        });

        // Same migration: multi-stage non-repeatable actions shouldn't be marked completed early.
        try {
            for (const a of recipeActions) {
                if (!a || a.repeatable) continue;
                const total = Array.isArray(a.stages) ? a.stages.length : 0;
                if (total <= 1) continue;
                const idx = Number(a.stage || 0);
                if (Number.isFinite(idx) && idx < total) {
                    a.completed = false;
                }
            }
        } catch { /* non-fatal */ }

        try { refreshAllActions(); } catch {}
    }

    if (gameState.upgradeActions) {
        // Restore runtime-mutating fields for upgrade actions
        const RUNTIME_ACTION_KEYS = new Set([
            'isUnlocked', 'stage', 'uses', 'maxUses', 'completed',
            'startTime', 'lastTickTime', 'pauseStart',
            'savedProgress', 'savedProgressStage',
            'uiNew',
            'encounterDiscovered'
            ,
            'stageLogShown'
        ]);
        upgradeActions.forEach(defaultAction => {
            const savedAction = gameState.upgradeActions.find(a => a.id === defaultAction.id);
            if (!savedAction) return;
            for (const k of RUNTIME_ACTION_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedAction, k)) {
                    defaultAction[k] = savedAction[k];
                }
            }
        });

        // Same migration for upgrade actions that use multi-stage definitions.
        try {
            for (const a of upgradeActions) {
                if (!a || a.repeatable) continue;
                const total = Array.isArray(a.stages) ? a.stages.length : 0;
                if (total <= 1) continue;
                const idx = Number(a.stage || 0);
                if (Number.isFinite(idx) && idx < total) {
                    a.completed = false;
                }
            }
        } catch { /* non-fatal */ }
        // Keep aggregator in sync after applying saved upgrade action state
        try { refreshAllActions(); } catch {}
    }

    if (gameState.jobs) {
        // Restore only runtime-mutating fields for jobs while preserving design-time balance.
        const RUNTIME_JOB_KEYS = new Set(['assigned', 'slots', 'unlimited']);
        jobs.forEach(job => {
            const savedJob = gameState.jobs.find(j => j && (j.id === job.id || j.name === job.name));
            if (!savedJob) return;
            for (const k of RUNTIME_JOB_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedJob, k)) {
                    job[k] = savedJob[k];
                }
            }
        });
    }

    if (gameState.technologies) {
        // Restore only runtime-mutating fields while preserving design-time definitions
        // (costs, durations, prerequisites, categories, descriptions) so balance/content updates apply to old saves.
        const RUNTIME_TECH_KEYS = new Set(['isResearched', 'uiNew']);
        technologies.forEach(defaultTech => {
            const savedTech = gameState.technologies.find(t => t && t.name === defaultTech.name);
            if (!savedTech) return;
            for (const k of RUNTIME_TECH_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedTech, k)) {
                    defaultTech[k] = savedTech[k];
                }
            }
        });
    }

    // Persist UI/runtime settings
    if (typeof gameState.timeScale !== 'undefined') {
        localStorage.setItem('gameTimeScale', String(gameState.timeScale));
    }
    if (typeof gameState.paused !== 'undefined') {
        localStorage.setItem('gamePaused', gameState.paused ? 'true' : 'false');
    }

    // Restore research state
    setResearchProgress(gameState.researchProgress ?? 0);
    setCurrentResearchingTech(gameState.currentResearchingTech);
    setResearchInterval(null);
    setCurrentResearchStartTime(gameState.researchStartTime ?? 0);
    setCurrentResearchElapsedSec(gameState.researchElapsedSec ?? 0);
    setCurrentResearchLastTickAt(gameState.researchLastTickAt ?? 0);
    setActivatedSections(gameState.activatedSections ?? getInitialActivatedSections());

    // Re-check unlock conditions after load so the menu can't drift out of sync
    // (e.g., Campsite tab should stay unlocked once Base Camp is established).
    reconcileActivatedSectionsAfterLoad();

    // Restore objectives from composite save (keeps them in sync with other state)
    try {
        if (Array.isArray(gameState.objectivesStatus)) {
            setObjectivesStatus(gameState.objectivesStatus);
            // Mirror into the objectives' own storage for forward compatibility
            localStorage.setItem('objectivesStatusV1', JSON.stringify(gameState.objectivesStatus));
        } else {
            // If not present (older save), leave current objectives as-is
        }
    } catch { /* non-fatal */ }

    // Restore active crash site action
    if (gameState.activeCrashSiteAction) {
        // Migration: this action was split into two new actions.
        // If an older save restores it mid-progress, clear it to avoid orphaned UI/state.
        if (gameState.activeCrashSiteAction.id === 'scavengeCafeteriaSupplies') {
            setActiveCrashSiteAction(null);
        } else {
            setActiveCrashSiteAction(gameState.activeCrashSiteAction);
        }
    }

    // Restore morale modifiers
    if (Array.isArray(gameState.moraleModifiers)) {
        resetMoraleModifiers();
        gameState.moraleModifiers.forEach(mod => {
            if (mod.id && typeof mod.delta === 'number') {
                setMoraleModifier(mod.id, mod.delta, mod.label);
            }
        });
    }

    // Restore encrypted drive tasks
    if (Array.isArray(gameState.driveTasks)) {
        const RUNTIME_TASK_KEYS = new Set([
            'running', 'progress', 'completed', '_startAt', '_elapsedSec', '_lastTickAt'
        ]);
        driveTasks.forEach(defaultTask => {
            const savedTask = gameState.driveTasks.find(t => t.id === defaultTask.id);
            if (!savedTask) return;
            for (const k of RUNTIME_TASK_KEYS) {
                if (Object.prototype.hasOwnProperty.call(savedTask, k)) {
                    defaultTask[k] = savedTask[k];
                }
            }
            // Never restore interval handles; they are not meaningful across sessions.
            defaultTask._timer = null;
        });
    }

    // Resume ongoing research if present
    const techName = getCurrentResearchingTech();
    if (techName) {
        const tech = technologies.find(t => t.name === techName);
        if (tech) {
            const cancelButton =
                document.querySelector('#craftingSection .cancel-button');
            // Prefer persisted scaled elapsed time; otherwise derive it from percent progress (back-compat).
            let elapsedSec = Number(getCurrentResearchElapsedSec());
            if (!(elapsedSec > 0)) {
                elapsedSec = (Number(getResearchProgress()) / 100) * (Number(tech.duration) || 0);
                setCurrentResearchElapsedSec(elapsedSec);
            }
            // Keep startTime for back-compat tooling, but the runtime loop uses elapsedSec.
            setCurrentResearchStartTime(Date.now() - (elapsedSec * 1000));
            setCurrentResearchLastTickAt(Date.now());
            resumeOngoingResearch(tech, cancelButton, getResearchProgress(), getCurrentResearchStartTime());
        }
    }

    // Notify subsystems that game state has been applied
    window.dispatchEvent(new CustomEvent('game-state-applied'));
    
    // Refresh header clock (dynamic import to avoid circular dependency)
    import('../ui/header.js').then(mod => {
        if (mod?.refreshClock) {
            mod.refreshClock();
        }
    });
}

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    
    // Clear log content on load
    const logContent = document.getElementById('logContent');
    if (logContent) {
        logContent.innerHTML = '';
    }

    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        applyGameState(gameState);
        addLogEntry('Game state loaded.', LogType.INFO);
    } else {
        resetToDefaultState();
    }
}

export function resetToDefaultState() {
    addLogEntry('Game state reset.', LogType.INFO);

    // Clear persisted state from localStorage
    localStorage.removeItem('storyLog');
    localStorage.removeItem('logEntries');
    localStorage.removeItem('objectivesStatusV1');
    localStorage.removeItem('characterStateV1');

    // PRIORITY 1: Reset core game state first (data layer)
    resetIngameTime();
    resetResources();
    resetBuildings();
    resetTechnologies();
    resetSalvageActions();
    resetRecipeActions();
    resetUpgradeActions();
    // Keep the exported allActions aggregator in sync after resets
    refreshAllActions();
    resetGameFlags();
    resetStoryLog();
    resetJobs();
    resetActiveActions();
    resetMoraleModifiers();
    resetWeather();
    resetDriveTasks();
    resetCharacterState();
    
    // PRIORITY 2: Reset research state
    clearInterval(getResearchInterval());
    setResearchInterval(null);
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    
    // PRIORITY 3: Reset UI sections
    setActivatedSections(getInitialActivatedSections());

    // PRIORITY 4: Reset objectives and capture first objective for intro popup
    resetObjectives({ suppressEvent: true });
    const snapshot = recomputeObjectives();
    let introOutcome = null;
    if (snapshot && Array.isArray(snapshot.newlyActive) && snapshot.newlyActive.length) {
        introOutcome = { objectives: { newlyActive: snapshot.newlyActive } };
    }

    // PRIORITY 5: Show intro story popup (after all state is clean)
    const event = storyEvents.crashIntro;
    showStoryPopup(event, introOutcome);
    addLogEntry('You survived... somehow. (Click to read)', LogType.STORY, {
        onClick: () => showStoryPopup(event, introOutcome)
    });

    // PRIORITY 6: Persist clean state and broadcast reset event
    saveGameState();
    window.dispatchEvent(new CustomEvent('gameReset'));
    
    // Final recompute to ensure any listeners are synced
    recomputeObjectives();
}

export function resetGameState() {
    console.log('Resetting game state via page reload');
    window.dispatchEvent(new CustomEvent('gameReset'));
    localStorage.clear();
    location.reload();
}

const ENC_PREFIX = 'ENC2:';
const APP_KEY_B64 = 'q1s8Z6v9Yp3rT4m8uV2x7a0nB5cHkL2f9dR0yPq3sM8='; // 32 random bytes, base64

// --- Helpers (keep existing array/base64 helpers if present) ---
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

// Import the application key for AES-GCM (256-bit)
async function getAppCryptoKey() {
    const raw = base64ToArrayBuffer(APP_KEY_B64);
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

// Encrypt / Decrypt using the embedded application key
async function encryptStringWithAppKey(plainText) {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // AES-GCM 12-byte IV
    const key = await getAppCryptoKey();
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText));
    // Compose: iv(12) + cipher
    const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipherBuffer), iv.byteLength);
    return arrayBufferToBase64(combined.buffer);
}

async function decryptStringWithAppKey(base64Combined) {
    const combined = new Uint8Array(base64ToArrayBuffer(base64Combined));
    if (combined.byteLength < 13) throw new Error('Invalid encrypted data');
    const iv = combined.slice(0, 12);
    const cipher = combined.slice(12);
    const key = await getAppCryptoKey();
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    const dec = new TextDecoder();
    return dec.decode(plainBuffer);
}

/* === Export / Import functions updated to use the embedded app key (no prompts) === */

// Export current save to clipboard (always encrypted by default)
export async function exportSaveToClipboard() {
    const json = JSON.stringify(getGameState());
    try {
        const encrypted = await encryptStringWithAppKey(json);
        const payload = ENC_PREFIX + encrypted;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(payload);
            addLogEntry('Save exported to clipboard.', LogType.SUCCESS);
            return { method: 'clipboard' };
        } else {
            const importTextarea = document.getElementById('importSaveText');
            if (importTextarea) importTextarea.value = payload;
            addLogEntry('Save placed into import box (copy manually).', LogType.INFO);
            return { method: 'importBox' };
        }
    } catch (e) {
        addLogEntry('Export failed: ' + (e.message || e), LogType.ERROR);
        return Promise.reject(e);
    }
}

// Import save from a string (auto-detects ENC2: and uses embedded app key)
export async function importSaveFromText(text) {
    if (!text) {
        addLogEntry('Import text is empty.', LogType.ERROR);
        return false;
    }

    try {
        let json;
        const trimmed = text.trim();

        if (trimmed.startsWith(ENC_PREFIX)) {
            const encryptedPart = trimmed.slice(ENC_PREFIX.length);
            try {
                json = await decryptStringWithAppKey(encryptedPart);
            } catch (e) {
                if (e && (e.name === 'OperationError' || e.name === 'InvalidAccessError')) {
                    addLogEntry(
                        'Import failed: scrambled data could not be decrypted. Data may be corrupted.',
                        LogType.ERROR
                    );
                    console.debug('Decryption failure:', e);
                    return false;
                }
                throw e;
            }
        } else {
            // Treat as base64-encoded JSON (legacy)
            const ab = base64ToArrayBuffer(trimmed);
            json = new TextDecoder().decode(ab);
        }

        const parsed = JSON.parse(json);
        applyGameState(parsed);
        localStorage.setItem('gameState', JSON.stringify(parsed));
        addLogEntry('Save imported successfully.', LogType.SUCCESS);
        return true;
    } catch (e) {
        addLogEntry('Import failed: ' + (e.message || e), LogType.ERROR);
        console.debug('Import error details:', e);
        return false;
    }
}

/* === Wire DOM buttons to new export/import behavior (no password UI) === */
document.addEventListener('DOMContentLoaded', () => {
    const exportBtn = document.getElementById('exportSaveButton');
    const importBtn = document.getElementById('importSaveButton');
    const importTextarea = document.getElementById('importSaveText');

    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            const statusEl = document.getElementById('saveMgmtStatus');

            try {
                const result = await exportSaveToClipboard();
                if (statusEl) {
                    statusEl.textContent =
                        result && result.method === 'clipboard'
                            ? 'Exported to clipboard.'
                            : 'Clipboard unavailable — save placed into the import box (copy manually).';
                }
            } catch {
                if (statusEl) statusEl.textContent = 'Export failed.';
            }
        });
    }

    if (importBtn && importTextarea) {
        importBtn.addEventListener('click', async () => {
            const text = importTextarea.value.trim();
            const ok = await importSaveFromText(text);
            if (ok) {
                // Try to close the options menu via its close button (preferred)
                const closeBtn = document.querySelector('#optionsMenu .options-menu-close, .options-menu-close');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    // Fallback: hide the options menu element directly
                    const optionsMenuEl = document.getElementById('optionsMenu');
                    if (optionsMenuEl) {
                        try { optionsMenuEl.classList.add('hidden'); } catch { /* ignore */ }
                        try { optionsMenuEl.hidden = true; } catch { /* ignore */ }
                        try { optionsMenuEl.style.display = ''; } catch { /* ignore */ }
                        try { window.dispatchEvent(new CustomEvent('popup-close')); } catch { /* ignore */ }
                    }
                }

                // Give UI a short moment to settle, then reload to apply imported state cleanly
                setTimeout(() => location.reload(), 200);
            }
        });
    }
});

