// ==========================================================================
// Location Engine
// ==========================================================================

import { resources, updateResourceInfo, setActiveDrainRates, setActiveAreaDrainRates, setActionAreaDrainRates, applyTimePassiveDrain, roundResourceAmount, checkDeathAndLoop, initAreaResources, drainAreaResource, showAreaSuppliesPanel, areaResources, revealAreaResources } from '../../engine/resources.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';
import { getCurrentLocationId, switchToLocation, getLocation, getAllLocations } from './locationData.js';
import { advanceIngameTimeBySeconds, getIngameTimeString } from '../../engine/time.js';
import { gameFlags, flagActionAsNew, persistLoopKnowledge } from '../../engine/gameFlags.js';
import { hasEffect, removeEffect, addEffect, advanceEffectProgress } from '../../engine/effects.js';
import { startNextQueuedAction, updateQueueActive } from '../../engine/queue.js';
import { grantItemToCharacter, consumeItemQuantityFromBag, countItemInBag } from '../character/character.js';
import { getItemDefinition } from '../character/items.js';
import { refreshUI, updateActionButtonsDynamic, clearHoverState } from './locationUi.js';

const DEFAULT_DRAIN = { 'Stamina': 0.20, 'Food Rations': 0.08, 'Drinking Water': 0.12 };
const TAXING_MULT = 2.0;

export let activeAction = null;
export let activeActionId = null;
export let actionProgress = 0;
export let selectedActionId = null;
export let actionPaused = false;
export let _fullRebuildNeeded = true;
let actionTimer = null;
let _infoUpdateCounter = 0;
// True while the tab/app is backgrounded (visibilitychange). The action tick
// interval keeps running (setInterval isn't cleared) but skips doing any work,
// so no queued callbacks pile up and fire in a burst when focus returns.
let _actionTimerSuspended = false;
try {
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            _actionTimerSuspended = document.visibilityState === 'hidden';
        });
    }
} catch { /* ignore */ }


export function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

export function canAffordAction(action) {
    if (!action) return true;
    const durationMins = (action.durationSeconds || 1) / 60;
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const baseRates = action.drainRates || DEFAULT_DRAIN;
    for (const [resName, baseRate] of Object.entries(baseRates)) {
        if (action.category === 'rest' && resName === 'Stamina') continue;
        if (action.category === 'refresh' && resName === 'Drinking Water') continue;
        const rateMultiplier = resName === 'Stamina' ? mult : 1;
        const totalCost = baseRate * rateMultiplier * durationMins;
        const resource = getResourceByName(resName);
        if (!resource) continue;
        if (totalCost <= 0) continue;
        if (!Number.isFinite(Number(resource.amount)) || Number(resource.amount) < totalCost) return false;
    }
    return true;
}

function applyActionDrainCosts(action) {
    if (!action || !Array.isArray(action.drain)) return;
    action.drain.forEach(d => {
        const resource = getResourceByName(d.resource);
        if (!resource) return;
        const amount = Number(d.amount) || 0;
        if (amount > 0) { resource.amount = Math.max(0, resource.amount - amount); roundResourceAmount(resource); }
    });
}

function applyActionRewards(action) {
    if (!action || !Array.isArray(action.rewards)) return;
    action.rewards.forEach(r => {
        if (r.type === 'resource') {
            const resource = getResourceByName(r.name);
            if (resource) { resource.amount = (Number(resource.amount) || 0) + (Number(r.amount) || 0); roundResourceAmount(resource); }
        } else if (r.type === 'item') {
            const itemId = String(r.name || '').toLowerCase().replace(/\s+/g, '_');
            if (itemId) {
                const result = grantItemToCharacter(itemId, { amount: Number(r.amount) || 1 });
                if (result.ok) {
                    const itemDefForName = getItemDefinition(itemId);
                    const itemDisplayName = (itemDefForName?.nameKey && t(itemDefForName.nameKey)) || r.name || itemId;
                    addLogEntry(t('log_received_item', { item: itemDisplayName }), LogType.UNLOCK);
                }
            }
        }
    });
}

// ==========================================================================
// Action callback context — passed to onStart / onComplete / getResultKey
// ==========================================================================

