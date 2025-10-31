import { allActions as salvageActions } from '../data/allActions.js';
import { resources } from '../resources.js';
import { addLogEntry, LogType } from '../log.js';
import { enableSection } from '../main.js';
import { setupTooltip, refreshCurrentTooltip } from '../tooltip.js';
import { storyEvents } from '../data/storyEvents.js';
import { showStoryPopup } from '../popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';
import { buildings } from '../data/buildings.js';
import { updateBuildingButtonsState, createBuildingButton } from './colony.js';
import { gameFlags, runActionCompletionHandlers } from '../data/gameFlags.js';
import { computeRewardMultiplier } from '../data/upgradeEffects.js';
import { lsGet, getCurrentStage, tooltipDataForAction, canAffordAction, getAffordabilityShortfalls, computeEffectiveDuration, getRandomInt } from '../data/actionUtils.js';
import { getBlockedStatus, evaluateEventUnlocks } from '../data/unlockRules.js';


const SITE_BUILDING_NAMES = ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'];

function attachStartClickHandler(btn, action, section) {
    btn.onclick = (e) => {
    const block = getBlockedStatus(action.id, { actions: salvageActions });
        if (block.blocked) {
            e.preventDefault();
            addLogEntry(block.reason, LogType.INFO);
            return;
        }
    const shortfalls = getAffordabilityShortfalls(action, resources);
        if (shortfalls.length > 0) {
            e.preventDefault();
            addLogEntry(`Cannot start "${action.name}": ${shortfalls.join('; ')}`, LogType.INFO);
            return;
        }
        startAction(action, section);
    };
}

let actionInterval = null;
let isPendingCancel = null;
let cancelTimeout = null;

// Start the periodic crash-site progress loop
export function startCrashSiteLoop(section = null) {
    if (actionInterval) return;
    if (lsGet('gamePaused') === 'true') {
        addLogEntry('Cannot resume crash site loop while game is paused.', LogType.INFO);
        return;
    }

    if (!section) {
        const container = document.querySelector('#salvageActionsContainer');
        section = container ? container.closest('.content-panel') || container.parentElement : null;
    }
    const activeAction = getActiveCrashSiteAction();
    if (!activeAction) return;
    if (activeAction.pauseStart) {
        const pausedDuration = Date.now() - activeAction.pauseStart;
        activeAction.startTime = (activeAction.startTime || Date.now()) + pausedDuration;
        activeAction.lastTickTime = Date.now();
        delete activeAction.pauseStart;
    }
    actionInterval = setInterval(() => updateActionProgress(section), 100);
}

// Pause the crash-site loop and mark pause time
export function stopCrashSiteLoop() {
    if (actionInterval) {
        clearInterval(actionInterval);
        actionInterval = null;
    }
    const activeAction = getActiveCrashSiteAction();
    if (activeAction) {
        activeAction.pauseStart = Date.now();
    }
}

