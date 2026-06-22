// ==========================================================================
// Location Engine
// ==========================================================================

import { resources, updateResourceInfo, setActiveDrainRates, applyTimePassiveDrain, roundResourceAmount, RESOURCE_EMOJIS, checkDeathAndLoop, initAreaResources, drainAreaResource, getAreaResourceAmount, showAreaSuppliesPanel, areaResources, revealAreaResources } from '../../engine/resources.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';
import { getCurrentLocationId, switchToLocation, getLocation } from './locationData.js';
import { advanceIngameTimeBySeconds, getIngameTimeString } from '../../engine/time.js';
import { playActionStart } from '../../engine/audio.js';
import { gameFlags, isActionNew, flagActionAsNew, markActionSeen } from '../../engine/gameFlags.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../../ui/components/contentNewBadges.js';
import { getEffectDebuffs, getEffectDrains, getEffectDebuffDetails, hasEffect, removeEffect, addEffect } from '../../engine/effects.js';
import { addToQueue, startNextQueuedAction, updateQueueActive, isInQueue } from '../../engine/queue.js';
import { setupTooltip } from '../../ui/panels/tooltip.js';
import { grantItemToCharacter, consumeItemQuantityFromBag, countItemInBag } from '../character/character.js';
import { getItemDefinition } from '../character/items.js';

const DEFAULT_DRAIN = { 'Stamina': 0.20, 'Food Rations': 0.08, 'Drinking Water': 0.12 };
const TAXING_MULT = 2.0;

let activeAction = null;
let activeActionId = null;
let actionTimer = null;
let actionProgress = 0;
let selectedActionId = null;
let actionPaused = false;
let _infoUpdateCounter = 0;
let _fullRebuildNeeded = true;

function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

