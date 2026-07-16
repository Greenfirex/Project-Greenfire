// Narrative Objectives Engine
// - Main quest "Survive" acts as a hub — each step unlocks a side quest
// - Side quests have spoiler-free steps (only done + next revealed)
// - Objectives track persistent milestones (loopKnowledge) — survive death
// - Up to 5 visible in footer drawer
// - Minor resource rewards on completion

import { resources } from './resources.js';
import { gameFlags, hasMilestone } from './gameFlags.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { getTotalIngameMinutes } from './time.js';
import { t } from '../locales/locales.js';
import { getLocation } from '../sections/locations/locationData.js';
import { activeEffects } from './effects.js';

const STORAGE_KEY = 'objectivesStatusV1';
const TRACKED_KEY = 'trackedObjectiveV1';

// Local status in memory
let status = []; // [{ id, state: 'locked'|'active'|'completed', firstAt, doneAt }]
let trackedObjectiveId = null;

// ---------------------------------------------------------------------------
// Story log (journal entries)
// ---------------------------------------------------------------------------
export function getInitialStoryLog() {
    return [];
}

export let storyLog = getInitialStoryLog();

// ---------------------------------------------------------------------------
// Helpers — action completion & milestone checks
// ---------------------------------------------------------------------------

function isActionCompleted(locationId, actionId) {
    const loc = getLocation(locationId);
    if (!loc) return false;
    const a = (loc.actions || []).find(x => x.id === actionId);
    return !!(a && a._completed);
}

function isActionAvailable(locationId, actionId) {
    const loc = getLocation(locationId);
    if (!loc) return false;
    const a = (loc.actions || []).find(x => x.id === actionId);
    if (!a) return false;
    // If _completed, still "available" for step purposes
    if (a._completed) return true;
    // Check isAvailable if present
    if (typeof a.isAvailable === 'function') {
        try {
            const ctx = {
                gameFlags,
                getCurrentLocationId: () => locationId,
                getUnlockState: (id) => {
                    try {
                        const raw = localStorage.getItem('unlockState_' + id);
                        return raw ? JSON.parse(raw) : {};
                    } catch { return {}; }
                },
                hasMilestone,
                countItemInBag: () => 0,
                t
            };
            return a.isAvailable(ctx);
        } catch { return false; }
    }
    // No isAvailable → visible by default
    return true;
}

/** Check if the recycler has been repaired in a past loop (persistent knowledge). */
function isRecyclerRepaired() {
    return hasMilestone('recycler_repaired');
}

/** Check if terminal access has been gained in either location (persistent knowledge). */
function hasTerminalAccess() {
    return hasMilestone('crew_terminal_access') || hasMilestone('bridge_terminal_access');
}

// ---------------------------------------------------------------------------
// Objective definitions
// ---------------------------------------------------------------------------

