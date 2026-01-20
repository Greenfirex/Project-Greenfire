import { addLogEntry, LogType } from '../core/ingameLog.js';
import { technologies } from '../data/definitions/technologies.js';
import { activatedSections, setActivatedSections, applyActivatedSections, setColonyMenuNewItemFlag } from '../core/main.js';
import { setupTooltip, hideTooltip } from '../ui/panels/tooltip.js';
import { setupColonySection } from './colony.js';
import { resources, computeResourceRates, updateResourceInfo } from '../core/resources.js';
import { buildings } from '../data/definitions/buildings.js';
import { gameFlags } from '../data/gameFlags.js';
import { newBadgeHtml, wireClearUiNewBadge } from '../ui/components/uiNew.js';
import { showStoryPopup } from '../ui/panels/popup.js';
import { storyEvents } from '../data/definitions/storyEvents.js';

export let currentResearchingTech = null;
export let researchInterval = null;
export let currentResearchDuration = 0;
export let currentResearchStartTime = 0;
export let researchProgress = 0;
// Track scaled (in-game) elapsed time so TIME_SCALE affects research speed.
export let currentResearchElapsedSec = 0;
export let currentResearchLastTickAt = 0;

const createdTechButtons = new Set();

let researchDomScope = null;

function getResearchScope() {
    return researchDomScope || document;
}

export function getResearchInterval() {
    return researchInterval;
}

export function setResearchInterval(interval) {
    researchInterval = interval;
}

export function getResearchProgress() {
    return researchProgress;
}

export function setResearchProgress(progress) {
    researchProgress = progress;
}

export function getCurrentResearchingTech() {
    return currentResearchingTech;
}

export function setCurrentResearchingTech(tech) {
    currentResearchingTech = tech;
}

export function getCurrentResearchStartTime() {
    return currentResearchStartTime;
}

export function setCurrentResearchStartTime(time) {
    currentResearchStartTime = time;
}

export function getCurrentResearchElapsedSec() {
    return currentResearchElapsedSec;
}

export function setCurrentResearchElapsedSec(sec) {
    currentResearchElapsedSec = sec;
}

export function getCurrentResearchLastTickAt() {
    return currentResearchLastTickAt;
}

export function setCurrentResearchLastTickAt(ts) {
    currentResearchLastTickAt = ts;
}

function createTechButton(name, onClick, container, tooltipData) {
    const button = document.createElement('button');
    button.className = 'tech-button';
    button.dataset.tech = name;
    button.innerHTML = `
        <span class="tech-button-label">${name}</span>
        ${newBadgeHtml(!!tooltipData?.uiNew)}
    `;
    button.addEventListener('click', onClick);

    if (tooltipData) {
        setupTooltip(button, tooltipData);
    }

    // Clear "new" badge after the player notices the button (persist quietly).
    if (tooltipData?.uiNew) wireClearUiNewBadge(button, { legacyObj: tooltipData, legacyProp: 'uiNew' });

    container.appendChild(button);
}

export function updateTechButtonsState() {
    // Find all visible tech buttons (scope to the research section)
    const techButtons = getResearchScope().querySelectorAll('.tech-button');

    techButtons.forEach(button => {
        const techName = button.dataset.tech;
        const tech = technologies.find(t => t.name === techName);
        if (!tech || !tech.cost) { return; }

        // Check if player can afford it
        let canAfford = true;
        for (const cost of tech.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) {
                canAfford = false;
                break;
            }
        }

        // Add or remove the 'unaffordable' class
        if (canAfford) {
            button.classList.remove('unaffordable');
        } else {
            button.classList.add('unaffordable');
        }
    });
}