// Build crash-site section UI
export function setupCrashSiteSection(section) {
    if (!section) {
        const container = document.querySelector('#salvageActionsContainer');
        section = container ? container.closest('.content-panel') || container.parentElement : null;
    }
    if (!section) return;
    let targetPanel;
    let existingButtons = new Map();
    if (section.classList && section.classList.contains('content-panel')) {
        targetPanel = section;
        targetPanel.querySelectorAll('.image-button[data-action-id]').forEach(b => {
            existingButtons.set(b.dataset.actionId, b);
        });
        targetPanel.innerHTML = '';
    } else {
        targetPanel = section.querySelector('.content-panel');
        if (!targetPanel) {
            targetPanel = document.createElement('div');
            targetPanel.className = 'content-panel';
            section.appendChild(targetPanel);
        } else {
            targetPanel.querySelectorAll('.image-button[data-action-id]').forEach(b => {
                existingButtons.set(b.dataset.actionId, b);
            });
            targetPanel.innerHTML = '';
        }
    }
    section = targetPanel;
    section.innerHTML = `
        <h2>Crash Site</h2>
        <p>The wreckage of the exploration ship smolders at the edge of a dense forest. The priority is to assess the damage and salvage whatever you can.</p>
        <div id="salvageActionsContainer" style="margin-top: 20px;"></div>
    `;

    const actionsContainer = section.querySelector('#salvageActionsContainer');
    const availableActions = salvageActions.filter(action => {
        const stageIndex = action.stage || 0;
        const totalStages = (action.stages || []).length;
        if (totalStages > 0 && stageIndex >= totalStages) return !!action.repeatable && !!action.isUnlocked;
        return !!action.isUnlocked;
    });

    const categories = [...new Set(availableActions.map(a => a.category))]
        .filter(c => c !== 'Construction' && c !== 'Upgrade');

    const createActionButton = (action, group) => {
        let btn = null;
        if (existingButtons && existingButtons.has(action.id)) {
            btn = existingButtons.get(action.id);
            existingButtons.delete(action.id);
        }

        if (!btn) {
            btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = action.id;
        }
        btn.className = 'image-button';
        btn.dataset.actionId = action.id;
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('title');
        delete btn.dataset.shortfall;
        delete btn.dataset.blockedReason;
        delete btn.dataset.blocked;
        delete btn.dataset.affordable;
        btn.classList.remove('running', 'confirm-cancel');
        btn.innerHTML = `
            <div class="action-progress-bar"></div>
            <span class="building-name">${action.name}</span>
            <span class="cancel-text">Abort?</span>
        `;

    // register a dynamic tooltip provider so the tooltip always reflects the current stage
    setupTooltip(btn, () => tooltipDataForAction(action));

        const canAfford = canAffordAction(action, resources);
        btn.classList.toggle('unaffordable', !canAfford);
        if (!canAfford) {
            btn.setAttribute('aria-disabled', 'true');
            btn.dataset.shortfall = getAffordabilityShortfalls(action, resources).join(', ');
        } else {
            btn.removeAttribute('aria-disabled');
            delete btn.dataset.shortfall;
        }
        attachStartClickHandler(btn, action, section);

        group.appendChild(btn);
    };

    categories.forEach(category => {
        const h = document.createElement('h3');
        h.textContent = category;
        h.className = 'category-heading';
        actionsContainer.appendChild(h);

        const group = document.createElement('div');
        group.className = 'button-group';

        availableActions.filter(a => a.category === category).forEach(action => {
            createActionButton(action, group);
        });

        actionsContainer.appendChild(group);
    });

    const constructionWrapper = document.createElement('div');
    constructionWrapper.style.marginTop = '18px';
    const ch = document.createElement('h3');
    ch.textContent = 'Construction';
    constructionWrapper.appendChild(ch);

    const buildGroup = document.createElement('div');
    buildGroup.className = 'button-group';
    const siteBuildings = buildings.filter(b => SITE_BUILDING_NAMES.includes(b.name) && b.isUnlocked === true);

    siteBuildings.forEach(bld => {
        createBuildingButton(bld, buildGroup);
        const btn = buildGroup.querySelector(`.image-button[data-building="${bld.name}"]`);
        if (btn) {
            const nameSpan = btn.querySelector('.building-name'); if (nameSpan) nameSpan.textContent = bld.name;
            const countSpan = btn.querySelector('.building-count'); if (countSpan) countSpan.textContent = `(${bld.count})`;
        }
    });

    if (buildGroup.children.length > 0) {
        if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
        constructionWrapper.appendChild(buildGroup);
        actionsContainer.appendChild(constructionWrapper);
    }

     const upgradeActions = availableActions.filter(a => a.category === 'Upgrade');
    if (upgradeActions.length > 0) {
        const uh = document.createElement('h3');
        uh.textContent = 'Upgrades';
        uh.className = 'category-heading';
        actionsContainer.appendChild(uh);

        const uGroup = document.createElement('div');
        uGroup.className = 'button-group';
        upgradeActions.forEach(action => createActionButton(action, uGroup));
        actionsContainer.appendChild(uGroup);
    }
}

