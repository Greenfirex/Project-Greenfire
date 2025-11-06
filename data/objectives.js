// Narrative Objectives Engine (v1)
// - Strict narrative beats
// - Up to 5 visible
// - Spoiler-lite labels
// - Minor resource rewards on completion

import { resources } from '../resources.js';
import { gameFlags } from './gameFlags.js';
import { allActions } from './allActions.js';
import { addLogEntry, LogType } from '../log.js';
import { getTotalIngameMinutes } from '../time.js';

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

export function resetObjectives() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    status = [];
    try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
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
        id: 'obj_reentry',
        label: 'Force a way in',
        start: () => true,
        complete: () => hasCompletedAction('attemptReentry'),
        reward: [{ resource: 'XP', amount: 30 }],
        priority: 1
    },
    {
        id: 'obj_scout',
        label: 'Scout the area',
        start: () => findAction('scoutSurroundings')?.isUnlocked,
        complete: () => hasCompletedAction('scoutSurroundings'),
        reward: [{ resource: 'XP', amount: 40 }],
        priority: 2
    },
    {
        id: 'obj_prybar',
        label: 'Craft a basic tool',
        start: () => findAction('makeCrudePrybar')?.isUnlocked,
        complete: () => hasCompletedAction('makeCrudePrybar'),
        reward: [{ resource: 'XP', amount: 25 }],
        priority: 3
    },
    {
        id: 'obj_enter',
        label: 'Enter the wreck',
        start: () => findAction('pryOpenHull')?.isUnlocked,
        complete: () => hasCompletedAction('pryOpenHull'),
        reward: [{ resource: 'XP', amount: 40 }],
        priority: 4
    },
    {
        id: 'obj_survivors',
        label: 'Check for survivors',
        start: () => findAction('investigateSound')?.isUnlocked,
        complete: () => hasCompletedAction('investigateSound'),
        reward: [{ resource: 'XP', amount: 30 }],
        priority: 5
    },
    {
        id: 'obj_basecamp',
        label: 'Establish a base',
        start: () => findAction('establishBaseCamp')?.isUnlocked,
        complete: () => gameFlags.baseCampEstablished === true,
        reward: [{ resource: 'XP', amount: 50 }],
        priority: 6
    },
    {
        id: 'obj_explosive',
        label: 'Prepare what you need',
        start: () => findAction('assembleMakeshiftExplosive')?.isUnlocked,
        complete: () => getResourceAmount('Makeshift Explosive') >= 1 || hasCompletedAction('assembleMakeshiftExplosive'),
        reward: [{ resource: 'XP', amount: 35 }],
        priority: 7
    },
    {
        id: 'obj_breach',
        label: 'Gain access to a sealed section',
        start: () => findAction('searchPowerCore')?.isUnlocked,
        complete: () => hasCompletedAction('searchPowerCore'),
        reward: [{ resource: 'XP', amount: 50 }],
        priority: 8
    },
    {
        id: 'obj_restore_power',
        label: 'Restore emergency systems',
        start: () => findAction('restoreEmergencyPower')?.isUnlocked,
        complete: () => gameFlags.emergencyPowerRestored === true,
        reward: [{ resource: 'XP', amount: 60 }],
        priority: 9
    },
    {
        id: 'obj_reach_bridge',
        label: 'Reach the command deck',
        start: () => findAction('investigateBridge')?.isUnlocked && gameFlags.emergencyPowerRestored === true,
        complete: () => {
            const a = findAction('investigateBridge');
            const total = Array.isArray(a?.stages) ? a.stages.length : 0;
            return total > 0 ? (a.stage || 0) >= total : false;
        },
        reward: [{ resource: 'XP', amount: 80 }],
        priority: 10
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
        if (isComplete) {
            if (s.state !== 'completed') {
                upsertStatus(def.id, 'completed');
                grantRewards(def.reward || []);
                addLogEntry(`Objective completed: ${def.label}`, LogType.UNLOCK);
                try { _lastDelta.completedIds.push(def.id); } catch {}
                didChange = true;
            }
        } else if (shouldStart) {
            if (s.state === 'locked') {
                upsertStatus(def.id, 'active');
                addLogEntry(`New objective: ${def.label}`, LogType.UNLOCK);
                try { _lastDelta.newlyActiveIds.push(def.id); } catch {}
                didChange = true;
            }
        }
        if (prev !== s.state) didChange = true;
    });
    if (didChange) {
        saveStatus();
        try { window.dispatchEvent(new CustomEvent('objectivesChanged')); } catch {}
    }
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
    return picked.map(x => ({ id: x.def.id, label: x.def.label, completed: x.st.state === 'completed' }));
}

// Lightweight accessor for UI/other modules
export function getObjectiveDefinition(id) {
    const def = defs.find(d => d.id === id);
    if (!def) return null;
    // Return a copy with only safe fields for external use
    return {
        id: def.id,
        label: def.label,
        reward: Array.isArray(def.reward) ? def.reward.map(r => ({ resource: r.resource, amount: r.amount })) : [],
        priority: def.priority
    };
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