export function setupResearchSection(researchSection) {
    if (!researchSection) {
        researchSection = document.getElementById('researchSection');
    }
    if (!researchSection) { return; }

    // Remember which tab is currently active
    let activeTabName = 'available';
    const currentActiveTab = researchSection.querySelector('.tab.active');
    if (currentActiveTab && currentActiveTab.textContent === 'Researched Tech') {
        activeTabName = 'researched';
    }

    researchSection.innerHTML = '';
    researchSection.classList.add('research-bg');

    // Standard section framing used across the game
    const contentPanel = document.createElement('div');
    contentPanel.className = 'content-panel';
    const sectionInner = document.createElement('div');
    sectionInner.className = 'section-inner research-section';
    contentPanel.appendChild(sectionInner);
    researchSection.appendChild(contentPanel);
    researchDomScope = sectionInner;

    // --- Block 1: Create the Progress Bar ---
    const progressBarContainer = document.createElement('div');
    progressBarContainer.className = 'progress-bar-container';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    const progressInfo = document.createElement('div');
    progressInfo.className = 'progress-info';
    const progressText = document.createElement('p');
    progressText.className = 'progress-text';
    progressText.style.display = 'none';
    progressText.innerText = 'Researching...';
    progressInfo.appendChild(progressText);
    const cancelButton = document.createElement('button');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel Research';
    cancelButton.style.display = 'none';
    setupTooltip(cancelButton, 'Cancels research and refunds 50% of the cost.');
    cancelButton.addEventListener('click', cancelResearch);
    progressInfo.appendChild(cancelButton);
    progressBarContainer.appendChild(progressBar);
    progressBarContainer.appendChild(progressInfo);
    sectionInner.appendChild(progressBarContainer);

    // --- Block 2: Create the Tabs ---
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';
    const availableTab = document.createElement('button');
    availableTab.className = 'tab';
    availableTab.textContent = 'Available Tech';
    availableTab.addEventListener('click', () => showTab('available'));
    const researchedTab = document.createElement('button');
    researchedTab.className = 'tab';
    researchedTab.textContent = 'Researched Tech';
    researchedTab.addEventListener('click', () => showTab('researched'));
    tabContainer.appendChild(availableTab);
    tabContainer.appendChild(researchedTab);
    sectionInner.appendChild(tabContainer);

    // --- NEW: A wrapper for the tab content ---
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'tech-content-wrapper';

    // --- Block 3: Create the Content Panels ---
    const availableContainer = document.createElement('div');
    availableContainer.className = 'tech-container available';
    const researchedContainer = document.createElement('div');
    researchedContainer.className = 'tech-container researched';

    const categories = ['Mining Tech', 'Bio Tech', 'Social Tech'];

    // Logic for the "Available Tech" tab
    categories.forEach(category => {
        const categoryTechs = technologies.filter(tech => tech.category === category && !tech.isResearched);
        if (categoryTechs.length > 0) {
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'category-container';
            const categoryHeading = document.createElement('h3');
            categoryHeading.className = 'category-heading';
            categoryHeading.textContent = category;
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'button-group';
            let hasVisibleTechs = false;
            categoryTechs.forEach(tech => {
                const allPrerequisitesResearched = tech.prerequisites.every(prereq => {
                    const preTech = technologies.find(t => t.name === prereq);
                    return preTech && preTech.isResearched;
                });
                if (allPrerequisitesResearched) {
                    createTechButton(tech.name, () => startResearch(tech, cancelButton), buttonGroup, tech);
                    hasVisibleTechs = true;
                }
            });
            if (hasVisibleTechs) {
                categoryContainer.appendChild(categoryHeading);
                categoryContainer.appendChild(buttonGroup);
                availableContainer.appendChild(categoryContainer);
            }
        }
    });

    // Logic for the "Researched Tech" tab
    categories.forEach(category => {
        const researchedTechsInCategory = technologies.filter(tech =>
            tech.category === category && tech.isResearched
        );
        if (researchedTechsInCategory.length > 0) {
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'category-container';
            const categoryHeading = document.createElement('h3');
            categoryHeading.className = 'category-heading';
            categoryHeading.textContent = category;
            categoryContainer.appendChild(categoryHeading);
            researchedTechsInCategory.forEach(tech => {
                const techElement = document.createElement('p');
                techElement.className = 'researched-tech-name';
                techElement.textContent = tech.name;
                setupTooltip(techElement, tech);
                categoryContainer.appendChild(techElement);
            });
            researchedContainer.appendChild(categoryContainer);
        }
    });

    // Append panels to the new wrapper
    contentWrapper.appendChild(availableContainer);
    contentWrapper.appendChild(researchedContainer);
    // Append the wrapper to the main section
    sectionInner.appendChild(contentWrapper);

    // Restore the correct active tab
    showTab(activeTabName);

    if (currentResearchingTech) {
        updateProgressBar(cancelButton);
        getResearchScope().querySelectorAll('.tech-button').forEach(button => button.disabled = true);
        if (cancelButton) cancelButton.style.display = 'inline-block';
    }
    updateTechButtonsState();
}

