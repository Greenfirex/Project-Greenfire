// ==========================================================================
// Location Engine
// ==========================================================================

import { resources, updateResourceInfo, setActiveDrainRates, setActiveAreaDrainRates, applyTimePassiveDrain, roundResourceAmount, checkDeathAndLoop, initAreaResources, drainAreaResource, showAreaSuppliesPanel, areaResources, revealAreaResources } from '../../engine/resources.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';
import { getCurrentLocationId, switchToLocation, getLocation } from './locationData.js';
import { advanceIngameTimeBySeconds, getIngameTimeString } from '../../engine/time.js';
import { gameFlags, flagActionAsNew } from '../../engine/gameFlags.js';
import { hasEffect, removeEffect, addEffect } from '../../engine/effects.js';
import { startNextQueuedAction, updateQueueActive } from '../../engine/queue.js';
import { grantItemToCharacter, consumeItemQuantityFromBag, countItemInBag } from '../character/character.js';
import { getItemDefinition } from '../character/items.js';
import { refreshUI, updateActionButtonsDynamic } from './locationUi.js';

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

export function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

export function canAffordAction(action) {
    if (!action) return true;
    const durationMins = (action.durationSeconds || 1) / 60;
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    for (const [resName, baseRate] of Object.entries(DEFAULT_DRAIN)) {
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
                    addLogEntry(`Received: ${r.name || itemId}`, LogType.UNLOCK);
                }
            }
        }
    });
}

/**
 * Complete the active action.
 * @param {Object} [opts] - Completion options.
 * @param {'auto'|'cap'|'manual'} [opts.reason='auto'] - Why the action ended.
 */
