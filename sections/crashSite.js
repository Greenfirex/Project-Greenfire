import { salvageActions } from '../data/actions.js';
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

function canAffordAction(action) {
    if (!action) return false;
    const required = {};
    if (action.cost) {
        for (const c of action.cost) {
            required[c.resource] = (required[c.resource] || 0) + c.amount;
        }
    }
    if (action.drain) {
        for (const d of action.drain) {
            required[d.resource] = (required[d.resource] || 0) + d.amount;
        }
    }
    for (const resourceName in required) {
        const res = resources.find(r => r.name === resourceName);
        if (!res || res.amount < required[resourceName]) return false;
    }
    return true;
}

function getAffordabilityShortfalls(action) {
    const shortfalls = [];
    if (!action) return shortfalls;

    const required = {};
    if (action.cost) {
        for (const c of action.cost) required[c.resource] = (required[c.resource] || 0) + c.amount;
    }
    if (action.drain) {
        for (const d of action.drain) required[d.resource] = (required[d.resource] || 0) + d.amount;
    }

    for (const resourceName in required) {
        const res = resources.find(r => r.name === resourceName);
        const have = res ? res.amount : 0;
        const need = required[resourceName];
        if (!res) {
            shortfalls.push(`${resourceName} missing (need ${need})`);
        } else if (have < need) {
            shortfalls.push(`${resourceName}: need ${Math.ceil(need - have)} more`);
        }
    }
    return shortfalls;
}

let actionInterval = null;
let isPendingCancel = null;
let cancelTimeout = null;

export function startCrashSiteLoop(section = null) {
    if (actionInterval) return;

    // Respect global paused state persisted in localStorage
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry('Cannot resume crash site loop while game is paused.', LogType.INFO);
            return;
        }
    } catch (e) { /* ignore localStorage errors */ }

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