function showTab(tabName) {
    // --- MODIFIED: This function now uses a '.visible' class for content ---
    const scope = getResearchScope();
    const availableContainer = scope.querySelector('.tech-container.available');
    const researchedContainer = scope.querySelector('.tech-container.researched');
    const availableTab = scope.querySelector('.tab-container .tab:nth-child(1)');
    const researchedTab = scope.querySelector('.tab-container .tab:nth-child(2)');

    if (!availableContainer || !researchedContainer || !availableTab || !researchedTab) return;

    if (tabName === 'available') {
        availableContainer.classList.add('visible');
        researchedContainer.classList.remove('visible');
        availableTab.classList.add('active');
        researchedTab.classList.remove('active');
    } else {
        availableContainer.classList.remove('visible');
        researchedContainer.classList.add('visible');
        availableTab.classList.remove('active');
        researchedTab.classList.add('active');
    }
}

function updateProgressBar(cancelButton) {
    const scope = getResearchScope();
    const progressBar = scope.querySelector('.progress-bar');
    const progressText = scope.querySelector('.progress-text');

    if (!getCurrentResearchingTech()) {
        if (progressBar && progressText) {
            progressBar.style.width = '0%';
            progressText.style.display = 'none';
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }
        }
        return;
    }

    if (progressBar && progressText) {
        const elapsedTime = Math.max(0, Number(getCurrentResearchElapsedSec()) || 0);
        const totalDuration = currentResearchDuration || 1;
        const progress = Math.min((elapsedTime / totalDuration) * 100, 100);
        setResearchProgress(progress);

        progressText.style.display = 'block';
        progressBar.style.width = `${researchProgress}%`;

        const remainingTime = Math.max(0, totalDuration - elapsedTime);
        progressText.innerText = `${getCurrentResearchingTech()}: ${remainingTime.toFixed(0)}s`;
    }
}

function cancelResearch() {
	hideTooltip();
    clearInterval(getResearchInterval());
    setResearchInterval(null);

    const techName = getCurrentResearchingTech();
    if (!techName) return;

    // --- NEW: Refund Logic ---
    const tech = technologies.find(t => t.name === techName);
    if (tech && tech.cost) {
        let refundedResources = [];
        for (const cost of tech.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (resource) {
                // Calculate a 50% refund, rounded down
                const refundAmount = Math.floor(cost.amount * 0.5);
                resource.amount = Math.min(resource.amount + refundAmount, resource.capacity);
                refundedResources.push(`${refundAmount} ${cost.resource}`);
            }
        }
        // Update the UI and log the refund
        updateResourceInfo();
        if (refundedResources.length > 0) {
            addLogEntry(`Research cancelled. Refunded: ${refundedResources.join(', ')}.`, 'orange');
        }
    }
    
    // --- Original logic continues ---
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    setCurrentResearchElapsedSec(0);
    setCurrentResearchLastTickAt(0);
    localStorage.removeItem('researchState');
    setupResearchSection();
}

