// Narrative Objectives Engine (v1)
// - Strict narrative beats
// - Up to 5 visible
// - Spoiler-lite labels
// - Minor resource rewards on completion

import { resources } from '../core/resources.js';
import { gameFlags } from './gameFlags.js';
import { allActions } from './definitions/allActions.js';
import { buildings } from './definitions/buildings.js';
import { jobs } from './jobsManager.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { storyEvents } from './definitions/storyEvents.js';

const STORAGE_KEY = 'objectivesStatusV1';

// Local status in memory
let status = []; // [{ id, state: 'locked'|'active'|'completed', firstAt, doneAt }]
// Track transitions from the most recent recompute so callers (e.g., story popup) can surface them
let _lastDelta = { completedIds: [], newlyActiveIds: [] };

export function getObjectivesStatus() {
    return status.slice();
}
export function setObjectivesStatus(newStatus = []) {
    status = Array.isArray(newStatus) ? newStatus.slice() : [];
}

function saveStatus() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(status)); } catch {}
}
export function loadStatus() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        status = raw ? JSON.parse(raw) : [];
    } catch { status = []; }
}

export function resetObjectives(opts = {}) {
    const suppressEvent = !!opts.suppressEvent;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    status = [];
    if (!suppressEvent) {
        try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
    }
}
function findAction(id) {
    return (allActions || []).find(a => a && (a.id === id || a.name === id));
}

function hasCompletedAction(id) {
    const a = findAction(id);
    if (!a) return false;
    // For staged actions, consider completion when stage >= totalStages
    const total = Array.isArray(a.stages) ? a.stages.length : 0;
    if (total > 0) return (a.stage || 0) >= total;
    // Non-staged completion is ambiguous; fallback false
    return false;
}

function getResourceAmount(name) {
    const r = (resources || []).find(x => x.name === name);
    return r ? Number(r.amount) : 0;
}

function hasResource(name, target) {
    return getResourceAmount(name) >= target;
}

function grantRewards(rewards) {
    if (!Array.isArray(rewards) || rewards.length === 0) return;
    const lines = [];
    rewards.forEach(rw => {
        const r = (resources || []).find(x => x.name === rw.resource);
        if (r) {
            const add = Number(rw.amount) || 0;
            r.amount = Math.min(r.capacity, r.amount + add);
            lines.push(`+${add} ${r.name}`);
        }
    });
    if (lines.length) addLogEntry(`Objective reward: ${lines.join(', ')}`, LogType.UNLOCK);
}

function upsertStatus(id, nextState) {
    const now = getTotalIngameMinutes();
    let s = status.find(o => o.id === id);
    if (!s) { s = { id, state: 'locked' }; status.push(s); }
    if (s.state !== nextState) {
        if (nextState === 'active' && !s.firstAt) s.firstAt = now;
        if (nextState === 'completed' && !s.doneAt) s.doneAt = now;
        s.state = nextState;
    }
}