/** Build the callback context object for action hooks. */
function buildActionCtx(action) {
    return {
        gameFlags,
        action,
        addLogEntry,
        LogType,
        t,
        areaResources,
        getLocation,
        getCurrentLocationId,
        getUnlockState,
        setUnlockState,
        flagActionAsNew,
        initAreaResources,
        revealAreaResources,
        showAreaSuppliesPanel,
        refreshUI,
        countItemInBag,
        consumeItemQuantityFromBag,
        persistLoopKnowledge,
        setFullRebuildNeeded(v) { _fullRebuildNeeded = v; },
    };
}

// ==========================================================================
// Debug-mode safe callback invocation
// ==========================================================================
// Action definition callbacks (onStart/getResultKey/onComplete/isAvailable)
// run inside try/catch so a bug in one action's callback never crashes the
// whole engine. By default failures are silently swallowed (production-safe).
// Set `window.DEBUG_ACTIONS = true` in the console to log the action id,
// callback name, and error to the console instead of silently ignoring it —
// this is the fastest way to catch "result text was wrong after a loop"
// style bugs caused by a thrown exception inside a callback.
export function safeInvokeActionCallback(fn, ctx, action, callbackName) {
    try {
        return fn(ctx);
    } catch (err) {
        try {
            if (typeof window !== 'undefined' && window.DEBUG_ACTIONS) {
                console.warn(`[action:${action?.id || '?'}] ${callbackName}() threw:`, err);
            }
        } catch { /* ignore */ }
        return undefined;
    }
}


// ==========================================================================
// Action completion
// ==========================================================================