const defs = [
    // ======================================================================
    // MAIN QUEST: Survive
    // ======================================================================
    {
        id: 'obj_survive',
        type: 'main',
        label: () => t('obj_survive_label'),
        narrative: () => {
            const loop = gameFlags.loopCount || 0;
            if (loop >= 2) return t('obj_survive_narrative_loop2');
            if (loop >= 1) return t('obj_survive_narrative_loop1');
            return t('obj_survive_narrative');
        },
        start: () => true, // available immediately
        complete: () => {
            // All steps done
            return isActionCompleted('scout_ship_crew_quarters', 'wake_up')
                && hasTerminalAccess()
                && isRecyclerRepaired()
                && hasMilestone('gamma_site_heard')
                && hasMilestone('reactor_optimized')
                && hasMilestone('rover_inspected');
        },
        reward: [{ resource: 'XP', amount: 250 }],
        priority: 1,
        steps: () => {
            // All steps visible immediately — they complete via side quests in any order
            const steps = [];

            steps.push({
                id: 'step_wake_up',
                label: t('obj_survive_step1'),
                done: isActionCompleted('scout_ship_crew_quarters', 'wake_up'),
            });

            steps.push({
                id: 'step_terminal',
                label: t('obj_survive_step2'),
                done: hasTerminalAccess(),
            });

            steps.push({
                id: 'step_water',
                label: t('obj_survive_step3'),
                done: isRecyclerRepaired(),
            });

            steps.push({
                id: 'step_comms',
                label: t('obj_survive_step4'),
                done: hasMilestone('gamma_site_heard'),
            });

            steps.push({
                id: 'step_reactor',
                label: t('obj_survive_step5'),
                done: hasMilestone('reactor_optimized'),
            });

            steps.push({
                id: 'step_garage',
                label: t('obj_survive_step6'),
                done: hasMilestone('rover_inspected'),
            });

            return steps;
        }
    },

    // ======================================================================
    // MAIN QUEST: Reach Gamma Site
    // ======================================================================
    {
        id: 'obj_reach_gamma_site',
        type: 'main',
        label: () => t('obj_reach_gamma_site_label'),
        narrative: () => t('obj_reach_gamma_site_narrative'),
        start: () => hasMilestone('gamma_site_heard'),
        complete: () => isActionCompleted('scout_ship_bridge', 'set_course_gamma'),
        reward: [{ resource: 'XP', amount: 200 }],
        priority: 10,
        steps: () => {
            const steps = [];
            steps.push({
                id: 'step_get_coords',
                label: t('obj_reach_gamma_step1'),
                done: hasMilestone('gamma_coordinates_known'),
            });
            steps.push({
                id: 'step_bridge_access',
                label: t('obj_reach_gamma_step2'),
                done: hasMilestone('bridge_terminal_access'),
            });
            steps.push({
                id: 'step_confirm_scanner',
                label: t('obj_reach_gamma_step3'),
                done: hasMilestone('gamma_site_confirmed_on_scanner'),
            });
            steps.push({
                id: 'step_set_course',
                label: t('obj_reach_gamma_step4'),
                done: isActionCompleted('scout_ship_bridge', 'set_course_gamma'),
            });
            steps.push({
                id: 'step_survive_journey',
                label: t('obj_reach_gamma_step5'),
                done: (() => {
                    try {
                        const eff = activeEffects.find(e => e.id === 'on_route_gamma');
                        return !!(eff && eff._expired);
                    } catch { return false; }
                })(),
            });
            return steps;
        }
    },

    // ======================================================================
    // SIDE QUEST: Disable the Alarm
    // ======================================================================
    {
        id: 'obj_disable_alarm',
        type: 'side',
        label: () => t('obj_disable_alarm_label'),
        narrative: () => t('obj_disable_alarm_narrative'),
        start: () => isActionCompleted('scout_ship_crew_quarters', 'check_terminal'),
        complete: () => isActionCompleted('scout_ship_crew_quarters', 'disable_alarm'),
        reward: [{ resource: 'XP', amount: 75 }],
        priority: 2,
        steps: () => {
            const steps = [];

            // Step 1: Examine terminal — always done (quest starts with it)
            steps.push({
                id: 'step_check_terminal',
                label: t('obj_disable_alarm_step1'),
                done: true,
            });

            // Step 2: Gain access — use terminal_access_gained milestone
            // (check_terminal.onComplete sets _completed on use_terminal_login / enter_known_credentials
            //  to *hide* them — not because they are done. hasTerminalAccess() is the real check.)
            const accessDone = hasTerminalAccess();
            steps.push({
                id: 'step_get_access',
                label: t('obj_disable_alarm_step2'),
                done: accessDone,
            });
            if (!accessDone) return steps;

            // Step 3: Disable the alarm (required)
            const alarmDone = isActionCompleted('scout_ship_crew_quarters', 'disable_alarm');
            steps.push({
                id: 'step_disable_alarm',
                label: t('obj_disable_alarm_step3'),
                done: alarmDone,
            });

            return steps;
        }
    },

    // ======================================================================
    // SIDE QUEST: Repair Recycler
    // ======================================================================
    {
        id: 'obj_repair_recycler',
        type: 'side',
        label: () => t('obj_repair_recycler_label'),
        narrative: () => t('obj_repair_recycler_narrative'),
        start: () => isActionCompleted('scout_ship_main_area', 'assess_supplies'),
        complete: () => isRecyclerRepaired(),
        reward: [{ resource: 'XP', amount: 75 }, { resource: 'Drinking Water', amount: 10 }],
        priority: 3,
        steps: () => {
            const steps = [];

            // Step 1: Assess supplies
            const assessed = isActionCompleted('scout_ship_main_area', 'assess_supplies');
            steps.push({
                id: 'step_assess_supplies',
                label: t('obj_repair_recycler_step1'),
                done: assessed,
            });
            if (!assessed) return steps;

            // Step 2: Scavenge repair tools
            // The player needs repair_tools in bag or has already repaired
            const repaired = isRecyclerRepaired();
            const hasTools = isActionCompleted('scout_ship_workshop', 'grab_tools') ||
                (typeof window !== 'undefined' && window._hasRepairToolsInBag);
            steps.push({
                id: 'step_get_tools',
                label: t('obj_repair_recycler_step2'),
                done: hasTools || repaired,
            });
            if (!hasTools && !repaired) return steps;

            // Step 3: Repair recycler
            steps.push({
                id: 'step_repair',
                label: t('obj_repair_recycler_step3'),
                done: repaired,
            });

            return steps;
        }
    },

    // ======================================================================
    // SIDE QUEST: Establish Contact
    // ======================================================================
    {
        id: 'obj_establish_contact',
        type: 'side',
        label: () => t('obj_establish_contact_label'),
        narrative: () => t('obj_establish_contact_narrative'),
        start: () => isActionCompleted('scout_ship_main_area', 'check_comms'),
        complete: () => hasMilestone('gamma_site_heard'),
        reward: [{ resource: 'XP', amount: 100 }],
        priority: 4,
        steps: () => {
            const steps = [];

            // Step 1: Inspect comms panel
            const checked = isActionCompleted('scout_ship_main_area', 'check_comms');
            steps.push({
                id: 'step_check_comms',
                label: t('obj_establish_contact_step1'),
                done: checked,
            });
            if (!checked) return steps;

            // Step 2: Fabricate amplifier
            const fabDone = isActionCompleted('scout_ship_workshop', 'fabricate_amplifier');
            steps.push({
                id: 'step_fab_amplifier',
                label: t('obj_establish_contact_step2'),
                done: fabDone,
            });
            if (!fabDone) return steps;

            // Step 3: Install comms
            const installed = gameFlags.commsInstalled;
            steps.push({
                id: 'step_install_comms',
                label: t('obj_establish_contact_step3'),
                done: installed,
            });
            if (!installed) return steps;

            // Step 4: Send ping
            const pinged = hasMilestone('ping_sent');
            steps.push({
                id: 'step_send_ping',
                label: t('obj_establish_contact_step4'),
                done: pinged,
            });
            if (!pinged) return steps;

            // Step 5: Evaluate results
            const heard = hasMilestone('gamma_site_heard');
            steps.push({
                id: 'step_check_results',
                label: t('obj_establish_contact_step5'),
                done: heard,
            });

            return steps;
        }
    },

    // ======================================================================
    // SIDE QUEST: Reactor Status
    // ======================================================================
    {
        id: 'obj_reactor_status',
        type: 'side',
        label: () => t('obj_reactor_status_label'),
        narrative: () => t('obj_reactor_status_narrative'),
        start: () => {
            // Start when the player has checked the bridge terminal
            // (or in loop 2+, fuel_scanned is already known)
            return isActionCompleted('scout_ship_bridge', 'check_bridge_terminal')
                || hasMilestone('fuel_scanned');
        },
        complete: () => hasMilestone('reactor_optimized'),
        reward: [{ resource: 'XP', amount: 100 }],
        priority: 5,
        steps: () => {
            const steps = [];
            const hasAccess = hasTerminalAccess();

            // Step 1: Get to bridge — examine terminal
            const termChecked = isActionCompleted('scout_ship_bridge', 'check_bridge_terminal');
            // In loop 2+, check_bridge_terminal is hidden, so count it as done
            const termSkipped = termChecked ||
                !isActionAvailable('scout_ship_bridge', 'check_bridge_terminal');
            steps.push({
                id: 'step_reach_bridge',
                label: t('obj_reactor_status_step1'),
                done: termSkipped,
            });

            if (hasAccess) {
                // === BRANCH A: Player already has terminal access ===
                if (!termSkipped) return steps;

                // Step 2: Log in with credentials
                const loggedIn = isActionCompleted('scout_ship_bridge', 'enter_known_credentials_bridge');
                // In loop 2+, enter_known_credentials_bridge may be hidden (mutual exclusion)
                const loginAvailable = isActionAvailable('scout_ship_bridge', 'enter_known_credentials_bridge');
                if (loginAvailable || loggedIn) {
                    steps.push({
                        id: 'step_login',
                        label: t('obj_reactor_status_step3'),
                        done: loggedIn,
                    });
                    if (!loggedIn && loginAvailable) return steps;
                }

                // Step 3: Check reactor status
                const reactorChecked = hasMilestone('fuel_scanned') ||
                    isActionCompleted('scout_ship_bridge', 'check_reactor_status');
                const reactorAvailable = isActionAvailable('scout_ship_bridge', 'check_reactor_status');
                if (reactorAvailable || reactorChecked) {
                    steps.push({
                        id: 'step_check_reactor',
                        label: t('obj_reactor_status_step2'),
                        done: reactorChecked,
                    });
                    if (!reactorChecked && reactorAvailable) return steps;
                }

                // Step 4: Optimize reactor
                const optimized = hasMilestone('reactor_optimized');
                steps.push({
                    id: 'step_optimize',
                    label: t('obj_reactor_status_step4'),
                    done: optimized,
                });
            } else {
                // === BRANCH B: Player needs to gain terminal access ===
                if (!termSkipped) return steps;

                // Step 2: Gain terminal access
                const hacked = isActionCompleted('scout_ship_bridge', 'hack_bridge_terminal');
                const usedLogin = isActionCompleted('scout_ship_bridge', 'use_bridge_terminal_login');
                const enteredCreds = isActionCompleted('scout_ship_bridge', 'enter_known_credentials_bridge');
                const accessDone = hacked || usedLogin || enteredCreds;
                steps.push({
                    id: 'step_get_access',
                    label: t('obj_reactor_status_step2b'),
                    done: accessDone,
                });
                if (!accessDone) return steps;

                // Step 3: Check reactor status
                const reactorChecked = hasMilestone('fuel_scanned') ||
                    isActionCompleted('scout_ship_bridge', 'check_reactor_status');
                const reactorAvailable = isActionAvailable('scout_ship_bridge', 'check_reactor_status');
                if (reactorAvailable || reactorChecked) {
                    steps.push({
                        id: 'step_check_reactor_b',
                        label: t('obj_reactor_status_step3b'),
                        done: reactorChecked,
                    });
                    if (!reactorChecked && reactorAvailable) return steps;
                }

                // Step 4: Optimize reactor
                const optimized = hasMilestone('reactor_optimized');
                steps.push({
                    id: 'step_optimize_b',
                    label: t('obj_reactor_status_step4b'),
                    done: optimized,
                });
            }

            return steps;
        }
    },

    // ======================================================================
    // SIDE QUEST: Fuel Reserves
    // ======================================================================
    {
        id: 'obj_rover_fuel',
        type: 'side',
        label: () => t('obj_rover_fuel_label'),
        narrative: () => t('obj_rover_fuel_narrative'),
        start: () => hasMilestone('rover_inspected'),
        complete: () => hasMilestone('rover_fuel_cell_installed'),
        reward: [{ resource: 'XP', amount: 150 }],
        priority: 6,
        steps: () => {
            const steps = [];

            // Step 1: Inspect rover
            const inspected = isActionCompleted('scout_ship_workshop', 'inspect_rover');
            steps.push({
                id: 'step_inspect_rover',
                label: t('obj_rover_fuel_step1'),
                done: inspected,
            });
            if (!inspected) return steps;

            // Step 2: Extract rover fuel cell
            const extracted = isActionCompleted('scout_ship_workshop', 'extract_rover_fuel_cell')
                || hasMilestone('rover_fuel_cell_extracted');
            steps.push({
                id: 'step_extract_fuel_cell',
                label: t('obj_rover_fuel_step2'),
                done: extracted,
            });
            if (!extracted) return steps;

            // Step 3: Remove engine panel
            const panelRemoved = isActionCompleted('scout_ship_bridge', 'remove_engine_panel')
                || hasMilestone('engine_panel_removed');
            steps.push({
                id: 'step_remove_panel',
                label: t('obj_rover_fuel_step3'),
                done: panelRemoved,
            });
            if (!panelRemoved) return steps;

            // Step 4: Study ship manual (persistent — may already be done)
            const manualStudied = isActionCompleted('scout_ship_workshop', 'study_ship_manual')
                || hasMilestone('ship_manual_studied');
            steps.push({
                id: 'step_study_manual',
                label: t('obj_rover_fuel_step4'),
                done: manualStudied,
            });
            if (!manualStudied) return steps;

            // Step 5: Install rover fuel cell
            const installed = isActionCompleted('scout_ship_bridge', 'install_rover_fuel_cell')
                || hasMilestone('rover_fuel_cell_installed');
            steps.push({
                id: 'step_install_cell',
                label: t('obj_rover_fuel_step5'),
                done: installed,
            });

            return steps;
        }
    }
];

