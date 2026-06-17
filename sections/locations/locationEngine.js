// ==========================================================================
// Location Engine
// ==========================================================================

import { resources, updateResourceInfo, setActiveDrainRates, applyTimePassiveDrain, roundResourceAmount } from '../../engine/resources.js';
import { addLogEntry, LogType } from '../../engine/ingameLog.js';
import { t } from '../../locales/locales.js';
import { getCurrentLocationId, switchToLocation, getLocation } from './locationData.js';
import { advanceIngameTimeBySeconds, getIngameTimeString } from '../../engine/time.js';
import { playActionStart } from '../../engine/audio.js';
import { gameFlags, isActionNew, flagActionAsNew, markActionSeen } from '../../engine/gameFlags.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../../ui/components/contentNewBadges.js';
import { getEffectDebuffs, hasEffect, removeEffect } from '../../engine/effects.js';
import { addToQueue, startNextQueuedAction } from '../../engine/queue.js';

const DEFAULT_DRAIN = { 'Stamina': 0.20, 'Food Rations': 0.10, 'Drinking Water': 0.10 };
const TAXING_MULT = 2.0;

let activeAction = null;
let activeActionId = null;
let actionTimer = null;
let actionProgress = 0;
let selectedActionId = null;
let actionPaused = false;
let loopCount = Number(localStorage.getItem('loopCount') || 0);
let _infoUpdateCounter = 0;
let _fullRebuildNeeded = true;

function getResourceByName(name) {
    return resources.find(res => res && String(res.name) === String(name));
}

function canAffordAction(action) {
    if (!action) return true;
    const durationMins = (action.durationSeconds || 1) / 60;
    const debuffs = getEffectDebuffs();
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    for (const [resName, baseRate] of Object.entries(DEFAULT_DRAIN)) {
        // Rest actions gain Stamina — skip Stamina affordability check
        if (action.category === 'rest' && resName === 'Stamina') continue;
        // Refresh actions gain Drinking Water — skip Water affordability check
        if (action.category === 'refresh' && resName === 'Drinking Water') continue;
        let rateMultiplier = resName === 'Stamina' ? mult : 1;
        // Apply effect debuffs to cost
        if (resName === 'Stamina') rateMultiplier *= (debuffs.staminaMultiplier || 1);
        else if (/food/i.test(resName)) rateMultiplier *= (debuffs.foodMultiplier || 1);
        else if (/water/i.test(resName)) rateMultiplier *= (debuffs.waterMultiplier || 1);
        const totalCost = baseRate * rateMultiplier * durationMins;
        const resource = getResourceByName(resName);
        if (!resource) continue;
        if (totalCost <= 0) continue;
        if (!Number.isFinite(Number(resource.amount)) || Number(resource.amount) < totalCost) return false;
    }
    return true;
}

function resetLoopState() {
    loopCount += 1;
    try { localStorage.setItem('loopCount', String(loopCount)); } catch { /* ignore */ }
    const stamina = getResourceByName('Stamina');
    if (stamina) stamina.amount = Math.max(5, Math.min(stamina.capacity || 20, 12));
    const food = getResourceByName('Food Rations');
    if (food) food.amount = Math.max(2, Math.min(food.capacity || 10, 6));
    const water = getResourceByName('Drinking Water');
    if (water) water.amount = Math.max(2, Math.min(water.capacity || 10, 6));
    addLogEntry(t('log_loop_started', { loop: loopCount }), LogType.INFO);
    _fullRebuildNeeded = true;
    refreshUI();
}

