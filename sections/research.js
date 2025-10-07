import { addLogEntry } from '../log.js';
import { technologies } from '../data/technologies.js';
import { setupTooltip, hideTooltip, activatedSections, setActivatedSections, applyActivatedSections } from '../main.js';
import { setupMiningSection } from './mining.js';
import { resources, updateResourceInfo } from '../resources.js';

export let currentResearchingTech = null;
export let researchInterval = null;
export let currentResearchDuration = 0;
export let currentResearchStartTime = 0;
export let researchProgress = 0;

const createdTechButtons = new Set();

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

function createTechButton(name, onClick, container, tooltipData) {
    const button = document.createElement('button');
    button.className = 'tech-button';
    button.dataset.tech = name;
    button.innerText = name;
    button.addEventListener('click', onClick);

    if (tooltipData) {
        setupTooltip(button, tooltipData);
    }

    container.appendChild(button);
}

export function updateTechButtonsState() {
    // Find all visible tech buttons
    const techButtons = document.querySelectorAll('.tech-button');

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

    // NEW: Remember which tab is currently active before we delete everything
    let activeTabName = 'available';
    const currentActiveTab = researchSection.querySelector('.tab.active');
    if (currentActiveTab && currentActiveTab.textContent === 'Researched Tech') {
        activeTabName = 'researched';
    }

    // Now, we rebuild the entire UI
    researchSection.innerHTML = '';
    researchSection.classList.add('research-bg');

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
	setupTooltip(cancelButton, 'Cancels research and refunds 50% of the cost.');
    cancelButton.className = 'cancel-button';
    cancelButton.textContent = 'Cancel Research';
    cancelButton.style.display = 'none';
    cancelButton.addEventListener('click', cancelResearch);
    progressInfo.appendChild(cancelButton);
    progressBarContainer.appendChild(progressBar);
    progressBarContainer.appendChild(progressInfo);
    researchSection.appendChild(progressBarContainer);

    // --- Block 2: Create the Tabs ---
    const tabContainer = document.createElement('div');
    tabContainer.className = 'tab-container';

    // MODIFIED: Neither tab starts with the .active class. showTab() will handle it.
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
    researchSection.appendChild(tabContainer);

    // --- Block 3: Create the Content Panels ---
    // MODIFIED: The 'available' container no longer starts with the .active class.
    const availableContainer = document.createElement('div');
    availableContainer.className = 'tech-container available'; 
    const researchedContainer = document.createElement('div');
    researchedContainer.className = 'tech-container researched';

    const categories = ['Mining Tech', 'Bio Tech', 'Social Tech'];

    // Logic for the "Available Tech" tab (unchanged)
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

    // Logic for the "Researched Tech" tab (unchanged)
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

    researchSection.appendChild(availableContainer);
    researchSection.appendChild(researchedContainer);

    // NEW: Restore the previously active tab using the showTab function
    showTab(activeTabName);

    if (currentResearchingTech) {
        updateProgressBar(cancelButton);
        document.querySelectorAll('.tech-button').forEach(button => button.disabled = true);
        if (cancelButton) cancelButton.style.display = 'inline-block';
    }
	updateTechButtonsState();
}

function showTab(tabName) {
    const availableContainer = document.querySelector('.tech-container.available');
    const researchedContainer = document.querySelector('.tech-container.researched');
    const availableTab = document.querySelector('.tab:nth-child(1)');
    const researchedTab = document.querySelector('.tab:nth-child(2)');

    if (tabName === 'available') {
        availableContainer.classList.add('active');
        researchedContainer.classList.remove('active');
        availableTab.classList.add('active');
        researchedTab.classList.remove('active');
    } else {
        availableContainer.classList.remove('active');
        researchedContainer.classList.add('active');
        availableTab.classList.remove('active');
        researchedTab.classList.add('active');
    }
}

function updateProgressBar(cancelButton) {
    const progressBar = document.querySelector('.progress-bar');
    const progressText = document.querySelector('.progress-text');

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
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
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
    localStorage.removeItem('researchState');
    setupResearchSection();
}

function handleResearchCompletion(tech, cancelButton) {
    if (!tech.isResearched) {
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

        if (newUnlocks) {
            setActivatedSections(activatedSections); // Save the updated unlocks
			applyActivatedSections();
        }
    }
    
    setResearchProgress(0);
    setCurrentResearchingTech(null);
    
    setupResearchSection(); 
    setupMiningSection();
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
    updateProgressBar(cancelButton);

    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    addLogEntry(`Started researching ${tech.name}.`, 'yellow');

    document.querySelectorAll('.tech-button').forEach(button => {
        button.disabled = true;
    });

    setResearchInterval(setInterval(() => {
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
        const progress = currentResearchDuration > 0 ? (elapsedTime / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 1000));
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
    updateProgressBar(cancelButton);

    if (cancelButton) {
        cancelButton.style.display = 'inline-block';
        cancelButton.dataset.tech = tech.name;
    }

    setResearchInterval(setInterval(() => {
        const elapsedTime = (Date.now() - getCurrentResearchStartTime()) / 1000;
        const progress = currentResearchDuration > 0 ? (elapsedTime / currentResearchDuration) * 100 : 0;
        setResearchProgress(progress);
        updateProgressBar(cancelButton);

        if (getResearchProgress() >= 100) {
            clearInterval(getResearchInterval());
            setResearchInterval(null);
            handleResearchCompletion(tech, cancelButton);
        }
    }, 1000));
}