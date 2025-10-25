import { salvageActions } from '../data/actions.js';
import { resources } from '../resources.js';
import { addLogEntry, LogType } from '../log.js';
import { setActivatedSections, applyActivatedSections, showSection, getInitialActivatedSections } from '../main.js';
import { setupTooltip } from '../tooltip.js';
import { storyEvents } from '../data/storyEvents.js';
import { showStoryPopup } from '../popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';

let actionInterval = null;
let isPendingCancel = null; // Tracks which action ID is pending cancellation
let cancelTimeout = null;   // The timer for the confirmation window

const __initialActionsSnapshot = {
    actions: (typeof actions !== 'undefined' && Array.isArray(actions)) ? JSON.parse(JSON.stringify(actions)) : null,
    salvageActions: (typeof salvageActions !== 'undefined' && Array.isArray(salvageActions)) ? JSON.parse(JSON.stringify(salvageActions)) : null
};

export function resetActionsToDefaults() {
    // restore `actions` if present
    if (__initialActionsSnapshot.actions && typeof actions !== 'undefined' && Array.isArray(actions)) {
        actions.length = 0;
        __initialActionsSnapshot.actions.forEach(a => actions.push(JSON.parse(JSON.stringify(a))));
    }
    // restore `salvageActions` if present
    if (__initialActionsSnapshot.salvageActions && typeof salvageActions !== 'undefined' && Array.isArray(salvageActions)) {
        salvageActions.length = 0;
        __initialActionsSnapshot.salvageActions.forEach(a => salvageActions.push(JSON.parse(JSON.stringify(a))));
    }
}

// --- NEW: Controlled loop start/stop and pause-awareness ---
export function startCrashSiteLoop(section) {
    if (actionInterval) return;
    // Try to find the section if not provided (safe fallback)
    if (!section) {
        const container = document.querySelector('#salvageActionsContainer');
        section = container ? container.closest('.content-panel') || container.parentElement : null;
    }

    const activeAction = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (!activeAction) return;

    // Clear any existing interval just in case
    if (actionInterval) {
        clearInterval(actionInterval);
        actionInterval = null;
    }

    // If the action was paused, resume time accounting by removing pause marker
    if (activeAction.pauseStart) {
        const pausedDuration = Date.now() - activeAction.pauseStart;
        activeAction.startTime = (activeAction.startTime || Date.now()) + pausedDuration;
        delete activeAction.pauseStart;
    }


    // Pass a scaled intervalSeconds so drains/progress per tick accelerate with window.TIME_SCALE.
    actionInterval = setInterval(() => {
        const scale = (window.TIME_SCALE || 1);
        updateActionProgress(section, 0.1 * scale);
    }, 100);
}

