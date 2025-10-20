import { resources, updateResourceInfo, setupInfoPanel } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupColonySection, updateBuildingButtonsState } from './sections/colony.js';
import { setupResearchSection, updateTechButtonsState } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { setupShipyardSection } from './sections/shipyard.js';
import { setupGalaxyMapSection } from './sections/galaxyMap.js';
import { setupCrashSiteSection } from './sections/crashSite.js';
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
    const savedColor = localStorage.getItem('glowColor') || 'green';
    setGlowColor(savedColor);
	const savedIntensity = localStorage.getItem('glowIntensity') || 1;
    setGlowIntensity(savedIntensity);

    const savedActiveColor = localStorage.getItem('activeGlowColor') || 'green';
    setActiveGlowColor(savedActiveColor);
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        loadGameState();
    } else {
        localStorage.removeItem('isResetting');
        resetToDefaultState();
    }

    // --- Create all game section elements ---
    const crashSiteSection = document.createElement('div');
    crashSiteSection.id = 'crashSiteSection';
    crashSiteSection.classList.add('game-section');

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

    // --- Append all sections to the game area ---
    const gameArea = document.getElementById('gameArea');
    gameArea.appendChild(crashSiteSection);
    gameArea.appendChild(colonySection);
    gameArea.appendChild(researchSection);
    gameArea.appendChild(manufacturingSection);
	gameArea.appendChild(shipyardSection);
	gameArea.appendChild(galaxyMapSection);

    // --- Setup all sections ---
    setupInfoPanel();
    setupCrashSiteSection(crashSiteSection);
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
        const now = Date.now();
        let deltaTime = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;

        if (!shouldRunInBackground() && deltaTime > 2) {
            deltaTime = 0;
        }

        // --- Resource Production (existing logic) ---
        buildings.forEach(building => {
            const resourceToProduce = resources.find(r => r.name === building.produces);
            if (resourceToProduce) {
                const newAmount = resourceToProduce.amount + (building.rate * building.count) * deltaTime;
                resourceToProduce.amount = Math.min(newAmount, resourceToProduce.capacity);
            }
        });
        
        // --- ADDED: Resource Consumption ---
        const survivorResource = resources.find(r => r.name === 'Survivors');
        const survivorCount = survivorResource ? survivorResource.amount : 0;

        resources.forEach(resource => {
            if (resource.baseConsumption) {
                const consumption = resource.baseConsumption * survivorCount * deltaTime;
                resource.amount = Math.max(0, resource.amount - consumption);
            }
        });

        // --- UI Updates (existing logic) ---
        updateResourceInfo();
        checkConditions();
        updateBuildingButtonsState();
        updateTechButtonsState();
        updateImpactTimer();
    }, 100);
	
    setInterval(() => {
        saveGameState();
    }, 300000);
}

export function getInitialActivatedSections() {
    return {
        crashSiteSection: true,
        colonySection: false,
        researchSection: false,
        manufacturingSection: false,
        shipyardSection: false,
        galaxyMapSection: false,
    };
}


export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || getInitialActivatedSections();

function setupMenuButtons() {
    const sections = ['crashSiteSection', 'colonySection', 'researchSection', 'manufacturingSection', 'shipyardSection', 'galaxyMapSection'];
    const container = document.querySelector('.menu-buttons-container');
    container.innerHTML = '';
    sections.forEach(section => {
        const button = document.createElement('button');
        button.className = 'menu-button';
        button.dataset.section = section;
        
        const baseName = section.replace('Section', '');
        const formattedName = baseName.replace(/([A-Z])/g, ' $1');
        const displayName = formattedName.charAt(0).toUpperCase() + formattedName.slice(1);

        button.textContent = displayName;
        button.addEventListener('click', () => showSection(section));
        container.appendChild(button);
    });
}

export function applyActivatedSections() {
    document.querySelectorAll('.menu-button[data-section]').forEach(button => {
        const section = button.getAttribute('data-section');
        // MODIFIED: Simplified logic to just check the flag
        if (activatedSections[section]) {
            button.classList.remove('hidden');
        } else {
            button.classList.add('hidden');
        }
    });
}