function handleResearchCompletion(tech, cancelButton) {
    if (!tech.isResearched) {
        const visibleBefore = new Set(
            (technologies || [])
                .filter(t => t && !t.isResearched && Array.isArray(t.prerequisites) && t.prerequisites.every(p => {
                    const pre = (technologies || []).find(x => x && x.name === p);
                    return !!pre?.isResearched;
                }))
                .map(t => t.name)
        );

        addLogEntry(`${tech.name} research complete!`, 'green');
        tech.isResearched = true;

        // --- NEW: Check for unlocks upon research completion ---
        let newUnlocks = false;
        if (tech.name === 'Starship Construction' && !activatedSections.shipyardSection) {
            activatedSections.shipyardSection = true;
            addLogEntry('New menu section unlocked: Shipyard', 'blue');
            newUnlocks = true;
        }
        if (tech.name === 'Stellar Cartography' && !activatedSections.galaxyMapSection) {
            activatedSections.galaxyMapSection = true;
            addLogEntry('New menu section unlocked: Galaxy Map', 'blue');
            newUnlocks = true;
        }

        // Building unlocks tied to research
        if (tech.name === 'Crystal Analysis') {
            const workshop = (buildings || []).find(b => b && b.name === 'Workshop');
            if (workshop && !workshop.isUnlocked) {
                workshop.isUnlocked = true;
                workshop.uiNew = true;
                addLogEntry('New building unlocked: Workshop', 'blue');

                // Surface the unlock as a menu badge unless the player is already in Colony.
                try {
                    const current = localStorage.getItem('currentSection');
                    if (current !== 'colonySection') setColonyMenuNewItemFlag(true);
                } catch {
                    setColonyMenuNewItemFlag(true);
                }
            }

            // Story popup for Crystal Analysis completion
            try {
                const evt = storyEvents && storyEvents.crystal_analysis_complete;
                if (evt) {
                    const payload = { unlocks: { buildings: ['Workshop'] } };
                    showStoryPopup(evt, payload);
                    addLogEntry('Crystal Analysis complete. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt, payload) });
                }
            } catch { /* non-fatal */ }
        }

        // Workforce is consumed by Colony UI (unlocks a Ship Salvage action there).
        if (tech.name === 'Workforce') {
            try {
                const clears = Math.max(0, Math.min(5, Number(gameFlags.cargoBayRouteClears) || 0));
                const reached = !!gameFlags.cargoBayReached || clears >= 5;
                if (!reached) {
                    gameFlags.cargoBayRouteUiNew = true;

                    // Surface the unlock as a menu badge unless the player is already in Colony.
                    try {
                        const current = localStorage.getItem('currentSection');
                        if (current !== 'colonySection') setColonyMenuNewItemFlag(true);
                    } catch {
                        setColonyMenuNewItemFlag(true);
                    }
                }

                // Story popup for Workforce completion
                try {
                    const evt = storyEvents && storyEvents.workforce_research_complete;
                    if (evt) {
                        const payload = { unlocks: { actions: ['Clear Route to Cargo Bay'] } };
                        showStoryPopup(evt, payload);
                        addLogEntry('Workforce research complete. (Click to read)', LogType.STORY, { onClick: () => showStoryPopup(evt, payload) });
                    }
                } catch { /* non-fatal */ }
            } catch { /* non-fatal */ }
        }

        // Mark newly-available techs with the "new" badge.
        const visibleAfter = new Set(
            (technologies || [])
                .filter(t => t && !t.isResearched && Array.isArray(t.prerequisites) && t.prerequisites.every(p => {
                    const pre = (technologies || []).find(x => x && x.name === p);
                    return !!pre?.isResearched;
                }))
                .map(t => t.name)
        );
        visibleAfter.forEach(name => {
            if (visibleBefore.has(name)) return;
            const t = (technologies || []).find(x => x && x.name === name);
            if (t) t.uiNew = true;
        });

        if (newUnlocks) {
            setActivatedSections(activatedSections); // Save the updated unlocks
			applyActivatedSections();
        }
    }
    
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    
    setupResearchSection(); 
    setupColonySection();
}

export function startResearch(tech, cancelButton) {
    // --- NEW: Affordability Check ---
    let canAfford = true;
    if (tech.cost && tech.cost.length > 0) {
        for (const cost of tech.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            if (!resource || resource.amount < cost.amount) {
                canAfford = false;
                addLogEntry(`Not enough ${cost.resource} to research ${tech.name}.`, 'red');
                break;
            }
        }
    }

    // If we can't afford it, stop the function right here.
    if (!canAfford) {
        return;
    }

    // --- NEW: Deduct Resources ---
    if (tech.cost && tech.cost.length > 0) {
        for (const cost of tech.cost) {
            const resource = resources.find(r => r.name === cost.resource);
            resource.amount -= cost.amount;
        }
        updateResourceInfo(); // Update the display to show the new resource totals
    }
    
    // --- Original logic continues here ---
    if (getResearchInterval()) {
        clearInterval(getResearchInterval());
        setResearchInterval(null);
    }

    setCurrentResearchingTech(tech.name);
    setResearchProgress(0);
    currentResearchDuration = tech.duration;
    setCurrentResearchStartTime(Date.now());
    setCurrentResearchElapsedSec(0);
    setCurrentResearchLastTickAt(Date.now());
    updateProgressBar(cancelButton);

    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    addLogEntry(`Started researching ${tech.name}.`, 'yellow');

    getResearchScope().querySelectorAll('.tech-button').forEach(button => {
        button.disabled = true;
    });

    setResearchInterval(setInterval(() => {
        const now = Date.now();
        const last = Number(getCurrentResearchLastTickAt()) || now;
        setCurrentResearchLastTickAt(now);

        // Pause safety: do not advance research while paused.
        try {
            if (localStorage.getItem('gamePaused') === 'true') {
                updateProgressBar(cancelButton);
                return;
            }
        } catch { /* ignore */ }

        const dtReal = Math.max(0, (now - last) / 1000);
        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1;
        const dtScaled = dtReal * (isFinite(timeScale) ? timeScale : 1);

        const nextElapsed = Math.max(0, (Number(getCurrentResearchElapsedSec()) || 0) + dtScaled);
        setCurrentResearchElapsedSec(nextElapsed);

        const progress = currentResearchDuration > 0 ? (nextElapsed / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 100));
}

export function resumeOngoingResearch(tech, cancelButton, savedProgress, savedStartTime) {
    if (getResearchInterval()) {
        clearInterval(getResearchInterval());
        setResearchInterval(null);
    }

    setCurrentResearchingTech(tech.name);
    setResearchProgress(savedProgress);
    currentResearchDuration = tech.duration;
    setCurrentResearchStartTime(savedStartTime);
    // Back-compat: if we only have percent progress, derive elapsed seconds from it.
    const derivedElapsed = (Number(savedProgress) || 0) / 100 * (Number(tech.duration) || 0);
    setCurrentResearchElapsedSec(Math.max(0, derivedElapsed));
    setCurrentResearchLastTickAt(Date.now());
    updateProgressBar(cancelButton);

    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    setResearchInterval(setInterval(() => {
        const now = Date.now();
        const last = Number(getCurrentResearchLastTickAt()) || now;
        setCurrentResearchLastTickAt(now);

        try {
            if (localStorage.getItem('gamePaused') === 'true') {
                updateProgressBar(cancelButton);
                return;
            }
        } catch { /* ignore */ }

        const dtReal = Math.max(0, (now - last) / 1000);
        const timeScale = (typeof window !== 'undefined' && window.TIME_SCALE) ? Number(window.TIME_SCALE) : 1;
        const dtScaled = dtReal * (isFinite(timeScale) ? timeScale : 1);

        const nextElapsed = Math.max(0, (Number(getCurrentResearchElapsedSec()) || 0) + dtScaled);
        setCurrentResearchElapsedSec(nextElapsed);

        const progress = currentResearchDuration > 0 ? (nextElapsed / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 100));
}