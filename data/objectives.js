// Narrative Objectives Engine (v1)
// - Strict narrative beats
// - Up to 5 visible
// - Spoiler-lite labels
// - Minor resource rewards on completion

import { resources } from '../core/resources.js';
import { gameFlags } from './gameFlags.js';
import { allActions } from './definitions/allActions.js';
import { buildings } from './definitions/buildings.js';
import { technologies } from './definitions/technologies.js';
import { jobs } from './jobsManager.js';
import { characterState } from './character.js';
import { addLogEntry, LogType } from '../core/ingameLog.js';
import { getTotalIngameMinutes } from '../core/time.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { storyEvents } from './definitions/storyEvents.js';

const STORAGE_KEY = 'objectivesStatusV1';
const TRACKED_KEY = 'trackedObjectiveV1';
// UI/support: monotonic counter for newly unlocked objectives (locked -> active).
// This is intentionally stored outside the main save; it exists to drive UI "new" indicators.
const UNLOCK_REV_KEY = 'objectivesUnlockRevV1';

// Local status in memory
let status = []; // [{ id, state: 'locked'|'active'|'completed', firstAt, doneAt }]
// Track transitions from the most recent recompute so callers (e.g., story popup) can surface them
let _lastDelta = { completedIds: [], newlyActiveIds: [] };
let _unlockRev = 0;
// Tracked objective (for footer panel)
let trackedObjectiveId = null;

function loadUnlockRev() {
    try {
        const raw = localStorage.getItem(UNLOCK_REV_KEY);
        const n = Number(raw);
        _unlockRev = Number.isFinite(n) ? n : 0;
    } catch { _unlockRev = 0; }
}

function saveUnlockRev() {
    try { localStorage.setItem(UNLOCK_REV_KEY, String(_unlockRev)); } catch {}
}

export function getObjectivesUnlockRevision() {
    return _unlockRev;
}

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
    try { localStorage.removeItem(UNLOCK_REV_KEY); } catch {}
    status = [];
    trackedObjectiveId = null;
    _unlockRev = 0;
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

