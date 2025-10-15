import { resources, updateResourceInfo, setupInfoPanel } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupColonySection, updateBuildingButtonsState } from './sections/colony.js';
import { setupResearchSection, updateTechButtonsState } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { setupShipyardSection } from './sections/shipyard.js';
import { setupGalaxyMapSection } from './sections/galaxyMap.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry, LogType } from './log.js';
import { showStoryPopup } from './popup.js';
import { storyEvents } from './data/storyEvents.js';
import { initOptions, setGlowColor, setActiveGlowColor, setGlowIntensity, shouldRunInBackground } from './options.js';
import { formatNumber } from './formatting.js';
import { updateImpactTimer } from './eventManager.js';
import './headeroptions.js';

window.debugResources = resources;

let lastUpdateTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('preloader').classList.add('hidden');
    startGame();
});

document.addEventListener('beforeunload', () => {
    saveGameState();
});

function startGame() {
	initOptions();
	// Load main glow color
    const savedColor = localStorage.getItem('glowColor') || 'green';
    setGlowColor(savedColor);
	const savedIntensity = localStorage.getItem('glowIntensity') || 1;
    setGlowIntensity(savedIntensity);

    // NEW: Load active button glow color
    const savedActiveColor = localStorage.getItem('activeGlowColor') || 'green';
    setActiveGlowColor(savedActiveColor);
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState();
    } else {
        localStorage.removeItem('isResetting');
        resetToDefaultState();
    }

    const colonySection = document.createElement('div');
    colonySection.id = 'colonySection';
    colonySection.classList.add('game-section');

    const researchSection = document.createElement('div');
    researchSection.id = 'researchSection';
    researchSection.classList.add('game-section');

    const manufacturingSection = document.createElement('div');
    manufacturingSection.id = 'manufacturingSection';
    manufacturingSection.classList.add('game-section');
	
	const shipyardSection = document.createElement('div');
    shipyardSection.id = 'shipyardSection';
    shipyardSection.classList.add('game-section');

    const galaxyMapSection = document.createElement('div');
    galaxyMapSection.id = 'galaxyMapSection';
    galaxyMapSection.classList.add('game-section');

    document.getElementById('gameArea').appendChild(colonySection);
    document.getElementById('gameArea').appendChild(researchSection);
    document.getElementById('gameArea').appendChild(manufacturingSection);
	document.getElementById('gameArea').appendChild(shipyardSection);
	document.getElementById('gameArea').appendChild(galaxyMapSection);

    setupInfoPanel();
    setupColonySection(colonySection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);
	setupShipyardSection(shipyardSection);
	setupGalaxyMapSection(galaxyMapSection);
	
    setupMenuButtons();
    loadCurrentSection();
    updateResourceInfo();
    applyActivatedSections();

setInterval(() => {
        // Calculate delta time
        const now = Date.now();
        let deltaTime = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;

        // --- NEW PAUSE LOGIC ---
        // If the setting is off and the tab has been inactive for a while (e.g., > 2 seconds)
        if (!shouldRunInBackground() && deltaTime > 2) {
            deltaTime = 0; // Ignore the time that passed, effectively pausing the game
        }

        // --- The rest of the loop proceeds as normal ---
        buildings.forEach(building => {
            const resourceToProduce = resources.find(r => r.name === building.produces);
            if (resourceToProduce) {
                const newAmount = resourceToProduce.amount + (building.rate * building.count) * deltaTime;
                resourceToProduce.amount = Math.min(newAmount, resourceToProduce.capacity);
            }
        });
        
        updateResourceInfo();
        checkConditions();
        updateBuildingButtonsState();
        updateTechButtonsState();
        updateImpactTimer();
    }, 100);
	
setInterval(() => {
        saveGameState();
    }, 300000); // 300000 milliseconds = 300 seconds
}


export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || {
    researchSection: false,
    manufacturingSection: false,
	shipyardSection: false,
	galaxyMapSection: false,
};