function getRandomInt(min, max) {
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function setupCrashSiteSection(section) {
    // if caller didn't supply a section, locate the crash-site container in the DOM
    if (!section) {
        const container = document.querySelector('#salvageActionsContainer');
        section = container ? container.closest('.content-panel') || container.parentElement : null;
    }
    if (!section) return;
    // Ensure we target a single .content-panel element (avoid nesting panels)
    let targetPanel;
    if (section.classList && section.classList.contains('content-panel')) {
        // caller passed the panel itself — reuse it
        targetPanel = section;
        targetPanel.innerHTML = '';
    } else {
        // caller passed a wrapper: reuse existing child panel if present, otherwise create one
        targetPanel = section.querySelector('.content-panel');
        if (!targetPanel) {
            targetPanel = document.createElement('div');
            targetPanel.className = 'content-panel';
            section.appendChild(targetPanel);
        } else {
            targetPanel.innerHTML = '';
        }
    }

    // From here on, treat `section` as the panel element so rest of function works unchanged
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

    const categories = [...new Set(availableActions.map(a => a.category))].filter(c => c !== 'Construction');

    categories.forEach(category => {
        const h = document.createElement('h3');
        h.textContent = category;
        h.className = 'category-heading';
        actionsContainer.appendChild(h);

        const group = document.createElement('div');
        group.className = 'button-group';

        availableActions.filter(a => a.category === category).forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'image-button';
            btn.dataset.actionId = action.id;
            btn.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${action.name}</span>
                <span class="cancel-text">Abort?</span>
            `;

            setupTooltip(btn, action);

            const canAfford = canAffordAction(action);
            if (!canAfford) {
                btn.classList.add('unaffordable');
                btn.setAttribute('aria-disabled', 'true');
                // do not set title (native tooltip); store as data for debug/inspection if needed
                btn.dataset.shortfall = getAffordabilityShortfalls(action).join(', ');
            } else {
                btn.classList.remove('unaffordable');
                btn.removeAttribute('aria-disabled');
                delete btn.dataset.shortfall;
            }

            // Block certain exploration actions until investigating / basecamp progress.
            // Requires salvageActions to be available in this module (import if needed).
            const blocked = ['searchSouthCorridor','searchNorthCorridor','investigateBridge'];
            const investigateAction = salvageActions.find(a => a.id === 'investigateSound');
            const basecampAction = salvageActions.find(a => a.id === 'establishBaseCamp');
            const isInvestigateDone = !!(investigateAction && investigateAction.completed);
            const isBasecampDone = !!(basecampAction && basecampAction.completed);

            const blockedByInvestigate = blocked.includes(action.id) && !isInvestigateDone;
            const blockedByBasecamp = blocked.includes(action.id) && isInvestigateDone && !isBasecampDone;
            if (blockedByInvestigate || blockedByBasecamp) {
                btn.classList.add('blocked-action');        // style this class in CSS
                btn.setAttribute('aria-disabled', 'true');
                // Avoid setting native title. Store message in data attribute instead.
                btn.dataset.blockedReason = blockedByInvestigate
                    ? 'Investigate Nearby Sound first — someone might be alive nearby.'
                    : 'You found survivors — secure a base camp first before exploring deeper.';
            } else {
                delete btn.dataset.blockedReason;
            }

            btn.onclick = (e) => {
                // Recompute investigate/basecamp state at click time (avoid stale closure captures)
                const investigateActionNow = salvageActions.find(a => a.id === 'investigateSound');
                const basecampActionNow = salvageActions.find(a => a.id === 'establishBaseCamp');
                const isInvestigateDoneNow = !!(investigateActionNow && investigateActionNow.completed);
                const isBasecampDoneNow = !!(basecampActionNow && basecampActionNow.completed);

                if (blocked.includes(action.id) && !isInvestigateDoneNow) {
                    e.preventDefault();
                    addLogEntry('You should investigate the nearby sound first — someone might be alive nearby. Try "Investigate Nearby Sound".', LogType.INFO);
                    return;
                }
                if (blocked.includes(action.id) && isInvestigateDoneNow && !isBasecampDoneNow) {
                    e.preventDefault();
                    addLogEntry('You found survivors — secure a base camp first before exploring deeper. Try "Establish Base Camp".', LogType.INFO);
                    return;
                }

                const shortfalls = getAffordabilityShortfalls(action);
                if (shortfalls.length > 0) {
                    e.preventDefault();
                    addLogEntry(`Cannot start "${action.name}": ${shortfalls.join('; ')}`, LogType.INFO);
                    return;
                }
                startAction(action, section);
            };

            group.appendChild(btn);
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
    const siteBuildings = buildings.filter(b => ['Foraging Camp', 'Water Station', 'Rain Tarp', 'Food Larder', 'Water Reservoir'].includes(b.name) && b.isUnlocked === true);

    siteBuildings.forEach(bld => {
        createBuildingButton(bld, buildGroup);
        const btn = buildGroup.querySelector(`.image-button[data-building="${bld.name}"]`);
        if (btn) {
            const nameSpan = btn.querySelector('.building-name');
            if (nameSpan) nameSpan.textContent = bld.name;
            const countSpan = btn.querySelector('.building-count');
            if (countSpan) countSpan.textContent = `(${bld.count})`;
        }
    });

    if (buildGroup.children.length > 0) {
        if (typeof updateBuildingButtonsState === 'function') updateBuildingButtonsState();
        constructionWrapper.appendChild(buildGroup);
        actionsContainer.appendChild(constructionWrapper);
    }
}

function startAction(action, section) {
    const existing = getActiveCrashSiteAction();
    if (existing) return;

    // Prevent starting actions when game is paused
    try {
        if (localStorage.getItem('gamePaused') === 'true') {
            addLogEntry(`Cannot start "${action.name}" while game is paused. Resume the game first.`, LogType.INFO);
            return;
        }
    } catch (e) { /* ignore localStorage errors */ }

    if (!canAffordAction(action)) {
        addLogEntry(`Not enough resources to begin: ${action.name}.`, LogType.ERROR);
        return;
    }
    const upfront = action.cost || [];
    upfront.forEach(cost => {
        const r = resources.find(x => x.name === cost.resource);
        if (r) r.amount -= cost.amount;
    });
    // immediately refresh tooltip so ETA/shortfall updates while tooltip remains visible
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

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

    setActiveCrashSiteAction({
        ...JSON.parse(JSON.stringify(action)),
        startTime: Date.now(),
        lastTickTime: Date.now(),
        elapsed: 0
    });

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);
    startCrashSiteLoop(section);
}

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

function updateActionProgress(section) {
    const a = getActiveCrashSiteAction();
    if (!a) return;

    const now = Date.now();
    const rawDelta = Math.max(0, Math.min((now - (a.lastTickTime || now)) / 1000, 0.25));
    a.lastTickTime = now;

    const timeScale = (window.TIME_SCALE || 1);
    const delta = rawDelta * timeScale;

    const food = resources.find(r => r.name === 'Food Rations');
    const water = resources.find(r => r.name === 'Clean Water');
    let debuff = 1;
    if (food && food.amount <= 0) debuff *= 1.5;
    if (water && water.amount <= 0) debuff *= 1.5;

    const effectiveDuration = Math.max(0.001, (a.duration || 1) * debuff);

    // Drain is handled centrally by the main loop (computeResourceRates + main.js).
    // Here we only check for depletion and cancel if the resource is exhausted.
    if (a.drain) {
        for (const d of a.drain) {
            const res = resources.find(r => r.name === d.resource);
            if (!res) continue;
            if (res.amount <= 0) {
                // Force-cancel when required resource is depleted (do not rely on action.cancelable)
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

function cancelAction(section, message, force = false) {
    const a = getActiveCrashSiteAction();
    if (!a) return;
    // if not forced, obey the cancelable flag
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
    // refresh tooltip after refunds so ETA/shortfall updates immediately
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

    if (a.drain) {
        // compute effective duration same as during progress so refunds match actual drained amount
        const food = resources.find(r => r.name === 'Food Rations');
        const water = resources.find(r => r.name === 'Clean Water');
        let debuff = 1;
        if (food && food.amount <= 0) debuff *= 1.5;
        if (water && water.amount <= 0) debuff *= 1.5;
        const effectiveDuration = Math.max(0.001, (a.duration || 1) * debuff);
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
    setupCrashSiteSection(section);
}

function handleActionCompletion(section) {
    stopCrashSiteLoop();
    if (cancelTimeout) { clearTimeout(cancelTimeout); cancelTimeout = null; }
    isPendingCancel = null;

    const completed = getActiveCrashSiteAction();
    if (!completed) return;

    if (completed.reward) {
        const gains = [];
        completed.reward.forEach(rw => {
            const res = resources.find(r => r.name === rw.resource);
            if (!res) return;
            const amt = Array.isArray(rw.amount) ? getRandomInt(rw.amount[0], rw.amount[1]) : rw.amount;
            // if the cafeteria cooker upgrade is installed, boost food/water rewards
            let finalAmt = amt;
            if (gameFlags.cafeteriaCookerInstalled && (rw.resource === 'Food Rations' || rw.resource === 'Clean Water')) {
                finalAmt = Math.floor(amt * 1.4);
            }
            // apply tents bonus for Rest -> Energy reward (20%)
            // note: this only boosts the Energy reward when completing the Rest action
            if (gameFlags.tentsInstalled && rw.resource === 'Energy' && completed.id === 'rest') {
                finalAmt = Math.floor(finalAmt * 1.2);
            }
            res.amount = Math.min(res.amount + finalAmt, res.capacity);
            gains.push(`${finalAmt} ${rw.resource}`);
        });
        addLogEntry(`${completed.name} complete! Gained: ${gains.join(', ')}.`, LogType.SUCCESS);
    } else {
        addLogEntry(`${completed.name} complete!`, LogType.SUCCESS);
    }
    // ensure tooltip updates after rewards are applied
    try { refreshCurrentTooltip(); } catch (e) { /* ignore */ }

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

    // Run registered, minimal handlers for action completion (flags, unlocks, UI)
    runActionCompletionHandlers(original, completed, section);
    setActiveCrashSiteAction(null);
    setupCrashSiteSection(section);
}

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

// expose the section setup function globally so other modules (colony.js) can refresh UI
if (typeof window !== 'undefined') {
    window.setupCrashSiteSection = setupCrashSiteSection;
}

// Idempotent updater: refresh action button states without rebuilding DOM.
// Call this periodically (e.g. from main loop) to keep buttons in-sync with resource drains.
export function updateCrashSiteActionButtonsState() {
    try {
        const container = document.querySelector('#salvageActionsContainer');
        if (!container) return;

        // Determine global investigation/basecamp state used by blocked rules
        const investigateAction = salvageActions.find(a => a.id === 'investigateSound');
        const basecampAction = salvageActions.find(a => a.id === 'establishBaseCamp');
        const isInvestigateDone = !!(investigateAction && investigateAction.completed);
        const isBasecampDone = !!(basecampAction && basecampAction.completed);
        const blocked = ['searchSouthCorridor','searchNorthCorridor','investigateBridge'];

        const buttons = container.querySelectorAll('.image-button[data-action-id]');
        buttons.forEach(btn => {
            const aid = btn.dataset.actionId;
            if (!aid) return;
            const action = salvageActions.find(a => a.id === aid);
            if (!action) return;

            // blocked state (investigate / basecamp gating)
            const blockedByInvestigate = blocked.includes(action.id) && !isInvestigateDone;
            const blockedByBasecamp = blocked.includes(action.id) && isInvestigateDone && !isBasecampDone;

            if (blockedByInvestigate || blockedByBasecamp) {
                btn.classList.add('blocked-action');
                btn.setAttribute('aria-disabled', 'true');
                // do NOT set `disabled` here so clicks still fire and the click handler
                // can produce an explanatory log entry for the player
                btn.dataset.blockedReason = blockedByInvestigate
                    ? 'Investigate Nearby Sound first — someone might be alive nearby.'
                    : 'You found survivors — secure a base camp first before exploring deeper.';
                return; // blocked overrides affordability
            } else {
                delete btn.dataset.blockedReason;
            }

            // affordability
            const affordable = canAffordAction(action);
            if (!affordable) {
                const shortfalls = getAffordabilityShortfalls(action);
                btn.classList.add('unaffordable');
                btn.setAttribute('aria-disabled', 'true');
                // keep button enabled so click still triggers the handler and logs the reason
                if (shortfalls && shortfalls.length) btn.title = shortfalls.join('; ');
            } else {
                btn.classList.remove('unaffordable');
                btn.removeAttribute('aria-disabled');
                // restore a sensible title (action name) if previously replaced
                if (!btn.dataset.originalTitle) {
                    btn.dataset.originalTitle = btn.title || '';
                }
                if (btn.dataset.originalTitle) btn.title = btn.dataset.originalTitle;
            }
        });
    } catch (err) {
        // Do not throw from the updater; it's best-effort
        // console.debug('updateCrashSiteActionButtonsState error', err);
    }
}