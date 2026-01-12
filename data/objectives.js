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
const TRACKED_KEY = 'trackedObjectiveV1';

// Local status in memory
let status = []; // [{ id, state: 'locked'|'active'|'completed', firstAt, doneAt }]
// Track transitions from the most recent recompute so callers (e.g., story popup) can surface them
let _lastDelta = { completedIds: [], newlyActiveIds: [] };
// Tracked objective (for footer panel)
let trackedObjectiveId = null;

export function getObjectivesStatus() {
    return status.slice();
}
export function setObjectivesStatus(newStatus = []) {
    status = Array.isArray(newStatus) ? newStatus.slice() : [];
}

export function getTrackedObjectiveId() {
    return trackedObjectiveId;
}

export function setTrackedObjective(id) {
    trackedObjectiveId = id;
    try { localStorage.setItem(TRACKED_KEY, id || ''); } catch {}
    try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
}

function saveStatus() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(status)); } catch {}
}
export function loadStatus() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        status = raw ? JSON.parse(raw) : [];
    } catch { status = []; }
    try {
        trackedObjectiveId = localStorage.getItem(TRACKED_KEY) || null;
    } catch { trackedObjectiveId = null; }
}

export function resetObjectives(opts = {}) {
    const suppressEvent = !!opts.suppressEvent;
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(TRACKED_KEY); } catch {}
    status = [];
    trackedObjectiveId = null;
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
        label: 'Assess the Wreckage',
        // Optional: narrative text shown in the Journal objective details pane (Markdown supported)
        narrative: () => [
            "The forward hull is a furnace of warped plating and thick smoke. Your first push back inside makes it brutally clear: whatever hit the ship left the structure unstable, and the obvious route is gone.",
            "If you’re going to reach intact compartments — or anyone who made it out alive — you’ll need to think like an officer, not a panicked survivor: secure a place to recover, find food and water, and map the ground around the wreck.",
            "Once you have your bearings, search for a safer way in. Somewhere beneath the scorched seams and collapsed corridors there may be a maintenance path that still leads into the ship."
        ].join('\n\n'),
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
        // Optional: narrative text shown in the Journal objective details pane (Markdown supported)
        narrative: () => [
            "The alternate route back to the ship is real — but it isn’t kind. A narrow conduit and a half-collapsed service corridor point toward intact compartments, yet the passage is choked with debris and jagged metal.",
            "To force a way in, you’ll need leverage and patience. Scavenge enough scrap to craft a crude prybar, then return to the hull and find a seam you can prise apart without bringing the whole section down on your head.",
            "If you can breach the plating, you’ll be inside again — and the wreck will stop being a distant threat and become a place you can search, piece by piece, for survivors and answers."
        ].join('\n\n'),
        // Begin as soon as crafting the prybar is unlocked (after alternate access) or hull prying is available
        start: () => !!findAction('makeCrudePrybar')?.isUnlocked || !!findAction('pryOpenHull')?.isUnlocked,
        // Complete when the hull has been pried open
        complete: () => hasCompletedAction('pryOpenHull'),
        reward: [{ resource: 'XP', amount: 65 }],
        priority: 3,
        steps: () => {
            const scrap = getResourceAmount('Metal Parts');
            const prybarCrafted = hasCompletedAction('makeCrudePrybar');
            return [
                { id: 'gather_scrap', label: 'Gather Metal Parts (15)', done: gameFlags.hasReached15ScrapMetal, progress: gameFlags.hasReached15ScrapMetal ? '15/15' : `${Math.floor(scrap)}/15` },
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
            const scrap = getResourceAmount('Metal Parts');
            const wire = getResourceAmount('Wire');
            const investigatedSound = hasCompletedAction('investigateSound');
            
            // Show the first step always, but subsequent steps only after investigating sound
            const steps = [
                { id: 'investigate_sound', label: 'Investigate the sound', done: investigatedSound }
            ];
            
            // Only show resource gathering and basecamp steps after investigating sound
            if (investigatedSound) {
                steps.push(
                    { id: 'gather_scrap_basecamp', label: 'Gather Metal Parts (25)', done: scrap >= 25 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '25/25' : `${Math.floor(scrap)}/25` },
                    { id: 'gather_wire_basecamp', label: 'Gather Wire (12)', done: wire >= 12 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '12/12' : `${Math.floor(wire)}/12` },
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
            // Check if we have built both buildings and assigned 3+ jobs total
            const foragingCamp = buildings.find(b => b.name === 'Foraging Camp');
            const waterStation = buildings.find(b => b.name === 'Water Station');
            
            const hasBothBuildings = (foragingCamp?.count || 0) >= 1 && (waterStation?.count || 0) >= 1;
            
            // Count total job assignments across all jobs
            const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
            
            return hasBothBuildings && totalAssigned >= 3;
        },
        reward: [{ resource: 'XP', amount: 50 }],
        priority: 6,
        steps: () => {
            const foragingCamp = buildings.find(b => b.name === 'Foraging Camp');
            const waterStation = buildings.find(b => b.name === 'Water Station');
            
            const foragingCampCount = foragingCamp?.count || 0;
            const waterStationCount = waterStation?.count || 0;
            
            // Count total job assignments across all jobs
            const totalAssigned = jobs.reduce((sum, j) => sum + (j.assigned || 0), 0);
            
            return [
                { id: 'build_foraging_camp', label: 'Build Foraging Camp (8 Scrap)', done: foragingCampCount >= 1, progress: foragingCampCount >= 1 ? '1/1' : `${foragingCampCount}/1` },
                { id: 'build_water_station', label: 'Build Water Station (10 Scrap)', done: waterStationCount >= 1, progress: waterStationCount >= 1 ? '1/1' : `${waterStationCount}/1` },
                { id: 'assign_jobs', label: 'Assign jobs (any combination)', done: totalAssigned >= 3, progress: `${totalAssigned}/3` }
            ];
        }
    },
    {
        id: 'obj_explore_deeper',
        label: 'Explore deeper',
        start: () => gameFlags.hasCompleted_tasksSurvivors === true,
        complete: () => {
            return hasCompletedAction('searchSouthCorridor') && 
                   hasCompletedAction('searchNorthCorridor') && 
                   hasCompletedAction('investigateBridge') && 
                   hasCompletedAction('exploreCafeteria') && 
                   hasCompletedAction('checkCrewQuarters') &&
                   hasCompletedAction('searchLabs') &&
                   hasCompletedAction('searchPowerCore');
        },
        reward: [{ resource: 'XP', amount: 75 }],
        priority: 7,
        steps: () => {
            const southDone = hasCompletedAction('searchSouthCorridor');
            const northDone = hasCompletedAction('searchNorthCorridor');
            const bridgeDone = hasCompletedAction('investigateBridge');
            const cafeteriaDone = hasCompletedAction('exploreCafeteria');
            const crewQuartersDone = hasCompletedAction('checkCrewQuarters');
            const labsDone = hasCompletedAction('searchLabs');
            const powerCoreDone = hasCompletedAction('searchPowerCore');
            
            const steps = [];
            
            // South Corridor
            steps.push({ id: 'search_south', label: 'Search: South Corridor', done: southDone });
            if (southDone) {
                steps.push(
                    { id: 'explore_cafeteria', label: '  ↳ Explore Cafeteria', done: cafeteriaDone },
                    { id: 'check_crew_quarters', label: '  ↳ Check Crew Quarters', done: crewQuartersDone }
                );
            }
            
            // North Corridor
            steps.push({ id: 'search_north', label: 'Search: North Corridor', done: northDone });
            if (northDone) {
                steps.push(
                    { id: 'search_labs', label: '  ↳ Search Labs', done: labsDone },
                    { id: 'search_power_core', label: '  ↳ Search Power Core', done: powerCoreDone }
                );
            }
            
            // Bridge
            steps.push({ id: 'investigate_bridge', label: 'Investigate Bridge', done: bridgeDone });
            
            return steps;
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
            { id: 'gather_fabric', label: 'Gather Fabric (6)', done: hasResource('Fabric', 6), progress: `${Math.floor(getResourceAmount('Fabric'))}/6` },
            { id: 'gather_wire', label: 'Gather Wire (25)', done: hasResource('Wire', 25), progress: `${Math.floor(getResourceAmount('Wire'))}/25` },
            { id: 'gather_power_cells', label: 'Gather Power Cells (1)', done: hasResource('Power Cells', 1), progress: `${Math.floor(getResourceAmount('Power Cells'))}/1` },
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
        priority: 13,
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
        // Activate after fixing long-range radio
        start: () => hasCompletedAction('fixLongRangeRadio'),
        complete: () => {
            return getResourceAmount('Food Rations') >= 400 &&
                getResourceAmount('Clean Water') >= 500 &&
                getResourceAmount('Metal Parts') >= 200 &&
                getResourceAmount('Fabric') >= 20 &&
                getResourceAmount('Chemicals') >= 20 &&
                getResourceAmount('Wire') >= 100;
        },
        reward: [{ resource: 'XP', amount: 80 }],
        priority: 14,
        steps: () => {
            const foodAmt = getResourceAmount('Food Rations');
            const waterAmt = getResourceAmount('Clean Water');
            const scrapAmt = getResourceAmount('Metal Parts');
            const fabricAmt = getResourceAmount('Fabric');
            const chemAmt = getResourceAmount('Chemicals');
            const wireAmt = getResourceAmount('Wire');
            const crewQuartersDone = hasCompletedAction('checkCrewQuarters');
            const cafeteriaDone = hasCompletedAction('exploreCafeteria');
            const guidanceNeeded = !crewQuartersDone || !cafeteriaDone;

            return [
                { id: 'food_goal', label: 'Accumulate Food Rations (400)', done: foodAmt >= 400, progress: `${Math.floor(foodAmt)}/400` },
                { id: 'water_goal', label: 'Accumulate Clean Water (500)', done: waterAmt >= 500, progress: `${Math.floor(waterAmt)}/500` },
                { id: 'scrap_goal', label: 'Accumulate Metal Parts (200)', done: scrapAmt >= 200, progress: `${Math.floor(scrapAmt)}/200` },
                { id: 'fabric_goal', label: 'Accumulate Fabric (20)', done: fabricAmt >= 20, progress: `${Math.floor(fabricAmt)}/20` },
                { id: 'chem_goal', label: 'Accumulate Chemicals (20)', done: chemAmt >= 20, progress: `${Math.floor(chemAmt)}/20` },
                { id: 'wire_goal', label: 'Accumulate Wire (100)', done: wireAmt >= 100, progress: `${Math.floor(wireAmt)}/100` },
                guidanceNeeded ? (
                    !crewQuartersDone
                        ? { id: 'hint_crew_quarters', label: 'Explore crew quarters (Fabric, potential supplies)', done: crewQuartersDone }
                        : { id: 'hint_cafeteria', label: 'Explore cafeteria (additional rations & water)', done: cafeteriaDone }
                ) : null
            ].filter(Boolean);
        }
    },
    {
        id: 'obj_investigate_smoke',
        label: 'Beyond the Perimeter',
        start: () => {
            const s1 = status.find(o => o.id === 'obj_improve_base_camp');
            const s2 = status.find(o => o.id === 'obj_hoard_supplies');
            return s1 && s1.state === 'completed' && s2 && s2.state === 'completed';
        },
        complete: () => hasCompletedAction('investigateDistantSmoke') && hasCompletedAction('decryptRadioMessage') && hasCompletedAction('checkCaptainsQuarters'),
        reward: [{ resource: 'XP', amount: 80 }],
        priority: 15,
        steps: () => {
            const investigateDone = hasCompletedAction('investigateDistantSmoke');
            const decryptUnlocked = !!findAction('decryptRadioMessage')?.isUnlocked;
            const decryptDone = hasCompletedAction('decryptRadioMessage');
            const quartersUnlocked = !!findAction('checkCaptainsQuarters')?.isUnlocked;
            const quartersDone = hasCompletedAction('checkCaptainsQuarters');
            
            const steps = [
                { id: 'investigate_smoke', label: 'Investigate distant smoke', done: investigateDone }
            ];
            
            // Only show decrypt step after its action unlocks
            if (decryptUnlocked || investigateDone) {
                steps.push({ id: 'decrypt_message', label: 'Decrypt radio message', done: decryptDone });
            }
            
            // Only show quarters step after its action unlocks
            if (quartersUnlocked || decryptDone) {
                steps.push({ id: 'check_captains_quarters', label: "Check captain's quarters", done: quartersDone });
            }
            
            return steps;
        }
    },
    // New: Chapter II kickoff — Research & Crystal analysis
    {
        id: 'obj_research_crystals',
        label: 'Research & Crystal analysis',
        // Begin immediately after the distant smoke chain finishes (captain's quarters checked)
        start: () => {
            const smoke = status.find(o => o.id === 'obj_investigate_smoke');
            return !!(smoke && smoke.state === 'completed');
        },
        // Complete when the Field Lab building exists (placeholder until building is implemented)
        complete: () => {
            const lab = (buildings || []).find(b => b && (b.name === 'Field Lab' || b.id === 'field_lab'));
            return (lab?.count || 0) >= 1;
        },
        reward: [{ resource: 'XP', amount: 60 }],
        priority: 16,
        steps: () => {
            const lab = (buildings || []).find(b => b && (b.name === 'Field Lab' || b.id === 'field_lab'));
            const count = lab?.count || 0;
            return [
                { id: 'build_field_lab', label: 'Build Field Lab', done: count >= 1, progress: count >= 1 ? '1/1' : `${count}/1` }
            ];
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
                // After fixing radio, notify about multiple objectives and tracking feature
                if (def.id === 'obj_fix_radio') {
                    try {
                        addLogEntry('Multiple objectives are now available. Visit the Journal to track which objective you want to focus on.', LogType.STORY);
                    } catch {}
                }
                // After stockpiling resources, check if both prerequisites are complete
                if (def.id === 'obj_hoard_supplies') {
                    // Show dedicated stockpile completion story
                    try {
                        const evtStock = storyEvents.stockpile_resources_secured;
                        if (evtStock && typeof showStoryPopup === 'function') {
                            showStoryPopup(evtStock);
                            addLogEntry('Critical reserves stabilized. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evtStock) });
                        }
                    } catch {}
                    // If base camp already complete and smoke sighting not yet shown, trigger distant smoke
                    const upgradeIds = ['installForagingTools', 'lightCampfire', 'installScavengerKit', 'salvageCookingEquipment', 'makeTents', 'insulateShelters', 'installRainCatchers', 'installPurificationUnit'];
                    const baseCampComplete = upgradeIds.every(id => hasCompletedAction(id));
                    // Only unlock smoke if at least one base camp upgrade is actually completed
                    const hasAnyUpgrade = upgradeIds.some(id => hasCompletedAction(id));
                    // Additional safety: check if player has progressed beyond initial game state
                    const hasProgressedBeyondStart = hasCompletedAction('attemptReentry') && hasCompletedAction('scoutSurroundings');
                    if (baseCampComplete && !gameFlags.smokeSightingShown && hasAnyUpgrade && hasProgressedBeyondStart) {
                        try {
                            const evt = storyEvents.stockpile_complete_smoke_sighting;
                            if (evt && typeof showStoryPopup === 'function') {
                                showStoryPopup(evt);
                                addLogEntry('In the distance, a thin pillar of smoke catches your eye. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt) });
                                gameFlags.smokeSightingShown = true;
                            }
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
                }
                // After improving base camp, check if both prerequisites are complete
                if (def.id === 'obj_improve_base_camp') {
                    // Always show a dedicated base camp improvement story popup
                    try {
                        const evtBaseCamp = storyEvents.base_camp_improved;
                        if (evtBaseCamp && typeof showStoryPopup === 'function') {
                            showStoryPopup(evtBaseCamp);
                            addLogEntry('The base camp infrastructure is now fully integrated. (Click to read)', LogType.STORY, {
                                onClick: () => showStoryPopup(evtBaseCamp)
                            });
                        }
                    } catch {}
                    const stockpileComplete = getResourceAmount('Food Rations') >= 400 &&
                        getResourceAmount('Clean Water') >= 500 &&
                        getResourceAmount('Metal Parts') >= 200 &&
                        getResourceAmount('Fabric') >= 20 &&
                        getResourceAmount('Chemicals') >= 20 &&
                        getResourceAmount('Wire') >= 100;
                    // Only unlock smoke if at least one base camp upgrade is actually completed
                    const upgradeIds = ['installForagingTools', 'lightCampfire', 'installScavengerKit', 'salvageCookingEquipment', 'makeTents', 'insulateShelters', 'installRainCatchers', 'installPurificationUnit'];
                    const hasAnyUpgrade = upgradeIds.some(id => hasCompletedAction(id));
                    // Additional safety: check if player has progressed beyond initial game state
                    const hasProgressedBeyondStart = hasCompletedAction('attemptReentry') && hasCompletedAction('scoutSurroundings');
                    if (stockpileComplete && !gameFlags.smokeSightingShown && hasAnyUpgrade && hasProgressedBeyondStart) {
                        try {
                            const evt = storyEvents.stockpile_complete_smoke_sighting;
                            if (evt && typeof showStoryPopup === 'function') {
                                showStoryPopup(evt);
                                addLogEntry('In the distance, a thin pillar of smoke catches your eye. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt) });
                                gameFlags.smokeSightingShown = true;
                            }
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
    // Fallback: ensure Investigate Distant Smoke action unlocks and objective activates when prerequisites met
    try {
        const baseCampObj = status.find(s => s.id === 'obj_improve_base_camp');
        const stockpileObj = status.find(s => s.id === 'obj_hoard_supplies');
        const bothComplete = baseCampObj && baseCampObj.state === 'completed' && 
                           stockpileObj && stockpileObj.state === 'completed';
        
        if (bothComplete) {
            const act = (allActions || []).find(a => a.id === 'investigateDistantSmoke');
            if (act && !act.isUnlocked) {
                act.isUnlocked = true;
                addLogEntry('New action available: Investigate Distant Smoke', LogType.UNLOCK);
                if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                    try { window.setupCrashSiteSection(); } catch {}
                }
            }
            const objSmoke = status.find(s => s.id === 'obj_investigate_smoke');
            const defSmoke = defs.find(d => d.id === 'obj_investigate_smoke');
            if (defSmoke && objSmoke && objSmoke.state === 'locked' && defSmoke.start && defSmoke.start()) {
                upsertStatus('obj_investigate_smoke', 'active');
                addLogEntry('New objective (fallback): Investigate distant smoke', LogType.UNLOCK);
                didChange = true;
            }
        }
    } catch {}
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
        narrative: (typeof def.narrative === 'function') ? def.narrative() : (def.narrative || ''),
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
            narrative: (typeof def.narrative === 'function') ? def.narrative() : (def.narrative || ''),
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