function checkLoopTrigger() {
    const drained = resources.filter(r => r && Number.isFinite(Number(r.amount)) && Number(r.amount) <= 0 && r.name !== 'XP');
    if (drained.length === 0) return false;
    const names = drained.map(r => r.name).join(', ');
    addLogEntry(t('log_loop_triggered', { resources: names }), LogType.ERROR);
    resetLoopState();
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
        }
        // item rewards handled by inventory system when wired
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
    } else if (action.resultKey) {
        addLogEntry(t(action.resultKey), LogType.SUCCESS);
    } else {
        addLogEntry(`${action._displayName || action.id} completed.`, LogType.INFO);
    }
    // Remove effect if this action removes one
    if (action.removesEffect) {
        removeEffect(action.removesEffect);
        addLogEntry(t('log_effect_removed', { effect: t('effect_' + action.removesEffect) }), LogType.SUCCESS);
    }
    
    if (action.oneTime && !action.repeatable) { action._completed = true; _fullRebuildNeeded = true; }
    if (typeof action.repeatLimit === 'number' && action.repeatLimit > 0) {
        action._repeatCount = (action._repeatCount || 0) + 1;
        if (action._repeatCount >= action.repeatLimit) { action._completed = true; _fullRebuildNeeded = true; }
    }
    
    // Handle action unlocks
    if (action.unlocksAll) {
        const location = getLocation(getCurrentLocationId());
        if (location) {
            const unlockState = getUnlockState(location.id);
            unlockState[action.id] = true;
            setUnlockState(location.id, unlockState);
            // Flag all newly unlocked actions as "new" so badges appear
            (location.actions || []).forEach(a => {
                if (a.id !== action.id && a.unlockedBy === action.id) {
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
    selectedActionId = null; _infoUpdateCounter = 0; _fullRebuildNeeded = true;
    if (targetLoc && switchToLocation(targetLoc)) addLogEntry(`Arrived at ${t(getLocation(targetLoc)?.nameKey || targetLoc)}.`, LogType.INFO);
    refreshUI();
    startNextQueuedAction();
    checkLoopTrigger();
}

/**
 * Cancel the active action — revert without rewards, completion flags, or repeat count.
 */
function cancelActiveAction() {
    const action = activeAction;
    if (!action) return;
    setActiveDrainRates(null, null);
    addLogEntry(t('log_action_cancelled', { action: action._displayName || t(action.nameKey) }), LogType.INFO);
    try { updateResourceInfo(); } catch { /* ignore */ }
    clearActionTimer();
    activeAction = null; activeActionId = null; actionProgress = 0; actionPaused = false;
    selectedActionId = null; _infoUpdateCounter = 0; _fullRebuildNeeded = true;
    refreshUI();
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
    if (!canAffordAction(action)) return;
    if (activeActionId === actionId && !actionPaused) return;
    // Set drain rates from default action costs (per-minute rates)
    const mult = action.category === 'taxing' ? TAXING_MULT : 1;
    const drainRates = {}; const sources = {}; const displayName = t(action.nameKey);
    const isRest = action.category === 'rest';
    const isRefresh = action.category === 'refresh';
    // Block starting rest/refresh if the gained resource is already at capacity
    if (isRest || isRefresh) {
        for (const r of (action.rewards || [])) {
            if (r.type === 'resource') {
                const res = getResourceByName(r.name);
                if (res && res.capacity > 0 && Number(res.amount) >= Number(res.capacity)) {
                    if (isRest) addLogEntry(t('log_rest_full'), LogType.INFO);
                    else if (isRefresh) addLogEntry(t('log_water_full'), LogType.INFO);
                    return;
                }
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
        let rateMultiplier = resName === 'Stamina' ? mult : 1;
        // Apply effect debuffs to drain rate
        const debuffs = getEffectDebuffs();
        if (resName === 'Stamina') rateMultiplier *= (debuffs.staminaMultiplier || 1);
        else if (/food/i.test(resName)) rateMultiplier *= (debuffs.foodMultiplier || 1);
        else if (/water/i.test(resName)) rateMultiplier *= (debuffs.waterMultiplier || 1);
        const perMin = baseRate * rateMultiplier;
        drainRates[resName] = -perMin;
        if (!sources[resName]) sources[resName] = [];
        sources[resName].push({ rate: perMin, label: displayName });
    }
    setActiveDrainRates(drainRates, sources);
    if (activeActionId !== actionId) { activeActionId = actionId; activeAction = action; activeAction._displayName = t(action.nameKey); actionProgress = 0; }
    actionPaused = false; _infoUpdateCounter = 0; _fullRebuildNeeded = true; refreshUI();
    const TICK_SECONDS = 0.1; clearActionTimer();
    const isInfinite = !action.durationSeconds || action.durationSeconds <= 0;
    actionTimer = setInterval(() => {
        if (!activeAction) { clearActionTimer(); return; }
        if (actionPaused) return;
        const tickSecs = TICK_SECONDS * getGameSpeed();
        actionProgress += tickSecs;
        advanceIngameTimeBySeconds(tickSecs);
        applyTimePassiveDrain(tickSecs);
        updateClockDisplay();
        updateActionButtonsDynamic();
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

        // Normal duration-based completion (only for finite actions)
        if (!isInfinite && actionProgress >= (activeAction.durationSeconds || 1)) {
            completeActiveAction();
        }
    }, 100);
}

function pauseAction() { actionPaused = true; _fullRebuildNeeded = true; refreshUI(); }
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
            if (action.repeatable) {
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
            else if (action.category === 'rest') { catLabel = t('cat_rest'); catClass = 'detail-category-rest'; }
            else if (action.category === 'refresh') { catLabel = t('cat_refresh'); catClass = 'detail-category-refresh'; }
            if (catLabel) tagItems.push(`<span class="detail-category detail-tag ${catClass}">${catLabel}</span>`);
            const tagsHtml = tagItems.length > 0 ? `<div class="detail-tags">${tagItems.join('')}</div>` : '';

            // Duration
            const isInfiniteAction = !action.durationSeconds || action.durationSeconds <= 0;
            let durationHtml = '';
            if (isInfiniteAction) {
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value">${t('action_duration_ongoing')}</div></div>`;
            } else if (action.durationSeconds > 0) {
                const durationMins = Math.round(action.durationSeconds || 0);
                durationHtml = `<div class="detail-section"><div class="detail-section-label">&#x23F1; ${t('detail_duration')}</div><div class="detail-section-value">${t('action_duration_label', { minutes: durationMins })}</div></div>`;
            }
            
            // Costs — resource name + remaining count (dynamic during running)
            const isActionRunning = activeActionId === selectedActionId && !action._completed;
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
                    return true;
                })
                .map(([resName, baseRate]) => {
                    const debuffs = getEffectDebuffs();
                    let rateMultiplier = resName === 'Stamina' ? mult : 1;
                    if (resName === 'Stamina') rateMultiplier *= (debuffs.staminaMultiplier || 1);
                    else if (/food/i.test(resName)) rateMultiplier *= (debuffs.foodMultiplier || 1);
                    else if (/water/i.test(resName)) rateMultiplier *= (debuffs.waterMultiplier || 1);
                    const isDebuffed = rateMultiplier > (resName === 'Stamina' ? mult : 1);
                    const rate = baseRate * rateMultiplier;
                    const totalCost = rate * costDurationMins;
                    const remain = isActionRunning ? totalCost * (1 - Math.min(1, actionProgress / (action.durationSeconds || 1))) : totalCost;
                    const cssClass = /stamina/i.test(resName) ? 'detail-cost-stamina' : (/food/i.test(resName) ? 'detail-cost-food' : 'detail-cost-water');
                    return `<div class="detail-cost ${cssClass}${isDebuffed ? ' detail-cost-debuffed' : ''}"><span class="detail-cost-label">${resName}</span><span class="detail-cost-remain" data-cost-res="${resName}" data-cost-total="${totalCost.toFixed(2)}">${remain.toFixed(2)}</span><span class="detail-cost-rate">[-${rate.toFixed(2)}/min]</span>${isDebuffed ? '<span class="detail-cost-debuff-badge">&#x26A0;</span>' : ''}</div>`;
                }).join('');
            const costsHtml = costItems ? `<div class="detail-section"><div class="detail-section-label"><span style="color:#f44336;">&#x2B07;</span> ${t('detail_costs')}</div>${costItems}</div>` : '';
            
            // Gains section for rest/refresh actions (matches costs row structure)
            let gainsHtml = '';
            if (gainResourceName && gainPerSecRate > 0) {
                const gainCssClass = /stamina/i.test(gainResourceName) ? 'detail-cost-stamina' : (/food/i.test(gainResourceName) ? 'detail-cost-food' : 'detail-cost-water');
                gainsHtml = `<div class="detail-section"><div class="detail-section-label" style="color:#4caf50;">&#x2B06; ${t('detail_gains')}</div><div class="detail-cost detail-cost-gain ${gainCssClass}"><span class="detail-cost-label">${gainResourceName}</span><span class="detail-cost-rate" style="color:#4caf50;">[+${gainPerSecRate.toFixed(2)}/min]</span></div></div>`;
            }
            
            // Rewards (hidden for rest/refresh since gains show the continuous rate)
            let rewardsHtml = '';
            if (action.rewards && action.rewards.length && !isRest && !isRefresh) {
                const rewardItems = action.rewards.map(r => {
                    if (r.type === 'item') return `<div class="detail-reward">+1 ${r.name} (item)</div>`;
                    return `<div class="detail-reward">+${r.amount || 0} ${r.name}</div>`;
                }).join('');
                rewardsHtml = `<div class="detail-section"><div class="detail-section-label">&#x1F381; ${t('detail_rewards')}</div>${rewardItems}</div>`;
            }
            
            return `<div class="location-card location-card-details"><div class="location-card-header"><h3>${t(action.nameKey)}</h3></div>${tagsHtml}<p class="location-location-desc">${t(action.descKey)}</p>${durationHtml}${gainsHtml}${costsHtml}${rewardsHtml}</div>`;
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
    
    // Filter actions based on unlock state
    let actions = (location.actions || []).filter(a => {
        if (a._completed) return false;
        // Only show actions that are unlocked (no unlockedBy = always available)
        if (a.unlockedBy && !unlockState[a.unlockedBy]) return false;
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
        const isPaused = isRunning && actionPaused;
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
    if (!isRunning) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else if (isPaused) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else if (isRunning && !isPaused) playPauseHtml = `<span class="location-pause-icon" data-action-pause="${actionId}">&#9208;</span>`;
    // Stop button for cancellable running actions (default: cancellable unless explicitly false)
    if (isRunning && action.cancellable !== false) {
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
        const disabled = cannotAfford && !isRunning;
        return `<button type="button" class="location-action-btn${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}${isPaused ? ' is-paused' : ''}${action.oneTime && !action.repeatable ? ' btn-onetime' : ''}${action.repeatable ? ' btn-repeatable' : ''}" data-action-id="${actionId}"${disabled ? ' disabled' : ''}><span class="location-action-btn-name">${tagHtml}${t(action.nameKey)}</span>${costsRowHtml}${progressHtml}${playPauseHtml}</button>`;
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
    const isPaused = isRunning && actionPaused;
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
    if (!isRunning) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else if (isPaused) playPauseHtml = `<span class="location-play-icon" data-action-play="${actionId}">&#9654;</span>`;
    else if (isRunning && !isPaused) playPauseHtml = `<span class="location-pause-icon" data-action-pause="${actionId}">&#9208;</span>`;
    // Stop button for cancellable running actions (default: cancellable unless explicitly false)
    if (isRunning && action.cancellable !== false) {
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
    const disabled = cannotAfford && !isRunning;
    // Show "!" badge if action is newly unlocked and not yet seen by the player
    const showNewBadge = isActionNew(actionId);
    return `<button type="button" class="location-action-btn${isSelected ? ' is-selected' : ''}${isRunning ? ' is-running' : ''}${isPaused ? ' is-paused' : ''}${action.oneTime && !action.repeatable ? ' btn-onetime' : ''}${action.repeatable ? ' btn-repeatable' : ''}${showNewBadge ? ' has-new-badge' : ''}" data-action-id="${actionId}"${disabled ? ' disabled' : ''}>${newBadgeHtml(showNewBadge)}<span class="location-action-btn-name">${tagHtml}${t(action.nameKey)}</span>${costsRowHtml}${progressHtml}${playPauseHtml}</button>`;
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
    return `<span class="location-action-btn-cost ${cls}">${sign}${Math.abs(amt)} ${rn}</span>`;
}

function refreshUI() {
    _fullRebuildNeeded = false;
    const location = getLocation(getCurrentLocationId());
    if (!location) return;
    const locationHost = document.querySelector('#locationsLocationTile');
    const detailsHost = document.querySelector('#locationsDetailsTile');
    const actionsHost = document.querySelector('#locationsActionsTile');
    if (locationHost && (!locationHost.dataset.renderedId || locationHost.dataset.renderedId !== location.id)) { locationHost.innerHTML = renderLocationTile(location); locationHost.dataset.renderedId = location.id; }
    if (detailsHost) { detailsHost.innerHTML = renderDetailsTile(); }
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
        const isRunning = activeActionId === actionId && !action._completed; const isSelected = selectedActionId === actionId; const isPaused = isRunning && actionPaused;
        btn.classList.toggle('is-selected', !!isSelected); btn.classList.toggle('is-running', !!isRunning); btn.classList.toggle('is-paused', !!isPaused);
        const cannotAfford = !canAffordAction(action); const otherRunning = !!activeAction && activeActionId !== actionId;
        btn.disabled = (cannotAfford && !isRunning) ? true : false;
        const progBar = btn.querySelector('.location-action-progress');
        if (progBar) { if (isRunning) { const pct = Math.min(100, Math.round((actionProgress / (action.durationSeconds || 1)) * 100)); progBar.style.setProperty('--progress', `${pct}%`); progBar.style.display = ''; } else progBar.style.display = 'none'; }
        const remainingEl = btn.querySelector('.location-action-remaining');
        if (remainingEl) { if (isRunning) { const remaining = Math.max(0, (action.durationSeconds || 1) - actionProgress); remainingEl.textContent = `${remaining.toFixed(1)}s`; remainingEl.style.display = ''; } else remainingEl.style.display = 'none'; }
        const playIcon = btn.querySelector('.location-play-icon'); const pauseIcon = btn.querySelector('.location-pause-icon');
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