function hasCompletedObjective(id) {
    const s = status.find(o => o && o.id === id);
    return !!(s && s.state === 'completed');
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
        label: 'Survey the Wreckage',
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
            const lm = characterState?.localMap;
            const discoveredRiver = !!(lm && lm.discoveredRiver);
            const discoveredBerries = !!(lm && lm.discoveredBerries);
            const discoveredCave = !!(lm && lm.discoveredCave);

            // Objective-specific ordered progress: H8 -> D7 -> B6
            let scoutProgress = 0;
            if (discoveredRiver) scoutProgress = 1;
            if (scoutProgress >= 1 && discoveredBerries) scoutProgress = 2;
            if (scoutProgress >= 2 && discoveredCave) scoutProgress = 3;

            const craftTorchDone = !!findAction('createBasicTorch')?.completed;
            const burnWallDone = !!(lm && lm.c5ThornWallBurned === true);
            const atC5 = !!(lm && Number(lm.x) === 3 && Number(lm.y) === 5);

            // Spoiler-free: reveal one step at a time.
            const steps = [];

            const stepAttemptReentryDone = hasCompletedAction('attemptReentry');
            steps.push({ id: 'attempt_reentry', label: 'Attempt reentry into the ship', done: stepAttemptReentryDone });
            if (!stepAttemptReentryDone) return steps;

            const stepScoutDone = scoutProgress >= 3;
            steps.push({ id: 'scout_area', label: 'Scout surroundings', done: stepScoutDone, progress: `${scoutProgress}/3` });
            if (!stepScoutDone) return steps;

            steps.push({ id: 'craft_torch', label: 'Craft Torch', done: craftTorchDone });
            if (!craftTorchDone) return steps;

            steps.push({ id: 'burn_thorns', label: 'Burn the thorny wall', done: burnWallDone });
            if (!burnWallDone) return steps;

            steps.push({ id: 'reach_c5', label: 'Explore further north', done: atC5 });
            if (!atC5) return steps;

            steps.push({ id: 'alternate_access', label: 'Attempt alternate reentry', done: hasCompletedAction('attemptAlternateAccess') });
            return steps;
        }
    },
    {
        id: 'obj_enter',
        label: 'Clear a Path In',
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
            const scrapDone = !!gameFlags.hasReached15ScrapMetal;
            const returnedToCave = !!gameFlags.returnedToCaveAfter15Scrap;

            // Spoiler-free: reveal one step at a time.
            const steps = [];
            steps.push({ id: 'gather_scrap', label: 'Gather Metal Parts (15)', done: scrapDone, progress: scrapDone ? '15/15' : `${Math.floor(scrap)}/15` });
            if (!scrapDone) return steps;

            steps.push({ id: 'return_to_cave', label: 'Return to the cave', done: returnedToCave });
            if (!returnedToCave) return steps;

            steps.push({ id: 'craft_prybar', label: 'Make Crude Prybar', done: prybarCrafted });
            if (!prybarCrafted) return steps;

            steps.push({ id: 'open_hull', label: 'Pry open the hull', done: hasCompletedAction('pryOpenHull') });
            return steps;
        }
    },
    {
        id: 'obj_survivors_basecamp',
        label: 'Check for survivors',
        // Starts immediately after the hull is opened; the player continues inside manually.
        start: () => hasCompletedAction('pryOpenHull'),
        complete: () => hasCompletedAction('investigateSound') && gameFlags.baseCampEstablished === true,
        reward: [{ resource: 'XP', amount: 80 }], // Combined XP reward (30 + 50)
        priority: 4,
        narrative: () => [
            "With the hull breached, the ship is no longer an obstacle — it’s a search site.",
            "The interior is unstable and visibility is poor. If anyone survived, they’ll be deeper in… or outside, drawn by noise and smoke.",
            "Move carefully, follow anything that looks like a sign of life, and be ready to set up a safer foothold once you find a workable spot."
        ].join('\n\n'),
        steps: () => {
            const lm = characterState?.localMap;
            const scrap = getResourceAmount('Metal Parts');
            const wire = getResourceAmount('Wire');

            const deeperInside = (() => {
                try {
                    if (!lm || !lm.visited || typeof lm.visited !== 'object') return false;
                    return lm.visited['5,5'] === true; // E5
                } catch { return false; }
            })();

            const investigatedSound = hasCompletedAction('investigateSound');

            // Spoiler-free: reveal one step at a time.
            const steps = [];
            steps.push({ id: 'continue_inside', label: 'Continue inside the ship', done: deeperInside });
            if (!deeperInside) return steps;

            steps.push({ id: 'investigate_sound', label: 'Investigate the sound', done: investigatedSound });
            if (!investigatedSound) return steps;

            steps.push(
                { id: 'gather_scrap_basecamp', label: 'Gather Metal Parts (25)', done: scrap >= 25 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '25/25' : `${Math.floor(scrap)}/25` },
                { id: 'gather_wire_basecamp', label: 'Gather Wire (12)', done: wire >= 12 || gameFlags.baseCampEstablished, progress: gameFlags.baseCampEstablished ? '12/12' : `${Math.floor(wire)}/12` },
                { id: 'perform_basecamp', label: 'Establish base camp', done: gameFlags.baseCampEstablished === true }
            );

            return steps;
        }
    },
    {
        id: 'obj_tasks_survivors',
        label: 'Stabilize the Camp',
        start: () => gameFlags.baseCampEstablished === true,
        narrative: () => [
            "The camp is standing, but it won’t last on hope alone.",
            "Secure steady food and water, then put people to work so the group can recover — and you can go back in." 
        ].join('\n\n'),
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
            
            // Spoiler-free: reveal one step at a time.
            const steps = [];
            const builtForaging = foragingCampCount >= 1;
            const builtWater = waterStationCount >= 1;

            steps.push({
                id: 'build_foraging_camp',
                label: 'Build Foraging Camp',
                done: builtForaging,
                progress: builtForaging ? '1/1' : `${foragingCampCount}/1`
            });
            if (!builtForaging) return steps;

            steps.push({
                id: 'build_water_station',
                label: 'Build Water Station',
                done: builtWater,
                progress: builtWater ? '1/1' : `${waterStationCount}/1`
            });
            if (!builtWater) return steps;

            steps.push({ id: 'assign_jobs', label: 'Assign jobs (any combination)', done: totalAssigned >= 3, progress: `${totalAssigned}/3` });
            return steps;
        }
    },
    {
        id: 'obj_explore_deeper',
        label: 'Deeper Into the Wreck',
        start: () => gameFlags.hasCompleted_tasksSurvivors === true,
        narrative: () => [
            "With the camp stabilized, you can afford to take bigger risks.",
            "Push deeper into the ship, map what’s still accessible, and find anything — or anyone — that can’t be left behind."
        ].join('\n\n'),
        complete: () => {
            return hasCompletedAction('searchSouthCorridor') && 
                   hasCompletedAction('searchNorthCorridor') && 
                   hasCompletedAction('exploreCafeteria') && 
                   hasCompletedAction('checkCrewQuarters') &&
                   hasCompletedAction('searchLabs') &&
                   hasCompletedAction('searchPowerCore') &&
                   hasCompletedAction('restoreEmergencyPower');
        },
        reward: [{ resource: 'XP', amount: 75 }],
        priority: 7,
        steps: () => {
            const southDone = hasCompletedAction('searchSouthCorridor');
            const northDone = hasCompletedAction('searchNorthCorridor');
            const cafeteriaDone = hasCompletedAction('exploreCafeteria');
            const crewQuartersDone = hasCompletedAction('checkCrewQuarters');
            const labsDone = hasCompletedAction('searchLabs');
            const powerCoreDone = hasCompletedAction('searchPowerCore');
            const powerRestoredDone = hasCompletedAction('restoreEmergencyPower');
            
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

            // Spoiler-free: only reveal once the action is unlocked (after breaching the power core).
            const restoreUnlocked = !!findAction('restoreEmergencyPower')?.isUnlocked;
            if (restoreUnlocked) {
                steps.push({ id: 'restore_emergency_power', label: 'Restore Emergency Power', done: powerRestoredDone });
            }
            
            return steps;
        }
    },
    {
        id: 'obj_fix_radio',
        label: 'Restore long-range communications',
        narrative: () => [
            "The ship’s emergency systems are stable, but you’re still cut off. No beacon. No long-range uplink. No rescue.",
            "If there’s any chance of contacting Command — or even finding out what hit you — you’ll need to salvage working comms hardware from the bridge and rebuild a transmitter at camp.",
            "Get up to the bridge, recover what you can, then return to base camp and make the repair stick."
        ].join('\n\n'),
        // Starts immediately after "Deeper Into the Wreck" is completed.
        start: () => hasCompletedObjective('obj_explore_deeper'),
        complete: () => hasCompletedAction('fixLongRangeRadio'),
        reward: [{ resource: 'XP', amount: 60 }],
        priority: 11,
        steps: () => {
            const steps = [];

            // Step 1: ride the lift up (Investigate Bridge powered stage).
            const liftDone = hasCompletedAction('investigateBridge');
            steps.push({ id: 'reach_upper_deck', label: 'Get the bridge lift working and ride up', done: liftDone });
            if (!liftDone) return steps;

            // Step 2: reach the bridge tile (H6 = 8,6).
            const visitedBridge = (() => {
                try {
                    const lm = characterState?.localMap;
                    return !!(lm && lm.visited && typeof lm.visited === 'object' && lm.visited['8,6'] === true);
                } catch { return false; }
            })();
            steps.push({ id: 'reach_bridge', label: 'Reach the bridge', done: visitedBridge });
            if (!visitedBridge) return steps;

            // Step 3: scavenge the comms panel.
            const scavenged = hasCompletedAction('scavengeCommsPanel');
            steps.push({ id: 'scavenge_comms', label: 'Scavenge a comms panel', done: scavenged });
            if (!scavenged) return steps;

            // Step 4: return to base camp (B7 = 2,7).
            const atBaseCamp = Number(characterState?.localMap?.x) === 2 && Number(characterState?.localMap?.y) === 7;
            steps.push({ id: 'return_base_camp', label: 'Return to base camp', done: atBaseCamp });
            if (!atBaseCamp) return steps;

            // Step 5: perform the repair.
            steps.push({ id: 'repair_radio', label: 'Fix the long-range radio', done: hasCompletedAction('fixLongRangeRadio') });
            return steps;
        }
    },
    
    {
        id: 'obj_improve_base_camp',
        label: 'Improve base camp',
        narrative: () => [
            "A camp that merely survives will eventually fail.",
            "You need better tools, safer shelter, and more efficient routines so the crew can recover between expeditions — and so you can keep pushing outward.",
            "Install upgrades that make camp life stable and sustainable."
        ].join('\n\n'),
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
        narrative: () => [
            "If something comes for the camp — weather, predators, or something worse — you can’t afford to be running on fumes.",
            "Build a reserve. Provisions, water, and salvage stockpiles give you options when conditions turn against you.",
            "Gather enough supplies to withstand a long stretch without easy scavenging."
        ].join('\n\n'),
        // Activate after fixing long-range radio
        start: () => hasCompletedAction('fixLongRangeRadio'),
        complete: () => {
            return getResourceAmount('Provisions') >= 400 &&
                getResourceAmount('Water') >= 500 &&
                getResourceAmount('Metal Parts') >= 200 &&
                getResourceAmount('Fabric') >= 20 &&
                getResourceAmount('Chemicals') >= 20 &&
                getResourceAmount('Wire') >= 100;
        },
        reward: [{ resource: 'XP', amount: 80 }],
        priority: 14,
        steps: () => {
            const foodAmt = getResourceAmount('Provisions');
            const waterAmt = getResourceAmount('Water');
            const scrapAmt = getResourceAmount('Metal Parts');
            const fabricAmt = getResourceAmount('Fabric');
            const chemAmt = getResourceAmount('Chemicals');
            const wireAmt = getResourceAmount('Wire');
            const crewQuartersDone = hasCompletedAction('checkCrewQuarters');
            const cafeteriaDone = hasCompletedAction('exploreCafeteria');
            const guidanceNeeded = !crewQuartersDone || !cafeteriaDone;

            return [
                { id: 'food_goal', label: 'Accumulate Provisions (400)', done: foodAmt >= 400, progress: `${Math.floor(foodAmt)}/400` },
                { id: 'water_goal', label: 'Accumulate Water (500)', done: waterAmt >= 500, progress: `${Math.floor(waterAmt)}/500` },
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
        narrative: () => [
            "You’ve seen signs that you aren’t alone on this world.",
            "A distant smoke column suggests activity — maybe survivors, maybe something else.",
            "Secure what you’ve built, then push beyond the familiar routes and learn what’s out there."
        ].join('\n\n'),
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
        narrative: () => [
            "Command’s message makes one thing clear: this isn’t a simple crash site anymore — it’s an unknown world with unknown risks.",
            "Your scientist insists the scattered crystals aren’t just debris. If you can analyze them, you may learn how to survive here… or how to defend the camp.",
            "Set up a field lab, complete the research, then build a workshop to turn knowledge into capability."
        ].join('\n\n'),
        // Begin immediately after the distant smoke chain finishes (captain's quarters checked)
        start: () => {
            const smoke = status.find(o => o.id === 'obj_investigate_smoke');
            return !!(smoke && smoke.state === 'completed');
        },
        // Complete when the Workshop is built.
        complete: () => {
            const workshop = (buildings || []).find(b => b && b.name === 'Workshop');
            return (workshop?.count || 0) >= 1;
        },
        reward: [{ resource: 'XP', amount: 60 }],
        priority: 16,
        steps: () => {
            const lab = (buildings || []).find(b => b && (b.name === 'Field Lab' || b.id === 'field_lab'));
            const count = lab?.count || 0;
            const crystalAnalysis = (technologies || []).find(t => t && t.name === 'Crystal Analysis');
            const crystalAnalysisDone = !!crystalAnalysis?.isResearched;
            const workshop = (buildings || []).find(b => b && b.name === 'Workshop');
            const workshopCount = workshop?.count || 0;

            const steps = [
                { id: 'build_field_lab', label: 'Build Field Lab', done: count >= 1, progress: count >= 1 ? '1/1' : `${count}/1` },
                { id: 'research_crystal_analysis', label: 'Research Crystal Analysis', done: crystalAnalysisDone }
            ];

            // Workshop unlocks after Crystal Analysis research completes
            if (crystalAnalysisDone) {
                steps.push({ id: 'build_workshop', label: 'Build Workshop', done: workshopCount >= 1, progress: workshopCount >= 1 ? '1/1' : `${workshopCount}/1` });
            }

            return steps;
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
                    // Morale boost: +10% for 5 in-game days
                    try {
                        if (!gameFlags.stockpileMoraleBoostActive) {
                            gameFlags.stockpileMoraleBoostActive = true;
                            gameFlags.stockpileMoraleBoostStartMinutes = getTotalIngameMinutes();
                            addLogEntry('Morale boosted: +10% for 5 days (stockpiles secured).', LogType.UNLOCK);
                        }
                    } catch {}

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
                        let unlockedName = null;
                        try {
                            const act = (allActions || []).find(a => a && a.id === 'investigateDistantSmoke');
                            if (act && !act.isUnlocked) {
                                act.isUnlocked = true;
                                act.uiNew = true;
                                unlockedName = act.name || 'Investigate Distant Smoke';
                                addLogEntry('New action available: Investigate Distant Smoke', LogType.UNLOCK);
                                if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                    try { window.setupCrashSiteSection(); } catch {}
                                }
                            }
                        } catch {}

                        try {
                            const evt = storyEvents.stockpile_complete_smoke_sighting;
                            if (evt && typeof showStoryPopup === 'function') {
                                try {
                                    const lm = characterState?.localMap;
                                    if (lm && typeof lm === 'object') lm.perimeterRouteUnlocked = true;
                                } catch { /* ignore */ }

                                const smokeDef = getObjectiveDefinition('obj_investigate_smoke');
                                const outcome = smokeDef ? { objectives: { newlyActive: [smokeDef] } } : null;
                                showStoryPopup(evt, outcome);
                                addLogEntry(
                                    'In the distance, a thin pillar of smoke catches your eye. (Click to read)',
                                    LogType.STORY,
                                    { onClick: () => showStoryPopup(evt, outcome) }
                                );
                                gameFlags.smokeSightingShown = true;
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
                            const completed = [getObjectiveDefinition(def.id)].filter(Boolean);

                            // If stockpiles are already complete, this completion will also unlock the smoke objective.
                            // Surface that in the popup so it matches other objective-completion popups.
                            const newlyActive = [];
                            try {
                                const stock = status.find(s => s && s.id === 'obj_hoard_supplies');
                                const smokeState = status.find(s => s && s.id === 'obj_investigate_smoke');
                                const wouldUnlockSmoke = !!(stock && stock.state === 'completed' && smokeState && smokeState.state === 'locked');
                                if (wouldUnlockSmoke) {
                                    const smokeDef = getObjectiveDefinition('obj_investigate_smoke');
                                    if (smokeDef) newlyActive.push(smokeDef);
                                }
                            } catch { /* ignore */ }

                            const outcome = {
                                objectives: { completed, newlyActive },
                                rewards: def.reward || []
                            };

                            showStoryPopup(evtBaseCamp, outcome);
                            addLogEntry('The base camp infrastructure is now fully integrated. (Click to read)', LogType.STORY, {
                                onClick: () => showStoryPopup(evtBaseCamp, outcome)
                            });
                        }
                    } catch {}
                    const stockpileComplete = getResourceAmount('Provisions') >= 400 &&
                        getResourceAmount('Water') >= 500 &&
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
                        let unlockedName = null;
                        try {
                            const act = (allActions || []).find(a => a && a.id === 'investigateDistantSmoke');
                            if (act && !act.isUnlocked) {
                                act.isUnlocked = true;
                                act.uiNew = true;
                                unlockedName = act.name || 'Investigate Distant Smoke';
                                addLogEntry('New action available: Investigate Distant Smoke', LogType.UNLOCK);
                                if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                                    try { window.setupCrashSiteSection(); } catch {}
                                }
                            }
                        } catch {}

                        try {
                            const evt = storyEvents.stockpile_complete_smoke_sighting;
                            if (evt && typeof showStoryPopup === 'function') {
                                try {
                                    const lm = characterState?.localMap;
                                    if (lm && typeof lm === 'object') lm.perimeterRouteUnlocked = true;
                                } catch { /* ignore */ }

                                const smokeDef = getObjectiveDefinition('obj_investigate_smoke');
                                const outcome = smokeDef ? { objectives: { newlyActive: [smokeDef] } } : null;
                                showStoryPopup(evt, outcome);
                                addLogEntry(
                                    'In the distance, a thin pillar of smoke catches your eye. (Click to read)',
                                    LogType.STORY,
                                    { onClick: () => showStoryPopup(evt, outcome) }
                                );
                                gameFlags.smokeSightingShown = true;
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
                act.uiNew = true;
                addLogEntry('New action available: Investigate Distant Smoke', LogType.UNLOCK);
                if (typeof window !== 'undefined' && typeof window.setupCrashSiteSection === 'function') {
                    try { window.setupCrashSiteSection(); } catch {}
                }
            }
            const objSmoke = status.find(s => s.id === 'obj_investigate_smoke');
            const defSmoke = defs.find(d => d.id === 'obj_investigate_smoke');
            if (defSmoke && objSmoke && objSmoke.state === 'locked' && defSmoke.start && defSmoke.start()) {
                upsertStatus('obj_investigate_smoke', 'active');
                addLogEntry('New objective (fallback): Beyond the Perimeter', LogType.UNLOCK);
                didChange = true;
            }
        }
    } catch {}

    // Compatibility: if Stockpile resources is already completed in saved objectives, but the morale timer
    // flags weren't present (older saves), initialize from the objective's doneAt timestamp.
    try {
        const stock = status.find(s => s && s.id === 'obj_hoard_supplies');
        if (stock && stock.state === 'completed') {
            const hasStart = Number(gameFlags?.stockpileMoraleBoostStartMinutes) > 0;
            if (!hasStart && Number(stock.doneAt) > 0) {
                gameFlags.stockpileMoraleBoostActive = true;
                gameFlags.stockpileMoraleBoostStartMinutes = Number(stock.doneAt);
            }
        }
    } catch {}

    // Objective guidance: once the player completes the first step of "Enter the wreck" (15 Metal Parts),
    // prompt them to return to the cave to craft the prybar there, and track that return as a new step.
    try {
        const enter = status.find(s => s && s.id === 'obj_enter');
        const enterActive = !!(enter && enter.state === 'active');
        if (enterActive && gameFlags.hasReached15ScrapMetal === true) {
            if (!gameFlags.returnToCaveAfterScrap15Shown) {
                const evt = storyEvents.returnToCaveToCraftPrybar;
                if (evt && typeof showStoryPopup === 'function') {
                    showStoryPopup(evt);
                    addLogEntry('You have enough metal to craft a prybar. Return to the cave. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt) });
                }
                gameFlags.returnToCaveAfterScrap15Shown = true;
                didChange = true;
            }

            if (!gameFlags.returnedToCaveAfter15Scrap) {
                const lm = characterState?.localMap;
                const atCave = !!(lm && Number(lm.x) === 2 && Number(lm.y) === 6);
                if (atCave) {
                    gameFlags.returnedToCaveAfter15Scrap = true;
                    didChange = true;
                }
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

        // Fire a dedicated event only when an objective becomes newly active.
        // This avoids UI badges being triggered by other uses of `objectivesChanged` (e.g., tracking changes).
        try {
            if (snapshot.newlyActive && snapshot.newlyActive.length) {
                _unlockRev += snapshot.newlyActive.length;
                saveUnlockRev();
                window.dispatchEvent(new CustomEvent('objectivesNewlyActive', { detail: { newlyActive: snapshot.newlyActive } }));
            }
        } catch {}
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
loadUnlockRev();
setTimeout(() => { try { recomputeObjectives(); } catch {} }, 0);