// ---------------------------------------------------------------------------
// Status persistence
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getResourceAmount(name) {
    const r = (resources || []).find(x => x.name === name);
    return r ? Number(r.amount) : 0;
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
    if (lines.length) addLogEntry(t('objectives_reward_log', { rewards: lines.join(', ') }), LogType.UNLOCK);
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function getOrCreateStateFor(id) {
    let s = status.find(o => o.id === id);
    if (!s) { s = { id, state: 'locked' }; status.push(s); }
    return s;
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

export function recomputeObjectives() {
    let didChange = false;
    const result = { newlyActive: [], completed: [] };

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
                addLogEntry(t('objectives_completed_log', { name: labelText }), LogType.UNLOCK);
                result.completed.push(def.id);
                didChange = true;
            }
        } else if (shouldStart) {
            if (s.state === 'locked') {
                upsertStatus(def.id, 'active');
                addLogEntry(t('objectives_new_log', { name: labelText }), LogType.UNLOCK);
                result.newlyActive.push(def.id);
                didChange = true;
            }
        }

        if (prev !== s.state) didChange = true;
    });

    if (didChange) {
        saveStatus();
        try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
        if (result.newlyActive.length > 0) {
            result.newlyActive.forEach(id => {
                try { localStorage.setItem('uiObjectiveNew:' + id, 'true'); } catch {}
            });
            try { window.dispatchEvent(new CustomEvent('objectivesDiscovered', { detail: { ids: result.newlyActive } })); } catch {}
        }
    }

    return result;
}