export function stopCrashSiteLoop() {
    if (actionInterval) {
        clearInterval(actionInterval);
        actionInterval = null;
    }

    // Mark pause start so resume adjusts startTime
    const activeAction = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (activeAction) {
        activeAction.pauseStart = Date.now();
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function setupCrashSiteSection(section) {
    if (!section) return;

    section.innerHTML = `
        <div class="content-panel">
            <h2>Crash Site</h2>
            <p>The wreckage of the exploration ship smolders at the edge of a dense forest. The priority is to assess the damage and salvage whatever you can.</p>
            <div id="salvageActionsContainer" style="margin-top: 20px;"></div>
        </div>
    `;

    const actionsContainer = section.querySelector('#salvageActionsContainer');
    actionsContainer.innerHTML = ''; 

    // UPDATED: allow repeatable actions to remain available even if their stages are exhausted
    const availableActions = salvageActions.filter(action => {
        const stageIndex = action.stage || 0;
        const totalStages = (action.stages || []).length;
        // If action has stages and stage index >= totalStages:
        if (totalStages > 0 && stageIndex >= totalStages) {
            // keep repeatable actions visible only if unlocked
            return !!action.repeatable && !!action.isUnlocked;
        }
        // otherwise show if unlocked
        return !!action.isUnlocked;
    });
    
    const categories = [...new Set(availableActions.map(action => action.category))];

    categories.forEach(category => {
        const categoryHeading = document.createElement('h3');
        categoryHeading.textContent = category;
        categoryHeading.className = 'category-heading';
        actionsContainer.appendChild(categoryHeading);

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';

        availableActions.filter(action => action.category === category).forEach(action => {
            const button = document.createElement('button');
            button.className = 'image-button';
            button.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${action.name}</span>
                <span class="cancel-text">Abort?</span>
            `;
            // Default click handler — may be overridden below for special blocking rules
            button.onclick = () => startAction(action, section);
            button.dataset.actionId = action.id;
            setupTooltip(button, action);
 
            let canAfford = true;
            if (action.cost || action.drain) {
                 const resourcesToDeduct = (action.cost || []).concat(action.drain || []);
                 for (const cost of resourcesToDeduct) {
                    const resource = resources.find(r => r.name === cost.resource);
                    if (!resource || resource.amount < cost.amount) {
                        canAfford = false;
                        break;
                    }
                }
            }
            if (!canAfford) {
                button.classList.add('unaffordable');
            }

            // Block access to certain high-priority routes until 'Investigate Nearby Sound' has been completed.
            const blockedUntilInvestigate = ['searchSouthCorridor','searchNorthCorridor','investigateBridge'];
            const investigateAction = salvageActions.find(a => a.id === 'investigateSound');
            const isInvestigateDone = !!(investigateAction && investigateAction.completed);
            if (blockedUntilInvestigate.includes(action.id) && !isInvestigateDone) {
                // visually block but keep clickable so we can show a helpful log message
                button.classList.add('blocked-investigate-sound');
                button.setAttribute('aria-disabled', 'true');
                button.onclick = (e) => {
                    // Prevent starting the action and give player guidance
                    e.preventDefault();
                    addLogEntry('You should investigate the nearby sound first — someone might be alive nearby. Try "Investigate Nearby Sound".', LogType.INFO);
                };
            }

            buttonGroup.appendChild(button);
        });
        actionsContainer.appendChild(buttonGroup);
    });
}

function startAction(action, section) {
     // Prevent starting if an action is already running
    const existing = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (existing) return;

    const resourcesToDeduct = (action.cost || []).concat(action.drain || []);
    for (const cost of resourcesToDeduct) {
        const resource = resources.find(r => r.name === cost.resource);
        if (!resource || resource.amount < cost.amount) {
            addLogEntry(`Not enough ${cost.resource} to begin: ${action.name}.`, LogType.ERROR);
            return;
        }
    }

    if (action.cost) {
        for (const cost of action.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }
    }

    setActiveCrashSiteAction({
        ...action,
        startTime: Date.now()
    });

    // Disable all buttons, then re-enable the active one as a cancel button
    section.querySelectorAll('.image-button').forEach(button => {
        button.disabled = true;
    });

    const activeButton = section.querySelector(`[data-action-id="${action.id}"]`);
     if (activeButton) {
        activeButton.disabled = false;
        // Only wire cancel request if the action is cancelable (default true)
        if (action.cancelable === false) {
            // visually indicate non-cancelable (optional)
            activeButton.classList.add('non-cancelable');
            activeButton.onclick = null;
        } else {
            activeButton.onclick = () => requestCancel(action, section);
        }
    }

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);

    // Start the controlled loop (handles pause/resume correctly)
    startCrashSiteLoop(section);
}

function requestCancel(action, section) {

    // If action is not cancelable, ignore and inform player
    if (action.cancelable === false) {
        addLogEntry(`${action.name} cannot be cancelled.`, LogType.INFO);
        return;
    }

    // If you click a second time while confirmation is pending, cancel immediately
    if (isPendingCancel === action.id) {
        clearTimeout(cancelTimeout);
        cancelAction(section, `${action.name} cancelled by user.`);
        return;
    }

    // On the first click, show the confirmation
    isPendingCancel = action.id;
    const activeButton = section.querySelector(`[data-action-id="${action.id}"]`);
    if (activeButton) {
        activeButton.classList.add('confirm-cancel');
    }

    // Set a timer to automatically revert if not clicked again
    cancelTimeout = setTimeout(() => {
        if (activeButton) {
            activeButton.classList.remove('confirm-cancel');
        }
        isPendingCancel = null;
        cancelTimeout = null;
    }, 2000); // 2-second window to confirm
}

function updateActionProgress(section, intervalSeconds) {
    const activeAction = getActiveCrashSiteAction();
    if (!activeAction) return;

    // Determine survival debuff multiplier from resources
    const foodRes = resources.find(r => r.name === 'Food Rations');
    const waterRes = resources.find(r => r.name === 'Clean Water');
    let debuffMultiplier = 1;
    if (foodRes && foodRes.amount <= 0) debuffMultiplier *= 1.5;
    if (waterRes && waterRes.amount <= 0) debuffMultiplier *= 1.5;

    // Notify player once per-action when debuff is affecting it
    if (debuffMultiplier > 1 && !activeAction._debuffNotified) {
        addLogEntry('You are weakened by lack of food/water — actions take longer and consume more.', LogType.INFO);
        activeAction._debuffNotified = true;
    }
    if (debuffMultiplier === 1 && activeAction._debuffNotified) {
        // clear the per-action flag when debuff no longer applies so future runs notify again if needed
        delete activeAction._debuffNotified;
    }

    // Apply drains scaled to effective duration (so drains last the full effective duration)
    if (activeAction.drain) {
        for (const drain of activeAction.drain) {
            const resource = resources.find(r => r.name === drain.resource);
            const effectiveDuration = Math.max(0.001, (activeAction.duration || 1) * debuffMultiplier);
            const drainPerSecond = drain.amount / effectiveDuration;
            const drainThisTick = drainPerSecond * intervalSeconds;

            if (resource.amount < drainThisTick) {
                cancelAction(section, `${activeAction.name} cancelled: Ran out of ${resource.name}.`);
                return;
            }
            resource.amount -= drainThisTick;
        }
    }

    const effectiveDuration = Math.max(0.001, (activeAction.duration || 1) * debuffMultiplier);
    // Scale elapsedTime by the global debug TIME_SCALE so actions speed up when TIME_SCALE > 1
    const elapsedTime = ((Date.now() - activeAction.startTime) / 1000) * (window.TIME_SCALE || 1);
    const progress = Math.min((elapsedTime / effectiveDuration) * 100, 100);
    const activeButton = section.querySelector(`[data-action-id="${activeAction.id}"]`);

    if (activeButton) {
        const progressBar = activeButton.querySelector('.action-progress-bar');
        const textSpan = activeButton.querySelector('.building-name');
        progressBar.style.width = `${progress}%`;
        const remainingTime = Math.max(0, effectiveDuration - elapsedTime);
        textSpan.innerText = `${remainingTime.toFixed(1)}s`;
    }

    if (progress >= 100) {
        handleActionCompletion(section);
    }
}

function cancelAction(section, message) {
    const cancelledAction = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (!cancelledAction) return;

    // If action is not cancelable, do nothing
    if (cancelledAction.cancelable === false) {
        addLogEntry(`${cancelledAction.name} cannot be cancelled.`, LogType.INFO);
        return;
    }

    // Stop the loop and clear any pending cancel marker
    stopCrashSiteLoop();

    if (cancelTimeout) {
        clearTimeout(cancelTimeout);
        cancelTimeout = null;
    }
    isPendingCancel = null;

    // --- Refund Logic ---
    let refundedStrings = [];
    // Refund 50% of initial costs
    if (cancelledAction.cost) {
        for (const cost of cancelledAction.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            const refundAmount = Math.floor(cost.amount * 0.5);
            if (resource && refundAmount > 0) {
                resource.amount = Math.min(resource.amount + refundAmount, resource.capacity);
                refundedStrings.push(`${refundAmount} ${resource.name}`);
            }
        }
    }
    // Refund 50% of resources drained so far
    if (cancelledAction.drain) {
        const elapsedTime = (Date.now() - cancelledAction.startTime) / 1000;
        for (const drain of cancelledAction.drain) {
            const resource = resources.find(r => r.name === drain.resource);
            const drainPerSecond = drain.amount / cancelledAction.duration;
            const amountDrained = drainPerSecond * Math.max(0, Math.min(elapsedTime, cancelledAction.duration));
            const refundAmount = Math.floor(amountDrained * 0.5);
            if (resource && refundAmount > 0) {
                resource.amount = Math.min(resource.amount + refundAmount, resource.capacity);
                refundedStrings.push(`${refundAmount} ${resource.name}`);
            }
        }
    }

    // Clear pause marker if present
    if (cancelledAction.pauseStart) {
        delete cancelledAction.pauseStart;
    }

    if (typeof setActiveCrashSiteAction === 'function') {
        setActiveCrashSiteAction(null);
    }

    addLogEntry(message, LogType.ERROR);
    if (refundedStrings.length > 0) {
        addLogEntry(`Refunded: ${refundedStrings.join(', ')}.`, LogType.INFO);
    }

    setupCrashSiteSection(section);
}

function handleActionCompletion(section) {
    // Stop the loop
    stopCrashSiteLoop();

    if (cancelTimeout) {
        clearTimeout(cancelTimeout);
        cancelTimeout = null;
    }
    isPendingCancel = null;

    const completedAction = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (!completedAction) return;

    // Clear pause marker if present
    if (completedAction.pauseStart) {
        delete completedAction.pauseStart;
    }

    if (typeof setActiveCrashSiteAction === 'function') {
        setActiveCrashSiteAction(null);
    }

    if (completedAction.reward) {
        let rewardStrings = [];
        completedAction.reward.forEach(reward => {
            const resource = resources.find(r => r.name === reward.resource);
            if (resource) {
                let gainedAmount;
                if (Array.isArray(reward.amount)) {
                    gainedAmount = getRandomInt(reward.amount[0], reward.amount[1]);
                } else {
                    gainedAmount = reward.amount;
                }
                resource.amount = Math.min(resource.amount + gainedAmount, resource.capacity);
                rewardStrings.push(`${gainedAmount} ${reward.resource}`);
            }
        });
        addLogEntry(`${completedAction.name} complete! Gained: ${rewardStrings.join(', ')}.`, LogType.SUCCESS);
    } else {
        addLogEntry(`${completedAction.name} complete!`, LogType.SUCCESS);
    }

 if (completedAction.stages) {
        // Find the original action object from the shared actions array
        const originalAction = salvageActions.find(a => a.id === completedAction.id || a.name === completedAction.name);
        if (originalAction) {
            // Mark as completed for conditional checks elsewhere
            originalAction.completed = true;

            // --- Run the next stage (each completion advances the stage index) ---
            const currentStageIndex = originalAction.stage || 0;
            const stageData = (originalAction.stages || [])[currentStageIndex];
            if (stageData) {
                // Story popup (if defined)
                if (stageData.story) {
                    const event = storyEvents[stageData.story];
                    if (event) {
                        showStoryPopup(event);
                        addLogEntry(stageData.logText || '', LogType.STORY, {
                            onClick: () => showStoryPopup(event)
                        });
                    }
                }
                // Log text only if no story to show
                if (!stageData.story && stageData.logText) {
                    try {
                        addLogEntry(stageData.logText, LogType.STORY);
                    } catch (e) { /* ignore logging errors */ }
                }

                // Unlock actions listed for this stage
                if (Array.isArray(stageData.unlocks)) {
                    stageData.unlocks.forEach(actionId => {
                        const actionToUnlock = salvageActions.find(a => a.id === actionId || (a.name && a.name === actionId));
                        if (actionToUnlock && !actionToUnlock.isUnlocked) {
                            actionToUnlock.isUnlocked = true;
                            addLogEntry(`New action available: ${actionToUnlock.name}`, LogType.UNLOCK);
        }
                    });
                }

                // advance stage index but clamp to totalStages to avoid overflow
                const totalStages = (originalAction.stages || []).length;
                originalAction.stage = Math.min(currentStageIndex + 1, totalStages);

                // If we've reached or passed the last stage:
                if (originalAction.stage >= totalStages) {
                    if (originalAction.repeatable) {
                        // keep it visible for further uses; stage is clamped to totalStages
                        originalAction.isUnlocked = true;
                        originalAction.stage = totalStages;
                    } else {
                        // hide if not repeatable and no more stages
                        originalAction.isUnlocked = false;
                    }
                }
            }
        }
    }

    setupCrashSiteSection(section);
};    

// --- NEW: Global pause/resume handlers so the module reacts to main.js events ---
window.addEventListener('game-pause', () => {
    // Only pause the crash-site loop if an action is active
    const active = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (active) {
        stopCrashSiteLoop();
    }
});

window.addEventListener('game-resume', () => {
    const active = typeof getActiveCrashSiteAction === 'function' ? getActiveCrashSiteAction() : null;
    if (!active) return;

    // Find section DOM to pass to the loop starter
    const container = document.querySelector('#salvageActionsContainer');
    const section = container ? container.closest('.content-panel') || container.parentElement : null;
    // startCrashSiteLoop will adjust startTime using pauseStart if present
    startCrashSiteLoop(section);
});