// Start an action and set up UI/progress state
function startAction(action, section) {
    const existing = getActiveCrashSiteAction();
    if (existing) return;
    if (lsGet('gamePaused') === 'true') {
        addLogEntry(`Cannot start "${action.name}" while game is paused. Resume the game first.`, LogType.INFO);
        return;
    }

    if (!canAffordAction(action)) {
        addLogEntry(`Not enough resources to begin: ${action.name}.`, LogType.ERROR);
        return;
    }
    const stage = getCurrentStage(action);
    const upfront = [...(action.cost || []), ...((stage && stage.cost) || [])];
    upfront.forEach(cost => {
        const r = resources.find(x => x.name === cost.resource);
        if (r) r.amount -= cost.amount;
    });
    refreshCurrentTooltip();

    const btn = section.querySelector(`[data-action-id="${action.id}"]`);
    if (btn) {
        const name = btn.querySelector('.building-name');
        if (name && !btn.dataset.originalLabel) btn.dataset.originalLabel = name.innerText;
        const bar = btn.querySelector('.action-progress-bar');
        if (bar) bar.style.width = '0%';
        btn.classList.add('running');
        if (action.cancelable) {
            btn.onclick = () => requestCancel(action, section);
            btn.disabled = false;
        } else {
            btn.onclick = null;
            btn.disabled = true;
        }
    }

    // create an active-action snapshot that includes any stage-specific overrides
    const snapshot = JSON.parse(JSON.stringify(action));
    // merge stage-specific cost/drain/reward/duration into the running snapshot
    if (stage) {
        snapshot.cost = [...(action.cost || []), ...((stage && stage.cost) || [])];
        snapshot.drain = Array.isArray(stage.drain) ? stage.drain : (action.drain || []);
        snapshot.reward = stage.reward || action.reward || [];
        if (typeof stage.duration !== 'undefined') snapshot.duration = stage.duration;
        if (stage.description) snapshot.description = stage.description;
    } else {
        snapshot.cost = action.cost || [];
        snapshot.drain = action.drain || [];
        snapshot.reward = action.reward || [];
    }

    setActiveCrashSiteAction({
        ...snapshot,
        startTime: Date.now(),
        lastTickTime: Date.now(),
        elapsed: 0
    });

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);
    startCrashSiteLoop(section);
}

// Ask to cancel a running action (double-click confirmation)
function requestCancel(action, section) {
    const running = getActiveCrashSiteAction();
    if (!running || running.cancelable === false) return;

    if (isPendingCancel === action.id) {
        clearTimeout(cancelTimeout);
        cancelAction(section, `${action.name} cancelled by user.`);
        return;
    }
    isPendingCancel = action.id;
    const btn = section.querySelector(`[data-action-id="${action.id}"]`);
    if (btn) btn.classList.add('confirm-cancel');
    cancelTimeout = setTimeout(() => {
        if (btn) btn.classList.remove('confirm-cancel');
        isPendingCancel = null;
        cancelTimeout = null;
    }, 2000);
}

// Progress and complete actions based on time scale and drains
function updateActionProgress(section) {
    const a = getActiveCrashSiteAction();
    if (!a) return;

    const now = Date.now();
    const rawDelta = Math.max(0, Math.min((now - (a.lastTickTime || now)) / 1000, 0.25));
    a.lastTickTime = now;

    const timeScale = (window.TIME_SCALE || 1);
    const delta = rawDelta * timeScale;

    const effectiveDuration = computeEffectiveDuration(a, resources);

    // Drain is handled centrally by the main loop (computeResourceRates + main.js).
    // Here we only check for depletion and cancel if the resource is exhausted.
    if (a.drain) {
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            if (!res) continue;
            if (res.amount <= 0) {
                cancelAction(section, `${a.name} cancelled: Ran out of ${res.name}.`, true);
                return;
            }
        }
    }

    a.elapsed = Math.min(effectiveDuration, (a.elapsed || 0) + delta);
    const progress = Math.min((a.elapsed / effectiveDuration) * 100, 100);

    const btn = section.querySelector(`[data-action-id="${a.id}"]`);
    if (btn) {
        const bar = btn.querySelector('.action-progress-bar');
        const label = btn.querySelector('.building-name');
        if (bar) bar.style.width = `${progress}%`;
        if (label) {
            const remainingRealSeconds = Math.max(0, (effectiveDuration - a.elapsed) / timeScale);
            label.innerText = `${remainingRealSeconds.toFixed(1)}s`;
        }
    }

    if (a.elapsed >= effectiveDuration) handleActionCompletion(section);
}

