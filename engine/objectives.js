// Narrative Objectives Engine
// - First objective available immediately after game start
// - All user-visible text uses locale keys via t()
// - Up to 5 visible in footer drawer
// - Minor resource rewards on completion

import { resources } from './resources.js';
import { gameFlags } from './gameFlags.js';
import { addLogEntry, LogType } from './ingameLog.js';
import { getTotalIngameMinutes } from './time.js';
import { t } from '../locales/locales.js';

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
// Objective definitions
// ---------------------------------------------------------------------------

const defs = [
    {
        id: 'obj_first_steps',
        label: () => t('obj_first_steps_label'),
        narrative: () => t('obj_first_steps_narrative'),
        start: () => true, // available immediately
        complete: () => gameFlags.firstObjectiveComplete === true,
        reward: [{ resource: 'XP', amount: 50 }],
        priority: 1,
        steps: () => {
            const steps = [];
            // Step 1: Open the Journal to read objectives
            steps.push({
                id: 'open_journal',
                label: t('obj_first_steps_step1'),
                done: false, // This is informational - no flag tracking yet
            });
            // Step 2: Check the Crash Site section
            steps.push({
                id: 'check_crash_site',
                label: t('obj_first_steps_step2'),
                done: false,
            });
            // Step 3: Review resources in info panel
            steps.push({
                id: 'review_resources',
                label: t('obj_first_steps_step3'),
                done: false,
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