import { resources, updateResourceInfo } from './resources.js';
import { technologies } from './data/technologies.js';
import { buildings } from './data/buildings.js';
import { setupMiningSection } from './sections/mining.js';
import { setupResearchSection } from './sections/research.js';
import { setupManufacturingSection } from './sections/manufacturing.js';
import { loadGameState, saveGameState, resetToDefaultState } from './saveload.js';
import { addLogEntry } from './log.js';
import './headeroptions.js';

// This function will unlock all sections for testing
export function unlockAllSections() {
    activatedSections.researchSection = true;
    activatedSections.manufacturingSection = true;
    applyActivatedSections(); // Call this to update the menu buttons
}

// All core game logic starts here
document.addEventListener('DOMContentLoaded', () => {
    preloadImages();

    // Check for a reset flag in local storage
    const isResetting = localStorage.getItem('isResetting');
    if (!isResetting) {
        // If not resetting, load the game state
        loadGameState();
    } else {
        // If resetting, remove the flag and reset to default
        localStorage.removeItem('isResetting');
        resetToDefaultState();
    }

    // Create and append all sections to the game area
    const miningSection = document.createElement('div');
    miningSection.id = 'miningSection';
    miningSection.classList.add('game-section');

    const researchSection = document.createElement('div');
    researchSection.id = 'researchSection';
    researchSection.classList.add('game-section');

    const manufacturingSection = document.createElement('div');
    manufacturingSection.id = 'manufacturingSection';
    manufacturingSection.classList.add('game-section');

    document.getElementById('gameArea').appendChild(miningSection);
    document.getElementById('gameArea').appendChild(researchSection);
    document.getElementById('gameArea').appendChild(manufacturingSection);

    // Call the setup functions to populate the sections with content
    setupMiningSection(miningSection);
    setupResearchSection(researchSection);
    setupManufacturingSection(manufacturingSection);

    // After everything is set up, load the correct section
    loadCurrentSection();

    // The rest of the game's initialization
    updateResourceInfo();
    setupMenuButtons();
    applyActivatedSections();

    // The main game loop that runs every 100ms
    setInterval(() => {
        buildings.forEach(building => {
            const resourceToProduce = resources.find(r => r.name === building.produces);
            if (resourceToProduce) {
                resourceToProduce.amount += (building.rate * building.count) / 10;
            }
        });
        updateResourceInfo();
        checkConditions();
    }, 100);
});

// A single function to handle the visibility change event
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveGameState();
    }
});

// A simple way to manage the 'activatedSections' state
export function setActivatedSections(sections) {
    activatedSections = sections;
    localStorage.setItem('activatedSections', JSON.stringify(activatedSections));
}

export let activatedSections = JSON.parse(localStorage.getItem('activatedSections')) || {
    researchSection: false,
    manufacturingSection: false,
};

// Creates the main menu buttons
function setupMenuButtons() {
    const sections = ['miningSection', 'researchSection', 'manufacturingSection'];
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

// Applies the 'hidden' class to menu buttons that are not activated
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

// Handles conditions for unlocking new features
export function checkConditions() {
    const stone = resources.find(r => r.name === 'Stone');
    const xylite = resources.find(r => r.name === 'Xylite');

    if (stone && xylite) {
        if (stone.amount >= 5 && !xylite.isDiscovered) {
            xylite.isDiscovered = true;
            addLogEntry('Xylite discovered! Your miners can now find traces of this rare crystal.', 'blue');
            updateResourceInfo();
            setupMiningSection();
        }
    }
}

// Reloads the page to ensure the correct section is loaded
window.showSection = function(sectionId) {
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

// Loads the last active section or defaults to mining
function loadCurrentSection() {
    const savedSection = localStorage.getItem('currentSection');
    if (savedSection) {
        showSection(savedSection);
    } else {
        showSection('miningSection');
    }
}