// Cancel the running action with optional force and apply refunds
function cancelAction(section, message, force = false) {
    const a = getActiveCrashSiteAction();
    if (!a) return;
    if (!force && a.cancelable === false) {
        addLogEntry(`${a.name} cannot be cancelled.`, LogType.INFO);
        return;
    }

    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const refunds = [];
    if (a.cost) {
        for (const c of a.cost) {
            const res = resources.find(r => r.name === c.resource);
            const refund = Math.floor(c.amount * 0.5);
            if (res && refund > 0) {
                res.amount = Math.min(res.amount + refund, res.capacity);
                refunds.push(`${refund} ${res.name}`);
            }
        }
    }
    refreshCurrentTooltip();

    if (a.drain) {
        const effectiveDuration = computeEffectiveDuration(a, resources);
        const elapsed = Math.max(0, Math.min(a.elapsed || 0, effectiveDuration));
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            const perSec = d.amount / effectiveDuration;
            const drained = perSec * elapsed;
            const refund = Math.floor(drained * 0.5);
            if (res && refund > 0) {
                res.amount = Math.min(res.amount + refund, res.capacity);
                refunds.push(`${refund} ${res.name}`);
            }
        }
    }

    setActiveCrashSiteAction(null);
    addLogEntry(message, LogType.ERROR);
    if (refunds.length) addLogEntry(`Refunded: ${refunds.join(', ')}.`, LogType.INFO);
    // Clear running UI for the cancelled action (in-place) then update button states to avoid DOM rebuild flicker
    const btn = section ? section.querySelector(`[data-action-id="${a.id}"]`) : document.querySelector(`[data-action-id="${a.id}"]`);
    if (btn) {
        btn.classList.remove('running');
        btn.classList.remove('confirm-cancel');
        const bar = btn.querySelector('.action-progress-bar'); if (bar) bar.style.width = '0%';
        const nameSpan = btn.querySelector('.building-name'); if (nameSpan) nameSpan.textContent = (btn.dataset.originalLabel || (a && a.name) || '');
        delete btn.dataset.originalLabel;
        const actionDef = salvageActions.find(s => s.id === a.id);
        if (actionDef) { btn.disabled = false; attachStartClickHandler(btn, actionDef, section); }
    }
    if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
}