function setupMenuButtons() {
    const sections = ['colonySection', 'researchSection', 'manufacturingSection', 'shipyardSection', 'galaxyMapSection'];
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;
        const displayName = section.replace('Section', '').charAt(0).toUpperCase() + section.replace('Section', '').slice(1);
        button.textContent = displayName;

        button.addEventListener('click', () => showSection(section));

        container.appendChild(button);
    });
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        if (!activatedSections[section] && section !== 'colonySection') {
            button.classList.add('hidden');
        } else {
            button.classList.remove('hidden');
        }
    });
}

export function checkConditions() {
    const stone = resources.find(r => r.name === 'Stone');
    const xylite = resources.find(r => r.name === 'Xylite');

    // Xylite discovery logic
    if (stone && xylite) {
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            updateResourceInfo();
            setupColonySection();

            // Pass the whole event object
            showStoryPopup(storyEvents.unlockXylite);
            
            addLogEntry('A crystalline anomaly has been detected. (Click to read)', '#7E57C2', {
                onClick: () => showStoryPopup(storyEvents.unlockXylite)
            });
        }
    }
    
// Research section unlock logic
const laboratory = buildings.find(b => b.name === 'Laboratory');
if (stone && laboratory && stone.amount >= 10 && !laboratory.isUnlocked) {
    laboratory.isUnlocked = true;
    setupColonySection();

    // Show the story popup
    showStoryPopup(storyEvents.unlockResearch);
    
    // Add the first, clickable log entry
    addLogEntry('A glimmer of insight has been recorded. (Click to read)', '#7E57C2', {
        onClick: () => showStoryPopup(storyEvents.unlockResearch)
    });

    // Add the second, non-clickable log entry after it
    addLogEntry('The ability to construct a Laboratory has been unlocked!', 'purple');
}

    // Manufacturing section unlock logic
    const manufacturingButton = document.querySelector('.menu-button[data-section="manufacturingSection"]');
    if (stone && manufacturingButton) {
        if (stone.amount >= 20 && !activatedSections['manufacturingSection']) {
            manufacturingButton.classList.remove('hidden');
            addLogEntry('New menu section activated: Manufacturing', 'blue');
            activatedSections['manufacturingSection'] = true;
            applyActivatedSections();
        }
    }
}

// A single, global tooltip element
let globalTooltip = null;

function getOrCreateTooltip() {
    if (!globalTooltip) {
        globalTooltip = document.createElement('div');
        globalTooltip.className = 'tooltip';
        document.body.appendChild(globalTooltip);
    }
    return globalTooltip;
}

export function hideTooltip() {
    const tooltip = getOrCreateTooltip();
    if (tooltip) {
        tooltip.style.visibility = 'hidden';
    }
}

function updateTooltipPosition(e, tooltip) {
    // Get the dimensions of the tooltip and the window
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default position: to the right and below the cursor
    let newLeft = e.clientX + 15;
    let newTop = e.clientY + 15;

    // Check if it goes off the right edge
    if (newLeft + tooltipRect.width > viewportWidth) {
        newLeft = e.clientX - tooltipRect.width - 15; // Flip to the left
    }

    // Check if it goes off the bottom edge
    if (newTop + tooltipRect.height > viewportHeight) {
        newTop = e.clientY - tooltipRect.height - 15; // Flip above
    }

    // Ensure it doesn't go off the top or left edges either
    if (newTop < 0) { newTop = 5; }
    if (newLeft < 0) { newLeft = 5; }

    tooltip.style.left = `${newLeft}px`;
    tooltip.style.top = `${newTop}px`;
}