function canAffordAction(action) {
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
function cancelActiveAction() {
    const action = activeAction;
    if (!action) return;
    // Save persistent progress before stopping so player can resume later
    if (action.category === 'persistent' && action.id) {
        if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
        gameFlags.persistentProgress[action.id] = actionProgress;
    }
    setActiveDrainRates(null, null);
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

function startAction(actionId) {
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

        // Cap detection for rest/refresh infinite actions
        if (isInfinite && (activeAction.category === 'rest' || activeAction.category === 'refresh')) {
            for (const r of (activeAction.rewards || [])) {
                if (r.type === 'resource') {
                    const res = getResourceByName(r.name);
                    if (res && res.capacity > 0 && Number(res.amount) >= Number(res.capacity)) {
                        completeActiveAction({ reason: 'cap' });
                        return;
                    }
                }
            }
        }

        // Save persistent progress every tick to survive death loops
        if (activeAction && activeAction.category === 'persistent' && activeAction.id) {
            if (!gameFlags.persistentProgress) gameFlags.persistentProgress = {};
            gameFlags.persistentProgress[activeAction.id] = actionProgress;
        }

        // Normal duration-based completion (only for finite actions)
        if (!isInfinite && actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

function pauseAction() {
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
function resumeAction() { if (!activeAction || activeAction._completed) return; startAction(activeAction.id); }

export function updateLocationActionButtonsState() { refreshUI(); }

document.addEventListener('click', (e) => {
    try {
        const actionsTile = document.getElementById('locationsActionsTile');
        if (actionsTile && !actionsTile.contains(e.target) && selectedActionId) {
            selectedActionId = null; _fullRebuildNeeded = true; refreshUI();
        }
    } catch { /* ignore */ }
});

function renderLocationTile(location) {
    const imgHtml = location.image ? `<div class="location-location-image" style="max-height:none;flex:1 1 auto;display:flex;align-items:center;justify-content:center;overflow:hidden;"><img src="${location.image}" alt="${t(location.nameKey)}" style="width:100%;height:100%;object-fit:contain;" /></div>` : '';
    return `<div class="location-card location-card-location"><div class="location-card-header"><h3>${t(location.nameKey)}</h3></div>${imgHtml}</div>`;
}

function renderDetailsTile() {
    const location = getLocation(getCurrentLocationId());
    if (selectedActionId) {
        const action = (location && location.actions) ? location.actions.find(a => a.id === selectedActionId) : null;
        if (action) {
            // Tags row (below action name, shows repeatable/oneTime + category)
            const tagItems = [];
            if (action.targetLocation) {
                tagItems.push('<span class="detail-tag tag-travel">&#x2192; ' + t('tag_travel') + '</span>');
            } else if (action.repeatable) {
                if (typeof action.repeatLimit === 'number' && action.repeatLimit > 0) {
                    const remain = Math.max(0, action.repeatLimit - (action._repeatCount || 0));
                    tagItems.push(`<span class="detail-tag tag-repeatable">&#x21BB; ${remain}&#x00D7; ${t('tag_remaining')}</span>`);
                } else {
                    tagItems.push('<span class="detail-tag tag-repeatable">&#x21BB; ' + t('tag_repeatable') + '</span>');
                }
            } else if (action.oneTime) {
                tagItems.push('<span class="detail-tag tag-onetime">&#x26A1; ' + t('tag_onetime') + '</span>');
            }
            // Category as a tag
            let catLabel = '';
            let catClass = '';
            if (action.category === 'taxing') { catLabel = t('cat_taxing'); catClass = 'detail-category-taxing'; }
            else if (action.category === 'simple') { catLabel = t('cat_simple'); catClass = 'detail-category-simple'; }
            else if (action.category === 'persistent') { catLabel = t('cat_persistent'); catClass = 'detail-category-persistent'; }
            else if (action.category === 'rest') { catLabel = t('cat_rest'); catClass = 'detail-category-rest'; }
            else if (action.category === 'refresh') { catLabel = t('cat_refresh'); catClass = 'detail-category-refresh'; }
            if (catLabel) tagItems.push(`<span class="detail-category detail-tag ${catClass}">${catLabel}</span>`);
            const tagsHtml = tagItems.length > 0 ? `<div class="detail-tags">${tagItems.join('')}</div>` : '';

            // Duration
            const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
            const isActionRunning = activeActionId === selectedActionId && !action._completed;
            // Get saved persistent progress (survives death loops and stop/cancel)
            const savedProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
                ? (Number(gameFlags.persistentProgress[action.id]) || 0)
                : 0;
            const effectiveTotalSecs = Math.max(1, action.durationSeconds || 0);
            const effectiveProgress = isActionRunning ? actionProgress : savedProgress;
            const effectiveRemainingSecs = Math.max(0, effectiveTotalSecs - effectiveProgress);
            const effectiveProgressPct = effectiveTotalSecs > 0 ? Math.min(100, Math.round((effectiveProgress / effectiveTotalSecs) * 100)) : 0;

            let durationHtml = '';
            if (isInfiniteAction) {
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value">${t('action_duration_ongoing')}</div></div>`;
            } else {
                const remainingMins = Math.round(effectiveRemainingSecs || 0);
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value">${t('action_duration_label', { minutes: remainingMins })}</div></div>`;
            }
            
            // Costs — resource name + remaining count (dynamic during running)
            const costDurationMins = action.durationSeconds > 0 ? Math.max(1, Math.round(action.durationSeconds || 0)) : 1;
            const mult = action.category === 'taxing' ? TAXING_MULT : 1;
            const isRest = action.category === 'rest';
            const isRefresh = action.category === 'refresh';
            // Compute per-second gain rate (1 real sec = 1 in-game min)
            let gainPerSecRate = 0;
            let gainResourceName = null;
            if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
                for (const r of action.rewards) {
                    if (r.type === 'resource') {
                        gainResourceName = r.name;
                        gainPerSecRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                        break;
                    }
                }
            }
            const costItems = Object.entries(DEFAULT_DRAIN)
                .filter(([resName]) => {
                    // Skip resource being gained in costs display
                    if (isRest && resName === 'Stamina') return false;
                    if (isRefresh && resName === 'Drinking Water') return false;
                    // Hide costs when resource is depleted, but keep Stamina when exhausted (shown as Health)
                    const r = getResourceByName(resName);
                    if (r && r.amount <= 0) {
                        if (resName === 'Stamina' && hasEffect('exhausted')) return true;
                        return false;
                    }
                    return true;
                })
                .map(([resName, baseRate]) => {
                    const effectDrains = getEffectDrains();
                    const rateMultiplier = resName === 'Stamina' ? mult : 1;
                    const baseActionRate = baseRate * rateMultiplier;
                    const effectDrainRate = effectDrains[resName] || 0;
                    // If exhausted, Stamina-targeted effect drains redirect to Health — include
                    // both the direct Stamina debuffs AND the exhausted -1.0 Health drain.
                    const isExhausted = (resName === 'Stamina' && hasEffect('exhausted'));
                    let extraHealthDrain = 0;
                    if (isExhausted) {
                        extraHealthDrain = Math.abs(effectDrains['Health'] || 0);
                    }
                    const rate = baseActionRate + Math.abs(effectDrainRate) + extraHealthDrain;
                    const isDebuffed = effectDrains[resName] && effectDrains[resName] < 0;
                    const totalCost = rate * costDurationMins;
                    const progressPct = Math.min(1, effectiveProgress / Math.max(1, effectiveTotalSecs));
                    const remain = totalCost * (1 - progressPct);
                    
                    // If exhausted, Stamina cost becomes Health cost
                    const displayResName = isExhausted ? 'Health' : resName;
                    const emoji = RESOURCE_EMOJIS[displayResName] || '';
                    const displayName = emoji ? `${emoji} ${displayResName}` : displayResName;
                    const cssSuffix = isExhausted ? 'health' : (/stamina/i.test(resName) ? 'stamina' : (/food/i.test(resName) ? 'food' : 'water'));
                    const cssClass = `detail-cost-${cssSuffix}`;
                    const debuffBadge = isDebuffed ? `<span class="detail-cost-debuff-badge" data-debuff-for="${displayResName}">&#x26A0;</span>` : '';

                    return `<div class="detail-cost ${cssClass}"><span class="detail-cost-label">${displayName}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-remain" data-cost-res="${resName}" data-cost-total="${totalCost.toFixed(2)}" style="font-weight:bold;">${remain.toFixed(2)}</span> <span class="detail-cost-rate"${isDebuffed ? ' style="color:#E74C3C;"' : ''}>[-${rate.toFixed(2)}/min]</span>${debuffBadge}</span></div>`;
                }).join('');
            // If Health-draining effects are active AND player is NOT exhausted,
            // show a separate Health cost row. When exhausted, the Stamina row absorbs Health.
            let healthCostHtml = '';
            if (!hasEffect('exhausted')) {
                const effectDrains = getEffectDrains();
                const healthEffectDrain = effectDrains['Health'];
                if (healthEffectDrain !== undefined && healthEffectDrain < 0) {
                    const healthRate = Math.abs(healthEffectDrain);
                    const healthTotalCost = healthRate * costDurationMins;
                    const healthProgressPct = Math.min(1, effectiveProgress / Math.max(1, effectiveTotalSecs));
                    const healthRemain = healthTotalCost * (1 - healthProgressPct);
                    const healthEmoji = RESOURCE_EMOJIS['Health'] || '';
                    const healthDisplayName = healthEmoji ? `${healthEmoji} Health` : 'Health';
                    healthCostHtml = `<div class="detail-cost detail-cost-health"><span class="detail-cost-label">${healthDisplayName}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-remain" data-cost-res="Health" data-cost-total="${healthTotalCost.toFixed(2)}" style="font-weight:bold;">${healthRemain.toFixed(2)}</span> <span class="detail-cost-rate" style="color:#E74C3C;">[-${healthRate.toFixed(2)}/min]</span><span class="detail-cost-debuff-badge" data-debuff-for="Health">&#x26A0;</span></span></div>`;
                }
            }
            // Area resource drain (e.g., area_water used by drink_water)
            let areaDrainHtml = '';
            if (action.drainsAreaResource) {
                const dr = action.drainsAreaResource;
                const areaName = dr.resource || '';
                const areaLabel = t('area_' + areaName.replace('area_', '')) || areaName;
                const drainAmt = dr.amount || 1;
                const drainPerMin = drainAmt / Math.max(1, action.durationSeconds || 0);
                areaDrainHtml = `<div class="detail-cost detail-cost-water"><span class="detail-cost-label">💦 ${areaLabel}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate" style="color:#E74C3C;">[-${drainPerMin.toFixed(2)}/min]</span></span></div>`;
            }
            const costsHtml = (costItems || healthCostHtml || areaDrainHtml) ? `<div class="detail-section"><div class="detail-section-label"><span style="color:#f44336;">&#x2B07;</span> ${t('detail_costs')}</div>${costItems}${areaDrainHtml}${healthCostHtml}</div>` : '';
            
            // Gains section for rest/refresh actions (matches costs row structure)
            let gainsHtml = '';
            if ((isRest || isRefresh) && Array.isArray(action.rewards)) {
                const gainRows = action.rewards
                    .filter(r => r.type === 'resource')
                    .map(r => {
                        const gainName = r.name;
                        const gainRate = (Number(r.amount) || 0) / Math.max(1, action.durationSeconds || 1);
                        const gainCssClass = /stamina/i.test(gainName) ? 'detail-cost-stamina' : (/food/i.test(gainName) ? 'detail-cost-food' : (/water/i.test(gainName) ? 'detail-cost-water' : 'detail-cost-health'));
                        return `<div class="detail-cost detail-cost-gain ${gainCssClass}"><span class="detail-cost-label">${gainName}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate" style="color:#4caf50;">[+${gainRate.toFixed(2)}/min]</span></span></div>`;
                    }).join('');
                if (gainRows) {
                    gainsHtml = `<div class="detail-section"><div class="detail-section-label" style="color:#4caf50;">&#x2B06; ${t('detail_gains')}</div>${gainRows}</div>`;
                }
            }
            
            // Requirements section (item prerequisite)
            let requirementsHtml = '';
            if (action.requiresItem) {
                const reqItemDef = getItemDefinition(action.requiresItem);
                if (reqItemDef) {
                    requirementsHtml = `<div class="detail-section"><div class="detail-section-label">&#x1F4CB; Requirements</div><div class="detail-cost detail-cost-requirement"><span class="detail-cost-label">${reqItemDef.name}</span><span class="detail-cost-dots"></span><span class="detail-cost-right"><span class="detail-cost-rate" style="color:#ff9800;">[quest item]</span></span></div></div>`;
                }
            }
            
            // Rewards (hidden for rest/refresh since gains show the continuous rate)
            let rewardsHtml = '';
            if (action.rewards && action.rewards.length && !isRest && !isRefresh) {
                const rewardItems = action.rewards.map(r => {
                    if (r.type === 'item') {
                        const itemId = String(r.name || '').toLowerCase().replace(/\s+/g, '_');
                        const itemDef = getItemDefinition(itemId);
                        const itemName = itemDef ? itemDef.name : r.name;
                        const itemIcon = itemDef ? itemDef.icon : '';
                        const imgTag = itemIcon ? `<img src="${itemIcon}" alt="${itemName}" class="detail-reward-icon" />` : '';
                        return `<div class="detail-reward">${imgTag}<span>+${r.amount || 1} ${itemName}</span></div>`;
                    }
                    return `<div class="detail-reward">+${r.amount || 0} ${r.name}</div>`;
                }).join('');
                rewardsHtml = `<div class="detail-section"><div class="detail-section-label">&#x1F381; ${t('detail_rewards')}</div>${rewardItems}</div>`;
            }
            
            return `<div class="location-card location-card-details"><div class="location-card-header"><h3>${t(action.nameKey)}</h3></div>${tagsHtml}<p class="location-location-desc">${t(action.descKey)}</p>${durationHtml}${gainsHtml}${costsHtml}${requirementsHtml}${rewardsHtml}</div>`;
        }
    }
    
    // Show location description with POI names already highlighted via <span class="poi-highlight"> in locale strings
    if (location) {
        return `<div class="location-card location-card-details"><div class="location-card-header"><h3>${t('crash_details')}</h3></div><p class="location-location-desc" id="locationsDetailDesc">${t(location.descriptionKey)}</p></div>`;
    }
    
    return `<div class="location-card location-card-details"><div class="location-card-header"><h3>${t('crash_details')}</h3></div><p class="location-location-desc" id="locationsDetailDesc"></p></div>`;
}

function renderActionsTile(location) {
    // Load unlock state for this location
    const unlockState = getUnlockState(location.id);
    
    // Restore _repeatCount from persisted unlock state
    (location.actions || []).forEach(a => {
        const rcKey = a.id + '_repeatCount';
        if (unlockState[rcKey] !== undefined && a.repeatLimit > 0) {
            a._repeatCount = Number(unlockState[rcKey]) || 0;
        }
    });
    
    // Filter actions based on unlock state
    let actions = (location.actions || []).filter(a => {
        if (a._completed || unlockState[a.id]) return false;
        // Only show actions that are unlocked (no unlockedBy = always available)
        if (a.unlockedBy) {
            if (Array.isArray(a.unlockedBy)) {
                if (!a.unlockedBy.some(id => unlockState[id])) return false;
            } else {
                if (!unlockState[a.unlockedBy]) return false;
            }
        }
        // Hide action if it requires an area resource that is depleted
        if (a.requiresAreaResource) {
            const locId = getCurrentLocationId();
            if (getAreaResourceAmount(locId, a.requiresAreaResource) <= 0) return false;
        }
        return true;
    });
    
    // Auto-flag actions that have never been tracked in uiSeen as "new"
    // (covers initial visit to a location and newly visible actions without unlockedBy)
    actions.forEach(a => {
        const key = `action:${a.id}`;
        if (!gameFlags.uiSeen || !Object.prototype.hasOwnProperty.call(gameFlags.uiSeen, key)) {
            flagActionAsNew(a.id);
        }
    });
    
    // DEBUG: Log unlock state
    console.log(`Location: ${location.id}, Unlock State:`, unlockState, `Filtered Actions:`, actions.map(a => a.id));
    
    // Check if location has POIs
    if (location.pois && location.pois.length > 0) {
        return renderActionsTileWithPOIs(location, actions);
    }
    
    // Legacy rendering without POIs
    const buttons = actions.map(action => {
        const actionId = action.id;
        const isRunning = activeActionId === actionId && !action._completed;
        const isSelected = selectedActionId === actionId;
        const pct = isRunning ? Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)) : 0;
        const durationMins = Math.round(action.durationSeconds || 0);
        const cannotAfford = !canAffordAction(action);
        const otherRunning = !!activeAction && activeActionId !== actionId;
        let tagHtml = '';
        if (action.repeatable) tagHtml = '<span class="location-action-tag tag-repeatable">&#x21BB;</span>';
        else if (action.oneTime) tagHtml = '<span class="location-action-tag tag-onetime">1&#x00D7;</span>';
        const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
        const durationLabel = durationMins > 0 ? `<span class="location-action-btn-cost drain-time">&#x23F1; ${durationMins}m</span>` : (isInfiniteAction ? `<span class="location-action-btn-cost drain-time">&#x221E;</span>` : '');
    let playPauseHtml = '';
    const isPaused = isRunning && actionPaused;
    if (!isRunning || isPaused) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else playPauseHtml = `<span class="location-pause-icon" data-action-pause="${actionId}">&#9208;</span>`;
    // Stop button for cancellable running actions (default: cancellable unless explicitly false)
    if (isRunning && action.cancellable !== false && action.category !== 'persistent') {
        playPauseHtml += `<span class="location-stop-icon" data-action-stop="${actionId}">&#9209;</span>`;
    }
    let progressHtml = '';
    if (isRunning && !isInfiniteAction) {
        const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress);
        progressHtml = `<div class="location-action-progress" style="--progress:${pct}%"></div><span class="location-action-remaining">${remaining.toFixed(1)}s</span>`;
    } else if (isRunning && isInfiniteAction) {
        progressHtml = `<span class="location-action-ongoing">${t('action_progress_ongoing')}</span>`;
    }
        const costsRowHtml = durationLabel ? `<span class="location-action-costs-row">${durationLabel}</span>` : '';
        // Actions are never disabled — player can always attempt them even when exhausted
        return `<button type="button" class="location-action-btn${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}${action.oneTime && !action.repeatable ? ' btn-onetime' : ''}${action.repeatable ? ' btn-repeatable' : ''}${action.category === 'persistent' ? ' btn-persistent' : ''}" data-action-id="${actionId}"><span class="location-action-btn-name">${tagHtml}${t(action.nameKey)}</span>${costsRowHtml}${progressHtml}${playPauseHtml}</button>`;
    }).join('');
    return `<div class="location-card location-card-actions"><div class="location-card-header"><h3>${t('crash_actions')}</h3></div><div class="location-actions-list">${buttons}</div></div>`;
}

function renderActionsTileWithPOIs(location, actions) {
    const pois = location.pois || [];
    const poiCollapseState = getPoiCollapseState(location.id);
    
    // Group actions by POI - check POI definitions to assign actions correctly
    const actionsByPoi = {};
    const ungroupedActions = [];
    
    pois.forEach(poi => {
        actionsByPoi[poi.id] = [];
    });
    
    actions.forEach(action => {
        let assigned = false;
        // Check all POIs to find which one contains this action
        for (const poi of pois) {
            if (poi.actions && poi.actions.includes(action.id)) {
                actionsByPoi[poi.id].push(action);
                assigned = true;
                break;
            }
        }
        // If not assigned to any POI, it's ungrouped
        if (!assigned) {
            ungroupedActions.push(action);
        }
    });
    
    // Render POI sections
    let poisHtml = '';
    pois.forEach(poi => {
        const poiActions = actionsByPoi[poi.id] || [];
        
        // TRAVEL POI: only render if it has actions
        if (poi.id === 'travel') {
            if (poiActions.length === 0) return;
            const isCollapsed = poiCollapseState[poi.id] === true;
            const collapseIcon = isCollapsed ? '▶' : '▼';
            const buttonsHtml = poiActions.map(action => renderActionButton(action)).join('');
            poisHtml += `
                <div class="location-poi-section${isCollapsed ? ' poi-collapsed' : ''}" data-poi-id="${poi.id}">
                    <div class="location-poi-header" data-poi-id="${poi.id}" style="background: rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.12); border-color: rgba(var(--glow-r), var(--glow-g), var(--glow-b), 0.35);">
                        <span class="location-poi-icon">${collapseIcon}</span>
                        <span class="location-poi-name" style="color: rgb(var(--glow-r), var(--glow-g), var(--glow-b));">${t(poi.nameKey)}</span>
                    </div>
                    <div class="location-poi-actions">
                        ${buttonsHtml}
                    </div>
                </div>
            `;
            return;
        }
        
        // Skip other POIs if they have no actions
        if (poiActions.length === 0) return;
        
        const isCollapsed = poiCollapseState[poi.id] === true;
        const collapseIcon = isCollapsed ? '▶' : '▼';
        
        const buttonsHtml = poiActions.map(action => renderActionButton(action)).join('');
        
        poisHtml += `
            <div class="location-poi-section${isCollapsed ? ' poi-collapsed' : ''}" data-poi-id="${poi.id}">
                <div class="location-poi-header" data-poi-id="${poi.id}">
                    <span class="location-poi-icon">${collapseIcon}</span>
                    <span class="location-poi-name" style="color: rgb(var(--glow-r), var(--glow-g), var(--glow-b));">${t(poi.nameKey)}</span>
                </div>
                <div class="location-poi-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;
    });
    
    // Render ungrouped actions if any
    let ungroupedHtml = '';
    if (ungroupedActions.length > 0) {
        const buttonsHtml = ungroupedActions.map(action => renderActionButton(action)).join('');
        ungroupedHtml = `
            <div class="location-poi-section location-poi-other">
                <div class="location-poi-header">
                    <span class="location-poi-name">${t('poi_other_actions')}</span>
                </div>
                <div class="location-poi-actions">
                    ${buttonsHtml}
                </div>
            </div>
        `;
    }
    
    return `<div class="location-card location-card-actions"><div class="location-card-header"><h3>${t('crash_actions')}</h3></div><div class="location-actions-list location-actions-with-pois">${poisHtml}${ungroupedHtml}</div></div>`;
}

function renderActionButton(action) {
    const actionId = action.id;
    const isRunning = activeActionId === actionId && !action._completed;
    const isSelected = selectedActionId === actionId;
    const pct = isRunning ? Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)) : 0;
    const durationMins = Math.round(action.durationSeconds || 0);
    const cannotAfford = !canAffordAction(action);
    const otherRunning = !!activeAction && activeActionId !== actionId;
    let tagHtml = '';
    if (action.targetLocation) tagHtml = '<span class="location-action-tag tag-travel">&#x2192;</span>';
    else if (action.repeatable) tagHtml = '<span class="location-action-tag tag-repeatable">&#x21BB;</span>';
    else if (action.oneTime) tagHtml = '<span class="location-action-tag tag-onetime">1&#x00D7;</span>';
    const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
    const durationLabel = durationMins > 0 ? `<span class="location-action-btn-cost drain-time">&#x23F1; ${durationMins}m</span>` : (isInfiniteAction ? `<span class="location-action-btn-cost drain-time">&#x221E;</span>` : '');
    let playPauseHtml = '';
    const isPaused = isRunning && actionPaused;
    if (!isRunning || isPaused) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else playPauseHtml = `<span class="location-pause-icon" data-action-pause="${actionId}">&#9208;</span>`;
    // Stop button for cancellable running actions (persistent actions hide stop — pause saves progress)
    if (isRunning && action.cancellable !== false && action.category !== 'persistent') {
        playPauseHtml += `<span class="location-stop-icon" data-action-stop="${actionId}">&#9209;</span>`;
    }
    // Saved persistent progress for progress bar even when not running
    const savedPersistentProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
        ? (Number(gameFlags.persistentProgress[action.id]) || 0)
        : 0;
    let progressHtml = '';
    if (isRunning && !isInfiniteAction) {
        const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress);
        progressHtml = `<div class="location-action-progress" style="--progress:${pct}%"></div><span class="location-action-remaining">${remaining.toFixed(1)}s</span>`;
    } else if (isRunning && isInfiniteAction) {
        progressHtml = `<span class="location-action-ongoing">${t('action_progress_ongoing')}</span>`;
    } else if (!isRunning && savedPersistentProgress > 0 && !isInfiniteAction) {
        const savedPct = Math.min(100, Math.round((savedPersistentProgress / (action.durationSeconds || 1)) * 100));
        const remaining = Math.max(0, (action.durationSeconds || 1) - savedPersistentProgress);
        progressHtml = `<div class="location-action-progress" style="--progress:${savedPct}%"></div><span class="location-action-remaining">${remaining.toFixed(1)}s</span>`;
    }
    const costsRowHtml = durationLabel ? `<span class="location-action-costs-row">${durationLabel}</span>` : '';
    // Show "!" badge if action is newly unlocked and not yet seen by the player
    const showNewBadge = isActionNew(actionId);
    return `<button type="button" class="location-action-btn${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}${action.targetLocation ? ' btn-travel' : ''}${action.oneTime && !action.repeatable && !action.targetLocation ? ' btn-onetime' : ''}${action.repeatable && !action.targetLocation ? ' btn-repeatable' : ''}${action.category === 'persistent' ? ' btn-persistent' : ''}${showNewBadge ? ' has-new-badge' : ''}" data-action-id="${actionId}">${newBadgeHtml(showNewBadge)}<span class="location-action-btn-name">${tagHtml}${t(action.nameKey)}</span>${costsRowHtml}${progressHtml}${playPauseHtml}</button>`;
}

function getPoiCollapseState(locationId) {
    try {
        const saved = localStorage.getItem(`poiCollapse_${locationId}`);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

function setPoiCollapseState(locationId, poiId, collapsed) {
    try {
        const state = getPoiCollapseState(locationId);
        state[poiId] = collapsed;
        localStorage.setItem(`poiCollapse_${locationId}`, JSON.stringify(state));
    } catch {
        // ignore
    }
}

function getUnlockState(locationId) {
    try {
        const saved = localStorage.getItem(`unlocks_${locationId}`);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

function setUnlockState(locationId, state) {
    try {
        localStorage.setItem(`unlocks_${locationId}`, JSON.stringify(state));
    } catch {
        // ignore
    }
}

function drainCostHtml(d) {
    const rn = String(d.resource || ''); const amt = Number(d.amount || 0); let cls = 'drain-other';
    if (/stamina/i.test(rn)) cls = 'drain-stamina'; else if (/food/i.test(rn)) cls = 'drain-food'; else if (/water/i.test(rn)) cls = 'drain-water';
    const sign = amt < 0 ? '+' : '-';
    const emoji = RESOURCE_EMOJIS[rn] || '';
    const displayName = emoji ? `${emoji} ${rn}` : rn;
    return `<span class="location-action-btn-cost ${cls}">${sign}${Math.abs(amt)} ${displayName}</span>`;
}

function wireDebuffTooltips(detailsHost) {
    detailsHost.querySelectorAll('.detail-cost-debuff-badge').forEach(badge => {
        const targetResource = badge.dataset.debuffFor || 'Stamina';
        const contextExhausted = hasEffect('exhausted');
        setupTooltip(badge, () => {
            const details = getEffectDebuffDetails();
            if (!details.length) return '<p>No active debuffs.</p>';
            let html = '<h4>Active Effects</h4>';
            let hasRelevant = false;
            details.forEach(d => {
                if (!d.debuffs) return;
                const parts = [];
                const isStaminaEffect = Object.keys(d.debuffs).some(k => k === 'Stamina');
                const isHealthEffect = Object.keys(d.debuffs).some(k => k === 'Health');
                // Filter: Health row shows Health effects + Stamina effects (when exhausted, Stamina redirects to Health)
                // Stamina row shows own Stamina effects only (not Health)
                const isRelevant = (targetResource === 'Health' && (isHealthEffect || (contextExhausted && isStaminaEffect)))
                    || (targetResource === 'Stamina' && isStaminaEffect && !contextExhausted);
                if (!isRelevant) return;
                hasRelevant = true;
                for (const [resName, rate] of Object.entries(d.debuffs)) {
                    const sign = rate >= 0 ? '+' : '';
                    // When exhausted and showing for Health, rename Stamina effects to Health
                    const showAsHealth = (resName === 'Stamina' && contextExhausted && targetResource === 'Health');
                    const displayResName = showAsHealth ? 'Health' : resName;
                    parts.push(`${displayResName} ${sign}${rate.toFixed(1)}/min`);
                }
                if (parts.length) {
                    const name = t(d.nameKey);
                    html += `<div class="tooltip-section"><p><strong>${d.icon} ${name}</strong></p>`;
                    parts.forEach(p => { html += `<p class="tooltip-detail">• ${p}</p>`; });
                    html += '</div>';
                }
            });
            if (!hasRelevant) return '<p>No active debuffs for this resource.</p>';
            return html;
        });
    });
}

function refreshUI() {
    _fullRebuildNeeded = false;
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const locationHost = document.querySelector('#locationsLocationTile');
    const detailsHost = document.querySelector('#locationsDetailsTile');
    const actionsHost = document.querySelector('#locationsActionsTile');
    if (locationHost && (!locationHost.dataset.renderedId || locationHost.dataset.renderedId !== location.id)) { locationHost.innerHTML = renderLocationTile(location); locationHost.dataset.renderedId = location.id; }
    if (detailsHost) { detailsHost.innerHTML = renderDetailsTile(); wireDebuffTooltips(detailsHost); }
    if (actionsHost) { actionsHost.innerHTML = renderActionsTile(location); wireActionButtons(actionsHost); }
}

function wireActionButtons(actionsHost) {
    if (!actionsHost.dataset.wired) {
        actionsHost.dataset.wired = '1';
        actionsHost.addEventListener('click', (e) => {
            const list = actionsHost.querySelector('.location-actions-list');
            if (list && (e.target === list || e.target.closest('.location-actions-list') === e.target)) {
                selectedActionId = null; _fullRebuildNeeded = true; refreshUI();
            }
        });
    }
    
    // Wire POI collapse headers
    actionsHost.querySelectorAll('.location-poi-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const poiId = header.dataset.poiId;
            if (!poiId) return;
            
            const location = getLocation(getCurrentLocationId());
            if (!location) return;
            
            const poiSection = header.closest('.location-poi-section');
            if (!poiSection) return;
            
            const isCurrentlyCollapsed = poiSection.classList.contains('poi-collapsed');
            setPoiCollapseState(location.id, poiId, !isCurrentlyCollapsed);
            
            _fullRebuildNeeded = true;
            refreshUI();
        });
    });
    
    actionsHost.querySelectorAll('.location-action-btn').forEach(btn => { btn.addEventListener('click', (e) => {
        const actionId = btn.dataset.actionId;
        // Clear "new" badge on any interaction with this button
        if (actionId) { markActionSeen(actionId, true); }
        const playIcon = e.target.closest('.location-play-icon'); const pauseIcon = e.target.closest('.location-pause-icon'); const stopIcon = e.target.closest('.location-stop-icon');
        if (playIcon) {
            e.stopPropagation(); e.preventDefault();
            // If another action is running, queue this one instead of blocking
            if (activeAction && !activeAction._completed && activeActionId !== actionId) {
                const loc = getLocation(getCurrentLocationId());
                const act = loc?.actions?.find(a => a.id === actionId);
                if (act) {
                    // Don't queue one-time actions more than once — just select to review
                    if (act.oneTime && isInQueue(actionId)) {
                        selectedActionId = actionId;
                        _fullRebuildNeeded = true; refreshUI();
                        return;
                    }
                    addToQueue({
                        actionId: act.id,
                        locationId: getCurrentLocationId(),
                        nameKey: act.nameKey,
                        durationSeconds: act.durationSeconds || 0,
                    });
                }
                return;
            }
            playActionStart();
            if (activeActionId === actionId && actionPaused) resumeAction();
            else startAction(actionId);
            return;
        }
        if (pauseIcon) { e.stopPropagation(); e.preventDefault(); pauseAction(); return; }
        if (stopIcon) { e.stopPropagation(); e.preventDefault(); cancelActiveAction(); return; }
        e.stopPropagation();
        if (selectedActionId === actionId && activeActionId !== actionId) selectedActionId = null;
        else if (activeActionId === actionId && actionPaused) selectedActionId = actionId;
        else selectedActionId = actionId;
        _fullRebuildNeeded = true; refreshUI();
    }); });
    // Wire hover to clear "!" badges (persists so badges don't reappear on rebuild)
    actionsHost.querySelectorAll('.location-action-btn.has-new-badge').forEach(btn => {
        wireClearUiNewBadge(btn, { actionId: btn.dataset.actionId });
    });
}

function updateActionButtonsDynamic() {
    if (_fullRebuildNeeded) { refreshUI(); return; }
    const location = getLocation(getCurrentLocationId()); if (!location) return;
    const actionsHost = document.querySelector('#locationsActionsTile'); if (!actionsHost) return;
    
    // Live-update cost remaining spans in details panel
    if (activeAction && activeActionId && !activeAction._completed) {
        const totalSecs = activeAction.durationSeconds || 1;
        const pct = Math.min(1, actionProgress / totalSecs);
        document.querySelectorAll('.detail-cost-remain[data-cost-res]').forEach(span => {
            const total = parseFloat(span.dataset.costTotal) || 0;
            const remain = total * (1 - pct);
            span.textContent = remain.toFixed(2);
        });
    }
    
    actionsHost.querySelectorAll('.location-action-btn').forEach(btn => {
        const actionId = btn.dataset.actionId; const action = location.actions.find(a => a.id === actionId); if (!action) return;
        const isRunning = activeActionId === actionId && !action._completed; const isSelected = selectedActionId === actionId;
        btn.classList.toggle('is-selected', !!isSelected); btn.classList.toggle('is-running', !!isRunning);
        const cannotAfford = !canAffordAction(action); const otherRunning = !!activeAction && activeActionId !== actionId;
        // Buttons stay enabled — player can always attempt actions
        const progBar = btn.querySelector('.location-action-progress');
        if (progBar) {
            if (isRunning) {
                const pct = Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100));
                progBar.style.setProperty('--progress', `${pct}%`);
                progBar.style.display = '';
            } else {
                // Keep visible for persistent actions with saved progress
                const savedProgress = (action.category === 'persistent' && action.id && gameFlags.persistentProgress)
                    ? (Number(gameFlags.persistentProgress[action.id]) || 0)
                    : 0;
                if (savedProgress > 0) {
                    const savedPct = Math.min(100, Math.round((savedProgress / (action.durationSeconds || 1)) * 100));
                    progBar.style.setProperty('--progress', `${savedPct}%`);
                    progBar.style.display = '';
                } else {
                    progBar.style.display = 'none';
                }
            }
        }
        const remainingEl = btn.querySelector('.location-action-remaining');
        if (remainingEl) { if (isRunning) { const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress); remainingEl.textContent = `${remaining.toFixed(1)}s`; remainingEl.style.display = ''; } else remainingEl.style.display = 'none'; }
        const playIcon = btn.querySelector('.location-play-icon'); const pauseIcon = btn.querySelector('.location-pause-icon');
        const isPaused = isRunning && actionPaused;
        if (playIcon) { const show = !isRunning || isPaused; playIcon.style.display = show ? '' : 'none'; }
        if (pauseIcon) pauseIcon.style.display = (isRunning && !isPaused) ? '' : 'none';
    });
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