// Handle completing an action: rewards, stories, unlocks, and UI
function handleActionCompletion(section) {
    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const completed = getActiveCrashSiteAction();
    if (!completed) return;
    const actionDef = salvageActions.find(a => a.id === completed.id);
    const suppressGeneric = !!(actionDef && (actionDef.suppressGenericLog || ((actionDef.stages && actionDef.stages[(actionDef.stage || 0)] && actionDef.stages[(actionDef.stage || 0)].suppressGenericLog))));

    if (completed.reward) {
        const gains = [];
        completed.reward.forEach(rw => {
            const res = resources.find(r => r.name === rw.resource);
            if (!res) return;
            const amt = Array.isArray(rw.amount) ? getRandomInt(rw.amount[0], rw.amount[1]) : rw.amount;
            // Apply upgrade-based reward multipliers via upgradeEffects
            const rewardMul = computeRewardMultiplier(completed.id, rw.resource, gameFlags);
            let finalAmt = Math.floor(amt * rewardMul);
            res.amount = Math.min(res.amount + finalAmt, res.capacity);
            gains.push(`${finalAmt} ${rw.resource}`);
        });
        // Avoid generic success/gained log for actions that opt out via suppressGenericLog
        if (!suppressGeneric) {
            addLogEntry(`${completed.name} complete! Gained: ${gains.join(', ')}.`, LogType.SUCCESS);
        }
    } else {
        if (!suppressGeneric) {
            addLogEntry(`${completed.name} complete!`, LogType.SUCCESS);
        }
    }
    refreshCurrentTooltip();

    const original = salvageActions.find(a => a.id === completed.id || a.name === completed.name);
    if (original) {
        original.completed = true;
        const idx = original.stage || 0;
        const stage = (original.stages || [])[idx];

        if (stage) {
            if (stage.story) {
                const event = storyEvents[stage.story];
                if (event) {
                    showStoryPopup(event);
                    addLogEntry(stage.logText || '', LogType.STORY, { onClick: () => showStoryPopup(event) });
                }
            } else if (stage.logText) {
                addLogEntry(stage.logText, LogType.STORY);
            }
            if (Array.isArray(stage.unlocks)) {
                stage.unlocks.forEach(id => {
                    const toUnlock = salvageActions.find(a => a.id === id || a.name === id);
                    if (toUnlock && !toUnlock.isUnlocked) {
                        toUnlock.isUnlocked = true;
                        addLogEntry(`New action available: ${toUnlock.name}`, LogType.UNLOCK);
                    }
                });
            }

            const total = (original.stages || []).length;
            original.stage = Math.min(idx + 1, total);
            if (original.stage >= total) {
                original.isUnlocked = !!original.repeatable;
            }
        }
    }

    if (original && original.id === 'establishBaseCamp') {
        enableSection('crewManagementSection');
    }

    // Track whether unlocks require a full UI rebuild
    let didUnlock = false;
    if (Array.isArray((original && original.stages && original.stages[original.stage - 1])?.unlocks)) {
        try {
            const container = document.querySelector('#salvageActionsContainer');
            if (container) {
                const presentIds = new Set(Array.from(container.querySelectorAll('.image-button[data-action-id]')).map(b => b.dataset.actionId));
                for (const a of salvageActions) {
                    if (a.isUnlocked && !presentIds.has(a.id)) { didUnlock = true; break; }
                }
            }
        } catch {}

        try {
            const container = document.querySelector('#salvageActionsContainer');
            for (const name of SITE_BUILDING_NAMES) {
                const b = (typeof buildings !== 'undefined') ? buildings.find(bb => bb.name === name) : null;
                if (b && b.isUnlocked) {
                    let exists = false;
                    if (container) exists = !!container.querySelector(`.image-button[data-building="${name}"]`);
                    if (!exists) { didUnlock = true; break; }
                }
            }
        } catch {}
    }

    runActionCompletionHandlers(original, completed, section);

    try {
        const container = document.querySelector('#salvageActionsContainer');
        for (const name of SITE_BUILDING_NAMES) {
            const b = (typeof buildings !== 'undefined') ? buildings.find(bb => bb.name === name) : null;
            if (b && b.isUnlocked) {
                let exists = false;
                if (container) exists = !!container.querySelector(`.image-button[data-building="${name}"]`);
                if (!exists) { didUnlock = true; break; }
            }
        }
    } catch {}

    // Clear active action and reset the UI for the completed action (in-place) unless we must rebuild
    setActiveCrashSiteAction(null);

    // If this completion unlocked new actions or enabled a section, rebuild the UI; otherwise update states in-place.
    if (didUnlock || (original && original.id === 'establishBaseCamp')) {
        setupCrashSiteSection(section);
    } else {
        const btn2 = section ? section.querySelector(`[data-action-id="${completed.id}"]`) : document.querySelector(`[data-action-id="${completed.id}"]`);
        if (btn2) {
            btn2.classList.remove('running');
            const bar2 = btn2.querySelector('.action-progress-bar'); if (bar2) bar2.style.width = '0%';
            const nameSpan2 = btn2.querySelector('.building-name'); if (nameSpan2) nameSpan2.textContent = (btn2.dataset.originalLabel || (original && original.name) || completed.name || '');
            delete btn2.dataset.originalLabel;
            const actionDef2 = salvageActions.find(s => s.id === completed.id) || original;
            if (actionDef2) { btn2.disabled = false; attachStartClickHandler(btn2, actionDef2, section); }
            if (original && !original.isUnlocked) {
                const removeBtn = section ? section.querySelector(`[data-action-id="${original.id}"]`) : document.querySelector(`[data-action-id="${original.id}"]`);
                if (removeBtn && removeBtn.parentElement) removeBtn.parentElement.removeChild(removeBtn);
            }
        }

        if (typeof updateCrashSiteActionButtonsState === 'function') updateCrashSiteActionButtonsState();
    }
}

