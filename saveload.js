import { resources, updateResourceInfo, incrementResources } from './resources.js';
import { technologies } from './sections/technologies.js';
import { getResearchInterval, setResearchProgress, updateProgressBar, setupResearchSection } from './sections/research.js';
import { applyActivatedSections, checkConditions, activatedSections, setActivatedSections, resetActivatedSections, handleSectionClick } from './main.js'
import { setupMiningSection } from './sections/mining.js';

const defaultGameState = {
    resources: [
        { name: 'Hydrogen', generationRate: 3.00, amount: 0 },
        { name: 'Iron', generationRate: 0.06, amount: 0 },
        { name: 'Copper', generationRate: 0.01, amount: 0 },
        { name: 'Titanium', generationRate: 0.02, amount: 0 },
        { name: 'Dumbium', generationRate: 0.01, amount: 0 }
    ],
    technologies: [
      { name: 'Quantum Computing', duration: 5, isResearched: false, prerequisites: [] }, // No prerequisites
      { name: 'Nano Fabrication', duration: 15, isResearched: false, prerequisites: ['Quantum Computing'] },
      { name: 'AI Integration', duration: 20, isResearched: false, prerequisites: ['Quantum Computing'] },
      { name: 'Testtech', duration: 30, isResearched: false, prerequisites: ['Quantum Computing', 'AI Integration'] }
    ],
    activatedSections: {
        researchSection: false,
        manufacturingSection: false,
    }
};

export function loadGameState() {
    const savedGameState = localStorage.getItem('gameState');
    if (savedGameState) {
        const gameState = JSON.parse(savedGameState);
        console.log('Parsed gameState:', gameState);

        if (Array.isArray(gameState.resources)) {
            resources.length = 0;
            resources.push(...gameState.resources);
            console.log('Loaded resources:', resources);
        }
        if (Array.isArray(gameState.technologies)) {
            technologies.length = 0;
            technologies.push(...gameState.technologies);
            console.log('Loaded technologies:', technologies);
        }
        if (gameState.activatedSections) {
            setActivatedSections(gameState.activatedSections);
            console.log('Loaded activated sections:', activatedSections);
        }
        applyActivatedSections();
        updateResourceInfo();
    } else {
        console.log('No saved game state found, initializing with default game state');
        resetGameState(); // Initialize with default game state
    }
}

let currentResearchingTech = null;
let researchInterval; // Initialize without const to allow reassignment
let researchProgress = 0; // Initialize without const

export function resetGameState() {
    console.log('Resetting game state');

    // Load default game state
    resources.length = 0;
    resources.push(...defaultGameState.resources);
    console.log('Resources reset');

    technologies.length = 0;
    technologies.push(...defaultGameState.technologies);
    console.log('Technologies reset');

    resetActivatedSections();
    console.log('Activated sections reset');

    // Clear any ongoing research
    clearInterval(researchInterval);
    researchProgress = 0;
    currentResearchingTech = null;

    // Ensure no sections remain active
    const sections = document.querySelectorAll('.game-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });

    // Reinitialize all sections
    setupMiningSection();
    setupResearchSection();

    // Enable mining section by default
    showSection('miningSection');

    // Save default game state
    saveGameState();
    console.log('Default game state saved');
}

export function saveGameState() {
    console.log('Saving game state');
    const gameState = {
        resources,
        technologies,
        activatedSections
    };
    localStorage.setItem('gameState', JSON.stringify(gameState));
    console.log('Game state saved');
}

function autosaveGameState() {
    saveGameState();
    console.log('Autosave completed at', new Date().toLocaleTimeString());
}

// Start the autosave interval when the page loads
document.addEventListener('DOMContentLoaded', () => {
    setInterval(autosaveGameState, 5 * 60 * 1000); // Autosave every 5 minutes
});

window.addEventListener('beforeunload', saveGameState);
window.addEventListener('load', loadGameState);