export function checkConditions() {
    const stone = resources.find(r => r.name === 'Stone');
    const xylite = resources.find(r => r.name === 'Xylite');

    if (stone && xylite) {
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            updateResourceInfo();
            setupColonySection();
            showStoryPopup(storyEvents.unlockXylite);
            addLogEntry('A crystalline anomaly has been detected. (Click to read)', LogType.STORY, {
                onClick: () => showStoryPopup(storyEvents.unlockXylite)
            });
        }
    }
    
    const laboratory = buildings.find(b => b.name === 'Laboratory');
    if (stone && laboratory && stone.amount >= 10 && !laboratory.isUnlocked) {
        laboratory.isUnlocked = true;
        setupColonySection();
        showStoryPopup(storyEvents.unlockResearch);
        addLogEntry('A glimmer of insight has been recorded. (Click to read)', LogType.STORY, {
            onClick: () => showStoryPopup(storyEvents.unlockResearch)
        });
        addLogEntry('The ability to construct a Laboratory has been unlocked!', LogType.UNLOCK);
    }

    const manufacturingButton = document.querySelector('.menu-button[data-section="manufacturingSection"]');
    if (stone && manufacturingButton) {
        if (stone.amount >= 20 && !activatedSections['manufacturingSection']) {
            manufacturingButton.classList.remove('hidden');
            addLogEntry('New menu section activated: Manufacturing', LogType.UNLOCK);
            activatedSections['manufacturingSection'] = true;
            applyActivatedSections();
        }
    }
}

let globalTooltip = null;

export function getOrCreateTooltip() {
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

export function updateTooltipPosition(e, tooltip) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let newLeft = e.clientX + 15;
    let newTop = e.clientY + 15;

    if (newLeft + tooltipRect.width > viewportWidth) {
        newLeft = e.clientX - tooltipRect.width - 15;
    }
    if (newTop + tooltipRect.height > viewportHeight) {
        newTop = e.clientY - tooltipRect.height - 15;
    }
    if (newTop < 0) { newTop = 5; }
    if (newLeft < 0) { newLeft = 5; }
    
    tooltip.style.left = `${newLeft}px`;
    tooltip.style.top = `${newTop}px`;
}

export function setupTooltip(element, tooltipData) {
    const tooltip = getOrCreateTooltip();

    element.addEventListener('mouseenter', (e) => {
        tooltip.innerHTML = '';

        // Case 1: Production Breakdown
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
                tooltip.innerHTML += `<p class="tooltip-description">${tooltipData.description}</p>`;
            }
            if (tooltipData.cost && tooltipData.cost.length > 0) {
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${tooltipData.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
            }
            if (tooltipData.produces) {
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Generation</h4><p>${tooltipData.produces}: +${tooltipData.rate}/s</p></div>`;
            }

        // Case 4: Technology object
        } else if (tooltipData && typeof tooltipData.duration !== 'undefined' && !tooltipData.reward) {
            tooltip.innerHTML = `<h4>${tooltipData.name}</h4>`;
            if (tooltipData.description) {
                tooltip.innerHTML += `<p class="tooltip-description">${tooltipData.description}</p>`;
            }
            if (tooltipData.cost && tooltipData.cost.length > 0) {
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${tooltipData.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
            }
            tooltip.innerHTML += `<p>Research Time: ${tooltipData.duration}s</p>`;
        
        // --- Case for Action objects ---
        } else if (tooltipData && tooltipData.reward) {
            tooltip.innerHTML = `<h4>${tooltipData.name}</h4>`;

            if (tooltipData.description) {
                tooltip.innerHTML += `<p class="tooltip-description">${tooltipData.description}</p>`;
            }

            if (tooltipData.cost && tooltipData.cost.length > 0) {
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Cost</h4>${tooltipData.cost.map(c => `<p>${c.resource}: ${c.amount}</p>`).join('')}</div>`;
            }

            if (tooltipData.reward && tooltipData.reward.length > 0) {
                // MODIFIED: Display the amount as a range if it's an array
                const rewardHtml = tooltipData.reward.map(r => {
                    const amountText = Array.isArray(r.amount) ? `${r.amount[0]} - ${r.amount[1]}` : r.amount;
                    return `<p>${r.resource}: ${amountText}</p>`;
                }).join('');
                tooltip.innerHTML += `<div class="tooltip-section"><h4>Reward</h4>${rewardHtml}</div>`;
            }
            
            tooltip.innerHTML += `<p>Duration: ${tooltipData.duration}s</p>`;
        }

        tooltip.style.visibility = 'visible';
        updateTooltipPosition(e, tooltip);
    });

    element.addEventListener('mouseleave', () => {
        tooltip.style.visibility = 'hidden';
    });

    element.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e, tooltip);
    });
}

export function showSection(sectionId) {
    const allMenuButtons = document.querySelectorAll('.menu-button');
    allMenuButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    const newActiveButton = document.querySelector(`.menu-button[data-section="${sectionId}"]`);
    if (newActiveButton) {
        newActiveButton.classList.add('active');
    }

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

    // MODIFIED: Default to crashSiteSection for a new game
    const defaultSection = 'crashSiteSection';

    if (savedSection && activatedSections[savedSection]) {
        showSection(savedSection);
    } else {
        showSection(defaultSection);
    }
}