// Pause/resume loop on global events
window.addEventListener('game-pause', () => {
    const active = getActiveCrashSiteAction();
    if (active) stopCrashSiteLoop();
});

window.addEventListener('game-resume', () => {
    const active = getActiveCrashSiteAction();
    if (!active) return;
    const container = document.querySelector('#salvageActionsContainer');
    const section = container ? container.closest('.content-panel') || container.parentElement : null;
    startCrashSiteLoop(section);
});

if (typeof window !== 'undefined') {
    window.setupCrashSiteSection = setupCrashSiteSection;
}

// Listen for resource discoveries and evaluate centralized unlock rules
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resourceDiscovered', () => {
        try {
            const unlocks = evaluateEventUnlocks({ type: 'resourceDiscovered' }, { resources, actions: salvageActions });
            let didUnlock = false;
            if (unlocks && Array.isArray(unlocks.actions) && unlocks.actions.length) {
                for (const id of unlocks.actions) {
                    const a = salvageActions.find(x => x.id === id || x.name === id);
                    if (a && !a.isUnlocked) {
                        a.isUnlocked = true;
                        addLogEntry(`New action available: ${a.name}`, LogType.UNLOCK);
                        didUnlock = true;
                    }
                }
            }
            if (didUnlock) {
                const container = document.querySelector('#salvageActionsContainer');
                if (container) {
                    const section = container.closest('.content-panel') || container.parentElement;
                    setupCrashSiteSection(section);
                }
            }
        } catch (e) { /* ignore */ }
    });
}

// Update action buttons' disabled/blocked state
export function updateCrashSiteActionButtonsState() {
    const container = document.querySelector('#salvageActionsContainer');
    if (!container) return;

    const buttons = container.querySelectorAll('.image-button[data-action-id]');
    buttons.forEach(btn => {
        const id = btn.dataset.actionId;
        if (!id) return;
        const action = salvageActions.find(a => a.id === id);
        if (!action) return;

        const canAfford = !!canAffordAction(action, resources);
    const { blocked: isBlocked, reason } = getBlockedStatus(action.id, { actions: salvageActions });

        const wasAffordable = btn.dataset.affordable === 'true';
        const wasBlocked = btn.dataset.blocked === 'true';

        if (wasAffordable !== canAfford) {
            btn.classList.toggle('unaffordable', !canAfford);
            if (!canAfford) {
                btn.setAttribute('aria-disabled', 'true');
                btn.dataset.shortfall = getAffordabilityShortfalls(action, resources).join(', ');
            } else {
                btn.removeAttribute('aria-disabled');
                delete btn.dataset.shortfall;
            }
            btn.dataset.affordable = canAfford ? 'true' : 'false';
        }

        if (wasBlocked !== isBlocked) {
            btn.classList.toggle('blocked-action', isBlocked);
            btn.dataset.blocked = isBlocked ? 'true' : 'false';
            if (isBlocked) btn.dataset.blockedReason = reason; else delete btn.dataset.blockedReason;
        }
    });
}