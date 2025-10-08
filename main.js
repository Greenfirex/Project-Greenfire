import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupMiningSection, updateBuildingButtonsState } from './sections/mining.js';
import { setupResearchSection, updateTechButtonsState } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { setupShipyardSection } from './sections/shipyard.js';
import { setupGalaxyMapSection } from './sections/galaxyMap.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry } from './log.js';
import { showStoryPopup } from './data/popup.js';
import { storyEvents } from './data/storyEvents.js';
import { initOptions, setGlowColor, setActiveGlowColor, setGlowIntensity } from './options.js';
import './headeroptions.js';

let lastUpdateTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
    preloadAssets().then(() => {
        // Až se načtou všechny prvky, schováme preloader a spustíme hru
        document.getElementById('preloader').classList.add('hidden');
        startGame();
    });
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
    const savedActiveColor = localStorage.getItem('activeGlowColor') || 'white';
    setActiveGlowColor(savedActiveColor);
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState();
    } else {
        localStorage.removeItem('isResetting');
        resetToDefaultState();
    }

    const miningSection = document.createElement('div');
    miningSection.id = 'miningSection';
    miningSection.classList.add('game-section');

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

    document.getElementById('gameArea').appendChild(miningSection);
    document.getElementById('gameArea').appendChild(researchSection);
    document.getElementById('gameArea').appendChild(manufacturingSection);
	document.getElementById('gameArea').appendChild(shipyardSection);
	document.getElementById('gameArea').appendChild(galaxyMapSection);

    setupMiningSection(miningSection);
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
        const deltaTime = (now - lastUpdateTime) / 1000; // Time in seconds since last update
        lastUpdateTime = now; // Reset the timer for the next loop

        // Update resources based on delta time
        buildings.forEach(building => {
            const resourceToProduce = resources.find(r => r.name === building.produces);
            if (resourceToProduce) {
                // MODIFIED: Multiply generation rate by the elapsed time
                const newAmount = resourceToProduce.amount + (building.rate * building.count) * deltaTime;
                resourceToProduce.amount = Math.min(newAmount, resourceToProduce.capacity);
            }
        });
        
        updateResourceInfo();
        checkConditions();
        updateBuildingButtonsState();
        updateTechButtonsState();
    }, 100);
setInterval(() => {
        saveGameState();
    }, 150000); // 15000 milliseconds = 15 seconds
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
    const sections = ['miningSection', 'researchSection', 'manufacturingSection', 'shipyardSection', 'galaxyMapSection'];
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
        if (!activatedSections[section] && section !== 'miningSection') {
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
            setupMiningSection();

            // --- TRIGGER THE POPUP ---
            const event = storyEvents.unlockXylite;
            showStoryPopup(event.title, event.message);
            
            addLogEntry('A crystalline anomaly has been detected. (Click to read)', '#7E57C2', {
                onClick: () => showStoryPopup(event.title, event.message)
            }
			);
			addLogEntry('Xylite discovered', 'blue');
        }
    }
    
    // Logika pro odemykání Research sekce
    const researchButton = document.querySelector('.menu-button[data-section="researchSection"]');
    if (stone && researchButton) {
        // Check if the unlock condition is met AND it hasn't been unlocked before
        if (stone.amount >= 10 && !activatedSections['researchSection']) {
            // 1. Update the game state
            activatedSections['researchSection'] = true;
            
            // 2. Update the UI to show the button
            applyActivatedSections(); 

            // 3. Show the story popup
            const event = storyEvents.unlockResearch;
            showStoryPopup(event.title, event.message);
            
            // 4. Add the clickable log entry
            addLogEntry('A glimmer of insight has been recorded. (Click to read)', '#7E57C2', {
                onClick: () => showStoryPopup(event.title, event.message)
            });
			addLogEntry('Research lab now available', 'blue');
        }
    }

    // Nová logika pro odemykání Manufacturing sekce
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

function preloadAssets() {
    const images = [
        'assets/images/background1.jpg',
        'assets/images/background2.jpg',
        'assets/images/background3.jpg',
        'assets/images/background4.jpg',
        'assets/images/background5.jpg',
        'assets/images/PNG/Button03.png',
        'assets/images/PNG/Button04.png',
    ];

    const promises = images.map(src => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = src;
        });
    });

    return Promise.all(promises);
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

export function setupTooltip(button, tooltipData) {
    const tooltip = getOrCreateTooltip();

    button.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = ''; // Clear previous content

        // Case 1: Handles simple tooltips (e.g., "Mine Stone")
        if (typeof tooltipData === 'string') {
            tooltip.textContent = tooltipData;
        
        // Case 2: Handles building objects (identified by having .produces or .effect)
        } else if (tooltipData && (tooltipData.produces || tooltipData.effect)) {
            
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

        // Case 3: Handles technology objects (identified by having .duration)
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

        // This makes the tooltip appear and sets its position
        tooltip.style.visibility = 'visible';
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY - 30}px`;
    });

    button.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
    });

    button.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY - 30}px`;
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
        // If the saved section is locked (or doesn't exist), default to mining
        showSection('miningSection');
    }
}