function completeActiveAction(opts = {}) {
    const reason = opts.reason || 'auto';
    const action = activeAction;
    if (!action) return;
    setActiveDrainRates(null, null);
    setActiveAreaDrainRates(null);
    // Consume required item now that the action completed successfully.
    // Item consumption was deferred from startAction() so that stopping/cancelling
    // the action does not permanently destroy the quest item.
    if (action._pendingItem) {
        try {
            const itemDef = getItemDefinition(action._pendingItem);
            const consumed = consumeItemQuantityFromBag(action._pendingItem, 1);
            if (consumed) {
                addLogEntry(`Used: ${itemDef?.name || action._pendingItem}.`, LogType.INFO);
            }
            delete action._pendingItem;
        } catch { /* ignore */ }
    }

    // Rest/refresh actions gain resources continuously via drain rate;
    // skip lump-sum reward to avoid double-dipping.
    if (action.category !== 'rest' && action.category !== 'refresh') {
        applyActionRewards(action);
    }

    // Log appropriate completion message
    if (reason === 'cap') {
        if (action.category === 'rest') addLogEntry(t('log_rest_cap'), LogType.SUCCESS);
        else if (action.category === 'refresh') addLogEntry(t('log_water_cap'), LogType.SUCCESS);
        else addLogEntry(`${action._displayName || action.id} completed.`, LogType.SUCCESS);
    } else if (reason === 'manual') {
        addLogEntry(t('log_action_stopped', { action: action._displayName || t(action.nameKey) }), LogType.INFO);
    } else if (action._resultKey || action.resultKey) {
        addLogEntry(t(action._resultKey || action.resultKey), LogType.SUCCESS);
    } else {
        addLogEntry(`${action._displayName || action.id} completed.`, LogType.INFO);
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
        // Apply known effect presets
        if (action.addsEffect === 'alarm') {
            Object.assign(effectDef, { icon: '🔔', progress: 0, maxProgress: Infinity, debuffs: { 'Stamina': -0.2 } });
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
        // Deselect so the details panel falls back to location description
        if (selectedActionId === action.id) selectedActionId = null;
    }
    if (typeof action.repeatLimit === 'number' && action.repeatLimit > 0) {
        action._repeatCount = (action._repeatCount || 0) + 1;
        if (action._repeatCount >= action.repeatLimit) { action._completed = true; _fullRebuildNeeded = true; }
        // Persist repeat count so it survives reload
        const loc = getLocation(getCurrentLocationId());
        if (loc) {
            const us = getUnlockState(loc.id);
            us[action.id + '_repeatCount'] = action._repeatCount;
            setUnlockState(loc.id, us);
        }
    }
    // Universal persistence: mirror any _completed=true to unlockState so it survives reload.
    // This covers one-time, repeat-limited, and any future completion types without
    // requiring developers to remember unlocksAll flags or special-case handlers.
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
    
    // Handle action unlocks
    // --- Special case: check_terminal branches based on loopKnowledge.terminalLogin ---
    if (action.id === 'check_terminal') {
        const loc = getLocation(getCurrentLocationId());
        if (loc) {
            const unlockState = getUnlockState(loc.id);
            unlockState['check_terminal'] = true;
            if (gameFlags.loopKnowledge && gameFlags.loopKnowledge.terminalLogin) {
                // Player remembers login → directly unlock access_logs + disable_alarm
                unlockState['check_terminal_known'] = true;
                // Mark the two actions as unlocked (they use ['hack_terminal','use_terminal_login'] as unlockedBy)
                // but since we're bypassing, set both as unlockers
                unlockState['hack_terminal'] = true;
                unlockState['use_terminal_login'] = true;
            } else {
                // First time → unlock hack_terminal + use_terminal_login
                // (these are the two new actions the player must complete)
            }
            setUnlockState(loc.id, unlockState);
            // Flag newly unlocked actions as "new" — handle string and array unlockedBy
            (loc.actions || []).forEach(a => {
                if (a.id === action.id) return;
                if (!a.unlockedBy) return;
                let shouldFlag = false;
                if (gameFlags.loopKnowledge && gameFlags.loopKnowledge.terminalLogin) {
                    // If known, flag access_logs + disable_alarm (their unlockedBy is ['hack_terminal','use_terminal_login'])
                    if (a.id === 'access_logs' || a.id === 'disable_alarm') shouldFlag = true;
                } else {
                    // If not known, flag hack_terminal + use_terminal_login (unlockedBy: 'check_terminal')
                    if (a.unlockedBy === 'check_terminal') shouldFlag = true;
                }
                if (shouldFlag) flagActionAsNew(a.id);
            });
            _fullRebuildNeeded = true;
        }
    }
    
    // --- Special case: wake_up in loop 2+ reveals fuel/O2 and sets loop knowledge ---
    if (action.id === 'wake_up') {
        const loop = gameFlags.loopCount || 0;
        if (loop >= 2) {
            if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = {};
            // Read current fuel level dynamically
            const bridgeList = areaResources['scout_ship_bridge'];
            const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
            const currentFuel = fuel ? Math.round(fuel.amount) : 0;
            const FUEL_DRAIN_PER_MIN = 1.8;
            const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);

            // Set fuelScanned so check_reactor_status knows fuel was already revealed
            if (!gameFlags.loopKnowledge.fuelScanned || gameFlags.loopKnowledge.fuelScanned < 1) {
                gameFlags.loopKnowledge.fuelScanned = 1;
            }

            // Override the result log with dynamic fuel/minute values
            const resultKey = loop >= 3 ? 'result_wake_up_loop3' : 'result_wake_up_loop2';
            addLogEntry(t(resultKey, { fuel: currentFuel, minutes: projectedMins }), LogType.SUCCESS);

            // Reveal bridge area resources (fuel + O2) — done directly here
            // instead of via action.revealsAreaSupplies because that targets
            // the current location (Crew Quarters), not the Bridge.
            initAreaResources('scout_ship_bridge');
            revealAreaResources('scout_ship_bridge');
            if (typeof window !== 'undefined') {
                window._currentAreaResourceList = areaResources['scout_ship_bridge'] || [];
            }
            showAreaSuppliesPanel();

            // Loop 3+: persist check_reactor_status as completed in bridge unlockState
            if (loop >= 3) {
                const bridgeLoc = getLocation('scout_ship_bridge');
                if (bridgeLoc) {
                    const bridgeUs = getUnlockState('scout_ship_bridge');
                    bridgeUs['check_reactor_status'] = true;
                    setUnlockState('scout_ship_bridge', bridgeUs);
                    // Also mark the action itself as _completed in the location data
                    const crsAction = (bridgeLoc.actions || []).find(a => a.id === 'check_reactor_status');
                    if (crsAction) {
                        crsAction._completed = true;
                    }
                }
            }

            // Persist to gameState
            try {
                const state = JSON.parse(localStorage.getItem('gameState') || '{}');
                if (!state.gameFlags) state.gameFlags = {};
                if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
                state.gameFlags.loopKnowledge.fuelScanned = gameFlags.loopKnowledge.fuelScanned;
                localStorage.setItem('gameState', JSON.stringify(state));
            } catch { /* ignore */ }

            // Force rebuild so bridge actions reflect check_reactor_status completion
            _fullRebuildNeeded = true;
        }
    }

    // --- Special case: check_reactor_status reveals fuel countdown, varies by loopKnowledge.fuelScanned ---
    if (action.id === 'check_reactor_status') {
        if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = {};
        const scannedBefore = gameFlags.loopKnowledge.fuelScanned || 0;
        gameFlags.loopKnowledge.fuelScanned = scannedBefore + 1;

        // Read current fuel level dynamically so the log shows accurate values
        const bridgeList = areaResources['scout_ship_bridge'];
        const fuel = bridgeList && Array.isArray(bridgeList) ? bridgeList.find(r => r.name === 'area_fuel') : null;
        const currentFuel = fuel ? Math.round(fuel.amount) : 0;
        const FUEL_DRAIN_PER_MIN = 1.8;
        const projectedMins = Math.round(currentFuel / FUEL_DRAIN_PER_MIN);

        // On first scan, store the projected fuel depletion time for same-time detection in next loop
        if (scannedBefore === 0 && currentFuel > 0) {
            gameFlags.loopKnowledge.fuelDepletionMinute = (gameFlags.loopCount || 0) * 10000 + projectedMins;
        }

        // Choose result key based on how many times fuel has been scanned
        let resultKey;
        if (scannedBefore === 0) {
            resultKey = 'result_check_reactor_status';
        } else if (scannedBefore === 1) {
            resultKey = 'result_check_reactor_status_loop2';
        } else {
            resultKey = 'result_check_reactor_status_known';
        }
        addLogEntry(t(resultKey, { fuel: currentFuel, minutes: projectedMins }), LogType.SUCCESS);

        // Persist to gameState
        try {
            const state = JSON.parse(localStorage.getItem('gameState') || '{}');
            if (!state.gameFlags) state.gameFlags = {};
            if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
            state.gameFlags.loopKnowledge.fuelScanned = gameFlags.loopKnowledge.fuelScanned;
            if (typeof gameFlags.loopKnowledge.fuelDepletionMinute === 'number') {
                state.gameFlags.loopKnowledge.fuelDepletionMinute = gameFlags.loopKnowledge.fuelDepletionMinute;
            }
            localStorage.setItem('gameState', JSON.stringify(state));
        } catch { /* ignore */ }
    }

    // --- Special case: hack_terminal / use_terminal_login grant terminalLogin knowledge + unlock access_logs/disable_alarm ---
    if (action.id === 'hack_terminal' || action.id === 'use_terminal_login') {
        // Grant persistent loop knowledge
        if (!gameFlags.loopKnowledge) gameFlags.loopKnowledge = {};
        gameFlags.loopKnowledge.terminalLogin = true;
        // Persist to gameState
        try {
            const state = JSON.parse(localStorage.getItem('gameState') || '{}');
            if (!state.gameFlags) state.gameFlags = {};
            if (!state.gameFlags.loopKnowledge) state.gameFlags.loopKnowledge = {};
            state.gameFlags.loopKnowledge.terminalLogin = true;
            localStorage.setItem('gameState', JSON.stringify(state));
        } catch { /* ignore */ }
        // Unlock access_logs + disable_alarm
        const loc = getLocation(getCurrentLocationId());
        if (loc) {
            const unlockState = getUnlockState(loc.id);
            unlockState[action.id] = true;
            setUnlockState(loc.id, unlockState);
            (loc.actions || []).forEach(a => {
                if (a.id !== action.id && a.unlockedBy && Array.isArray(a.unlockedBy) && a.unlockedBy.includes(action.id)) {
                    flagActionAsNew(a.id);
                }
            });
            // Mutual exclusion: mark the opposing login action as completed
            const opposingId = action.id === 'hack_terminal' ? 'use_terminal_login' : 'hack_terminal';
            const opposing = (loc.actions || []).find(a => a.id === opposingId);
            if (opposing) {
                opposing._completed = true;
                // Persist to unlockState so opposition survives reload
                unlockState[opposingId] = true;
                setUnlockState(loc.id, unlockState);
            }
            _fullRebuildNeeded = true;
        }
        // Also hide search_for_login_note in workshop — player already knows the login
        try {
            const wsLoc = getLocation('scout_ship_workshop');
            if (wsLoc && Array.isArray(wsLoc.actions)) {
                const noteAction = wsLoc.actions.find(a => a.id === 'search_for_login_note');
                if (noteAction) {
                    noteAction._completed = true;
                    // Persist to workshop's unlockState so cross-location completion survives reload
                    const wsUs = getUnlockState('scout_ship_workshop');
                    wsUs['search_for_login_note'] = true;
                    setUnlockState('scout_ship_workshop', wsUs);
                }
            }
        } catch { /* ignore */ }
    }
    
    // --- Area resource drains ---
    if (action.drainsAreaResource) {
        const locId = getCurrentLocationId();
        const dr = action.drainsAreaResource;
        drainAreaResource(locId, dr.resource, dr.amount || 1);
        // Set window global so resources.js can find the current list
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
    
    // --- Generic unlocksAll handler (also covers array unlockedBy now) ---
    if (action.unlocksAll) {
        const location = getLocation(getCurrentLocationId());
        if (location) {
            const unlockState = getUnlockState(location.id);
            unlockState[action.id] = true;
            setUnlockState(location.id, unlockState);
            // Flag all newly unlocked actions as "new" so badges appear
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
    activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
    // Keep selectedActionId so the details panel persists after completion
    _infoUpdateCounter = 0; _fullRebuildNeeded = true;
    if (targetLoc && switchToLocation(targetLoc)) addLogEntry(`Arrived at ${t(getLocation(targetLoc)?.nameKey || targetLoc)}.`, LogType.INFO);
    updateQueueActive(null);
    refreshUI();
    startNextQueuedAction();
    try { checkDeathAndLoop(); } catch { /* ignore */ }
}

/**
 * Cancel the active action — revert without rewards, completion flags, or repeat count.
 */
export function cancelActiveAction() {
    const action = activeAction;
    if (!action) return;
    // Save persistent progress before stopping so player can resume later
    if (action.category === 'persistent' && action.id) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[action.id] = actionProgress;
    }
    setActiveDrainRates(null, null);
    setActiveAreaDrainRates(null);
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

export function startAction(actionId) {
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const action = location.actions.find(a => a.id === actionId);
    if (!action) return;
    // No affordability gate — player can always attempt actions even when hungry/thirsty/exhausted
    if (activeActionId === actionId && !actionPaused) return;
    // Check requiresItem — validate the item exists but do NOT consume yet.
    // Consumption is deferred to completeActiveAction() so that stopping/cancelling
    // the action does not permanently destroy the quest item.
    if (action.requiresItem) {
        const itemDef = getItemDefinition(action.requiresItem);
        if (!itemDef) {
            addLogEntry(`Error: unknown required item "${action.requiresItem}".`, LogType.ERROR);
            return;
        }
        const hasItem = countItemInBag(action.requiresItem) > 0;
        if (!hasItem) {
            addLogEntry(`You need ${itemDef.name} to do this.`, LogType.INFO);
            return;
        }
        // Stash the item requirement for completion
        action._pendingItem = action.requiresItem;
    }
    // Set drain rates from default action costs (per-minute rates)
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const drainRates = {}; const sources = {}; const displayName = t(action.nameKey);
    const isRest = action.category === 'rest';
    const isRefresh = action.category === 'refresh';
    // Block starting rest/refresh only if ALL gained resources are at capacity.
    // If at least one gained resource still has room, allow the action to proceed.
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
    // Compute per-second reward rate for rest/refresh actions
    // rate = rewardAmount / durationSeconds (1 real sec = 1 in-game min)
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
    for (const [resName, baseRate] of Object.entries(DEFAULT_DRAIN)) {
        // Rest/Refresh: reward resource gains instead of drains; other resources still drain
        if ((isRest || isRefresh) && rewardResourceName === resName) {
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
    // Set area drain rate for area panel display (same pattern as personal drain rates)
    if (action.drainsAreaResource) {
        const adr = action.drainsAreaResource;
        const areaPerSec = (adr.amount || 1) / Math.max(1, action.durationSeconds || 1);
        setActiveAreaDrainRates({ [adr.resource]: `-${areaPerSec.toFixed(2)}/min` });
    }
    // Save old persistent progress before switching to a different action
    if (activeAction && activeAction.category === 'persistent' && activeAction.id && activeActionId !== actionId) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[activeAction.id] = actionProgress;
    }
    if (activeActionId !== actionId) {
        activeActionId = actionId; activeAction = action; activeAction._displayName = t(action.nameKey);
        // Dynamic resultKey for wake_up based on loop count
        if (action.id === 'wake_up') {
            if ((gameFlags.loopCount || 0) >= 3) {
                activeAction._resultKey = null; // handled in completeActiveAction with fuel/minutes
            } else if ((gameFlags.loopCount || 0) >= 2) {
                activeAction._resultKey = null; // handled in completeActiveAction with fuel/minutes
            } else if ((gameFlags.loopCount || 0) >= 1) {
                activeAction._resultKey = 'result_wake_up_loop1';
            }
        }
        // Dynamic resultKey for check_terminal based on loop knowledge + count
        if (action.id === 'check_terminal') {
            if (gameFlags.loopKnowledge && gameFlags.loopKnowledge.terminalLogin) {
                if ((gameFlags.loopCount || 0) >= 2) {
                    activeAction._resultKey = 'result_check_terminal_loop2';
                } else if ((gameFlags.loopCount || 0) >= 1) {
                    activeAction._resultKey = 'result_check_terminal_loop1';
                } else {
                    activeAction._resultKey = 'result_check_terminal_known';
                }
            } else {
                activeAction._resultKey = 'result_check_terminal';
            }
        }
        // Dynamic resultKey for check_reactor_status — always set to null
        // because the completion handler in completeActiveAction computes
        // fuel/minute values dynamically and chooses the right resultKey.
        if (action.id === 'check_reactor_status') {
            activeAction._resultKey = null;
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
        const tickSecs = TICK_SECONDS * getGameSpeed();
        actionProgress = parseFloat((actionProgress + tickSecs).toFixed(10));
        advanceIngameTimeBySeconds(tickSecs);
        applyTimePassiveDrain(tickSecs);
        updateClockDisplay();
        updateActionButtonsDynamic();
        // Update queue panel with live active action progress
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

        // Cap detection for rest/refresh actions (auto-stop when resource hits capacity)
        if ((activeAction.category === 'rest' || activeAction.category === 'refresh') && Array.isArray(activeAction.rewards)) {
            for (const r of activeAction.rewards) {
                if (r.type === 'resource') {
                    const res = resources.find(rr => rr && String(rr.name) === String(r.name));
                    if (res && res.capacity > 0 && Number(res.amount) >= Number(res.capacity)) {
                        completeActiveAction({ reason: 'cap' });
                        return;
                    }
                }
            }
        }

        // Area resource drain (same pattern as personal resource drain above)
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

        // Save persistent progress every tick to survive death loops
        if (activeAction && activeAction.category === 'persistent' && activeAction.id) {
            if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
            gameFlags.persistentProgress[activeAction.id] = actionProgress;
        }

        // Duration-based completion
        if (actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

export function pauseAction() {
    // Persistent actions: save progress + release slot so queue can proceed
    if (activeAction && activeAction.category === 'persistent' && activeAction.id) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[activeAction.id] = actionProgress;
        setActiveDrainRates(null, null);
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
    try {
        const saved = localStorage.getItem(`poiCollapse_${locationId}`);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}
export function setPoiCollapseState(locationId, poiId, collapsed) {
    try {
        const state = getPoiCollapseState(locationId);
        state[poiId] = collapsed;
        localStorage.setItem(`poiCollapse_${locationId}`, JSON.stringify(state));
    } catch {
        // ignore
    }
}

// ==========================================================================
// Action unlock state persistence
// ==========================================================================
export function getUnlockState(locationId) {
    try {
        const saved = localStorage.getItem(`unlocks_${locationId}`);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}
export function setUnlockState(locationId, state) {
    try {
        localStorage.setItem(`unlocks_${locationId}`, JSON.stringify(state));
    } catch {
        // ignore
    }
}

// ==========================================================================
// Save/Load helpers — export action progress for persistence
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

    // Switch to the correct location if needed
    if (state.locationId && state.locationId !== getCurrentLocationId()) {
        switchToLocation(state.locationId);
    }

    // Restore action state
    activeActionId = state.actionId;
    activeAction = action;
    activeAction._displayName = t(action.nameKey);
    actionProgress = state.progress || 0;
    actionPaused = state.paused !== false; // default to paused for safety

    // Set up drain rates from default action costs (per-second rates)
    // 1 real sec = 1 in-game min
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const drainRates = {}; const sources = {}; const displayName = t(action.nameKey);
    const isRest = action.category === 'rest';
    const isRefresh = action.category === 'refresh';
    // Compute per-second reward rate for rest/refresh actions
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
    for (const [resName, baseRate] of Object.entries(DEFAULT_DRAIN)) {
        // Rest: Stamina gains instead of drains; Food/Water still drain
        if (isRest && resName === 'Stamina') {
            const perMin = rewardPerSecRate;
            drainRates[resName] = perMin;
            if (!sources[resName]) sources[resName] = [];
            sources[resName].push({ rate: perMin, label: displayName });
            continue;
        }
        // Refresh: Water gains instead of drains; Stamina/Food still drain
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

    // Don't auto-start — player must click Play to resume
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
                setActiveAreaDrainRates(null);
                clearActionTimer();
                activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
                updateQueueActive(null);
                _fullRebuildNeeded = true;
                try { refreshUI(); } catch { /* ignore */ }
            }
        });
        // Refresh UI after death loop popup closes
        window.addEventListener('death-loop-reset', () => {
            _fullRebuildNeeded = true;
            try { refreshUI(); } catch { /* ignore */ }
        });
    }
} catch { /* ignore */ }

// Expose for save/load system (avoids circular imports)
if (typeof window !== 'undefined') {
    window.__getActiveActionState = getActiveActionState;
    window.__resumeSavedAction = resumeSavedAction;
}

/**
 * Called by queue engine to start a queued action.
 * Handles location switching if needed.
 */
export function startQueuedAction(queueItem) {
    if (!queueItem) return;
    // Switch location if queued action is in a different location
    if (queueItem.locationId && queueItem.locationId !== getCurrentLocationId()) {
        switchToLocation(queueItem.locationId);
    }
    startAction(queueItem.actionId);
}

export function setupLocationSection(section) {
    section.innerHTML = `<div class="content-panel location-panel"><div class="location-layout"><div id="locationsLocationTile" class="location-tile location-tile-location"></div><div id="locationsDetailsTile" class="location-tile location-tile-details"></div><div id="locationsActionsTile" class="location-tile location-tile-actions"></div></div></div>`;
    _fullRebuildNeeded = true; refreshUI();
}

// Setters for locationUi.js (ES module imports are read-only)
export function setSelectedActionId(v) { selectedActionId = v; }
export function setFullRebuildNeeded(v) { _fullRebuildNeeded = v; }

export { DEFAULT_DRAIN, TAXING_MULT };