function completeActiveAction(opts = {}) {
    const reason = opts.reason || 'auto';
    const action = activeAction;
    if (!action) return;
    setActiveDrainRates(null, null);
    setActionAreaDrainRates(null);
    // Consume required item now that the action completed successfully.
    if (action._pendingItem) {
        try {
            const itemDef = getItemDefinition(action._pendingItem);
            const consumed = consumeItemQuantityFromBag(action._pendingItem, 1);
            if (consumed) {
                const itemDisplayName = (itemDef?.nameKey && t(itemDef.nameKey)) || itemDef?.name || action._pendingItem;
                addLogEntry(t('log_used_item', { item: itemDisplayName }), LogType.UNLOCK);
            }
            delete action._pendingItem;
        } catch { /* ignore */ }
    }

    // Rest/refresh actions gain resources continuously via drain rate;
    if (action.category !== 'rest' && action.category !== 'refresh') {
        applyActionRewards(action);
    }

    // Log appropriate completion message
    if (!action.suppressCompletionLog) {
        if (reason === 'cap') {
            if (action.category === 'rest') addLogEntry(t('log_rest_cap'), LogType.SUCCESS);
            else if (action.category === 'refresh') addLogEntry(t('log_water_cap'), LogType.SUCCESS);
            else addLogEntry(`${action._displayName || action.id} completed.`, LogType.SUCCESS);
        } else if (reason === 'manual') {
            addLogEntry(t('log_action_stopped', { action: action._displayName || t(action.nameKey) }), LogType.INFO);
        } else if (action._resultKey || action.resultKey) {
            addLogEntry(t(action._resultKey || action.resultKey), LogType.SUCCESS);
        } else {
            addLogEntry(t('log_action_completed', { action: action._displayName || t(action.nameKey) }), LogType.INFO);
        }
    }
    // Remove effect if this action removes one
    if (action.removesEffect) {
        removeEffect(action.removesEffect);
        addLogEntry(t('log_effect_removed', { effect: t('effect_' + action.removesEffect) }), LogType.ERROR);
    }
    
    // Add effect if this action adds one
    if (action.addsEffect) {
        const effectDef = {
            id: action.addsEffect,
            nameKey: 'effect_' + action.addsEffect,
            descKey: 'effect_' + action.addsEffect + '_desc',
        };
        if (action.addsEffect === 'alarm') {
            Object.assign(effectDef, { icon: '🔔', progress: 0, maxProgress: Infinity, debuffs: { 'Stamina': -0.2 } });
        } else if (action.addsEffect === 'waiting_ping' || action.addsEffect === 'waiting_ping_targeted') {
            Object.assign(effectDef, { icon: '📡', progress: 0, maxProgress: 120, isCountdown: true });
        } else if (action.addsEffect === 'on_route_gamma') {
            Object.assign(effectDef, { icon: '🚀', progress: 0, maxProgress: 240, isCountdown: true, debuffs: { 'area_fuel': -2.0 } });
        }
        addEffect(effectDef);
        addLogEntry(t('log_effect_added', { effect: t(effectDef.nameKey) }), LogType.ERROR);
    }
    
    // Clear persistent progress on completion
    if (action.category === 'persistent' && action.id && gameFlags.persistentProgress) {
        delete gameFlags.persistentProgress[action.id];
    }
    
    if (action.oneTime && !action.repeatable) {
        action._completed = true;
        _fullRebuildNeeded = true;
        if (selectedActionId === action.id) selectedActionId = null;
    }
    if (typeof action.repeatLimit === 'number' && action.repeatLimit > 0) {
        action._repeatCount = (action._repeatCount || 0) + 1;
        if (action._repeatCount >= action.repeatLimit) { action._completed = true; _fullRebuildNeeded = true; }
        const loc = getLocation(getCurrentLocationId());
        if (loc) {
            const us = getUnlockState(loc.id);
            us[action.id + '_repeatCount'] = action._repeatCount;
            setUnlockState(loc.id, us);
        }
    }
    if (action._completed) {
        const loc = getLocation(getCurrentLocationId());
        if (loc) {
            const us = getUnlockState(loc.id);
            if (!us[action.id]) {
                us[action.id] = true;
                setUnlockState(loc.id, us);
            }
        }
    }
    
    // --- On-complete callback ---
    const ctx = buildActionCtx(action);
    if (typeof action.onComplete === 'function') safeInvokeActionCallback(action.onComplete, ctx, action, 'onComplete');

    // === NOVÝ SYSTÉM: Loop-aware onComplete ===
    const loop = gameFlags.loopCount || 0;
    if (loop >= 3 && typeof action.onCompleteLoop3 === 'function') safeInvokeActionCallback(action.onCompleteLoop3, ctx, action, 'onCompleteLoop3');
    if (loop >= 2 && typeof action.onCompleteLoop2 === 'function') safeInvokeActionCallback(action.onCompleteLoop2, ctx, action, 'onCompleteLoop2');
    if (loop >= 1 && typeof action.onCompleteLoop1 === 'function') safeInvokeActionCallback(action.onCompleteLoop1, ctx, action, 'onCompleteLoop1');

    // === NOVÝ SYSTÉM: Deklarativní unlocks ===
    if (Array.isArray(action.unlocks)) {
        action.unlocks.forEach(id => { flagActionAsNew(id); });
    }
    if (loop >= 2 && Array.isArray(action.unlocksLoop2)) {
        action.unlocksLoop2.forEach(id => { flagActionAsNew(id); });
    }
    if (loop >= 3 && Array.isArray(action.unlocksLoop3)) {
        action.unlocksLoop3.forEach(id => { flagActionAsNew(id); });
    }

    // === NOVÝ SYSTÉM: Deklarativní hides (aktuální lokace) ===
    const currentLoc = getLocation(getCurrentLocationId());
    const hideAction = (id) => {
        if (currentLoc && Array.isArray(currentLoc.actions)) {
            const target = currentLoc.actions.find(a => a.id === id);
            if (target) target._completed = true;
        }
    };
    if (Array.isArray(action.hides)) action.hides.forEach(hideAction);
    if (loop >= 2 && Array.isArray(action.hidesLoop2)) action.hidesLoop2.forEach(hideAction);
    if (loop >= 3 && Array.isArray(action.hidesLoop3)) action.hidesLoop3.forEach(hideAction);
    
    // --- Area resource drains ---
    if (action.drainsAreaResource) {
        const locId = getCurrentLocationId();
        const dr = action.drainsAreaResource;
        drainAreaResource(locId, dr.resource, dr.amount || 1);
        if (typeof window !== 'undefined') {
            window._currentAreaResourceList = areaResources[locId] || [];
        }
    }
    
    // --- Reveal area supplies panel ---
    if (action.revealsAreaSupplies) {
        const locId = getCurrentLocationId();
        initAreaResources(locId);
        revealAreaResources(locId);
        if (typeof window !== 'undefined') {
            window._currentAreaResourceList = areaResources[locId] || [];
        }
        showAreaSuppliesPanel();
    }
    
    // --- Generic unlocksAll handler ---
    if (action.unlocksAll) {
        const location = getLocation(getCurrentLocationId());
        if (location) {
            const unlockState = getUnlockState(location.id);
            unlockState[action.id] = true;
            setUnlockState(location.id, unlockState);
            (location.actions || []).forEach(a => {
                if (a.id === action.id) return;
                if (a.unlockedBy === action.id) {
                    flagActionAsNew(a.id);
                } else if (Array.isArray(a.unlockedBy) && a.unlockedBy.includes(action.id)) {
                    flagActionAsNew(a.id);
                }
            });
            _fullRebuildNeeded = true;
        }
    }
    
    try { updateResourceInfo(); } catch { /* ignore */ }
    const targetLoc = action.targetLocation;
    clearActionTimer();
    activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false; selectedActionId = null; clearHoverState();
    _infoUpdateCounter = 0; _fullRebuildNeeded = true;
    if (targetLoc && switchToLocation(targetLoc)) {
        // Movement completion is now handled via resultKey — skip duplicated "Arrived at"
    }
    updateQueueActive(null);
    refreshUI();
    startNextQueuedAction();
    try { checkDeathAndLoop(); } catch { /* ignore */ }
}

