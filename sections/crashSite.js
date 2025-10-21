import { salvageActions } from '../data/actions.js';
import { resources } from '../resources.js';
import { addLogEntry, LogType } from '../log.js';
import { setActivatedSections, applyActivatedSections, showSection, getInitialActivatedSections, setupTooltip } from '../main.js';
import { storyEvents } from '../data/storyEvents.js';
import { showStoryPopup } from '../popup.js';
import { getActiveCrashSiteAction, setActiveCrashSiteAction } from '../data/activeActions.js';

let actionInterval = null;
let isPendingCancel = null; // Tracks which action ID is pending cancellation
let cancelTimeout = null;   // The timer for the confirmation window

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

    const availableActions = salvageActions.filter(action => {
        if (action.stages && action.stage >= action.stages.length) {
            return false;
        }
        return action.isUnlocked;
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

            buttonGroup.appendChild(button);
        });
        actionsContainer.appendChild(buttonGroup);
    });
}

function startAction(action, section) {
    if (actionInterval) return;

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

    // MODIFIED: Disable all buttons, then re-enable the active one as a cancel button
    section.querySelectorAll('.image-button').forEach(button => {
        button.disabled = true;
    });

    const activeButton = section.querySelector(`[data-action-id="${action.id}"]`);
    if (activeButton) {
        activeButton.disabled = false;
        // MODIFIED: The first click now requests a cancellation
        activeButton.onclick = () => requestCancel(action, section);
    }

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);
    actionInterval = setInterval(() => updateActionProgress(section, 0.1), 100);
}

function requestCancel(action, section) {
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

    if (activeAction.drain) {
        for (const drain of activeAction.drain) {
            const resource = resources.find(r => r.name === drain.resource);
            const drainPerSecond = drain.amount / activeAction.duration;
            const drainThisTick = drainPerSecond * intervalSeconds;
            
            if (resource.amount < drainThisTick) {
                cancelAction(section, `${activeAction.name} cancelled: Ran out of ${resource.name}.`);
                return;
            }
            resource.amount -= drainThisTick;
        }
    }

    const elapsedTime = (Date.now() - activeAction.startTime) / 1000;
    const progress = Math.min((elapsedTime / activeAction.duration) * 100, 100);
    const activeButton = section.querySelector(`[data-action-id="${activeAction.id}"]`);

    if (activeButton) {
        const progressBar = activeButton.querySelector('.action-progress-bar');
        const textSpan = activeButton.querySelector('.building-name');
        progressBar.style.width = `${progress}%`;
        const remainingTime = Math.max(0, activeAction.duration - elapsedTime);
        textSpan.innerText = `${remainingTime.toFixed(1)}s`;
    }

    if (progress >= 100) {
        handleActionCompletion(section);
    }
}

function cancelAction(section, message) {
    clearInterval(actionInterval);
    actionInterval = null;
	
	if (cancelTimeout) {
        clearTimeout(cancelTimeout);
        cancelTimeout = null;
    }
    isPendingCancel = null;

    const cancelledAction = getActiveCrashSiteAction();
    if (!cancelledAction) return;

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
            const amountDrained = drainPerSecond * elapsedTime;
            const refundAmount = Math.floor(amountDrained * 0.5);
            if (resource && refundAmount > 0) {
                resource.amount = Math.min(resource.amount + refundAmount, resource.capacity);
                refundedStrings.push(`${refundAmount} ${resource.name}`);
            }
        }
    }

    setActiveCrashSiteAction(null);

    addLogEntry(message, LogType.ERROR);
    if (refundedStrings.length > 0) {
        addLogEntry(`Refunded: ${refundedStrings.join(', ')}.`, LogType.INFO);
    }
    
    setupCrashSiteSection(section);
}

function handleActionCompletion(section) {
    clearInterval(actionInterval);
    actionInterval = null;
	
	if (cancelTimeout) {
        clearTimeout(cancelTimeout);
        cancelTimeout = null;
    }
    isPendingCancel = null;

    const completedAction = getActiveCrashSiteAction();
    setActiveCrashSiteAction(null);

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
        // MODIFIED: Find the original action object from our main data array
        const originalAction = salvageActions.find(a => a.id === completedAction.id);
        if (originalAction) {
            const currentStageData = originalAction.stages[originalAction.stage];
            if (currentStageData) {
                if (currentStageData.story) {
                    const event = storyEvents[currentStageData.story];
                    if (event) {
                        showStoryPopup(event);
                        addLogEntry(currentStageData.logText, LogType.STORY, {
                            onClick: () => showStoryPopup(event)
                        });
                    }
                }
                if (currentStageData.unlocks) {
                    currentStageData.unlocks.forEach(actionId => {
                        const actionToUnlock = salvageActions.find(a => a.id === actionId);
                        if (actionToUnlock) {
                            actionToUnlock.isUnlocked = true;
                            addLogEntry(`New action available: ${actionToUnlock.name}`, LogType.UNLOCK);
                        }
                    });
                }
                // MODIFIED: Increment the stage on the ORIGINAL action object
                originalAction.stage++;
            }
        }
    }

    if (completedAction.id === 'repairComms') {
        showStoryPopup(storyEvents.contactHQ);
        const stone = resources.find(r => r.name === 'Stone');
        if(stone) stone.isDiscovered = true;
        let currentSections = getInitialActivatedSections();
        currentSections.crashSiteSection = false;
        currentSections.colonySection = true;
        setActivatedSections(currentSections);
        applyActivatedSections();
        showSection('colonySection');
    } else {
        setupCrashSiteSection(section);
    }
}