// Terse, spoiler-lite labels. Conditions use flags and known unlocks.
const defs = [
    {
        id: 'obj_entry',
        label: () => {
            const reentryDone = hasCompletedAction('attemptReentry');
            const scout = findAction('scoutSurroundings');
            const scoutTotal = Array.isArray(scout?.stages) ? scout.stages.length : 0;
            const scoutStage = Math.min(scout?.stage || 0, scoutTotal);
            const scoutDone = hasCompletedAction('scoutSurroundings');
            const altDone = hasCompletedAction('attemptAlternateAccess');
            if (!reentryDone) return 'Attempt reentry into the ship';
            if (!scoutDone) return `Scout surroundings (${scoutStage}/${scoutTotal || 3})`;
            if (!altDone) return 'Attempt alternate access';
            return 'Regain entry accomplished';
        },
        start: () => true,
        complete: () => hasCompletedAction('attemptAlternateAccess'),
        reward: [{ resource: 'XP', amount: 70 }],
        priority: 1,
        steps: () => {
            const scout = findAction('scoutSurroundings');
            const total = Array.isArray(scout?.stages) ? scout.stages.length : 3;
            const stage = Math.min(scout?.stage || 0, total);
            return [
                { id: 'attempt_reentry', label: 'Attempt reentry into the ship', done: hasCompletedAction('attemptReentry') },
                { id: 'scout_area', label: 'Scout surroundings', done: hasCompletedAction('scoutSurroundings'), progress: `${stage}/${total}` },
                { id: 'alternate_access', label: 'Attempt alternate access', done: hasCompletedAction('attemptAlternateAccess') }
            ];
        }
    },
    {
        id: 'obj_enter',
        label: 'Enter the wreck',
        // Begin as soon as crafting the prybar is unlocked (after alternate access) or hull prying is available
        start: () => !!findAction('makeCrudePrybar')?.isUnlocked || !!findAction('pryOpenHull')?.isUnlocked,
        // Complete when the hull has been pried open
        complete: () => hasCompletedAction('pryOpenHull'),
        reward: [{ resource: 'XP', amount: 65 }],
        priority: 3,
        steps: () => {
            const scrap = getResourceAmount('Scrap Metal');
            const prybarCrafted = hasCompletedAction('makeCrudePrybar');
            return [
                { id: 'gather_scrap', label: 'Gather Scrap Metal (15)', done: gameFlags.hasReached15ScrapMetal, progress: gameFlags.hasReached15ScrapMetal ? '15/15' : `${scrap}/15` },
                { id: 'craft_prybar', label: 'Make Crude Prybar', done: prybarCrafted },
                { id: 'open_hull', label: 'Pry open hull', done: hasCompletedAction('pryOpenHull') }
            ];
        }
    },
    {
        id: 'obj_survivors_basecamp',
        label: 'Check for survivors',
        start: () => findAction('investigateSound')?.isUnlocked,
        complete: () => hasCompletedAction('investigateSound') && gameFlags.baseCampEstablished === true,
        reward: [{ resource: 'XP', amount: 80 }], // Combined XP reward (30 + 50)
        priority: 5,
        steps: () => {
            const scrap = getResourceAmount('Scrap Metal');
            const wire = getResourceAmount('Wire');
            const investigatedSound = hasCompletedAction('investigateSound');
            
            // Show the first step always, but subsequent steps only after investigating sound
            const steps = [
                { id: 'investigate_sound', label: 'Investigate the sound', done: investigatedSound }
            ];
            
            // Only show resource gathering and basecamp steps after investigating sound
            if (investigatedSound) {
                steps.push(
                    { id: 'gather_scrap_basecamp', label: 'Gather Scrap Metal (25)', done: scrap >= 25 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '25/25' : `${scrap}/25` },
                    { id: 'gather_wire_basecamp', label: 'Gather Wire (12)', done: wire >= 12 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '12/12' : `${wire}/12` },
                    { id: 'perform_basecamp', label: 'Establish base camp', done: gameFlags.baseCampEstablished === true }
                );
            }
            
            return steps;
        }
    },
    {
        id: 'obj_tasks_survivors',
        label: 'Tasks for survivors',
        start: () => gameFlags.baseCampEstablished === true,
        complete: () => {
            // Check if we have built both buildings and assigned jobs
            const foragingCamp = buildings.find(b => b.name === 'Foraging Camp');
            const waterStation = buildings.find(b => b.name === 'Water Station');
            const foragingJob = jobs.find(j => j.id === 'foraging');
            const waterJob = jobs.find(j => j.id === 'water_collection');
            const scrapJob = jobs.find(j => j.id === 'scrap_collector');
            
            const hasBothBuildings = (foragingCamp?.count || 0) >= 1 && (waterStation?.count || 0) >= 1;
            const hasJobAssignments = (foragingJob?.assigned || 0) >= 1 && 
                                    (waterJob?.assigned || 0) >= 1 && 
                                    (scrapJob?.assigned || 0) >= 1;
            
            return hasBothBuildings && hasJobAssignments;
        },
        reward: [{ resource: 'XP', amount: 50 }],
        priority: 6,
        steps: () => {
            const foragingCamp = buildings.find(b => b.name === 'Foraging Camp');
            const waterStation = buildings.find(b => b.name === 'Water Station');
            const foragingJob = jobs.find(j => j.id === 'foraging');
            const waterJob = jobs.find(j => j.id === 'water_collection');
            const scrapJob = jobs.find(j => j.id === 'scrap_collector');
            
            const foragingCampCount = foragingCamp?.count || 0;
            const waterStationCount = waterStation?.count || 0;
            const foragingAssigned = foragingJob?.assigned || 0;
            const waterAssigned = waterJob?.assigned || 0;
            const scrapAssigned = scrapJob?.assigned || 0;
            
            return [
                { id: 'build_foraging_camp', label: 'Build Foraging Camp (8 Scrap)', done: foragingCampCount >= 1, progress: foragingCampCount >= 1 ? '1/1' : `${foragingCampCount}/1` },
                { id: 'build_water_station', label: 'Build Water Station (10 Scrap)', done: waterStationCount >= 1, progress: waterStationCount >= 1 ? '1/1' : `${waterStationCount}/1` },
                { id: 'assign_water_job', label: 'Assign Water Collection job', done: waterAssigned >= 1, progress: waterAssigned >= 1 ? '1/1' : `${waterAssigned}/1` },
                { id: 'assign_scrap_job', label: 'Assign Scrap Collector job', done: scrapAssigned >= 1, progress: scrapAssigned >= 1 ? '1/1' : `${scrapAssigned}/1` },
                { id: 'assign_foraging_job', label: 'Assign Foraging job', done: foragingAssigned >= 1, progress: foragingAssigned >= 1 ? '1/1' : `${foragingAssigned}/1` }
            ];
        }
    },
    {
        id: 'obj_explore_deeper',
        label: 'Explore deeper',
        start: () => gameFlags.hasCompleted_tasksSurvivors === true,
        complete: () => hasCompletedAction('searchSouthCorridor') && hasCompletedAction('searchNorthCorridor') && hasCompletedAction('investigateBridge'),
        reward: [{ resource: 'XP', amount: 75 }],
        priority: 7,
        steps: () => {
            const southDone = hasCompletedAction('searchSouthCorridor');
            const northDone = hasCompletedAction('searchNorthCorridor');
            const bridgeDone = hasCompletedAction('investigateBridge');
            
            return [
                { id: 'search_south', label: 'Search: South Corridor', done: southDone },
                { id: 'search_north', label: 'Search: North Corridor', done: northDone },
                { id: 'investigate_bridge', label: 'Investigate Bridge', done: bridgeDone }
            ];
        }
    },
    {
        id: 'obj_fix_radio',
        label: 'Fix long-range radio',
        // Radio repair requires Fabric; ensure players have explored Crew Quarters first
        start: () => !!findAction('fixLongRangeRadio')?.isUnlocked && hasCompletedAction('checkCrewQuarters'),
        complete: () => hasCompletedAction('fixLongRangeRadio'),
        reward: [{ resource: 'XP', amount: 60 }],
        priority: 11,
        steps: () => [
            { id: 'explore_crew_quarters', label: 'Explore crew quarters (Fabric)', done: hasCompletedAction('checkCrewQuarters') },
            { id: 'gather_fabric', label: 'Gather Fabric (6)', done: hasResource('Fabric', 6), progress: `${getResourceAmount('Fabric')}/6` },
            { id: 'gather_wire', label: 'Gather Wire (25)', done: hasResource('Wire', 25), progress: `${getResourceAmount('Wire')}/25` },
            { id: 'gather_power_cells', label: 'Gather Power Cells (1)', done: hasResource('Power Cells', 1), progress: `${getResourceAmount('Power Cells')}/1` },
            { id: 'repair_radio', label: 'Perform radio repair', done: hasCompletedAction('fixLongRangeRadio') }
        ]
    },
    
    {
        id: 'obj_improve_base_camp',
        label: 'Improve base camp',
        start: () => hasCompletedAction('fixLongRangeRadio'),
        complete: () => {
            const upgradeIds = ['installForagingTools', 'lightCampfire', 'installScavengerKit', 'salvageCookingEquipment', 'makeTents', 'insulateShelters', 'installRainCatchers', 'installPurificationUnit'];
            return upgradeIds.every(id => hasCompletedAction(id));
        },
        reward: [{ resource: 'XP', amount: 100 }],
        priority: 12,
        steps: () => {
            const upgrades = [
                { id: 'installForagingTools', name: 'Crude Foraging Tools' },
                { id: 'lightCampfire', name: 'Light Campfire' },
                { id: 'installScavengerKit', name: 'Scavenger Kit' },
                { id: 'salvageCookingEquipment', name: 'Salvage Cooking Equipment' },
                { id: 'makeTents', name: 'Make Tents (Base Camp)' },
                { id: 'insulateShelters', name: 'Insulate Shelters' },
                { id: 'installRainCatchers', name: 'Install Rain Catchers' },
                { id: 'installPurificationUnit', name: 'Install Purification Unit' }
            ];
            return upgrades.map(u => ({
                id: u.id,
                label: u.name,
                done: hasCompletedAction(u.id)
            }));
        }
    },
    {
        id: 'obj_hoard_supplies',
        label: 'Stockpile resources',
        // Activate only after players improve base camp (all base-camp upgrades complete)
        start: () => {
            const upgradeIds = ['installForagingTools', 'lightCampfire', 'installScavengerKit', 'salvageCookingEquipment', 'makeTents', 'insulateShelters', 'installRainCatchers', 'installPurificationUnit'];
            return upgradeIds.every(id => hasCompletedAction(id));
        },
        complete: () => {
            return hasCompletedAction('investigateDistantSmoke') &&
                getResourceAmount('Food Rations') >= 400 &&
                getResourceAmount('Clean Water') >= 500 &&
                getResourceAmount('Scrap Metal') >= 200 &&
                getResourceAmount('Fabric') >= 20 &&
                getResourceAmount('Chemicals') >= 20 &&
                getResourceAmount('Wire') >= 100;
        },
        reward: [{ resource: 'XP', amount: 80 }],
        priority: 12,
        steps: () => {
            const foodAmt = getResourceAmount('Food Rations');
            const waterAmt = getResourceAmount('Clean Water');
            const scrapAmt = getResourceAmount('Scrap Metal');
            const fabricAmt = getResourceAmount('Fabric');
            const chemAmt = getResourceAmount('Chemicals');
            const wireAmt = getResourceAmount('Wire');
            const crewQuartersDone = hasCompletedAction('checkCrewQuarters');
            const cafeteriaDone = hasCompletedAction('exploreCafeteria');
            const guidanceNeeded = !crewQuartersDone || !cafeteriaDone;
            const smokeDone = hasCompletedAction('investigateDistantSmoke');

            return [
                { id: 'investigate_smoke', label: 'Investigate distant smoke', done: smokeDone },
                { id: 'food_goal', label: 'Accumulate Food Rations (400)', done: foodAmt >= 400, progress: `${foodAmt}/400` },
                { id: 'water_goal', label: 'Accumulate Clean Water (500)', done: waterAmt >= 500, progress: `${waterAmt}/500` },
                { id: 'scrap_goal', label: 'Accumulate Scrap Metal (200)', done: scrapAmt >= 200, progress: `${scrapAmt}/200` },
                { id: 'fabric_goal', label: 'Accumulate Fabric (20)', done: fabricAmt >= 20, progress: `${fabricAmt}/20` },
                { id: 'chem_goal', label: 'Accumulate Chemicals (20)', done: chemAmt >= 20, progress: `${chemAmt}/20` },
                { id: 'wire_goal', label: 'Accumulate Wire (100)', done: wireAmt >= 100, progress: `${wireAmt}/100` },
                guidanceNeeded ? (
                    !crewQuartersDone
                        ? { id: 'hint_crew_quarters', label: 'Explore crew quarters (Fabric, potential supplies)', done: crewQuartersDone }
                        : { id: 'hint_cafeteria', label: 'Explore cafeteria (additional rations & water)', done: cafeteriaDone }
                ) : null
            ].filter(Boolean);
        }
    }
];