// ---------------------------------------------------------------------------
// Public query API
// ---------------------------------------------------------------------------

export function getVisibleObjectives(maxItems = 5) {
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

    completed.sort((a, b) => {
        const ad = typeof a.st.doneAt === 'number' ? a.st.doneAt : -Infinity;
        const bd = typeof b.st.doneAt === 'number' ? b.st.doneAt : -Infinity;
        if (ad !== bd) return bd - ad;
        return a.def.priority - b.def.priority;
    });

    const picked = [...active, ...completed].slice(0, maxItems);
    return picked.map(x => ({
        id: x.def.id,
        label: typeof x.def.label === 'function' ? x.def.label() : x.def.label,
        completed: x.st.state === 'completed'
    }));
}

export function getObjectiveDefinition(id) {
    const def = defs.find(d => d.id === id);
    if (!def) return null;
    return {
        id: def.id,
        type: def.type || 'side',
        label: (typeof def.label === 'function') ? def.label() : def.label,
        narrative: (typeof def.narrative === 'function') ? def.narrative() : (def.narrative || ''),
        reward: Array.isArray(def.reward) ? def.reward.map(r => ({ resource: r.resource, amount: r.amount })) : [],
        priority: def.priority
    };
}

export function getAllObjectivesWithState() {
    const byId = new Map(status.map(s => [s.id, s]));
    return defs.map(def => {
        const st = byId.get(def.id) || { state: 'locked' };
        return {
            id: def.id,
            type: def.type || 'side',
            label: (typeof def.label === 'function') ? def.label() : def.label,
            narrative: (typeof def.narrative === 'function') ? def.narrative() : (def.narrative || ''),
            state: st.state || 'locked',
            firstAt: st.firstAt,
            doneAt: st.doneAt,
            reward: Array.isArray(def.reward) ? def.reward.map(r => ({ resource: r.resource, amount: r.amount })) : [],
            priority: def.priority
        };
    });
}

export function getObjectiveSteps(objectiveId) {
    const def = defs.find(d => d.id === objectiveId);
    if (!def || typeof def.steps !== 'function') return [];
    try {
        return def.steps();
    } catch {
        return [];
    }
}