export function setupTooltip(element, tooltipData) {
    const tooltip = getOrCreateTooltip();

    element.addEventListener('mouseenter', (e) => {
        // --- The heavy work of building the tooltip is done ONCE here ---
        tooltip.innerHTML = '';

        if (tooltipData && typeof tooltipData.totalProduction !== 'undefined') {
            tooltip.innerHTML = `
                <h4>Production Breakdown</h4>
                <div class="tooltip-section">
                    <p>Base: ${formatNumber(tooltipData.base)}/s</p>
                    ${tooltipData.buildings.map(b => `<p class="tooltip-detail">+ ${formatNumber(b.amount)}/s from ${b.count}x ${b.name}</p>`).join('')}
                </div>
                <div class="tooltip-section">
                    <p>Bonus: +${(tooltipData.bonusMultiplier * 100).toFixed(0)}%</p>
                    ${tooltipData.bonuses.map(b => `<p class="tooltip-detail">+${b.multiplier * 100}% from ${b.name}</p>`).join('')}
                </div>
                <hr>
                <p><strong>Total: ${formatNumber(tooltipData.totalProduction)}/s</strong></p>
            `;
        // Case 2: Simple string
        } else if (typeof tooltipData === 'string') {
            tooltip.textContent = tooltipData;
        
        // Case 3: Building object
        } else if (tooltipData && typeof tooltipData.count !== 'undefined') {
            if (tooltipData.description) {
                const description = document.createElement('p');
                description.className = 'tooltip-description';
                description.textContent = tooltipData.description;
                tooltip.appendChild(description);
            }
            if (tooltipData.cost && tooltipData.cost.length > 0) {
                const costHeader = document.createElement('h4');
                costHeader.textContent = 'Cost';
                tooltip.appendChild(costHeader);
                tooltipData.cost.forEach(c => {
                    const costItem = document.createElement('p');
                    costItem.textContent = `${c.resource}: ${c.amount}`;
                    tooltip.appendChild(costItem);
                });
            }
            if (tooltipData.produces) {
                const genHeader = document.createElement('h4');
                genHeader.textContent = 'Generation';
                tooltip.appendChild(genHeader);
                const genItem = document.createElement('p');
                genItem.textContent = `${tooltipData.produces}: +${tooltipData.rate}/s`;
                tooltip.appendChild(genItem);
            }

        // Case 4: Technology object
        } else if (tooltipData && typeof tooltipData.duration !== 'undefined') {
            const title = document.createElement('h4');
            title.textContent = tooltipData.name;
            tooltip.appendChild(title);
            if (tooltipData.description) {
                const description = document.createElement('p');
                description.className = 'tooltip-description';
                description.textContent = tooltipData.description;
                tooltip.appendChild(description);
            }
            if (tooltipData.cost && tooltipData.cost.length > 0) {
                const costHeader = document.createElement('h4');
                costHeader.textContent = 'Cost';
                tooltip.appendChild(costHeader);
                tooltipData.cost.forEach(c => {
                    const costItem = document.createElement('p');
                    costItem.textContent = `${c.resource}: ${c.amount}`;
                    tooltip.appendChild(costItem);
                });
            }
            const duration = document.createElement('p');
            duration.textContent = `Research Time: ${tooltipData.duration}s`;
            tooltip.appendChild(duration);
        }

        tooltip.style.visibility = 'visible';
        updateTooltipPosition(e, tooltip);
    });

    element.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
    });

// --- This now ONLY updates the position, which is very fast ---
    element.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e, tooltip);
    });
}

window.showSection = function(sectionId) {
    // --- NEW LOGIC: Manage the active button style ---
    // First, find all menu buttons and remove the .active class from them
    const allMenuButtons = document.querySelectorAll('.menu-button');
    allMenuButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Next, find the button that was just clicked and add the .active class to it
    const newActiveButton = document.querySelector(`.menu-button[data-section="${sectionId}"]`);
    if (newActiveButton) {
        newActiveButton.classList.add('active');
    }

    // --- Original logic to show/hide the section panels ---
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
    }
    
    localStorage.setItem('currentSection', sectionId);
};

function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');

    // Check if the saved section is actually unlocked
    if (savedSection && activatedSections[savedSection]) {
        showSection(savedSection);
    } else {
        // If the saved section is locked (or doesn't exist), default to colony
        showSection('colonySection');
    }
}