function getOrCreateStateFor(id) {
    let s = status.find(o => o.id === id);
    if (!s) { s = { id, state: 'locked' }; status.push(s); }
    return s;
}

export function recomputeObjectives() {
    let didChange = false;
    // reset delta tracking for this recompute pass
    _lastDelta = { completedIds: [], newlyActiveIds: [] };
    defs.sort((a, b) => a.priority - b.priority).forEach(def => {
        const s = getOrCreateStateFor(def.id);
        const shouldStart = !!def.start?.();
        const isComplete = !!def.complete?.();
        const prev = s.state;
        const labelText = (typeof def.label === 'function') ? def.label() : def.label;
        if (isComplete) {
            if (s.state !== 'completed') {
                upsertStatus(def.id, 'completed');
                grantRewards(def.reward || []);
                addLogEntry(`Objective completed: ${labelText}`, LogType.UNLOCK);
                try { _lastDelta.completedIds.push(def.id); } catch {}
                
                // Set specific completion flags for game mechanics
                if (def.id === 'obj_tasks_survivors') {
                    gameFlags.hasCompleted_tasksSurvivors = true;
                    // Show story popup for tasks completion with outcome data
                    try {
                        const storyEvent = storyEvents.tasks_for_survivors_completed;
                        if (storyEvent) {
                            // Build outcome data to show completed and new objectives in popup
                            const completed = [getObjectiveDefinition(def.id)].filter(Boolean);
                            const newlyActive = [];
                            
                            // Check if "Explore deeper" objective should start
                            const exploreDeepDef = defs.find(d => d.id === 'obj_explore_deeper');
                            if (exploreDeepDef && exploreDeepDef.start && exploreDeepDef.start()) {
                                const exploreDefObj = getObjectiveDefinition('obj_explore_deeper');
                                if (exploreDefObj) newlyActive.push(exploreDefObj);
                            }
                            
                            const outcome = {
                                objectives: { completed, newlyActive },
                                rewards: def.reward || []
                            };
                            
                            showStoryPopup(storyEvent, outcome);
                            addLogEntry('Your base camp is now organized and efficient. Time to explore deeper. (Click to read)', LogType.STORY, {
                                onClick: () => showStoryPopup(storyEvent, outcome)
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to show tasks completion story:', e);
                    }
                }
                // After improving base camp, surface guidance and unlock a new exploration lead
                if (def.id === 'obj_improve_base_camp') {
                    try {
                        addLogEntry('Now that our camp is a bit more efficient, we should stockpile some resources.', LogType.STORY);
                        addLogEntry('In the distance, a thin pillar of smoke catches your eye — likely an escape pod. We should explore it.', LogType.STORY);
                    } catch {}
                    try {
                        const act = (allActions || []).find(a => a.id === 'investigateDistantSmoke');
                        if (act && !act.isUnlocked) {
                            act.isUnlocked = true;
                            addLogEntry('New action available: Investigate Distant Smoke', LogType.UNLOCK);
                            if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                try { window.setupCrashSiteSection(); } catch {}
                            }
                        }
                    } catch {}
                }
                // Transition to Chapter II after Stockpile resources objective completes
                if (def.id === 'obj_hoard_supplies') {
                    try {
                        gameFlags.chapter = 2;
                        addLogEntry('Chapter II unlocked: Shadows Beyond the Perimeter', LogType.UNLOCK);
                        const evt = storyEvents.chapter2_intro;
                        if (evt && typeof showStoryPopup === 'function') {
                            showStoryPopup(evt);
                            addLogEntry('Chapter II begins. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt) });
                        }
                    } catch {}
                }
                
                didChange = true;
            }
        } else if (shouldStart) {
            if (s.state === 'locked') {
                upsertStatus(def.id, 'active');
                addLogEntry(`New objective: ${labelText}`, LogType.UNLOCK);
                try { _lastDelta.newlyActiveIds.push(def.id); } catch {}
                didChange = true;
            }
        }
        if (prev !== s.state) didChange = true;
    });
    const snapshot = {
        completed: (_lastDelta.completedIds || []).map(id => getObjectiveDefinition(id)).filter(Boolean),
        newlyActive: (_lastDelta.newlyActiveIds || []).map(id => getObjectiveDefinition(id)).filter(Boolean)
    };
    if (didChange) {
        saveStatus();
        try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
    }
    return snapshot;
}

export function getVisibleObjectives(maxItems = 5) {
    // Prefer showing active objectives first, then backfill with recently completed ones.
    // This keeps the drawer feeling “alive” instead of being stuck on the first 5 completed items.
    const byId = new Map(status.map(s => [s.id, s]));
    const ranked = defs.slice().sort((a, b) => a.priority - b.priority);
    const active = [];
    const completed = [];
    for (const def of ranked) {
        const st = byId.get(def.id);
        if (!st) continue;
        if (st.state === 'active') active.push({ def, st });
        if (st.state === 'completed') completed.push({ def, st });
    }
    // Sort completed by most recent completion (doneAt), fallback to priority when equal/missing
    completed.sort((a, b) => {
        const ad = typeof a.st.doneAt === 'number' ? a.st.doneAt : -Infinity;
        const bd = typeof b.st.doneAt === 'number' ? b.st.doneAt : -Infinity;
        if (ad !== bd) return bd - ad; // newest first
        return a.def.priority - b.def.priority;
    });

    const picked = [...active, ...completed].slice(0, maxItems);
    return picked.map(x => {
        let label = typeof x.def.label === 'function' ? x.def.label() : x.def.label;
        // Dynamic exploration hint for stockpile objective if key exploration actions incomplete
        // Banner retains concise label; exploration hints now moved into steps list.
        return { id: x.def.id, label, completed: x.st.state === 'completed' };
    });
}

// Lightweight accessor for UI/other modules
export function getObjectiveDefinition(id) {
    const def = defs.find(d => d.id === id);
    if (!def) return null;
    // Return a copy with only safe fields for external use
    return {
        id: def.id,
        label: (typeof def.label === 'function') ? def.label() : def.label,
        reward: Array.isArray(def.reward) ? def.reward.map(r => ({ resource: r.resource, amount: r.amount })) : [],
        priority: def.priority
    };
}

// New: return all objectives with current state & timing for history / journal objective tab
export function getAllObjectivesWithState() {
    const byId = new Map(status.map(s => [s.id, s]));
    return defs.map(def => {
        const st = byId.get(def.id) || { state: 'locked' };
        return {
            id: def.id,
            label: (typeof def.label === 'function') ? def.label() : def.label,
            reward: Array.isArray(def.reward) ? def.reward.map(r => ({ resource: r.resource, amount: r.amount })) : [],
            priority: def.priority,
            state: st.state,
            firstAt: st.firstAt,
            doneAt: st.doneAt
        };
    });
}

// Public steps accessor: returns dynamic list of step objects
export function getObjectiveSteps(id) {
    const def = defs.find(d => d.id === id);
    if (!def) return [];
    if (typeof def.steps === 'function') {
        try {
            const raw = def.steps();
            return Array.isArray(raw) ? raw.map(s => ({ id: s.id, label: s.label, done: !!s.done, progress: s.progress })) : [];
        } catch { return []; }
    }
    if (Array.isArray(def.steps)) {
        return def.steps.map(s => ({ id: s.id, label: s.label, done: !!s.done, progress: s.progress }));
    }
    return [];
}

// Provide the list of transitions captured in the most recent recompute pass
export function getLastObjectivesDelta() {
    const toDefs = (ids) => ids.map(id => getObjectiveDefinition(id)).filter(Boolean);
    return {
        completed: toDefs(_lastDelta.completedIds || []),
        newlyActive: toDefs(_lastDelta.newlyActiveIds || [])
    };
}

// Initialize on import
loadStatus();
setTimeout(() => { try { recomputeObjectives(); } catch {} }, 0);