// ==========================================================================
// Cancel action
// ==========================================================================

export function cancelActiveAction() {
    const action = activeAction;
    if (!action) return;
    if (action.category === 'persistent' && action.id) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[action.id] = actionProgress;
    }
    setActiveDrainRates(null, null);
    setActionAreaDrainRates(null);
    addLogEntry(t('log_action_cancelled', { action: action._displayName || t(action.nameKey) }), LogType.INFO);
    try { updateResourceInfo(); } catch { /* ignore */ }
    clearActionTimer();
    activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
    selectedActionId = null; _infoUpdateCounter = 0; _fullRebuildNeeded = true;
    updateQueueActive(null);
    refreshUI();
    startNextQueuedAction();
}

function clearActionTimer() { if (actionTimer) { clearInterval(actionTimer); actionTimer = null; } }

function getGameSpeed() {
    try { const s = Number(window.TIME_SCALE); return Number.isFinite(s) && s > 0 ? s : 1; } catch { return 1; }
}

function updateClockDisplay() {
    const clockEl = document.getElementById('headerClock');
    if (clockEl) clockEl.textContent = getIngameTimeString();
}

// ==========================================================================
// Start action
// ==========================================================================

export function startAction(actionId) {
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const action = location.actions.find(a => a.id === actionId);
    if (!action) return;
    if (activeActionId === actionId && !actionPaused) return;

    // --- Generic onStart callback (replaces all special-case gate blocks) ---
    const ctx = buildActionCtx(action);
    if (typeof action.onStart === 'function') {
        const result = safeInvokeActionCallback(action.onStart, ctx, action, 'onStart');
        if (result && result.block) return;
    }


    // Check requiresItem
    if (action.requiresItem) {
        const itemDef = getItemDefinition(action.requiresItem);
        if (!itemDef) {
            addLogEntry(`Error: unknown required item "${action.requiresItem}".`, LogType.ERROR);
            return;
        }
        const hasItem = countItemInBag(action.requiresItem) > 0;
        if (!hasItem) {
            const itemDisplayName = (itemDef.nameKey && t(itemDef.nameKey)) || itemDef.name;
            addLogEntry(t('log_need_item', { item: itemDisplayName }), LogType.ERROR);
            return;
        }
        action._pendingItem = action.requiresItem;
    }
    // Set drain rates from default action costs (per-minute rates)
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const drainRates = {}; const sources = {}; const displayName = t(action.nameKey);
    const isRest = action.category === 'rest';
    const isRefresh = action.category === 'refresh';
    if (isRest || isRefresh) {
        const resourceRewards = (action.rewards || []).filter(r => r.type === 'resource');
        if (resourceRewards.length > 0) {
            const allFull = resourceRewards.every(r => {
                const res = getResourceByName(r.name);
                return res && res.capacity > 0 && Number(res.amount) >= Number(res.capacity);
            });
            if (allFull) {
                if (isRest) addLogEntry(t('log_rest_full'), LogType.INFO);
                else if (isRefresh) addLogEntry(t('log_water_full'), LogType.INFO);
                return;
            }
        }
    }
    let rewardPerSecRate = 0;
    let rewardResourceName = null;
    if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
        for (const r of action.rewards) {
            if (r.type === 'resource') {
                rewardResourceName = r.name;
                rewardPerSecRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                break;
            }
        }
    }
    const baseRates2 = action.drainRates || DEFAULT_DRAIN;
    for (const [resName, baseRate] of Object.entries(baseRates2)) {
        if ((isRest || isRefresh) && rewardResourceName === resName) {
            const perMin = rewardPerSecRate;
            drainRates[resName] = perMin;
            if (!sources[resName]) sources[resName] = [];
            sources[resName].push({ rate: perMin, label: displayName });
            continue;
        }
        // Use drainRates if defined, otherwise DEFAULT_DRAIN
        const rateMultiplier = resName === 'Stamina' ? mult : 1;
        const perMin = baseRate * rateMultiplier;
        drainRates[resName] = -perMin;
        if (!sources[resName]) sources[resName] = [];
        sources[resName].push({ rate: perMin, label: displayName });
    }
    setActiveDrainRates(drainRates, sources);
    // Set area drain rate for area panel display
    if (action.drainsAreaResource) {
        const adr = action.drainsAreaResource;
        const areaPerSec = (adr.amount || 1) / Math.max(1, action.durationSeconds || 1);
        setActionAreaDrainRates({ [adr.resource]: `-${areaPerSec.toFixed(2)}/min` });
    }
    // Save old persistent progress before switching
    if (activeAction && activeAction.category === 'persistent' && activeAction.id && activeActionId !== actionId) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[activeAction.id] = actionProgress;
    }
    if (activeActionId !== actionId) {
        activeActionId = actionId; activeAction = action; activeAction._displayName = t(action.nameKey);
        // --- NOVÝ SYSTÉM: results objekt (loop-aware result key) ---
        if (action.results) {
            const loop = gameFlags.loopCount || 0;
            if (loop >= 3 && action.results.loop3) activeAction._resultKey = action.results.loop3;
            else if (loop >= 2 && action.results.loop2) activeAction._resultKey = action.results.loop2;
            else if (loop >= 1 && action.results.loop1) activeAction._resultKey = action.results.loop1;
            else if (action.results.default) activeAction._resultKey = action.results.default;
        }
        // --- Legacy: Dynamic resultKey via callback ---
        if (typeof action.getResultKey === 'function') {
            activeAction._resultKey = safeInvokeActionCallback(action.getResultKey, ctx, action, 'getResultKey');
        }

        // Restore persistent progress from previous loops
        if (action.category === 'persistent' && action.id && gameFlags.persistentProgress) {
            actionProgress = Number(gameFlags.persistentProgress[action.id]) || 0;
        } else {
            actionProgress = 0;
        }
    }
    actionPaused = false; _infoUpdateCounter = 0; _fullRebuildNeeded = true; refreshUI();
    const TICK_SECONDS = 0.1; clearActionTimer();
    const isInfinite = !action.durationSeconds || action.durationSeconds <= 0;
    actionTimer = setInterval(() => {
        if (!activeAction) { clearActionTimer(); return; }
        if (actionPaused) return;
        // Skip ticking while the tab/app is backgrounded — prevents a burst of
        // queued setInterval callbacks (and their cascading DOM/log updates)
        // from firing all at once when the tab regains focus, which is what
        // caused the mobile freeze after returning from background.
        if (_actionTimerSuspended) return;

        const tickSecs = TICK_SECONDS * getGameSpeed();
        actionProgress = parseFloat((actionProgress + tickSecs).toFixed(10));
        advanceIngameTimeBySeconds(tickSecs);
        applyTimePassiveDrain(tickSecs);
        advanceEffectProgress(tickSecs);
        // Akce mohla být zrušena během drainu — smrt hráče
        // dispatchnuje 'force-cancel-action', cancelActiveAction()
        // nastaví activeAction = null uprostřed tohoto ticku.
        if (!activeAction) { clearActionTimer(); return; }
        updateClockDisplay();
        updateActionButtonsDynamic();
        if (activeAction && !activeAction._completed) {
            updateQueueActive({
                id: activeAction.id,
                nameKey: activeAction.nameKey,
                progress: actionProgress,
                durationSeconds: activeAction.durationSeconds || 0,
            });
        }
        _infoUpdateCounter++;
        if (_infoUpdateCounter >= 5) { try { updateResourceInfo(); } catch { /* ignore */ } _infoUpdateCounter = 0; }

        // Cap detection for rest/refresh actions — only stop when ALL reward resources are capped
        if ((activeAction.category === 'rest' || activeAction.category === 'refresh') && Array.isArray(activeAction.rewards)) {
            const rewardResources = activeAction.rewards.filter(r => r.type === 'resource');
            if (rewardResources.length > 0) {
                let allCapped = true;
                for (const r of rewardResources) {
                    const res = resources.find(rr => rr && String(rr.name) === String(r.name));
                    if (res && res.capacity > 0 && Number(res.amount) < Number(res.capacity)) {
                        allCapped = false;
                        break;
                    }
                }
                if (allCapped) {
                    completeActiveAction({ reason: 'cap' });
                    return;
                }
            }
        }

        // Area resource drain
        if (activeAction.drainsAreaResource) {
            const dr = activeAction.drainsAreaResource;
            const areaPerSec = (dr.amount || 1) / Math.max(1, activeAction.durationSeconds || 1);
            const areaList = areaResources[getCurrentLocationId()];
            const areaRes = areaList && Array.isArray(areaList) ? areaList.find(r => r.name === dr.resource) : null;
            if (areaRes) {
                areaRes.amount -= areaPerSec * tickSecs;
                roundResourceAmount(areaRes);
                if (areaRes.amount <= 0) {
                    areaRes.amount = 0;
                    completeActiveAction({ reason: 'depleted' });
                    return;
                }
            }
        }

        // Save persistent progress
        if (activeAction && activeAction.category === 'persistent' && activeAction.id) {
            if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
            gameFlags.persistentProgress[activeAction.id] = actionProgress;
        }

        if (actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

export function pauseAction() {
    if (activeAction && activeAction.category === 'persistent' && activeAction.id) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[activeAction.id] = actionProgress;
        setActiveDrainRates(null, null);
        setActionAreaDrainRates(null);
        clearActionTimer();
        activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
        _fullRebuildNeeded = true; refreshUI();
        updateQueueActive(null);
        startNextQueuedAction();
        return;
    }
    actionPaused = true; _fullRebuildNeeded = true; refreshUI();
}
export function resumeAction() { if (!activeAction || activeAction._completed) return; startAction(activeAction.id); }

export function updateLocationActionButtonsState() { refreshUI(); }

document.addEventListener('click', (e) => {
    try {
        const actionsTile = document.getElementById('locationsActionsTile');
        if (actionsTile && !actionsTile.contains(e.target) && selectedActionId) {
            selectedActionId = null; _fullRebuildNeeded = true; refreshUI();
        }
    } catch { /* ignore */ }
});

// ==========================================================================
// POI collapse state persistence
// ==========================================================================
export function getPoiCollapseState(locationId) {
    try { return JSON.parse(localStorage.getItem(`poiCollapse_${locationId}`) || '{}'); }
    catch { return {}; }
}
export function setPoiCollapseState(locationId, poiId, collapsed) {
    try {
        const state = getPoiCollapseState(locationId);
        state[poiId] = collapsed;
        localStorage.setItem(`poiCollapse_${locationId}`, JSON.stringify(state));
    } catch { /* ignore */ }
}

// ==========================================================================
// Action unlock state persistence
// ==========================================================================

/**
 * Collect all _completed flags from all registered locations.
 * Returns { [locId]: [actionId, ...] }
 */
export function getActionCompletionState() {
    const state = {};
    try {
        // Iterate all registered locations (single source of truth: locationData.js registry)
        // instead of a hardcoded list — new locations are automatically covered.
        const allLocations = getAllLocations();
        for (const locId of Object.keys(allLocations)) {
            const loc = allLocations[locId];
            if (!loc || !Array.isArray(loc.actions)) continue;
            const completed = loc.actions.filter(a => a._completed).map(a => a.id);
            if (completed.length > 0) state[locId] = completed;
        }
    } catch { /* ignore */ }
    return state;
}


/**
 * Restore _completed flags from saved state.
 * @param {object} savedState - { [locId]: [actionId, ...] }
 */
export function restoreActionCompletionState(savedState) {
    if (!savedState || typeof savedState !== 'object') return;
    try {
        for (const [locId, actionIds] of Object.entries(savedState)) {
            if (!Array.isArray(actionIds)) continue;
            const loc = getLocation(locId);
            if (!loc || !Array.isArray(loc.actions)) continue;
            for (const actionId of actionIds) {
                const action = loc.actions.find(a => a.id === actionId);
                if (action) action._completed = true;
            }
        }
    } catch { /* ignore */ }
}

export function getUnlockState(locationId) {
    try { return JSON.parse(localStorage.getItem(`unlocks_${locationId}`) || '{}'); }
    catch { return {}; }
}
export function setUnlockState(locationId, state) {
    try { localStorage.setItem(`unlocks_${locationId}`, JSON.stringify(state)); }
    catch { /* ignore */ }
}

// ==========================================================================
// Save/Load helpers
// ==========================================================================
export function getActiveActionState() {
    if (!activeAction || activeAction._completed) return null;
    return {
        actionId: activeActionId,
        locationId: getCurrentLocationId(),
        progress: actionProgress,
        paused: actionPaused,
    };
}

export function resumeSavedAction(state) {
    if (!state || !state.actionId) return;
    const location = getLocation(state.locationId);
    if (!location) return;
    const action = location.actions.find(a => a.id === state.actionId);
    if (!action || action._completed) return;
    if (state.locationId && state.locationId !== getCurrentLocationId()) {
        switchToLocation(state.locationId);
    }
    activeActionId = state.actionId;
    activeAction = action;
    activeAction._displayName = t(action.nameKey);
    actionProgress = state.progress || 0;
    actionPaused = state.paused !== false;
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const drainRates = {}; const sources = {}; const displayName = t(action.nameKey);
    const isRest = action.category === 'rest';
    const isRefresh = action.category === 'refresh';
    let rewardPerSecRate = 0;
    let rewardResourceName = null;
    if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
        for (const r of action.rewards) {
            if (r.type === 'resource') {
                rewardResourceName = r.name;
                rewardPerSecRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                break;
            }
        }
    }
    const baseRates3 = action.drainRates || DEFAULT_DRAIN;
    for (const [resName, baseRate] of Object.entries(baseRates3)) {
        if (isRest && resName === 'Stamina') {
            const perMin = rewardPerSecRate;
            drainRates[resName] = perMin;
            if (!sources[resName]) sources[resName] = [];
            sources[resName].push({ rate: perMin, label: displayName });
            continue;
        }
        if (isRefresh && resName === 'Drinking Water') {
            const perMin = rewardPerSecRate;
            drainRates[resName] = perMin;
            if (!sources[resName]) sources[resName] = [];
            sources[resName].push({ rate: perMin, label: displayName });
            continue;
        }
        const rateMultiplier = resName === 'Stamina' ? mult : 1;
        const perMin = baseRate * rateMultiplier;
        drainRates[resName] = -perMin;
        if (!sources[resName]) sources[resName] = [];
        sources[resName].push({ rate: perMin, label: displayName });
    }
    setActiveDrainRates(drainRates, sources);
    selectedActionId = state.actionId;
    _fullRebuildNeeded = true;
    refreshUI();
}

// Listen for death-loop cancellation
try {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('force-cancel-action', () => {
            if (activeAction) {
                setActiveDrainRates(null, null);
                setActionAreaDrainRates(null);
                clearActionTimer();
                activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
                updateQueueActive(null);
                _fullRebuildNeeded = true;
                try { refreshUI(); } catch { /* ignore */ }
            }
        });
        window.addEventListener('death-loop-reset', () => {
            _fullRebuildNeeded = true;
            try { refreshUI(); } catch { /* ignore */ }
        });
    }
} catch { /* ignore */ }

if (typeof window !== 'undefined') {
    window.__getActiveActionState = getActiveActionState;
    window.__resumeSavedAction = resumeSavedAction;
}

export function startQueuedAction(queueItem) {
    if (!queueItem) return;
    if (queueItem.locationId && queueItem.locationId !== getCurrentLocationId()) {
        switchToLocation(queueItem.locationId);
    }
    startAction(queueItem.actionId);
}

export function setupLocationSection(section) {
    section.innerHTML = `<div class="content-panel location-panel"><div class="location-layout"><div id="locationsLocationTile" class="location-tile location-tile-location"></div><div id="locationsDetailsTile" class="location-tile location-tile-details"></div><div id="locationsActionsTile" class="location-tile location-tile-actions"></div></div></div>`;
    _fullRebuildNeeded = true; refreshUI();
}

export function setSelectedActionId(v) { selectedActionId = v; }
export function setFullRebuildNeeded(v) { _fullRebuildNeeded = v; }

export { DEFAULT_DRAIN, TAXING_MULT };