import { salvageActions } from '../data/actions.js';
import { resources } from '../resources.js';
import { addLogEntry, LogType } from '../log.js';
import { setActivatedSections, applyActivatedSections, showSection, getInitialActivatedSections, setupTooltip } from '../main.js';
import { storyEvents } from '../data/storyEvents.js';
import { showStoryPopup } from '../popup.js';

let salvageInterval = null;
let salvageStartTime = 0;
let currentSalvageAction = null;

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

            // THIS IS THE CORRECT HTML STRUCTURE FOR THE BUTTON
            button.innerHTML = `
                <div class="action-progress-bar"></div>
                <span class="building-name">${action.name}</span>
            `;
            
            button.onclick = () => startSalvage(action, section);
            
            // THIS IS THE CRUCIAL ID ATTRIBUTE THAT WAS MISSING
            button.dataset.actionId = action.id;
            
            setupTooltip(button, action);

            let canAfford = true;
            if (action.cost) {
                for (const cost of action.cost) {
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

function startSalvage(action, section) {
    if (salvageInterval) return;

    if (action.cost) {
        for (const cost of action.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) {
                addLogEntry(`Not enough ${cost.resource} to begin: ${action.name}.`, LogType.ERROR);
                return;
            }
        }
        for (const cost of action.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }
    }

    currentSalvageAction = action;
    salvageStartTime = Date.now();

    // MODIFIED: Disable all buttons instead of hiding the container
    section.querySelectorAll('.image-button').forEach(button => {
        button.disabled = true;
    });

    addLogEntry(`Started: ${action.name}.`, LogType.INFO);

    salvageInterval = setInterval(() => updateSalvageProgress(section), 100);
}

function updateSalvageProgress(section) {
    const elapsedTime = (Date.now() - salvageStartTime) / 1000;
    const progress = Math.min((elapsedTime / currentSalvageAction.duration) * 100, 100);

    // MODIFIED: Target the specific button's progress bar and text
    const activeButton = section.querySelector(`[data-action-id="${currentSalvageAction.id}"]`);
    if (activeButton) {
        const progressBar = activeButton.querySelector('.action-progress-bar');
        const textSpan = activeButton.querySelector('.building-name');
        
        progressBar.style.width = `${progress}%`;
        const remainingTime = Math.max(0, currentSalvageAction.duration - elapsedTime);
        textSpan.innerText = `${remainingTime.toFixed(1)}s`;
    }

    if (progress >= 100) {
        handleActionCompletion(section);
    }
}

function handleActionCompletion(section) {
    clearInterval(salvageInterval);
    salvageInterval = null;

    // Keep a reference to the action that just finished
    const completedAction = currentSalvageAction;
    currentSalvageAction = null;

    // --- 1. Process Resource Rewards ---
    if (completedAction.reward) {
        let rewardStrings = [];
        completedAction.reward.forEach(reward => {
            const resource = resources.find(r => r.name === reward.resource);
            if (resource) {
                let gainedAmount;
                if (Array.isArray(reward.amount)) {
                    // Handle random amount from a [min, max] range
                    gainedAmount = getRandomInt(reward.amount[0], reward.amount[1]);
                } else {
                    // Handle fixed amount
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

    // --- 2. Process Story and Unlock Rewards ---
    if (completedAction.stages) {
        // This is a multi-stage action like "Scout Surroundings"
        const currentStageData = completedAction.stages[completedAction.stage];

        if (currentStageData) {
            // Trigger the story for the current stage
            if (currentStageData.story) {
                showStoryPopup(storyEvents[currentStageData.story]);
				addLogEntry('New discovery made. (Click to read)', LogType.STORY, {
                    onClick: () => showStoryPopup(event)
				});	
            }
            // Process any unlocks for the current stage
            if (currentStageData.unlocks) {
                currentStageData.unlocks.forEach(actionId => {
                    const actionToUnlock = salvageActions.find(a => a.id === actionId);
                    if (actionToUnlock) {
                        actionToUnlock.isUnlocked = true;
                        addLogEntry(`New action available: ${actionToUnlock.name}`, LogType.UNLOCK);
                    }
                });
            }
            // Increment the stage for the next time this action is run
            completedAction.stage++;
        }
    }

    // --- 3. Check for End-of-Chapter Trigger ---
    if (completedAction.id === 'repairComms') {
        // If the main objective is complete, transition to the next chapter
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
        // --- 4. Redraw the UI ---
        // If the chapter is not over, just redraw the current section
        // This will show any newly unlocked buttons or hide completed ones
        setupCrashSiteSection(section);
    }
}