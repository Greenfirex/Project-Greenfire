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
        reward: [{ resource: 'Food Rations', amount: 15 }, { resource: 'Clean Water', amount: 15 }],
        priority: 1
    },
    {
        id: 'obj_scout',
        label: 'Scout the area',
        start: () => findAction('scoutSurroundings')?.isUnlocked,
        complete: () => hasCompletedAction('scoutSurroundings'),
        reward: [{ resource: 'Food Rations', amount: 10 }, { resource: 'Clean Water', amount: 10 }],
        priority: 2
    },
    {
        id: 'obj_prybar',
        label: 'Craft a basic tool',
        start: () => findAction('makeCrudePrybar')?.isUnlocked,
        complete: () => hasCompletedAction('makeCrudePrybar'),
        reward: [{ resource: 'Scrap Metal', amount: 10 }],
        priority: 3
    },
    {
        id: 'obj_enter',
        label: 'Enter the wreck',
        start: () => findAction('pryOpenHull')?.isUnlocked,
        complete: () => hasCompletedAction('pryOpenHull'),
        reward: [{ resource: 'Clean Water', amount: 10 }, { resource: 'Food Rations', amount: 10 }],
        priority: 4
    },
    {
        id: 'obj_survivors',
        label: 'Check for survivors',
        start: () => findAction('investigateSound')?.isUnlocked,
        complete: () => hasCompletedAction('investigateSound'),
        reward: [{ resource: 'Clean Water', amount: 10 }],
        priority: 5
    },
    {
        id: 'obj_basecamp',
        label: 'Establish a base',
        start: () => findAction('establishBaseCamp')?.isUnlocked,
        complete: () => gameFlags.baseCampEstablished === true,
        reward: [{ resource: 'Fabric', amount: 8 }],
        priority: 6
    },
    {
        id: 'obj_explosive',
        label: 'Prepare what you need',
        start: () => findAction('assembleMakeshiftExplosive')?.isUnlocked,
        complete: () => getResourceAmount('Makeshift Explosive') >= 1 || hasCompletedAction('assembleMakeshiftExplosive'),
        reward: [{ resource: 'Scrap Metal', amount: 10 }],
        priority: 7
    },
    {
        id: 'obj_breach',
        label: 'Gain access to a sealed section',
        start: () => findAction('searchPowerCore')?.isUnlocked,
        complete: () => hasCompletedAction('searchPowerCore'),
        reward: [{ resource: 'Clean Water', amount: 10 }, { resource: 'Food Rations', amount: 10 }],
        priority: 8
    },
    {
        id: 'obj_restore_power',
        label: 'Restore emergency systems',
        start: () => findAction('restoreEmergencyPower')?.isUnlocked,
        complete: () => gameFlags.emergencyPowerRestored === true,
        reward: [{ resource: 'Clean Water', amount: 10 }],
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
        reward: [{ resource: 'Food Rations', amount: 15 }],
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
                didChange = true;
            }
        } else if (shouldStart) {
            if (s.state === 'locked') {
                upsertStatus(def.id, 'active');
                addLogEntry(`New objective: ${def.label}`, LogType.UNLOCK);
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
    const active = defs
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map(def => ({ def, st: status.find(s => s.id === def.id) }))
        .filter(x => x.st && (x.st.state === 'active' || x.st.state === 'completed'))
        .slice(0, maxItems)
        .map(x => ({ id: x.def.id, label: x.def.label, completed: x.st.state === 'completed' }));
    return active;
}

// Initialize on import
loadStatus();
setTimeout(() => { try { recomputeObjectives(); } catch {} }, 0);
